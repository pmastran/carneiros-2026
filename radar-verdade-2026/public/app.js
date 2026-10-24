'use strict';
const $=id=>document.getElementById(id);
const state={screen:'inicio',debate:'globo',person:'todos',verdict:'todos',query:'',g1:null,band:null,finances:null,activeClaim:null,pendingSharedId:null,installPrompt:null};
const NAMES={lula:'Lula',flavio:'Flávio Bolsonaro'};
const G1_VERDICTS={verdadeiro:'#FATO',falso:'#FAKE','falta-contexto':'#NÃO É BEM ASSIM'};
const LUPA_VERDICTS={verdadeiro:'Verdadeiro',falso:'Falso','falta-contexto':'Falta contexto',exagerado:'Exagerado',subestimado:'Subestimado','nao-comprovado':'Não comprovado'};
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const reportUrl='https://g1.globo.com/fato-ou-fake/eleicoes/noticia/2026/10/23/veja-o-que-e-fato-ou-fake-nas-falas-de-flavio-bolsonaro-e-lula-no-debate-da-globo-no-2o-turno-das-eleicoes-2026.ghtml';
function node(tag,className,text){const x=document.createElement(tag);if(className)x.className=className;if(text!==undefined)x.textContent=String(text);return x}
function setText(id,value){const el=$(id);if(el)el.textContent=value}
function safeLink(url){try{const u=new URL(url,location.origin);return u.protocol==='https:'?u.toString():null}catch{return null}}
function sourceClaims(){return state.debate==='globo'?state.g1:state.band}
function verdictTitle(v){return(state.debate==='globo'?G1_VERDICTS:LUPA_VERDICTS)[v]||String(v)}
function labelFor(c){return c.editorialLabel=== '#NÃOÉBEMASSIM'?'#NÃO É BEM ASSIM':c.editorialLabel||LUPA_VERDICTS[c.verdict]||c.verdict}
function datePt(value){if(!value)return 'sem data';const p=String(value).slice(0,10).split('-');return p.length===3?p.reverse().join('/'):String(value)}
async function loadJSON(url){const ctrl=new AbortController();const task=setTimeout(()=>ctrl.abort(),20000);try{const r=await fetch(url,{cache:'no-store',signal:ctrl.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(task)}}
function writeScreen(name,updateUrl=true){
 if(!['inicio','falas','cartoes','fontes'].includes(name))name='inicio';
 state.screen=name;
 for(const key of ['inicio','falas','cartoes','fontes'])$( 'screen-'+key).hidden=key!==name;
 document.querySelectorAll('[data-screen].nav-item').forEach(b=>{
  const active=b.dataset.screen===name;
  b.classList.toggle('active',active);
  if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 });
 if(name==='falas'){renderFilters();renderClaims();}
 if(name==='cartoes')renderCards();
 if(updateUrl){const u=new URL(location.href);u.hash=name;history.replaceState(null,'',u.toString())}
 window.scrollTo({top:0,behavior:'instant'});
}
function openClaimsWith(result='todos'){
 state.debate='globo';state.person='todos';state.verdict=result;state.query='';
 $('debateSelect').value='globo';$('claimSearch').value='';
 writeScreen('falas');
}
function renderHome(){
 const claims=state.g1;
 setText('headerStatus',claims?'Fonte: g1':'Consultando…');
 setText('homeTotal',claims?claims.length:'—');
 setText('homeFact',claims?claims.filter(c=>c.verdict==='verdadeiro').length:'—');
 setText('homeFake',claims?claims.filter(c=>c.verdict==='falso').length:'—');
 setText('homeContext',claims?claims.filter(c=>c.verdict==='falta-contexto').length:'—');
 const strip=$('homeSource');
 strip.classList.toggle('error',claims===null&&state.g1Failed===true);
 if(claims)strip.textContent='Fonte: Fato ou Fake (g1) · revisão em '+datePt(state.g1Reviewed)+'. Catálogo de publicações, não transmissão ao vivo.';
 else if(state.g1Failed)strip.textContent='Não foi possível consultar o catálogo. Abra Falas para tentar novamente.';
 else strip.textContent='Consultando o catálogo da publicação do g1…';
 for(const b of document.querySelectorAll('[data-result]')){
  b.disabled=!claims||!claims.length||b.dataset.result!=='todos'&&!claims.some(c=>c.verdict===b.dataset.result);
 }
}
function renderFilters(){
 $('debateSelect').value=state.debate;
 $('claimSearch').value=state.query;
 document.querySelectorAll('[data-person]').forEach(b=>{const active=b.dataset.person===state.person;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active))});
 const opts=state.debate==='globo'?[['todos','Todas'],['verdadeiro','#FATO'],['falso','#FAKE'],['falta-contexto','#NÃO É BEM ASSIM']]:[['todos','Todas'],['verdadeiro','Verdadeiro'],['falso','Falso'],['falta-contexto','Falta contexto'],['exagerado','Exagerado'],['subestimado','Subestimado']];
 $('resultSelect').replaceChildren(...opts.map(([v,t])=>{const o=node('option','',t);o.value=v;return o}));
 if(!opts.some(x=>x[0]===state.verdict))state.verdict='todos';
 $('resultSelect').value=state.verdict;
}
function filteredClaims(){
 const claims=sourceClaims()||[];
 const search=state.query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 return claims.filter(c=>{
  if(state.person!=='todos'&&state.person!==c.candidate)return false;
  if(state.verdict!=='todos'&&state.verdict!==c.verdict)return false;
  if(!search)return true;
  const hay=[c.claim,c.subject,c.explanation,NAMES[c.candidate]].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return hay.includes(search);
 });
}
function renderClaims(){
 if(state.screen!=='falas')return;
 const source=$('claimsSource'),error=$('claimsError'),list=$('claimsList');
 const claims=sourceClaims();
 const isGlobo=state.debate==='globo';
 const sourceLabel=isGlobo?'Fato ou Fake (g1)':'Agência Lupa';
 if(!claims){
  error.hidden=!state[state.debate+'Failed'];
  list.replaceChildren(node('div','empty-results',error.hidden?'Buscando verificações publicadas…':'A fonte selecionada não respondeu. Consulte o veículo original ou tente novamente.'));
  setText('resultsCount','—');
  source.textContent='Fonte: '+sourceLabel+(error.hidden?' · carregando…':' · indisponível');
  source.classList.toggle('error',!error.hidden);
  return;
 }
 error.hidden=true;
 source.classList.remove('error');
 source.textContent='Fonte: '+sourceLabel+(isGlobo?' · revisão '+datePt(state.g1Reviewed):' · publicações da Band')+' · '+claims.length+' registros do catálogo';
 const data=filteredClaims();
 setText('resultsCount',data.length+' de '+claims.length);
 if(!data.length){
  list.replaceChildren(node('div','empty-results','Nenhuma declaração encontrada neste filtro. Tente outra palavra ou classificação.'));
  return;
 }
 const cards=data.map(c=>{
  const card=node('article','claim-card');
  const head=node('div','claim-head');
  head.append(node('span','person-label',NAMES[c.candidate]||'Candidato'),node('span','verdict-label '+c.verdict,labelFor(c)));
  card.append(head,node('p','',c.claim));
  const actions=node('div','claim-actions');
  const detail=node('button','','Ver explicação e fontes →');detail.type='button';detail.addEventListener('click',()=>openDetail(c));
  const share=node('button','quick-share','↗');share.type='button';share.setAttribute('aria-label','Compartilhar esta checagem');share.addEventListener('click',()=>openDetail(c));
  actions.append(detail,share);card.append(actions);
  return card;
 });
 list.replaceChildren(...cards);
}
function deepLink(claims){
 const id=state.pendingSharedId;if(!id)return;
 const claim=(claims||[]).find(c=>c.id===id);
 if(!claim)return;
 state.pendingSharedId=null;
 state.person='todos';state.verdict='todos';state.query='';$('claimSearch').value='';
 writeScreen('falas');
 openDetail(claim);
}
async function loadG1(){
 try{
  state.g1Failed=false;const data=await loadJSON('/api/g1-checks');
  if(!data.ok||!Array.isArray(data.claims))throw Error('Fonte inválida');
  const map={verdadeiro:'#FATO',falso:'#FAKE','falta-contexto':'#NÃOÉBEMASSIM'};
  const entries=data.claims.filter(c=>c.checker==='Fato ou Fake (Grupo Globo)'&&c.sourceId==='g1'&&map[c.verdict]===c.editorialLabel&&safeLink(c.sourceUrl)?.startsWith('https://g1.globo.com/fato-ou-fake/'));
  if(!entries.length)throw Error('Nenhum registro atribuível à fonte');
  state.g1=entries;state.g1Reviewed=data.reviewedAt;state.g1Failed=false;
  renderHome();renderClaims();deepLink(entries);
 }catch(e){
  state.g1=null;state.g1Failed=true;renderHome();renderClaims();
 }
}
async function loadBand(){
 if(state.band)return;
 try{
  state.bandFailed=false;const data=await loadJSON('/api/claims');
  if(!Array.isArray(data.claims))throw Error('Catálogo inválido');
  const entries=data.claims.filter(c=>c.event==='band-18'&&c.checker==='Agência Lupa');
  if(!entries.length)throw Error('Sem checagens');
  state.band=entries;state.bandFailed=false;renderClaims();deepLink(entries);
 }catch{state.band=null;state.bandFailed=true;renderClaims()}
}
function fullShare(c){
 const url=new URL('/',location.origin);url.searchParams.set('verificacao',c.id);url.hash='falas';
 return {url:url.toString(),text:'Radar da Verdade · '+(NAMES[c.candidate]||'Candidato')+' · '+labelFor(c)+'\n\nAfirmação resumida: '+c.claim+'\n\nChecagem de '+c.checker+': '+c.explanation+'\n\nFonte original: '+c.sourceUrl+'\n\nDocumento relacionado: '+(safeLink(c.primarySource)||'não identificado no registro')+'\n\nEste veredito não demonstra intenção de mentir.\n\nAbrir no Radar: '+url.toString()};
}
function openDetail(c){
 state.activeClaim=c;
 $('detailBadge').className='detail-badge '+c.verdict;setText('detailBadge',labelFor(c));
 setText('detailPerson',(NAMES[c.candidate]||'Candidato')+' · '+c.checker);
 setText('detailTitle',c.claim);setText('detailExplanation',c.explanation);
 const documentBox=$('detailDocument');
 const doc=safeLink(c.primarySource);documentBox.hidden=!doc;
 if(doc)$('detailDocumentLink').href=doc;
 setText('detailSource',c.checker+' · '+datePt(c.date));
 const orig=safeLink(c.sourceUrl);
 if(orig){$('detailOriginal').href=orig;$('detailOriginal').hidden=false}else $('detailOriginal').hidden=true;
 const payload=fullShare(c);$('whatsappShare').href='https://wa.me/?text='+encodeURIComponent(payload.text);
 setText('shareStatus','');
 const dlg=$('detailDialog');if(!dlg.open)dlg.showModal();
}
function closeDetail(){if($('detailDialog').open)$('detailDialog').close()}
async function copyText(text){
 try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}}catch{}
 const input=node('textarea','',text);input.style.cssText='position:fixed;top:8px;left:8px;opacity:.01';
 const target=$('detailDialog').open?$('detailDialog'):document.body;
 target.append(input);input.focus();input.select();let ok=false;try{ok=document.execCommand('copy')}catch{}input.remove();return ok;
}
async function shareActive(){
 if(!state.activeClaim)return;
 const data=fullShare(state.activeClaim);
 if(navigator.share){try{await navigator.share({title:'Checagem com fonte · Radar da Verdade',text:data.text,url:data.url});return}catch(e){if(e?.name==='AbortError')return}}
 const result=await copyText(data.text);setText('shareStatus',result?'Texto e fontes copiados.':'Não foi possível compartilhar. Use WhatsApp.');
}
function updateCardScope(){
 const data=state.finances;const scope=data?.scopes?.[$('cardsScope').value];
 const period=$('cardsPeriod').value;const item=scope?.[period];
 setText('cardsPeriodLabel',period==='bolsonaro'?'2019–2022':'2023–2025');
 if(!item){
  setText('cardsTotal','—');setText('cardsType','Dados indisponíveis');
  setText('cardsStatus','O levantamento não pôde ser carregado.');
  $('cardsAnnual').replaceChildren();setText('cardsDefinition','');
  return;
 }
 const annual=Array.isArray(item.annual)?item.annual:null;
 const sum=annual?annual.reduce((a,x)=>a+Number(x.value||0),0):Number(item.value);
 const compact=Number.isFinite(sum)?(item.approximate?'≈ ':'')+'R$ '+new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(sum/1e6)+' mi':'—';
 setText('cardsTotal',compact);
 setText('cardsType',scope.type||'Cartão de pagamento');
 setText('cardsDefinition',scope.definition||'');
 setText('cardsStatus','Base histórica documentada em '+datePt(data.snapshot)+' · valores nominais, não reprocessados a partir dos arquivos originais pela ferramenta.');
 $('cardsAnnual').replaceChildren(...(annual||[]).map(x=>{const row=node('div','annual-row');row.append(node('span','',x.year),node('strong','',money.format(x.value)));return row}));
}
async function loadCards(){
 try{state.finances=await loadJSON('/api/cards');updateCardScope()}catch{state.finances=null;updateCardScope()}
}
function renderCards(){updateCardScope()}
function routeFromLocation(){
 const params=new URL(location.href);
 const id=params.searchParams.get('verificacao');
 if(id&&/^[a-z0-9-]{1,90}$/.test(id)){state.pendingSharedId=id;writeScreen('falas',false)}
 else writeScreen(['inicio','falas','cartoes','fontes'].includes(params.hash.slice(1))?params.hash.slice(1):'inicio',false);
}
function setup(){
 document.querySelectorAll('[data-screen]').forEach(btn=>btn.addEventListener('click',()=>writeScreen(btn.dataset.screen)));
 document.querySelectorAll('[data-open]').forEach(btn=>btn.addEventListener('click',()=>writeScreen(btn.dataset.open)));
 document.querySelectorAll('[data-result]').forEach(btn=>btn.addEventListener('click',()=>openClaimsWith(btn.dataset.result)));
 document.querySelectorAll('[data-person]').forEach(btn=>btn.addEventListener('click',()=>{state.person=btn.dataset.person;renderFilters();renderClaims()}));
 $('debateSelect').addEventListener('change',e=>{state.debate=e.target.value;state.person='todos';state.verdict='todos';state.query='';$('claimSearch').value='';renderFilters();renderClaims();if(state.debate==='band')loadBand()});
 $('resultSelect').addEventListener('change',e=>{state.verdict=e.target.value;renderClaims()});
 $('claimSearch').addEventListener('input',e=>{state.query=e.target.value;renderClaims()});
 $('retryClaims').addEventListener('click',()=>state.debate==='globo'?loadG1():loadBand());
 $('cardsScope').addEventListener('change',updateCardScope);$('cardsPeriod').addEventListener('change',updateCardScope);
 $('closeDetail').addEventListener('click',closeDetail);
 $('nativeShare').addEventListener('click',shareActive);
 $('copyShare').addEventListener('click',async()=>{if(!state.activeClaim)return;setText('shareStatus',(await copyText(fullShare(state.activeClaim).text))?'Texto com fonte copiado.':'Falha ao copiar. Use WhatsApp.')});
 $('detailDialog').addEventListener('click',e=>{if(e.target===$('detailDialog'))closeDetail()});
 window.addEventListener('popstate',routeFromLocation);
 window.addEventListener('hashchange',()=>{if(!state.activeClaim||!$('detailDialog').open)routeFromLocation()});
 window.addEventListener('online',()=>{if(state.g1Failed)loadG1();if(state.bandFailed&&state.debate==='band')loadBand()});
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;$('installBtn').hidden=false});
 $('installBtn').addEventListener('click',async()=>{if(state.installPrompt){state.installPrompt.prompt();state.installPrompt=null;$('installBtn').hidden=true}});
 if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js?v=14').catch(()=>{});
 routeFromLocation();renderHome();renderFilters();renderClaims();loadG1();loadCards();
 if(state.pendingSharedId)setTimeout(()=>{if(state.pendingSharedId&&!state.band)loadBand()},200);
 // Historical source snapshots are re-fetched periodically; they are NOT live TV transcriptions.
 setInterval(()=>{if(!document.hidden&&navigator.onLine)loadG1()},300000);
}
setup();