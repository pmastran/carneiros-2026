import { createHash } from 'node:crypto';

export const LUPA_LIVE_URL = 'https://www.agencialupa.org/checagem/2026/10/23/ao-vivo-checagem-do-ultimo-debate-entre-lula-e-flavio-bolsonaro-no-segundo-turno/';
const TTL_MS = 45_000;
const MAX_HTML_BYTES = 2_000_000;
const VERDICT_MAP = {
  'VERDADEIRO': 'verdadeiro',
  'FALSO': 'falso',
  'FALTA CONTEXTO': 'falta-contexto',
  'EXAGERADO': 'exagerado',
  'SUBESTIMADO': 'subestimado',
  'ENGANOSO': 'falta-contexto'
};
let lastSuccess = null;
let cache = null;
let inflight = null;

function decodeHtml(text) {
  const named = {
    nbsp:' ', amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", hellip:'...',
    ldquo:'"', rdquo:'"', lsquo:"'", rsquo:"'", ndash:'-', mdash:'-',
    aacute:'\u00e1', eacute:'\u00e9', iacute:'\u00ed', oacute:'\u00f3', uacute:'\u00fa',
    agrave:'\u00e0', acirc:'\u00e2', ecirc:'\u00ea', ocirc:'\u00f4',
    atilde:'\u00e3', otilde:'\u00f5', ccedil:'\u00e7',
    Aacute:'\u00c1', Eacute:'\u00c9', Iacute:'\u00cd', Oacute:'\u00d3', Uacute:'\u00da'
  };
  return String(text)
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (full, num) => {
      const code = num[0].toLowerCase()==='x' ? parseInt(num.slice(1),16) : parseInt(num,10);
      try {return String.fromCodePoint(code)} catch {return full}
    })
    .replace(/&([a-zA-Z]+);/g,(full,key)=>Object.hasOwn(named,key)?named[key]:full);
}
function textFromHtml(markup) {
  return decodeHtml(String(markup)
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<(?:script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg)>/gi,' ')
    .replace(/<(?:figure|figcaption)\b[^>]*>[\s\S]*?<\/(?:figure|figcaption)>/gi,' ')
    .replace(/<br\s*\/?>/gi,'\n')
    .replace(/<\/(?:p|div|section|blockquote|h[1-6]|li|ul|ol|footer|cite)>/gi,'\n')
    .replace(/<[^>]+>/g,' ')
    .replace(/\r/g,'')
    .replace(/[ \t\f]+/g,' ')
    .replace(/ *\n */g,'\n')
    .replace(/\n{3,}/g,'\n\n')
    .trim()
  );
}
function fold(text) {
  return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[“”"'‘’]/g,'').replace(/\s+/g,' ').trim();
}
function short(text, max) {
  const words = String(text).replace(/\s+/g,' ').trim();
  if (words.length<=max) return words;
  const clipped=words.slice(0,max);
  return clipped.slice(0,Math.max(0,clipped.lastIndexOf(' ')))+'...';
}
const KNOWN_CLAIMS = [
  ['lula',/herdamos.{0,70}6[.\s]?000|6[.\s]?000.{0,30}obras/,'globo-lula-6000-obras'],
  ['flavio',/11[.\s]?500.{0,50}obras/,'globo-flavio-11500-obras'],
  ['lula',/acabado.{0,30}fome.{0,40}2012/,'globo-lula-fome-2012'],
  ['lula',/33\s*milhoes.{0,40}fome/,'globo-lula-fome-33-milhoes'],
  ['flavio',/barra.{0,30}chocolate|chocolate.{0,30}120g/,'globo-flavio-chocolate-80g'],
  ['lula',/700\s*novos\s*mercados/,'globo-lula-700-mercados'],
  ['lula',/br[-\s]?319/,'globo-lula-br319'],
  ['flavio',/400\s*bilhoes/,'globo-flavio-gastos-400-bi'],
  ['flavio',/bolsa familia.{0,85}600/,'globo-flavio-bolsa-familia-600'],
  ['flavio',/marco legal.{0,30}saneamento/,'globo-flavio-marco-saneamento'],
  ['flavio',/centro[-\s]?oeste.{0,70}mais produ/,'globo-flavio-centro-oeste'],
  ['flavio',/divida.{0,70}11\s*trilhoes/,'globo-flavio-divida-11tri'],
  ['lula',/bolsa[-\s]?farelo/,'globo-lula-bolsa-farelo'],
  ['flavio',/taxa de juros oficial.{0,70}14/,'globo-flavio-selic-14']
];
function knownId(candidate, statement) {
  const clean=fold(statement);
  return KNOWN_CLAIMS.find(([who,re])=>who===candidate&&re.test(clean))?.[2] || null;
}
export function parseLupaLiveHtml(html) {
  if(typeof html!=='string'||html.length<100) return [];
  const document=String(html).slice(0,MAX_HTML_BYTES);
  const blocks=[...document.matchAll(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote\s*>/gi)];
  const claims=[];
  for(let i=0;i<blocks.length;i++){
    const current=blocks[i];
    const end=(current.index||0)+current[0].length;
    const next=i+1<blocks.length?blocks[i+1].index:document.length;
    const quoteBlock=textFromHtml(current[1]);
    const following=textFromHtml(document.slice(end,Math.min(next,end+18000)));
    const beforeVerdict=following.slice(0,1500);
    const attribution=quoteBlock+'\n'+beforeVerdict;
    if(!/em debate no dia 23 de outubro de 2026 na globo/i.test(fold(attribution)))continue;
    const attributionMatch=attribution.match(/(Luiz In[a\u00e1]cio Lula da Silva\s*\(PT\)|Fl[a\u00e1]vio Bolsonaro\s*\(PL\))[\s\S]{0,220}?em debate no dia 23 de outubro de 2026 na Globo/i);
    if(!attributionMatch)continue;
    const candidate=/Fl[a\u00e1]vio Bolsonaro/i.test(attributionMatch[1])?'flavio':'lula';
    const speakerAt=quoteBlock.search(/(?:Luiz In[a\u00e1]cio Lula da Silva|Fl[a\u00e1]vio Bolsonaro)\s*\((?:PT|PL)\)/i);
    const statement=short((speakerAt>=0?quoteBlock.slice(0,speakerAt):quoteBlock).replace(/^[\s"'“”]+|[\s"'“”]+$/g,''),350);
    if(statement.length<12)continue;
    const match=following.slice(0,1200).match(/(?:^|\n)\s*(VERDADEIRO|FALSO|FALTA CONTEXTO|EXAGERADO|SUBESTIMADO|ENGANOSO)\s*(?:\n|$)/i);
    if(!match)continue;
    const verdict=VERDICT_MAP[match[1].trim().toUpperCase()];
    if(!verdict)continue;
    const afterLabel=following.slice(match.index+match[0].length).trim();
    const explanation=short(afterLabel.split(/\n\s*\n|\n(?=[A-Z][A-Z])/,1)[0] || afterLabel,340);
    const hash=createHash('sha256').update(candidate+'|'+fold(statement)).digest('hex').slice(0,16);
    const id=knownId(candidate,statement)||'lupa-globo-'+hash;
    claims.push({
      id,event:'globo-23',candidate,date:'2026-10-23',subject:'Declara\u00e7\u00e3o do debate',
      claim:statement,verdict,
      explanation:explanation.length>12?explanation:'Consulte a an\u00e1lise detalhada publicada pela Ag\u00eancia Lupa.',
      checker:'Ag\u00eancia Lupa',sourceUrl:LUPA_LIVE_URL,sourceType:'automatic-lupa'
    });
  }
  return [...new Map(claims.map(c=>[c.id,c])).values()];
}
async function requestLive() {
  try{
    const response=await fetch(LUPA_LIVE_URL,{
      signal:AbortSignal.timeout(10_000),
      headers:{'Accept':'text/html,application/xhtml+xml','User-Agent':'Mozilla/5.0 (compatible; RadarDaVerdade/1.3; public-editorial-monitor)'},
      redirect:'follow'
    });
    if(!response.ok)throw Error('HTTP '+response.status+' na fonte da Lupa');
    if(!String(response.headers.get('content-type')||'').includes('html'))throw Error('Resposta da Lupa n\u00e3o \u00e9 HTML');
    const length=Number(response.headers.get('content-length')||0);
    if(length>MAX_HTML_BYTES)throw Error('Fonte maior que limite de seguran\u00e7a');
    const html=await response.text();
    const parsed=parseLupaLiveHtml(html);
    if(parsed.length===0)throw Error('Fonte acessada, mas sem checagens leg\u00edveis no formato esperado');
    const result={status:'fresh',claims:parsed,fetchedAt:new Date().toISOString(),source:LUPA_LIVE_URL,detectedCount:parsed.length};
    lastSuccess=result;
    console.log('[lupa-live] source=fresh count='+parsed.length);
    return result;
  }catch(error){
    const why=String(error?.message||error).slice(0,140);
    console.warn('[lupa-live] source=unavailable reason='+why);
    return {
      status:lastSuccess?'stale':'unavailable',claims:lastSuccess?.claims||[],
      fetchedAt:lastSuccess?.fetchedAt||null,source:LUPA_LIVE_URL,
      detectedCount:lastSuccess?.claims?.length||0,
      error:'Sincroniza\u00e7\u00e3o da Lupa indispon\u00edvel no momento. Exibindo checagens j\u00e1 registradas.'
    };
  }
}
export async function getLiveClaims() {
  if(cache&&Date.now()-cache.time<TTL_MS)return {...cache.data,cached:true};
  if(inflight)return inflight;
  inflight=requestLive().then(data=>{cache={time:Date.now(),data};return data}).finally(()=>{inflight=null});
  return inflight;
}
export function mergeVerifiedClaims(storedClaims,live){
  const byId=new Map((storedClaims||[]).map(c=>[c.id,{...c}]));
  let added=0,corrected=0;
  for(const item of live?.claims||[]){
    if(!item||!['verdadeiro','falso','exagerado','falta-contexto','subestimado'].includes(item.verdict))continue;
    const old=byId.get(item.id);
    if(old){
      if(old.verdict!==item.verdict)corrected++;
      byId.set(item.id,{...old,verdict:item.verdict,explanation:item.explanation,sourceUrl:item.sourceUrl,sourceType:'automatic-lupa',sourceFetchedAt:live.fetchedAt});
    }else{
      byId.set(item.id,{...item,sourceFetchedAt:live.fetchedAt});
      added++;
    }
  }
  return {claims:[...byId.values()],added,corrected};
}
