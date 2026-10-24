'use strict';
const $ = id => document.getElementById(id);
const state = {event:'globo-23',candidate:'todos',verdict:'todos',claims:[],notes:[],news:[],lastFeedAt:0,installPrompt:null,shareClaim:null,globoNews:[],lastGloboAt:0,lastClaimStatus:null,globoClaims:[],globoSync:null,globoSnapshotReady:false,globoError:false,lastDeepLinkId:null};
const CANDIDATES={lula:'Lula',flavio:'Flávio Bolsonaro'};
const VERDICTS={'verdadeiro':'VERDADEIRO','falso':'FALSO','exagerado':'EXAGERADO','falta-contexto':'FALTA CONTEXTO','nao-comprovado':'NÃO COMPROVADO'};
const editorialLinks=[{name:'Agência Lupa (pesquisa)',url:'https://www.google.com/search?q=site%3Aagencialupa.org+Lula+Fl%C3%A1vio+checagem'},{name:'g1 Fato ou Fake',url:'https://g1.globo.com/fato-ou-fake/'},{name:'UOL Confere',url:'https://noticias.uol.com.br/confere/'}];
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
function timestamp(value){if(!value)return 'Horário não publicado';const d=new Date(value);return Number.isNaN(d.getTime())?'Horário não publicado':new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d)+' · Brasília'}
function clock(){const n=new Date; $('clock').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(n)}
function updateNet(){const ok=navigator.onLine; const n=$('network');n.className='net '+(ok?'connected':'disconnected');n.lastChild.textContent=ok?'Conectado':'Sem internet'}
function link(url,label){const u=new URL(url);if(u.protocol!=='https:')return el('span','',label);const a=el('a','',label);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';return a}
function showEmpty(parent,title,body){const div=el('div','empty');div.append(el('div','symbol','◎'),el('h3','',title),el('p','',body));const links=el('div','');for(const s of editorialLinks){const a=link(s.url,s.name+' ↗');a.style.margin='0 9px';links.append(a)}div.append(links);parent.replaceChildren(div)}

function sourceMetadata(){
 const globo=state.event==='globo-23';
 $('g1SourceStatus').hidden=!globo;
 $('auditNotice').hidden=globo;
 $('syncStatus').hidden=globo;
}

function renderCandidatePreviews(){
 const isGlobo=state.event==='globo-23';
 const ready=isGlobo?state.globoSnapshotReady:!!state.lastClaimStatus;
 const records=isGlobo?state.globoClaims:state.claims.filter(c=>c.event==='band-18');
 for(const candidate of ['lula','flavio']){
  const root=$(candidate+'-candidate-preview');
  const button=document.querySelector('[data-candidate-open="'+candidate+'"]');
  if(!root||!button)continue;
  const sample=ready?records.find(c=>c.candidate===candidate):null;
  button.disabled=!sample;
  if(!ready){
   root.replaceChildren(el('p','candidate-preview-loading',isGlobo?(state.globoError?'Fato ou Fake indisponível nesta consulta.':'Consultando Fato ou Fake (g1)…'):'Consultando Agência Lupa…'));
   continue;
  }
  if(!sample){
   root.replaceChildren(el('p','candidate-preview-loading','Nenhuma declaração encontrada para este recorte editorial.'));
   continue;
  }
  root.replaceChildren(
   el('span','candidate-preview-label','EXEMPLO DE FALA CHECADA'),
   el('p','candidate-preview-claim',sample.claim),
   el('span','candidate-preview-source','Fonte: '+sample.checker)
  );
 }
}
function openCandidateClaims(candidate){
 const globo=state.event==='globo-23';
 const records=globo?state.globoClaims:state.claims.filter(c=>c.event==='band-18');
 if(!records.some(c=>c.candidate===candidate))return;
 state.candidate=candidate;
 state.verdict='todos';
 $('verdictFilter').value='todos';
 document.querySelectorAll('.filters .filter').forEach(b=>b.classList.toggle('active',b.dataset.candidate===candidate));
 renderClaims();
 const target=$('claimsList');
 if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
}

function renderCounts(){
 const loaded=state.event==='globo-23'?state.globoSnapshotReady:!!state.lastClaimStatus;
 const count=state.event==='globo-23'?state.globoClaims.length:state.claims.filter(c=>c.event==='band-18').length;
 $('claimCount').textContent=loaded?String(count):'—';
}
function renderClaims(){
 sourceMetadata();renderCounts();renderCandidatePreviews();
 const globo=state.event==='globo-23';
 const root=$('claimsList');
 if(globo&&!state.globoSnapshotReady){
  showEmpty(root,state.globoError?'Fonte temporariamente indisponível':'Consultando Fato ou Fake',
    state.globoError?'Não exibimos informações de outras agências como se fossem do g1. Consulte a publicação original.':'Carregando verificações documentadas do g1. Ainda não há dados para apresentar.');
  return;
 }
 if(!globo&&!state.lastClaimStatus){
  showEmpty(root,'Consultando Agência Lupa','A apuração da Band usa uma base separada do Fato ou Fake.');
  return;
 }
 const relevant=globo?state.globoClaims:state.claims.filter(c=>c.event==='band-18');
 const filtered=relevant.filter(c=>(state.candidate==='todos'||c.candidate===state.candidate)&&(state.verdict==='todos'||c.verdict===state.verdict));
 if(!filtered.length){showEmpty(root,'Sem declarações neste filtro','Escolha outro filtro para consultar os registros publicados nesta fonte.');return}
 const selectedId=new URLSearchParams(location.search).get('verificacao');
 const nodes=filtered.map(c=>{
  const box=el('article','claim');box.id='verificacao-'+c.id;
  if(c.id===selectedId)box.classList.add('shared-claim');
  const head=el('div','claim-top');
  const who=el('div','claim-who');
  who.append(el('span','claim-tag '+c.candidate,c.candidate==='lula'?'PT':'PL'),el('span','',CANDIDATES[c.candidate]));
  head.append(who,el('span','verdict '+c.verdict,c.editorialLabel||VERDICTS[c.verdict]||c.verdict));
  box.append(head,el('h3','',c.claim),el('p','',c.explanation));
  box.append(el('p',c.editorialLabel?'proof-label has-proof':'proof-label no-proof',c.editorialLabel?'Classificação publicada pelo Fato ou Fake. A fala foi resumida para consulta.':'Classificação publicada pela Agência Lupa; não é veredito do Fato ou Fake.'));
  if(c.primarySource&&c.primarySource.startsWith('https://')){
   const source=el('div','proof-source');
   source.append(el('span','','Documento ou registro relacionado: '),link(c.primarySource,'Consultar ↗'));
   box.append(source);
  }
  const foot=el('div','claim-foot');
  foot.append(el('span','',c.checker+' · '+c.date.split('-').reverse().join('/')+' · '+c.subject),link(c.sourceUrl,'Ler checagem na origem ↗'));
  box.append(foot);
  const actions=el('div','claim-actions');
  const share=el('button','share-trigger','↗ Compartilhar esta verificação');
  share.type='button';share.addEventListener('click',()=>openShare(c));
  actions.append(share);box.append(actions);
  return box;
 });
 root.replaceChildren(...nodes);
}

const SHARE_VERDICT_LABELS={...VERDICTS,'subestimado':'SUBESTIMADO'};
function verificationUrl(c){
 const u=new URL('/',location.origin);
 u.searchParams.set('verificacao',c.id);
 u.hash='verificacoes';
 return u.toString();
}
function verificationLabel(c){
 return SHARE_VERDICT_LABELS[c.verdict]||String(c.verdict).toUpperCase();
}
function shareMessage(c,includeLink=true){
 const source=c.checker||'Veículo de checagem identificado';
 const lines=[
  '🔎 *RADAR DA VERDADE — CHECAGEM DE FATO*',
  '',
  '*'+CANDIDATES[c.candidate]+' — '+verificationLabel(c)+'*',
  '',
  '*Afirmação:* '+c.claim,
  '',
  '*Contexto da checagem:* '+c.explanation,
  '',
  '*Veredito atribuído a:* '+source,
  '*Fonte original:* '+c.sourceUrl
 ];
 if(includeLink)lines.push('','*Abrir esta verificação no Radar:* '+verificationUrl(c));
 lines.push('','Classificação da fonte citada. Não é uma afirmação de intenção de mentir.');
 return lines.join('\n');
}
function shareFeedback(message,isError=false){
 const status=$('shareFeedback');
 status.textContent=message;
 status.className=isError?'share-feedback error':'share-feedback';
}
function openShare(c){
 state.shareClaim=c;
 const preview=$('sharePreview');
 const name=el('div','share-candidate',CANDIDATES[c.candidate]+' · '+c.date.split('-').reverse().join('/'));
 const verdict=el('span','verdict '+c.verdict,verificationLabel(c));
 const title=el('h3','',c.claim);
 const summary=el('p','',c.explanation);
 const source=el('div','share-attribution','Classificação publicada por '+(c.checker||'fonte identificada'));
 const sources=el('div','share-source-links');
 const linkSource=link(c.sourceUrl,'Ver fonte original ↗');
 const searchSource=link('https://www.google.com/search?q='+encodeURIComponent('"'+c.claim+'" '+(c.checker||'checagem')),'Localizar a checagem ↗');
 sources.append(linkSource,searchSource);
 preview.replaceChildren(name,verdict,title,summary,source,sources);
 $('shareWhatsapp').href='https://wa.me/?text='+encodeURIComponent(shareMessage(c));
 shareFeedback('');
 const dlg=$('shareDialog');
 if(!dlg.open)dlg.showModal();
}
async function writeClipboard(value){
 try{
  if(navigator.clipboard&&window.isSecureContext){
   await navigator.clipboard.writeText(value);
   return true;
  }
 }catch{}
 const dlg=$('shareDialog');
 const t=document.createElement('textarea');
 t.value=value;t.setAttribute('readonly','');
 t.style.position='fixed';t.style.left='12px';t.style.top='12px';
 t.style.opacity='0.01';t.style.width='1px';t.style.height='1px';
 (dlg.open?dlg:document.body).appendChild(t);
 t.focus();t.select();t.setSelectionRange(0,t.value.length);
 let ok=false;
 try{ok=document.execCommand('copy')}catch{}
 t.remove();
 return ok;
}
async function nativeShare(){
 const c=state.shareClaim;if(!c)return;
 try{
  if(typeof navigator.share==='function'){
   await navigator.share({title:'Radar da Verdade: '+verificationLabel(c)+' · '+CANDIDATES[c.candidate],text:shareMessage(c,false),url:verificationUrl(c)});
   shareFeedback('Compartilhamento enviado ao menu do celular.');
  }else{
   const ok=await writeClipboard(shareMessage(c));
   shareFeedback(ok?'Mensagem copiada. Cole no aplicativo que desejar.':'Não foi possível copiar.',!ok);
  }
 }catch(e){
  if(e&&e.name==='AbortError')return;
  shareFeedback('O compartilhamento não foi concluído. Use o WhatsApp ou Copiar mensagem.',true);
 }
}
function canvasLines(ctx,text,maxWidth,maxLines){
 const words=String(text||'').split(/\s+/).filter(Boolean);
 let lines=[],line='';
 for(const word of words){
  const proposed=line?line+' '+word:word;
  if(!line||ctx.measureText(proposed).width<=maxWidth){line=proposed}
  else{lines.push(line);line=word}
 }
 if(line)lines.push(line);
 if(lines.length>maxLines){
  lines=lines.slice(0,maxLines);
  let last=lines[maxLines-1];
  while(last.includes(' ')&&ctx.measureText(last+'…').width>maxWidth)last=last.split(' ').slice(0,-1).join(' ');
  lines[maxLines-1]=last+'…';
 }
 return lines;
}
function drawCardText(ctx,text,x,y,width,lineHeight,maxLines){
 const lines=canvasLines(ctx,text,width,maxLines);
 for(const line of lines){ctx.fillText(line,x,y);y+=lineHeight}
 return y;
}
async function shareImage(){
 const c=state.shareClaim;if(!c)return;
 const btn=$('shareImage');
 btn.disabled=true;
 shareFeedback('Preparando o card de verificação…');
 try{
  const cvs=document.createElement('canvas');cvs.width=1080;cvs.height=1920;
  const ctx=cvs.getContext('2d');if(!ctx)throw Error('Canvas indisponível');
  const bg=ctx.createLinearGradient(0,0,1080,1920);bg.addColorStop(0,'#07101d');bg.addColorStop(1,'#102235');
  ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1920);
  ctx.strokeStyle='rgba(53,212,227,.20)';ctx.lineWidth=3;
  for(const r of [95,165,235]){ctx.beginPath();ctx.arc(950,150,r,0,Math.PI*2);ctx.stroke()}
  ctx.fillStyle='#42d9e6';ctx.fillRect(64,63,12,100);
  ctx.font='800 48px Arial, sans-serif';ctx.fillStyle='#f0faff';ctx.fillText('RADAR DA VERDADE',108,115);
  ctx.font='700 25px Arial, sans-serif';ctx.fillStyle='#8dc1d0';ctx.fillText('ELEIÇÕES 2026  •  VERIFICAÇÃO DOCUMENTADA',108,159);
  ctx.font='700 31px Arial, sans-serif';ctx.fillStyle='#adbecd';ctx.fillText('AFIRMAÇÃO DE',75,285);
  ctx.font='800 56px Arial, sans-serif';ctx.fillStyle='#fff';ctx.fillText(CANDIDATES[c.candidate],75,365);
  const color=c.verdict==='verdadeiro'?'#61d9af':c.verdict==='falso'?'#ff9298':'#f3c77f';
  ctx.fillStyle=color;ctx.fillRect(75,405,930,93);
  ctx.font='900 47px Arial, sans-serif';ctx.fillStyle='#071420';ctx.fillText(verificationLabel(c),110,471);
  ctx.font='700 28px Arial, sans-serif';ctx.fillStyle='#83c6d1';ctx.fillText('O QUE FOI DITO',75,585);
  ctx.font='800 53px Arial, sans-serif';ctx.fillStyle='#f7fcff';
  drawCardText(ctx,c.claim,75,672,930,71,6);
  ctx.strokeStyle='#304658';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(75,1130);ctx.lineTo(1000,1130);ctx.stroke();
  ctx.font='700 28px Arial, sans-serif';ctx.fillStyle='#83c6d1';ctx.fillText('O QUE A CHECAGEM APONTOU',75,1215);
  ctx.font='400 36px Arial, sans-serif';ctx.fillStyle='#d4e3eb';
  drawCardText(ctx,c.explanation,75,1284,930,50,6);
  ctx.fillStyle='#102d39';ctx.fillRect(0,1610,1080,310);
  ctx.font='700 31px Arial, sans-serif';ctx.fillStyle='#69dfe4';ctx.fillText('Fonte do veredito: '+c.checker,75,1704);
  ctx.font='500 27px Arial, sans-serif';ctx.fillStyle='#e7f2f5';ctx.fillText('Verifique a fala e a fonte no aplicativo:',75,1764);
  ctx.fillText('radar-verdade-debate-2026.onrender.com',75,1808);
  ctx.font='400 22px Arial, sans-serif';ctx.fillStyle='#a6c0c9';ctx.fillText('A classificação não demonstra intenção de mentir.',75,1871);
  const blob=await new Promise(resolve=>cvs.toBlob(resolve,'image/png',0.95));
  if(!blob)throw Error('Imagem indisponível');
  const file=new File([blob],'radar-da-verdade-'+c.id+'.png',{type:'image/png'});
  if(typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]})){
   try{
    await navigator.share({files:[file],title:'Radar da Verdade — '+verificationLabel(c),text:'Veja a classificação e a fonte: '+verificationUrl(c)});
    shareFeedback('Card de imagem enviado ao menu de compartilhamento.');
    return;
   }catch(e){if(e&&e.name==='AbortError'){shareFeedback('Compartilhamento cancelado.');return}}
  }
  const href=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=href;a.download=file.name;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(href),10000);
  shareFeedback('Card PNG criado. Use-o em Stories ou mensagens.');
 }catch{
  shareFeedback('Não foi possível criar o card neste navegador. Compartilhe a mensagem ou o link.',true);
 }finally{btn.disabled=false}
}
function initShare(){
 $('shareClose').addEventListener('click',()=>$('shareDialog').close());
 $('shareNative').addEventListener('click',nativeShare);
 $('shareImage').addEventListener('click',shareImage);
 $('shareCopyMessage').addEventListener('click',async()=>{
  if(!state.shareClaim)return;
  const ok=await writeClipboard(shareMessage(state.shareClaim));
  shareFeedback(ok?'Mensagem com veredito, contexto, fonte e link copiada.':'Não foi possível copiar a mensagem.',!ok);
 });
 $('shareCopyLink').addEventListener('click',async()=>{
  if(!state.shareClaim)return;
  const ok=await writeClipboard(verificationUrl(state.shareClaim));
  shareFeedback(ok?'Link direto desta verificação copiado.':'Não foi possível copiar o link.',!ok);
 });
}

