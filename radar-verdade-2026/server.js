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
  globo: 'site:g1.globo.com/fato-ou-fake/ (Lula OR "Flávio Bolsonaro") debate when:7d'
});

const GLOBO_SEARCHES = Object.freeze([
 FEEDS.globo,
 '"Fato ou Fake" "Lula" "Flávio Bolsonaro" debate when:7d',
 '("O Globo" OR "CBN" OR "Valor Econômico") Lula "Flávio Bolsonaro" checagem debate when:7d'
]);
function isGrupoGlobo(item){
 return /^(g1|g1\.globo\.com|o globo|extra|valor econ[oô]mico|cbn|globonews)$/i.test(String(item.source||'').trim());
}
const structuredCache=new Map();
async function fetchStructured(){
 const apiKey=process.env.FACTCHECK_API_KEY;
 if(!apiKey)return {ok:false,configured:false,items:[],note:'A API do Google exige uma chave privada. A consulta pública por notícias continua disponível.'};
 const old=structuredCache.get('g1');
 if(old&&Date.now()-old.time<300000)return {...old.payload,cached:true};
 const u=new URL('https://factchecktools.googleapis.com/v1alpha1/claims:search');
 u.searchParams.set('query','Lula Flávio Bolsonaro debate');
 u.searchParams.set('languageCode','pt');
 u.searchParams.set('pageSize','50');
 u.searchParams.set('maxAgeDays','30');
 u.searchParams.set('key',apiKey);
 try{
  const response=await fetch(u,{signal:AbortSignal.timeout(9000),headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('Falha da API de checagem');
  const data=await response.json();
  const items=[];
  for(const claim of Array.isArray(data.claims)?data.claims:[]){
   for(const review of Array.isArray(claim.claimReview)?claim.claimReview:[]){
    let parsed;try{parsed=new URL(review.url)}catch{continue}
    if(parsed.protocol!=='https:'||!['g1.globo.com','oglobo.globo.com','extra.globo.com','valor.globo.com','cbn.globo.com'].includes(parsed.hostname))continue;
    if(!review.textualRating)continue;
    items.push({statement:String(claim.text||'').slice(0,600),claimant:String(claim.claimant||'').slice(0,150),rating:String(review.textualRating).slice(0,100),publisher:String(review.publisher?.name||parsed.hostname).slice(0,140),url:parsed.toString(),reviewedAt:review.reviewDate||null});
   }
  }
  const payload={ok:true,configured:true,items:[...new Map(items.map(x=>[x.url+' '+x.statement,x])).values()].slice(0,40),updatedAt:new Date().toISOString(),note:'Classificações publicadas pelos veículos e registradas na base do Google, sem avaliação automática pelo Radar.'};
  structuredCache.set('g1',{time:Date.now(),payload});
  return payload;
 }catch{
  if(old)return {...old.payload,stale:true,cached:true};
  return {ok:false,configured:true,items:[],note:'API de vereditos indisponível.'};
 }
}

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
async function fetchRssItems(search){
 const url=new URL('https://news.google.com/rss/search');
 url.searchParams.set('q',search);url.searchParams.set('hl','pt-BR');url.searchParams.set('gl','BR');url.searchParams.set('ceid','BR:pt-419');
 const response=await fetch(url.toString(),{signal:AbortSignal.timeout(9000),headers:{'User-Agent':'Mozilla/5.0 RadarDaVerdade/1.2','Accept':'application/rss+xml,application/xml,text/xml'}});
 if(!response.ok)throw Error('Feed respondeu HTTP '+response.status);
 const xml=await response.text();
 if(!xml.includes('<rss')&&!xml.includes('<feed'))throw Error('Resposta não contém RSS');
 return parseFeed(xml);
}
async function liveFeed(feedKey){
 const old=cache.get(feedKey);
 if(old&&Date.now()-old.time<TTL_MS)return {...old.payload,cached:true};
 try{
  let items;
  if(feedKey==='globo'){
   const results=await Promise.allSettled(GLOBO_SEARCHES.map(fetchRssItems));
   const good=results.filter(x=>x.status==='fulfilled');
   if(!good.length)throw Error('As consultas públicas não responderam');
   const uniq=new Map();
   for(const article of good.flatMap(x=>x.value).filter(isGrupoGlobo)){
    const k=article.title.toLowerCase().replace(/[^a-z0-9à-ÿ]+/gi,' ').trim();
    if(!uniq.has(k))uniq.set(k,article);
   }
   items=[...uniq.values()].sort((a,b)=>(b.published||'').localeCompare(a.published||'')).slice(0,35);
  }else items=await fetchRssItems(FEEDS[feedKey]);
  const payload={ok:true,category:feedKey,updatedAt:new Date().toISOString(),cached:false,items,sourceType:'google-news-rss',note:feedKey==='globo'?'Monitor público do Grupo Globo via agregador. NÃO é acesso à ferramenta interna de checagem. Uma manchete não é um veredito.':'Uma manchete não é um veredito.'};
  cache.set(feedKey,{time:Date.now(),payload});
  return payload;
 }catch(e){
  if(old)return {...old.payload,cached:true,stale:true,error:'Fonte indisponível; dados anteriores.'};
  return {ok:false,category:feedKey,updatedAt:new Date().toISOString(),cached:false,items:[],error:'Não foi possível consultar o índice público.',detail:String(e?.message||e)};
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
  if (url.pathname === '/api/factchecks') return json(res,200,await fetchStructured());
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
