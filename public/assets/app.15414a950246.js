'use strict';
const $=s=>document.querySelector(s); const app=$('#app');
const K='GLOBAL_MARKET_DATA_V2', S='GLOBAL_MARKET_SESSION_V2';
const id=p=>p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
const today=()=>new Date().toISOString().slice(0,10);
const randomPart=(len=8)=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let out=''; for(let i=0;i<len;i++) out+=chars[Math.floor(Math.random()*chars.length)]; return out};
const autoCode=()=> randomPart(7); // Code produit/service : 7 caractères, chiffres et lettres, sans espace
function uniqueItemCode(d,cid,currentId=''){
  d.items=d.items||[];
  let code='';
  do{ code=autoCode(); }while(d.items.some(i=>i.companyId===cid&&i.id!==currentId&&String(i.code||'').toUpperCase()===code.toUpperCase()));
  return code;
}
const money=n=>Number(n||0).toLocaleString('fr-FR')+' FCFA';
const supportPhone='2250777041790';
const supportEmail='megaservicediabo@gmail.com';

const FREE_PLAN_DAYS=21;
const BUSINESS_PLAN_DAYS=365;
const BUSINESS_PLAN_AMOUNT=26300;
const BUSINESS_WAVE_URL='https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount=26300';
const GLOBAL_MARKET_PLANS={
  FREE:{code:'FREE',label:'Plan Free — 21 jours',price:0,statut:'FREE',durationDays:FREE_PLAN_DAYS,target:'Toutes les entreprises souhaitant découvrir GLOBAL MARKET.',maxUsers:Infinity,maxItems:Infinity,maxCategories:Infinity,limits:['Accès complet pendant 21 jours'],features:['Accès complet à toutes les sections','Produits et services illimités','Marketplace et boutique publique','Clients sous contrat','Rapports détaillés','Facturation professionnelle','Multi-utilisateurs','Support standard'],restrictions:[]},
  BUSINESS:{code:'BUSINESS',label:'Plan Business — 365 jours',price:BUSINESS_PLAN_AMOUNT,statut:'BUSINESS',durationDays:BUSINESS_PLAN_DAYS,target:'Toutes les entreprises souhaitant utiliser GLOBAL MARKET pendant une année complète.',maxUsers:Infinity,maxItems:Infinity,maxCategories:Infinity,limits:['Accès complet pendant 365 jours'],features:['Accès complet à toutes les sections','Produits et services illimités','Marketplace et boutique publique','Clients sous contrat','Rapports détaillés','Facturation professionnelle','Multi-utilisateurs','Accès annuel de 365 jours'],restrictions:[]}
};
function planCode(company){const raw=String(company?.planCode||company?.plan||company?.status||'FREE').toUpperCase(); return raw.includes('BUSINESS')||raw.includes('PLUS')?'BUSINESS':'FREE'}
function planDef(company){return GLOBAL_MARKET_PLANS[planCode(company)]||GLOBAL_MARKET_PLANS.FREE}
function hasPlanFeature(){return true}
function maxUsersAllowed(){return Infinity}
function userLimitLabel(){return 'illimité'}
function canCreateMoreUsers(){return true}
function planStatusText(company){return planDef(company).statut}
function renderPlanBadges(company){const p=planDef(company); return p.features.map(f=>`<span>✅ ${esc(f)}</span>`).join('')}
function assertPlanFeature(){return true}
function subscriptionEndFromToday(days){return new Date(Date.now()+Number(days||0)*86400000).toISOString().slice(0,10)}
async function activateCompanyPlan(cid,code){
  const d=seed(), c=(d.companies||[]).find(x=>x.id===cid), p=GLOBAL_MARKET_PLANS[code]; if(!c||!p)return;
  const isBusiness=code==='BUSINESS';
  const days=isBusiness?BUSINESS_PLAN_DAYS:FREE_PLAN_DAYS;
  const amount=isBusiness?BUSINESS_PLAN_AMOUNT:0;
  const confirmed=await g3Confirm(`Activer ${p.label} pour ${c.name} ?\n\nDurée : ${days} jours${isBusiness?`\nMontant : ${money(amount)}`:''}`,'Activation abonnement');
  if(!confirmed) return;
  c.planCode=code; c.plan=p.label; c.status=code; c.subscriptionStart=today(); c.subscriptionEnd=subscriptionEndFromToday(days); c.updatedAt=new Date().toISOString();
  d.payments=d.payments||[]; d.payments.push({id:id('pay'),ref:'PAY-'+today().replaceAll('-','')+'-'+randomPart(4),companyId:cid,amount,plan:p.label,status:isBusiness?'Payé':'Gratuit',date:new Date().toISOString(),method:isBusiness?'Activation Super Admin — Plan Business 365 jours':'Activation Super Admin — Plan Free 21 jours'});
  save(d); closeSuperModal(); renderSuper(); alert(p.label+' activé avec succès.');
}
function planActivationButtons(cid,currentCode){const code=String(currentCode||'FREE').toUpperCase().includes('BUSINESS')||String(currentCode||'').toUpperCase().includes('PLUS')?'BUSINESS':'FREE'; return `<div class="planActivationBox"><h3>Activation abonnement par Super Admin</h3><p>Deux plans uniquement : Free avec accès complet pendant 21 jours, ou Business avec accès complet pendant 365 jours.</p><div class="planButtons"><button class="${code==='FREE'?'active':''}" onclick="activateCompanyPlan('${cid}','FREE')">Activer FREE — 21 jours</button><button class="${code==='BUSINESS'?'active':''}" onclick="activateCompanyPlan('${cid}','BUSINESS')">Activer BUSINESS — 365 jours</button></div></div>`}

let FREE_PLAN_REMINDER_TIMER=null;
let FREE_PLAN_LAST_SECTION='';
function closeFreePlanUpgradePopup(){document.querySelector('.freePlanUpgradeBackdrop')?.remove()}
function openBusinessWavePayment(){
  closeFreePlanUpgradePopup();
  const link=document.createElement('a'); link.href=BUSINESS_WAVE_URL; link.target='_blank'; link.rel='noopener noreferrer'; document.body.appendChild(link); link.click(); link.remove();
}
function showFreePlanUpgradePopup(sectionName=''){
  const {user,company}=current();
  if(!user||user.role==='superadmin'||!company||planCode(company)!=='FREE') return;
  if(document.querySelector('.freePlanUpgradeBackdrop')) return;
  const info=getSubscriptionInfo(company,[]);
  const box=document.createElement('div');
  box.className='freePlanUpgradeBackdrop';
  box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true'); box.setAttribute('aria-labelledby','freePlanUpgradeTitle');
  box.innerHTML=`<div class="freePlanUpgradeModal">
    <button type="button" class="freePlanUpgradeClose" aria-label="Fermer" onclick="closeFreePlanUpgradePopup()">×</button>
    <div class="freePlanUpgradeIcon">🏢</div>
    <span class="freePlanUpgradeBadge">PLAN FREE • ACCÈS COMPLET • 21 JOURS</span>
    <h2 id="freePlanUpgradeTitle">Passez au Plan Business</h2>
    <p class="freePlanUpgradeLead">Vous profitez actuellement de toutes les fonctionnalités de GLOBAL MARKET avec le Plan Free. Pour conserver votre accès complet après la période d’essai, activez le Plan Business valable pendant 365 jours.</p>
    <div class="freePlanUpgradeStats">
      <div><small>Votre plan actuel</small><b>Free — 21 jours</b></div>
      <div><small>Durée restante</small><b>${info.left} jour(s)</b></div>
      <div><small>Plan recommandé</small><b>Business — 365 jours</b></div>
      <div><small>Montant annuel</small><b>${money(BUSINESS_PLAN_AMOUNT)}</b></div>
    </div>
    <div class="freePlanUpgradeBenefits"><span>✓ Accès complet pendant 365 jours</span><span>✓ Toutes les sections et fonctionnalités</span><span>✓ Données conservées sans interruption</span></div>
    <p class="freePlanUpgradeNote">${sectionName?`Rappel affiché à l’ouverture de la section « ${esc(sectionName)} ».`:'Rappel automatique du Plan Free.'}</p>
    <div class="freePlanUpgradeActions"><button type="button" class="freePlanUnderstood" onclick="closeFreePlanUpgradePopup()">Compris</button><button type="button" class="freePlanBuy" onclick="openBusinessWavePayment()">Acheter mon plan Business</button></div>
  </div>`;
  document.body.appendChild(box);
}
function manageFreePlanReminder(sectionName=''){
  const {user,company}=current();
  const free=Boolean(user&&user.role!=='superadmin'&&company&&planCode(company)==='FREE');
  if(!free){if(FREE_PLAN_REMINDER_TIMER){clearInterval(FREE_PLAN_REMINDER_TIMER);FREE_PLAN_REMINDER_TIMER=null;} FREE_PLAN_LAST_SECTION=''; closeFreePlanUpgradePopup(); return;}
  if(!FREE_PLAN_REMINDER_TIMER) FREE_PLAN_REMINDER_TIMER=setInterval(()=>showFreePlanUpgradePopup('Rappel automatique'),15*60*1000);
  const sectionLabels={home:'Accueil',vente:'Ventes',rapports:'Rapports',contrats:'Clients sous contrat',marketplace:'Marketplace',stocks:'Stocks',mois:'Gestion des 12 mois',param:'Paramètres',account:'Mon compte'};
  if(sectionName&&FREE_PLAN_LAST_SECTION!==sectionName){FREE_PLAN_LAST_SECTION=sectionName; setTimeout(()=>showFreePlanUpgradePopup(sectionLabels[sectionName]||sectionName),250);}
}