function changeEvent(next){state.event=next;for(const b of document.querySelectorAll('.event-tab')){const selected=b.dataset.event===next;b.classList.toggle('active',selected);b.setAttribute('aria-selected',selected?'true':'false')}renderClaims()}
function renderAudit(a){const root=$('auditDetail');if(!root)return;if(!a){root.textContent='Auditoria indisponível nesta atualização.';return}const recent=(a.recent||[]).slice(0,3);root.textContent='Origem: Agência Lupa · última captura válida: '+(a.lastFreshAt?timestamp(a.lastFreshAt):'não confirmada')+' · '+a.observations+' declarações observadas. '+(recent.length?'Eventos recentes: '+recent.map(x=>x.type.replaceAll('-',' ')+' ('+x.id+')').join('; ')+'. ':'')+'Histórico nesta instância do servidor; pode reiniciar após nova implantação. Confirme a evidência na publicação original.'}
function renderSyncStatus(data){const el=$('syncStatus');if(!el)return;const fresh=data.sourceStatus==='fresh';const stale=data.sourceStatus==='stale';const time=data.sourceCheckedAt?timestamp(data.sourceCheckedAt):'sem coleta confirmada';el.textContent=(fresh?'● Fonte consultada: ':stale?'◐ Última consulta válida: ':'○ Sincronização externa indisponível · registros editoriais preservados')+(fresh||stale?time:'')+' · '+(data.autoAdded||0)+' novas verificações automáticas';el.className='sync-status '+(fresh?'ok':stale?'warn':'err');}

