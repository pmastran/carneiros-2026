import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(root, 'public');
const cache = new Map();
const TTL_MS = 90_000;
const FEEDS = Object.freeze({
  checagens: '"Lula" "Flávio Bolsonaro" (checagem OR "fato ou fake" OR "Agência Lupa" OR "UOL Confere") when:3d',
  globo: '"Lula" "Flávio Bolsonaro" debate Globo 23 outubro 2026 when:3d'
});
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json; charset=utf-8'};

function decodeXml(str) {
  return String(str)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (full, code) => {
      try { const value = code.toLowerCase().startsWith('x') ? parseInt(code.slice(1), 16) : parseInt(code, 10); return String.fromCodePoint(value); }
      catch { return full; }
    })
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&amp;/g, '&').trim();
}
function tag(block, name) {
  const rx = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i');
  return decodeXml(rx.exec(block)?.[1] || '');
}
function parseFeed(xml) {
  const items = [];
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const link = tag(block, 'link');
    let host;
    try { host = new URL(link); } catch { continue; }
    if (host.protocol !== 'https:' || !(host.hostname === 'news.google.com' || host.hostname.endsWith('.google.com'))) continue;
    const source = tag(block, 'source') || 'Fonte não identificada';
    let title = tag(block, 'title');
    if (title.endsWith(' - ' + source)) title = title.slice(0, -source.length - 3);
    if (!title) continue;
    const parsed = new Date(tag(block,'pubDate'));
    items.push({title, source, url:link, published: Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()});
  }
  const unique = new Map();
  for (const i of items) if (!unique.has(i.title)) unique.set(i.title, i);
  return [...unique.values()].sort((a,b) => (b.published || '').localeCompare(a.published || '')).slice(0,35);
}
function headers(extra={}) {
  return {'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()', 'Content-Security-Policy': "default-src 'self'; base-uri 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; manifest-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'", ...extra};
}
function json(res, code, payload, extra={}) {res.writeHead(code,headers({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra}));res.end(JSON.stringify(payload));}
async function liveFeed(feedKey) {
  const entry = cache.get(feedKey);
  if (entry && Date.now() - entry.time < TTL_MS) return {...entry.payload,cached:true};
  const query = new URL('https://news.google.com/rss/search');
  query.searchParams.set('q',FEEDS[feedKey]); query.searchParams.set('hl','pt-BR'); query.searchParams.set('gl','BR'); query.searchParams.set('ceid','BR:pt-419');
  try {
    const response = await fetch(query.toString(), {signal:AbortSignal.timeout(10_000),headers:{'User-Agent':'Mozilla/5.0 RadarDaVerdade/1.0','Accept':'application/rss+xml,application/xml,text/xml'}});
    if (!response.ok) throw Error('O feed de notícias retornou HTTP ' + response.status);
    const xml = await response.text();
    if (!xml.includes('<rss') && !xml.includes('<feed')) throw Error('A origem não retornou um feed RSS válido.');
    const payload = {ok:true,category:feedKey,updatedAt:new Date().toISOString(),cached:false,items:parseFeed(xml),note:'Títulos de matérias sobre checagem não são vereditos de falas.'};
    cache.set(feedKey,{time:Date.now(),payload});
    return payload;
  } catch (e) {
    if (entry) return {...entry.payload,cached:true,stale:true,error:'Falha na atualização; mostrando coleta anterior.'};
    return {ok:false,category:feedKey,updatedAt:new Date().toISOString(),cached:false,items:[],error:'Feed indisponível. Use os links diretos de checadores.',detail:String(e?.message || e)};
  }
}
async function handle(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res,405,{error:'Método não permitido'});
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/healthz') return json(res,200,{ok:true,application:'Radar da Verdade'});
  if (url.pathname === '/api/claims') {
    try { const data=JSON.parse(await readFile(path.join(root,'data/claims.json'),'utf8')); return json(res,200,{...data,servedAt:new Date().toISOString()}); }
    catch { return json(res,503,{ok:false,error:'Base de checagens indisponível.'}); }
  }
  if (url.pathname === '/api/coverage') {
    const kind=url.searchParams.get('kind') || 'checagens';
    if (!Object.hasOwn(FEEDS,kind)) return json(res,400,{ok:false,error:'Categoria inválida'});
    return json(res,200,await liveFeed(kind));
  }
  if (url.pathname.startsWith('/api/')) return json(res,404,{ok:false,error:'Rota desconhecida'});
  let pathname;
  try {pathname=decodeURIComponent(url.pathname)} catch {return json(res,400,{error:'Caminho inválido'})}
  if (pathname.includes('\0') || pathname.split('/').includes('..')) return json(res,403,{error:'Acesso não permitido'});
  const file=path.resolve(publicRoot,'.'+(pathname === '/' ? '/index.html': pathname));
  if (!file.startsWith(publicRoot+path.sep)) return json(res,403,{error:'Acesso não permitido'});
  try {
    let content=await readFile(file);

    if (url.pathname === '/' && url.searchParams.has('verificacao')) {
      try {
        const id=url.searchParams.get('verificacao') || '';
        if (/^[a-z0-9-]{1,100}$/.test(id)) {
          const catalog=JSON.parse(await readFile(path.join(root,'data/claims.json'),'utf8'));
          const claim=(catalog.claims || []).find(item=>item.id===id);
          if (claim) {
            const escapeMeta=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
            const verdicts={'verdadeiro':'VERDADEIRO','falso':'FALSO','exagerado':'EXAGERADO','falta-contexto':'FALTA CONTEXTO','nao-comprovado':'NÃO COMPROVADO','subestimado':'SUBESTIMADO'};
            const label=verdicts[claim.verdict] || String(claim.verdict).toUpperCase();
            const candidate=claim.candidate==='lula'?'Lula':'Flávio Bolsonaro';
            const title=escapeMeta(label+' | '+candidate+' — Radar da Verdade');
            const descr=escapeMeta(claim.claim+' Classificação de '+claim.checker+': '+claim.explanation).slice(0,460);
            const origin='https://radar-verdade-debate-2026.onrender.com';
            const canonical=escapeMeta(origin+'/?verificacao='+encodeURIComponent(id));
            let html=content.toString('utf8');
            html=html.replace('<meta property="og:title" content="Radar da Verdade 2026">','<meta property="og:title" content="'+title+'">');
            html=html.replace(/<meta property="og:description" content="[^"]*">/,'<meta property="og:description" content="'+descr+'">');
            html=html.replace('<title>Radar da Verdade — Debate 2026</title>','<title>'+title+'</title>');
            html=html.replace('</head>','<meta name="description" content="'+descr+'">\n<meta property="og:type" content="article">\n<meta property="og:url" content="'+canonical+'">\n<meta property="og:image" content="'+origin+'/icon-512.png">\n<meta name="twitter:card" content="summary">\n</head>');
            content=Buffer.from(html);
          }
        }
      }catch{}
    }

    const ext=path.extname(file);
    const contentType=types[ext] || 'application/octet-stream';
    const cacheTime=ext==='.html'?'no-store':ext==='.js'||ext==='.css'?'public, max-age=300':'public, max-age=3600';
    res.writeHead(200,headers({'Content-Type':contentType,'Cache-Control':cacheTime}));
    res.end(req.method==='HEAD'?undefined:content);
  } catch {res.writeHead(404,headers({'Content-Type':'text/plain; charset=utf-8'}));res.end('Arquivo não encontrado');}
}

const port = Number(process.env.PORT || 3000);
const server = http.createServer((req,res)=>{handle(req,res).catch(e=>json(res,500,{error:'Falha interna',detail:process.env.NODE_ENV==='production'?undefined:String(e)}));});
if (process.env.NODE_ENV !== 'test') server.listen(port,'0.0.0.0',()=>console.log('Radar da Verdade na porta',port));
export {decodeXml,tag,parseFeed,server};