const slugify=s=>String(s||'boutique').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'boutique';
function secureDocLink(ref){return location.origin+location.pathname+'#doc/'+encodeURIComponent(ref)}
function qrPayload(ref,company,total,date){return JSON.stringify({document:ref,entreprise:company?.name||'',date:date||today(),montant:Number(total||0),lien:secureDocLink(ref)})}
function qrImg(data,size=150){return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`}
function qrBlock(ref,company,total,date){return ''}

function g3AmountWords(n){
  n=Math.round(Number(n||0));
  const units=['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize'];
  const tens=['','','vingt','trente','quarante','cinquante','soixante'];
  function under100(x){
    if(x<17)return units[x]; if(x<20)return 'dix-'+units[x-10]; if(x<70){const t=Math.floor(x/10),u=x%10; return tens[t]+(u?'-'+(u===1?'et-un':units[u]):'');}
    if(x<80)return 'soixante-'+under100(x-60); if(x<100)return 'quatre-vingt'+(x===80?'':'-'+under100(x-80));
  }
  function under1000(x){const h=Math.floor(x/100),r=x%100; let out=''; if(h){out=(h===1?'cent':units[h]+' cent')+(r?' ':'');} return out+(r?under100(r):'');}
  if(n===0)return 'ZÉRO FRANC CFA';
  let parts=[]; const millions=Math.floor(n/1000000); n%=1000000; const thousands=Math.floor(n/1000); const rest=n%1000;
  if(millions) parts.push((millions===1?'un':under1000(millions))+' million'+(millions>1?'s':''));
  if(thousands) parts.push(thousands===1?'mille':under1000(thousands)+' mille');
  if(rest) parts.push(under1000(rest));
  return (parts.join(' ')+' francs cfa').toUpperCase();
}
function premiumSaleInvoiceHTML(company,s,ref,dt){
  const qty=Number(s.qty||1), unit=Number(s.unit||0), fee=Number(s.serviceFee||0), total=Number(s.total||0);
  return `<div class="reportBox premiumInvoice premiumInvoiceModel">${freeWatermark(company)}
    <div class="premiumInvoiceTitle"><div class="goldSide"></div><h1>FACTURE / REÇU DE VENTE</h1><div class="goldSide"></div></div>
    <div class="invoiceBadge">N° ${esc(ref)}</div>
    <div class="premiumClientBox">
      <div class="premiumClientLeft"><div class="premiumClientIcon">♡</div><div><h2>CLIENT</h2><p>${esc(s.client||'Non précisé')}</p><span></span></div></div>
      <div class="premiumClientDetails">
        <div><b>Produit / Service</b><span>${esc(s.name||'')}</span></div>
        <div><b>Quantité</b><span>${qty}</span></div>
        <div><b>Prix unitaire</b><span>${money(unit)}</span></div>
        <div><b>Frais de service</b><span>${money(fee)}</span></div>
      </div>
    </div>
    <table class="premiumInvoiceTable"><thead><tr><th>N°</th><th>DÉSIGNATION</th><th>QUANTITÉ</th><th>PRIX UNIT. (FCFA)</th><th>MONTANT (FCFA)</th></tr></thead><tbody>
      <tr><td>1</td><td><b>${esc(s.name||'')}</b><br><em>Produit / Service</em></td><td>${qty}</td><td>${Number(unit||0).toLocaleString('fr-FR')}</td><td>${Number(total||0).toLocaleString('fr-FR')}</td></tr>
    </tbody></table>
    <div class="premiumTotalsGrid">
      <div class="amountWordsCard"><div class="docIcon">▧</div><div><p>Arrêtée la présente facture à la somme de :</p><h2>${g3AmountWords(total)}</h2><h3>( ${money(total)} )</h3></div></div>
      <div class="totalCard"><div class="totalLineV2"><b>TOTAL HT</b><span>${money(total-fee)}</span></div><div class="totalLineV2"><b>FRAIS DE SERVICE</b><span>${money(fee)}</span></div><div class="totalFinalV2"><b>TOTAL TTC</b><span>${money(total)}</span></div></div>
    </div>
    <div class="premiumBottomWave"></div>
  </div>`;
}

function getSubscriptionInfo(company,users=[]){const end=new Date((company?.subscriptionEnd||today())+'T23:59:59'); const left=Math.max(0,Math.ceil((end-new Date())/86400000)); return {left,status:statusCompany(company),users:users.length}}
function marketplaceUrl(company){return location.origin+location.pathname+'#boutique/'+slugify(company?.name||'entreprise')}
function shareText(txt){if(navigator.share){navigator.share({text:txt}).catch(()=>{})}else{navigator.clipboard?.writeText(txt); alert('Lien copié / prêt à partager.')}}

const YK='GLOBAL3_MANAGEMENT_YEAR_V1';
const MK='GLOBAL3_ACTIVE_MONTH_V1';
const monthsList=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function getCompanyCategoryRecords(d,cid){
  d.categories=d.categories||{};
  const saved=Array.isArray(d.categories[cid])?d.categories[cid]:[];
  const map=new Map();
  saved.forEach(c=>{ if(c&&c.name) map.set(String(c.name), {name:String(c.name), kind:(c.kind==='service'?'service':'boutique')}); });
  (d.items||[]).filter(i=>i.companyId===cid&&i.cat).forEach(i=>{
    if(!map.has(i.cat)) map.set(i.cat,{name:i.cat,kind:(String(i.type||'boutique')==='service'?'service':'boutique')});
  });
  const arr=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  d.categories[cid]=arr;
  return arr;
}
function getCompanyCategories(d,cid){return getCompanyCategoryRecords(d,cid).map(c=>c.name)}
function categoryKind(cat){
  const {d,company}=current();
  const rec=company?getCompanyCategoryRecords(d,company.id).find(c=>c.name===cat):null;
  return rec?.kind || 'boutique';
}
function saveCompanyCategoryRecords(d,cid,records){d.categories=d.categories||{}; d.categories[cid]=records;}

function getManageYear(){
  const {company}=current();
  return Number(company?.managementYear || new Date().getFullYear());
}
function getActiveMonth(){
  const {company}=current();
  const m=Number(company?.activeMonth ?? new Date().getMonth());
  return Math.max(0,Math.min(11,isNaN(m)?new Date().getMonth():m));
}
function saveManagementPeriod(y,m){
  y=Math.max(1,Number(y||new Date().getFullYear()));
  m=Math.max(0,Math.min(11,Number(m||0)));
  const {d,company}=current();
  if(company){
    const c=(d.companies||[]).find(x=>x.id===company.id);
    if(c){c.managementYear=y; c.activeMonth=m; c.updatedAt=new Date().toISOString(); save(d);}
  }
}
function isInManageYear(s){const dt=new Date(s.date); return dt.getFullYear()===getManageYear();}
function isInActiveExercise(s){const dt=new Date(s.date); return dt.getFullYear()===getManageYear() && dt.getMonth()===getActiveMonth();}
function exerciseKey(y=getManageYear(),m=getActiveMonth()){return String(y)+'-'+String(Number(m)+1).padStart(2,'0')}
function getExerciseState(y=getManageYear(),m=getActiveMonth()){const {company}=current(); const k=exerciseKey(y,m); return company?.exerciseLocks?.[k]||'open'}
function isExerciseLocked(y=getManageYear(),m=getActiveMonth()){return ['locked','closed'].includes(getExerciseState(y,m))}
function ensureActiveExerciseEditable(msg='Cet exercice est verrouillé ou clôturé. Consultation, impression et exportation seulement.'){if(isExerciseLocked()){alert(msg);return false}return true}
function isSaleExerciseLocked(s){const dt=new Date(s.date); return isExerciseLocked(dt.getFullYear(),dt.getMonth())}
function setActiveExerciseState(state){if(!requireAdmin()) return; const {d,company}=current(); const c=(d.companies||[]).find(x=>x.id===company.id); if(!c)return; c.exerciseLocks=c.exerciseLocks||{}; c.exerciseLocks[exerciseKey()]=state; c.updatedAt=new Date().toISOString(); save(d); renderDash('mois')}
function activeExerciseBadge(){const st=getExerciseState(); return st==='closed'?'🔒 Exercice clôturé':st==='locked'?'🔐 Exercice verrouillé':'✅ Exercice ouvert'}
function setManageYear(delta){if(!requireAdmin()) return; saveManagementPeriod(getManageYear()+Number(delta||0),getActiveMonth()); renderDash('mois')}
function applyManagementYear(){if(!requireAdmin()) return;const y=Math.max(1,Number($('#managementYear')?.value||new Date().getFullYear())); const m=Math.max(0,Math.min(11,Number($('#managementMonth')?.value||0))); saveManagementPeriod(y,m); alert('Année et mois de gestion appliqués à cette entreprise, sans affecter les autres entreprises.'); renderDash('mois')}
function openManagementMonth(i){if(!requireAdmin()) return; saveManagementPeriod(getManageYear(),i); renderDash('mois')}
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* === GLOBAL3 : popups professionnels réutilisables (alert / confirmation / saisie) === */
function g3PopupEsc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function g3PopupIcon(type){return type==='danger'?'⚠️':type==='success'?'✅':type==='prompt'?'✍️':type==='confirm'?'❔':'ℹ️'}
function g3Popup(options={}){
  return new Promise(resolve=>{
    const type=options.type||'info';
    const title=options.title|| (type==='confirm'?'Confirmation GLOBAL MARKET':type==='prompt'?'Saisie requise':'Message GLOBAL MARKET');
    const old=document.querySelector('.g3ProPopupBackdrop'); if(old) old.remove();
    const box=document.createElement('div');
    box.className='g3ProPopupBackdrop';
    const isPrompt=type==='prompt';
    const isConfirm=type==='confirm';
    box.innerHTML=`<div class="g3ProPopupCard g3ProPopup-${g3PopupEsc(type)}" role="dialog" aria-modal="true">
      <div class="g3ProPopupTop"><div class="g3ProPopupIcon">${g3PopupIcon(type)}</div><div><h2>${g3PopupEsc(title)}</h2><p>GLOBAL MARKET — notification professionnelle</p></div></div>
      <div class="g3ProPopupMessage">${g3PopupEsc(options.message||'').replace(/\n/g,'<br>')}</div>
      ${isPrompt?`<input class="g3ProPopupInput" value="${g3PopupEsc(options.defaultValue||'')}" placeholder="${g3PopupEsc(options.placeholder||'Saisir ici')}">`:''}
      <div class="g3ProPopupActions">
        ${isConfirm||isPrompt?'<button type="button" class="g3ProPopupBtn g3ProPopupCancel">Annuler</button>':''}
        <button type="button" class="g3ProPopupBtn g3ProPopupOk">${isConfirm?'Confirmer':isPrompt?'Valider':'OK'}</button>
      </div>
    </div>`;
    document.body.appendChild(box);
    const input=box.querySelector('.g3ProPopupInput');
    const close=(val)=>{box.remove(); resolve(val);};
    box.querySelector('.g3ProPopupOk')?.addEventListener('click',()=>close(isPrompt?(input?.value??''):true));
    box.querySelector('.g3ProPopupCancel')?.addEventListener('click',()=>close(isPrompt?null:false));
    box.addEventListener('click',e=>{if(e.target===box && !isPrompt && !isConfirm) close(true)});
    box.addEventListener('keydown',e=>{if(e.key==='Escape') close(isConfirm?false:(isPrompt?null:true)); if(e.key==='Enter'&&isPrompt) close(input?.value??'')});
    setTimeout(()=>input?.focus(),30);
  });
}
function g3Alert(message,title='Message GLOBAL MARKET',type='info'){g3Popup({message,title,type});}
function g3Success(message,title='Succès GLOBAL MARKET'){g3Popup({message,title,type:'success'});}
function g3Confirm(message,title='Confirmation GLOBAL MARKET'){return g3Popup({message,title,type:'confirm'});}
function g3Prompt(message,defaultValue='',title='Saisie GLOBAL MARKET'){return g3Popup({message,defaultValue,title,type:'prompt'});}
window.alert=function(message){g3Alert(message)};

const CLOUD_KEY='global_market_all';
let CLOUD_DATA=null;
let CLOUD_SESSION=null;
let PUBLIC_CLIENT_SESSION=null;
let CLOUD_SAVE_TIMER=null;
let CLOUD_SAVE_IN_FLIGHT=null;
let CLOUD_SAVE_QUEUED=false;
let CLOUD_DATA_READY=false;
let CLOUD_BOOT_SEQUENCE=0;
function defaultData(){return {companies:[],users:[],items:[],sales:[],payments:[],orders:[],clients:[],marketClients:[],passwordResetRequests:[]}}
function normalizeData(d){d=d&&typeof d==='object'?d:{}; if(d.data&&typeof d.data==='object') d=d.data; const base=defaultData(); return Object.assign(base,d,{companies:Array.isArray(d.companies)?d.companies:[],users:Array.isArray(d.users)?d.users:[],items:Array.isArray(d.items)?d.items:[],sales:Array.isArray(d.sales)?d.sales:[],payments:Array.isArray(d.payments)?d.payments:[],orders:Array.isArray(d.orders)?d.orders:[],clients:Array.isArray(d.clients)?d.clients:[],marketClients:Array.isArray(d.marketClients)?d.marketClients:[],passwordResetRequests:Array.isArray(d.passwordResetRequests)?d.passwordResetRequests:[]})}
function rememberCloudCache(){/* Sécurité : aucune base complète n'est conservée dans localStorage. */}
function readCloudCache(){return null}
async function fetchWithTimeout(url,opts={},ms=6500){const c=new AbortController(); const t=setTimeout(()=>c.abort(),ms); try{return await fetch(url,{...opts,credentials:'same-origin',signal:c.signal});}finally{clearTimeout(t)}}
async function readApiPayload(r){const j=await r.json().catch(()=>({})); if(!r.ok){const setup=j.code==='SETUP_REQUIRED'; const e=new Error(setup?(j.error||'Configuration Cloudflare incomplète. Vérifiez les secrets du Super Admin.'):j.error||('Erreur serveur '+r.status)); e.status=r.status; e.code=j.code||''; e.payload=j; throw e;} return j}
function employeeSecurityHeaders(extra={}){return {'Content-Type':'application/json',...(CLOUD_SESSION?.csrfToken?{'X-CSRF-Token':CLOUD_SESSION.csrfToken}:{}),...extra}}
function clientSecurityHeaders(extra={}){return {'Content-Type':'application/json',...(PUBLIC_CLIENT_SESSION?.csrfToken?{'X-CSRF-Token':PUBLIC_CLIENT_SESSION.csrfToken}:{}),...extra}}
async function cloudLoadData(){const r=await fetchWithTimeout('/api/load',{cache:'no-store'},9000); const j=await readApiPayload(r); CLOUD_DATA=normalizeData(j); CLOUD_DATA_READY=true; return CLOUD_DATA}
async function cloudLoadPublicData(){const r=await fetchWithTimeout('/api/public/load',{cache:'no-store'},9000); const j=await readApiPayload(r); PUBLIC_CLIENT_SESSION=j.clientSession||null; CLOUD_DATA=normalizeData(j); CLOUD_DATA_READY=true; if(PUBLIC_CLIENT_SESSION?.clientId) window.publicShopClientId=PUBLIC_CLIENT_SESSION.clientId; else window.publicShopClientId=''; return CLOUD_DATA}
async function cloudSaveNow(d=CLOUD_DATA){
  if(!d||!CLOUD_SESSION) return;
  if(CLOUD_SAVE_IN_FLIGHT){CLOUD_SAVE_QUEUED=true;return CLOUD_SAVE_IN_FLIGHT;}
  const snapshot=normalizeData(structuredClone(d));
  CLOUD_SAVE_IN_FLIGHT=(async()=>{
    const r=await fetchWithTimeout('/api/save',{method:'POST',headers:employeeSecurityHeaders(),body:JSON.stringify({data:snapshot})},15000);
    const j=await readApiPayload(r);
    if(CLOUD_DATA){
      CLOUD_DATA.app=CLOUD_DATA.app&&typeof CLOUD_DATA.app==='object'?CLOUD_DATA.app:{};
      if(Number.isFinite(Number(j.revision))) CLOUD_DATA.app.storageRevision=Number(j.revision);
      if(Number.isFinite(Number(j.catalogRevision))) CLOUD_DATA.app.catalogRevision=Number(j.catalogRevision);
    }
    return j;
  })();
  try{return await CLOUD_SAVE_IN_FLIGHT;}
  finally{
    CLOUD_SAVE_IN_FLIGHT=null;
    if(CLOUD_SAVE_QUEUED){
      CLOUD_SAVE_QUEUED=false;
      queueMicrotask(()=>cloudSaveNow(CLOUD_DATA).catch(e=>{
        console.error(e);
        if(e.status===409) alert('Une autre modification a été enregistrée sur ce compte. Actualisez la page avant de recommencer.');
        else if(e.status===401){CLOUD_SESSION=null;alert('Votre session a expiré. Reconnectez-vous.');renderLogin();}
        else alert('La sauvegarde sécurisée a échoué : '+e.message);
      }));
    }
  }
}
async function cloudLoadSession(timeoutMs=3200){
  try{
    const r=await fetchWithTimeout('/api/session',{cache:'no-store'},timeoutMs);
    const j=await readApiPayload(r);
    CLOUD_SESSION=j.session||null;
    if(j.data&&typeof j.data==='object'){
      CLOUD_DATA=normalizeData(j.data);
      CLOUD_DATA_READY=true;
    }
  }catch(e){
    CLOUD_SESSION=null;
    CLOUD_DATA_READY=false;
  }
  return CLOUD_SESSION;
}
async function cloudSetSession(){throw new Error('La création directe de session est désactivée. Utilisez la connexion sécurisée.')}
async function cloudClearSession(){const old=CLOUD_SESSION; try{await fetchWithTimeout('/api/session',{method:'DELETE',headers:{'Content-Type':'application/json',...(old?.csrfToken?{'X-CSRF-Token':old.csrfToken}:{})}},4500)}catch(e){console.warn('Déconnexion cloud non confirmée',e)} CLOUD_SESSION=null; CLOUD_DATA=defaultData(); CLOUD_DATA_READY=false}
async function cloudStart(){
  const sequence=++CLOUD_BOOT_SEQUENCE;
  const publicRoute=location.hash.startsWith('#boutique-global')||location.hash.startsWith('#boutique/');
  CLOUD_SESSION=null;
  CLOUD_DATA=defaultData();
  CLOUD_DATA_READY=false;

  // La page de connexion s'affiche immédiatement. La restauration de session
  // s'effectue ensuite en arrière-plan, sans écran blanc ni attente bloquante.
  if(publicRoute){
    app.innerHTML='<div class="wrap"><div class="card" style="max-width:620px;margin:70px auto;text-align:center"><h1>GLOBAL MARKET</h1><p>Chargement de la boutique sécurisée…</p></div></div>';
  }else{
    renderLogin();
  }

  try{
    if(publicRoute){
      await cloudLoadPublicData();
      if(sequence===CLOUD_BOOT_SEQUENCE) render();
      return;
    }
    await cloudLoadSession(3200);
    if(sequence!==CLOUD_BOOT_SEQUENCE) return;
    if(CLOUD_SESSION){
      if(!CLOUD_DATA_READY) await cloudLoadData();
      if(sequence===CLOUD_BOOT_SEQUENCE) render();
    }
  }catch(e){
    console.error(e);
    if(sequence===CLOUD_BOOT_SEQUENCE){
      CLOUD_SESSION=null;
      CLOUD_DATA=defaultData();
      CLOUD_DATA_READY=false;
      renderLogin();
    }
  }
}
function seed(){if(!CLOUD_DATA) CLOUD_DATA=defaultData(); return CLOUD_DATA}
function save(d){CLOUD_DATA=normalizeData(d); if(!CLOUD_SESSION) return; clearTimeout(CLOUD_SAVE_TIMER); CLOUD_SAVE_TIMER=setTimeout(()=>cloudSaveNow(CLOUD_DATA).catch(e=>{console.error(e); if(e.status===409){alert('Une autre modification a été enregistrée sur ce compte. Actualisez la page avant de recommencer.')}else if(e.status===401){CLOUD_SESSION=null; alert('Votre session a expiré. Reconnectez-vous.'); renderLogin()}else alert('La sauvegarde sécurisée a échoué : '+e.message)}),400)}
function session(){return CLOUD_SESSION}
function setSession(x){return cloudSetSession(x)}
function logout(){if(FREE_PLAN_REMINDER_TIMER){clearInterval(FREE_PLAN_REMINDER_TIMER);FREE_PLAN_REMINDER_TIMER=null;} FREE_PLAN_LAST_SECTION=''; closeFreePlanUpgradePopup(); cloudClearSession().finally(()=>renderLogin())}
function current(){const d=seed(), s=session(); if(!s) return {d}; if(s.expiresAt && Date.now()>Number(s.expiresAt)){CLOUD_SESSION=null; cloudClearSession(); alert('Session caisse expirée. Veuillez vous reconnecter.'); return {d};} const user=d.users.find(u=>u.id===s.userId&&u.status==='active'); if(user?.role==='caisse' && !isCaisseInAllowedHours(user)){CLOUD_SESSION=null; cloudClearSession(); alert('Accès caisse bloqué : vous êtes hors de la plage horaire autorisée ('+caisseAllowedRangeLabel(user)+').'); return {d};} const company=user?.companyId?d.companies.find(c=>c.id===user.companyId):null; return {d,s,user,company}}
function caisseSessionMinutes(u){return Math.max(5,Number(u?.sessionMinutes||60));}
function normalizeHour(v,def){v=String(v||def||'').trim(); return /^([01]\d|2[0-3]):[0-5]\d$/.test(v)?v:def;}
function caisseStartTime(u){return normalizeHour(u?.caisseStartTime||u?.workStart,'07:00')}
function caisseEndTime(u){return normalizeHour(u?.caisseEndTime||u?.workEnd,'22:00')}
function minutesFromHHMM(v){const [h,m]=String(v||'00:00').split(':').map(Number); return h*60+m;}
function caisseAllowedRangeLabel(u){return caisseStartTime(u)+'–'+caisseEndTime(u)}
function isCaisseInAllowedHours(u,dt=new Date()){if(!u || u.role!=='caisse') return true; const start=minutesFromHHMM(caisseStartTime(u)), end=minutesFromHHMM(caisseEndTime(u)); const now=dt.getHours()*60+dt.getMinutes(); if(start===end) return true; return start<end ? (now>=start && now<=end) : (now>=start || now<=end);}
function sessionPayloadForUser(u){return {userId:u.id,loginAt:Date.now(),expiresAt:null};}
function loginAttemptsKey(email){return 'GLOBAL_MARKET_LOGIN_ATTEMPTS_'+String(email||'').toLowerCase();}
function getLoginAttempts(email){const d=seed(); d.loginAttempts=d.loginAttempts||{}; return Number(d.loginAttempts[String(email||'').toLowerCase()]||0);}
function resetLoginAttempts(email){const d=seed(); d.loginAttempts=d.loginAttempts||{}; delete d.loginAttempts[String(email||'').toLowerCase()]; save(d);}
function registerLoginFailure(email){const d=seed(); d.loginAttempts=d.loginAttempts||{}; const key=String(email||'').toLowerCase(); const attempts=Number(d.loginAttempts[key]||0)+1; d.loginAttempts[key]=attempts; const u=(d.users||[]).find(x=>String(x.email||'').toLowerCase()===key); if(attempts>=5 && u){u.status='blocked'; save(d); return {blocked:true,attempts};} save(d); return {blocked:false,attempts};}
async function setObjectPassword(){throw new Error('Les mots de passe sont traités uniquement par le serveur Cloudflare sécurisé.')}
async function verifyObjectPassword(){return false}

function logCaisseAction(action,details=''){const {d,user,company}=current(); if(!user||user.role!=='caisse'||!company) return; d.caisseLogs=d.caisseLogs||[]; d.caisseLogs.push({id:id('log'),companyId:company.id,userId:user.id,userName:user.name||user.email,action,details,date:new Date().toISOString()}); if(d.caisseLogs.length>1000)d.caisseLogs=d.caisseLogs.slice(-1000); save(d);}
function caisseLogsTable(){const {d,company}=current(); const rows=(d.caisseLogs||[]).filter(x=>x.companyId===company.id).slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,100); return `<div class="superTableWrap"><table class="g2table"><tr><th>Date</th><th>Utilisateur caisse</th><th>Action</th><th>Détail</th></tr>${rows.map(r=>`<tr><td>${new Date(r.date).toLocaleString('fr-FR')}</td><td>${esc(r.userName||'')}</td><td>${esc(r.action||'')}</td><td>${esc(r.details||'')}</td></tr>`).join('')||'<tr><td colspan="4">Aucune action caisse enregistrée.</td></tr>'}</table></div>`}
function requireCaisseCanEditSale(s){if(isCaisse() && s && !getCurrentCompanyCartSales().some(x=>x.id===s.id)){alert('La caisse ne peut pas modifier une facture après validation.'); return false;} return true;}
function statusCompany(c){if(!c) return 'blocked'; if(['blocked','suspended'].includes(c.status)) return c.status; if(c.subscriptionEnd && c.subscriptionEnd < today()) return 'expired'; const code=planCode(c); return code||c.status||'FREE'}

const GLOBAL3_CGU_TEXT = String.raw`CONDITIONS GÉNÉRALES D’UTILISATION (CGU)
GLOBAL MARKET — Plateforme Multi Entreprises
Développé par MEGA SERVICES SARL U
Dernière mise à jour : Mai 2026
________________________________________
1. PRÉSENTATION DE LA PLATEFORME
GLOBAL MARKET est une plateforme numérique multi entreprises développée par MEGA SERVICES SARL U permettant aux entreprises, commerces, boutiques et prestataires de services de gérer leurs activités professionnelles.
La plateforme propose notamment :
- la gestion des ventes ;
- la gestion des produits ;
- la gestion des services ;
- la gestion des stocks ;
- la gestion des utilisateurs ;
- la génération de factures ;
- les rapports financiers ;
- la gestion des abonnements ;
- la marketplace intégrée ;
- les espaces administrateurs ;
- les outils d’impression et d’exportation PDF.
L’utilisation de la plateforme implique l’acceptation complète des présentes Conditions Générales d’Utilisation.
________________________________________
2. ACCÈS À LA PLATEFORME
L’accès à GLOBAL MARKET est réservé aux utilisateurs disposant d’un compte valide.
Chaque entreprise inscrite dispose d’un espace indépendant et sécurisé.
L’utilisateur est responsable :
- de la confidentialité de ses identifiants ;
- des activités réalisées depuis son compte ;
- de la sécurité des appareils utilisés.
MEGA SERVICES SARL U se réserve le droit de suspendre ou bloquer tout compte en cas :
- d’activité frauduleuse ;
- de tentative de piratage ;
- d’utilisation abusive ;
- de non respect des présentes conditions.
________________________________________
3. ABONNEMENTS
GLOBAL MARKET propose uniquement deux plans donnant tous les deux accès à l’ensemble des fonctionnalités de l’application.
PLAN FREE
Le Plan Free donne un accès complet à GLOBAL MARKET pendant vingt-et-un (21) jours à compter de l’activation de l’entreprise.
PLAN BUSINESS
Le Plan Business donne un accès complet à GLOBAL MARKET pendant trois cent soixante-cinq (365) jours à compter de son activation.
Le maintien de l’accès après l’expiration du Plan Free nécessite l’activation du Plan Business.
Chaque abonnement possède :
- une durée fixe ;
- un statut d’activation ;
- une date de début ;
- une date d’expiration.
MEGA SERVICES SARL U peut améliorer les fonctionnalités de la plateforme sans réduire l’accès complet prévu pour les plans actifs.
________________________________________
4. RESPONSABILITÉ DE L’UTILISATEUR
L’utilisateur s’engage à :
- fournir des informations exactes ;
- utiliser la plateforme légalement ;
- respecter les lois fiscales et commerciales ;
- ne pas utiliser la plateforme pour des activités illicites.
L’utilisateur reste seul responsable :
- de ses ventes ;
- de ses factures ;
- de ses déclarations fiscales ;
- de ses contenus ;
- de ses données commerciales.
________________________________________
5. DISPONIBILITÉ DU SERVICE
MEGA SERVICES SARL U met tout en œuvre pour assurer le bon fonctionnement de GLOBAL MARKET.
Cependant, la société ne garantit pas :
- l’absence totale d’interruption ;
- l’absence de bug ;
- l’absence de maintenance ;
- la disponibilité permanente du service.
Des interruptions temporaires peuvent intervenir pour :
- maintenance ;
- mise à jour ;
- amélioration technique ;
- sécurité.
________________________________________
6. PROPRIÉTÉ INTELLECTUELLE
GLOBAL MARKET, son design, ses logos, ses modules, ses codes, ses interfaces et ses contenus sont la propriété exclusive de MEGA SERVICES SARL U.
Toute reproduction, modification, copie ou exploitation sans autorisation écrite est interdite.
________________________________________
7. DONNÉES ET SAUVEGARDE
L’utilisateur est responsable de la sauvegarde de ses données importantes.
MEGA SERVICES SARL U peut mettre en place des systèmes de sauvegarde automatique sans obligation de garantie absolue.
________________________________________
8. SUSPENSION ET RÉSILIATION
MEGA SERVICES SARL U peut suspendre un compte en cas :
- de non paiement ;
- d’utilisation frauduleuse ;
- de tentative de contournement du système ;
- de comportement abusif.
L’utilisateur peut demander la fermeture de son compte à tout moment.
________________________________________
9. LIMITATION DE RESPONSABILITÉ
MEGA SERVICES SARL U ne peut être tenue responsable :
- des pertes financières ;
- des erreurs de saisie ;
- des mauvaises décisions commerciales ;
- des interruptions réseau ;
- des pertes liées à des appareils tiers ;
- des actes réalisés par les utilisateurs.
________________________________________
10. MODIFICATION DES CONDITIONS
MEGA SERVICES SARL U se réserve le droit de modifier les présentes conditions à tout moment.
Les nouvelles conditions prennent effet dès leur publication sur la plateforme.
________________________________________
11. CONTACT
MEGA SERVICES SARL U Diabo — Côte d’Ivoire
Téléphone : +225 07 77 04 17 90 Email : megaservicediabo@gmail.com`;

const GLOBAL3_PRIVACY_TEXT = String.raw`POLITIQUE DE CONFIDENTIALITÉ
GLOBAL MARKET — Plateforme Multi Entreprises
Dernière mise à jour : Mai 2026
________________________________________
1. INTRODUCTION
La présente Politique de Confidentialité explique comment MEGA SERVICES SARL U collecte, utilise et protège les informations des utilisateurs de la plateforme GLOBAL MARKET.
L’utilisation de GLOBAL MARKET implique l’acceptation de cette politique.
________________________________________
2. DONNÉES COLLECTÉES
GLOBAL MARKET peut collecter les informations suivantes :
Informations d’identification
- nom de l’entreprise ;
- nom du responsable ;
- téléphone ;
- email ;
- adresse ;
- RCCM ;
- compte contribuable.
Informations techniques
- adresse IP ;
- navigateur ;
- appareil utilisé ;
- données de connexion ;
- historique d’utilisation.
Données commerciales
- produits ;
- services ;
- ventes ;
- factures ;
- clients ;
- rapports.
________________________________________
3. UTILISATION DES DONNÉES
Les données collectées servent à :
- fournir les services ;
- améliorer la plateforme ;
- sécuriser les comptes ;
- générer les rapports ;
- assurer le support technique ;
- gérer les abonnements ;
- prévenir la fraude.
________________________________________
4. PROTECTION DES DONNÉES
MEGA SERVICES SARL U met en place des mesures de sécurité raisonnables afin de protéger les données des utilisateurs.
Cependant, aucun système informatique ne garantit une sécurité absolue.
________________________________________
5. PARTAGE DES DONNÉES
Les données des utilisateurs ne sont pas vendues.
Les informations peuvent être partagées uniquement :
- avec des prestataires techniques ;
- en cas d’obligation légale ;
- pour protéger la sécurité du système.
________________________________________
6. CONSERVATION DES DONNÉES
Les données peuvent être conservées pendant la durée nécessaire au fonctionnement du service et aux obligations légales.
________________________________________
7. DROITS DES UTILISATEURS
Les utilisateurs peuvent demander :
- l’accès à leurs données ;
- la correction des données ;
- la suppression des données ;
- la fermeture de leur compte.
Certaines données peuvent toutefois être conservées pour des raisons légales ou administratives.
________________________________________
8. COOKIES ET TECHNOLOGIES SIMILAIRES
GLOBAL MARKET peut utiliser des cookies ou technologies similaires afin :
- d’améliorer l’expérience utilisateur ;
- de mémoriser certaines préférences ;
- d’assurer la sécurité des connexions.
________________________________________
9. RESPONSABILITÉ DES UTILISATEURS
Chaque utilisateur est responsable des données qu’il enregistre sur la plateforme.
L’utilisateur doit respecter les lois applicables relatives à la protection des données personnelles.
________________________________________
10. MODIFICATION DE LA POLITIQUE
MEGA SERVICES SARL U peut modifier la présente Politique de Confidentialité à tout moment.
Les modifications prennent effet dès leur publication.
________________________________________
11. CONTACT
Pour toute question concernant cette politique :
MEGA SERVICES SARL U Diabo — Côte d’Ivoire
Téléphone : +225 07 77 04 17 90 Email : megaservicediabo@gmail.com`;

function loginLegalHtml(){return `<div class="loginLegalNotice ggLoginLegal"><span class="ggLegalShield" aria-hidden="true">${ggIcon('shield')}</span><span>En vous inscrivant sur <strong>GLOBAL MARKET</strong>, vous confirmez que vous acceptez nos <button type="button" class="legalTextLink" onclick="openLegalPopup('cgu')">conditions d’utilisation</button> et que vous avez pris connaissance de notre <button type="button" class="legalTextLink" onclick="openLegalPopup('privacy')">politique de confidentialité</button>.</span></div>`}
function legalModalHtml(){return `<div id="legalPopup" class="legalPopup hidden" role="dialog" aria-modal="true" aria-labelledby="legalTitle"><div class="legalBackdrop" onclick="closeLegalPopup()"></div><div class="legalCard"><button type="button" class="legalClose" aria-label="Fermer" onclick="closeLegalPopup()">×</button><h2 id="legalTitle">Documents légaux GLOBAL MARKET</h2><pre id="legalText"></pre></div></div>`}
function openLegalPopup(type){const pop=document.querySelector('#legalPopup'), title=document.querySelector('#legalTitle'), text=document.querySelector('#legalText'); if(!pop||!title||!text)return; title.textContent=type==='privacy'?'Politique de confidentialité':'Conditions d’utilisation'; text.textContent=type==='privacy'?GLOBAL3_PRIVACY_TEXT:GLOBAL3_CGU_TEXT; pop.classList.remove('hidden')}
function closeLegalPopup(){document.querySelector('#legalPopup')?.classList.add('hidden')}

const GLOBAL_MARKET_LOGIN_LINKS=Object.freeze({
  supportWhatsapp:'https://wa.me/2250777041790',
  boutiqueHash:'boutique-global'
});

function ggIcon(name,extraClass=''){
  const common=`class="ggSvgIcon ${extraClass}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"`;
  const icons={
    user:`<svg ${common}><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0"/></svg>`,
    lock:`<svg ${common}><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`,
    eye:`<svg ${common}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>`,
    eyeOff:`<svg ${common}><path d="m3 3 18 18M10.6 6.2A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.2 3M6.5 6.5C4 8.2 2.5 12 2.5 12s3.5 6 9.5 6c1.1 0 2.1-.2 3-.5M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>`,
    cash:`<svg ${common}><path d="M4 5h16v14H4z"/><path d="M7 8h10M7 16h5M16 13h1M7 12h5"/></svg>`,
    officer:`<svg ${common}><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/><path d="M9 11a3 3 0 1 1 6 0M8 17c.8-2 2.1-3 4-3s3.2 1 4 3"/></svg>`,
    whatsapp:`<svg ${common}><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 2 2 3.5 4 4l1-1c.3-.3.6-.2.9-.1l1.6.8c.4.2.5.5.4.9-.4 1.2-1.4 2-2.7 2-3.6 0-7.3-3.7-7.3-7.3 0-1.3.8-2.3 2-2.7.4-.1.7 0 .9.4l.8 1.6c.1.3.2.6-.1.9l-1 1Z"/></svg>`,
    shop:`<svg ${common}><path d="M4 9h16l-1-5H5L4 9Z"/><path d="M5 9v11h14V9M9 20v-6h6v6"/><path d="M4 9c0 1.7 2 2.5 4 1 2 1.5 4 .7 4-1 0 1.7 2 2.5 4 1 2 1.5 4 .7 4-1"/></svg>`,
    arrow:`<svg ${common}><path d="M5 12h14M14 7l5 5-5 5"/></svg>`,
    login:`<svg ${common}><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></svg>`,
    shield:`<svg ${common}><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/></svg>`,
    star:`<svg ${common}><path d="m12 2 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 8.6l6.2-.9L12 2Z"/></svg>`,
    chevrons:`<svg ${common}><path d="m6 7 5 5-5 5M13 7l5 5-5 5"/></svg>`,
    building:`<svg ${common}><path d="M4 21V5l8-3 8 3v16"/><path d="M2 21h20M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/></svg>`,
    briefcase:`<svg ${common}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></svg>`,
    document:`<svg ${common}><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 11h6M9 15h6M9 19h4"/></svg>`,
    calculator:`<svg ${common}><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 5h8v4H8zM8 13h1M12 13h1M16 13h1M8 17h1M12 17h1M16 17h1"/></svg>`,
    cart:`<svg ${common}><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.4 10.2a2 2 0 0 0 2 1.5h7.8a2 2 0 0 0 2-1.6L21 8H7"/></svg>`,
    chart:`<svg ${common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><path d="m3 8 6-4 6 5 6-6"/></svg>`,
    location:`<svg ${common}><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>`,
    phone:`<svg ${common}><path d="M6.6 2.8 9.2 7a2 2 0 0 1-.3 2.4l-1.3 1.3a16 16 0 0 0 5.7 5.7l1.3-1.3a2 2 0 0 1 2.4-.3l4.2 2.6a2 2 0 0 1 .8 2.3A3 3 0 0 1 19 22C9.6 22 2 14.4 2 5a3 3 0 0 1 2.3-2.9 2 2 0 0 1 2.3.7Z"/></svg>`,
    mail:`<svg ${common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>`,
    tag:`<svg ${common}><path d="M20 13 13 20l-9-9V4h7l9 9Z"/><circle cx="8.5" cy="8.5" r="1.2"/></svg>`
  };
  return icons[name]||icons.shield;
}
function ggMilitaryLogoHtml(){return `<div class="ggMilitaryLogo" aria-label="Logo GLOBAL MARKET"><svg viewBox="0 0 150 170" role="img" aria-hidden="true"><defs><linearGradient id="ggGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2d98a"/><stop offset=".45" stop-color="#c6a352"/><stop offset="1" stop-color="#8b6b25"/></linearGradient></defs><path d="M75 5 137 40v75c0 28-28 43-62 50-34-7-62-22-62-50V40L75 5Z" fill="#172719" stroke="url(#ggGold)" stroke-width="5"/><path d="M75 19 124 47v64c0 19-20 31-49 38-29-7-49-19-49-38V47L75 19Z" fill="none" stroke="#c6a352" stroke-opacity=".55" stroke-width="2"/><circle cx="75" cy="70" r="31" fill="none" stroke="#c6a352" stroke-width="2.5"/><path d="M44 70h62M75 39c-11 10-16 20-16 31s5 21 16 31M75 39c11 10 16 20 16 31s-5 21-16 31M50 54c15 7 35 7 50 0M50 86c15-7 35-7 50 0" fill="none" stroke="#c6a352" stroke-width="1.8" opacity=".9"/><text x="75" y="80" text-anchor="middle" fill="#f3d981" font-size="28" font-weight="900" font-family="Arial Narrow,Impact,sans-serif">GM</text><path d="m75 116 4 8 9 1-6.5 6.2 1.6 8.8-8.1-4.2-8.1 4.2 1.6-8.8L62 125l9-1 4-8Z" fill="url(#ggGold)"/></svg></div>`}
function ggWingEmblemHtml(){return `<div class="ggWingEmblem" aria-hidden="true"><span class="wing left"></span><span class="wingStar">${ggIcon('star')}</span><span class="wing right"></span></div>`}