async function fetchG1Catalog(){
 try{
  const response=await fetch('/api/g1-checks',{cache:'no-store'});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.json();
  if(!data.ok||!Array.isArray(data.claims)||data.sourceStatus!=='editorial-snapshot')throw new Error('Resposta inválida');
  const tags={verdadeiro:'#FATO',falso:'#FAKE','falta-contexto':'#NÃOÉBEMASSIM'};
  const claims=data.claims.filter(c=>tags[c.verdict]===c.editorialLabel&&c.checker==='Fato ou Fake (Grupo Globo)'&&c.sourceId==='g1'&&typeof c.sourceUrl==='string'&&c.sourceUrl.startsWith('https://g1.globo.com/fato-ou-fake/'));
  if(!claims.length)throw new Error('Catálogo sem registros atribuídos');
  state.globoClaims=claims;state.globoSync=data;state.globoSnapshotReady=true;state.globoError=false;
  $('g1SourceStatus').textContent='Fonte principal: Fato ou Fake (g1). Catálogo de verificações publicadas, conferido em '+data.reviewedAt+'. Não é uma conexão interna ao vivo da Globo.';
  if(state.event==='globo-23')renderClaims();
  const id=new URLSearchParams(location.search).get('verificacao');
  if(state.event==='globo-23'&&state.lastDeepLinkId!==id&&claims.some(c=>c.id===id)){
   state.lastDeepLinkId=id;state.candidate='todos';state.verdict='todos';$('verdictFilter').value='todos';
   document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b.dataset.candidate==='todos'));
   renderClaims();setTimeout(()=>document.getElementById('verificacao-'+id)?.scrollIntoView({block:'center'}),250);
  }
 }catch{
  state.globoClaims=[];state.globoSnapshotReady=false;state.globoError=true;
  $('g1SourceStatus').textContent='O Fato ou Fake não pôde ser carregado. Não exibimos dados da Lupa como substitutos.';
  if(state.event==='globo-23')renderClaims();
 }
}
async function fetchClaims(){
 try{
  const response=await fetch('/api/claims',{cache:'no-store'});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.json();
  if(!Array.isArray(data.claims))throw new Error('Formato inválido');
  state.claims=data.claims.filter(c=>c.event==='band-18'&&c.checker==='Agência Lupa');
  state.lastClaimStatus=data;
  renderSyncStatus(data);renderAudit(data.audit);
  const id=new URLSearchParams(location.search).get('verificacao');
  const shared=state.claims.find(c=>c.id===id);
  if(shared&&state.lastDeepLinkId!==id){
   state.lastDeepLinkId=id;state.candidate='todos';state.verdict='todos';$('verdictFilter').value='todos';
   document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b.dataset.candidate==='todos'));
   changeEvent('band-18');
   setTimeout(()=>document.getElementById('verificacao-'+id)?.scrollIntoView({block:'center'}),250);
  }else if(state.event==='band-18')renderClaims();
 }catch{
  if(state.event==='band-18'){state.lastClaimStatus=null;renderClaims()}
 }
}
async function fetchNews(){if(document.hidden||!navigator.onLine)return;const status=$('feedStatus');status.textContent='Atualizando cobertura...';status.className='feed-status';$('refresh').disabled=true;try{const r=await fetch('/api/coverage?kind=checagens',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(data.ok&&!data.stale){state.news=data.items;try{localStorage.setItem('radar:news',JSON.stringify(data.items))}catch{}} else if(!data.ok){throw Error(data.error||'Feed indisponível')}else state.news=data.items;state.lastFeedAt=Date.now();status.textContent=`${data.stale?'Dados anteriores':'Consultado'} às ${timestamp(data.updatedAt)}${data.stale?' · Feed temporariamente indisponível':''}`;status.className='feed-status '+(data.stale?'err':'ok');renderNews()}catch(e){try{const cached=JSON.parse(localStorage.getItem('radar:news')||'[]');if(Array.isArray(cached)&&cached.length){state.news=cached;status.textContent='Feed indisponível · mostrando última coleta salva no aparelho';status.className='feed-status err';renderNews()}else{status.textContent='Não foi possível consultar o feed neste momento';status.className='feed-status err';showEmpty($('feedItems'),'Sem matérias carregadas','O feed pode falhar ou atrasar. Consulte diretamente a Agência Lupa, o g1 e o UOL Confere.') }}catch{showEmpty($('feedItems'),'Feed indisponível','Acesse os veículos originais pelos links abaixo.');status.textContent='Feed indisponível';status.className='feed-status err'}}finally{$('refresh').disabled=false}}
function renderNews(){const root=$('feedItems');if(!state.news.length){showEmpty(root,'Nenhuma publicação retornada','O feed ainda não apresentou artigos na consulta. Isso não significa que o debate não tenha sido checado.');return}const cards=state.news.map(item=>{const card=el('article','news');const m=el('div','meta');m.append(el('b','',item.source),el('span','',timestamp(item.published)));const title=el('h3','',item.title);const explanation=el('p','source-note','Título recebido de um agregador. Não é um veredito. O endereço original pode ter sido removido.');const actions=el('div','news-actions');const q=encodeURIComponent('"'+item.title.slice(0,170)+'"');const search=link('https://www.google.com/search?q='+q,'Pesquisar esta manchete ↗');search.className='safe-search';actions.append(search);if(item.url){try{const u=new URL(item.url);if(u.protocol==='https:'){const original=link(item.url,'Tentar link do veículo ↗');original.className='original-link';original.title='Link externo não validado; poderá apresentar erro 404';actions.append(original)}}catch{}}card.append(m,title,explanation,actions);return card});root.replaceChildren(...cards)}

function renderGlobo(){
 const root=$('globoItems');
 if(!state.globoNews.length){
  showEmpty(root,'Sem publicações localizadas','A indexação pelo Google Notícias pode levar minutos; nenhuma afirmação será inventada. Veja os links para o Fato ou Fake e a busca de matérias abaixo.');
  return;
 }
 const cards=state.globoNews.map(item=>{
  const card=el('article','news');
  const meta=el('div','meta');
  meta.append(el('b','',item.source),el('span','',timestamp(item.published)));
  const title=el('h3','',item.title);
  const notice=el('p','source-note','Título localizado em agregador; ainda não é um veredito individualizado.');
  const buttons=el('div','news-actions');
  const google=link('https://www.google.com/search?q='+encodeURIComponent('"'+item.title.slice(0,180)+'"'),'Encontrar matéria ↗');
  google.className='safe-search';buttons.append(google);
  card.append(meta,title,notice,buttons);
  return card;
 });
 root.replaceChildren(...cards);
}
async function fetchGlobo(){
 if(document.hidden||!navigator.onLine)return;
 const status=$('globoStatus');const button=$('globoRefresh');
 button.disabled=true;status.textContent='Buscando publicações públicas do Grupo Globo...';
 try{
  const r=await fetch('/api/coverage?kind=globo',{cache:'no-store'});
  if(!r.ok)throw Error('Rede indisponível');
  const data=await r.json();if(!data.ok)throw Error(data.error||'Fonte indisponível');
  state.globoNews=Array.isArray(data.items)?data.items:[];
  try{localStorage.setItem('radar:globoItems',JSON.stringify(state.globoNews))}catch{}
  status.textContent='Consultado às '+timestamp(data.updatedAt)+' · '+state.globoNews.length+' publicações';
  status.className='feed-status '+(data.stale?'err':'ok');
 }catch{
  try{const stored=JSON.parse(localStorage.getItem('radar:globoItems')||'[]');state.globoNews=Array.isArray(stored)?stored:[]}catch{state.globoNews=[]}
  status.textContent='Consulta indisponível; '+(state.globoNews.length?'mostrando itens salvos':'use o link do g1 abaixo');
  status.className='feed-status err';
 }finally{state.lastGloboAt=Date.now();button.disabled=false;renderGlobo()}
}
async function fetchFactcheckAPI(){
 const status=$('globoStructuredStatus');const root=$('globoStructuredItems');
 try{
  const r=await fetch('/api/factchecks',{cache:'no-store'});
  if(!r.ok)throw Error('API indisponível');
  const data=await r.json();
  if(!data.configured){
   status.textContent='API do Google ainda sem chave configurada. O monitor de publicações acima funciona sem ela.';
   root.replaceChildren();return;
  }
  if(!data.ok)throw Error('Serviço de checagem indisponível');
  const items=Array.isArray(data.items)?data.items:[];
  status.textContent='Classificações estruturadas encontradas: '+items.length+' · fonte: Google Fact Check Tools.';
  if(!items.length){root.replaceChildren();return}
  root.replaceChildren(...items.map(item=>{
   const card=el('article','claim');
   const top=el('div','claim-top');
   top.append(el('span','claim-tag','CLASSIFICAÇÃO DA FONTE'),el('span','verdict',item.rating));
   const title=el('h3','',item.statement||'Declaração verificada');
   const info=el('p','',(item.claimant?item.claimant+' · ':'')+'Classificado por '+item.publisher);
   const footer=el('div','claim-foot');footer.append(link(item.url,'Ver verificação publicada ↗'));
   card.append(top,title,info,footer);return card;
  }));
 }catch{status.textContent='API de classificações indisponível. Consulte as publicações do g1.';root.replaceChildren()}
}

function readNotes(){try{const value=JSON.parse(localStorage.getItem('radar:notes')||'[]');state.notes=Array.isArray(value)?value:[]}catch{state.notes=[]}renderNotes()}
function renderNotes(){const root=$('notesList');if(!state.notes.length){root.replaceChildren();return}const list=state.notes.map((n,idx)=>{const card=el('article','note');const inner=el('div','');inner.append(el('span','note-label','NÃO VERIFICADO · '+CANDIDATES[n.candidate]+' · '+n.date+(n.time?' '+n.time:'')),el('p','',n.claim));const query=encodeURIComponent('"'+n.claim.slice(0,110)+'" '+CANDIDATES[n.candidate]);inner.append(link('https://news.google.com/search?q='+query,'Pesquisar fontes ↗'));const remove=el('button','','Excluir');remove.type='button';remove.addEventListener('click',()=>{state.notes.splice(idx,1);saveNotes();renderNotes()});card.append(inner,remove);return card});root.replaceChildren(...list)}
function saveNotes(){try{localStorage.setItem('radar:notes',JSON.stringify(state.notes))}catch{}}
function initNotes(){$('noteForm').addEventListener('submit',e=>{e.preventDefault();const form=new FormData(e.currentTarget);const claim=String(form.get('claim')||'').trim();if(!claim)return;state.notes.unshift({candidate:String(form.get('candidate')),date:'23/10/2026',time:String(form.get('time')||''),claim:claim.slice(0,650)});state.notes=state.notes.slice(0,40);saveNotes();renderNotes();e.currentTarget.reset();$('notesList').scrollIntoView({behavior:'smooth',block:'nearest'})});readNotes()}
function initInstall(){window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e;$('installNow').hidden=false});$('installButton').addEventListener('click',()=>{$('installDialog').showModal()});$('closeDialog').addEventListener('click',()=>$('installDialog').close());$('installNow').addEventListener('click',async()=>{if(state.installPrompt){await state.installPrompt.prompt();state.installPrompt=null;$('installNow').hidden=true}});if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js?v=12').catch(()=>{}))}