function renderLogin(){app.innerHTML=`<main class="loginPage ggMilitaryLogin" aria-labelledby="ggLoginTitle">
  <div class="ggTacticalGrid" aria-hidden="true"></div>
  <svg class="ggWorldMap" viewBox="0 0 1200 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g><path d="M83 214 128 170l66-9 37-42 73 8 35 38-22 43-39 10-24 45-60 14-41-30-46-1-24-32Zm285 81 35-37 55-11 35 23 13 48-29 40-18 63-41 39-32-53 10-53-28-59Zm235-142 49-42 77-12 74 17 44 35 85 4 67 38 57 51-14 43-67 1-56-25-39 25-52-4-27-51-49-5-29-39-64-4-40-32Zm202 176 52-19 59 17 45 46-13 54-48 15-65-22-36-50 6-41Z"/></g></svg>
  <div class="loginBox ggLoginBook">
    <section class="loginLeft ggLoginPanel ggLoginPanelLeft" aria-label="Présentation GLOBAL MARKET">
      <div class="ggLeftInner">
        ${ggMilitaryLogoHtml()}
        <div class="ggLoginTitleBlock">
          <span class="ggKicker">ACCÈS OPÉRATIONNEL SÉCURISÉ</span>
          <h1 id="ggLoginTitle">CONNEXION <strong>GLOBAL MARKET</strong></h1>
          <span class="ggTitleStar" aria-hidden="true">${ggIcon('star')}</span>
        </div>
        <p class="ggLoginIntro">Accès sécurisé pour protéger les entreprises, les ventes, les rapports, les stocks, les paramètres et les suppressions.</p>
        <div class="ggRoleBriefs">
          <div class="ggRoleBrief"><span class="ggRoleBriefIcon">${ggIcon('cash')}</span><p><b>Caisse</b><small>Vente uniquement, sans modification ni suppression.</small></p></div>
          <div class="ggRoleBrief"><span class="ggRoleBriefIcon">${ggIcon('officer')}</span><p><b>Administrateur</b><small>Accès complet au compte entreprise.</small></p></div>
        </div>
        <div class="ggDeveloperLine"><span></span><b>DÉVELOPPÉ PAR MEGA SERVICES SARL U</b><span></span></div>
        <div class="ggLeftActions">
          <button type="button" class="ggMilitaryAction ggWhatsappAction" onclick="openSupportWhatsApp()"><span>${ggIcon('whatsapp')}</span><b>SUPPORT WHATSAPP</b><i>${ggIcon('arrow')}</i></button>
          <button type="button" class="ggMilitaryAction ggShopAction" onclick="openGlobalShopLogin()"><span>${ggIcon('shop')}</span><b>BOUTIQUE GLOBAL MARKET</b><i>${ggIcon('arrow')}</i></button>
        </div>
      </div>
    </section>
    <section class="loginRight ggLoginPanel ggLoginPanelRight" aria-label="Formulaire de connexion">
      <div class="ggRightInner">
        ${ggWingEmblemHtml()}
        <header class="ggFormHeading"><h2>CHOISIR UN PROFIL</h2><p>Connectez-vous selon votre responsabilité.</p></header>
        <form id="globalLoginForm" class="ggLoginForm" onsubmit="event.preventDefault();login()" novalidate>
          <div class="profileBtns ggProfileGrid" role="group" aria-label="Choisir le profil de connexion">
            <button type="button" class="profile ggProfileCard active" data-role="caisse" aria-pressed="true" onclick="selectProfile(this,'caisse')"><span class="ggProfileStar">${ggIcon('star')}</span><span class="ggProfileHex">${ggIcon('cash')}</span><strong>LA CAISSE</strong><small>Vente sécurisée</small></button>
            <button type="button" class="profile ggProfileCard" data-role="admin" aria-pressed="false" onclick="selectProfile(this,'admin')"><span class="ggProfileStar">${ggIcon('star')}</span><span class="ggProfileHex">${ggIcon('officer')}</span><strong>ADMINISTRATEUR</strong><small>Gestion complète</small></button>
          </div>
          <input id="loginRole" name="role" type="hidden" value="caisse">
          <div class="ggFieldGroup">
            <label for="loginEmail">Nom utilisateur / Email</label>
            <div class="ggInputShell"><span class="ggInputIcon">${ggIcon('user')}</span><input id="loginEmail" name="email" type="text" autocomplete="username" inputmode="email" placeholder="moi@services.com" aria-describedby="loginMessage" required></div>
          </div>
          <div class="ggFieldGroup">
            <label for="loginPass">Mot de passe</label>
            <div class="ggInputShell"><span class="ggInputIcon">${ggIcon('lock')}</span><input id="loginPass" name="password" type="password" autocomplete="current-password" placeholder="Saisissez votre mot de passe" aria-describedby="loginMessage" required><button type="button" class="ggPasswordToggle" aria-label="Afficher le mot de passe" aria-pressed="false" onclick="toggleLoginPassword(this)">${ggIcon('eye')}</button></div>
          </div>
          <div id="loginMessage" class="ggLoginMessage" role="status" aria-live="polite"></div>
          <div class="loginActions loginActionsTwo ggLoginActions">
            <button id="loginSubmitBtn" type="submit" class="ggConnectBtn"><span class="ggBtnIcon">${ggIcon('chevrons')}</span><span class="ggBtnLabel">SE CONNECTER</span></button>
            <button type="button" class="ggRegisterBtn" onclick="openRegisterPopup()"><span class="ggBtnIcon">${ggIcon('shield')}</span><span>INSCRIPTION</span></button>
          </div>
          <div class="forgotLine ggForgotLine"><button type="button" class="legalTextLink ggForgotLink" onclick="openForgotPasswordPopup()"><span>${ggIcon('lock')}</span>Mot de passe oublié ?</button></div>
        </form>
      </div>
    </section>
  </div>
  ${loginLegalHtml()}
</main>
${legalModalHtml()}
<div id="registerModal" class="modal hidden gmRegisterModal" aria-hidden="true">
  <div class="modalOverlay gmRegisterOverlay" onclick="closeRegisterPopup()"></div>
  <div class="modalCard gmRegisterModalCard" role="dialog" aria-modal="true" aria-labelledby="registerTitle" aria-describedby="registerDescription">
    <button type="button" class="modalClose gmRegisterClose" aria-label="Fermer la fiche d’inscription" onclick="closeRegisterPopup()">×</button>
    <header class="gmRegisterHeader">
      <div class="gmRegisterHeadingText">
        <h2 id="registerTitle">FICHE D’INSCRIPTION DES ENTREPRISES</h2>
        <p class="registerSub" id="registerDescription"><span>Veuillez remplir correctement tous les champs. Tous les textes saisis restent visibles et lisibles.</span></p>
      </div>
    </header>
    <div class="gmRegisterDivider" aria-hidden="true"></div>
    <div class="registerBusinessGrid gmRegisterGrid">
      <section class="gmRegisterSection gmRegisterSectionCompany" aria-labelledby="gmRegisterCompanyTitle">
        <h3 id="gmRegisterCompanyTitle"><span class="gmRegisterSectionIcon" aria-hidden="true">${ggIcon('building')}</span><span>INFORMATION DE L’ENTREPRISE</span></h3>
        <div class="gmRegisterRow gmRegisterRowFour">
          <div class="gmRegisterField gmFieldName">
            <label for="cName">RAISON SOCIALE <span class="gmRequired">*</span></label>
            <div class="gmRegisterControl"><span class="gmRegisterIcon">${ggIcon('building')}</span><input id="cName" name="companyName" type="text" placeholder="EX/ MEGA SERVICES SARL U" autocomplete="organization" required></div>
          </div>
          <div class="gmRegisterField gmFieldLegal">
            <label for="cLegalForm">FORME JURIDIQUE <span class="gmRequired">*</span></label>
            <div class="gmRegisterControl"><span class="gmRegisterIcon">${ggIcon('briefcase')}</span><input id="cLegalForm" name="legalForm" type="text" placeholder="EX/ SARL U" required></div>
          </div>
          <div class="gmRegisterField gmFieldRccm">
            <label for="cRccm">RCCM <span class="gmRequired">*</span></label>
            <div class="gmRegisterControl"><span class="gmRegisterIcon">${ggIcon('document')}</span><input id="cRccm" name="rccm" type="text" placeholder="EX/ CI-BKE-2025-B-00000" required></div>
          </div>
          <div class="gmRegisterField gmFieldTax">
            <label for="cTaxAccount">COMPTE CONTRIBUABLE <span class="gmRequired">*</span></label>
            <div class="gmRegisterControl"><span class="gmRegisterIcon">${ggIcon('calculator')}</span><input id="cTaxAccount" name="taxAccount" type="text" placeholder="EX/ 0000000 A" required></div>
          </div>
        </div>
      </section>

      <section class="gmRegisterSection gmRegisterSectionSpecialty" aria-labelledby="gmRegisterSpecialtyTitle">
        <h3 id="gmRegisterSpecialtyTitle"><span class="gmRegisterSectionIcon" aria-hidden="true">${ggIcon('tag')}</span><span>SPÉCIALITÉ</span></h3>
        <div class="gmRegisterRow gmRegisterRowTwo gmRegisterRowSpecialty">
          <div class="gmRegisterField gmFieldType">
            <label for="cType">TYPE DE COMMERCE <span class="gmRequired">*</span></label>
            <div class="gmRegisterControl"><span class="gmRegisterIcon">${ggIcon('cart')}</span><select id="cType" name="businessType" required><option value="boutique">Vente de produits / Boutique</option><option value="service">Vente de services</option><option value="mixed">Produits et services</option><option value="general">Gestion commerciale générale</option></select></div>
          </div>
          <div class="gmRegisterField gmFieldActivity">
            <label for="cActivity">ACTIVITÉ PRINCIPALE <span class="gmRequired">*</span></label>
            <div class="gmRegisterControl"><span class="gmRegisterIcon">${ggIcon('chart')}</span><input id="cActivity" name="activity" type="text" placeholder="EX/ Informatique, impression, services numériques et transfert d’argent" required></div>
          </div>
        </div>
      </section>

      <section class="gmRegisterSection gmRegisterSectionManager" aria-labelledby="gmRegisterManagerTitle">
        <h3 id="gmRegisterManagerTitle"><span class="gmRegisterSectionIcon" aria-hidden="true">${ggIcon('user')}</span><span>ID DU RESPONSABLE</span></h3>
        <div class="gmRegisterRow gmRegisterRowThree">
          <div class="gmRegisterField gmFieldOwner">
            <label for="cOwner">GÉRANT / RESPONSABLE <span class="gmRequired">*</span></label>
            <div class="gmRegisterControl"><span class="gmRegisterIcon">${ggIcon('user')}</span><input id="cOwner" name="owner" type="text" placeholder="EX/ Monsieur CESAR" autocomplete="name" required></div>
          </div>
          <div class="gmRegisterField gmFieldAddress">
            <label for="cAddress">ADRESSE <span class="gmRequired">*</span></label>
            <div class="gmRegisterControl"><span class="gmRegisterIcon">${ggIcon('location')}</span><input id="cAddress" name="address" type="text" placeholder="EX/ Diabo, Côte d’Ivoire" autocomplete="street-address" required></div>
          </div>
          <div class="gmRegisterField gmFieldPhone">
            <label for="cPhone">TÉLÉPHONE <span class="gmRequired">*</span></label>
            <div class="gmRegisterControl"><span class="gmRegisterIcon">${ggIcon('phone')}</span><input id="cPhone" name="phone" type="tel" placeholder="EX/ +225 XX XX XX XX XX" autocomplete="tel" inputmode="tel" required></div>
          </div>
        </div>
      </section>

      <section class="gmRegisterSection gmRegisterSectionCredentials" aria-labelledby="gmRegisterCredentialsTitle">
        <h3 id="gmRegisterCredentialsTitle"><span class="gmRegisterSectionIcon" aria-hidden="true">${ggIcon('lock')}</span><span>IDENTIFIANT DE CONNEXION</span></h3>
        <div class="gmRegisterRow gmRegisterRowTwo gmRegisterRowCredentials">
          <div class="gmRegisterField gmFieldEmail">
            <label for="cEmail">E-MAIL <span class="gmRequired">*</span></label>
            <div class="gmRegisterControl"><span class="gmRegisterIcon">${ggIcon('mail')}</span><input id="cEmail" name="email" type="email" placeholder="Email de connexion" autocomplete="email" inputmode="email" required></div>
          </div>
          <div class="gmRegisterField gmFieldPassword">
            <label for="cPass">MOT DE PASSE ADMIN <span class="gmRequired">*</span></label>
            <div class="gmRegisterControl gmRegisterPasswordControl"><span class="gmRegisterIcon">${ggIcon('lock')}</span><input id="cPass" name="password" type="password" minlength="10" placeholder="10 caractères minimum" title="Au moins 10 caractères avec majuscule, minuscule, chiffre et caractère spécial" autocomplete="new-password" required><button type="button" class="gmRegisterPasswordToggle" aria-label="Afficher le mot de passe" aria-pressed="false" onclick="toggleRegisterPassword(this)">${ggIcon('eye')}</button></div>
          </div>
        </div>
      </section>
    </div>
    <button id="registerSubmitBtn" type="button" class="fullBtn gmRegisterSubmit" onclick="registerCompany()"><span class="gmRegisterSubmitIcon" aria-hidden="true">${ggIcon('building')}</span><span class="gmRegisterButtonLabel">CRÉER MON ENTREPRISE</span></button>
  </div>
</div>
<div id="forgotPasswordModal" class="modal hidden">
  <div class="modalOverlay" onclick="closeForgotPasswordPopup()"></div>
  <div class="modalCard" role="dialog" aria-modal="true" aria-labelledby="forgotTitle">
    <button class="modalClose" aria-label="Fermer" onclick="closeForgotPasswordPopup()">×</button>
    <h2 id="forgotTitle">Mot de passe oublié</h2>
    <p class="sub">Cette demande est transmise à l’administrateur principal de votre entreprise. Le Super Admin n’est pas réinitialisable ici.</p>
    <div class="grid two">
      <label>Profil concerné<select id="fpRole"><option value="caisse">Caisse</option><option value="admin">Administrateur</option></select></label>
      <label>Email / Identifiant<input id="fpEmail" placeholder="votre email de connexion"></label>
      <label>Téléphone ou contact<input id="fpPhone" placeholder="contact pour vérification"></label>
      <label>Motif<input id="fpReason" placeholder="ex: mot de passe oublié"></label>
    </div>
    <button class="fullBtn" onclick="requestPasswordReset()">Envoyer la demande</button>
  </div>
</div>`;
  requestAnimationFrame(()=>document.querySelector('#loginEmail')?.focus());
}
function selectProfile(btn,role){
  document.querySelectorAll('.ggProfileCard').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});
  btn?.classList.add('active'); btn?.setAttribute('aria-pressed','true');
  const r=document.querySelector('#loginRole'); if(r) r.value=role;
  setLoginMessage('','');
}
function toggleLoginPassword(btn){
  const input=document.querySelector('#loginPass'); if(!input)return;
  const show=input.type==='password'; input.type=show?'text':'password';
  btn.setAttribute('aria-pressed',String(show)); btn.setAttribute('aria-label',show?'Masquer le mot de passe':'Afficher le mot de passe');
  btn.innerHTML=ggIcon(show?'eyeOff':'eye'); input.focus();
}
function setLoginMessage(message='',type='info'){
  const box=document.querySelector('#loginMessage'); if(!box)return;
  box.textContent=message; box.className='ggLoginMessage'+(message?' show '+type:'');
}
function setLoginLoading(active){
  const btn=document.querySelector('#loginSubmitBtn'); if(!btn)return;
  btn.disabled=!!active; btn.setAttribute('aria-busy',String(!!active));
  const label=btn.querySelector('.ggBtnLabel'); if(label)label.textContent=active?'CONNEXION EN COURS…':'SE CONNECTER';
  btn.classList.toggle('loading',!!active);
}
function openSupportWhatsApp(){
  const msg=encodeURIComponent('Bonjour MEGA SERVICES, j’ai besoin d’assistance pour GLOBAL MARKET.');
  window.open(GLOBAL_MARKET_LOGIN_LINKS.supportWhatsapp+'?text='+msg,'_blank','noopener,noreferrer');
}
/* fonction historique openGlobalShopLogin supprimée : version finale conservée */
let REGISTER_REQUEST_IN_PROGRESS=false;
function openRegisterPopup(){
  const modal=document.querySelector('#registerModal');
  if(!modal)return;
  if(!REGISTER_REQUEST_IN_PROGRESS)setRegisterLoading(false);
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('registerModalOpen');
  requestAnimationFrame(()=>document.querySelector('#cName')?.focus({preventScroll:true}));
}
function closeRegisterPopup(){
  const modal=document.querySelector('#registerModal');
  if(modal){
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
  }
  document.body.classList.remove('registerModalOpen');
  if(!REGISTER_REQUEST_IN_PROGRESS)setRegisterLoading(false);
  requestAnimationFrame(()=>document.querySelector('.ggRegisterBtn')?.focus({preventScroll:true}));
}
function toggleRegisterPassword(btn){
  const input=document.querySelector('#cPass');
  if(!input)return;
  const show=input.type==='password';
  input.type=show?'text':'password';
  btn?.setAttribute('aria-pressed',String(show));
  btn?.setAttribute('aria-label',show?'Masquer le mot de passe':'Afficher le mot de passe');
  if(btn)btn.innerHTML=ggIcon(show?'eyeOff':'eye');
  input.focus();
}
function setRegisterLoading(active){
  REGISTER_REQUEST_IN_PROGRESS=Boolean(active);
  const btn=document.querySelector('#registerSubmitBtn');
  const modal=document.querySelector('#registerModal .gmRegisterModalCard');
  if(modal)modal.setAttribute('aria-busy',String(REGISTER_REQUEST_IN_PROGRESS));
  if(!btn)return;
  btn.disabled=REGISTER_REQUEST_IN_PROGRESS;
  btn.setAttribute('aria-busy',String(REGISTER_REQUEST_IN_PROGRESS));
  btn.classList.toggle('is-loading',REGISTER_REQUEST_IN_PROGRESS);
  const label=btn.querySelector('.gmRegisterButtonLabel');
  if(label)label.textContent=REGISTER_REQUEST_IN_PROGRESS?'CRÉATION EN COURS…':'CRÉER MON ENTREPRISE';
}
function openForgotPasswordPopup(){document.querySelector('#forgotPasswordModal')?.classList.remove('hidden')}
function closeForgotPasswordPopup(){document.querySelector('#forgotPasswordModal')?.classList.add('hidden')}
function makeTempPassword(){const a=new Uint32Array(2);crypto.getRandomValues(a);return 'GG-'+a[0].toString(36).slice(0,5).toUpperCase()+'-'+String(100+(a[1]%900));}
/* fonction historique requestPasswordReset supprimée : version finale conservée */
function passwordResetRequestsBox(){
  const {d,company}=current();
  const rows=(d.passwordResetRequests||[]).filter(r=>r.companyId===company.id && r.role==='caisse').slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return `<div class="superTableWrap"><table class="g2table"><tr><th>Date</th><th>Utilisateur</th><th>Profil</th><th>Contact</th><th>Motif</th><th>Statut</th><th>Action</th></tr>${rows.map(r=>`<tr><td>${new Date(r.createdAt).toLocaleString('fr-FR')}</td><td>${esc(r.userName||r.email)}<br><small>${esc(r.email||'')}</small></td><td>${esc(r.role||'')}</td><td>${esc(r.phone||'')}</td><td>${esc(r.reason||'')}</td><td>${esc(r.status||'')}</td><td class="actionCell">${r.status==='pending'?`<button onclick="resetPasswordRequestByAdmin('${r.id}')">Générer mot de passe</button>`:'<span class="saleBadge">traité</span>'}</td></tr>`).join('')||'<tr><td colspan="7">Aucune demande de mot de passe oublié.</td></tr>'}</table></div>`;
}
/* fonction historique resetPasswordRequestByAdmin supprimée : version finale conservée */
/* fonction historique enforcePasswordChange supprimée : version finale conservée */

/* fonction historique login supprimée : version finale conservée */
/* fonction historique registerCompany supprimée : version finale conservée */
function renderExpired(c,st){app.innerHTML=`<div class="wrap"><div class="card" style="max-width:720px;margin:80px auto;text-align:center"><div class="brand">GLOBAL MARKET</div><h1>Abonnement ${esc(st)}</h1><p class="sub">L’accès de l’entreprise <b>${esc(c?.name)}</b> est actuellement ${esc(st)}. Contactez MEGA SERVICES DIABO pour renouveler ou réactiver l’abonnement.</p><p><b>+225 0777041790</b><br>megaservicediabo@gmail.com</p><button onclick="logout()">Retour connexion</button></div></div>`}
function render(){if(location.hash.startsWith('#boutique-global')) return renderGlobalShop(); if(location.hash.startsWith('#boutique/')) return renderPublicShop(location.hash.split('/')[1]||''); const {user,company}=current(); if(!user) return renderLogin(); if(user.role==='superadmin') return renderSuper(); const st=statusCompany(company); if(['expired','blocked','suspended'].includes(st)) return renderExpired(company,st); renderDash('home')}


function globalPrintHeaderHTML(company){
  const now=new Date();
  const year=getManageYear();
  const exercise=monthsList[getActiveMonth()]+' '+year;
  const safe=v=>esc(String(v||'—'));
  const printCompanyName=safe(company?.name||'Entreprise');
  return `<header class="g3ph">
    <div class="g3phTop">
      <div class="g3phBrand"><div class="g3phLogo">GM</div><b title="${printCompanyName}">${printCompanyName}</b></div>
      <div class="g3phCol"><div title="${safe(company?.name)}"><strong>Raison sociale :</strong> <span>${safe(company?.name)}</span></div><div title="${safe(company?.rccm)}"><strong>RCCM :</strong> <span>${safe(company?.rccm)}</span></div></div>
      <div class="g3phCol"><div title="${safe(company?.legalForm)}"><strong>Forme juridique :</strong> <span>${safe(company?.legalForm)}</span></div><div title="${safe(company?.phone)}"><strong>Téléphone :</strong> <span>${safe(company?.phone)}</span></div></div>
      <div class="g3phCol"><div title="${safe(company?.taxAccount)}"><strong>Compte contribuable :</strong> <span>${safe(company?.taxAccount)}</span></div><div title="${safe(company?.email)}"><strong>E-mail :</strong> <span>${safe(company?.email)}</span></div></div>
    </div>
    <div class="g3phMeta">
      <div class="g3phClock"><span class="g3phClockIcon">◷</span><span><b>Date : ${now.toLocaleDateString('fr-FR')}</b><b>Heure : ${now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</b></span></div>
      <div class="g3phBand"><div><strong>Adresse :</strong> ${safe(company?.address)}</div><div><strong>Année de gestion :</strong> ${year}</div><div><strong>Exercice actif :</strong> ${safe(exercise)}</div></div>
    </div>
  </header>`;
}
function globalPrintFooterHTML(company,label='Document'){
  const now=new Date();
  return `<footer class="g3pf"><span>▣ ${esc(label)} généré le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span><b>${esc(company?.name||'MEGA SERVICES SARL U')}</b><span class="g3pfPage">Page</span></footer>`;
}
function globalPrintThemeStyles(orientation='portrait'){
  return `
  .g3ph{width:100%;margin:0 0 5mm;background:#fff;color:#071f1f;break-inside:avoid;page-break-inside:avoid;font-family:Arial,Helvetica,sans-serif}
  .g3phTop{display:grid;grid-template-columns:29mm 1fr 1fr 1.22fr;align-items:stretch;min-height:21mm}
  .g3phBrand{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1mm 2mm 1.3mm 0}
  .g3phLogo{width:15mm;height:15mm;border:.65mm solid #006b68;border-radius:2.6mm;display:flex;align-items:center;justify-content:center;color:#006b68;font-size:7.4mm;line-height:1;font-weight:1000;letter-spacing:-.6mm;background:#fff}
  .g3phBrand>b{max-width:28mm;font-size:2mm;color:#006b68;margin-top:1.2mm;line-height:1.08;text-align:center;white-space:normal;overflow-wrap:anywhere;font-weight:1000}
  .g3phCol{border-left:.35mm solid #e4a91a;padding:2.3mm 3mm;display:grid;grid-template-rows:1fr 1fr;align-items:center;min-width:0}
  .g3phCol>div{font-size:2.72mm;line-height:1.12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;color:#0b1717}
  .g3phCol strong{font-weight:1000;color:#050b0b}.g3phCol span{font-weight:700}
  .g3phMeta{display:grid;grid-template-columns:39mm 1fr;align-items:stretch;margin-top:1.8mm}
  .g3phClock{min-height:12mm;background:#006a68;color:#fff;border-radius:3.8mm 0 0 3.8mm;display:flex;align-items:center;gap:2.2mm;padding:1.8mm 3mm;clip-path:polygon(0 0,91% 0,100% 50%,91% 100%,0 100%)}
  .g3phClockIcon{width:8mm;height:8mm;border:.65mm solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:5mm;line-height:1}
  .g3phClock span:last-child{display:grid;gap:.6mm}.g3phClock b{display:block;font-size:2.25mm;white-space:nowrap}
  .g3phBand{background:#ffc400;color:#050505;border-radius:0 6mm 6mm 0;display:grid;grid-template-columns:1fr 1fr 1.05fr;align-items:center;padding:2mm 4mm;gap:3mm}
  .g3phBand>div{font-size:2.9mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;font-weight:800}.g3phBand strong{font-weight:1000}
  .g3ph:after{content:"";display:block;height:.55mm;background:#006a68;margin-top:4mm}
  .g3pf{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:4mm;min-height:8.5mm;padding:1.7mm 3mm;background:#006a68;color:#fff;border-radius:2mm 2mm 0 0;font-size:2.25mm;font-weight:800;break-inside:avoid;page-break-inside:avoid}
  .g3pf b{text-align:center;font-size:2.5mm}.g3pf span:last-child{text-align:right}.g3pfPage:after{content:" " counter(page)}
  @media screen{.g3pf{display:none}}
  @media print{@page{size:A4 ${orientation};margin:0}.g3pf{display:grid!important;position:fixed;left:7mm;right:7mm;bottom:3mm;z-index:20}.g3ph{display:block!important}}
  `;
}
function printCompanyHeader(company){
  if(!company) return '';
  return `<div class="printCompanyHeader pdfModeleGlobal3">${globalPrintHeaderHTML(company)}</div>`;
}

function isEnterpriseAdmin(){const {user}=current(); return user && user.role==='admin'}
function isCaisse(){const {user}=current(); return user && user.role==='caisse'}
function requireAdmin(msg='Accès réservé à l’administrateur entreprise.'){if(!isEnterpriseAdmin()){alert(msg); return false} return true}
function menu(active){
  const {user,company}=current();
  const labels={home:'⌂ Accueil',vente:'☰ Ventes',rapports:'▣ Rapports',contrats:'▣ Clients',marketplace:'🛍 Marketplace',stocks:'📦 Stocks',mois:'📅 12 mois',param:'⚙ Paramètres'};
  const baseAdmin=['home','vente','rapports','contrats','stocks','mois','param'];
  const baseCaisse=['home','vente','rapports'];
  const allowed=user?.role==='admin'?[...baseAdmin,'marketplace']:baseCaisse;
  return allowed.map(x=>`<button class="${active===x?'active':''}" onclick="show('${x}')">${labels[x]}</button>`).join('')
}
function initFlexibleHorizontalMenu(){
  const nav=document.querySelector('.g2nav');
  if(!nav) return;
  const activeButton=nav.querySelector('button.active');
  if(activeButton){
    requestAnimationFrame(()=>activeButton.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}));
  }
  nav.addEventListener('wheel',event=>{
    if(nav.scrollWidth<=nav.clientWidth+2) return;
    if(Math.abs(event.deltaY)<=Math.abs(event.deltaX)) return;
    event.preventDefault();
    nav.scrollLeft+=event.deltaY;
  },{passive:false});
}
function shell(content,active='home'){
  const {user,company}=current();
  app.innerHTML=`<div class="g2app">
    <header class="g2topbar">
      <div class="g2brand"><div class="g2logo">GG</div><div><strong>GLOBAL MARKET</strong><span>MEGA SERVICES SARL U</span></div></div>
      <nav class="g2nav">${menu(active)}</nav>
      <div class="g2actions"><span class="pill">👤 ${esc(user.name||user.email)}</span>${user.role==='admin'?'<button class="accountLink" onclick="showAccountPage()">Mon compte</button>':''}<span class="pill light">${user.role==='admin'?'Administrateur':'Caisse'}</span><button onclick="logout()" class="logoutBtn">Déconnexion</button></div>
    </header>
    <main class="g2main ${active==='home'?'dashboardMain':''}">${printCompanyHeader(company)}<div class="companyLine"><b>${esc(company.name)}</b><span>${esc(planDef(company).label)} — fin : ${esc(company.subscriptionEnd)}</span></div>${content}${globalPrintFooterHTML(company,'Document')}</main>
    <div class="syncBadge">🔄 Synchronisé</div><footer class="g2footer">© 2026 GLOBAL MARKET - MEGA SERVICES SARL U. Tous droits réservés. <span class="buildVersion">Version ${esc(window.GLOBAL_MARKET_BUILD||'mise à jour')}</span></footer>
  </div>`
  setTimeout(initFlexibleHorizontalMenu,0);
  if(active==='stocks') setTimeout(()=>{toggleChargeField(); if(typeof initStockManager==='function') initStockManager();},0);
  if(active==='rapports') setTimeout(()=>{toggleServiceReportPeriodFields(false);applyServiceReportPeriodFilter();},0);
  if(active==='contrats') setTimeout(()=>{toggleContractPeriodFields(false);applyContractConsumptionFilter();},0);
  manageFreePlanReminder(active);
}

function show(sec){
  if(sec==='panier') return renderDash('rapports');
  if(sec==='marketplace') return showMarketplacePage();
  if(sec==='contrats'){const {company}=current(); if(!assertPlanFeature(company,'contracts','Clients sous contrat disponibles avec les plans Free et Business.')) return renderDash('home');}
  const {user}=current();
  const {company}=current(); const caisseAllowed=['home','vente','rapports'];
  if(user?.role==='caisse' && !caisseAllowed.includes(sec)){alert('Accès non autorisé pour le compte caisse.'); return renderDash('home')}
  renderDash(sec)
}
function accountNav(active='info'){
  return `<div class="accountNavBanner">
    <button class="${active==='info'?'active':''}" onclick="showAccountPage()">Modifier informations entreprise</button>
    <button class="${active==='subscription'?'active':''}" onclick="showSubscriptionPage()">Mon abonnement</button>
    <button class="${active==='users'?'active':''}" onclick="showAccountUsersPage()">Comptes utilisateurs</button>
  </div>`;
}
function showAccountPage(){
  const {user,company}=current();
  if(user?.role!=='admin') return alert('Accès Mon compte réservé à l’administrateur entreprise.');
  if(!company) return render();
  const admin=user.role==='admin';
  shell(`<section class="section active"><div class="g2panel accountPanel"><div class="accountHead"><div><h2><span></span> Mon compte</h2><p class="sub">Espace entreprise : informations, abonnement et comptes utilisateurs.</p></div></div>${accountNav('info')}
  <div class="formCard accountForm"><h3>INFORMATION DE L’ENTREPRISE</h3><div class="grid two">
    <label>Raison sociale<input id="accName" value="${esc(company.name||'')}" ${admin?'':'disabled'}></label>
    <label>Forme juridique<input id="accLegalForm" value="${esc(company.legalForm||'')}" placeholder="EX/ SARL U" ${admin?'':'disabled'}></label>
    <label>RCCM<input id="accRccm" value="${esc(company.rccm||'')}" placeholder="EX/ CI-BKE-2025-B-00000" ${admin?'':'disabled'}></label>
    <label>Compte Contribuable<input id="accTaxAccount" value="${esc(company.taxAccount||'')}" placeholder="EX/ 0000000 A" ${admin?'':'disabled'}></label>
    <label class="fullRow">Activité<input id="accActivity" value="${esc(company.activity||company.businessType||'')}" placeholder="EX/ Informatique, impression, services numériques et transfert d’argent" ${admin?'':'disabled'}></label>
    <label>Gérant<input id="accOwner" value="${esc(company.owner||'')}" ${admin?'':'disabled'}></label>
    <label>Adresse<input id="accAddress" value="${esc(company.address||'')}" placeholder="EX/ Diabo, Côte d’Ivoire" ${admin?'':'disabled'}></label>
    <label>Téléphone<input id="accPhone" value="${esc(company.phone||'')}" ${admin?'':'disabled'}></label>
    <label>E-mail<input id="accEmail" value="${esc(company.email||'')}" ${admin?'':'disabled'}></label>
    <label>Type de commerce<select id="accType" ${admin?'':'disabled'}><option value="boutique" ${(company.businessType||'')==='boutique'?'selected':''}>Vente de produits / Boutique</option><option value="service" ${(company.businessType||'')==='service'?'selected':''}>Vente de services</option></select></label>
  </div>${admin?'<button class="fullBtn" onclick="saveCompanyInfo()">Enregistrer les informations de l’entreprise</button>':'<p class="notice">Modification réservée à l’administrateur principal.</p>'}</div>
  </div></section>`,'account');
}
function showAccountUsersPage(){
  const {d,user,company}=current();
  if(user?.role!=='admin') return alert('Accès Mon compte réservé à l’administrateur entreprise.');
  if(!company) return render();
  const admin=user.role==='admin';
  const users=(d.users||[]).filter(u=>u.companyId===company.id);
  shell(`<section class="section active"><div class="g2panel accountPanel"><div class="accountHead"><div><h2><span></span> Mon compte</h2><p class="sub">Gestion des comptes utilisateurs rattachés à cette entreprise.</p></div></div>${accountNav('users')}
  <div class="formCard"><h3>COMPTES UTILISATEURS</h3><p class="notice">Plan ${esc(planDef(company).statut)} : limite ${userLimitLabel(company)} utilisateur(s).</p>${admin?`<div class="grid four compactGrid"><input id="accNewName" placeholder="Nom utilisateur"><input id="accNewEmail" placeholder="Email"><input id="accNewPass" type="password" minlength="6" autocomplete="new-password" placeholder="Mot de passe sécurisé"><select id="accNewRole" onchange="toggleNewCaisseHours('acc')"><option value="caisse">Caisse</option><option value="admin">Admin</option></select><span class="caisseHourFields accCaisseOnly"><input id="accNewStart" type="time" value="07:00" title="Heure début caisse"></span><span class="caisseHourFields accCaisseOnly"><input id="accNewEnd" type="time" value="22:00" title="Heure fin caisse"></span><button onclick="addAccountUser()">Ajouter utilisateur</button></div>`:''}${accountUsersTable(users,admin,user.id)}</div>
  </div></section>`,'account');
}
function saveCompanyInfo(){if(!requireAdmin()) return;const {d,company}=current(); const c=d.companies.find(x=>x.id===company.id); if(!c) return; c.name=$('#accName')?.value.trim()||c.name; c.legalForm=$('#accLegalForm')?.value.trim()||''; c.rccm=$('#accRccm')?.value.trim()||''; c.taxAccount=$('#accTaxAccount')?.value.trim()||''; c.activity=$('#accActivity')?.value.trim()||''; c.owner=$('#accOwner')?.value.trim()||''; c.address=$('#accAddress')?.value.trim()||''; c.phone=$('#accPhone')?.value.trim()||''; c.email=$('#accEmail')?.value.trim()||''; c.businessType=$('#accType')?.value||c.businessType; save(d); alert('Informations de l’entreprise mises à jour.'); showAccountPage();}
function accountUsersTable(users,admin,currentUserId){return `<div class="superTableWrap"><table class="g2table accountUsersTable"><tr><th>Nom</th><th>Email</th><th>Nouveau mot de passe</th><th>Rôle</th><th>Début caisse</th><th>Fin caisse</th><th>Statut</th><th>Action</th></tr>${users.map(u=>{const isCaisse=u.role==='caisse'; return `<tr><td><input id="auName_${u.id}" value="${esc(u.name||'')}" ${admin?'':'disabled'}></td><td><input id="auEmail_${u.id}" value="${esc(u.email||'')}" ${admin?'':'disabled'}></td><td><input id="auPass_${u.id}" type="password" minlength="6" autocomplete="new-password" placeholder="Laisser vide pour conserver" ${admin?'':'disabled'}></td><td><select id="auRole_${u.id}" onchange="toggleRowCaisseHours('${u.id}')" ${admin?'':'disabled'}><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option><option value="caisse" ${u.role==='caisse'?'selected':''}>Caisse</option></select></td><td class="caisseOnlyCell" id="auStartCell_${u.id}">${isCaisse?`<input id="auStart_${u.id}" type="time" value="${esc(caisseStartTime(u))}" ${admin?'':'disabled'}>`:''}</td><td class="caisseOnlyCell" id="auEndCell_${u.id}">${isCaisse?`<input id="auEnd_${u.id}" type="time" value="${esc(caisseEndTime(u))}" ${admin?'':'disabled'}>`:''}</td><td><select id="auStatus_${u.id}" ${admin?'':'disabled'}><option value="active" ${(u.status||'active')==='active'?'selected':''}>Actif</option><option value="blocked" ${u.status==='blocked'?'selected':''}>Bloqué</option></select></td><td class="actionCell">${admin?`<div class="rowActions"><button class="btn2" onclick="saveAccountUser('${u.id}')">Enregistrer</button>${u.id!==currentUserId?`<button class="danger" onclick="deleteAccountUser('${u.id}')">Supprimer</button>`:''}</div>`:'-'}</td></tr>`}).join('')||'<tr><td colspan="8">Aucun utilisateur enregistré.</td></tr>'}</table></div>`}
function toggleNewCaisseHours(prefix){const roleId=prefix==='acc'?'accNewRole':'uRole'; const role=$('#'+roleId)?.value||'caisse'; document.querySelectorAll('.'+prefix+'CaisseOnly').forEach(el=>{el.style.display=role==='caisse'?'':'none';});}
function toggleRowCaisseHours(uid){const role=$(`#auRole_${uid}`)?.value||'caisse'; const startCell=$(`#auStartCell_${uid}`), endCell=$(`#auEndCell_${uid}`); if(!startCell||!endCell) return; if(role==='caisse'){if(!startCell.querySelector('input')) startCell.innerHTML=`<input id="auStart_${uid}" type="time" value="07:00">`; if(!endCell.querySelector('input')) endCell.innerHTML=`<input id="auEnd_${uid}" type="time" value="22:00">`;}else{startCell.innerHTML=''; endCell.innerHTML='';}}
/* fonction historique saveAccountUser supprimée : version finale conservée */
/* fonction historique deleteAccountUser supprimée : version finale conservée */
/* fonction historique addAccountUser supprimée : version finale conservée */
function quickCard(label,icon,target,cls){return `<button class="quickCard ${cls||''}" onclick="show('${target}')"><span>${icon}</span><b>${label}</b></button>`}


function msDashboardQuickCard({tone='green',icon='•',title='',description='',metric='',action="show('home')",disabled=false}){
  const safeAction=disabled?"g3Alert('Accès réservé à l’administrateur de l’entreprise.','Accès limité','info')":action;
  return `<article class="msQuickCard msTone-${tone}">
    <div class="msQuickIcon" aria-hidden="true">${icon}</div>
    <div class="msQuickBody"><h3>${esc(title)}</h3><p>${esc(description)}</p></div>
    <div class="msQuickFooter"><span>${metric}</span><button type="button" onclick="${safeAction}">ACCÉDER <b>→</b></button></div>
  </article>`;
}
function msDashboardLastSevenDays(sales=[]){
  return Array.from({length:7},(_,index)=>{
    const date=new Date(); date.setHours(12,0,0,0); date.setDate(date.getDate()-(6-index));
    const key=date.toISOString().slice(0,10);
    const value=(sales||[]).filter(s=>String(s.date||'').slice(0,10)===key).reduce((sum,s)=>sum+Number(s.total||0),0);
    return {key,label:date.toLocaleDateString('fr-FR',{weekday:'short'}).replace('.',''),value};
  });
}
function msDashboardSalesChart(points=[]){
  const width=640,height=190,left=34,right=18,top=18,bottom=34;
  const plotW=width-left-right, plotH=height-top-bottom;
  const max=Math.max(1,...points.map(p=>Number(p.value||0)));
  const coords=points.map((p,i)=>({x:left+(points.length===1?plotW/2:(i*plotW/(points.length-1))),y:top+plotH-(Number(p.value||0)/max)*plotH,...p}));
  const line=coords.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area=`${left},${top+plotH} ${line} ${left+plotW},${top+plotH}`;
  const grid=[0,.25,.5,.75,1].map(r=>`<line x1="${left}" y1="${(top+plotH-r*plotH).toFixed(1)}" x2="${left+plotW}" y2="${(top+plotH-r*plotH).toFixed(1)}"/>`).join('');
  const labels=coords.map(p=>`<text x="${p.x}" y="${height-9}" text-anchor="middle">${esc(p.label)}</text>`).join('');
  const dots=coords.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4"><title>${money(p.value)}</title></circle>`).join('');
  return `<svg class="msSalesChart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Évolution des ventes sur les sept derniers jours"><g class="msChartGrid">${grid}</g><polygon class="msChartArea" points="${area}"/><polyline class="msChartLine" points="${line}"/>${dots}<g class="msChartLabels">${labels}</g></svg>`;
}
function msDashboardMiniStat(icon,value,label,tone='green'){
  return `<div class="msMiniStat msMini-${tone}"><span>${icon}</span><div><strong>${value}</strong><small>${esc(label)}</small></div></div>`;
}



function saleRegisterKind(i){
  const raw=String(i?.type||i?.kind||'').toLowerCase().trim();
  if(['service','services','prestation'].includes(raw)) return 'service';
  if(['boutique','produit','product','stock','article'].includes(raw)) return 'boutique';
  const st=String(i?.stockType||'').toLowerCase().trim();
  if(['none','service','prestation'].includes(st)) return 'service';
  try{ if(i?.cat && categoryKind(i.cat)==='service') return 'service'; }catch(e){}
  return isBoutiqueItem(i)?'boutique':'service';
}
function saleRegisterStockQty(i){
  if(String(i?.stockType||'limited').toLowerCase()==='unlimited') return Infinity;
  const keys=['stock','stockAvailable','stockDisponible','stockQty','quantity','qty','qte','quantite'];
  for(const k of keys){
    if(Object.prototype.hasOwnProperty.call(i||{},k)){
      const n=Number(i[k]);
      if(Number.isFinite(n)) return n;
    }
  }
  return Number(i?.stock||0)||0;
}
function setSaleRegisterStockQty(i,val){
  const n=Math.max(0,Number(val)||0);
  const keys=['stock','stockAvailable','stockDisponible','stockQty','quantity','qty','qte','quantite'];
  let done=false;
  for(const k of keys){
    if(Object.prototype.hasOwnProperty.call(i||{},k)){ i[k]=n; done=true; break; }
  }
  if(!done) i.stock=n;
}
function saleRegisterItemVisible(i){
  if(!i) return false;
  const kind=saleRegisterKind(i);
  if(kind==='service') return true;
  if(String(i?.stockType||'limited').toLowerCase()==='unlimited') return true;
  return saleRegisterStockQty(i)>0;
}


function isSaleCartPending(s){
  const st=String(s?.saleStatus||s?.status||'').toLowerCase();
  return st==='cart' || st==='panier' || s?.cartPending===true;
}
function isSaleValidated(s){
  const st=String(s?.saleStatus||s?.status||'').toLowerCase();
  if(st==='cart'||st==='panier'||s?.cartPending===true) return false;
  return st==='validated'||st==='validée'||st==='validee'||st==='valid' || !st;
}
function getCompanySalesRaw(){
  const {d,company}=current();
  return (d.sales||[]).filter(s=>s.companyId===company.id);
}
function getCompanyValidatedSales(){ return getCompanySalesRaw().filter(isSaleValidated); }
function getCompanyCartSales(){ const {user}=current(); return getCompanySalesRaw().filter(s=>isSaleCartPending(s)&&(user?.role!=='caisse'||!s.userId||s.userId===user.id)); }
function selectedSaleIds(scope){
  const cls=scope==='report'?'.reportSaleCheck':'.cartSaleCheck';
  return Array.from(document.querySelectorAll(cls+':checked')).map(x=>x.value).filter(Boolean);
}
function toggleAllSaleChecks(scope,checked){
  const cls=scope==='report'?'.reportSaleCheck':'.cartSaleCheck';
  document.querySelectorAll(cls).forEach(x=>{ if(x.closest('tr')?.style.display!=='none') x.checked=!!checked; });
}
function bulkSaleInvoiceHTML(company,rows,title){
  rows=rows||[];
  const total=rows.reduce((a,b)=>a+Number(b.total||0),0);
  const fee=rows.reduce((a,b)=>a+Number(b.serviceFee||0),0);
  const qty=rows.reduce((a,b)=>a+Number(b.qty||0),0);
  const ref='FAC-'+today().replaceAll('-','')+'-'+randomPart(5);
  const client=[...new Set(rows.map(s=>String(s.client||'Non précisé')).filter(Boolean))].join(' / ')||'Non précisé';
  const body=rows.map((s,i)=>`<tr><td>${i+1}</td><td>${new Date(s.date||Date.now()).toLocaleString('fr-FR')}</td><td>${esc(s.name||'')}</td><td>${esc(s.detail||s.note||'')}</td><td>${Number(s.qty||1)}</td><td>${money(s.unit||0)}</td><td>${money(s.serviceFee||0)}</td><td>${money(s.total||0)}</td></tr>`).join('');
  return `<div class="reportBox premiumInvoice bulkSaleInvoice"><h1>${esc(title||'FACTURE DES VENTES SÉLECTIONNÉES')}</h1><h3>${esc(company?.name||'GLOBAL MARKET')} — Référence : ${esc(ref)}</h3><div class="ficheInfoGrid"><div><b>Client :</b> ${esc(client)}</div><div><b>Date :</b> ${new Date().toLocaleString('fr-FR')}</div><div><b>Nombre de lignes :</b> ${rows.length}</div><div><b>Quantité totale :</b> ${qty}</div></div><table class="g2table"><thead><tr><th>N°</th><th>Date</th><th>Désignation</th><th>Note / Détail</th><th>Qté</th><th>Prix U.</th><th>Frais</th><th>Total</th></tr></thead><tbody>${body||'<tr><td colspan="8">Aucune ligne sélectionnée.</td></tr>'}<tr class="total"><td colspan="6">TOTAL FRAIS</td><td>${money(fee)}</td><td></td></tr><tr class="total"><td colspan="7">NET À PAYER</td><td>${money(total)}</td></tr></tbody></table><div class="signatureZone"><span>Signature client</span><span>Cachet / Signature entreprise</span></div></div>`;
}
function openSelectedSalesInvoice(scope){
  const ids=selectedSaleIds(scope);
  if(!ids.length) return g3Alert('Veuillez sélectionner au moins une ligne.','Sélection obligatoire','info');
  const {d,company}=current();
  const rows=(d.sales||[]).filter(s=>s.companyId===company.id && ids.includes(String(s.id)) && (scope==='cart'?isSaleCartPending(s):isSaleValidated(s)));
  if(!rows.length) return g3Alert('Aucune ligne valide sélectionnée.','Facture impossible','info');
  const back=scope==='cart'?'panier':'rapports';
  const title=scope==='cart'?'FACTURE PROFORMA / PANIER SÉLECTIONNÉ':'FACTURE DES VENTES SÉLECTIONNÉES';
  shell(`<div class="g2panel printable"><div class="reportActions no-print"><button onclick="renderDash('${back}')">Retour</button><button onclick="window.print()">Imprimer / PDF</button></div>${bulkSaleInvoiceHTML(company,rows,title)}</div>`,back);
}
async function bulkDeleteSelectedCartSales(){
  const ids=selectedSaleIds('cart');
  if(!ids.length) return g3Alert('Veuillez sélectionner au moins une ligne du panier.','Sélection obligatoire','info');
  if(!(await g3Confirm('Retirer les lignes sélectionnées du panier ?','Suppression multiple panier'))) return;
  const {d,company}=current();
  d.sales=(d.sales||[]).filter(s=>!(s.companyId===company.id && ids.includes(String(s.id)) && isSaleCartPending(s)));
  save(d); renderDash('panier');
}
async function bulkDeleteSelectedReportSales(){
  if(!requireAdmin('La caisse ne peut pas supprimer plusieurs ventes dans l’historique général.')) return;
  const ids=selectedSaleIds('report');
  if(!ids.length) return g3Alert('Veuillez sélectionner au moins une vente du rapport.','Sélection obligatoire','info');
  const {d,company}=current();
  const selected=(d.sales||[]).filter(s=>s.companyId===company.id && ids.includes(String(s.id)) && isSaleValidated(s));
  if(selected.some(isSaleExerciseLocked)) return g3Alert('Une ou plusieurs ventes sélectionnées appartiennent à un exercice verrouillé ou clôturé.','Suppression impossible','danger');
  if(!(await g3Confirm('Supprimer définitivement les ventes sélectionnées du rapport ?','Suppression multiple rapport'))) return;
  d.sales=(d.sales||[]).filter(s=>!(s.companyId===company.id && ids.includes(String(s.id)) && isSaleValidated(s)));
  save(d); renderDash('rapports');
}

function saleCartMetaDefault(){return {clientType:'particulier',clientName:'',phone:'',address:'',contractClientId:''}}
function getSaleCartMeta(d,cid){
  d.saleCartMeta=d.saleCartMeta&&typeof d.saleCartMeta==='object'?d.saleCartMeta:{};
  const currentMeta=d.saleCartMeta[cid]&&typeof d.saleCartMeta[cid]==='object'?d.saleCartMeta[cid]:{};
  d.saleCartMeta[cid]=Object.assign(saleCartMetaDefault(),currentMeta);
  return d.saleCartMeta[cid];
}
function saleCartClientLabel(meta,clients=[]){
  if(meta?.clientType==='contrat'){
    const c=(clients||[]).find(x=>x.id===meta.contractClientId);
    return c?[c.name,c.phone,c.address].filter(Boolean).join(' / '):'';
  }
  return [meta?.clientName,meta?.phone,meta?.address].map(v=>String(v||'').trim()).filter(Boolean).join(' / ');
}
function captureSaleCartClient(persist=false){
  const {d,company}=current(); if(!company) return saleCartMetaDefault();
  const meta=getSaleCartMeta(d,company.id);
  const type=$('#saleCartClientType')?.value;
  if(type) meta.clientType=type==='contrat'?'contrat':'particulier';
  const name=$('#saleCartClientName'); if(name) meta.clientName=String(name.value||'').trim();
  const phone=$('#saleCartClientPhone'); if(phone) meta.phone=String(phone.value||'').trim();
  const address=$('#saleCartClientAddress'); if(address) meta.address=String(address.value||'').trim();
  const contract=$('#saleCartContractClient'); if(contract) meta.contractClientId=String(contract.value||'');
  if(persist) save(d);
  return meta;
}
function toggleSaleCartClientFields(){
  const type=$('#saleCartClientType')?.value||'particulier';
  $('#saleCartSimpleFields')?.classList.toggle('hidden',type==='contrat');
  $('#saleCartContractFields')?.classList.toggle('hidden',type!=='contrat');
  captureSaleCartClient(false);
}
function saleProfessionalCart(cartSales,clients=[]){
  const {d,company}=current();
  const meta=getSaleCartMeta(d,company.id);
  const rows=(cartSales||[]).slice().sort((a,b)=>new Date(a.cartCreatedAt||a.date)-new Date(b.cartCreatedAt||b.date));
  const total=rows.reduce((a,b)=>a+Number(b.total||0),0);
  const qty=rows.reduce((a,b)=>a+Number(b.qty||0),0);
  const served=rows.reduce((a,b)=>a+saleClientsServedValue(b),0);
  const lineHtml=rows.map((s,index)=>{
    const product=String(s.saleKind||'')==='boutique';
    return `<article class="saleProCartLine saleProCartLineClickable" role="button" tabindex="0" aria-label="Modifier ${esc(s.name||'cet article')}" title="Cliquer pour modifier avant l’encaissement" onclick="openPendingCartLineFromClick(event,'${esc(s.id)}')" onkeydown="openPendingCartLineFromKey(event,'${esc(s.id)}')">
      <div class="saleProCartLineHead"><span class="saleProCartLineIcon ${product?'product':'service'}">${product?'📦':'🧾'}</span><div><b>${esc(s.name||'Article')}</b><small>${esc(s.itemCode||s.category||'')} • ${product?'Produit':'Service'}</small></div><button type="button" class="saleProCartRemove" aria-label="Retirer du panier" onclick="event.stopPropagation();removePendingCartLine('${esc(s.id)}')">×</button></div>
      <div class="saleProCartLineBody">
        <div class="saleProQty" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()"><button type="button" aria-label="Réduire la quantité" onclick="adjustPendingCartLine('${esc(s.id)}',-1)">−</button><input type="number" min="1" value="${Number(s.qty||1)}" aria-label="Quantité de ${esc(s.name||'l’article')}" onchange="setPendingCartLineQty('${esc(s.id)}',this.value)"><button type="button" aria-label="Augmenter la quantité" onclick="adjustPendingCartLine('${esc(s.id)}',1)">+</button></div>
        <span class="saleProServed">${saleClientsServedValue(s)} client(s) servi(s)</span>
      </div>
      <div class="saleProCartLineFoot"><span>${money(s.unit||0)} / unité</span><strong>${money(s.total||0)}</strong></div>
      <div class="saleProCartEditHint"><span>✎</span> Cliquer pour modifier</div>
    </article>`;
  }).join('');
  return `<aside id="saleProfessionalCart" class="saleProCartPanel">
    <div class="saleProCartHeader"><div><span>PANIER</span><h3>Commande en préparation</h3></div><b>${rows.length}</b></div>
    <div class="saleProCartClient">
      <div class="saleProCartClientTitle"><span>👤</span><div><b>CLIENT À ENCAISSER</b><small>Le client est choisi ici avant validation.</small></div></div>
      <select id="saleCartClientType" onchange="toggleSaleCartClientFields();captureSaleCartClient(true)"><option value="particulier" ${meta.clientType!=='contrat'?'selected':''}>Client particulier</option><option value="contrat" ${meta.clientType==='contrat'?'selected':''}>Client sous contrat</option></select>
      <div id="saleCartSimpleFields" class="saleProCartClientFields ${meta.clientType==='contrat'?'hidden':''}"><input id="saleCartClientName" value="${esc(meta.clientName||'')}" placeholder="Nom du client *" onchange="captureSaleCartClient(true)"><input id="saleCartClientPhone" value="${esc(meta.phone||'')}" placeholder="Téléphone" onchange="captureSaleCartClient(true)"><input id="saleCartClientAddress" value="${esc(meta.address||'')}" placeholder="Adresse" onchange="captureSaleCartClient(true)"></div>
      <div id="saleCartContractFields" class="saleProCartContractFields ${meta.clientType==='contrat'?'':'hidden'}"><select id="saleCartContractClient" onchange="captureSaleCartClient(true)"><option value="">Choisir un client sous contrat *</option>${(clients||[]).map(c=>`<option value="${esc(c.id)}" ${meta.contractClientId===c.id?'selected':''}>${esc(c.name)} — ${esc(c.phone||'')}</option>`).join('')}</select><button type="button" class="btn2" onclick="openClientContractPopup()">+ Nouveau client</button></div>
    </div>
    <div class="saleProCartList">${lineHtml||'<div class="saleProCartEmpty"><span>🛒</span><b>Votre panier est vide</b><p>Sélectionnez un produit ou un service pour préparer l’encaissement.</p></div>'}</div>
    <div class="saleProCartSummary"><div><span>Articles / services</span><b>${qty}</b></div><div><span>Clients servis</span><b>${served}</b></div><div class="saleProCartGrandTotal"><span>TOTAL À ENCAISSER</span><strong>${money(total)}</strong></div></div>
    <div class="saleProCartActions"><button type="button" class="saleProCartClear" onclick="emptyCart()" ${rows.length?'':'disabled'}>Vider</button><button id="saleCartCheckoutBtn" type="button" class="saleProCartCheckout" onclick="validateCart()" ${rows.length?'':'disabled'}><span>💳</span> ENCAISSER ET VALIDER →</button></div>
  </aside>`;
}
function pendingCartLineInteractiveTarget(target){
  return Boolean(target?.closest?.('button,input,select,textarea,a,label'));
}
function openPendingCartLineFromClick(event,sid){
  if(pendingCartLineInteractiveTarget(event?.target)) return;
  captureSaleCartClient(false);
  openEditCartLine(sid);
}
function openPendingCartLineFromKey(event,sid){
  if(!event || (event.key!=='Enter' && event.key!==' ')) return;
  if(pendingCartLineInteractiveTarget(event.target)) return;
  event.preventDefault();
  captureSaleCartClient(false);
  openEditCartLine(sid);
}

function recalcPendingCartLine(s,item){
  const qty=Math.max(1,Math.floor(Number(s.qty||1)));
  s.qty=qty;
  if(String(s.saleKind||'')==='boutique'){
    s.unit=Number(item?.sell??s.unit??0);
    s.total=s.unit*qty;
    s.charges=Number(item?.buy||0)*qty;
  }else{
    s.total=Math.max(0,Number(s.serviceBasePrice||0)+Number(s.serviceFee||0)) || Number(s.total||0);
    s.unit=qty?s.total/qty:0;
    s.charges=Number(s.serviceBasePrice||0)*(Number(item?.charge||0)/100);
  }
  s.profit=Number(s.total||0)-Number(s.charges||0);
}
function setPendingCartLineQty(sid,value){
  captureSaleCartClient(false);
  const {d,company}=current();
  const s=(d.sales||[]).find(x=>x.companyId===company.id&&x.id===sid&&isSaleCartPending(x));
  if(!s) return g3Alert('Article du panier introuvable.','Panier','info');
  const item=(d.items||[]).find(i=>i.companyId===company.id&&i.id===s.itemId);
  const qty=Math.max(1,Math.floor(Number(value||1)));
  if(String(s.saleKind||'')==='boutique'&&item&&String(item.stockType||'limited').toLowerCase()!=='unlimited'){
    const others=getCompanyCartSales().filter(x=>x.id!==s.id&&x.itemId===s.itemId).reduce((a,b)=>a+Number(b.qty||0),0);
    if(others+qty>saleRegisterStockQty(item)) return g3Alert('La quantité totale du panier dépasse le stock disponible.','Stock insuffisant','danger');
  }
  s.qty=qty; recalcPendingCartLine(s,item); save(d); renderDash('vente');
}
function adjustPendingCartLine(sid,delta){
  const {d,company}=current(); const s=(d.sales||[]).find(x=>x.companyId===company.id&&x.id===sid&&isSaleCartPending(x));
  if(!s) return; setPendingCartLineQty(sid,Math.max(1,Number(s.qty||1)+Number(delta||0)));
}
async function removePendingCartLine(sid){
  if(!(await g3Confirm('Retirer cet article du panier ?','Panier'))) return;
  captureSaleCartClient(false);
  const {d,company}=current();
  d.sales=(d.sales||[]).filter(s=>!(s.companyId===company.id&&s.id===sid&&isSaleCartPending(s)));
  save(d); renderDash('vente');
}