const financeState={data:null,scope:'secretaria'};
const moneyBRL=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
function financeMessage(){
 const item=financeState.data?.scopes?.[financeState.scope];
 if(!item)return 'Cartões corporativos: consulte o Portal da Transparência';
 const fmt=e=>e.annual?e.annual.map(x=>x.year+': '+moneyBRL.format(x.value)).join('\n'):(e.approximate?'aproximadamente ':'')+moneyBRL.format(e.value);
 return 'RADAR DA VERDADE | CARTÕES CORPORATIVOS\n'+item.title+'\nJair Bolsonaro ('+item.bolsonaro.period+'):\n'+fmt(item.bolsonaro)+'\nLula ('+item.lula.period+'):\n'+fmt(item.lula)+'\nValores nominais de órgãos públicos, não gastos pessoais. Períodos de 4 e 3 anos, respectivamente. Fonte oficial: https://portaldatransparencia.gov.br/cartoes/consulta\nLeituras metodológicas: https://checamos.afp.com/doc.afp.com.98XY4WG\n'+location.origin+'/#cartoes';
}
function renderFinance(){
 const item=financeState.data?.scopes?.[financeState.scope];if(!item)return;
 $('financeTitle').textContent=item.title+' · '+item.type;
 $('financeDefinition').textContent=item.definition;
 document.querySelectorAll('[data-finance]').forEach(b=>b.classList.toggle('active',b.dataset.finance===financeState.scope));
 const cards=[['Jair Bolsonaro',item.bolsonaro],['Lula',item.lula]].map(([name,d])=>{
  const card=el('article','finance-card');
  card.append(el('h3','',name),el('p','',d.period));
  if(Array.isArray(d.annual)){
   for(const y of d.annual){const row=el('div','finance-row');row.append(el('span','',String(y.year)),el('strong','',moneyBRL.format(y.value)));card.append(row)}
  }else card.append(el('strong','finance-total',(d.approximate?'≈ ':'')+moneyBRL.format(d.value)));
  return card;
 });
 $('financeCards').replaceChildren(...cards);
 $('financeStatus').textContent='Fonte: dados documentais verificados até fevereiro de 2026. Os valores não foram corrigidos pela inflação. Para 2026 consulte os arquivos oficiais da Casa Civil.';
}
function initFinance(){
 document.querySelectorAll('[data-finance]').forEach(b=>b.addEventListener('click',()=>{financeState.scope=b.dataset.finance;renderFinance()}));
 $('financeShare').addEventListener('click',async()=>{
  const text=financeMessage();
  try{if(navigator.share){await navigator.share({title:'Cartões corporativos: dados dos mandatos',text,url:location.origin+'/#cartoes'});return}}catch(e){if(e?.name==='AbortError')return}
  const ok=await writeClipboard(text);$('financeStatus').textContent=ok?'Dados com fontes copiados.':'Use o botão de copiar.';
 });
 $('financeCopy').addEventListener('click',async()=>{$('financeStatus').textContent=(await writeClipboard(financeMessage()))?'Dados com fontes copiados.':'Falha ao copiar.'});
 fetch('/api/cards',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(data=>{financeState.data=data;renderFinance()}).catch(()=>{$('financeTitle').textContent='Dados indisponíveis';$('financeStatus').textContent='Acesse diretamente o Portal da Transparência.'});
}

function boot(){renderClaims();document.querySelectorAll('[data-candidate-open]').forEach(b=>b.addEventListener('click',()=>openCandidateClaims(b.dataset.candidateOpen)));clock();setInterval(clock,10000);updateNet();window.addEventListener('online',()=>{updateNet();fetchClaims();fetchNews();fetchGlobo()});window.addEventListener('offline',()=>{updateNet();$('feedStatus').textContent='Offline · exibindo dados salvos quando disponíveis';$('feedStatus').className='feed-status err'});document.querySelectorAll('.event-tab').forEach(b=>b.addEventListener('click',()=>changeEvent(b.dataset.event)));document.querySelectorAll('.filter').forEach(b=>b.addEventListener('click',()=>{state.candidate=b.dataset.candidate;document.querySelectorAll('.filter').forEach(v=>v.classList.toggle('active',v===b));renderClaims()}));$('verdictFilter').addEventListener('change',e=>{state.verdict=e.target.value;renderClaims()});$('refresh').addEventListener('click',fetchNews);document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(Date.now()-state.lastFeedAt>=90_000)fetchNews();if(Date.now()-state.lastGloboAt>=90000){fetchGlobo();fetchFactcheckAPI()}}});initInstall();initNotes();initShare();initFinance();fetchClaims();fetchG1Catalog();fetchNews();fetchGlobo();fetchFactcheckAPI();$('globoRefresh').addEventListener('click',()=>{fetchGlobo();fetchFactcheckAPI()});setInterval(()=>{if(!document.hidden&&navigator.onLine){fetchClaims();fetchG1Catalog();fetchNews();fetchGlobo();fetchFactcheckAPI()}},60_000)}
boot();