function saleCashRegisterSection(items,clients,cartSales=[]){
  const rows=(items||[]).filter(saleRegisterItemVisible);
  const cats=[...new Set(rows.map(i=>i.cat).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'fr'));
  const productCount=rows.filter(i=>saleRegisterKind(i)==='boutique').length, serviceCount=rows.length-productCount;
  const ticketTotal=(cartSales||[]).reduce((a,b)=>a+Number(b.total||0),0);
  const ticketQty=(cartSales||[]).reduce((a,b)=>a+Number(b.qty||0),0);
  return `<div class="salePosShell">
    <div class="salePosHero">
      <div>
        <span class="salePosKicker">GLOBAL MARKET • Caisse enregistreuse</span>
        <h2>Vente rapide produits & services</h2>
        <p>Sélectionnez les articles, préparez la commande dans le panier, choisissez le client puis encaissez en une seule validation.</p>
      </div>
      <div class="salePosTicketMini" onclick="document.getElementById('saleProfessionalCart')?.scrollIntoView({behavior:'smooth',block:'start'})" title="Voir le panier">
        <small>Panier actuel</small>
        <b>${money(ticketTotal)}</b>
        <span>${ticketQty} article(s)</span>
      </div>
    </div>
    <div class="salePosWorkspace">
      <div class="saleCatalogPane">
        <div class="salePosStats">
          <div><b>${productCount}</b><span>Produits disponibles</span></div>
          <div><b>${serviceCount}</b><span>Services</span></div>
          <div><b>${rows.length}</b><span>Cartes actives</span></div>
          <button type="button" onclick="document.getElementById('saleProfessionalCart')?.scrollIntoView({behavior:'smooth',block:'start'})">🛒 Voir le panier (${cartSales.length})</button>
        </div>
        <div class="salePosFilterBar">
          <input id="salePosSearch" placeholder="Rechercher produit, service, catégorie, code..." oninput="filterSalePosCards()">
          <select id="salePosCat" onchange="filterSalePosCards()"><option value="">Toutes catégories</option>${cats.map(c=>`<option value="${esc(String(c).toLowerCase())}">${esc(c)}</option>`).join('')}</select>
          <select id="salePosType" onchange="filterSalePosCards()"><option value="">Produits et services</option><option value="produit">Produits</option><option value="service">Services</option></select>
        </div>
        <div class="salePosGrid" id="salePosGrid">
          ${rows.map(salePosCard).join('')||'<div class="salePosEmpty">Aucun produit ou service disponible. Ajoutez d’abord des éléments dans la section Stocks.</div>'}
        </div>
      </div>
      ${saleProfessionalCart(cartSales,clients)}
    </div>
    <div id="clientContractModal" class="modal hidden"><div class="modalOverlay" onclick="closeClientContractPopup()"></div><div class="modalCard"><button class="modalClose" onclick="closeClientContractPopup()">×</button><h2>Fiche d’enregistrement client sous contrat</h2><p class="sub">Enregistrer un nouveau client sous contrat sans quitter la vente.</p><div class="grid two"><input id="ccNamePopup" placeholder="Nom du client contrat"><input id="ccPhonePopup" placeholder="Téléphone"><select id="ccModePopup"><option value="Mensuelle">Mensuelle</option><option value="Trimestriel">Trimestriel</option></select><input id="ccRemisePopup" type="number" value="0" placeholder="Remise %"><input id="ccObsPopup" class="fullRow" placeholder="Observation"></div><button class="fullBtn" onclick="addContractClientFromSale()">Enregistrer le client contrat</button></div></div>
  </div>`;
}
function salePosCard(i){
  const product=saleRegisterKind(i)==='boutique', kind=product?'boutique':'service';
  const available=product?saleRegisterStockQty(i):0;
  const st=product?(String(i.stockType||'limited').toLowerCase()==='unlimited'?'Stock illimité':Number(available||0)+' en stock'):'Prestation';
  const price=product?money(i.sell||0):(Number(i.sell||0)>0?money(i.sell||0):'Prix à saisir');
  const icon=product?'📦':'🧾';
  const img=i.photo?`<img src="${esc(i.photo)}" alt="${esc(i.name||'Article')}">`:`<span>${icon}</span>`;
  const search=String([i.name,i.cat,i.code,i.detail,kind,price,st].join(' ')).toLowerCase();
  return `<button type="button" class="salePosCard ${product?'product':'service'}" data-search="${esc(search)}" data-cat="${esc(String(i.cat||'').toLowerCase())}" data-type="${product?'produit':'service'}" onclick="openSaleCartPopup('${esc(i.id)}','${kind}')">
    <span class="salePosCardType">${product?'PRODUIT':'SERVICE'}</span>
    <div class="salePosImg">${img}</div>
    <div class="salePosInfo"><b>${esc(i.name||'Sans nom')}</b><small>${esc(i.code||'-')} • ${esc(i.cat||'Sans catégorie')}</small><em>${esc(i.detail||i.marketplaceDesc||'')}</em></div>
    <div class="salePosBottom"><strong>${price}</strong><span>${esc(st)}</span></div>
  </button>`;
}
function filterSalePosCards(){
  const q=String($('#salePosSearch')?.value||'').trim().toLowerCase();
  const cat=String($('#salePosCat')?.value||'').trim().toLowerCase();
  const type=String($('#salePosType')?.value||'').trim().toLowerCase();
  let visible=0;
  document.querySelectorAll('.salePosCard').forEach(card=>{
    const ok=(!q || String(card.dataset.search||'').includes(q)) && (!cat || card.dataset.cat===cat) && (!type || card.dataset.type===type);
    card.style.display=ok?'':'none'; if(ok) visible++;
  });
  const empty=document.querySelector('.salePosDynamicEmpty');
  if(empty) empty.remove();
  const grid=$('#salePosGrid');
  if(grid && !visible && document.querySelectorAll('.salePosCard').length){
    grid.insertAdjacentHTML('beforeend','<div class="salePosDynamicEmpty">Aucun résultat pour ce filtre.</div>');
  }
}

function renderDash(sec='home'){
  if(sec==='panier') sec='vente';
  const {d,user,company}=current(), cid=company.id;
  const items=d.items.filter(i=>i.companyId===cid), allSales=(d.sales||[]).filter(s=>s.companyId===cid), sales=allSales.filter(isSaleValidated), users=d.users.filter(u=>u.companyId===cid), clients=(d.clients||[]).filter(c=>c.companyId===cid), obligations=getObligations(d,cid);
  const manageYear=getManageYear(), activeMonth=getActiveMonth();
  const yearSales=sales.filter(isInManageYear), exerciseSales=sales.filter(isInActiveExercise);
  const cartSales=allSales.filter(isSaleCartPending);
  const clientNames=[...new Set(yearSales.map(s=>s.client).filter(Boolean))];
  const ca=yearSales.reduce((a,b)=>a+b.total,0), charges=yearSales.reduce((a,b)=>a+(b.charges||0),0), profit=yearSales.reduce((a,b)=>a+b.profit,0);
  const exerciseCa=exerciseSales.reduce((a,b)=>a+Number(b.total||0),0), exerciseCharges=exerciseSales.reduce((a,b)=>a+Number(b.charges||0),0), exerciseProfit=exerciseSales.reduce((a,b)=>a+Number(b.profit||0),0);
  const todaySales=sales.filter(s=>String(s.date||'').slice(0,10)===today());
  const caDay=todaySales.reduce((a,b)=>a+b.total,0), profitDay=todaySales.reduce((a,b)=>a+b.profit,0);
  const todayQty=todaySales.reduce((a,b)=>a+Number(b.qty||0),0);
  const newClientsToday=clients.filter(c=>String(c.createdAt||c.date||'').slice(0,10)===today()).length;
  const marketOrders=(d.orders||[]).filter(o=>o.companyId===cid);
  const productItems=items.filter(i=>{try{return isBoutiqueItem(i)}catch(e){return String(i.type||'').toLowerCase()!=='service'}});
  const sevenDayPoints=msDashboardLastSevenDays(sales);
  const admin=user.role==='admin';
  if(!admin && ['stocks','mois','param'].includes(sec)) sec='home';
  shell(`<section id="home" class="section ${sec==='home'?'active':''}">
    <div class="msDashboard">
      <header class="msDashboardHeader">
        <div class="msDashboardBrand">
          <div class="msDashboardLogo" aria-hidden="true">GM</div>
          <div><h1>GLOBAL MARKET</h1><p>Votre plateforme de gestion complète</p><small class="msDashboardCompanyName">Espace entreprise : ${esc(company.name||'Entreprise')}</small></div>
        </div>
        <div class="msDashboardHeaderRight">
          <div class="msPlanCard"><span>${esc(planDef(company).label)}</span><b>Fin : ${new Date((company.subscriptionEnd||today())+'T12:00:00').toLocaleDateString('fr-FR')}</b></div>
          <div class="msHeaderIcons">
            <button type="button" aria-label="Notifications" onclick="g3Alert('Aucune nouvelle notification pour le moment.','Notifications','info')">🔔</button>
            <button type="button" aria-label="Aide" onclick="g3Alert('Consultez les différentes sections ou contactez le support GLOBAL MARKET.','Centre d’aide','info')">?</button>
          </div>
          <div class="msProfileCard"><span class="msProfileAvatar">${esc(String(user.name||'A').trim().charAt(0).toUpperCase()||'A')}</span><div><strong>${esc(user.name||'Admin')}</strong><small>${admin?'Super administrateur':'Utilisateur caisse'}</small></div></div>
          ${admin?'<button type="button" class="msCustomizeBtn" onclick="showAccountPage()">Personnaliser</button>':''}
        </div>
      </header>

      <section class="msDashboardPanel msQuickAccessPanel">
        <div class="msSectionTitle"><span></span><div><h2>ACCÈS RAPIDE</h2><p>Accédez immédiatement aux principales fonctions de gestion.</p></div></div>
        <div class="msQuickGrid">
          ${msDashboardQuickCard({tone:'green',icon:'🛒',title:'Nouvelle commande',description:'Créer et enregistrer une nouvelle commande rapidement',metric:`${todaySales.length} Aujourd’hui`,action:"show('vente')"})}
          ${msDashboardQuickCard({tone:'gold',icon:'▤',title:'Rapport général',description:'Consulter les rapports généraux et analyses d’activité',metric:'12 Rapports',action:"show('rapports')"})}
          ${msDashboardQuickCard({tone:'lime',icon:'👥',title:'Clients contrat',description:'Gérer les clients sous contrat et suivre leurs informations',metric:`${clients.length} Clients actifs`,action:"show('contrats')"})}
          ${msDashboardQuickCard({tone:'forest',icon:'🛍',title:'Marketplace',description:'Gérer la boutique, les commandes et les produits clients',metric:`${marketOrders.length} Commandes`,action:"show('marketplace')",disabled:!admin})}
          ${msDashboardQuickCard({tone:'purple',icon:'⚙',title:'Paramètres',description:'Configurer les paramètres système et les préférences de l’application',metric:'15 Configurations',action:"show('param')",disabled:!admin})}
          ${msDashboardQuickCard({tone:'green',icon:'📦',title:company.businessType==='service'?'Stock services':'Stock boutique',description:'Gérer les produits, les stocks et les mouvements de la boutique',metric:`${productItems.length} Produits`,action:"show('stocks')",disabled:!admin})}
          ${msDashboardQuickCard({tone:'gold',icon:'📅',title:'Gestion 12 mois',description:'Suivre et analyser la gestion sur une période de 12 mois',metric:'En cours — Période active',action:"show('mois')",disabled:!admin})}
          ${msDashboardQuickCard({tone:'blue',icon:'👤',title:'Utilisateurs',description:'Gérer les utilisateurs, les rôles et les droits d’accès',metric:`${users.length} Utilisateurs`,action:'showAccountUsersPage()',disabled:!admin})}
        </div>
      </section>

      <section class="msDashboardLowerGrid">
        <article class="msDashboardPanel msSummaryBlock">
          <div class="msBlockHead"><h2>RÉSUMÉ DU JOUR</h2><button type="button" onclick="show('rapports')">Voir détails</button></div>
          <div class="msMiniGrid">
            ${msDashboardMiniStat('🛒',todaySales.length,'Commandes','green')}
            ${msDashboardMiniStat('₣',money(caDay),'Total ventes','gold')}
            ${msDashboardMiniStat('📦',todayQty,'Articles vendus','purple')}
            ${msDashboardMiniStat('👥',newClientsToday,'Nouveaux clients','blue')}
          </div>
          <div class="msRecentActivity"><h3>Activités récentes</h3>
            <div><span class="msDot green"></span>${todaySales.length?`${todaySales.length} commande(s) enregistrée(s) aujourd’hui`:'Aucune commande enregistrée aujourd’hui'}</div>
            <div><span class="msDot gold"></span>${caDay?`${money(caDay)} de ventes enregistrées aujourd’hui`:'Aucune vente enregistrée aujourd’hui'}</div>
            <div><span class="msDot purple"></span>${todayQty?`${todayQty} article(s) vendu(s) aujourd’hui`:'Aucun article vendu aujourd’hui'}</div>
            <div><span class="msDot blue"></span>${newClientsToday?`${newClientsToday} nouveau(x) client(s) aujourd’hui`:'Aucun nouveau client aujourd’hui'}</div>
          </div>
        </article>

        <article class="msDashboardPanel msPerformanceBlock">
          <div class="msBlockHead"><h2>PERFORMANCE</h2><select aria-label="Période de performance"><option>Aujourd’hui</option><option>7 derniers jours</option><option>Ce mois</option></select></div>
          <div class="msMiniGrid">
            ${msDashboardMiniStat('₣',money(caDay),'CA du jour','green')}
            ${msDashboardMiniStat('🛒',todaySales.length,'Commandes','gold')}
            ${msDashboardMiniStat('👥',newClientsToday,'Nouveaux clients','blue')}
            ${msDashboardMiniStat('📦',todayQty,'Articles vendus','purple')}
          </div>
          <div class="msChartWrap"><h3>ÉVOLUTION DES VENTES (7 DERNIERS JOURS)</h3>${msDashboardSalesChart(sevenDayPoints)}</div>
          <button type="button" class="msPrimaryAction" onclick="show('rapports')">VOIR PERFORMANCE DÉTAILLÉE <span>→</span></button>
        </article>

        <article class="msDashboardPanel msYearBlock">
          <div class="msBlockHead"><h2>RÉSUMÉ ANNÉE ${manageYear}</h2><button type="button" onclick="show('mois')">Voir rapport complet</button></div>
          <div class="msYearList">
            <div><span class="msYearIcon green">₣</span><p>Total ventes année<small>Chiffre global enregistré</small></p><strong>${money(ca)}</strong></div>
            <div><span class="msYearIcon blue">▤</span><p>CA total<small>Année de gestion active</small></p><strong>${money(ca)}</strong></div>
            <div><span class="msYearIcon purple">↗</span><p>Bénéfice total<small>Résultat estimé</small></p><strong>${money(profit)}</strong></div>
            <div><span class="msYearIcon gold">👥</span><p>Clients contrat<small>Clients suivis</small></p><strong>${clients.length}</strong></div>
            <div><span class="msYearIcon green">📦</span><p>Produits en stock<small>Références disponibles</small></p><strong>${productItems.length}</strong></div>
          </div>
          <button type="button" class="msPrimaryAction" onclick="show('mois')">VOIR RAPPORT ANNUEL DÉTAILLÉ <span>→</span></button>
        </article>
      </section>
      <div class="msDashboardFooterDate">Mise à jour : ${new Date().toLocaleDateString('fr-FR')} — Exercice actif : ${monthsList[activeMonth]} ${manageYear}</div>
    </div>
  </section>
  <section id="vente" class="section ${sec==='vente'?'active':''}"><div class="g2panel salePosPanel"><h2><span></span> Vente / Caisse enregistreuse</h2>${saleCashRegisterSection(items,clients,cartSales)}</div></section>
  <section id="stocks" class="section printable ${sec==='stocks'?'active':''}">${stockSection(admin?items:[],admin,admin?sales:[])}</section>
  <section id="rapports" class="section printable ${sec==='rapports'?'active':''}"><div class="g2panel"><div class="reportActions"><button onclick="renderDash('rapports')">Actualiser le rapport</button><button onclick="openServiceReportPdfPage()">Imprimer / PDF</button>${admin?'<button onclick="showBilan()">Rapport bilan détaillé</button><button onclick="showBilanJourPage()">BILAN JOUR</button>':''}</div><div class="reportBox"><h1>RAPPORT GÉNÉRAL DÉTAILLÉ DES SERVICES VENDUS</h1><h3>${esc(company.name)} — GLOBAL MARKET — Exercice actif : ${monthsList[activeMonth]} ${manageYear}</h3>${serviceReport(items,sales,admin)}<div id="serviceReportTotalLine" class="totalLine">TOTAL EXERCICE ${monthsList[activeMonth]} ${manageYear} : ${money(exerciseCa)}${admin?' | Bénéfice : '+money(exerciseProfit):''}</div></div></div></section>
  <section id="contrats" class="section ${sec==='contrats'?'active':''}"><div class="g2panel contractSection"><h2><span></span> Clients sous contrat</h2>${clientContractSection(clients,admin,sales)}</div></section>
  <section id="mois" class="section ${sec==='mois'?'active':''}"><div class="g2panel yearManagePanel"><h2><span></span> Année de gestion administrateur</h2><div class="notice"><b>Année et mois appliqués uniquement à cette entreprise : ${manageYear} — Exercice actif : ${monthsList[activeMonth]} ${manageYear} — ${activeExerciseBadge()}</b></div><div class="yearControlBar"><button class="btn2" onclick="setManageYear(-1)">← Année précédente</button><label>Année de gestion<input id="managementYear" type="number" min="1" value="${manageYear}" placeholder="Ex: 2026"></label><label>Mois actif<select id="managementMonth">${monthsList.map((m,i)=>`<option value="${i}" ${i===activeMonth?'selected':''}>${m}</option>`).join('')}</select></label><button onclick="applyManagementYear()">Appliquer</button><button class="btn2" onclick="setManageYear(1)">Année suivante →</button></div><p class="sub">Quand vous cliquez sur Appliquer, l’année et l’exercice actif deviennent la référence de toute l’entreprise : rapports, consommations, bilans et impressions.</p><div class="reportActions no-print"><button onclick="openYearManagementPdfPage()">Imprimer l’exercice / PDF</button><button class="btn2" onclick="renderDash('rapports')">Voir les rapports de l’exercice</button><button class="btn2" onclick="setActiveExerciseState('open')">Ouvrir l’exercice</button><button class="darkBtn" onclick="setActiveExerciseState('locked')">Verrouiller</button><button class="danger" onclick="setActiveExerciseState('closed')">Clôturer</button></div></div><div class="g2panel"><div class="reportBox slim yearlyReport"><h1>TABLEAU DE GESTION SUR 12 MOIS</h1><h3>${esc(company.name)} — Année ${manageYear}</h3>${monthsGrid(admin?sales:[], admin?obligations:[])}</div></div></section>
  <section id="param" class="section ${sec==='param'?'active':''}"><div class="g2panel"><h2><span></span> Paramètres — Base de calcul des charges</h2><p class="sub">Liste complète des produits et services. Les pourcentages servent automatiquement au calcul des rapports.</p><div class="reportActions"><button onclick="saveChargePercentages()">Enregistrer les pourcentages</button><button onclick="renderDash('param')">Actualiser la liste</button><button onclick="showFichePaiement()">Créer fiche de paiement</button></div><div class="notice"><b>Exercice actif :</b> ${monthsList[activeMonth]} ${manageYear}</div>${chargesBase(admin?items:[])}</div><div class="g2panel"><h2><span></span> Obligations mensuelles</h2><p class="sub">Chaque administrateur peut ajouter ou supprimer ses obligations mensuelles.</p>${admin?obligationForm():''}${obligationsBox(admin?exerciseProfit:0,admin?obligations:[],admin)}</div><div class="g2panel"><h2><span></span> Utilisateurs internes</h2><p class="notice">Limite du plan : ${userLimitLabel(company)} utilisateur(s).</p>${admin?`<div class="formCard"><div class="grid three"><input id="uName" placeholder="Nom"><input id="uEmail" placeholder="Email"><input id="uPass" type="password" minlength="6" autocomplete="new-password" placeholder="Mot de passe sécurisé"><select id="uRole" onchange="toggleNewCaisseHours('u')"><option value="caisse">Caisse</option><option value="admin">Admin</option></select><span class="caisseHourFields uCaisseOnly"><input id="uStart" type="time" value="07:00" title="Heure début caisse"></span><span class="caisseHourFields uCaisseOnly"><input id="uEnd" type="time" value="22:00" title="Heure fin caisse"></span><button onclick="addUser()">Créer utilisateur</button></div></div>`:'<p class="notice">Réservé admin.</p>'}${usersTable(users,admin)}</div><div class="g2panel"><h2><span></span> Journal automatique des actions caisse</h2><p class="sub">Historique sécurisé des connexions, ventes, validations, impressions et actions sensibles des comptes caisse.</p>${admin?caisseLogsTable():'<p class="notice">Réservé admin.</p>'}</div><div class="g2panel"><h2><span></span> Demandes de mot de passe oublié</h2><p class="sub">Règle de sécurité : l’administrateur d’entreprise peut réinitialiser uniquement les comptes Caisse. Les comptes Administrateur sont réinitialisés par le Super Admin GLOBAL MARKET.</p>${admin?passwordResetRequestsBox():'<p class="notice">Réservé admin.</p>'}</div></section>`,sec)
}

/* === GLOBAL3 : interface Stocks professionnelle dynamique === */
function legacy1_stockSection(items,admin=false,sales=[]){
  window.g3StockTab=window.g3StockTab||'categories';
  const active=window.g3StockTab;
  return `<div class="g2panel stockProShell">
    <div class="stockProHeader">
      <div><h2><span></span> Stocks</h2><p class="sub">Gestion complète des catégories, produits, services, valeurs d’achat, valeurs de vente et bénéfices.</p></div>
      <div class="stockTopActions no-print"><button class="darkBtn" onclick="openFilteredStockPdfPage()">Imprimer la liste</button><button class="btn2" onclick="exportStockExcel()">Export Excel</button></div>
    </div>
    <div class="stockRubriqueBar no-print">
      <button class="${active==='categories'?'active':''}" onclick="window.g3StockTab='categories';renderDash('stocks')">Gestion des catégories</button>
      <button class="${active==='products'?'active':''}" onclick="window.g3StockTab='products';renderDash('stocks')">Liste des produits ou services</button>
    </div>
    ${stockSummaryCards(items,sales)}
    <div class="stockRubriquePanel">${active==='categories'?stockCategoriesPage(items,admin,sales):stockProductsPage(items,admin,sales)}</div>
  </div>`;
}
function stockItemSales(item,sales=[]){
  return (sales||[]).filter(s=>String(s.itemId||'')===String(item.id||'') || (!s.itemId && (String(s.itemCode||'').toUpperCase()===String(item.code||'').toUpperCase() || String(s.name||'').toLowerCase()===String(item.name||'').toLowerCase())));
}
function stockStatsForItem(i,sales=[]){
  const boutique=isBoutiqueItem(i), rows=stockItemSales(i,sales);
  const qtySold=rows.reduce((a,b)=>a+Number(b.qty||0),0);
  const stockNow=boutique?(i.stockType==='unlimited'?Infinity:Number(i.stock||0)):0;
  const initial=boutique?Number(i.stockInitial ?? (Number(i.stock||0)+qtySold)):0;
  const buy=Number(i.buy||0), sell=Number(i.sell||0);
  const valueBuy=boutique?buy*initial:0;
  const valueSalePossible=boutique?(i.stockType==='unlimited'?0:sell*initial):sell;
  const valueSold=rows.reduce((a,b)=>a+Number(b.total||0),0);
  const realized=rows.reduce((a,b)=>a+Number(b.profit||0),0);
  const remainingPotential=boutique?(i.stockType==='unlimited'?0:Math.max(0,Number(i.stock||0)*(sell-buy))):0;
  const totalPotential=boutique?(valueSalePossible-valueBuy):0;
  const diff=sell-buy;
  let stockState='Service';
  if(boutique){
    if(i.stockType==='unlimited') stockState='Disponible';
    else if(Number(i.stock||0)<=0) stockState='Épuisé';
    else if(Number(i.stock||0)<=Number(i.alert||5)) stockState='Faible';
    else stockState='Disponible';
  }
  const status=i.marketplaceHidden?'Masqué':(stockState==='Épuisé'?'Stock épuisé':'Actif');
  return {boutique,qtySold,stockNow,initial,buy,sell,valueBuy,valueSalePossible,valueSold,realized,remainingPotential,totalPotential,diff,stockState,status,sales:rows};
}
function stockSummaryCards(items=[],sales=[]){
  const products=items.filter(isBoutiqueItem), services=items.filter(i=>!isBoutiqueItem(i));
  const cats=new Set(items.map(i=>i.cat).filter(Boolean));
  const totals=items.reduce((a,i)=>{const s=stockStatsForItem(i,sales); a.buy+=s.valueBuy; a.sale+=s.valueSalePossible; a.sold+=s.valueSold; a.realized+=s.realized; a.remaining+=s.remainingPotential; if(s.stockState==='Faible')a.low++; if(s.stockState==='Épuisé')a.out++; return a;},{buy:0,sale:0,sold:0,realized:0,remaining:0,low:0,out:0});
  const cards=[['Catégories',cats.size],['Produits',products.length],['Services',services.length],['Valeur achat stock',money(totals.buy)],['Vente estimée',money(totals.sale)],['Déjà vendu',money(totals.sold)],['Bénéfice réalisé',money(totals.realized)],['Bénéfice potentiel restant',money(totals.remaining)],['Stock faible',totals.low],['Rupture stock',totals.out]];
  return `<div class="stockSummaryGrid">${cards.map(c=>`<div class="stockSummaryCard"><span>${esc(c[0])}</span><b>${esc(c[1])}</b></div>`).join('')}</div>`;
}
function stockCategoriesPage(items=[],admin=false,sales=[]){
  const {d,company}=current();
  const records=getCompanyCategoryRecords(d,company.id);
  return `<div class="stockPageBlock stockCategoryPage">
    <div class="stockPageTitle"><div><h3>Gestion des catégories</h3><p>Liste complète des catégories avec les valeurs d’achat, de vente et les bénéfices potentiels.</p></div>${admin?'<button class="orangeBtn" onclick="openStockCategoryPopup()">+ Ajouter une catégorie</button>':''}</div>
    <div class="stockCategoryGrid">${records.map(c=>stockCategoryCard(c,items,admin,sales)).join('')||'<div class="emptyCart">Aucune catégorie enregistrée.</div>'}</div>
  </div>`;
}
function stockCategoryCard(c,items=[],admin=false,sales=[]){
  const rows=items.filter(i=>String(i.cat||'')===String(c.name||''));
  const products=rows.filter(isBoutiqueItem), services=rows.filter(i=>!isBoutiqueItem(i));
  const st=rows.reduce((a,i)=>{const s=stockStatsForItem(i,sales); a.buy+=s.valueBuy; a.sale+=s.valueSalePossible; a.potential+=s.totalPotential; return a;},{buy:0,sale:0,potential:0});
  const enc=encodeURIComponent(c.name||'');
  return `<div class="stockCategoryCard">
    <div class="stockCategoryHead"><div><h4>${esc(c.name)}</h4><span>${c.kind==='service'?'Catégorie service':'Catégorie produit'}</span></div><b>${rows.length} élément(s)</b></div>
    <div class="stockCatStats">
      <div><small>Produits</small><strong>${products.length}</strong></div><div><small>Services</small><strong>${services.length}</strong></div>
      <div><small>Achat total</small><strong>${money(st.buy)}</strong></div><div><small>Vente estimée</small><strong>${money(st.sale)}</strong></div>
      <div class="wide"><small>Bénéfice potentiel estimé</small><strong>${money(st.potential)}</strong></div>
    </div>
    <div class="stockCardActions no-print">
      <button onclick="stockOpenCategoryElements('${enc}')">Afficher les éléments</button>
      ${admin?`<button class="btn2" onclick="editCategoryEncoded('${enc}')">Modifier la catégorie</button><button class="btn2" onclick="stockOpenCategoryElements('${enc}')">Modifier les éléments</button>`:''}
      <button class="darkBtn" onclick="openStockCategoryPdfPage('${enc}')">Imprimer</button>
      ${admin?`<button class="danger" onclick="deleteCategoryEncoded('${enc}')">Supprimer</button>`:''}
    </div>
  </div>`;
}
function stockProductsPage(items=[],admin=false,sales=[]){
  const {d,company}=current();
  const cats=getCompanyCategories(d,company.id);
  const selected=window.g3StockCatFilter||'';
  return `<div class="stockPageBlock stockProductsPage">
    <div class="stockPageTitle"><div><h3>Liste des produits ou services</h3><p>Tableau dynamique avec filtres, tri, pagination, valeurs d’achat, vente et bénéfices.</p></div><div class="stockTitleActions no-print">${admin?'<button class="orangeBtn" onclick="openStockItemPopup()">+ Ajouter produit/service</button>':''}<button class="darkBtn" onclick="openFilteredStockPdfPage()">Imprimer la liste</button><button class="btn2" onclick="exportStockExcel()">Export Excel</button></div></div>
    <div class="stockAdvancedFilters no-print">
      <label>Catégorie<select id="stockCategoryFilter" onchange="filterAdvancedStockTable()"><option value="">Toutes catégories</option>${cats.map(c=>`<option value="${esc(c)}" ${c===selected?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
      <label>Nom<input id="stockNameFilter" placeholder="Nom produit/service" oninput="filterAdvancedStockTable()"></label>
      <label>Code<input id="stockCodeFilter" placeholder="Code" oninput="filterAdvancedStockTable()"></label>
      <label>Type<select id="stockTypeFilter" onchange="filterAdvancedStockTable()"><option value="">Produit ou Service</option><option value="produit">Produit</option><option value="service">Service</option></select></label>
      <label>Stock<select id="stockAvailableFilter" onchange="filterAdvancedStockTable()"><option value="">Tous stocks</option><option value="available">Disponible</option><option value="low">Faible</option><option value="out">Épuisé</option></select></label>
      <label>Achat min<input id="stockBuyFilter" type="number" placeholder="FCFA" oninput="filterAdvancedStockTable()"></label>
      <label>Vente min<input id="stockSellFilter" type="number" placeholder="FCFA" oninput="filterAdvancedStockTable()"></label>
      <label>Date<input id="stockDateFilter" type="date" onchange="filterAdvancedStockTable()"></label>
      <label>Statut<select id="stockStatusFilter" onchange="filterAdvancedStockTable()"><option value="">Tous statuts</option><option value="actif">Actif</option><option value="masqué">Masqué</option><option value="stock épuisé">Stock épuisé</option></select></label>
    </div>
    <div class="stockTableTools no-print"><span id="stockTableCount"></span><label>Pagination<select id="stockPageSize" onchange="window.g3StockPage=1;filterAdvancedStockTable()"><option value="10">10</option><option value="20" selected>20</option><option value="50">50</option><option value="9999">Tous</option></select></label><button class="btn2" onclick="stockGoPage(-1)">←</button><span id="stockPageInfo">Page 1</span><button class="btn2" onclick="stockGoPage(1)">→</button></div>
    <div class="stockResponsiveTable"><table class="g2table stockAdvancedTable"><thead><tr>${['Catégorie','Code','Nom','Type','Détail','Prix achat','Prix vente','Stock initial','Stock disponible','Qté vendue','Valeur achat','Valeur vente','Bénéfice potentiel','Bénéfice réalisé','Statut','Date','Actions'].map((h,i)=>`<th onclick="sortStockTable(${i})">${h}</th>`).join('')}</tr></thead><tbody id="stockAdvancedTbody">${items.map(i=>stockAdvancedRow(i,admin,sales)).join('')||'<tr><td colspan="17">Aucun produit ou service enregistré.</td></tr>'}</tbody><tfoot><tr><td colspan="10">Totaux de la liste affichée</td><td id="stockTotalBuy">0 FCFA</td><td id="stockTotalSale">0 FCFA</td><td id="stockTotalPotential">0 FCFA</td><td id="stockTotalRealized">0 FCFA</td><td colspan="3"></td></tr></tfoot></table></div>
  </div><script>setTimeout(function(){filterAdvancedStockTable();},60)</script>`;
}
function stockAdvancedRow(i,admin=false,sales=[]){
  const s=stockStatsForItem(i,sales), type=s.boutique?'Produit':'Service', dt=(i.createdAt||i.date||i.updatedAt||'').slice(0,10);
  const statusClass=s.status==='Masqué'?'hide':s.stockState==='Épuisé'?'out':s.stockState==='Faible'?'warn':'ok';
  return `<tr class="stockAdvRow" data-id="${esc(i.id)}" data-category="${esc(String(i.cat||'').toLowerCase())}" data-name="${esc(String(i.name||'').toLowerCase())}" data-code="${esc(String(i.code||'').toLowerCase())}" data-type="${type.toLowerCase()}" data-stock="${esc(s.stockState.toLowerCase())}" data-status="${esc(s.status.toLowerCase())}" data-date="${esc(dt)}" data-buy="${s.buy}" data-sell="${s.sell}" data-totalbuy="${s.valueBuy}" data-totalsale="${s.valueSalePossible}" data-potential="${s.remainingPotential||s.totalPotential}" data-realized="${s.realized}">
    <td>${esc(i.cat||'-')}</td><td>${esc(i.code||'')}</td><td><b>${esc(i.name||'')}</b></td><td>${type}</td><td>${esc(i.detail||i.marketplaceDesc||'-')}</td><td>${s.boutique?money(s.buy):'-'}</td><td>${money(s.sell)}</td><td>${s.boutique?(i.stockType==='unlimited'?'Illimité':s.initial):'-'}</td><td>${s.boutique?(i.stockType==='unlimited'?'Illimité':Number(i.stock||0)):'-'}</td><td>${s.qtySold}</td><td>${money(s.valueBuy)}</td><td>${money(s.valueSalePossible)}</td><td>${money(s.remainingPotential||s.totalPotential)}</td><td>${money(s.realized)}</td><td><span class="stockStatus ${statusClass}">${esc(s.status)}</span></td><td>${dt||'-'}</td><td class="actionCell"><div class="actionBtns"><button class="btn2" onclick="openStockItemDetail('${esc(i.id)}')">Voir détail</button>${admin?`<button class="btn2" onclick="editItem('${esc(i.id)}')">Modifier</button><button class="danger" onclick="deleteItem('${esc(i.id)}')">Supprimer</button>`:''}<button class="darkBtn" onclick="openStockItemPdfPage('${esc(i.id)}')">Imprimer</button></div></td>
  </tr>`;
}
function stockOpenCategoryElements(catEncoded){window.g3StockTab='products'; window.g3StockCatFilter=decodeURIComponent(catEncoded||''); window.g3StockPage=1; renderDash('stocks');}
function getFilteredStockItems(){
  const {d,company}=current(); const items=(d.items||[]).filter(i=>i.companyId===company.id);
  const rows=[...document.querySelectorAll('.stockAdvRow')].filter(r=>r.dataset.match==='1' || r.style.display!=='none');
  if(rows.length){const ids=new Set(rows.map(r=>r.dataset.id)); return items.filter(i=>ids.has(i.id));}
  const cat=String($('#stockCategoryFilter')?.value||window.g3StockCatFilter||'').toLowerCase();
  return cat?items.filter(i=>String(i.cat||'').toLowerCase()===cat):items;
}
function filterAdvancedStockTable(){
  const rows=[...document.querySelectorAll('.stockAdvRow')]; if(!rows.length)return;
  const catVal=String($('#stockCategoryFilter')?.value||''); window.g3StockCatFilter=catVal; const cat=catVal.toLowerCase(), name=String($('#stockNameFilter')?.value||'').toLowerCase(), code=String($('#stockCodeFilter')?.value||'').toLowerCase();
  const type=String($('#stockTypeFilter')?.value||'').toLowerCase(), st=String($('#stockAvailableFilter')?.value||'').toLowerCase(), status=String($('#stockStatusFilter')?.value||'').toLowerCase();
  const buy=Number($('#stockBuyFilter')?.value||0), sell=Number($('#stockSellFilter')?.value||0), date=String($('#stockDateFilter')?.value||'');
  let count=0,buyT=0,saleT=0,potT=0,realT=0;
  rows.forEach(r=>{
    let ok=true;
    if(cat && r.dataset.category!==cat) ok=false;
    if(name && !r.dataset.name.includes(name)) ok=false;
    if(code && !r.dataset.code.includes(code)) ok=false;
    if(type && r.dataset.type!==type) ok=false;
    if(st==='available' && !['disponible','service'].includes(r.dataset.stock)) ok=false;
    if(st==='low' && r.dataset.stock!=='faible') ok=false;
    if(st==='out' && r.dataset.stock!=='épuisé') ok=false;
    if(status && r.dataset.status!==status) ok=false;
    if(buy && Number(r.dataset.buy||0)<buy) ok=false;
    if(sell && Number(r.dataset.sell||0)<sell) ok=false;
    if(date && r.dataset.date!==date) ok=false;
    r.dataset.match=ok?'1':'0';
    if(ok){count++; buyT+=Number(r.dataset.totalbuy||0); saleT+=Number(r.dataset.totalsale||0); potT+=Number(r.dataset.potential||0); realT+=Number(r.dataset.realized||0);}
  });
  $('#stockTotalBuy') && ($('#stockTotalBuy').textContent=money(buyT)); $('#stockTotalSale') && ($('#stockTotalSale').textContent=money(saleT)); $('#stockTotalPotential') && ($('#stockTotalPotential').textContent=money(potT)); $('#stockTotalRealized') && ($('#stockTotalRealized').textContent=money(realT));
  $('#stockTableCount') && ($('#stockTableCount').textContent=count+' élément(s) trouvé(s)');
  applyStockPagination();
}
function applyStockPagination(){
  const rows=[...document.querySelectorAll('.stockAdvRow')]; if(!rows.length)return;
  const matches=rows.filter(r=>r.dataset.match==='1'); const size=Number($('#stockPageSize')?.value||20); const pages=Math.max(1,Math.ceil(matches.length/size)); window.g3StockPage=Math.min(Math.max(1,Number(window.g3StockPage||1)),pages);
  rows.forEach(r=>r.style.display='none'); matches.forEach((r,i)=>{r.style.display=(i>=(window.g3StockPage-1)*size && i<window.g3StockPage*size)?'':'none'});
  $('#stockPageInfo') && ($('#stockPageInfo').textContent='Page '+window.g3StockPage+' / '+pages);
}
function stockGoPage(delta){window.g3StockPage=Number(window.g3StockPage||1)+Number(delta||0); applyStockPagination();}
function sortStockTable(idx){
  const tb=document.getElementById('stockAdvancedTbody'); if(!tb)return; const rows=[...tb.querySelectorAll('tr.stockAdvRow')]; const dir=window.g3StockSortDir===1?-1:1; window.g3StockSortDir=dir;
  rows.sort((a,b)=>{const ta=a.children[idx]?.textContent?.replace(/\s+/g,' ').trim()||'', tbx=b.children[idx]?.textContent?.replace(/\s+/g,' ').trim()||''; const na=Number(ta.replace(/[^0-9.-]/g,'')), nb=Number(tbx.replace(/[^0-9.-]/g,'')); if(!isNaN(na)&&!isNaN(nb)&&ta.match(/\d/)&&tbx.match(/\d/)) return (na-nb)*dir; return ta.localeCompare(tbx,'fr')*dir;});
  rows.forEach(r=>tb.appendChild(r)); filterAdvancedStockTable();
}
function legacy1_stockCategoryPopupRows(){
  const {d,company}=current(); const rows=getCompanyCategoryRecords(d,company.id); const items=(d.items||[]).filter(i=>i.companyId===company.id);
  return rows.map(c=>{
    const linked=items.filter(i=>String(i.cat||'')===String(c.name||''));
    const totalBuy=linked.reduce((s,i)=>s+(isBoutiqueItem(i)?Number(i.stock||0)*Number(i.buy||0):Number(i.buy||0)),0);
    const totalSale=linked.reduce((s,i)=>s+(isBoutiqueItem(i)?Number(i.stock||0)*Number(i.sell||0):Number(i.sell||0)),0);
    const benefit=totalSale-totalBuy;
    return `<tr><td><b>${esc(c.name||'')}</b></td><td>${c.kind==='service'?'Service':'Produit'}</td><td>${linked.length}</td><td>${money(totalBuy)}</td><td>${money(totalSale)}</td><td>${money(benefit)}</td><td><div class="stockCatTableActions"><button class="btn2" onclick="stockEditCategoryInPopup('${esc(c.name||'')}')">✏️ Modifier</button><button class="danger" onclick="deleteStockCategoryFromPopup('${esc(c.name||'')}')">🗑️ Supprimer</button></div></td></tr>`;
  }).join('') || '<tr><td colspan="7">Aucune catégorie enregistrée.</td></tr>';
}
function legacy1_openStockCategoryPopup(cat=''){
  if(!requireAdmin()) return;
  const {d,company}=current(); const rec=cat?getCompanyCategoryRecords(d,company.id).find(c=>c.name===cat):null;
  const html=`<div class="modalBackdrop stockModalBackdrop" onclick="closeStockModal(event)"><div class="stockProModal stockCategoryListModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockModalBackdrop')?.remove()">×</button><h2>${rec?'Modifier la catégorie':'Ajouter une catégorie'}</h2><p class="sub">Ajoutez une catégorie et gérez directement la liste complète des catégories disponibles.</p><input id="stockCatEditOld" type="hidden" value="${esc(rec?.name||'')}"><section class="stockFormBlock"><h3>Formulaire catégorie</h3><div class="grid two"><label>Nom de la catégorie<input id="stockCatName" value="${esc(rec?.name||'')}" placeholder="Ex : Boutique, Impression, Mobile money"></label><label>Type<select id="stockCatKind"><option value="boutique" ${rec?.kind!=='service'?'selected':''}>Catégorie PRODUIT</option><option value="service" ${rec?.kind==='service'?'selected':''}>Catégorie SERVICE</option></select></label></div><div class="modalActions"><button class="orangeBtn" onclick="saveStockCategoryFromPopup()">Enregistrer</button><button class="btn2" onclick="stockResetCategoryPopupForm()">Réinitialiser</button><button class="btn2" onclick="document.querySelector('.stockModalBackdrop')?.remove()">Fermer</button></div></section><section class="stockFormBlock"><h3>Liste des catégories disponibles</h3><div class="stockCategoryTableWrap"><table class="g2table stockCategoryPopupTable"><thead><tr><th>Catégorie</th><th>Type</th><th>Nb éléments</th><th>Valeur achat</th><th>Valeur vente</th><th>Bénéfice potentiel</th><th>Actions</th></tr></thead><tbody id="stockCategoryPopupTbody">${stockCategoryPopupRows()}</tbody></table></div></section></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html); setTimeout(()=>$('#stockCatName')?.focus(),50);
}
function legacy1_stockResetCategoryPopupForm(){ if($('#stockCatEditOld')) $('#stockCatEditOld').value=''; if($('#stockCatName')) $('#stockCatName').value=''; if($('#stockCatKind')) $('#stockCatKind').value='boutique'; $('#stockCatName')?.focus(); }
function legacy1_stockEditCategoryInPopup(cat){ const {d,company}=current(); const rec=getCompanyCategoryRecords(d,company.id).find(c=>c.name===cat); if(!rec) return g3Alert('Catégorie introuvable.','Catégorie','warn'); if($('#stockCatEditOld')) $('#stockCatEditOld').value=rec.name||''; if($('#stockCatName')) $('#stockCatName').value=rec.name||''; if($('#stockCatKind')) $('#stockCatKind').value=rec.kind||'boutique'; $('#stockCatName')?.focus(); }
/* fonction historique deleteStockCategoryFromPopup supprimée : version finale conservée */
function legacy1_saveStockCategoryFromPopup(){
  if(!requireAdmin()) return;
  const {d,company}=current(); const old=$('#stockCatEditOld')?.value||'', name=String($('#stockCatName')?.value||'').trim(), kind=$('#stockCatKind')?.value||'boutique';
  if(!name) return g3Alert('Nom de catégorie obligatoire.','Catégorie','info'); const rows=getCompanyCategoryRecords(d,company.id);
  if(rows.some(c=>c.name!==old && String(c.name||'').toLowerCase()===name.toLowerCase())) return g3Alert('Cette catégorie existe déjà.','Catégorie','warn');
  if(old){const rec=rows.find(c=>c.name===old); if(rec){rec.name=name; rec.kind=kind;} (d.items||[]).forEach(i=>{if(i.companyId===company.id&&i.cat===old){i.cat=name; i.type=kind==='service'?'service':'boutique';}});}
  else rows.push({name,kind});
  saveCompanyCategoryRecords(d,company.id,rows); save(d); document.querySelector('.stockModalBackdrop')?.remove(); g3Alert(old?'Catégorie modifiée avec succès.':'Catégorie ajoutée avec succès.','Catégorie'); renderDash('stocks');
}
function closeStockModal(e){if(e.target.classList.contains('stockModalBackdrop')) e.target.remove();}
function legacy2_saveStockCategoryFromPopup(){
  if(!requireAdmin()) return;
  const {d,company}=current(); const old=$('#stockCatEditOld')?.value||'', name=String($('#stockCatName')?.value||'').trim(), kind=$('#stockCatKind')?.value||'boutique';
  if(!name) return alert('Nom de catégorie obligatoire.'); const rows=getCompanyCategoryRecords(d,company.id);
  if(rows.some(c=>c.name!==old && c.name.toLowerCase()===name.toLowerCase())) return alert('Cette catégorie existe déjà.');
  if(old){const rec=rows.find(c=>c.name===old); if(rec){rec.name=name; rec.kind=kind;} (d.items||[]).forEach(i=>{if(i.companyId===company.id&&i.cat===old){i.cat=name; i.type=kind==='service'?'service':'boutique';}});}
  else rows.push({name,kind});
  saveCompanyCategoryRecords(d,company.id,rows); save(d); document.querySelector('.stockModalBackdrop')?.remove(); alert(old?'Catégorie modifiée avec succès.':'Catégorie ajoutée avec succès.'); renderDash('stocks');
}
function legacy1_openStockItemPopup(iid=''){
  if(!requireAdmin('La caisse ne peut pas gérer les stocks.')) return;
  const {d,company}=current(); const i=iid?(d.items||[]).find(x=>x.id===iid&&x.companyId===company.id):null;
  const html=`<div class="modalBackdrop stockModalBackdrop" onclick="closeStockModal(event)"><div class="stockProModal stockItemModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockModalBackdrop')?.remove()">×</button><h2>${i?'Modifier le produit ou service':'Ajouter un produit ou service'}</h2><p class="sub">Popup professionnel prérempli pour la gestion des produits, services et stocks.</p>${stockForm(company)}</div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  setTimeout(()=>{toggleChargeField(); if(i){fillStockItemForm(i);} else {clearItemForm();}},60);
}
function legacy1_fillStockItemForm(i){
  const {d,company}=current();
  $('#pEdit') && ($('#pEdit').value=i.id); $('#pCode') && ($('#pCode').value=i.code||uniqueItemCode(d,company.id,i.id)); $('#pName') && ($('#pName').value=i.name||''); if($('#pDetail')) $('#pDetail').value=i.marketplaceDesc||i.detail||''; setStockPhotoPreview(i.photo||''); const rm=$('#pRemovePhoto'); if(rm) rm.checked=false; $('#pCat') && ($('#pCat').value=i.cat||''); if($('#pType')) $('#pType').value=i.type||categoryKind(i.cat); if($('#pStockType')) $('#pStockType').value=i.stockType||'limited'; $('#pBuy') && ($('#pBuy').value=i.buy||0); $('#pSell') && ($('#pSell').value=i.sell||0); if($('#pServicePrice')) $('#pServicePrice').value=i.sell||0; $('#pStock') && ($('#pStock').value=i.stock||0); $('#pAlert') && ($('#pAlert').value=i.alert||5); if($('#pCharge')) $('#pCharge').value=isBoutiqueItem(i)?autoBoutiqueChargePercent(i):Number(i.charge||0); toggleChargeField(); toggleStockQuantityField();
}
function legacy1_openStockItemDetail(iid){
  const {d,company}=current(); const i=(d.items||[]).find(x=>x.id===iid&&x.companyId===company.id); if(!i)return alert('Élément introuvable.'); const s=stockStatsForItem(i,getCompanyValidatedSales());
  const salesRows=s.sales.map(x=>`<tr><td>${new Date(x.date).toLocaleString('fr-FR')}</td><td>${esc(x.client||'-')}</td><td>${Number(x.qty||0)}</td><td>${money(x.unit||0)}</td><td>${money(x.total||0)}</td><td>${money(x.profit||0)}</td></tr>`).join('')||'<tr><td colspan="6">Aucune vente enregistrée pour cet élément.</td></tr>';
  const html=`<div class="modalBackdrop stockModalBackdrop" onclick="closeStockModal(event)"><div class="stockProModal stockDetailModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockModalBackdrop')?.remove()">×</button><h2>Détail du produit ou service</h2><h3>${esc(i.name||'')}</h3><div class="stockDetailGrid"><div><small>Catégorie</small><b>${esc(i.cat||'-')}</b></div><div><small>Code</small><b>${esc(i.code||'-')}</b></div><div><small>Type</small><b>${s.boutique?'Produit':'Service'}</b></div><div><small>Stock restant</small><b>${s.boutique?(i.stockType==='unlimited'?'Illimité':Number(i.stock||0)):'-'}</b></div><div><small>Valeur investie</small><b>${money(s.valueBuy)}</b></div><div><small>Valeur vendue</small><b>${money(s.valueSold)}</b></div><div><small>Bénéfice réalisé</small><b>${money(s.realized)}</b></div><div><small>Bénéfice restant potentiel</small><b>${money(s.remainingPotential)}</b></div></div><h3>Informations générales</h3><p>${esc(i.detail||i.marketplaceDesc||'Aucune description.')}</p><h3>Historique des entrées en stock</h3><table class="g2table"><tr><th>Date</th><th>Opération</th><th>Quantité</th><th>Observation</th></tr><tr><td>${esc((i.createdAt||i.updatedAt||'').slice(0,10)||'-')}</td><td>Stock initial / état actuel</td><td>${s.boutique?(i.stockType==='unlimited'?'Illimité':s.initial):'-'}</td><td>Données calculées à partir du stock et des ventes enregistrées.</td></tr></table><h3>Historique des ventes</h3><table class="g2table"><tr><th>Date</th><th>Client</th><th>Quantité</th><th>Prix unitaire</th><th>Total</th><th>Bénéfice</th></tr>${salesRows}</table><div class="modalActions"><button class="darkBtn" onclick="openStockItemPdfPage('${esc(i.id)}')">Imprimer</button><button class="btn2" onclick="document.querySelector('.stockModalBackdrop')?.remove()">Fermer</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function openStockItemPdfPage(iid){
  const {d,company}=current(); const i=(d.items||[]).find(x=>x.id===iid&&x.companyId===company.id); if(!i)return alert('Élément introuvable.'); const html=standaloneStockHTML(company,[i],i.cat||i.name||'Détail'); const w=window.open('','_blank'); if(!w){const blob=new Blob([html],{type:'text/html;charset=utf-8'}); location.href=URL.createObjectURL(blob); return;} w.document.open(); w.document.write(html); w.document.close();
}
function openFilteredStockPdfPage(){
  const {company}=current(); const rows=getFilteredStockItems(); const cat=$('#stockCategoryFilter')?.value||window.g3StockCatFilter||''; const html=standaloneStockHTML(company,rows,cat||'Liste filtrée'); const w=window.open('','_blank'); if(!w){const blob=new Blob([html],{type:'text/html;charset=utf-8'}); location.href=URL.createObjectURL(blob); return;} w.document.open(); w.document.write(html); w.document.close();
}
function exportStockExcel(){
  const {d,company}=current(); const sales=getCompanyValidatedSales(); const items=getFilteredStockItems();
  const headers=['Catégorie','Code','Nom','Type','Prix achat','Prix vente','Stock initial','Stock disponible','Quantité vendue','Valeur achat','Valeur vente','Bénéfice potentiel restant','Bénéfice réalisé','Statut','Date'];
  const rows=items.map(i=>{const s=stockStatsForItem(i,sales); return [i.cat||'',i.code||'',i.name||'',s.boutique?'Produit':'Service',s.buy,s.sell,s.boutique?s.initial:'',s.boutique?(i.stockType==='unlimited'?'Illimité':Number(i.stock||0)):'',s.qtySold,s.valueBuy,s.valueSalePossible,s.remainingPotential,s.realized,s.status,(i.createdAt||i.updatedAt||'').slice(0,10)];});
  const csv=[headers,...rows].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='stock_global3_'+today()+'.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function stockForm(company){
 const {d}=current(), catRecords=getCompanyCategoryRecords(d,company.id);
 const catOptions='<option value="">Sélectionner obligatoirement une catégorie enregistrée</option>'+catRecords.map(c=>`<option value="${esc(c.name)}" data-kind="${c.kind}">${esc(c.name)} — ${c.kind==='service'?'Catégorie service':'Catégorie produit'}</option>`).join('');
 return `<div class="categoryManager"><h3>Catégories utiles pour cette entreprise</h3><p class="sub">Ajoutez d’abord vos catégories. Ensuite, l’enregistrement d’un élément commence obligatoirement par le choix d’une catégorie produit ou service.</p><div class="grid three"><input id="customCatName" placeholder="Nom de la catégorie"><select id="customCatKind"><option value="boutique">Catégorie PRODUIT</option><option value="service">Catégorie SERVICE</option></select><button onclick="addCustomCategory()">Ajouter la catégorie</button></div><div class="categoryChips">${catRecords.map(c=>{const encCat=encodeURIComponent(c.name); return `<span class="catChip">${esc(c.name)} <small>${c.kind==='service'?'SERVICE':'PRODUIT'}</small><button title="Modifier la catégorie" onclick="editCategoryEncoded('${encCat}')">✎</button><button title="Supprimer la catégorie" onclick="deleteCategoryEncoded('${encCat}')">×</button></span>`}).join('')||'<em>Aucune catégorie enregistrée. Ajoutez une catégorie produit ou service avant d’enregistrer un élément.</em>'}</div></div>
 <input id="pEdit" type="hidden"><input id="pType" type="hidden" value=""><div class="stockForm stockFormReorg"><div class="field fullRow"><label>1. Catégorie obligatoire</label><select id="pCat" required onchange="toggleChargeField()">${catOptions}</select><small>Les autres champs s’affichent automatiquement selon le type de catégorie choisi.</small></div><div class="field itemField line1"><label>Code produit/service</label><input id="pCode" maxlength="7" pattern="[A-Za-z0-9]{7}" value="${uniqueItemCode(d,company.id)}" readonly><small>7 caractères, chiffres et lettres, sans espace.</small></div><div class="field itemField line1"><label>Nom de l’élément</label><input id="pName" placeholder="Nom du produit ou service"></div><div class="field itemField stockTypeOnly line1"><label>Type de stock</label><select id="pStockType" onchange="toggleStockQuantityField()"><option value="limited">Stock limité — respecter la quantité</option><option value="unlimited">Stock illimité — vente sans contrôle de stock</option></select><small>La quantité s’affiche uniquement pour un stock limité.</small></div><div class="field itemField stockOnly stockQtyOnly line1"><label>Quantité</label><input id="pStock" type="number" value="0"></div><div class="field itemField stockOnly line1"><label>Seuil d’alerte</label><input id="pAlert" type="number" value="5"></div><div class="field itemField serviceOnly line1" id="servicePriceField" style="display:none"><label>Prix du service indicatif</label><input id="pServicePrice" type="number" placeholder="FCFA"></div><div class="field itemField stockOnly line2"><label>Prix d’achat unitaire</label><input id="pBuy" type="number" placeholder="FCFA" oninput="updateAutoProductCharge()"></div><div class="field itemField stockOnly line2"><label>Prix de vente unitaire</label><input id="pSell" type="number" placeholder="FCFA" oninput="updateAutoProductCharge()"></div><div class="field itemField chargeField line2" id="chargeField"><label>Charges service (%)</label><input id="pCharge" type="number" min="0" max="100" value="30"><small id="chargeHelp">Produit : automatique. Service : manuel.</small></div><div class="field itemField line2 photoField photoBoxField"><label>Photo produit/service</label><div class="stockPhotoBox"><div id="pPhotoPreview" class="stockPhotoPreview stockPhotoEmpty"><span class="photoIcon">📷</span><strong>Aucune photo</strong><small>Photo visible par les clients dans la boutique publique.</small></div><div class="photoActions"><label class="photoChooseBtn" for="pPhoto">Choisir une photo</label><button type="button" class="photoDeleteBtn" onclick="removeStockPhoto()">Supprimer</button></div><input id="pPhoto" class="photoInputHidden" type="file" accept="image/*" onchange="previewStockPhoto(this)"><input id="pPhotoData" type="hidden"><input id="pRemovePhoto" type="checkbox" class="hidden"></div></div><div class="field itemField line2 descField"><label>Description visible client</label><textarea id="pDetail" rows="5" maxlength="350" placeholder="Courte description du produit ou du service visible dans la boutique client"></textarea><small>Cette description sera affichée dans Marketplace et la boutique publique.</small></div><div class="stockButtons itemField fullRow"><button onclick="addItem()">Enregistrer l’élément</button><button class="btn2" onclick="clearItemForm()">Vider le formulaire</button><button class="darkBtn" onclick="openStockPdfPage()">Imprimer la liste</button></div></div>`}

function itemsTable(items,admin=false){return `<div class="reportBox slim stockReport"><h1>LISTE DES CATÉGORIES, PRODUITS ET SERVICES</h1><h3>GLOBAL MARKET</h3><table class="g2table stockTable"><tr><th>Code</th><th>Élément</th><th>Catégorie</th><th>Type</th><th>Qté</th><th>Achat U.</th><th>Vente / Prix</th><th>Charges %</th><th>Statut</th><th>Action</th></tr>${items.map(i=>{const boutique=isBoutiqueItem(i); const st=boutique?(i.stockType==='unlimited'?'Illimité':(Number(i.stock||0)<=Number(i.alert||5)?'Alerte':'Disponible')):'Service'; return `<tr data-search="${esc((i.code+' '+i.name+' '+i.cat).toLowerCase())}" data-status="${(st==='Disponible'||st==='Illimité')?'dispo':st==='Alerte'?'alerte':'service'}"><td>${esc(i.code)}</td><td>${esc(i.name)}</td><td>${esc(i.cat)}</td><td>${boutique?'Produit':'Service'}</td><td>${boutique?(i.stockType==='unlimited'?'Illimité':Number(i.stock||0)):'-'}</td><td>${boutique?money(i.buy):'-'}</td><td>${money(i.sell)}</td><td>${boutique?autoBoutiqueChargePercent(i):Number(i.charge||0)}%</td><td><span class="stockStatus ${(st==='Disponible'||st==='Illimité')?'ok':st==='Alerte'?'warn':'ok'}">${st}</span></td><td class="actionCell">${admin?`<div class="actionBtns"><button class="btn2" onclick="editItem('${i.id}')">✎ Modifier</button><button class="danger" onclick="deleteItem('${i.id}')">🗑 Supprimer</button></div>`:'-'}</td></tr>`}).join('')||'<tr><td colspan="10">Aucune catégorie/élément enregistré.</td></tr>'}</table></div>`}

function stockCategoryPrintButtons(items){
  const cats=[...new Set((items||[]).map(i=>String(i.cat||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  if(!cats.length) return '<div class="stockPrintPanel compactStockPrint no-print"><b>Impression par catégorie</b><p>Aucune catégorie disponible pour l’impression individuelle.</p></div>';
  return `<div class="stockPrintPanel compactStockPrint no-print"><div class="stockPrintTitle"><b>Impression par catégorie</b><p>Sélectionnez une catégorie puis cliquez sur imprimer. Toute la liste reste imprimable.</p></div><div class="stockPrintControls"><select id="stockPrintCategorySelect"><option value="">Choisir une catégorie à imprimer</option>${cats.map(c=>`<option value="${encodeURIComponent(c)}">${esc(c)}</option>`).join('')}</select><button class="darkBtn" onclick="printSelectedStockCategory()">Imprimer</button><button class="btn2" onclick="openStockPdfPage()">Imprimer toutes les catégories</button></div></div>`;
}
function printSelectedStockCategory(){
  const sel=document.getElementById('stockPrintCategorySelect');
  const val=sel?sel.value:'';
  if(!val){ alert('Veuillez choisir une catégorie à imprimer.'); return; }
  openStockCategoryPdfPage(val);
}
function salesTable(sales){return `<table class="g2table"><tr><th>Date</th><th>Client</th><th>Désignation</th><th>Qté</th><th>Prix unitaire</th><th>Total</th><th>Bénéfice</th></tr>${sales.map(s=>`<tr><td>${new Date(s.date).toLocaleString('fr-FR')}</td><td>${esc(s.client||'-')}</td><td>${esc(s.name)}</td><td>${s.qty}</td><td>${money(s.unit||0)}</td><td>${money(s.total)}</td><td>${money(s.profit)}</td></tr>`).join('')||'<tr><td colspan="7">Aucune vente enregistrée.</td></tr>'}</table>`}
function panierClient(sales){
  sales=(sales||[]).filter(isSaleCartPending);
  const total=sales.reduce((a,b)=>a+(Number(b.total)||0),0);
  const lastClient=[...sales].reverse().find(s=>s.client)?.client || 'Non précisé';
  return `<div class="cartBox"><h1>PANIER CLIENT</h1><h3>Client : ${esc(lastClient)}</h3>
  <div class="bulkSaleToolbar no-print"><label><input type="checkbox" onchange="toggleAllSaleChecks('cart',this.checked)"> Tout sélectionner</label><button class="miniDanger" onclick="bulkDeleteSelectedCartSales()">Supprimer la sélection</button><button class="btn2" onclick="openSelectedSalesInvoice('cart')">Éditer facture sélectionnée</button></div>
  <table class="cartTable"><tr><th class="no-print">✓</th><th>N°</th><th>Date</th><th>Service / Produit</th><th>Détail</th><th>Qté</th><th>Frais service</th><th>Montant</th><th>Action</th></tr>${sales.map((s,i)=>`<tr class="cartSaleRow"><td class="no-print"><input class="cartSaleCheck" type="checkbox" value="${esc(s.id)}"></td><td>${i+1}</td><td>${new Date(s.date).toLocaleDateString('fr-FR')}</td><td>${esc(s.name)}</td><td>${esc(s.note||s.detail||s.client||'Commande simple')}</td><td>${s.qty}</td><td>${money(s.serviceFee||0)}</td><td>${money(s.total)}</td><td><div class="rowActions"><button class="btn2" onclick="openEditCartLine('${s.id}')">Modifier</button><button class="miniDanger" onclick="deleteSale('${s.id}')">Retirer</button></div></td></tr>`).join('')||'<tr><td colspan="9" class="emptyCart">Panier vide.</td></tr>'}</table><div class="cartTotal">Total panier : ${money(total)}</div></div><div class="cartActions"><button onclick="show('vente')" class="cartAdd">Ajouter d’autres services</button><button onclick="validateCart()" class="cartValidate">Valider la commande</button><button onclick="emptyCart()" class="cartClear">Vider le panier</button></div>`
}
function editSaleDateInputValue(v){
  const d=new Date(v||Date.now());
  if(Number.isNaN(d.getTime())) return new Date().toISOString().slice(0,16);
  const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
}
function editSaleKindLabel(s,item){
  const k=String(s?.saleKind||'').toLowerCase();
  if(k==='service') return 'service';
  if(k==='boutique'||k==='product'||k==='produit') return 'boutique';
  if(item) return isBoutiqueItem(item)?'boutique':'service';
  return (Number(s?.serviceBasePrice||0)>0 || Number(s?.serviceFee||0)>0)?'service':'boutique';
}
function editSaleRecalcTotals(){
  const kind=$('#cartEditKind')?.value||'boutique';
  let qty=Math.floor(Number($('#cartEditQty')?.value||1));
  if(!qty || qty<1) qty=1;
  if($('#cartEditQty')) $('#cartEditQty').value=qty;
  let total=0, unit=0, fee=0, base=0, charges=Number($('#cartEditCharges')?.dataset.baseCharges||0);
  if(kind==='service'){
    base=Math.max(0,Number($('#cartEditServiceBase')?.value||0));
    fee=Math.max(0,Number($('#cartEditFee')?.value||0));
    total=base+fee;
    unit=qty?total/qty:0;
    const unitEl=$('#cartEditUnit'); if(unitEl) unitEl.value=Math.round(unit);
    const feeEl=$('#cartEditFee'); if(feeEl && feeEl.value==='') feeEl.value=0;
  }else{
    unit=Math.max(0,Number($('#cartEditUnit')?.value||0));
    fee=0;
    total=qty*unit;
    const feeEl=$('#cartEditFee'); if(feeEl) feeEl.value=0;
  }
  if($('#cartEditTotal')) $('#cartEditTotal').value=Math.round(total);
  const itemBuy=Number($('#cartEditCharges')?.dataset.itemBuy||0);
  const chargeRate=Number($('#cartEditCharges')?.dataset.chargeRate||0);
  if(kind==='boutique') charges=itemBuy*qty;
  if(kind==='service') charges=base*(chargeRate/100);
  if($('#cartEditCharges')) $('#cartEditCharges').value=Math.round(charges);
  if($('#cartEditProfit')) $('#cartEditProfit').value=Math.round(total-charges);
}
function normalizeEditSaleClientType(v){
  const x=String(v||'').toLowerCase().trim();
  if(x.includes('contrat')) return 'contrat';
  if(x.includes('autre')) return 'autre';
  return 'particulier';
}
function toggleEditSaleContract(){
  const type=normalizeEditSaleClientType($('#cartEditClientType')?.value||'particulier');
  const isContract=type==='contrat';
  const contractWrap=$('#cartEditContractWrap');
  const nameWrap=$('#cartEditClientNameWrap');
  const nameInput=$('#cartEditClient');
  const contractSelect=$('#cartEditContractClient');
  if(contractWrap){contractWrap.style.display=isContract?'flex':'none'; contractWrap.classList.toggle('hidden',!isContract);}
  if(nameWrap){nameWrap.style.display=isContract?'none':'flex'; nameWrap.classList.toggle('hidden',isContract);}
  if(nameInput){nameInput.disabled=isContract; nameInput.required=!isContract; if(isContract) nameInput.value='';}
  if(contractSelect){contractSelect.disabled=!isContract; contractSelect.required=isContract;}
}
function openEditCartLine(sid){
  const {d,company}=current();
  const s=(d.sales||[]).find(x=>x.companyId===company.id&&x.id===sid);
  if(!s) return g3Alert('Ligne introuvable.','Modification impossible','info');
  if(!requireCaisseCanEditSale(s)) return;
  const item=(d.items||[]).find(i=>i.companyId===company.id&&i.id===s.itemId);
  const kind=editSaleKindLabel(s,item);
  const isService=kind==='service';
  const pending=isSaleCartPending(s);
  const title=pending?'Modifier l’article du panier':'Modifier la vente du rapport';
  const subtitle=pending?'Article en attente de validation dans le panier.':'Vente déjà validée dans le rapport.';
  const statusLabel=pending?'PANIER EN COURS':'VENTE VALIDÉE';
  const typeLabel=isService?'Service':'Produit';
  const clientType=normalizeEditSaleClientType(s.contractClientId?'contrat':(s.clientType||'particulier'));
  const clients=(d.clients||[]).filter(c=>c.companyId===company.id);
  const selectedContractId=s.contractClientId || ((clientType==='contrat' && s.client)?((clients.find(c=>String(c.name||'').toLowerCase()===String(s.client||'').toLowerCase())||{}).id||''):'');
  const contractOptions='<option value="">Sélectionner un client sous contrat</option>'+clients.map(c=>`<option value="${esc(c.id)}" ${selectedContractId===c.id?'selected':''}>${esc(c.name)}${c.phone?' — '+esc(c.phone):''}</option>`).join('');
  const stockLabel=isService?'-':(item?(String(item.stockType||'limited').toLowerCase()==='unlimited'?'Illimité':String(saleRegisterStockQty(item)+(pending?0:Number(s.qty||0)))):'-');
  const baseService=Number(s.serviceBasePrice||(!isService?0:(Number(s.total||0)-Number(s.serviceFee||0))));
  const unitValue=Number(s.unit||0);
  const feeValue=Number(s.serviceFee||0);
  const html=`<div class="modalBackdrop editSaleBackdrop" onclick="closeEditCartLine(event)">
    <div class="editSaleModal editSaleModalPro" onclick="event.stopPropagation()">
      <button class="modalClose editSaleClose" onclick="document.querySelector('.editSaleBackdrop')?.remove()">×</button>
      <div class="editSaleHeader">
        <div class="editSaleIcon">${pending?'🧺':'📊'}</div>
        <div><h2>${title}</h2><p>${subtitle}</p><div class="editSaleBadges"><span>${statusLabel}</span><span>${typeLabel}</span><span>N° ${esc(s.id)}</span></div></div>
      </div>
      <input id="cartEditKind" type="hidden" value="${kind}">
      <div class="editSaleSection"><h3>Informations automatiques</h3>
        <div class="editSaleGrid">
          <label>Référence<input value="${esc(s.id)}" readonly></label>
          <label>Statut<input value="${statusLabel}" readonly></label>
          <label>Type d’élément<input value="${typeLabel}" readonly></label>
          <label>Date / heure<input id="cartEditDate" type="datetime-local" value="${editSaleDateInputValue(s.date)}"></label>
          <label>Catégorie<input value="${esc(s.category||item?.cat||'')}" readonly></label>
          <label>Code<input value="${esc(s.itemCode||item?.code||'')}" readonly></label>
          <label>Nom<input value="${esc(s.name||item?.name||'')}" readonly></label>
          <label>Stock disponible<input value="${esc(stockLabel)}" readonly></label>
          <label class="fullRow">Détail / description<textarea rows="2" readonly>${esc(s.detail||item?.detail||item?.marketplaceDesc||'')}</textarea></label>
        </div>
      </div>
      <div class="editSaleSection"><h3>Client et facturation</h3>
        <div class="editSaleGrid">
          <label>Type client<select id="cartEditClientType" onchange="toggleEditSaleContract()"><option value="particulier" ${clientType==='particulier'?'selected':''}>Client simple</option><option value="contrat" ${clientType==='contrat'?'selected':''}>Client sous contrat</option><option value="autre" ${clientType==='autre'?'selected':''}>Autre</option></select></label>
          <label id="cartEditClientNameWrap" style="display:${clientType==='contrat'?'none':'flex'}">Nom du client<input id="cartEditClient" value="${esc(clientType==='contrat'?'':(s.client||''))}" placeholder="Saisir le nom du client"></label>
          <label id="cartEditContractWrap" style="display:${clientType==='contrat'?'flex':'none'}">Client sous contrat<select id="cartEditContractClient">${contractOptions}</select></label>
          <label>Caisse / utilisateur<input value="${esc(s.userId||'Utilisateur')}" readonly></label>
        </div>
      </div>
      <div class="editSaleSection"><h3>Montants et calculs</h3>
        <div class="editSaleGrid">
          ${isService?`<label>Prix vente du service<input id="cartEditServiceBase" type="number" min="0" value="${baseService}" oninput="editSaleRecalcTotals()" onchange="editSaleRecalcTotals()"></label>`:''}
          <label>Quantité<input id="cartEditQty" type="number" min="1" value="${Number(s.qty||1)}" oninput="editSaleRecalcTotals()" onchange="editSaleRecalcTotals()"></label>
          <label>Nb de Clients servis<input id="cartEditClientsServed" type="number" min="1" step="1" value="${saleClientsServedValue(s)}" inputmode="numeric"></label>
          <label>Prix unitaire<input id="cartEditUnit" type="number" min="0" value="${Math.round(unitValue)}" ${isService?'readonly':''} oninput="editSaleRecalcTotals()" onchange="editSaleRecalcTotals()"></label>
          <label>Frais service<input id="cartEditFee" type="number" min="0" value="${feeValue}" ${isService?'':'readonly'} oninput="editSaleRecalcTotals()" onchange="editSaleRecalcTotals()"></label>
          <label>Total<input id="cartEditTotal" type="number" min="0" value="${Math.round(Number(s.total||0))}" readonly></label>
          <label>Coût / charges<input id="cartEditCharges" type="number" value="${Math.round(Number(s.charges||0))}" readonly data-base-charges="${Number(s.charges||0)}" data-item-buy="${Number(item?.buy||0)}" data-charge-rate="${Number(item?.charge||0)}"></label>
          <label>Bénéfice<input id="cartEditProfit" type="number" value="${Math.round(Number(s.profit||0))}" readonly></label>
          <label class="fullRow">Note / observation<textarea id="cartEditNote" rows="3" placeholder="Note, détail ou observation visible sur les factures et rapports...">${esc(s.note||'')}</textarea></label>
        </div>
      </div>
      <div class="editSaleActions">
        <button class="btn2" onclick="document.querySelector('.editSaleBackdrop')?.remove()">Annuler</button>
        <button class="editSaleSave" onclick="saveEditCartLine('${sid}')">Enregistrer les modifications</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  editSaleRecalcTotals();
  toggleEditSaleContract();
}
function closeEditCartLine(e){ if(e&&e.target&&e.target.classList.contains('modalBackdrop')) e.target.remove(); }
function saveEditCartLine(sid){
  const {d,company}=current();
  const s=(d.sales||[]).find(x=>x.companyId===company.id&&x.id===sid);
  if(!s) return g3Alert('Ligne introuvable.','Modification impossible','info');
  if(!requireCaisseCanEditSale(s)) return;
  if(isSaleExerciseLocked(s)) return g3Alert('Cet exercice est verrouillé ou clôturé. Modification impossible.','Exercice verrouillé','info');
  const oldQty=Number(s.qty||1), qty=Math.max(1,Math.floor(Number($('#cartEditQty')?.value||1)));
  const kind=$('#cartEditKind')?.value||editSaleKindLabel(s,null);
  const item=(d.items||[]).find(i=>i.companyId===company.id&&i.id===s.itemId);
  let unit=0,total=0,fee=0,serviceBasePrice=0;
  if(kind==='service'){
    serviceBasePrice=Math.max(0,Number($('#cartEditServiceBase')?.value||0));
    fee=Math.max(0,Number($('#cartEditFee')?.value||0));
    if(serviceBasePrice<=0) return g3Alert('Veuillez saisir un prix de vente du service supérieur à 0.','Prix obligatoire','info');
    total=serviceBasePrice+fee;
    unit=qty?total/qty:0;
    if(total<=0 || unit<=0) return g3Alert('Le total ou le prix unitaire du service est invalide.','Calcul invalide','info');
  }else{
    unit=Math.max(0,Number($('#cartEditUnit')?.value||0));
    if(unit<=0) return g3Alert('Le prix unitaire du produit doit être supérieur à 0.','Prix invalide','info');
    total=qty*unit;
    fee=0;
    serviceBasePrice=0;
  }
  if(item&&isBoutiqueItem(item)){
    if(isSaleCartPending(s)){
      const available=saleRegisterStockQty(item);
      const others=getCompanyCartSales().filter(x=>x.id!==s.id&&x.itemId===s.itemId).reduce((sum,line)=>sum+Number(line.qty||0),0);
      if(String(item.stockType||'limited').toLowerCase()!=='unlimited' && others+qty>available) return g3Alert('La quantité totale de ce produit dans le panier dépasse le stock disponible.','Stock insuffisant','info');
    }else{
      const available=Number(item.stock||0)+oldQty;
      if(String(item.stockType||'limited').toLowerCase()!=='unlimited' && qty>available) return g3Alert('Stock insuffisant pour cette modification.','Stock insuffisant','info');
      if(String(item.stockType||'limited').toLowerCase()!=='unlimited') item.stock=available-qty;
    }
  }
  const dateVal=$('#cartEditDate')?.value||'';
  if(dateVal){const nd=new Date(dateVal); if(!Number.isNaN(nd.getTime())) s.date=nd.toISOString();}
  const clientsServed=Math.max(1,Math.floor(Number($('#cartEditClientsServed')?.value||1)));
  s.qty=qty; s.clientsServed=clientsServed; s.unit=unit; s.serviceFee=fee; s.serviceBasePrice=serviceBasePrice; s.total=total;
  s.clientType=normalizeEditSaleClientType($('#cartEditClientType')?.value||s.clientType||'particulier');
  if(s.clientType==='contrat'){
    s.contractClientId=$('#cartEditContractClient')?.value||'';
    if(!s.contractClientId) return g3Alert('Veuillez sélectionner un client sous contrat.','Client obligatoire','info');
    const c=(d.clients||[]).find(x=>x.id===s.contractClientId&&x.companyId===company.id);
    s.client=c?.name||'';
  }else{
    s.contractClientId='';
    s.client=$('#cartEditClient')?.value||'';
  }
  s.note=$('#cartEditNote')?.value||'';
  s.saleKind=kind;
  if(item){ s.charges=isBoutiqueItem(item)?Number(item.buy||0)*qty:serviceBasePrice*(Number(item.charge||0)/100); }
  else { s.charges=Number($('#cartEditCharges')?.value||s.charges||0); }
  s.profit=Number(s.total||0)-Number(s.charges||0);
  s.updatedAt=new Date().toISOString();
  save(d); document.querySelector('.editSaleBackdrop')?.remove(); renderDash(isSaleCartPending(s)?'panier':'rapports');
}
function deleteSale(sid){const {d,company}=current(); const s=(d.sales||[]).find(x=>x.companyId===company.id&&x.id===sid); if(!s) return; if(!isSaleCartPending(s)) return deleteSaleFromReport(sid); if(!requireCaisseCanEditSale(s)) return; d.sales=d.sales.filter(x=>!(x.companyId===company.id&&x.id===sid&&isSaleCartPending(x))); save(d); renderDash('panier')}
async function deleteSaleFromReport(sid){if(!requireAdmin('La caisse ne peut pas supprimer une vente dans l’historique général.')) return;const {d,company}=current(); const s=(d.sales||[]).find(x=>x.companyId===company.id&&x.id===sid&&isSaleValidated(x)); if(!s) return g3Alert('Vente validée introuvable.','Suppression impossible','info'); if(isSaleExerciseLocked(s)) return alert('Cet exercice est verrouillé ou clôturé. Suppression impossible.'); if(!(await g3Confirm('Supprimer définitivement cette vente du rapport ?','Suppression vente'))) return; d.sales=d.sales.filter(x=>!(x.companyId===company.id&&x.id===sid&&isSaleValidated(x))); save(d); renderDash('rapports')}
async function clearSalesHistory(){if(!requireAdmin('La caisse ne peut pas supprimer l’historique général.')) return;if(!ensureActiveExerciseEditable()) return;const {d,company}=current(); const total=(d.sales||[]).filter(s=>s.companyId===company.id&&isSaleValidated(s)).length; if(!total) return alert('Aucune vente enregistrée à supprimer.'); if(!(await g3Confirm('Attention : cette action va supprimer définitivement toutes les ventes validées de cette entreprise. Le panier en cours ne sera pas touché. Continuer ?','Vider l’historique'))) return; d.sales=(d.sales||[]).filter(s=>!(s.companyId===company.id&&isSaleValidated(s))); save(d); alert('Historique des ventes validées vidé avec succès.'); renderDash('rapports')}

function freeWatermark(){return ''}


/* Correctif impression PDF facture/reçu : ouverture dans une vraie page A4 imprimable */
function invoicePrintStyles(){return globalPrintThemeStyles('portrait')+`
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}.printToolbar{position:fixed;top:12px;right:12px;z-index:50;display:flex;gap:8px}.printToolbar button{border:0;border-radius:12px;padding:12px 16px;font-weight:900;cursor:pointer;background:#00625d;color:#fff}.printToolbar button:first-child{background:#e1a500;color:#062b29}.invoiceA4{position:relative;width:210mm;min-height:297mm;margin:0 auto;background:#fff;overflow:hidden;padding:6mm 7mm 19mm}.invoiceOnePageHeader{display:block;margin:0}.invoiceTopLine{display:none}.premiumInvoiceTitle{display:flex;gap:10mm;align-items:center;justify-content:center;margin:0 0 1mm}.premiumInvoiceTitle h1{font-size:8.3mm;line-height:1;color:#004a48;margin:0;letter-spacing:.01em}.goldSide{width:22mm;height:4mm;border-top:.65mm solid #d49b08;border-left:4mm solid transparent;border-right:4mm solid transparent}.invoiceBadge{position:relative;display:block;width:max-content;margin:1.5mm auto 6mm;padding:1.8mm 12mm;background:#004a48;color:#fff;border-radius:1.2mm;font-size:3.7mm;font-weight:900;line-height:1}.invoiceBadge:before,.invoiceBadge:after{content:"";position:absolute;border-left:.75mm solid #d49b08;border-right:.75mm solid #d49b08;height:5mm;width:3mm;top:.45mm}.invoiceBadge:before{left:-7mm}.invoiceBadge:after{right:-7mm}.premiumClientBox{display:grid;grid-template-columns:43% 57%;border:.35mm solid #7d9795;border-radius:2mm;margin:0 0 6mm;overflow:hidden}.premiumClientLeft{display:grid;grid-template-columns:30mm 1fr;min-height:35mm;border-right:.3mm solid #b7b7b7}.premiumClientLeft>div:first-child{background:#004a48}.premiumClientIcon{width:18mm;height:18mm;border-radius:50%;font-size:11mm;margin:8mm auto 0;color:#d49b08;background:#fff;display:flex;align-items:center;justify-content:center}.premiumClientLeft h2{font-size:4.5mm;margin:10mm 0 2mm;color:#005a55}.premiumClientLeft p{font-size:3.6mm;margin:0 0 6mm}.premiumClientLeft span{display:block;width:38mm;border-top:.35mm dotted #c6d1d1}.premiumClientDetails{padding:3mm 5mm;display:grid}.premiumClientDetails div{display:grid;grid-template-columns:38mm 1fr;align-items:center;min-height:7.5mm;font-size:3.3mm;border-bottom:.3mm dotted #c6d1d1}.premiumClientDetails b,.premiumClientDetails span{font-size:3.3mm;color:#111}.premiumInvoiceTable{width:100%;margin:0 0 6mm;border-collapse:separate;border-spacing:0;border:.25mm solid #d0d0d0;table-layout:fixed}.premiumInvoiceTable th{background:#004a48;color:#fff;font-size:3.05mm;padding:3mm 1.5mm;border:.25mm solid #3d716d;text-align:center}.premiumInvoiceTable td{height:18mm;color:#111;background:#fff;border:.25mm solid #d6d6d6;font-size:3.45mm;padding:3mm;text-align:center}.premiumInvoiceTable td:nth-child(2){text-align:left}.premiumInvoiceTable em{font-size:3mm}.premiumTotalsGrid{display:grid;grid-template-columns:1fr 1.08fr;gap:7mm}.amountWordsCard{display:grid;grid-template-columns:22mm 1fr;min-height:32mm;padding:4.5mm;border:.35mm solid #d0d0d0;border-radius:2mm}.docIcon{width:16mm;height:16mm;border-radius:50%;font-size:7mm;background:#004a48;color:#fff;display:flex;align-items:center;justify-content:center}.amountWordsCard p{font-size:3.2mm;margin:0 0 1.6mm}.amountWordsCard h2{font-size:4.7mm;line-height:1.18;color:#005a55;margin:0}.amountWordsCard h3{font-size:4mm;color:#005a55;margin:2mm 0 0}.totalCard{border:.35mm solid #d0d0d0;border-radius:2mm;overflow:hidden}.totalLineV2{display:flex;justify-content:space-between;padding:3.5mm 5mm;border-bottom:.25mm solid #d0d0d0;font-size:3.5mm}.totalFinalV2{display:flex;justify-content:space-between;background:#004a48;color:#fff;border-left:1.6mm solid #d49b08;padding:4.6mm 5mm;font-size:5.3mm;line-height:1;font-weight:1000}.totalFinalV2 span:last-child{font-size:6.4mm}.premiumBottomWave{display:none}@media print{.printToolbar{display:none}.invoiceA4{margin:0;width:210mm;min-height:297mm;box-shadow:none}.g3pf{left:7mm;right:7mm}}
`;}

function invoiceA4HeaderHTML(company){
  return globalPrintHeaderHTML(company);
}

function standaloneInvoiceHTML(company,s,ref,dt){
  const invoiceBody=premiumSaleInvoiceHTML(company,s,ref,dt).replace(/<div class="reportBox premiumInvoice premiumInvoiceModel">|<div class="reportBox premiumInvoice premiumInvoiceModel onePageInvoice">/,'<div class="premiumInvoiceModel">');
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Facture '+esc(ref)+'</title><style>'+invoicePrintStyles()+'</style></head><body><div class="printToolbar"><button onclick="window.print()">Imprimer / PDF</button><button onclick="window.close()">Fermer</button></div><div class="invoiceA4">'+invoiceA4HeaderHTML(company)+invoiceBody+globalPrintFooterHTML(company,'Facture / reçu')+'</div><script>setTimeout(function(){window.focus()},200);</script></body></html>';
}

function openSalePdfPage(sid){
  const {d,company}=current();
  const s=(d.sales||[]).find(x=>x.companyId===company.id&&x.id===sid);
  if(!s) return alert('Vente introuvable');
  const ref=s.id, dt=new Date(s.date).toLocaleString('fr-FR');
  const html=standaloneInvoiceHTML(company,s,ref,dt);
  const w=window.open('','_blank');
  if(!w){
    const blob=new Blob([html],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    location.href=url;
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}




/* Correctif PDF ÉTAT DU STOCK : page A4 professionnelle dédiée — catégories flexibles */
function stockPrintStyles(){return globalPrintThemeStyles('portrait')+`
@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}.printToolbar{position:fixed;top:10px;right:10px;z-index:50;display:flex;gap:8px}.printToolbar button{border:0;border-radius:12px;padding:11px 14px;font-weight:900;cursor:pointer;background:#00625d;color:#fff}.printToolbar button:first-child{background:#e1a500;color:#062b29}.stockA4{position:relative;width:210mm;min-height:297mm;margin:0 auto;background:#fff;overflow:visible;padding:6mm 5mm 18mm}.stockTitle{text-align:center;margin:0 0 4mm}.stockTitle h1{font-size:6.6mm;line-height:1;color:#004a48;letter-spacing:.02em;margin:0;text-transform:uppercase}.stockTitleDecor{display:flex;align-items:center;justify-content:center;gap:2mm;margin-top:3mm}.stockTitleDecor:before,.stockTitleDecor:after{content:"";width:48mm;border-top:.45mm solid #d49b08}.stockTitleDecor i{width:2.2mm;height:2.2mm;background:#e5aa14;border-radius:50%;display:block;box-shadow:4mm 0 #e5aa14,-4mm 0 #e5aa14}.stockCatStrip{display:grid;grid-template-columns:14mm 1.35fr 1fr;align-items:center;max-width:150mm;margin:0 auto 6mm;border:.45mm solid #006a68;border-radius:9mm;overflow:hidden;min-height:12mm}.stockCatIcon{height:100%;background:#e7aa17;color:#fff;display:flex;align-items:center;justify-content:center;font-size:5mm}.stockCatMain{height:100%;background:#006a68;color:#fff;display:flex;align-items:center;padding:0 7mm;font-size:4.3mm;font-weight:1000}.stockCatName{text-align:center;color:#005d59;font-size:3.7mm;font-weight:1000;padding:0 3mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.stockSummary{display:grid;grid-template-columns:1.1fr 1fr 1fr 1.18fr;gap:2.5mm;margin:0 0 6mm}.stockCard{min-height:23mm;border:.3mm solid #dbe7e4;border-radius:3mm;padding:3.2mm;display:grid;grid-template-columns:14mm 1fr;align-items:center;background:#f5fbfa}.stockCard:nth-child(2){background:#fff8ea}.stockCard:nth-child(3){background:#eef8fd}.stockCard:nth-child(4){background:#f1faf5}.stockCardIcon{width:11mm;height:11mm;border-radius:50%;border:.6mm solid #006a68;color:#006a68;display:flex;align-items:center;justify-content:center;font-size:5.5mm}.stockCard:nth-child(2) .stockCardIcon{border-color:#e5a511;color:#e5a511}.stockCard small{display:block;font-size:2.2mm;font-weight:1000;color:#005a57;text-transform:uppercase;margin-bottom:1mm}.stockCard b{display:block;font-size:4.7mm;color:#064b49;line-height:1.05}.stockCard em{display:block;font-size:2.35mm;color:#151515;font-style:normal;font-weight:800;margin-top:1.4mm}.stockSubTitle{display:flex;align-items:center;gap:4mm;margin:0 0 3mm;color:#005b58}.stockSubTitle:before,.stockSubTitle:after{content:"";flex:1;border-top:.45mm solid #006a68}.stockSubTitle h2{margin:0;text-align:center;font-size:4mm;text-transform:uppercase;white-space:nowrap}.stockTable{width:100%;border-collapse:collapse;table-layout:fixed;font-size:2.25mm;page-break-inside:auto;margin-bottom:4mm}.stockTable thead{display:table-header-group}.stockTable tr{page-break-inside:avoid;break-inside:avoid}.stockTable th{background:#006a68;color:#fff;border:.25mm solid #397d79;text-align:center;text-transform:uppercase;font-weight:1000;padding:2.2mm .65mm;line-height:1.05}.stockTable th small{display:block;color:#ffc400;font-size:1.75mm;margin-top:.5mm}.stockTable td{border:.25mm solid #d0d6d5;color:#111;padding:1.75mm .8mm;line-height:1.1;font-weight:700;vertical-align:middle;overflow-wrap:anywhere}.stockTable tbody tr:nth-child(even) td{background:#f8faf9}.stockTable td:first-child,.stockTable td:nth-child(3),.stockTable td:nth-child(n+4){text-align:center}.stockTable td:nth-child(2){font-weight:900;text-align:left}.stockNum{display:inline-flex;align-items:center;justify-content:center;min-width:5.5mm;height:5.5mm;background:#006a68;color:#fff;border-radius:1.5mm;font-weight:1000}.stockTable tr.total td{background:#006a68!important;color:#fff!important;font-weight:1000;border-color:#006a68}.stockTable tr.total td:nth-child(2){color:#ffc400!important;text-align:left}.stockFinancial{display:grid;grid-template-columns:1fr 1fr;gap:0;border:.3mm solid #dce8e5;border-radius:3mm;overflow:hidden;max-width:172mm;margin:0 auto 5mm;background:linear-gradient(90deg,#eef8f7,#fff6e6)}.stockFinancial>div{display:grid;grid-template-columns:16mm 1fr;align-items:center;gap:3mm;padding:4mm 8mm}.stockFinancial>div+div{border-left:.45mm solid #006a68}.stockFinancial .stockCardIcon{width:13mm;height:13mm}.stockFinancial small{font-size:2.35mm;font-weight:1000;color:#005a57}.stockFinancial b{font-size:5.3mm;color:#055654}.emptyCell{color:#777;text-align:center;padding:8mm!important}@media print{.printToolbar{display:none!important}body{background:#fff!important}.stockA4{margin:0!important;width:210mm!important;min-height:297mm!important;box-shadow:none!important;padding-bottom:18mm!important}.stockTable thead{display:table-header-group}.g3pf{left:5mm;right:5mm}}
`;}

function stockA4HTML(company,items,categoryTitle){
  const rowsData=(items||[]).map(i=>{
    const boutique=isBoutiqueItem(i);
    const qty=boutique?(String(i.stockType||'limited').toLowerCase()==='unlimited'?0:Number(i.stock||0)):0;
    const buy=boutique?Number(i.buy||0):0;
    const sell=Number(i.sell||0);
    const valueBuy=qty*buy;
    const valueSale=qty*sell;
    const valueMargin=valueSale-valueBuy;
    const margin=sell>0?((sell-buy)/sell)*100:0;
    return {i,boutique,qty,buy,sell,valueBuy,valueSale,valueMargin,margin};
  });
  const totalQty=rowsData.reduce((a,r)=>a+r.qty,0);
  const totalBuy=rowsData.reduce((a,r)=>a+r.valueBuy,0);
  const totalSale=rowsData.reduce((a,r)=>a+r.valueSale,0);
  const totalValueMargin=totalSale-totalBuy;
  const totalMargin=totalSale>0?(totalValueMargin/totalSale)*100:0;
  const cats=[...new Set(rowsData.map(r=>String(r.i.cat||'').trim()).filter(Boolean))];
  const catName=categoryTitle || (cats.length===1?cats[0]:'Toutes les catégories');
  const categoryLabel=(categoryTitle||cats.length===1)?String(catName).toUpperCase():'RAPPORT GESTION DE STOCK';
  const rows=rowsData.map((r,idx)=>`<tr><td><span class="stockNum">${idx+1}</span></td><td>${esc(r.i.name||'')}</td><td>${r.boutique?'Produit':'Service'}</td><td>${r.boutique?(String(r.i.stockType||'limited').toLowerCase()==='unlimited'?'Illimité':r.qty):'—'}</td><td>${r.boutique?Number(r.buy).toLocaleString('fr-FR'):'—'}</td><td>${Number(r.sell).toLocaleString('fr-FR')}</td><td>${r.boutique?Number(r.valueBuy).toLocaleString('fr-FR'):'—'}</td><td>${r.boutique?r.margin.toLocaleString('fr-FR',{maximumFractionDigits:2})+'%':'—'}</td><td>${r.boutique?Number(r.valueMargin).toLocaleString('fr-FR'):'—'}</td></tr>`).join('') || '<tr><td colspan="9" class="emptyCell">Aucun produit ou service enregistré.</td></tr>';
  return `<div class="stockA4">${globalPrintHeaderHTML(company)}<div class="stockTitle"><h1>LISTE DES CATÉGORIES</h1><div class="stockTitleDecor"><i></i></div></div><div class="stockCatStrip"><div class="stockCatIcon">▣</div><div class="stockCatMain">Rapport gestion de stock</div><div class="stockCatName">${esc(catName)}</div></div><div class="stockSummary"><div class="stockCard"><span class="stockCardIcon">□</span><div><small>Catégorie</small><b>${esc(categoryLabel)}</b></div></div><div class="stockCard"><span class="stockCardIcon">▦</span><div><small>Nombre d’éléments</small><b>${rowsData.length}</b><em>Produits / services</em></div></div><div class="stockCard"><span class="stockCardIcon">▤</span><div><small>Quantité totale</small><b>${totalQty}</b><em>Unités en stock</em></div></div><div class="stockCard"><span class="stockCardIcon">$</span><div><small>Valeur totale stock</small><b>${money(totalSale)}</b><em>Vente totale estimée</em></div></div></div><div class="stockSubTitle"><h2>ÉTAT DU STOCK — CATÉGORIE : ${esc(categoryLabel)}</h2></div><table class="stockTable"><colgroup><col style="width:5.5%"><col style="width:23.5%"><col style="width:9%"><col style="width:7.5%"><col style="width:10.5%"><col style="width:11%"><col style="width:12%"><col style="width:9.5%"><col style="width:11.5%"></colgroup><thead><tr><th>N°</th><th>Élément</th><th>Type</th><th>Qté</th><th>Achat U.<small>(FCFA)</small></th><th>Vente / Prix<small>(FCFA)</small></th><th>Valeur achat<small>(FCFA)</small></th><th>Marge<small>(%)</small></th><th>Valeur Marge<small>(FCFA)</small></th></tr></thead><tbody>${rows}<tr class="total"><td></td><td colspan="2">TOTAUX</td><td>${totalQty}</td><td></td><td></td><td>${Number(totalBuy).toLocaleString('fr-FR')}</td><td>${totalMargin.toLocaleString('fr-FR',{maximumFractionDigits:2})}%</td><td>${Number(totalValueMargin).toLocaleString('fr-FR')}</td></tr></tbody></table><div class="stockFinancial"><div><span class="stockCardIcon">□</span><div><small>VALEUR TOTALE D’ACHAT</small><b>${money(totalBuy)}</b></div></div><div><span class="stockCardIcon">$</span><div><small>VALEUR TOTALE DE VENTE</small><b>${money(totalSale)}</b></div></div></div>${globalPrintFooterHTML(company,'Rapport de stock')}</div>`;
}

function standaloneStockHTML(company,items,categoryTitle){
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(categoryTitle?'Stock - '+categoryTitle:'État du stock')+'</title><style>'+stockPrintStyles()+'</style></head><body><div class="printToolbar"><button onclick="window.print()">Imprimer / PDF</button><button onclick="window.close()">Fermer</button></div>'+stockA4HTML(company,items,categoryTitle)+'<script>setTimeout(function(){window.focus();},200);</script></body></html>';
}
function openStockPdfPage(){
  const {d,company}=current();
  const items=(d.items||[]).filter(i=>i.companyId===company.id);
  const html=standaloneStockHTML(company,items,'');
  const w=window.open('','_blank');
  if(!w){const blob=new Blob([html],{type:'text/html;charset=utf-8'}); const url=URL.createObjectURL(blob); location.href=url; return;}
  w.document.open(); w.document.write(html); w.document.close();
}
function openStockCategoryPdfPage(catEncoded){
  const {d,company}=current();
  const cat=decodeURIComponent(catEncoded||'');
  const items=(d.items||[]).filter(i=>i.companyId===company.id && String(i.cat||'').trim()===cat);
  const html=standaloneStockHTML(company,items,cat);
  const w=window.open('','_blank');
  if(!w){const blob=new Blob([html],{type:'text/html;charset=utf-8'}); const url=URL.createObjectURL(blob); location.href=url; return;}
  w.document.open(); w.document.write(html); w.document.close();
}

function serviceReportPrintStyles(){return globalPrintThemeStyles('portrait')+`
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#061f1f;-webkit-print-color-adjust:exact;print-color-adjust:exact}.printToolbar{position:fixed;top:10px;right:10px;z-index:999;display:flex;gap:8px}.printToolbar button{border:0;border-radius:10px;padding:10px 14px;font-weight:900;cursor:pointer;background:#00625d;color:#fff}.printToolbar button:first-child{background:#e1a500;color:#062b29}.reportA4{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:6mm 7mm 18mm;position:relative;box-shadow:0 0 18px rgba(0,0,0,.18);overflow:visible}.rHeader{display:grid;grid-template-columns:34mm 1fr 1fr 1.08fr;gap:5mm;align-items:start;margin-bottom:5mm}.rLogo{text-align:center}.rLogoBox{width:19mm;height:19mm;border:1.2mm solid #009287;border-radius:4mm;margin:0 auto 2mm;display:flex;align-items:center;justify-content:center;color:#009287;font-size:10mm;font-weight:1000;line-height:1}.rLogo small{display:block;font-size:2mm;line-height:1.18;color:#111}.rInfo{border-left:.35mm solid #d3d3d3;padding-left:3mm;min-height:24mm}.rInfo p{font-size:2.85mm;line-height:1.2;margin:0 0 2.5mm;color:#111;white-space:normal;overflow-wrap:anywhere}.rInfo b{font-weight:1000}.topLine{height:.55mm;background:#008b82;margin:0 0 10mm}.reportTitle{text-align:center;margin:0 0 4mm}.reportTitle h1{font-size:5.2mm;line-height:1.15;color:#004a48;letter-spacing:.04em;margin:0;text-transform:uppercase;font-weight:1000}.goldLine{height:.45mm;background:#d8a700;margin:0 0 9mm}.summary{margin:0 0 8mm;font-size:4.5mm;line-height:1.25;color:#082020}.summary b{font-weight:1000}.blockTitle{height:8.5mm;background:#004a48;color:#ffd84a;display:flex;align-items:center;justify-content:center;text-transform:uppercase;font-size:3.25mm;font-weight:1000;letter-spacing:.03em;margin:0 0 3.5mm}.reportTable{width:100%;border-collapse:collapse;table-layout:fixed;font-size:2.05mm;margin:0 0 8mm}.reportTable th{background:#eaf2ef;color:#004a48;border:.25mm solid #b9c6c4;text-align:center;text-transform:uppercase;font-weight:1000;padding:1.7mm 1mm;line-height:1.05}.reportTable td{border:.25mm solid #c8cdcc;color:#111;background:#fff;padding:2.1mm 1.2mm;line-height:1.15;vertical-align:middle;word-break:normal;overflow-wrap:anywhere}.reportTable td:nth-child(4),.reportTable td:nth-child(6),.reportTable td:nth-child(7),.reportTable td:nth-child(8){text-align:center}.reportTable td:nth-child(8){text-align:right}.saleBadge{display:inline-block;margin-top:1mm;background:#fff2b8;color:#111;border:.25mm solid #caa600;border-radius:5mm;padding:.4mm 1.2mm;font-size:1.8mm;font-weight:900}.totalStrip{width:100%;border:.35mm solid #d8a700;background:#fff2b8;min-height:8mm;display:flex;align-items:center;justify-content:flex-end;text-align:right;padding:2mm 3mm;font-size:3mm;font-weight:1000;color:#000;margin-top:2mm}.reportMeta{display:none}.emptyCell{text-align:center;color:#666;padding:8mm!important}.pageFiller{height:120mm}@media print{.printToolbar{display:none!important}@page{size:A4 portrait;margin:0}html,body{background:#fff!important;margin:0!important;padding:0!important}.reportA4{margin:0!important;width:210mm!important;min-height:297mm!important;box-shadow:none!important;overflow:visible!important;page-break-after:avoid!important}.reportTable thead{display:table-header-group}.reportTable tr{page-break-inside:avoid;break-inside:avoid}.pageFiller{height:auto}}
`;}
function serviceReportA4HTML(company,sales,admin=false,periodLabel=''){
  const month=monthsList[getActiveMonth()];
  const year=getManageYear();
  const sorted=(sales||[]).slice().sort((a,b)=>new Date(b.date)-new Date(a.date));
  const total=sorted.reduce((a,b)=>a+Number(b.total||0),0);
  const profit=sorted.reduce((a,b)=>a+Number(b.profit||0),0);
  const allItems=(seed().items||[]).filter(i=>i.companyId===company.id);
  const rows=sorted.map(s=>{const user=(seed().users||[]).find(u=>u.id===s.userId);const clientTxt=s.client||'Non précisé';const clientName=clientTxt.replace(/\s*\/\s*.*/,'')||'Non précisé';const badge=s.clientType==='contrat'?'Contrat':'Simple';const caisse=user?.role||'admin';const inf=saleItemInfo(allItems,s);return `<tr><td>${esc(s.id||'')}</td><td>${new Date(s.date).toLocaleString('fr-FR')}</td><td>${esc(clientName)}<br><span class="saleBadge">${badge}</span></td><td><span class="saleBadge">${esc(caisse)}</span></td><td>${esc(inf.name)}</td><td>${Number(s.qty||1)}</td><td>${money(s.serviceFee||0)}</td><td>${money(s.total||0)}</td></tr>`}).join('') || '<tr><td colspan="8" class="emptyCell">Aucune vente validée disponible.</td></tr>';
  return `<div class="reportA4">${globalPrintHeaderHTML(company)}<div class="reportTitle"><h1>RAPPORT GÉNÉRAL DÉTAILLÉ DES SERVICES VENDUS</h1></div><div class="goldLine"></div><div class="summary"><div>Période <b>${esc(periodLabel||('Exercice actif : '+month+' '+year))}</b></div><div>Commandes validées <b>${sorted.length}</b></div><div>Total ventes <b>${money(total)}</b></div></div><table class="reportTable"><colgroup><col style="width:14%"><col style="width:16%"><col style="width:18%"><col style="width:10%"><col style="width:18%"><col style="width:6%"><col style="width:9%"><col style="width:9%"></colgroup><thead><tr><th>N° Facture</th><th>Date</th><th>Client</th><th>Caisse</th><th>Service / Produit</th><th>Qté</th><th>Frais service</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="totalStrip">TOTAL ${esc(periodLabel||('EXERCICE '+month+' '+year)).toUpperCase()} : ${money(total)}${admin?' | Bénéfice : '+money(profit):''}</div><div class="pageFiller"></div>${globalPrintFooterHTML(company,'Rapport des ventes')}</div>`;
}

function standaloneServiceReportHTML(company,sales,admin=false,periodLabel=''){return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapport services vendus</title><style>'+serviceReportPrintStyles()+'</style></head><body><div class="printToolbar"><button onclick="window.print()">Imprimer / PDF</button><button onclick="window.close()">Fermer</button></div>'+serviceReportA4HTML(company,sales,admin,periodLabel)+'<script>setTimeout(function(){window.focus()},200);</script></body></html>';}
function openServiceReportPdfPage(){
  const {company,admin}=current();
  const sales=getServiceReportFilteredSalesForPrint();
  const periodLabel=$('#serviceReportPeriodLabel')?.textContent||'';
  const html=standaloneServiceReportHTML(company,sales,admin,periodLabel);
  const w=window.open('','_blank');
  if(!w){const blob=new Blob([html],{type:'text/html;charset=utf-8'}); const url=URL.createObjectURL(blob); location.href=url; return;}
  w.document.open(); w.document.write(html); w.document.close();
}

function yearManagementPrintStyles(){return globalPrintThemeStyles('portrait')+`
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#062b29;-webkit-print-color-adjust:exact;print-color-adjust:exact}.printToolbar{position:fixed;top:10px;right:10px;z-index:999;display:flex;gap:8px}.printToolbar button{border:0;border-radius:10px;padding:10px 14px;font-weight:900;cursor:pointer;background:#00625d;color:#fff}.printToolbar button:first-child{background:#e1a500;color:#062b29}.yearA4{width:210mm;height:297mm;margin:0 auto;background:#fff;padding:5mm 6.5mm 18mm;position:relative;box-shadow:0 0 18px rgba(0,0,0,.18);overflow:hidden}.yHeader{display:grid;grid-template-columns:32mm 1fr 1fr 1.08fr;gap:4.5mm;align-items:start;margin-bottom:4mm}.yLogo{text-align:center}.yLogoBox{width:19mm;height:19mm;border:1.1mm solid #009287;border-radius:4mm;margin:0 auto 1.5mm;display:flex;align-items:center;justify-content:center;color:#009287;font-size:10mm;font-weight:1000;line-height:1}.yLogo small{display:block;font-size:1.9mm;line-height:1.12;color:#111}.yInfo{border-left:.35mm solid #d3d3d3;padding-left:2.8mm;min-height:23mm}.yInfo p{font-size:2.65mm;line-height:1.14;margin:0 0 2.05mm;color:#111;white-space:normal;overflow-wrap:anywhere}.yInfo b{font-weight:1000}.yTopLine{height:.55mm;background:#008b82;margin:0 0 3mm}.yBanner{height:13.2mm;background:#004a48;color:#ffd84a;display:flex;align-items:center;text-transform:uppercase;font-size:3.55mm;font-weight:1000;letter-spacing:.02em;margin:0 0 7mm;padding:0 5.2mm;position:relative}.yBanner:before{content:'';width:1.35mm;height:8mm;border-radius:3mm;background:#ffd84a;margin-right:2.4mm}.yearPanel{border:.32mm solid #e5c248;border-radius:2.4mm;padding:2.7mm 2.8mm 2.9mm;background:#fffdf8}.yearPanelTitle{text-align:center;margin:0 0 2.7mm}.yearPanelTitle h1{font-size:3.85mm;line-height:1.05;color:#004a48;letter-spacing:.02em;margin:0;text-transform:uppercase;font-weight:1000}.yearPanelTitle h3{font-size:2.2mm;line-height:1.05;color:#7b6100;margin:.6mm 0 0;font-weight:900}.yMonthsGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:2.1mm;margin:0 0 2.8mm}.yMonthCard{height:24.2mm;border:.25mm solid #ead799;border-radius:2mm;padding:2.35mm 2.7mm;background:#fffef9;color:#073432;display:flex;flex-direction:column;justify-content:space-between;break-inside:avoid}.yMonthCard.active{background:#fff6cf;border-color:#e0b000}.yMonthCard h4{margin:0 0 1.8mm;font-size:2.75mm;color:#004a48;font-weight:1000}.yMonthCard p{margin:0;font-size:2.2mm;line-height:1.15;color:#173f3c}.yMonthCard b{font-weight:1000;color:#001c1b}.yOpenPill{display:inline-flex;align-items:center;justify-content:center;margin-top:1.6mm;width:25mm;min-height:6mm;border-radius:6mm;background:#e8f8f8;color:#004a48;font-size:2.15mm;font-weight:1000}.yearlyA4Table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:1.95mm;border-radius:1.8mm;overflow:hidden}.yearlyA4Table th{background:#004a48;color:#ffd84a;border:.22mm solid #004a48;text-transform:uppercase;font-weight:1000;text-align:center;padding:1.65mm .55mm;line-height:1.02}.yearlyA4Table th:first-child{text-align:left}.yearlyA4Table td{border:.2mm solid #e5e9e8;background:#fff;color:#153c39;text-align:center;padding:1.35mm .55mm;line-height:1.02;white-space:nowrap}.yearlyA4Table td:first-child{text-align:left;white-space:normal}.yearlyA4Table tr.activeYearRow td{background:#fff6cf!important;font-weight:1000;color:#061f1f}.yearlyA4Table tr.total td{background:#fff0ad!important;font-weight:1000;color:#061f1f}.yearMeta{display:none}@media print{.printToolbar{display:none!important}@page{size:A4 portrait;margin:0}html,body{background:#fff!important;margin:0!important;padding:0!important;width:210mm!important;height:297mm!important;overflow:hidden!important}.yearA4{margin:0!important;width:210mm!important;height:297mm!important;min-height:0!important;box-shadow:none!important;page-break-after:avoid!important;page-break-before:avoid!important;break-after:avoid!important}.yearlyA4Table tr,.yMonthCard{page-break-inside:avoid;break-inside:avoid}}
`;}
function yearManagementA4HTML(company,sales,obligations){
  const year=getManageYear(), activeMonth=getActiveMonth();
  const rows=monthsList.map((m,i)=>{const ms=(sales||[]).filter(s=>{const dt=new Date(s.date);return dt.getFullYear()===year&&dt.getMonth()===i});const monthObligations=getObligationsForMonth(current().d,current().company.id,year,i);const obligationTotal=getMonthlyObligationTotal(monthObligations, ms);const commandes=ms.length, articles=ms.reduce((a,b)=>a+Number(b.qty||0),0), ca=ms.reduce((a,b)=>a+Number(b.total||0),0), serviceFee=ms.reduce((a,b)=>a+Number(b.serviceFee||0),0), charges=ms.reduce((a,b)=>a+Number(b.charges||0),0), benef=ms.reduce((a,b)=>a+Number(b.profit||0),0), net=benef-obligationTotal;return {m,i,commandes,articles,ca,serviceFee,charges,benef,obligations:obligationTotal,net};});
  const total=rows.reduce((a,r)=>({commandes:a.commandes+r.commandes,articles:a.articles+r.articles,ca:a.ca+r.ca,serviceFee:a.serviceFee+r.serviceFee,charges:a.charges+r.charges,benef:a.benef+r.benef,obligations:a.obligations+r.obligations,net:a.net+r.net}),{commandes:0,articles:0,ca:0,serviceFee:0,charges:0,benef:0,obligations:0,net:0});
  const cards=rows.map(r=>`<div class="yMonthCard ${r.i===activeMonth?'active':''}"><div><h4>${esc(r.m)}</h4><p>Commandes : <b>${r.commandes}</b><br>CA : <b>${money(r.ca)}</b><br>Net : <b>${money(r.net)}</b></p></div><span class="yOpenPill">${r.i===activeMonth?'Exercice actif':'Mois de gestion'}</span></div>`).join('');
  const tr=rows.map(r=>`<tr class="${r.i===activeMonth?'activeYearRow':''}"><td>${esc(r.m)}</td><td>${r.commandes}</td><td>${r.articles}</td><td>${money(r.ca)}</td><td>${money(r.serviceFee)}</td><td>${money(r.charges)}</td><td>${money(r.benef)}</td><td>${money(r.obligations)}</td><td>${money(r.net)}</td></tr>`).join('');
  return `<div class="yearA4">${globalPrintHeaderHTML(company)}<div class="yBanner">ANNÉE DE GESTION ADMINISTRATEUR</div><div class="yearPanel"><div class="yearPanelTitle"><h1>TABLEAU DE GESTION SUR 12 MOIS</h1><h3>${esc(company.name||'Entreprise')} — Année ${year}</h3></div><div class="yMonthsGrid">${cards}</div><table class="yearlyA4Table"><colgroup><col style="width:12%"><col style="width:9%"><col style="width:8%"><col style="width:14%"><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:11%"><col style="width:10%"></colgroup><thead><tr><th>Mois</th><th>Commandes</th><th>Articles</th><th>Chiffre d’affaires</th><th>Frais service</th><th>Charges estimées</th><th>Bénéfice estimé</th><th>Obligations</th><th>Résultat net</th></tr></thead><tbody>${tr}<tr class="total"><td>TOTAL ANNUEL</td><td>${total.commandes}</td><td>${total.articles}</td><td>${money(total.ca)}</td><td>${money(total.serviceFee)}</td><td>${money(total.charges)}</td><td>${money(total.benef)}</td><td>${money(total.obligations)}</td><td>${money(total.net)}</td></tr></tbody></table></div>${globalPrintFooterHTML(company,'Gestion annuelle')}</div>`;
}

function standaloneYearManagementHTML(company,sales,obligations){return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tableau de gestion sur 12 mois</title><style>'+yearManagementPrintStyles()+'</style></head><body><div class="printToolbar"><button onclick="window.print()">Imprimer / PDF</button><button onclick="window.close()">Fermer</button></div>'+yearManagementA4HTML(company,sales,obligations)+'<script>setTimeout(function(){window.focus()},200);</script></body></html>';}
function openYearManagementPdfPage(){
  const {d,company}=current();
  /* Impression PDF sans sécurité : le PDF Année de gestion doit s'ouvrir même si le contrôle admin bloque l'interface. */
  const sales=(d.sales||[]).filter(s=>s.companyId===company.id);
  const obligations=getObligations(d,company.id);
  const html=standaloneYearManagementHTML(company,sales,obligations);
  const w=window.open('','_blank');
  if(!w){const blob=new Blob([html],{type:'text/html;charset=utf-8'}); const url=URL.createObjectURL(blob); location.href=url; return;}
  w.document.open(); w.document.write(html); w.document.close();
}
