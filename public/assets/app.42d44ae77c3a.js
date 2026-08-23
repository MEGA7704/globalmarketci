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
function companyCurrency(company){return String(company?.currency||company?.devise||'FCFA').trim().toUpperCase()||'FCFA'}
function companyMoney(n,company){
  const value=Number(n||0);
  const formatted=Number.isInteger(value)?value.toLocaleString('fr-FR'):value.toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:2});
  return formatted+' '+companyCurrency(company);
}
function companyInitials(name='Entreprise'){
  const words=String(name||'Entreprise').trim().split(/\s+/).filter(Boolean);
  return (words.slice(0,2).map(w=>w[0]).join('')||'EN').toUpperCase();
}
function safeCompanyImage(value){
  const src=String(value||'').trim();
  return /^(https?:\/\/|data:image\/(?:png|jpe?g|webp|svg\+xml);base64,)/i.test(src)?src:'';
}
function safeReportColor(value,fallback){return /^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):fallback}
function companyReportProfile(company){
  const c=company||{};
  return {
    id:String(c.id||''), name:String(c.name||'Entreprise'), legalForm:String(c.legalForm||''), capital:String(c.capital||c.shareCapital||''),
    rccm:String(c.rccm||''), taxAccount:String(c.taxAccount||''), address:String(c.address||''), phone:String(c.phone||''), email:String(c.email||''),
    activity:String(c.activity||c.businessType||''), owner:String(c.owner||''), responsibleTitle:String(c.responsibleTitle||c.managerTitle||'LE RESPONSABLE'),
    currency:companyCurrency(c), logo:safeCompanyImage(c.logo||c.logoUrl), signature:safeCompanyImage(c.signature||c.signatureUrl), stamp:safeCompanyImage(c.stamp||c.stampUrl),
    primary:safeReportColor(c.reportColor||c.shopColor,'#004d48'), accent:safeReportColor(c.reportAccent,'#d4aa16')
  };
}
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
window.alert=function(message){
  const text=String(message??'');
  if(/service cloud est (?:temporairement|momentanément) occupé|service cloud est très sollicité|stockage cloud est temporairement occupé|synchronisation temporairement retardée/i.test(text)){
    console.info('[GLOBAL MARKET] synchronisation différée :',text);
    scheduleCloudRefresh(CLOUD_SESSION?'employee':'public',700);
    return;
  }
  g3Alert(message);
};

const CLOUD_KEY='global_market_all';
let CLOUD_DATA=null;
let GM_V6_D1_BOOKMARK='';
let GM_V6_CATALOG_META=null;
let GM_V6_CURRENT_CATALOG_ITEMS=[];
let GM_V6_LAST_GOOD_CATALOG_ITEMS=[];
const GM_V6_CATALOG_CACHE=new Map();
const GM_V610_PUBLIC_CACHE_KEY='global_market_public_catalog_v611';
function gmV610ReadBrowserCatalog(){try{const x=JSON.parse(localStorage.getItem(GM_V610_PUBLIC_CACHE_KEY)||'null');if(!x||!Array.isArray(x.items)||!x.items.length||Date.now()-Number(x.savedAt||0)>7*86400000)return null;return x}catch{return null}}
function gmV610RememberBrowserCatalog(items,companies=[]){try{if(!Array.isArray(items)||!items.length)return;localStorage.setItem(GM_V610_PUBLIC_CACHE_KEY,JSON.stringify({savedAt:Date.now(),items:items.slice(0,96),companies:(companies||[]).slice(0,100)}))}catch{}}
function gmV6RememberGoodCatalog(items){
  if(!Array.isArray(items)||!items.length)return;
  GM_V6_LAST_GOOD_CATALOG_ITEMS=items.map(x=>({...x}));
  for(const it of items)if(it?.id)GM_V6_CATALOG_CACHE.set(it.id,it);
  gmV610RememberBrowserCatalog(items,CLOUD_DATA?.companies||[]);
}
function gmV6IsBaseCatalogRequest(){
  return !String(document.getElementById('globalShopSearch')?.value||'').trim()&&!String(document.getElementById('globalShopType')?.value||'')&&!String(document.getElementById('globalShopCat')?.value||'');
}
function gmV6StableCatalogItems(incoming,authoritativeEmpty=false){
  if(Array.isArray(incoming)&&incoming.length){gmV6RememberGoodCatalog(incoming);return incoming;}
  if(authoritativeEmpty)return [];
  if(GM_V6_CURRENT_CATALOG_ITEMS.length)return GM_V6_CURRENT_CATALOG_ITEMS;
  if(GM_V6_LAST_GOOD_CATALOG_ITEMS.length)return GM_V6_LAST_GOOD_CATALOG_ITEMS;
  const cached=[...GM_V6_CATALOG_CACHE.values()];
  return cached.length?cached:[];
}
let CLOUD_SESSION=null;
let PUBLIC_CLIENT_SESSION=null;
let CLOUD_SAVE_TIMER=null;
let CLOUD_SAVE_IN_FLIGHT=null;
let CLOUD_SAVE_PENDING=false;
let CLOUD_SAVE_RETRY_TIMER=null;
let CLOUD_SAVE_RETRY_DELAY=2500;
let CLOUD_LAST_ACK_DATA=null;
let CLOUD_DATA_READY=false;
let CLOUD_BOOT_SEQUENCE=0;
let CLOUD_REFRESH_TIMER=null;
let CLOUD_REFRESH_IN_FLIGHT=null;
let CLOUD_LAST_REFRESH_MODE='public';
function defaultData(){return {companies:[],users:[],items:[],sales:[],payments:[],orders:[],clients:[],marketClients:[],marketMessages:[],passwordResetRequests:[]}}
function normalizeData(d){d=d&&typeof d==='object'?d:{}; if(d.data&&typeof d.data==='object') d=d.data; const base=defaultData(); return Object.assign(base,d,{companies:Array.isArray(d.companies)?d.companies:[],users:Array.isArray(d.users)?d.users:[],items:Array.isArray(d.items)?d.items:[],sales:Array.isArray(d.sales)?d.sales:[],payments:Array.isArray(d.payments)?d.payments:[],orders:Array.isArray(d.orders)?d.orders:[],clients:Array.isArray(d.clients)?d.clients:[],marketClients:Array.isArray(d.marketClients)?d.marketClients:[],marketMessages:Array.isArray(d.marketMessages)?d.marketMessages:[],passwordResetRequests:Array.isArray(d.passwordResetRequests)?d.passwordResetRequests:[]})}
function rememberCloudCache(){/* Sécurité : aucune base complète n'est conservée dans localStorage. */}
function readCloudCache(){return null}
async function fetchWithTimeout(url,opts={},ms=6500){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);try{const headers=new Headers(opts.headers||{});if(String(url).startsWith('/api/')&&GM_V6_D1_BOOKMARK)headers.set('X-D1-Bookmark',GM_V6_D1_BOOKMARK);const r=await fetch(url,{...opts,headers,credentials:'same-origin',signal:c.signal});const bm=r.headers.get('X-D1-Bookmark');if(bm)GM_V6_D1_BOOKMARK=bm;return r;}finally{clearTimeout(t)}}
async function readApiPayload(r){const j=await r.json().catch(()=>({})); if(!r.ok){const temporary=[408,425,429,500,502,503,504].includes(Number(r.status)); const fallback=temporary?'Le service cloud n’a pas répondu correctement.':'Requête refusée (code '+r.status+').'; const e=new Error(j.error||fallback); e.status=r.status; e.code=j.code||''; e.payload=j; e.retryAfter=Number(r.headers?.get?.('Retry-After')||0); throw e;} return j}
async function fetchApiJsonWithRetry(url,opts={},timeoutMs=12000,attempts=6){
  let lastError=null;
  for(let attempt=0;attempt<attempts;attempt++){
    try{const r=await fetchWithTimeout(url,opts,timeoutMs);return await readApiPayload(r)}catch(error){
      lastError=error;
      if(!isTransientCloudSaveError(error)||attempt===attempts-1)throw error;
      const serverDelay=Math.max(0,Number(error?.retryAfter||0)*1000);
      const backoff=[250,600,1200,2200,3800,6000,9000][Math.min(attempt,6)];
      await waitMs(Math.max(serverDelay,backoff)+Math.floor(Math.random()*180));
    }
  }
  throw lastError||new Error('Service cloud indisponible.');
}
function employeeSecurityHeaders(extra={}){return {'Content-Type':'application/json',...(CLOUD_SESSION?.csrfToken?{'X-CSRF-Token':CLOUD_SESSION.csrfToken}:{}),...extra}}
function clientSecurityHeaders(extra={}){return {'Content-Type':'application/json',...(PUBLIC_CLIENT_SESSION?.csrfToken?{'X-CSRF-Token':PUBLIC_CLIENT_SESSION.csrfToken}:{}),...extra}}
function cloneCloudData(value){return value==null?value:JSON.parse(JSON.stringify(value))}
function cloudRowId(row,index){return row&&row.id!=null?String(row.id):`__index_${index}`}
function buildCloudDelta(previous,current){
  const before=previous&&typeof previous==='object'?previous:{};
  const after=current&&typeof current==='object'?current:{};
  const delta={arrays:{},objects:{},values:{}};
  const keys=new Set([...Object.keys(before),...Object.keys(after)]);
  for(const key of keys){
    if(key==='users'||key==='app') continue;
    const a=before[key], b=after[key];
    if(Array.isArray(a)||Array.isArray(b)){
      const oldRows=Array.isArray(a)?a:[], newRows=Array.isArray(b)?b:[];
      const oldMap=new Map(oldRows.map((row,index)=>[cloudRowId(row,index),row]));
      const newMap=new Map(newRows.map((row,index)=>[cloudRowId(row,index),row]));
      const upserts=[],deletes=[];
      for(const [id,row] of newMap){const old=oldMap.get(id); if(!old||JSON.stringify(old)!==JSON.stringify(row)) upserts.push(row)}
      for(const [id,row] of oldMap) if(!newMap.has(id)) deletes.push({id,companyId:String(row?.companyId||CLOUD_SESSION?.companyId||'')});
      if(upserts.length||deletes.length) delta.arrays[key]={upserts,deletes};
      continue;
    }
    const aObj=a&&typeof a==='object', bObj=b&&typeof b==='object';
    if(aObj||bObj){
      const oldObj=aObj?a:{}, newObj=bObj?b:{};
      const upserts=[],deletes=[];
      for(const recordId of new Set([...Object.keys(oldObj),...Object.keys(newObj)])){
        if(!Object.prototype.hasOwnProperty.call(newObj,recordId)){deletes.push({recordId,companyId:String(CLOUD_SESSION?.companyId||recordId)});continue}
        if(!Object.prototype.hasOwnProperty.call(oldObj,recordId)||JSON.stringify(oldObj[recordId])!==JSON.stringify(newObj[recordId])){
          let companyId=String(CLOUD_SESSION?.companyId||recordId);
          if(key==='clientDeletedOrders'){const client=(after.marketClients||[]).find(x=>String(x.id)===String(recordId)); companyId=String(client?.companyId||companyId)}
          upserts.push({recordId,companyId,value:newObj[recordId]});
        }
      }
      if(upserts.length||deletes.length) delta.objects[key]={upserts,deletes};
      continue;
    }
    if(JSON.stringify(a)!==JSON.stringify(b)) delta.values[key]=b;
  }
  return delta;
}
function cloudDeltaIsEmpty(delta){return !Object.keys(delta?.arrays||{}).length&&!Object.keys(delta?.objects||{}).length&&!Object.keys(delta?.values||{}).length}
function scheduleCloudRefresh(mode=CLOUD_SESSION?'employee':'public',delay=1800){
  CLOUD_LAST_REFRESH_MODE=mode;
  if(CLOUD_REFRESH_TIMER||document.hidden||!navigator.onLine)return;
  CLOUD_REFRESH_TIMER=setTimeout(async()=>{
    CLOUD_REFRESH_TIMER=null;
    if(CLOUD_REFRESH_IN_FLIGHT)return;
    CLOUD_REFRESH_IN_FLIGHT=(async()=>{
      try{
        if(CLOUD_LAST_REFRESH_MODE==='employee'&&CLOUD_SESSION)await cloudLoadData({allowStale:false,background:true});
        else await cloudLoadPublicData({allowStale:false,background:true});
        if(location.hash==='#home'||!CLOUD_SESSION)renderGlobalShop();else render();
      }catch(e){if(isTransientCloudSaveError(e))scheduleCloudRefresh(CLOUD_LAST_REFRESH_MODE,Math.min(15000,delay*2));else console.warn('Actualisation cloud différée',e)}
    })();
    try{await CLOUD_REFRESH_IN_FLIGHT}finally{CLOUD_REFRESH_IN_FLIGHT=null}
  },delay);
}
async function cloudLoadData(options={}){
  const allowStale=options.allowStale!==false;
  try{
    const j=await fetchApiJsonWithRetry('/api/load',{cache:'no-store'},12000,2);
    CLOUD_DATA=normalizeData(j); CLOUD_LAST_ACK_DATA=cloneCloudData(CLOUD_DATA); CLOUD_DATA_READY=true; return CLOUD_DATA;
  }catch(error){
    if(allowStale&&isTransientCloudSaveError(error)&&CLOUD_DATA&&CLOUD_DATA_READY){scheduleCloudRefresh('employee');return CLOUD_DATA}
    throw error;
  }
}
async function cloudLoadPublicData(options={}){
  const allowStale=options.allowStale!==false;
  try{
    const j=await fetchApiJsonWithRetry('/api/v6/bootstrap?page=1&pageSize=16',{cache:'no-store'},12000,2);
    PUBLIC_CLIENT_SESSION=j.clientSession||PUBLIC_CLIENT_SESSION||null; GM_V6_CATALOG_META=j.catalogMeta||GM_V6_CATALOG_META; const authoritativeEmpty=Boolean(j.catalogMeta?.authoritativeEmpty); const stable=gmV6StableCatalogItems(Array.isArray(j.items)?j.items:[],authoritativeEmpty); if(stable.length||authoritativeEmpty)GM_V6_CURRENT_CATALOG_ITEMS=stable; if(!Array.isArray(j.items)||(!j.items.length&&stable.length))j.items=stable; for(const it of stable)if(it?.id)GM_V6_CATALOG_CACHE.set(it.id,it); CLOUD_DATA=normalizeData(j); if(stable.length)gmV610RememberBrowserCatalog(stable,CLOUD_DATA.companies||[]); if(!authoritativeEmpty&&GM_V6_CATALOG_CACHE.size)CLOUD_DATA.items=[...GM_V6_CATALOG_CACHE.values()]; CLOUD_LAST_ACK_DATA=cloneCloudData(CLOUD_DATA); CLOUD_DATA_READY=true; if(PUBLIC_CLIENT_SESSION?.clientId) window.publicShopClientId=PUBLIC_CLIENT_SESSION.clientId; else window.publicShopClientId=''; return CLOUD_DATA;
  }catch(error){
    if(allowStale&&isTransientCloudSaveError(error)&&CLOUD_DATA&&CLOUD_DATA_READY){scheduleCloudRefresh('public');return CLOUD_DATA}
    const browser=gmV610ReadBrowserCatalog();
    if(browser?.items?.length){GM_V6_CURRENT_CATALOG_ITEMS=browser.items;for(const it of browser.items)if(it?.id)GM_V6_CATALOG_CACHE.set(it.id,it);CLOUD_DATA=normalizeData({companies:browser.companies||[],items:browser.items});CLOUD_DATA_READY=true;scheduleCloudRefresh('public',1800);return CLOUD_DATA}
    throw error;
  }
}
function waitMs(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function isTransientCloudSaveError(error){return !error?.status||[408,425,429,500,502,503,504].includes(Number(error.status))||error?.name==='AbortError'}
function scheduleCloudSaveRetry(){
  if(CLOUD_SAVE_RETRY_TIMER||!CLOUD_SESSION) return;
  const delay=CLOUD_SAVE_RETRY_DELAY;
  CLOUD_SAVE_RETRY_DELAY=Math.min(60000,Math.round(CLOUD_SAVE_RETRY_DELAY*1.8));
  CLOUD_SAVE_RETRY_TIMER=setTimeout(()=>{CLOUD_SAVE_RETRY_TIMER=null;cloudSaveNow(CLOUD_DATA).catch(handleCloudSaveFailure)},delay);
}
async function sendCloudSavePayload(payload){
  let lastError=null;
  for(let attempt=0;attempt<5;attempt++){
    try{
      const r=await fetchWithTimeout('/api/save-delta',{method:'POST',headers:employeeSecurityHeaders(),body:payload,cache:'no-store'},20000);
      return await readApiPayload(r);
    }catch(error){
      lastError=error;
      if(!isTransientCloudSaveError(error)||attempt===4) throw error;
      await waitMs([400,900,1800,3500,6500][attempt]+Math.floor(Math.random()*300));
    }
  }
  throw lastError||new Error('Sauvegarde impossible.');
}
async function cloudSaveNow(d=CLOUD_DATA){
  if(!d||!CLOUD_SESSION) return;
  CLOUD_DATA=normalizeData(d);
  CLOUD_SAVE_PENDING=true;
  if(CLOUD_SAVE_IN_FLIGHT) return CLOUD_SAVE_IN_FLIGHT;
  CLOUD_SAVE_IN_FLIGHT=(async()=>{
    let response=null;
    while(CLOUD_SAVE_PENDING&&CLOUD_SESSION){
      CLOUD_SAVE_PENDING=false;
      const snapshot=cloneCloudData(CLOUD_DATA);
      const delta=buildCloudDelta(CLOUD_LAST_ACK_DATA||snapshot,snapshot);
      if(cloudDeltaIsEmpty(delta)){CLOUD_LAST_ACK_DATA=snapshot;continue}
      try{
        response=await sendCloudSavePayload(JSON.stringify({delta}));
        CLOUD_LAST_ACK_DATA=snapshot;
        CLOUD_SAVE_RETRY_DELAY=2500;
        if(CLOUD_SAVE_RETRY_TIMER){clearTimeout(CLOUD_SAVE_RETRY_TIMER);CLOUD_SAVE_RETRY_TIMER=null}
      }catch(error){
        if(isTransientCloudSaveError(error)){CLOUD_SAVE_PENDING=true;scheduleCloudSaveRetry();return {success:false,queued:true,retry:true}}
        throw error;
      }
    }
    return response;
  })();
  try{return await CLOUD_SAVE_IN_FLIGHT}finally{
    CLOUD_SAVE_IN_FLIGHT=null;
    if(CLOUD_SAVE_PENDING&&CLOUD_SESSION&&!CLOUD_SAVE_RETRY_TIMER) setTimeout(()=>cloudSaveNow(CLOUD_DATA).catch(handleCloudSaveFailure),250);
  }
}
function handleCloudSaveFailure(e){
  console.error(e);
  if(e?.status===401){CLOUD_SESSION=null;alert('Votre session a expiré. Reconnectez-vous.');showGlobalBusinessLogin();return;}
  if(isTransientCloudSaveError(e)){CLOUD_SAVE_PENDING=true;scheduleCloudSaveRetry();return}
  const detail=e?.code?`${e.message} (${e.code})`:e?.message||'Erreur inconnue';
  alert('Enregistrement impossible : '+detail);
}
window.addEventListener('online',()=>{if(CLOUD_SAVE_PENDING&&CLOUD_SESSION) cloudSaveNow(CLOUD_DATA).catch(handleCloudSaveFailure);scheduleCloudRefresh(CLOUD_SESSION?'employee':'public',300)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleCloudRefresh(CLOUD_SESSION?'employee':'public',250)});
window.addEventListener('pagehide',()=>{
  if(!CLOUD_SESSION||!CLOUD_DATA||!CLOUD_LAST_ACK_DATA) return;
  const delta=buildCloudDelta(CLOUD_LAST_ACK_DATA,CLOUD_DATA);
  if(cloudDeltaIsEmpty(delta)) return;
  const payload=JSON.stringify({delta});
  if(payload.length<60000&&navigator.sendBeacon) navigator.sendBeacon('/api/save-delta',new Blob([payload],{type:'application/json'}));
});
async function cloudLoadSession(timeoutMs=3200){
  try{
    const r=await fetchWithTimeout('/api/session',{cache:'no-store'},timeoutMs);
    const j=await readApiPayload(r);
    CLOUD_SESSION=j.session||null;
    if(j.data&&typeof j.data==='object'){
      CLOUD_DATA=normalizeData(j.data);
      CLOUD_LAST_ACK_DATA=cloneCloudData(CLOUD_DATA);
      CLOUD_DATA_READY=true;
    }
  }catch(e){
    CLOUD_SESSION=null;
    CLOUD_DATA_READY=false;
  }
  return CLOUD_SESSION;
}
async function cloudSetSession(){throw new Error('La création directe de session est désactivée. Utilisez la connexion sécurisée.')}
async function cloudClearSession(){const old=CLOUD_SESSION; try{await fetchWithTimeout('/api/session',{method:'DELETE',headers:{'Content-Type':'application/json',...(old?.csrfToken?{'X-CSRF-Token':old.csrfToken}:{})}},4500)}catch(e){console.warn('Déconnexion cloud non confirmée',e)} CLOUD_SESSION=null; CLOUD_DATA=defaultData(); CLOUD_LAST_ACK_DATA=null; CLOUD_DATA_READY=false; if(CLOUD_SAVE_RETRY_TIMER){clearTimeout(CLOUD_SAVE_RETRY_TIMER);CLOUD_SAVE_RETRY_TIMER=null}}
async function cloudStart(){
  const sequence=++CLOUD_BOOT_SEQUENCE;
  const publicRoute=!location.hash||location.hash==='#home'||location.hash==='#'||location.hash.startsWith('#boutique-global')||location.hash.startsWith('#boutique/');
  CLOUD_SESSION=null;
  const browserCatalog=gmV610ReadBrowserCatalog();
  CLOUD_DATA=browserCatalog?.items?.length?normalizeData({companies:browserCatalog.companies||[],items:browserCatalog.items}):defaultData();
  if(browserCatalog?.items?.length){GM_V6_CURRENT_CATALOG_ITEMS=browserCatalog.items;for(const it of browserCatalog.items)if(it?.id)GM_V6_CATALOG_CACHE.set(it.id,it);}
  CLOUD_DATA_READY=Boolean(browserCatalog?.items?.length);
  app.innerHTML='<main class="gmHomeLoader"><div class="gmHomeLoaderMark">GM</div><h1>GLOBAL MARKET</h1><p>Chargement de votre espace produits & services…</p></main>';
  try{
    if(publicRoute){
      await cloudLoadPublicData();
      if(sequence===CLOUD_BOOT_SEQUENCE) render();
      return;
    }
    await cloudLoadSession(7000);
    if(sequence!==CLOUD_BOOT_SEQUENCE)return;
    if(CLOUD_SESSION){
      // La réponse /api/session est volontairement minimale. Toujours charger ensuite
      // les données métier afin que les ventes, commandes, clients et historiques existants réapparaissent.
      if(sequence===CLOUD_BOOT_SEQUENCE)render();
      await cloudLoadData({allowStale:true,background:false});
      if(sequence===CLOUD_BOOT_SEQUENCE)render();
      return;
    }
    location.hash='#home';
    await cloudLoadPublicData();
    if(sequence===CLOUD_BOOT_SEQUENCE)renderGlobalShop();
  }catch(e){
    console.error(e);
    if(sequence===CLOUD_BOOT_SEQUENCE){
      if(!CLOUD_DATA)CLOUD_DATA=defaultData();
      location.hash='#home';
      renderGlobalShop();
      scheduleCloudRefresh('public',1200);
    }
  }
}
function seed(){if(!CLOUD_DATA) CLOUD_DATA=defaultData(); return CLOUD_DATA}
function save(d){CLOUD_DATA=normalizeData(d); if(!CLOUD_SESSION) return; CLOUD_SAVE_PENDING=true; clearTimeout(CLOUD_SAVE_TIMER); CLOUD_SAVE_TIMER=setTimeout(()=>cloudSaveNow(CLOUD_DATA).catch(handleCloudSaveFailure),1400)}
function session(){return CLOUD_SESSION}
function setSession(x){return cloudSetSession(x)}
function logout(){if(FREE_PLAN_REMINDER_TIMER){clearInterval(FREE_PLAN_REMINDER_TIMER);FREE_PLAN_REMINDER_TIMER=null;} FREE_PLAN_LAST_SECTION=''; closeFreePlanUpgradePopup(); cloudClearSession().finally(()=>{location.hash='#home';cloudLoadPublicData().catch(()=>{}).finally(()=>renderGlobalShop())})}
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

function legalModalHtml(){return `<div id="legalPopup" class="legalPopup hidden" role="dialog" aria-modal="true" aria-labelledby="legalTitle"><div class="legalBackdrop" onclick="closeLegalPopup()"></div><div class="legalCard"><button type="button" class="legalClose" aria-label="Fermer" onclick="closeLegalPopup()">×</button><h2 id="legalTitle">Documents légaux GLOBAL MARKET</h2><pre id="legalText"></pre></div></div>`}
function openLegalPopup(type){if(!document.querySelector('#legalPopup'))document.body.insertAdjacentHTML('beforeend',legalModalHtml());const pop=document.querySelector('#legalPopup'),title=document.querySelector('#legalTitle'),text=document.querySelector('#legalText');if(!pop||!title||!text)return;title.textContent=type==='privacy'?'Notre politique de confidentialité':"Conditions générales d'utilisation";text.textContent=type==='privacy'?GLOBAL3_PRIVACY_TEXT:GLOBAL3_CGU_TEXT;pop.classList.remove('hidden')}
function closeLegalPopup(){document.querySelector('#legalPopup')?.classList.add('hidden')}

const GLOBAL_MARKET_LOGIN_LINKS=Object.freeze({supportWhatsapp:'https://wa.me/2250777041790'});

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

function businessUtilityModalsHtml(){return `<div id="registerModal" class="modal hidden gmRegisterModal" aria-hidden="true">
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
</div>`}
function ensureBusinessUtilityModals(){
  if(document.querySelector('#registerModal')||document.querySelector('#forgotPasswordModal'))return;
  document.body.insertAdjacentHTML('beforeend',businessUtilityModalsHtml());
}
function showGlobalBusinessLogin(){
  location.hash='#home';
  return cloudLoadPublicData().catch(()=>{}).finally(()=>{renderGlobalShop();setTimeout(()=>openGlobalBusinessAuth('login'),0)});
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
function openCompanyRegistrationFromShop(){ensureBusinessUtilityModals();openRegisterPopup();}
let REGISTER_REQUEST_IN_PROGRESS=false;
function openRegisterPopup(){
  ensureBusinessUtilityModals();
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
function openForgotPasswordPopup(){ensureBusinessUtilityModals();document.querySelector('#forgotPasswordModal')?.classList.remove('hidden')}
function closeForgotPasswordPopup(){document.querySelector('#forgotPasswordModal')?.classList.add('hidden')}
function makeTempPassword(){const a=new Uint32Array(2);crypto.getRandomValues(a);return 'GG-'+a[0].toString(36).slice(0,5).toUpperCase()+'-'+String(100+(a[1]%900));}
function requestPasswordReset(){
  const d=seed();
  const email=($('#fpEmail')?.value||'').trim().toLowerCase();
  const role=$('#fpRole')?.value||'caisse';
  const phone=($('#fpPhone')?.value||'').trim();
  const reason=($('#fpReason')?.value||'Mot de passe oublié').trim();
  if(!email) return alert('Veuillez saisir votre email / identifiant.');
  const u=(d.users||[]).find(x=>String(x.email||'').toLowerCase()===email);
  if(!u) return alert('Aucun compte trouvé avec cet email. Vérifiez l’identifiant.');
  if(u.role==='superadmin') return alert('Le mot de passe Super Admin ne peut pas être récupéré automatiquement. Utilisez le code maître sécurisé.');
  if(role==='caisse' && u.role!=='caisse') return alert('Ce compte n’est pas un profil Caisse. Sélectionnez le bon profil.');
  if(role==='admin' && u.role!=='admin') return alert('Ce compte n’est pas un profil Administrateur. Sélectionnez le bon profil.');
  d.passwordResetRequests=d.passwordResetRequests||[];
  const old=d.passwordResetRequests.find(r=>r.userId===u.id&&r.status==='pending');
  if(old) return alert('Une demande est déjà en attente pour ce compte. Contactez votre administrateur.');
  d.passwordResetRequests.push({id:id('rst'),companyId:u.companyId,userId:u.id,userName:u.name||'',email:u.email,role:u.role,phone,reason,status:'pending',createdAt:new Date().toISOString()});
  save(d);
  closeForgotPasswordPopup();
  alert(u.role==='admin' ? 'Demande envoyée. Le Super Admin GLOBAL MARKET pourra générer un mot de passe temporaire.' : 'Demande envoyée. Votre administrateur d’entreprise pourra générer un mot de passe temporaire dans Paramètres > Demandes de mot de passe oublié.');
}
function passwordResetRequestsBox(){
  const {d,company}=current();
  const rows=(d.passwordResetRequests||[]).filter(r=>r.companyId===company.id && r.role==='caisse').slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return `<div class="superTableWrap"><table class="g2table"><tr><th>Date</th><th>Utilisateur</th><th>Profil</th><th>Contact</th><th>Motif</th><th>Statut</th><th>Action</th></tr>${rows.map(r=>`<tr><td>${new Date(r.createdAt).toLocaleString('fr-FR')}</td><td>${esc(r.userName||r.email)}<br><small>${esc(r.email||'')}</small></td><td>${esc(r.role||'')}</td><td>${esc(r.phone||'')}</td><td>${esc(r.reason||'')}</td><td>${esc(r.status||'')}</td><td class="actionCell">${r.status==='pending'?`<button onclick="resetPasswordRequestByAdmin('${r.id}')">Générer mot de passe</button>`:'<span class="saleBadge">traité</span>'}</td></tr>`).join('')||'<tr><td colspan="7">Aucune demande de mot de passe oublié.</td></tr>'}</table></div>`;
}
async function resetPasswordRequestByAdmin(rid){
  if(!requireAdmin('Réservé à l’administrateur.')) return;
  const {d,company,user}=current();
  const r=(d.passwordResetRequests||[]).find(x=>x.id===rid&&x.companyId===company.id);
  if(!r) return alert('Demande introuvable.');
  const u=(d.users||[]).find(x=>x.id===r.userId&&x.companyId===company.id);
  if(!u||u.role!=='caisse') return alert('Compte non autorisé. L’administrateur peut réinitialiser uniquement un compte Caisse.');
  const temp=makeTempPassword();
  await setObjectPassword(u,temp); u.status='active'; u.mustChangePassword=true;
  r.status='done'; r.doneAt=new Date().toISOString(); r.doneBy=user?.id||'';
  resetLoginAttempts(u.email); save(d);
  alert('Mot de passe temporaire généré pour '+(u.name||u.email)+' :\n\n'+temp+'\n\nIl est chiffré dans le système et devra être changé à la prochaine connexion.');
  renderDash('param');
}
async function enforcePasswordChange(u){
  if(!u?.mustChangePassword) return true;
  const np=await g3Prompt('Mot de passe temporaire détecté. Saisissez un nouveau mot de passe personnel (6 caractères minimum) :','','Changement obligatoire');
  if(!np || np.length<6){alert('Mot de passe trop court. Connexion annulée.'); return false;}
  const d=seed(); const target=(d.users||[]).find(x=>x.id===u.id);
  if(target){await setObjectPassword(target,np); target.mustChangePassword=false; save(d);}
  alert('Nouveau mot de passe sécurisé et enregistré.');
  return true;
}

async function login(){
  const email=($('#loginEmail')?.value||'').trim().toLowerCase();
  const pass=$('#loginPass')?.value||'';
  const selectedRole=$('#loginRole')?.value||'caisse';
  setLoginMessage('','');
  if(!email&&!pass){setLoginMessage('Saisissez votre nom utilisateur ou votre e-mail, puis votre mot de passe.','error');$('#loginEmail')?.focus();return;}
  if(!email){setLoginMessage('Le nom utilisateur ou l’e-mail est obligatoire.','error');$('#loginEmail')?.focus();return;}
  if(!pass){setLoginMessage('Le mot de passe est obligatoire.','error');$('#loginPass')?.focus();return;}
  setLoginLoading(true);
  try{
    const d=seed();
    const existing=(d.users||[]).find(x=>String(x.email||'').toLowerCase()===email);
    if(existing&&existing.status==='blocked'){setLoginMessage('Ce compte est bloqué. Contactez l’administrateur de votre entreprise.','error');return;}
    const valid=existing&&existing.status==='active' ? await verifyObjectPassword(existing,pass) : false;
    if(!valid){const r=registerLoginFailure(email);setLoginMessage(r.blocked?'Compte bloqué après cinq tentatives incorrectes. Contactez l’administrateur.':'Identifiants incorrects. Tentative '+r.attempts+'/5.','error');return;}
    const u=existing;
    if(selectedRole==='caisse'&&u.role!=='caisse'){setLoginMessage('Profil incorrect : sélectionnez « Administrateur » pour ce compte.','error');return;}
    if(selectedRole==='admin'&&!['admin','superadmin'].includes(u.role)){setLoginMessage('Profil incorrect : sélectionnez « La Caisse » pour ce compte.','error');return;}
    if(u.role==='caisse'&&!isCaisseInAllowedHours(u)){setLoginMessage('Accès caisse autorisé uniquement de '+caisseAllowedRangeLabel(u)+'. Contactez l’administrateur.','error');return;}
    resetLoginAttempts(email);
    if(u.companyId){const c=d.companies.find(x=>x.id===u.companyId),st=statusCompany(c);if(['expired','blocked','suspended'].includes(st)){renderExpired(c,st);return;}}
    if(!(await enforcePasswordChange(u)))return;
    setLoginMessage('Identité vérifiée. Ouverture de votre espace sécurisé…','success');
    await setSession(sessionPayloadForUser(u));
    if(u.role==='caisse')logCaisseAction('Connexion caisse','Session '+caisseSessionMinutes(u)+' min | Horaire autorisé '+caisseAllowedRangeLabel(u));
    render();
  }catch(e){console.error(e);setLoginMessage('Connexion momentanément indisponible. Réessayez dans quelques instants.','error');}
  finally{setLoginLoading(false);}
}
async function registerCompany(){
  const d=seed(),name=$('#cName')?.value.trim()||'',legalForm=$('#cLegalForm')?.value.trim()||'',rccm=$('#cRccm')?.value.trim()||'',taxAccount=$('#cTaxAccount')?.value.trim()||'',activity=$('#cActivity')?.value.trim()||'',owner=$('#cOwner')?.value.trim()||'',address=$('#cAddress')?.value.trim()||'',phone=$('#cPhone')?.value.trim()||'',email=$('#cEmail')?.value.trim().toLowerCase()||'',pass=$('#cPass')?.value||'',type=$('#cType')?.value||'boutique';
  if(!name||!email||!pass)return alert('Raison sociale, e-mail et mot de passe sont obligatoires.');
  if(pass.length<6)return alert('Le mot de passe administrateur doit contenir au moins 6 caractères.');
  if(d.users.some(u=>String(u.email||'').toLowerCase()===email))return alert('Email déjà utilisé.');
  const cid=id('ent'),uid=id('usr');
  d.companies.push({id:cid,name,legalForm,rccm,taxAccount,activity,owner,address,phone,email,businessType:type,status:'FREE',planCode:'FREE',plan:'Plan Free — 21 jours',subscriptionStart:today(),subscriptionEnd:new Date(Date.now()+FREE_PLAN_DAYS*86400000).toISOString().slice(0,10),createdAt:new Date().toISOString(),notes:'',shopSlug:slugify(name),shopBanner:'Boutique officielle',shopColor:'#024644'});
  const newUser={id:uid,companyId:cid,name:owner||'Administrateur principal',email,role:'admin',status:'active',createdAt:new Date().toISOString(),mainAdmin:true};
  await setObjectPassword(newUser,pass);d.users.push(newUser);save(d);await setSession({userId:uid});render();
}
function renderExpired(c,st){app.innerHTML=globalUniversalHeader('public',{restricted:true})+`<div class="wrap"><div class="card" style="max-width:720px;margin:80px auto;text-align:center"><div class="brand">GLOBAL MARKET</div><h1>Abonnement ${esc(st)}</h1><p class="sub">L’accès de l’entreprise <b>${esc(c?.name)}</b> est actuellement ${esc(st)}. Contactez MEGA SERVICES DIABO pour renouveler ou réactiver l’abonnement.</p><p><b>+225 0777041790</b><br>megaservicediabo@gmail.com</p><button onclick="logout()">Retour à l’accueil</button></div></div>`}
function render(){const hash=location.hash||'#home';if(hash.startsWith('#boutique/'))return renderPublicShop(hash.split('/')[1]||'');if(hash==='#home'||hash==='#'||hash.startsWith('#boutique-global'))return renderGlobalShop();const {user,company}=current();if(!user){location.hash='#home';return renderGlobalShop()}if(user.role==='superadmin')return renderSuper();const st=statusCompany(company);if(['expired','blocked','suspended'].includes(st))return renderExpired(company,st);renderDash('home')}


function normalizePrintDocumentTitle(value=''){
  const title=String(value||'').replace(/\s+/g,' ').trim();
  return (title||'DOCUMENT OFFICIEL DE L’ENTREPRISE').toUpperCase();
}
function globalPrintHeaderHTML(company,documentTitle='DOCUMENT OFFICIEL DE L’ENTREPRISE',generatedAt=new Date()){
  const year=getManageYear();
  const exercise=monthsList[getActiveMonth()]+' '+year;
  const p=companyReportProfile(company);
  const logo=p.logo?`<img src="${esc(p.logo)}" alt="Logo de ${esc(p.name)}">`:`<span>${esc(companyInitials(p.name))}</span>`;
  const legal=[p.legalForm,p.capital?`au capital de ${p.capital}`:''].filter(Boolean).join(' ');
  const info=(label,value)=>String(value||'').trim()?`<span><b>${esc(label)} :</b> ${esc(value)}</span>`:'';
  const title=normalizePrintDocumentTitle(documentTitle);
  return `<header class="g3ph" style="--company-primary:${p.primary};--company-accent:${p.accent}">
    <div class="g3phIdentity">
      <div class="g3phBrand">
        <div class="g3phLogo">${logo}</div>
        <b title="${esc(p.name)}">${esc(p.name)}</b>
      </div>
      <div class="g3phCompany">
        <strong>${esc(p.name)}</strong>
        <div class="g3phCompanyInfo">${legal?`<span>${esc(legal)}</span>`:''}${info('RCCM',p.rccm)}${info('Compte contribuable',p.taxAccount)}${info('Siège social',p.address)}${info('Tél.',p.phone)}${info('E-mail',p.email)}</div>
        ${p.activity?`<em>${esc(p.activity)}</em>`:''}
      </div>
    </div>
    <div class="g3phTitleBand">
      <div class="g3phClock"><span class="g3phClockIcon">◷</span><span><b>Date : ${generatedAt.toLocaleDateString('fr-FR')}</b><b>Heure : ${generatedAt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</b></span></div>
      <div class="g3phDocumentTitle" title="${esc(title)}">${esc(title)}</div>
    </div>
    <div class="g3phContext"><span><b>Année de gestion :</b> ${year}</span><span><b>Exercice actif :</b> ${esc(exercise)}</span></div>
  </header>`;
}
function globalPrintFooterHTML(company,label='Document'){
  const now=new Date();
  const p=companyReportProfile(company);
  return `<footer class="g3pf" style="--company-primary:${p.primary}"><span>▣ ${esc(label)} généré le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span><b>${esc(p.name)}</b><span class="g3pfPage">Page</span></footer>`;
}
function globalPrintThemeStyles(orientation='portrait'){
  return `
  .g3ph{width:100%;max-width:100%;margin:0 0 5mm;background:#fff;color:#071f1f;break-inside:avoid;page-break-inside:avoid;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
  .g3ph *{box-sizing:border-box}
  .g3phIdentity{display:grid;grid-template-columns:30mm minmax(0,1fr);align-items:stretch;min-height:27mm;border-bottom:.45mm solid #111}
  .g3phBrand{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1mm 3mm 1.5mm 0;border-right:.35mm solid var(--company-accent,#d4aa16);min-width:0}
  .g3phLogo{width:19mm;height:19mm;border:.65mm solid var(--company-primary,#00544f);border-radius:3mm;display:flex;align-items:center;justify-content:center;color:var(--company-primary,#00544f);font-size:8mm;line-height:1;font-weight:1000;background:#fff;overflow:hidden}
  .g3phLogo img{display:block;width:100%;height:100%;object-fit:contain}.g3phLogo span{display:block}
  .g3phBrand>b{display:block;max-width:28mm;margin-top:1.1mm;color:var(--company-primary,#00544f);font-size:2mm;line-height:1.08;text-align:center;white-space:normal;overflow-wrap:anywhere;font-weight:1000;text-transform:uppercase}
  .g3phCompany{min-width:0;padding:1.3mm 2mm 1.4mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  .g3phCompany>strong{display:block;max-width:100%;font-size:4mm;line-height:1.05;color:#050b0b;text-transform:uppercase;font-weight:1000;overflow-wrap:anywhere}
  .g3phCompanyInfo{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;column-gap:3.2mm;row-gap:.55mm;margin-top:1mm;max-width:100%;font-size:2.35mm;line-height:1.12;font-style:italic;color:#111}
  .g3phCompanyInfo span{display:inline-block;max-width:100%;overflow-wrap:anywhere}.g3phCompanyInfo b{font-weight:1000}
  .g3phCompany>em{display:block;max-width:100%;margin-top:1mm;font-size:2.65mm;line-height:1.12;font-weight:1000;color:#111;overflow-wrap:anywhere}
  .g3phTitleBand{display:grid;grid-template-columns:40mm minmax(0,1fr);align-items:stretch;margin-top:2.3mm;width:100%;min-width:0}
  .g3phClock{min-height:13mm;background:var(--company-primary,#00544f);color:#fff;border-radius:4mm 0 0 4mm;display:flex;align-items:center;gap:2.2mm;padding:1.8mm 3mm;clip-path:polygon(0 0,91% 0,100% 50%,91% 100%,0 100%);min-width:0}
  .g3phClockIcon{flex:0 0 8mm;width:8mm;height:8mm;border:.65mm solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:5mm;line-height:1}
  .g3phClock span:last-child{display:grid;gap:.6mm;min-width:0}.g3phClock b{display:block;font-size:2.25mm;white-space:nowrap;color:#fff}
  .g3phDocumentTitle{min-width:0;min-height:13mm;background:var(--company-primary,#00544f);color:#fff;border-radius:0 6mm 6mm 0;display:flex;align-items:center;justify-content:center;text-align:center;padding:1.5mm 4mm;font-family:Oswald,"Bebas Neue",Arial,sans-serif;font-size:5.15mm;line-height:1.03;font-weight:1000;letter-spacing:.005em;overflow-wrap:anywhere;text-transform:uppercase}
  .g3phContext{display:flex;justify-content:flex-end;align-items:center;gap:5mm;min-height:4.8mm;padding:1mm 2mm 0;color:#806600;font-size:2.1mm;font-weight:800;overflow-wrap:anywhere}
  .g3ph:after{content:"";display:block;height:.65mm;background:#111;margin-top:2.2mm}
  .g3pf{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:4mm;min-height:8.5mm;padding:1.7mm 3mm;background:var(--company-primary,#00544f);color:#fff;border-radius:2mm 2mm 0 0;font-size:2.25mm;font-weight:800;break-inside:avoid;page-break-inside:avoid}
  .g3pf b{text-align:center;font-size:2.5mm}.g3pf span:last-child{text-align:right}.g3pfPage:after{content:" " counter(page)}
  @media screen{.g3pf{display:none}}
  @media print{@page{size:A4 ${orientation};margin:0}.g3pf{display:grid!important;position:fixed;left:7mm;right:7mm;bottom:3mm;z-index:20}.g3ph{display:block!important}}
  `;
}
function defaultPrintDocumentTitle(active=''){
  const titles={home:'TABLEAU DE BORD DE L’ENTREPRISE',vente:'FACTURE / REÇU DE VENTE',rapports:'RAPPORT GÉNÉRAL DE L’ENTREPRISE',contrats:'DOCUMENT CLIENT SOUS CONTRAT',stocks:'RAPPORT DE GESTION DE STOCK',mois:'TABLEAU DE GESTION SUR 12 MOIS',param:'DOCUMENT DE GESTION DE L’ENTREPRISE',account:'INFORMATIONS DE L’ENTREPRISE'};
  return titles[active]||'DOCUMENT OFFICIEL DE L’ENTREPRISE';
}
function detectActivePrintDocumentTitle(){
  const root=document.querySelector('.section.printable.active,.g2panel.printable,.section.active')||document;
  const headings=[...root.querySelectorAll('h1')].filter(el=>!el.closest('.g3ph,.printCompanyHeader')&&getComputedStyle(el).display!=='none');
  return normalizePrintDocumentTitle(headings[0]?.textContent||'');
}
function refreshGlobalPrintHeaderTitle(){
  const title=detectActivePrintDocumentTitle();
  document.querySelectorAll('.printCompanyHeader .g3phDocumentTitle').forEach(el=>{el.textContent=title;el.title=title;});
}
if(typeof window!=='undefined') window.addEventListener('beforeprint',refreshGlobalPrintHeaderTitle);
function printCompanyHeader(company,documentTitle='DOCUMENT OFFICIEL DE L’ENTREPRISE'){
  if(!company) return '';
  return `<div class="printCompanyHeader pdfModeleGlobal3">${globalPrintHeaderHTML(company,documentTitle)}</div>`;
}

function isEnterpriseAdmin(){const {user}=current(); return user && user.role==='admin'}
function isCaisse(){const {user}=current(); return user && user.role==='caisse'}
function requireAdmin(msg='Accès réservé à l’administrateur entreprise.'){if(!isEnterpriseAdmin()){alert(msg); return false} return true}
function goGlobalMarketHome(){location.hash='#home';renderGlobalShop()}
function menu(active){
  const {user}=current();
  const labels={home:'▦ Tableau de bord',vente:'☰ Ventes',rapports:'▣ Rapports',contrats:'▣ Clients',marketplace:'🛍 Marketplace',stocks:'📦 Stocks',mois:'📅 12 mois',param:'⚙ Paramètres'};
  const baseAdmin=['home','vente','rapports','contrats','stocks','mois','param'];
  const baseCaisse=['home','vente','rapports'];
  const allowed=user?.role==='admin'?[...baseAdmin,'marketplace']:baseCaisse;
  return allowed.map(x=>`<button type="button" class="${active===x?'active':''}" onclick="show('${x}')">${labels[x]}</button>`).join('')
}
function currentGlobalClient(){
  const companyId=PUBLIC_CLIENT_SESSION?.companyId||'';
  if(!companyId||!PUBLIC_CLIENT_SESSION?.clientId) return null;
  return getPublicClient(companyId)||{id:PUBLIC_CLIENT_SESSION.clientId,companyId,name:PUBLIC_CLIENT_SESSION.clientName||PUBLIC_CLIENT_SESSION.name||'Client'};
}
function openCurrentGlobalClientSpace(){
  const companyId=PUBLIC_CLIENT_SESSION?.companyId||'';
  if(!companyId) return openGlobalClientAuth('login');
  openClientSpace(companyId);
}
function logoutCurrentGlobalClient(){
  const companyId=PUBLIC_CLIENT_SESSION?.companyId||'';
  logoutPublicClient(companyId);
}
function globalUniversalHeader(active='public',options={}){
  const {user}=current();
  const restricted=Boolean(options.restricted);
  const client=!user?currentGlobalClient():null;
  let nav=`<button type="button" class="${active==='public'?'active':''}" onclick="goGlobalMarketHome()">${officialShopIcon('home')}<span>Accueil</span></button>`;
  let actions='';
  if(user){
    if(!restricted){
      if(user.role==='superadmin'){
        nav+=`<button type="button" class="${active==='super'?'active':''}" onclick="renderSuper()">▦ Administration</button><button type="button" onclick="exportData()">📤 Exporter données</button>`;
      }else{
        nav+=menu(active==='public'||active==='shop'?'':active);
      }
    }
    const role=user.role==='superadmin'?'Super Admin':user.role==='admin'?'Administrateur':'Caisse';
    actions=`<div class="gmUniversalUser"><span class="gmUniversalIdentity">👤 <b>${esc(user.name||user.email||role)}</b><small>${esc(role)}</small></span>${user.role==='admin'&&!restricted?'<button type="button" class="gmUniversalAccount" onclick="showAccountPage()">Mon compte</button>':''}<button type="button" class="gmUniversalLogout" onclick="logout()">Déconnexion</button></div>`;
  }else if(client){
    if(!restricted){nav+=`<button type="button" class="${active==='client'?'active':''}" onclick="openCurrentGlobalClientSpace()">${officialShopIcon('user')}<span>Mon espace client</span></button><button type="button" onclick="openGlobalMarketCart()">${officialShopIcon('cart')}<span>Mon panier</span></button>`;}
    actions=`<div class="gmUniversalUser"><span class="gmUniversalIdentity">👤 <b>${esc(client.name||'Client')}</b><small>Compte client</small></span><button type="button" class="gmUniversalLogout" onclick="logoutCurrentGlobalClient()">Déconnexion</button></div>`;
  }else{
    actions=`<div class="gmUniversalGuestActions"><button type="button" class="gmUniversalBusinessBtn" onclick="openGlobalBusinessAuth()">${officialShopIcon('bag')}<span><b>Créer ma boutique</b><small>ou se connecter</small></span></button><button type="button" class="gmUniversalClientBtn" onclick="openGlobalClientAuth('login')">${officialShopIcon('user')}<span><b>Créer un compte client</b><small>ou se connecter</small></span></button><button type="button" class="gmUniversalCart" onclick="openGlobalMarketCart()" aria-label="Ouvrir le panier">${officialShopIcon('cart')}<i id="gmGlobalCartBadge">${globalMarketCartCount()}</i></button></div>`;
  }
  return `<header class="gmUniversalHeader"><button type="button" class="gmUniversalBrand" onclick="goGlobalMarketHome()">${globalMarketBrandMark()}<span><b>GLOBAL MARKET</b><small>Produits & services en toute confiance</small></span></button><nav class="gmUniversalNav" aria-label="Menu principal">${nav}</nav><div class="gmUniversalActions">${actions}</div></header>`;
}
function initFlexibleHorizontalMenu(){
  const nav=document.querySelector('.gmUniversalNav,.g2nav');
  if(!nav) return;
  const activeButton=nav.querySelector('button.active');
  if(activeButton){
    requestAnimationFrame(()=>activeButton.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}));
  }
  if(nav.dataset.wheelReady==='1') return;
  nav.dataset.wheelReady='1';
  nav.addEventListener('wheel',event=>{
    if(nav.scrollWidth<=nav.clientWidth+2) return;
    if(Math.abs(event.deltaY)<=Math.abs(event.deltaX)) return;
    event.preventDefault();
    nav.scrollLeft+=event.deltaY;
  },{passive:false});
}
function shell(content,active='home',options={}){
  const {user,company}=current();
  const ownHeader=Boolean(options.noGlobalPrintHeader), ownFooter=Boolean(options.noGlobalFooter);
  app.innerHTML=`<div class="g2app">
    ${globalUniversalHeader(active)}
    <main class="g2main ${active==='home'?'dashboardMain':''} ${ownHeader?'ownPrintHeader':''}">${ownHeader?'':printCompanyHeader(company,options.printTitle||defaultPrintDocumentTitle(active))}<div class="companyLine"><b>${esc(company.name)}</b><span>${esc(planDef(company).label)} — fin : ${esc(company.subscriptionEnd)}</span></div>${content}${ownFooter?'':globalPrintFooterHTML(company,options.footerLabel||'Document')}</main>
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
    <label>Capital social<input id="accCapital" value="${esc(company.capital||company.shareCapital||'')}" placeholder="EX/ 1 000 000 FCFA" ${admin?'':'disabled'}></label>
    <label>Devise du compte<input id="accCurrency" value="${esc(companyCurrency(company))}" placeholder="EX/ FCFA" maxlength="10" ${admin?'':'disabled'}></label>
    <label>Fonction du responsable<input id="accResponsibleTitle" value="${esc(company.responsibleTitle||company.managerTitle||'LE RESPONSABLE')}" placeholder="EX/ LE DIRECTEUR" ${admin?'':'disabled'}></label>
    <label class="fullRow">Logo de l’entreprise — URL sécurisée<input id="accLogo" value="${esc(company.logo||company.logoUrl||'')}" placeholder="https://... ou image encodée en data:image" ${admin?'':'disabled'}></label>
    <label>Couleur principale du rapport<input id="accReportColor" type="color" value="${esc(safeReportColor(company.reportColor||company.shopColor,'#004d48'))}" ${admin?'':'disabled'}></label>
    <label>Couleur dorée / accent<input id="accReportAccent" type="color" value="${esc(safeReportColor(company.reportAccent,'#d4aa16'))}" ${admin?'':'disabled'}></label>
    <label class="fullRow">Signature du responsable — URL facultative<input id="accSignature" value="${esc(company.signature||company.signatureUrl||'')}" placeholder="https://..." ${admin?'':'disabled'}></label>
    <label class="fullRow">Cachet de l’entreprise — URL facultative<input id="accStamp" value="${esc(company.stamp||company.stampUrl||'')}" placeholder="https://..." ${admin?'':'disabled'}></label>
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
function saveCompanyInfo(){if(!requireAdmin()) return;const {d,company}=current(); const c=d.companies.find(x=>x.id===company.id); if(!c) return; c.name=$('#accName')?.value.trim()||c.name; c.legalForm=$('#accLegalForm')?.value.trim()||''; c.rccm=$('#accRccm')?.value.trim()||''; c.taxAccount=$('#accTaxAccount')?.value.trim()||''; c.activity=$('#accActivity')?.value.trim()||''; c.owner=$('#accOwner')?.value.trim()||''; c.address=$('#accAddress')?.value.trim()||''; c.phone=$('#accPhone')?.value.trim()||''; c.email=$('#accEmail')?.value.trim()||''; c.businessType=$('#accType')?.value||c.businessType; c.capital=$('#accCapital')?.value.trim()||''; c.currency=String($('#accCurrency')?.value||'FCFA').trim().toUpperCase()||'FCFA'; c.responsibleTitle=$('#accResponsibleTitle')?.value.trim()||'LE RESPONSABLE'; c.logo=$('#accLogo')?.value.trim()||''; c.reportColor=safeReportColor($('#accReportColor')?.value,'#004d48'); c.reportAccent=safeReportColor($('#accReportAccent')?.value,'#d4aa16'); c.signature=$('#accSignature')?.value.trim()||''; c.stamp=$('#accStamp')?.value.trim()||''; save(d); alert('Informations de l’entreprise mises à jour. Les prochains rapports PDF utiliseront ces données.'); showAccountPage();}
function accountUsersTable(users,admin,currentUserId){return `<div class="superTableWrap"><table class="g2table accountUsersTable"><tr><th>Nom</th><th>Email</th><th>Nouveau mot de passe</th><th>Rôle</th><th>Début caisse</th><th>Fin caisse</th><th>Statut</th><th>Action</th></tr>${users.map(u=>{const isCaisse=u.role==='caisse'; return `<tr><td><input id="auName_${u.id}" value="${esc(u.name||'')}" ${admin?'':'disabled'}></td><td><input id="auEmail_${u.id}" value="${esc(u.email||'')}" ${admin?'':'disabled'}></td><td><input id="auPass_${u.id}" type="password" minlength="6" autocomplete="new-password" placeholder="Laisser vide pour conserver" ${admin?'':'disabled'}></td><td><select id="auRole_${u.id}" onchange="toggleRowCaisseHours('${u.id}')" ${admin?'':'disabled'}><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option><option value="caisse" ${u.role==='caisse'?'selected':''}>Caisse</option></select></td><td class="caisseOnlyCell" id="auStartCell_${u.id}">${isCaisse?`<input id="auStart_${u.id}" type="time" value="${esc(caisseStartTime(u))}" ${admin?'':'disabled'}>`:''}</td><td class="caisseOnlyCell" id="auEndCell_${u.id}">${isCaisse?`<input id="auEnd_${u.id}" type="time" value="${esc(caisseEndTime(u))}" ${admin?'':'disabled'}>`:''}</td><td><select id="auStatus_${u.id}" ${admin?'':'disabled'}><option value="active" ${(u.status||'active')==='active'?'selected':''}>Actif</option><option value="blocked" ${u.status==='blocked'?'selected':''}>Bloqué</option></select></td><td class="actionCell">${admin?`<div class="rowActions"><button class="btn2" onclick="saveAccountUser('${u.id}')">Enregistrer</button>${u.id!==currentUserId?`<button class="danger" onclick="deleteAccountUser('${u.id}')">Supprimer</button>`:''}</div>`:'-'}</td></tr>`}).join('')||'<tr><td colspan="8">Aucun utilisateur enregistré.</td></tr>'}</table></div>`}
function toggleNewCaisseHours(prefix){const roleId=prefix==='acc'?'accNewRole':'uRole'; const role=$('#'+roleId)?.value||'caisse'; document.querySelectorAll('.'+prefix+'CaisseOnly').forEach(el=>{el.style.display=role==='caisse'?'':'none';});}
function toggleRowCaisseHours(uid){const role=$(`#auRole_${uid}`)?.value||'caisse'; const startCell=$(`#auStartCell_${uid}`), endCell=$(`#auEndCell_${uid}`); if(!startCell||!endCell) return; if(role==='caisse'){if(!startCell.querySelector('input')) startCell.innerHTML=`<input id="auStart_${uid}" type="time" value="07:00">`; if(!endCell.querySelector('input')) endCell.innerHTML=`<input id="auEnd_${uid}" type="time" value="22:00">`;}else{startCell.innerHTML=''; endCell.innerHTML='';}}
async function saveAccountUser(uid){
  if(!requireAdmin()) return;
  const {d,company}=current(); const u=d.users.find(x=>x.id===uid&&x.companyId===company.id);
  if(!u) return alert('Utilisateur introuvable');
  const email=$(`#auEmail_${uid}`)?.value.trim().toLowerCase()||'', newPass=$(`#auPass_${uid}`)?.value||'';
  if(!email) return alert('Email obligatoire');
  if(d.users.some(x=>x.id!==uid&&String(x.email||'').toLowerCase()===email)) return alert('Cet email est déjà utilisé');
  if(newPass&&newPass.length<6) return alert('Le nouveau mot de passe doit contenir au moins 6 caractères.');
  u.name=$(`#auName_${uid}`)?.value.trim()||u.name; u.email=email;
  if(newPass) await setObjectPassword(u,newPass);
  u.role=$(`#auRole_${uid}`)?.value||u.role; u.sessionMinutes=0;
  u.caisseStartTime=u.role==='caisse'?normalizeHour($(`#auStart_${uid}`)?.value,'07:00'):'';
  u.caisseEndTime=u.role==='caisse'?normalizeHour($(`#auEnd_${uid}`)?.value,'22:00'):'';
  u.status=$(`#auStatus_${uid}`)?.value||'active'; save(d); alert('Utilisateur modifié.'); showAccountUsersPage();
}
async function deleteAccountUser(uid){if(!requireAdmin()) return;const {d,company}=current(); const us=d.users.filter(u=>u.companyId===company.id); if(us.length<=1) return alert('Impossible de supprimer le dernier utilisateur du compte.'); if(!(await g3Confirm('Supprimer définitivement cet utilisateur et son accès ?','Suppression utilisateur'))) return; d.users=d.users.filter(u=>u.id!==uid); save(d); showAccountUsersPage();}
async function addAccountUser(){
  if(!requireAdmin()) return;
  const {d,company}=current();
  if(!assertPlanFeature(company,'multi_users','Le multi-utilisateur est disponible avec les plans Free et Business.')) return;
  if(!canCreateMoreUsers(company,d)) return alert('Limite utilisateurs atteinte pour le plan '+planDef(company).statut+' : '+userLimitLabel(company)+' utilisateur(s).');
  const name=$('#accNewName')?.value.trim()||'', email=$('#accNewEmail')?.value.trim().toLowerCase()||'', pass=$('#accNewPass')?.value||'', role=$('#accNewRole')?.value||'caisse';
  if(!name||!email||!pass) return alert('Nom, email et mot de passe obligatoires.');
  if(pass.length<6) return alert('Le mot de passe doit contenir au moins 6 caractères.');
  if(d.users.some(u=>String(u.email||'').toLowerCase()===email)) return alert('Email déjà utilisé');
  const newUser={id:id('usr'),companyId:company.id,name,email,role,status:'active',sessionMinutes:0,caisseStartTime:role==='caisse'?normalizeHour($('#accNewStart')?.value,'07:00'):'',caisseEndTime:role==='caisse'?normalizeHour($('#accNewEnd')?.value,'22:00'):'',createdAt:new Date().toISOString()};
  await setObjectPassword(newUser,pass); d.users.push(newUser); save(d); showAccountUsersPage();
}
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
function getCompanyCartSales(){ return getCompanySalesRaw().filter(isSaleCartPending); }
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
  shell(`<div class="g2panel printable"><div class="reportActions no-print"><button onclick="renderDash('${back}')">Retour</button><button onclick="window.print()">Imprimer / PDF</button></div>${bulkSaleInvoiceHTML(company,rows,title)}</div>`,back,{printTitle:title||'FACTURE / REÇU DE VENTE'});
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
  const img=i.photo?`<img loading="lazy" decoding="async" src="${esc(i.photo)}" alt="${esc(i.name||'Article')}">`:`<span>${icon}</span>`;
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



function gmDashDateKey(value){return String(value||'').slice(0,10)}
function gmDashDayKey(offset=0){const d=new Date(today()+'T12:00:00');d.setDate(d.getDate()+Number(offset||0));return d.toISOString().slice(0,10)}
function gmDashDateLabel(key){try{return new Date(String(key)+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}).replace('.','')}catch(e){return key}}
function gmDashFullDate(){return new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}
function gmDashPct(curr,prev){curr=Number(curr||0);prev=Number(prev||0);if(!prev)return curr?100:0;return ((curr-prev)/Math.abs(prev))*100}
function gmDashPctText(value){const n=Number(value||0);const s=Math.abs(n)<.05?0:n;return `${s>0?'+':''}${s.toFixed(1).replace('.',',')}%`}
function gmDashCompactNumber(value){const n=Math.max(0,Number(value||0));if(n>=1000000)return (n/1000000).toLocaleString('fr-FR',{maximumFractionDigits:1})+'M';if(n>=1000)return (n/1000).toLocaleString('fr-FR',{maximumFractionDigits:1})+'k';return Math.round(n).toLocaleString('fr-FR')}
function gmDashNiceMax(value){const n=Math.max(1,Number(value||0));const magnitude=Math.pow(10,Math.floor(Math.log10(n)));return Math.ceil(n/magnitude)*magnitude}
function gmDashSum(rows,key){return (rows||[]).reduce((a,b)=>a+Number(b?.[key]||0),0)}
function gmDashRowsForDay(rows,key){return (rows||[]).filter(r=>gmDashDateKey(r.date||r.createdAt)===key)}
function gmDashActiveClients(rows=[]){const named=new Set();let anonymous=0;(rows||[]).forEach(s=>{const name=String(s.client||'').trim();if(name&&name!=='-'&&name.toLowerCase()!=='non précisé')named.add(name.toLowerCase());else anonymous+=Math.max(0,Number(s.clientsServed||0));});return named.size+anonymous}
function gmDashStockQty(items=[]){return (items||[]).filter(i=>{try{return isBoutiqueItem(i)}catch(e){return String(i.type||'').toLowerCase()!=='service'}}).reduce((a,i)=>a+(String(i.stockType||'limited').toLowerCase()==='unlimited'?0:Math.max(0,Number(i.stock||0))),0)}
function gmDashProductSaleQty(rows=[],items=[]){const productIds=new Set((items||[]).filter(i=>{try{return isBoutiqueItem(i)}catch(e){return String(i.type||'').toLowerCase()!=='service'}}).map(i=>String(i.id||'')));return (rows||[]).reduce((a,s)=>{const product=String(s.saleKind||'').toLowerCase()==='boutique'||productIds.has(String(s.itemId||''));return a+(product?Math.max(0,Number(s.qty||0)):0)},0)}
function gmDashStockMovementRows(d,cid){const modern=(d?.stockMovements||[]).filter(m=>m.companyId===cid);if(modern.length)return modern;return [...(d?.stockEntries||[]).filter(m=>m.companyId===cid).map(m=>({...m,type:'entry'})),...(d?.stockOutputs||[]).filter(m=>m.companyId===cid).map(m=>({...m,type:'output'}))]}
function gmDashStockSeries(ctx,keys=[]){const d=ctx.d||{},cid=ctx.company?.id||ctx.cid||'',sales=ctx.sales||[],items=ctx.items||[],moves=gmDashStockMovementRows(d,cid);let endQty=gmDashStockQty(items);const map={};for(let i=keys.length-1;i>=0;i--){const key=keys[i];map[key]=Math.max(0,endQty);const dayMoves=moves.filter(m=>gmDashDateKey(m.date||m.createdAt)===key);const entries=dayMoves.filter(m=>m.type==='entry').reduce((a,m)=>a+Math.max(0,Number(m.qty||0)),0);const outputs=dayMoves.filter(m=>m.type==='output').reduce((a,m)=>a+Math.max(0,Number(m.qty||0)),0);const sold=gmDashProductSaleQty(gmDashRowsForDay(sales,key),items);endQty=Math.max(0,endQty-entries+outputs+sold)}return keys.map(k=>Number(map[k]||0))}
function gmDashSparkline(points=[],color='#16A05D'){
  const vals=(points||[]).map(v=>Number(v||0));
  const w=132,h=36,p=2,max=Math.max(...vals,1),min=Math.min(...vals,0),range=Math.max(max-min,1);
  const coords=vals.map((v,i)=>{const x=p+(i*(w-p*2))/Math.max(vals.length-1,1); const y=h-p-((v-min)/range)*(h-p*2); return [x,y]});
  const line=coords.map(c=>c[0].toFixed(1)+','+c[1].toFixed(1)).join(' ');
  return `<svg class="erpSparkSvg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="${line}"></polyline>${coords.map(c=>`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="2.1" fill="${color}"></circle>`).join('')}</svg>`;
}
function gmDashLineArea(points=[],color='#16A05D',maxY=1){
  const vals=(points||[]).map(v=>Number(v||0));
  const w=520,h=220,pL=18,pR=12,pT=12,pB=18,max=Math.max(1,Number(maxY||1)),min=0,range=Math.max(max-min,1);
  const coords=vals.map((v,i)=>{const x=pL+(i*(w-pL-pR))/Math.max(vals.length-1,1); const y=pT+((max-v)/range)*(h-pT-pB); return [x,y]});
  const line=coords.map(c=>c[0].toFixed(1)+','+c[1].toFixed(1)).join(' ');
  const area=`${pL},${h-pB} `+line+` ${w-pR},${h-pB}`;
  return `<svg class="erpLineSvg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="erpAreaGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.22"></stop><stop offset="100%" stop-color="${color}" stop-opacity="0.03"></stop></linearGradient></defs><g class="erpGrid"><line x1="${pL}" y1="${pT}" x2="${w-pR}" y2="${pT}"/><line x1="${pL}" y1="${pT+(h-pT-pB)/3}" x2="${w-pR}" y2="${pT+(h-pT-pB)/3}"/><line x1="${pL}" y1="${pT+2*(h-pT-pB)/3}" x2="${w-pR}" y2="${pT+2*(h-pT-pB)/3}"/><line x1="${pL}" y1="${h-pB}" x2="${w-pR}" y2="${h-pB}"/></g><polygon points="${area}" fill="url(#erpAreaGradient)"></polygon><polyline fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" points="${line}"></polyline>${coords.map(c=>`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="4.4" fill="#fff" stroke="${color}" stroke-width="2.6"></circle>`).join('')}</svg>`;
}
function gmDashDonut(slices=[],colors=[]){
  const sum=(slices||[]).reduce((a,b)=>a+Number(b||0),0),total=sum||1,r=68,c=2*Math.PI*r;let acc=0;
  const segs=sum?slices.map((v,i)=>{const pct=Number(v||0)/total,len=pct*c,dash=`${len} ${c-len}`,off=-acc*c;acc+=pct;return `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${colors[i]||'#ddd'}" stroke-width="28" stroke-dasharray="${dash}" stroke-dashoffset="${off}" transform="rotate(-90 100 100)" stroke-linecap="butt"></circle>`}).join(''):'';
  return `<svg class="erpDonutSvg" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="${r}" fill="none" stroke="#EEF2F6" stroke-width="28"></circle>${segs}</svg>`;
}
function gmDashBars(values=[],labels=[],color='#16A05D',maxY=1){
  const max=Math.max(Number(maxY||0),...(values||[]).map(v=>Number(v||0)),1);
  return `<div class="erpBarsWrap">${(values||[]).map((v,i)=>{const n=Number(v||0),h=n<=0?0:Math.max(4,(n/max)*100);return `<div class="erpBarItem"><div class="erpBarTrack"><span class="erpBarFill" title="${n}" style="height:${h.toFixed(2)}%;background:${color}"></span></div><small>${esc(labels[i]||'')}</small></div>`}).join('')}</div>`;
}
function gmDashTrendHTML(pct,compare='vs hier'){const n=Number(pct||0),up=n>=0;return `<span class="${up?'erpUp':'erpDown'}">${gmDashPctText(n)} <b>${up?'↗':'↘'}</b></span><span>${esc(compare)}</span>`}
function gmDashActivityTime(value){const d=new Date(value||Date.now());if(isNaN(d))return '';const hasTime=String(value||'').includes('T');return hasTime?d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}
function gmDashboardHomeHTML(ctx={}){
  const d=ctx.d||{},company=ctx.company||{},cid=company.id||ctx.cid||'',sales=ctx.sales||[],items=ctx.items||[],clients=ctx.clients||[],marketOrders=ctx.marketOrders||[];
  const manageYear=Number(ctx.manageYear||getManageYear()),previousYear=manageYear-1;
  const todayKey=gmDashDayKey(0),yesterdayKey=gmDashDayKey(-1),tenKeys=Array.from({length:10},(_,i)=>gmDashDayKey(i-9)),sevenKeys=tenKeys.slice(-7);
  const todaySales=gmDashRowsForDay(sales,todayKey),yesterdaySales=gmDashRowsForDay(sales,yesterdayKey);
  const tenDaySales=tenKeys.map(k=>gmDashRowsForDay(sales,k));
  const caSeries=tenDaySales.map(r=>gmDashSum(r,'total')),ordersSeries=tenDaySales.map(r=>r.length),clientSeries=tenDaySales.map(r=>gmDashActiveClients(r)),profitSeries=tenDaySales.map(r=>gmDashSum(r,'profit'));
  const stockSeries=gmDashStockSeries({d,company,sales,items},tenKeys),growthSeries=caSeries.map((v,i)=>i?gmDashPct(v,caSeries[i-1]):0);
  const todayCA=gmDashSum(todaySales,'total'),yesterdayCA=gmDashSum(yesterdaySales,'total');
  const todayProfit=gmDashSum(todaySales,'profit'),yesterdayProfit=gmDashSum(yesterdaySales,'profit');
  const todayOrders=todaySales.length,yesterdayOrders=yesterdaySales.length,todayClients=gmDashActiveClients(todaySales),yesterdayClients=gmDashActiveClients(yesterdaySales);
  const stockQty=gmDashStockQty(items),yesterdayStock=stockSeries.length>1?stockSeries[stockSeries.length-2]:stockQty;
  const caChange=gmDashPct(todayCA,yesterdayCA),orderChange=gmDashPct(todayOrders,yesterdayOrders),clientChange=gmDashPct(todayClients,yesterdayClients),stockChange=gmDashPct(stockQty,yesterdayStock),profitChange=gmDashPct(todayProfit,yesterdayProfit);
  const kpis=[
    {tone:'green',icon:'↗',label:'Chiffre d\'affaires',value:money(todayCA),change:caChange,compare:'vs hier',color:'#16A05D',series:caSeries},
    {tone:'blue',icon:'🛒',label:'Commandes',value:todayOrders.toLocaleString('fr-FR'),change:orderChange,compare:'vs hier',color:'#2684E8',series:ordersSeries},
    {tone:'violet',icon:'👥',label:'Clients actifs',value:todayClients.toLocaleString('fr-FR'),change:clientChange,compare:'vs hier',color:'#8A4DE8',series:clientSeries},
    {tone:'orange',icon:'📦',label:'Produits en stock',value:stockQty.toLocaleString('fr-FR'),change:stockChange,compare:'vs hier',color:'#F39200',series:stockSeries},
    {tone:'gold',icon:'₣',label:'Bénéfice',value:money(todayProfit),change:profitChange,compare:'vs hier',color:'#F2B632',series:profitSeries},
    {tone:'turquoise',icon:'➚',label:'Croissance',value:gmDashPctText(caChange),change:null,compare:'vs période précédente',color:'#159C9C',series:growthSeries}
  ];
  const perfValues=caSeries.slice(-7),perfLabels=sevenKeys.map(gmDashDateLabel),perfTotal=perfValues.reduce((a,b)=>a+b,0),previousSevenKeys=Array.from({length:7},(_,i)=>gmDashDayKey(i-13)),previousSevenTotal=previousSevenKeys.reduce((a,k)=>a+gmDashSum(gmDashRowsForDay(sales,k),'total'),0),perfChange=gmDashPct(perfTotal,previousSevenTotal),perfMax=gmDashNiceMax(Math.max(...perfValues,1));
  const yearSales=sales.filter(s=>{const dt=new Date(s.date||0);return !isNaN(dt)&&dt.getFullYear()===manageYear}),prevYearSales=sales.filter(s=>{const dt=new Date(s.date||0);return !isNaN(dt)&&dt.getFullYear()===previousYear});
  const itemMap=new Map(items.map(i=>[String(i.id||''),i]));
  const categoryMap=new Map();yearSales.forEach(s=>{const it=itemMap.get(String(s.itemId||''));const cat=String(s.category||it?.cat||'Autres').trim()||'Autres';categoryMap.set(cat,(categoryMap.get(cat)||0)+Number(s.total||0))});
  const catSorted=[...categoryMap.entries()].sort((a,b)=>b[1]-a[1]),catRows=catSorted.length>5?[...catSorted.slice(0,4),['Autres',catSorted.slice(4).reduce((a,b)=>a+b[1],0)]]:catSorted;
  const catColors=['#16A05D','#59A8F3','#8A4DE8','#F2B632','#D2D6DB'],categoryTotal=catRows.reduce((a,b)=>a+b[1],0),categoryValues=catRows.map(r=>r[1]);
  const monthLabels=['Janv','Févr','Mars','Avr','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'],monthlyValues=monthLabels.map((_,m)=>yearSales.filter(s=>new Date(s.date||0).getMonth()===m).length),yearOrderTotal=monthlyValues.reduce((a,b)=>a+b,0),prevYearOrderTotal=prevYearSales.length,monthlyChange=gmDashPct(yearOrderTotal,prevYearOrderTotal),monthlyMax=gmDashNiceMax(Math.max(...monthlyValues,1));
  const stockMoves=gmDashStockMovementRows(d,cid),recent=[];
  sales.forEach(s=>recent.push({date:s.date||'',icon:'🛒',tone:'green',title:`Vente #${String(s.id||'').replace(/^sale_/,'').slice(-14)||'—'}`,sub:`${s.client?esc(s.client)+' • ':''}${money(s.total||0)}`,badge:'Vente'}));
  stockMoves.forEach(m=>recent.push({date:m.createdAt||m.date||'',icon:'📦',tone:m.type==='entry'?'orange':'gold',title:m.type==='entry'?'Stock approvisionné':m.type==='output'?'Sortie de stock':'Stock mis à jour',sub:`${esc(m.product||m.name||'Produit')} • Qté ${Number(m.qty||0)}`,badge:m.type==='entry'?'Entrée':m.type==='output'?'Sortie':'Stock'}));
  clients.forEach(c=>recent.push({date:c.createdAt||c.date||'',icon:'👤',tone:'violet',title:'Nouveau client enregistré',sub:esc(c.name||c.client||'Client'),badge:'Client'}));
  marketOrders.forEach(o=>recent.push({date:o.date||o.createdAt||'',icon:'🛒',tone:'blue',title:`Commande Marketplace #${String(o.id||'').slice(-12)}`,sub:`${esc(o.client||o.customerName||'Client')} • ${money(o.total||0)}`,badge:'Marketplace'}));
  recent.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));const activities=recent.slice(0,5);
  const yearCA=gmDashSum(yearSales,'total'),prevYearCA=gmDashSum(prevYearSales,'total'),yearProfit=gmDashSum(yearSales,'profit'),prevYearProfit=gmDashSum(prevYearSales,'profit'),yearClients=gmDashActiveClients(yearSales),prevYearClients=gmDashActiveClients(prevYearSales);
  const yearMoves=stockMoves.filter(m=>{const dt=new Date(m.date||m.createdAt||0);return !isNaN(dt)&&dt.getFullYear()===manageYear}),yearEntries=yearMoves.filter(m=>m.type==='entry').reduce((a,m)=>a+Number(m.qty||0),0),yearOutputs=yearMoves.filter(m=>m.type==='output').reduce((a,m)=>a+Number(m.qty||0),0),yearProductSales=gmDashProductSaleQty(yearSales,items),stockAtYearStart=Math.max(0,stockQty-yearEntries+yearOutputs+yearProductSales),stockYearChange=gmDashPct(stockQty,stockAtYearStart);
  const annual=[
    {icon:'₣',tone:'green',label:'Chiffre d\'affaires',value:money(yearCA),change:gmDashPct(yearCA,prevYearCA),compare:`vs ${previousYear}`},
    {icon:'◎',tone:'gold',label:'Bénéfice net',value:money(yearProfit),change:gmDashPct(yearProfit,prevYearProfit),compare:`vs ${previousYear}`},
    {icon:'▣',tone:'blue',label:'Commandes',value:yearOrderTotal.toLocaleString('fr-FR'),change:gmDashPct(yearOrderTotal,prevYearOrderTotal),compare:`vs ${previousYear}`},
    {icon:'👥',tone:'violet',label:'Clients actifs',value:yearClients.toLocaleString('fr-FR'),change:gmDashPct(yearClients,prevYearClients),compare:`vs ${previousYear}`},
    {icon:'◈',tone:'turquoise',label:'Produits en stock',value:stockQty.toLocaleString('fr-FR'),change:stockYearChange,compare:`vs début ${manageYear}`}
  ].map(row=>({...row,progress:Math.max(8,Math.min(100,50+Number(row.change||0)))}));
  const quickActions=[
    {icon:'🛒',tone:'green',title:'Nouvelle commande',sub:'Créer une commande',action:"show('vente')"},{icon:'📦',tone:'orange',title:'Ajouter un produit',sub:'Enregistrer un produit',action:"show('stocks')"},{icon:'📈',tone:'turquoise',title:'Rapport de ventes',sub:'Voir les ventes détaillées',action:"show('rapports')"},{icon:'👥',tone:'violet',title:'Gérer les clients',sub:'Voir tous les clients',action:"show('contrats')"},{icon:'🚚',tone:'gold',title:'Mouvement de stock',sub:'Entrées / Sorties',action:"show('stocks')"},{icon:'⚙',tone:'blue',title:'Paramètres',sub:'Configuration générale',action:"show('param')"}
  ];
  const yTicks=[perfMax,perfMax*2/3,perfMax/3,0].map(gmDashCompactNumber),barTicks=[monthlyMax,monthlyMax*2/3,monthlyMax/3,0].map(v=>Math.round(v).toLocaleString('fr-FR'));
  return `<section id="home" class="section ${ctx.sec==='home'?'active':''}"><div class="erpDash">
    <header class="erpDashHeader"><div class="erpDashHeading"><h1>TABLEAU DE BORD</h1><p>Vue d’ensemble de votre activité et de vos indicateurs clés.</p><small class="erpCompanyScope">Données de l’entreprise : <b>${esc(company.name||'Entreprise')}</b></small></div><div class="erpDashFilters"><label class="erpDashControl erpDashSearch"><span class="erpControlIcon">⌕</span><input type="search" placeholder="Rechercher..."></label><button type="button" class="erpDashControl"><span class="erpControlIcon">📅</span><span>${esc(gmDashFullDate())}</span></button><button type="button" class="erpDashControl erpDashPeriod"><span>Période : Aujourd’hui</span><span class="erpControlArrow">▾</span></button></div></header>
    <section class="erpKpiGrid">${kpis.map(card=>`<article class="erpCard erpKpiCard"><div class="erpKpiTop"><span class="erpIconBubble ${card.tone}">${card.icon}</span><div><h3>${card.label}</h3><strong>${card.value}</strong></div></div><div class="erpKpiMeta">${card.change===null?`<span class="${caChange>=0?'erpUp':'erpDown'}">${gmDashPctText(caChange)} <b>${caChange>=0?'↗':'↘'}</b></span><span>${card.compare}</span>`:gmDashTrendHTML(card.change,card.compare)}</div><div class="erpSparkWrap">${gmDashSparkline(card.series,card.color)}</div></article>`).join('')}</section>
    <section class="erpAnalyticsGrid">
      <article class="erpCard erpSalesCard"><div class="erpCardHead"><div><h2>Performance des ventes</h2></div><button type="button" class="erpHeadPill">7 derniers jours <span>▾</span></button></div><div class="erpSalesStats"><div><span>Total des ventes</span><strong>${money(perfTotal)}</strong></div><div class="erpSalesDelta ${perfChange<0?'negative':''}"><b>${gmDashPctText(perfChange)} ${perfChange>=0?'↗':'↘'}</b><small>vs 7 jours précédents</small></div></div><div class="erpLineChartBlock"><div class="erpYAxis">${yTicks.map(x=>`<span>${x}</span>`).join('')}</div><div class="erpLineArea">${gmDashLineArea(perfValues,'#16A05D',perfMax)}<div class="erpXAxis">${perfLabels.map(l=>`<span>${esc(l)}</span>`).join('')}</div></div></div></article>
      <article class="erpCard erpDonutCard"><div class="erpCardHead"><h2>Répartition des ventes par catégorie</h2></div><div class="erpDonutLayout"><div class="erpDonutWrap">${gmDashDonut(categoryValues,catColors)}<div class="erpDonutCenter"><span>Total</span><strong>${gmDashCompactNumber(categoryTotal)}</strong><small>FCFA</small></div></div><div class="erpLegendList">${catRows.length?catRows.map((item,i)=>`<div class="erpLegendItem"><span class="erpLegendDot" style="background:${catColors[i]||'#D2D6DB'}"></span><div class="erpLegendText"><b>${esc(item[0])}</b><small>${money(item[1])}</small></div><div class="erpLegendValue">${categoryTotal?((item[1]/categoryTotal)*100).toFixed(1).replace('.',','):'0,0'}%</div></div>`).join(''):'<div class="erpEmptyState">Aucune vente enregistrée pour cette entreprise sur l’année sélectionnée.</div>'}</div></div></article>
      <article class="erpCard erpBarsCard"><div class="erpCardHead"><div><h2>Commandes mensuelles</h2></div><button type="button" class="erpHeadPill">${manageYear} <span>▾</span></button></div><div class="erpSalesStats"><div><strong>${yearOrderTotal.toLocaleString('fr-FR')}</strong><span>Total commandes</span></div><div class="erpSalesDelta ${monthlyChange<0?'negative':''}"><b>${gmDashPctText(monthlyChange)} ${monthlyChange>=0?'↗':'↘'}</b><small>vs ${previousYear}</small></div></div><div class="erpBarsTopScale">${barTicks.map(x=>`<span>${x}</span>`).join('')}</div>${gmDashBars(monthlyValues,monthLabels,'#16A05D',monthlyMax)}</article>
    </section>
    <section class="erpBottomGrid">
      <article class="erpCard"><div class="erpCardHead"><h2>Actions rapides</h2></div><div class="erpQuickGrid">${quickActions.map(item=>`<button type="button" class="erpQuickAction" onclick="${item.action}"><span class="erpQuickIcon ${item.tone}">${item.icon}</span><b>${item.title}</b><small>${item.sub}</small><em>›</em></button>`).join('')}</div></article>
      <article class="erpCard"><div class="erpCardHead"><h2>Dernières activités</h2><button type="button" class="erpLinkBtn" onclick="show('rapports')">Voir tout</button></div><div class="erpActivityList">${activities.length?activities.map(item=>`<div class="erpActivityRow"><span class="erpActivityIcon ${item.tone}">${item.icon}</span><div class="erpActivityMain"><b>${item.title}</b><small>${item.sub}</small></div><span class="erpActivityBadge ${item.tone}">${item.badge}</span><time>${gmDashActivityTime(item.date)}</time></div>`).join(''):'<div class="erpEmptyState">Aucune activité enregistrée pour cette entreprise.</div>'}</div></article>
      <article class="erpCard"><div class="erpCardHead"><h2>Résumé annuel ${manageYear}</h2><button type="button" class="erpLinkBtn" onclick="show('mois')">Voir le rapport complet</button></div><div class="erpAnnualList">${annual.map(row=>`<div class="erpAnnualRow"><div class="erpAnnualTop"><div class="erpAnnualLabel"><span class="erpAnnualIcon ${row.tone}">${row.icon}</span><b>${row.label}</b></div><div class="erpAnnualValue">${row.value}</div><div class="erpAnnualChange ${row.change<0?'negative':''}"><strong>${gmDashPctText(row.change)} ${row.change>=0?'↗':'↘'}</strong><small>${row.compare}</small></div></div><div class="erpProgress"><span class="${row.tone}" style="width:${row.progress}%"></span></div></div>`).join('')}</div></article>
    </section>
  </div></section>`;
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
  const dashboardHome=gmDashboardHomeHTML({sec,d,cid,company,user,admin,clients,items,productItems,sales,marketOrders,manageYear});
  shell(`${dashboardHome}
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
async function deleteStockCategoryFromPopup(cat){
  if(!requireAdmin()) return; const {d,company}=current(); const count=(d.items||[]).filter(i=>i.companyId===company.id&&i.cat===cat).length;
  if(count>0) return g3Alert('Suppression sécurisée refusée : cette catégorie contient '+count+' produit(s) ou service(s). Modifiez d’abord les éléments liés afin d’éviter toute perte accidentelle.','Suppression catégorie','warn');
  if(!(await g3Confirm('Supprimer cette catégorie vide ?','Suppression catégorie'))) return;
  const rows=getCompanyCategoryRecords(d,company.id).filter(c=>c.name!==cat); saveCompanyCategoryRecords(d,company.id,rows); save(d); document.querySelector('.stockModalBackdrop')?.remove(); g3Alert('Catégorie supprimée avec succès.','Catégorie'); renderDash('stocks');
}
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
  return globalPrintHeaderHTML(company,'FACTURE / REÇU DE VENTE');
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
  return `<div class="stockA4">${globalPrintHeaderHTML(company,categoryTitle?`RAPPORT DE STOCK — ${categoryTitle}`:'RAPPORT DE GESTION DE STOCK')}<div class="stockTitle"><h1>LISTE DES CATÉGORIES</h1><div class="stockTitleDecor"><i></i></div></div><div class="stockCatStrip"><div class="stockCatIcon">▣</div><div class="stockCatMain">Rapport gestion de stock</div><div class="stockCatName">${esc(catName)}</div></div><div class="stockSummary"><div class="stockCard"><span class="stockCardIcon">□</span><div><small>Catégorie</small><b>${esc(categoryLabel)}</b></div></div><div class="stockCard"><span class="stockCardIcon">▦</span><div><small>Nombre d’éléments</small><b>${rowsData.length}</b><em>Produits / services</em></div></div><div class="stockCard"><span class="stockCardIcon">▤</span><div><small>Quantité totale</small><b>${totalQty}</b><em>Unités en stock</em></div></div><div class="stockCard"><span class="stockCardIcon">$</span><div><small>Valeur totale stock</small><b>${money(totalSale)}</b><em>Vente totale estimée</em></div></div></div><div class="stockSubTitle"><h2>ÉTAT DU STOCK — CATÉGORIE : ${esc(categoryLabel)}</h2></div><table class="stockTable"><colgroup><col style="width:5.5%"><col style="width:23.5%"><col style="width:9%"><col style="width:7.5%"><col style="width:10.5%"><col style="width:11%"><col style="width:12%"><col style="width:9.5%"><col style="width:11.5%"></colgroup><thead><tr><th>N°</th><th>Élément</th><th>Type</th><th>Qté</th><th>Achat U.<small>(FCFA)</small></th><th>Vente / Prix<small>(FCFA)</small></th><th>Valeur achat<small>(FCFA)</small></th><th>Marge<small>(%)</small></th><th>Valeur Marge<small>(FCFA)</small></th></tr></thead><tbody>${rows}<tr class="total"><td></td><td colspan="2">TOTAUX</td><td>${totalQty}</td><td></td><td></td><td>${Number(totalBuy).toLocaleString('fr-FR')}</td><td>${totalMargin.toLocaleString('fr-FR',{maximumFractionDigits:2})}%</td><td>${Number(totalValueMargin).toLocaleString('fr-FR')}</td></tr></tbody></table><div class="stockFinancial"><div><span class="stockCardIcon">□</span><div><small>VALEUR TOTALE D’ACHAT</small><b>${money(totalBuy)}</b></div></div><div><span class="stockCardIcon">$</span><div><small>VALEUR TOTALE DE VENTE</small><b>${money(totalSale)}</b></div></div></div>${globalPrintFooterHTML(company,'Rapport de stock')}</div>`;
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
  return `<div class="reportA4">${globalPrintHeaderHTML(company,'RAPPORT GÉNÉRAL DÉTAILLÉ DES SERVICES VENDUS')}<div class="reportTitle"><h1>RAPPORT GÉNÉRAL DÉTAILLÉ DES SERVICES VENDUS</h1></div><div class="goldLine"></div><div class="summary"><div>Période <b>${esc(periodLabel||('Exercice actif : '+month+' '+year))}</b></div><div>Commandes validées <b>${sorted.length}</b></div><div>Total ventes <b>${money(total)}</b></div></div><table class="reportTable"><colgroup><col style="width:14%"><col style="width:16%"><col style="width:18%"><col style="width:10%"><col style="width:18%"><col style="width:6%"><col style="width:9%"><col style="width:9%"></colgroup><thead><tr><th>N° Facture</th><th>Date</th><th>Client</th><th>Caisse</th><th>Service / Produit</th><th>Qté</th><th>Frais service</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="totalStrip">TOTAL ${esc(periodLabel||('EXERCICE '+month+' '+year)).toUpperCase()} : ${money(total)}${admin?' | Bénéfice : '+money(profit):''}</div><div class="pageFiller"></div>${globalPrintFooterHTML(company,'Rapport des ventes')}</div>`;
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
  return `<div class="yearA4">${globalPrintHeaderHTML(company,'TABLEAU DE GESTION SUR 12 MOIS')}<div class="yBanner">ANNÉE DE GESTION ADMINISTRATEUR</div><div class="yearPanel"><div class="yearPanelTitle"><h1>TABLEAU DE GESTION SUR 12 MOIS</h1><h3>${esc(company.name||'Entreprise')} — Année ${year}</h3></div><div class="yMonthsGrid">${cards}</div><table class="yearlyA4Table"><colgroup><col style="width:12%"><col style="width:9%"><col style="width:8%"><col style="width:14%"><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:11%"><col style="width:10%"></colgroup><thead><tr><th>Mois</th><th>Commandes</th><th>Articles</th><th>Chiffre d’affaires</th><th>Frais service</th><th>Charges estimées</th><th>Bénéfice estimé</th><th>Obligations</th><th>Résultat net</th></tr></thead><tbody>${tr}<tr class="total"><td>TOTAL ANNUEL</td><td>${total.commandes}</td><td>${total.articles}</td><td>${money(total.ca)}</td><td>${money(total.serviceFee)}</td><td>${money(total.charges)}</td><td>${money(total.benef)}</td><td>${money(total.obligations)}</td><td>${money(total.net)}</td></tr></tbody></table></div>${globalPrintFooterHTML(company,'Gestion annuelle')}</div>`;
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




/* Panier professionnel de la caisse : les lignes restent en attente jusqu'à l'encaissement. */
function getCartCutoffDate(d,cid){
  const clearedAt=(d.cartClearedAt&&d.cartClearedAt[cid])||'';
  const validatedAt=(d.cartValidatedAt&&d.cartValidatedAt[cid])||'';
  if(clearedAt && validatedAt) return String(clearedAt)>String(validatedAt)?clearedAt:validatedAt;
  return clearedAt || validatedAt || '';
}
function getCurrentCompanyCartSales(){ return getCompanyCartSales(); }
async function validateCart(){
  if(!ensureActiveExerciseEditable()) return;
  const {d,company}=current();
  const cart=getCurrentCompanyCartSales();
  if(!cart.length) return g3Alert('Le panier est vide. Sélectionnez au moins un produit ou un service.','Encaissement impossible','info');
  const clients=(d.clients||[]).filter(c=>c.companyId===company.id);
  const meta=captureSaleCartClient(false);
  const clientLabel=saleCartClientLabel(meta,clients);
  if(meta.clientType==='contrat'&&!meta.contractClientId) return g3Alert('Choisissez un client sous contrat avant l’encaissement.','Client obligatoire','info');
  if(meta.clientType!=='contrat'&&!String(meta.clientName||'').trim()) return g3Alert('Saisissez le nom du client avant l’encaissement.','Client obligatoire','info');
  if(!clientLabel) return g3Alert('Les informations du client sont incomplètes.','Client obligatoire','info');
  const grouped={};
  cart.forEach(s=>{if(String(s.saleKind||'')==='boutique'){grouped[s.itemId]=(grouped[s.itemId]||0)+Number(s.qty||0)}});
  for(const itemId of Object.keys(grouped)){
    const it=(d.items||[]).find(i=>i.companyId===company.id&&i.id===itemId);
    if(!it) return g3Alert('Un produit du panier est introuvable. Actualisez la page.','Validation impossible','danger');
    if(String(it.stockType||'limited').toLowerCase()!=='unlimited'&&saleRegisterStockQty(it)<grouped[itemId]) return g3Alert('Stock insuffisant pour valider : '+(it.name||'produit')+'.','Validation impossible','danger');
  }
  const btn=$('#saleCartCheckoutBtn'); const old=btn?.innerHTML||'';
  if(btn){btn.disabled=true;btn.innerHTML='<span>⏳</span> ENCAISSEMENT EN COURS…';}
  const backup=JSON.parse(JSON.stringify(d));
  try{
    Object.keys(grouped).forEach(itemId=>{const it=(d.items||[]).find(i=>i.companyId===company.id&&i.id===itemId);if(it&&String(it.stockType||'limited').toLowerCase()!=='unlimited')setSaleRegisterStockQty(it,saleRegisterStockQty(it)-grouped[itemId])});
    const now=new Date().toISOString();
    cart.forEach(s=>{
      s.client=clientLabel;
      s.clientType=meta.clientType;
      s.contractClientId=meta.clientType==='contrat'?meta.contractClientId:'';
      s.clientPhone=meta.clientType==='contrat'?'':meta.phone;
      s.clientAddress=meta.clientType==='contrat'?'':meta.address;
      s.saleStatus='validated'; s.status='validated'; s.cartPending=false; s.validatedAt=now; s.cartCreatedAt=s.cartCreatedAt||s.date; s.date=now;
    });
    d.saleCartMeta=d.saleCartMeta||{}; d.saleCartMeta[company.id]=saleCartMetaDefault();
    CLOUD_DATA=normalizeData(d); clearTimeout(CLOUD_SAVE_TIMER); await cloudSaveNow(CLOUD_DATA);
    logCaisseAction('Encaissement panier','Commande validée : '+cart.length+' ligne(s) — Client : '+clientLabel);
    renderDash('vente');
    g3Success('Encaissement validé avec succès. La commande apparaît maintenant dans les rapports.','Commande encaissée');
  }catch(e){
    CLOUD_DATA=normalizeData(backup);
    if(btn){btn.disabled=false;btn.innerHTML=old;}
    g3Alert('L’encaissement n’a pas été enregistré : '+(e?.message||'erreur réseau')+'. Aucune ligne du panier n’a été validée.','Échec de l’encaissement','danger');
  }
}
async function emptyCart(){
  const {d,company}=current();
  const cart=getCurrentCompanyCartSales();
  if(!cart.length) return g3Alert('Le panier est déjà vide.','Panier','info');
  if(!(await g3Confirm('Vider entièrement le panier actuel ?','Vider le panier'))) return;
  d.sales=(d.sales||[]).filter(s=>!(s.companyId===company.id&&isSaleCartPending(s)));
  save(d); logCaisseAction('Vider panier','Panier caisse vidé'); renderDash('vente');
}
function filterSalesByInvoice(){
  if(document.querySelector('#serviceReportSalesTable')) return applyServiceReportPeriodFilter();
  const q=String(document.getElementById('invoiceSearch')?.value||'').toLowerCase().trim();
  document.querySelectorAll('tr[data-invoice]').forEach(tr=>{
    tr.style.display = (!q || String(tr.getAttribute('data-invoice')||'').includes(q)) ? '' : 'none';
  });
}
function openEditSalePopup(sid){
  const {d,company}=current();
  const s=(d.sales||[]).find(x=>x.companyId===company.id&&x.id===sid);
  if(!s) return alert('Vente introuvable');
  openEditCartLine(sid);
}

function printSaleReport(sid){logCaisseAction('Impression facture / reçu','Facture '+sid); const {d,company}=current(); const s=d.sales.find(x=>x.companyId===company.id&&x.id===sid); if(!s) return alert('Vente introuvable'); const ref=s.id, dt=new Date(s.date).toLocaleString('fr-FR'); shell(`<div class="g2panel printable"><div class="reportActions no-print"><button onclick="show('rapports')">Retour au rapport</button><button onclick="openSalePdfPage('${s.id}')">Imprimer / PDF</button><button onclick="shareText('${secureDocLink(ref)}')">Partager</button></div>${premiumSaleInvoiceHTML(company,s,ref,dt)}</div>`,'rapports')}
function localDateISO(d=new Date()){const x=new Date(d); x.setMinutes(x.getMinutes()-x.getTimezoneOffset()); return x.toISOString().slice(0,10)}
function saleItemInfo(items,s){
  const it=(items||[]).find(i=>i.id===s.itemId||i.name===s.name) || {};
  return {name:s.name||it.name||'Produit / service non précisé', detail:s.note||it.marketplaceDesc||it.detail||s.category||it.cat||'—', cat:s.category||it.cat||'SERVICE / PRODUIT'};
}
function bilanJourReport(items,sales){
  const selected=window.__bilanJourDate || localDateISO();
  const daySales=(sales||[]).filter(s=>localDateISO(s.date||new Date())===selected);
  const map={};
  daySales.forEach(s=>{
    const inf=saleItemInfo(items,s);
    const key=inf.cat+'__'+inf.name;
    if(!map[key]) map[key]={cat:inf.cat,name:inf.name,clients:new Set(),qty:0,total:0,serviceFee:0,charges:0,profit:0,count:0};
    const r=map[key];
    if(s.client) r.clients.add(s.client);
    r.qty+=Number(s.qty||0); r.total+=Number(s.total||0); r.serviceFee+=Number(s.serviceFee||0); r.charges+=Number(s.charges||0); r.profit+=Number(s.profit||0); r.count+=1;
  });
  const rows=Object.values(map);
  const tq=rows.reduce((a,b)=>a+b.qty,0), tt=rows.reduce((a,b)=>a+b.total,0), tf=rows.reduce((a,b)=>a+b.serviceFee,0), tc=rows.reduce((a,b)=>a+b.charges,0), tp=rows.reduce((a,b)=>a+b.profit,0);
  return `<div class="serviceBlock bilanJourBlock"><h2>BILAN JOUR</h2><div class="invoiceSearchBox no-print bilanDateBox"><label>Choisir le jour : <input type="date" value="${esc(selected)}" onchange="showBilanJourPage(this.value)"></label></div><h3>Résumé des ventes / jour</h3><table class="g2table bilanJourTable"><tr><th>Catégorie</th><th>Produit / Service</th><th>Nombre de ventes</th><th>Clients servis</th><th>Quantité totale</th><th>Chiffre d’affaires</th><th>Frais service</th><th>Charges estimées</th><th>Bénéfice estimé</th></tr>${rows.map(r=>`<tr><td>${esc(r.cat)}</td><td>${esc(r.name)}</td><td>${r.count}</td><td>${r.clients.size}</td><td>${r.qty}</td><td>${money(r.total)}</td><td>${money(r.serviceFee)}</td><td>${money(r.charges)}</td><td>${money(r.profit)}</td></tr>`).join('')||'<tr><td colspan="9">Aucune vente enregistrée pour le jour sélectionné.</td></tr>'}<tr class="total"><td colspan="4">TOTAL JOUR</td><td>${tq}</td><td>${money(tt)}</td><td>${money(tf)}</td><td>${money(tc)}</td><td>${money(tp)}</td></tr></table></div>`;
}

function bilanJoursList(items,sales){
  const map={};
  (sales||[]).forEach(s=>{
    const jour=localDateISO(s.date||new Date());
    if(!map[jour]) map[jour]={jour,clients:new Set(),qty:0,total:0,serviceFee:0,charges:0,profit:0,count:0};
    const r=map[jour];
    if(s.client) r.clients.add(s.client);
    r.qty+=Number(s.qty||0);
    r.total+=Number(s.total||0);
    r.serviceFee+=Number(s.serviceFee||0);
    r.charges+=Number(s.charges||0);
    r.profit+=Number(s.profit||0);
    r.count+=1;
  });
  const rows=Object.values(map).sort((a,b)=>String(b.jour).localeCompare(String(a.jour)));
  const tq=rows.reduce((a,b)=>a+b.qty,0), tt=rows.reduce((a,b)=>a+b.total,0), tf=rows.reduce((a,b)=>a+b.serviceFee,0), tc=rows.reduce((a,b)=>a+b.charges,0), tp=rows.reduce((a,b)=>a+b.profit,0);
  return `<div class="serviceBlock bilanJoursListBlock"><h2>LISTE DES JOURS ET LEURS BILANS</h2><p class="small darkSmall">Cette liste affiche le bilan général de chaque journée de vente enregistrée dans l’exercice actif.</p><table class="g2table bilanJoursListTable"><tr><th>Jour</th><th>Nombre de ventes</th><th>Clients servis</th><th>Quantité totale</th><th>Chiffre d’affaires</th><th>Frais service</th><th>Charges estimées</th><th>Bénéfice estimé</th><th class="no-print">Action</th></tr>${rows.map(r=>`<tr><td><b>${esc(new Date(r.jour+'T00:00:00').toLocaleDateString('fr-FR'))}</b></td><td>${r.count}</td><td>${r.clients.size}</td><td>${r.qty}</td><td>${money(r.total)}</td><td>${money(r.serviceFee)}</td><td>${money(r.charges)}</td><td>${money(r.profit)}</td><td class="no-print"><button onclick="showBilanJourPage('${esc(r.jour)}')">Voir détail</button></td></tr>`).join('')||'<tr><td colspan="9">Aucun jour de vente enregistré.</td></tr>'}<tr class="total"><td colspan="3">TOTAL GÉNÉRAL DES JOURS</td><td>${tq}</td><td>${money(tt)}</td><td>${money(tf)}</td><td>${money(tc)}</td><td>${money(tp)}</td><td class="no-print">—</td></tr></table></div>`;
}

function bilanJourA4HTML(company,items,sales,selected){
  const daySales=(sales||[]).filter(s=>localDateISO(s.date||new Date())===selected);
  const map={};
  daySales.forEach(s=>{const inf=saleItemInfo(items,s);const key=inf.cat+'__'+inf.name;if(!map[key]) map[key]={cat:inf.cat,name:inf.name,clients:new Set(),qty:0,total:0,serviceFee:0,charges:0,profit:0,count:0};const r=map[key];if(s.client) r.clients.add(s.client);r.qty+=Number(s.qty||0);r.total+=Number(s.total||0);r.serviceFee+=Number(s.serviceFee||0);r.charges+=Number(s.charges||0);r.profit+=Number(s.profit||0);r.count+=1;});
  const rows=Object.values(map);const tq=rows.reduce((a,b)=>a+b.qty,0),tt=rows.reduce((a,b)=>a+b.total,0),tf=rows.reduce((a,b)=>a+b.serviceFee,0),tc=rows.reduce((a,b)=>a+b.charges,0),tp=rows.reduce((a,b)=>a+b.profit,0);
  const body=rows.map(r=>`<tr><td>${esc(r.cat)}</td><td>${esc(r.name)}</td><td>${r.count}</td><td>${r.clients.size}</td><td>${r.qty}</td><td>${money(r.total)}</td><td>${money(r.serviceFee)}</td><td>${money(r.charges)}</td><td>${money(r.profit)}</td></tr>`).join('') || '<tr><td colspan="9" class="emptyCell">Aucune vente enregistrée pour le jour sélectionné.</td></tr>';
  const selectedLabel=new Date(selected+'T00:00:00').toLocaleDateString('fr-FR');
  return `<div class="reportA4">${globalPrintHeaderHTML(company,'BILAN JOUR')}<div class="reportTitle"><h1>BILAN JOUR</h1><h2>Date du résumé : ${esc(selectedLabel)}</h2></div><div class="goldLine"></div><div class="blockTitle">RÉSUMÉ DES VENTES / JOUR</div><table class="reportTable"><thead><tr><th>Catégorie</th><th>Produit / Service</th><th>Nombre de ventes</th><th>Clients servis</th><th>Quantité totale</th><th>Chiffre d’affaires</th><th>Frais service</th><th>Charges estimées</th><th>Bénéfice estimé</th></tr></thead><tbody>${body}<tr class="total"><td colspan="4"><b>TOTAL JOUR</b></td><td>${tq}</td><td>${money(tt)}</td><td>${money(tf)}</td><td>${money(tc)}</td><td>${money(tp)}</td></tr></tbody></table>${globalPrintFooterHTML(company,'Bilan journalier')}</div>`;
}

function showBilanJourPage(selectedDate){
  const {d,company}=current();
  if(selectedDate) window.__bilanJourDate=selectedDate;
  const sales=getCompanyValidatedSales().filter(isInActiveExercise);
  const items=(d.items||[]).filter(i=>i.companyId===company.id);
  const selected=window.__bilanJourDate || localDateISO();
  shell(`<div class="g2panel printable bilanJourPage"><div class="reportActions no-print"><button onclick="show('rapports')">Retour au rapport</button><button onclick="openBilanJourPdfPage()">Imprimer / PDF</button><button onclick="openListeBilansJoursPdfPage()">Imprimer Liste des jours et leurs bilans</button></div><div class="reportBox"><h1>RÉSUMÉ DES VENTES / JOUR</h1><h3>${esc(company.name)} — Jour sélectionné : ${esc(selected)} — Exercice actif : ${monthsList[getActiveMonth()]} ${getManageYear()}</h3>${bilanJoursList(items,sales)}${bilanJourReport(items,sales)}</div></div>`, 'rapports');
}

function listeBilansJoursA4HTML(company,items,sales){
  const map={};
  (sales||[]).forEach(s=>{const jour=localDateISO(s.date||new Date());if(!map[jour]) map[jour]={jour,clients:new Set(),qty:0,total:0,serviceFee:0,charges:0,profit:0,count:0};const r=map[jour];if(s.client) r.clients.add(s.client);r.qty+=Number(s.qty||0);r.total+=Number(s.total||0);r.serviceFee+=Number(s.serviceFee||0);r.charges+=Number(s.charges||0);r.profit+=Number(s.profit||0);r.count+=1;});
  const rows=Object.values(map).sort((a,b)=>String(b.jour).localeCompare(String(a.jour)));
  const tq=rows.reduce((a,b)=>a+b.qty,0),tt=rows.reduce((a,b)=>a+b.total,0),tf=rows.reduce((a,b)=>a+b.serviceFee,0),tc=rows.reduce((a,b)=>a+b.charges,0),tp=rows.reduce((a,b)=>a+b.profit,0);
  const body=rows.map(r=>`<tr><td><b>${esc(new Date(r.jour+'T00:00:00').toLocaleDateString('fr-FR'))}</b></td><td>${r.count}</td><td>${r.clients.size}</td><td>${r.qty}</td><td>${money(r.total)}</td><td>${money(r.serviceFee)}</td><td>${money(r.charges)}</td><td>${money(r.profit)}</td></tr>`).join('') || '<tr><td colspan="8" class="emptyCell">Aucun jour de vente enregistré.</td></tr>';
  return `<div class="reportA4">${globalPrintHeaderHTML(company,'LISTE DES JOURS ET LEURS BILANS')}<div class="reportTitle"><h1>LISTE DES JOURS ET LEURS BILANS</h1><h2>Résumé général par journée de vente</h2></div><div class="goldLine"></div><div class="blockTitle">LISTE DES JOURS ET LEURS BILANS</div><table class="reportTable"><thead><tr><th>Jour</th><th>Nombre de ventes</th><th>Clients servis</th><th>Quantité totale</th><th>Chiffre d’affaires</th><th>Frais service</th><th>Charges estimées</th><th>Bénéfice estimé</th></tr></thead><tbody>${body}<tr class="total"><td colspan="3"><b>TOTAL GÉNÉRAL DES JOURS</b></td><td>${tq}</td><td>${money(tt)}</td><td>${money(tf)}</td><td>${money(tc)}</td><td>${money(tp)}</td></tr></tbody></table>${globalPrintFooterHTML(company,'Liste des bilans journaliers')}</div>`;
}

function openListeBilansJoursPdfPage(){
  const {d,company}=current();
  const sales=getCompanyValidatedSales().filter(isInActiveExercise);
  const items=(d.items||[]).filter(i=>i.companyId===company.id);
  const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Liste des jours et leurs bilans</title><style>'+serviceReportPrintStyles()+'</style></head><body><div class="printToolbar"><button onclick="window.print()">Imprimer / PDF</button><button onclick="window.close()">Fermer</button></div>'+listeBilansJoursA4HTML(company,items,sales)+'<script>setTimeout(function(){window.focus();},200);</script></body></html>';
  const w=window.open('','_blank');
  if(!w){const blob=new Blob([html],{type:'text/html;charset=utf-8'}); const url=URL.createObjectURL(blob); location.href=url; return;}
  w.document.open(); w.document.write(html); w.document.close();
}

function openBilanJourPdfPage(){
  const {d,company}=current();
  const selected=window.__bilanJourDate || localDateISO();
  const sales=getCompanyValidatedSales().filter(isInActiveExercise);
  const items=(d.items||[]).filter(i=>i.companyId===company.id);
  const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bilan jour</title><style>'+serviceReportPrintStyles()+'</style></head><body><div class="printToolbar"><button onclick="window.print()">Imprimer / PDF</button><button onclick="window.close()">Fermer</button></div>'+bilanJourA4HTML(company,items,sales,selected)+'<script>setTimeout(function(){window.focus();},200);</script></body></html>';
  const w=window.open('','_blank');
  if(!w){const blob=new Blob([html],{type:'text/html;charset=utf-8'}); const url=URL.createObjectURL(blob); location.href=url; return;}
  w.document.open(); w.document.write(html); w.document.close();
}
function serviceReportPeriodDefaults(){
  return {type:'mois',year:String(getManageYear()),month:String(getActiveMonth()+1).padStart(2,'0'),day:String(new Date().getDate()).padStart(2,'0')};
}
function serviceReportPeriodLabel(type,year,month,day){
  if(type==='jour' && year && month && day) return 'Jour sélectionné : '+year+'-'+month+'-'+day;
  if(type==='annee' && year) return 'Année sélectionnée : '+year;
  if(type==='mois' && year && month) return 'Mois sélectionné : '+year+'-'+month;
  return 'Période sélectionnée : toutes les ventes disponibles';
}
function serviceReportSaleMatchesPeriod(s,type,year,month,day){
  const date=String(s?.date||'').slice(0,10), yy=date.slice(0,4), mm=date.slice(5,7), dd=date.slice(8,10);
  if(type==='jour') return year&&month&&day ? (yy===String(year)&&mm===String(month).padStart(2,'0')&&dd===String(day).padStart(2,'0')) : true;
  if(type==='annee') return year ? yy===String(year) : true;
  return year&&month ? (yy===String(year)&&mm===String(month).padStart(2,'0')) : true;
}
function serviceReportFilteredSalesFromValues(sales,type,year,month,day){
  return (sales||[]).filter(s=>serviceReportSaleMatchesPeriod(s,type,year,month,day));
}
function getServiceReportFilterValues(){
  const def=serviceReportPeriodDefaults();
  const rawType=$('#serviceFilterType')?.value||def.type;
  const type=(rawType==='jour'||rawType==='mois'||rawType==='annee')?rawType:'mois';
  const year=$('#serviceFilterYear')?.value||def.year;
  const month=$('#serviceFilterMonth')?.value||def.month;
  const day=$('#serviceFilterDay')?.value||def.day;
  return {type,year,month,day};
}
function toggleServiceReportPeriodFields(apply=true){
  const typeEl=$('#serviceFilterType');
  const t=typeEl?.value||'mois';
  const def=serviceReportPeriodDefaults();
  const yearEl=$('#serviceFilterYear'), monthEl=$('#serviceFilterMonth'), dayEl=$('#serviceFilterDay');
  if(yearEl && !yearEl.value) yearEl.value=def.year;
  if(monthEl && !monthEl.value) monthEl.value=def.month;
  if(dayEl && !dayEl.value) dayEl.value=def.day;

  // Règle demandée :
  // - Vente du Jour  : Année + Mois + Jour
  // - Vente du Mois  : Année + Mois
  // - Vente de l’Année : Année uniquement
  // Les champs inutiles sont masqués avec priorité CSS pour neutraliser les anciennes règles !important.
  const showYear=true;
  const showMonth=(t==='jour'||t==='mois');
  const showDay=(t==='jour');

  const setVisible=(selector,visible)=>{
    document.querySelectorAll(selector).forEach(e=>{
      e.style.setProperty('display', visible ? 'flex' : 'none', 'important');
      e.setAttribute('aria-hidden', visible ? 'false' : 'true');
    });
  };
  setVisible('.serviceYearField', showYear);
  setVisible('.serviceMonthField', showMonth);
  setVisible('.serviceDayField', showDay);

  if(yearEl) yearEl.disabled=!showYear;
  if(monthEl) monthEl.disabled=!showMonth;
  if(dayEl) dayEl.disabled=!showDay;

  if(apply) applyServiceReportPeriodFilter();
}
function serviceReportPageSize(){return 30;}
function changeServiceReportPage(delta){
  const totalPages=Math.max(1,Number(window.g3ServiceReportTotalPages||1));
  const current=Math.max(1,Number(window.g3ServiceReportPage||1));
  window.g3ServiceReportPage=Math.min(totalPages,Math.max(1,current+Number(delta||0)));
  applyServiceReportPeriodFilter();
  document.querySelector('#serviceReportSalesTable')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function reportSaleRowInteractiveTarget(target){return Boolean(target?.closest?.('button,input,select,textarea,a,label'));}
function openReportSaleFromRow(event,sid){if(reportSaleRowInteractiveTarget(event?.target))return; openEditSalePopup(sid);}
function openReportSaleFromKey(event,sid){if(!event||(event.key!=='Enter'&&event.key!==' '))return; if(reportSaleRowInteractiveTarget(event.target))return; event.preventDefault(); openEditSalePopup(sid);}
function applyServiceReportPeriodFilter(){
  const table=$('#serviceReportSalesTable'); if(!table) return;
  toggleServiceReportPeriodFields(false);
  const {type,year,month,day}=getServiceReportFilterValues();
  const q=String($('#invoiceSearch')?.value||'').toLowerCase().trim();
  const filterKey=[type,year,month,day,q].join('|');
  if(window.g3ServiceReportFilterKey!==filterKey){window.g3ServiceReportFilterKey=filterKey;window.g3ServiceReportPage=1;}
  let total=0, profit=0, count=0, qty=0;
  const matched=[];
  document.querySelectorAll('#serviceReportSalesTable tbody tr.serviceSaleRow').forEach(r=>{
    const date=r.dataset.date||'', yy=date.slice(0,4), mm=date.slice(5,7), dd=date.slice(8,10);
    let periodOk=true;
    if(type==='jour') periodOk=year&&month&&day ? (yy===String(year)&&mm===String(month).padStart(2,'0')&&dd===String(day).padStart(2,'0')) : true;
    else if(type==='mois') periodOk=year&&month ? (yy===String(year)&&mm===String(month).padStart(2,'0')) : true;
    else if(type==='annee') periodOk=year ? yy===String(year) : true;
    const invoiceOk=!q || String(r.dataset.invoice||'').includes(q);
    const ok=periodOk&&invoiceOk;
    if(ok){matched.push(r);count++; total+=Number(r.dataset.total||0); profit+=Number(r.dataset.profit||0); qty+=Number(r.dataset.qty||0);}
    r.style.display='none';
  });
  const pageSize=serviceReportPageSize();
  const totalPages=Math.max(1,Math.ceil(matched.length/pageSize));
  window.g3ServiceReportTotalPages=totalPages;
  window.g3ServiceReportPage=Math.min(totalPages,Math.max(1,Number(window.g3ServiceReportPage||1)));
  const page=window.g3ServiceReportPage;
  const start=(page-1)*pageSize, end=start+pageSize;
  matched.slice(start,end).forEach(r=>{r.style.display='';});
  const label=serviceReportPeriodLabel(type,year,month,day);
  const lab=$('#serviceReportPeriodLabel'); if(lab) lab.textContent=label;
  const st=$('#serviceReportSummaryTotal'); if(st) st.textContent=money(total);
  const sc=$('#serviceReportSummaryCount'); if(sc) sc.textContent=count;
  const sq=$('#serviceReportSummaryQty'); if(sq) sq.textContent=qty;
  const totalLine=$('#serviceReportTotalLine'); if(totalLine) totalLine.textContent='TOTAL PÉRIODE — '+label.replace(' : ',' : ')+' : '+money(total)+(window.g3ReportAdmin?' | Bénéfice : '+money(profit):'');
  const no=$('#serviceReportNoResult'); if(no) no.classList.toggle('hidden', count>0 || !document.querySelector('#serviceReportSalesTable tbody tr.serviceSaleRow'));
  const pager=$('#serviceReportPagination'); if(pager) pager.classList.toggle('hidden',matched.length<=pageSize);
  const pageLabel=$('#serviceReportPageLabel'); if(pageLabel) pageLabel.textContent='Page '+page+' sur '+totalPages+' — '+matched.length+' ligne(s)';
  const prev=$('#serviceReportPrev'); if(prev) prev.disabled=page<=1;
  const next=$('#serviceReportNext'); if(next) next.disabled=page>=totalPages;
}
function getServiceReportFilteredSalesForPrint(){
  const {d,company}=current(); const all=getCompanyValidatedSales();
  const {type,year,month,day}=getServiceReportFilterValues();
  return serviceReportFilteredSalesFromValues(all,type,year,month,day);
}
function serviceReport(items,sales,admin=false){
  window.g3ReportAdmin=!!admin;
  const def=serviceReportPeriodDefaults();
  const baseYear=Number(def.year||new Date().getFullYear());
  const years=[...new Set([
    ...Array.from({length:21},(_,i)=>baseYear+10-i),
    ...(sales||[]).map(s=>new Date(s.date||Date.now()).getFullYear()).filter(Boolean)
  ])].sort((a,b)=>b-a);
  if(!years.includes(Number(def.year))) years.unshift(Number(def.year));
  const initial=serviceReportFilteredSalesFromValues(sales,'mois',def.year,def.month,def.day);
  const total=initial.reduce((a,b)=>a+Number(b.total||0),0);
  const count=initial.length;
  const qtyTotal=initial.reduce((a,b)=>a+Number(b.qty||0),0);
  const fmtShortDate=(value)=>{
    const dt=new Date(value||Date.now());
    return dt.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'})+' '+dt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  };
  const actionBtns=(sid)=>`<td class="actionCell"><div class="rowActions"><button title="Imprimer la facture" onclick="printSaleReport('${sid}')">🧾 Fact.</button><button class="btn2" title="Modifier la vente" onclick="openEditSalePopup('${sid}')">✎ Mod.</button><button class="danger" title="Supprimer la vente" onclick="deleteSaleFromReport('${sid}')">🗑 Suppr.</button></div></td>`;
  const rows=(sales||[]).slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).map(s=>{
    const user=(seed().users||[]).find(u=>u.id===s.userId);
    const clientTxt=s.client||'Non précisé';
    const clientName=clientTxt.replace(/\s*\/\s*.*/,'')||'Non précisé';
    const badge=s.clientType==='contrat'?'Contrat':'Simple';
    const caisse=user?.role||'caisse';
    const inf=saleItemInfo(items,s);
    const inv=String(s.id||'').toLowerCase();
    const sid=String(s.id||'');
    const fullDate=new Date(s.date||Date.now()).toLocaleString('fr-FR');
    return `<tr class="serviceSaleRow serviceSaleRowClickable" role="button" tabindex="0" title="Cliquer pour ouvrir cette vente" onclick="openReportSaleFromRow(event,'${esc(sid)}')" onkeydown="openReportSaleFromKey(event,'${esc(sid)}')" data-date="${esc(String(s.date||'').slice(0,10))}" data-invoice="${esc(inv)}" data-total="${Number(s.total||0)}" data-profit="${Number(s.profit||0)}" data-qty="${Number(s.qty||0)}"><td class="no-print selectCol" data-label="✓"><input class="reportSaleCheck" type="checkbox" value="${esc(sid)}"></td><td class="rtInvoice" data-label="Facture" title="${esc(sid)}">${esc(sid)}</td><td class="rtDate" data-label="Date" title="${esc(fullDate)}">${esc(fmtShortDate(s.date))}</td><td class="rtClient" data-label="Client" title="${esc(clientName+' — '+badge)}"><span class="rtClip">${esc(clientName)}</span> <span class="saleBadge mini">${badge}</span></td><td class="rtCaisse" data-label="Caisse" title="${esc(caisse)}"><span class="saleBadge mini">${esc(caisse)}</span></td><td class="rtItem" data-label="Élément" title="${esc((inf.name||'')+' — '+(inf.detail||''))}">${esc(inf.name)}</td><td class="rtQty" data-label="Qté">${Number(s.qty||1)}</td><td class="rtMoney" data-label="Frais" title="${esc(money(s.serviceFee||0))}">${money(s.serviceFee||0)}</td><td class="rtMoney rtTotal" data-label="Total" title="${esc(money(s.total||0))}">${money(s.total||0)}</td>${admin?actionBtns(esc(sid)):''}</tr>`;
  }).join('');
  const colgroup=admin
    ? '<colgroup><col style="width:3%"><col style="width:10%"><col style="width:11%"><col style="width:13%"><col style="width:8%"><col style="width:20%"><col style="width:5%"><col style="width:9%"><col style="width:10%"><col style="width:11%"></colgroup>'
    : '<colgroup><col style="width:4%"><col style="width:12%"><col style="width:13%"><col style="width:17%"><col style="width:9%"><col style="width:23%"><col style="width:6%"><col style="width:8%"><col style="width:8%"></colgroup>';
  return `<h3 id="serviceReportPeriodLabel" class="serviceReportPeriodLabel">${serviceReportPeriodLabel('mois',def.year,def.month,def.day)}</h3>
  <div class="serviceReportFilterBox no-print"><div class="serviceReportFilterLine"><h4>CHOISIR LA PÉRIODE</h4><div class="serviceReportFilterGrid"><label>Type de filtre<select id="serviceFilterType" onchange="toggleServiceReportPeriodFields(true)"><option value="jour">Vente du Jour</option><option value="mois" selected>Vente du Mois</option><option value="annee">Vente de l’Année</option></select></label><label class="serviceYearField">Année<select id="serviceFilterYear" onchange="applyServiceReportPeriodFilter()">${years.map(y=>`<option value="${y}" ${String(y)===String(def.year)?'selected':''}>${y}</option>`).join('')}</select></label><label class="serviceMonthField">Mois<select id="serviceFilterMonth" onchange="applyServiceReportPeriodFilter()">${monthsList.map((m,i)=>`<option value="${String(i+1).padStart(2,'0')}" ${String(i+1).padStart(2,'0')===def.month?'selected':''}>${m}</option>`).join('')}</select></label><label class="serviceDayField" style="display:none!important" aria-hidden="true">Jour<select id="serviceFilterDay" onchange="applyServiceReportPeriodFilter()">${Array.from({length:31},(_,i)=>`<option value="${String(i+1).padStart(2,'0')}" ${String(i+1).padStart(2,'0')===def.day?'selected':''}>${i+1}</option>`).join('')}</select></label></div></div></div>
  <div class="serviceBlock detailedSalesBlock compactReportSalesBlock">
  <div class="reportBulkToolbar reportBulkToolbarStats no-print"><div class="reportBulkActions"><label><input type="checkbox" onchange="toggleAllSaleChecks('report',this.checked)"> Tout sélectionner</label><button class="btn2" onclick="openSelectedSalesInvoice('report')">Éditer facture sélectionnée</button>${admin?'<button class="danger" onclick="bulkDeleteSelectedReportSales()">Supprimer la sélection</button>':''}</div><div class="reportInlineStats"><div class="reportStatCard"><span>Commandes validées</span><b id="serviceReportSummaryCount">${count}</b></div><div class="reportStatCard"><span>Quantité vendue</span><b id="serviceReportSummaryQty">${qtyTotal}</b></div><div class="reportStatCard"><span>Total ventes</span><b id="serviceReportSummaryTotal">${money(total)}</b></div></div></div><div class="invoiceSearchBox no-print"><input id="invoiceSearch" oninput="filterSalesByInvoice()" placeholder="Rechercher une vente par N° de facture..."><button onclick="filterSalesByInvoice()">Rechercher</button></div>
  <table class="g2table detailedSalesTable compactReportSalesTable" id="serviceReportSalesTable">${colgroup}<thead><tr><th class="no-print">✓</th><th>Facture</th><th>Date</th><th>Client</th><th>Caisse</th><th>Élément vendu</th><th>Qté</th><th>Frais</th><th>Total</th>${admin?'<th>Act.</th>':''}</tr></thead><tbody>
  ${rows || `<tr><td colspan="${admin?10:9}">Aucune vente validée disponible.</td></tr>`}
  </tbody></table><div id="serviceReportPagination" class="serviceReportPagination no-print hidden"><button id="serviceReportPrev" type="button" onclick="changeServiceReportPage(-1)">← Précédent</button><span id="serviceReportPageLabel">Page 1 sur 1</span><button id="serviceReportNext" type="button" onclick="changeServiceReportPage(1)">Suivant →</button></div><div id="serviceReportNoResult" class="notice serviceReportNoResult hidden">Aucune vente trouvée pour cette période.</div>
  ${admin?'<div class="clearHistoryBar no-print"><button class="clearHistoryBtn" onclick="clearSalesHistory()">🗑️ Vider l’historique</button><small>Cette action supprimera définitivement toutes les ventes enregistrées.</small></div>':''}
  </div>`;
}
function clientContractSection(clients,admin,sales){
  return `<div class="contractTopActions no-print">
    <button class="contractAddBtn" onclick="openContractClientPopup()">Ajouter client sous contrat</button>
    <button class="contractListBtn" onclick="showContractClientList()">Liste des clients sous contrat</button>
  </div>
  ${clientContractForm()}
  <div id="contractClientListPage" class="contractClientListPage hidden">${clientContractList(clients,admin)}</div>
  ${clientConsumptionBlock(sales)}`;
}
function clientContractForm(){
  return `<div id="contractClientModal" class="modal hidden contractClientModal"><div class="modalOverlay" onclick="closeContractClientPopup()"></div><div class="modalCard contractModalCard"><button class="modalClose" onclick="closeContractClientPopup()">×</button><h2>Formulaire d’ajout client sous contrat</h2><p class="sub">Renseignez les informations du client et validez l’enregistrement.</p><input id="ccEdit" type="hidden"><div class="contractGoldForm"><label>Nom du client contrat<input id="ccName" placeholder="Nom du client contrat"></label><label>Téléphone<input id="ccPhone" placeholder="Téléphone"></label><label>Type de facturation<select id="ccMode"><option value="Mensuelle">Mensuelle</option><option value="Trimestriel">Trimestriel</option></select></label><label>Remise en %<input id="ccRemise" type="number" value="0" min="0" placeholder="Remise %"></label><label class="fullRow">Observation<textarea id="ccObs" rows="3" placeholder="Observation"></textarea></label></div><button id="ccSaveBtn" class="contractSaveBtn" onclick="addContractClient()">Enregistrer</button></div></div>`
}
function showContractClientList(){const page=document.querySelector('#contractClientListPage'); if(!page)return; page.classList.remove('hidden'); requestAnimationFrame(()=>page.scrollIntoView({behavior:'smooth',block:'start'}));}
function openContractClientPopup(){const m=document.querySelector('#contractClientModal'); if(!m) return; resetContractClientForm(); m.classList.remove('hidden'); setTimeout(()=>$('#ccName')?.focus(),60)}
function closeContractClientPopup(){document.querySelector('#contractClientModal')?.classList.add('hidden')}
function resetContractClientForm(){const fields=['ccEdit','ccName','ccPhone','ccObs']; fields.forEach(id=>{const el=$('#'+id); if(el)el.value=''}); const mode=$('#ccMode'); if(mode)mode.value='Mensuelle'; const remise=$('#ccRemise'); if(remise)remise.value=0; const title=document.querySelector('#contractClientModal h2'); if(title)title.textContent='Formulaire d’ajout client sous contrat'; const b=$('#ccSaveBtn'); if(b)b.textContent='Enregistrer'}
function clientContractList(clients,admin){
  return `<div class="contractListHeader"><h3>Liste des clients sous contrat</h3><span>${clients.length} client(s)</span></div><div class="contractCards">${clients.map(c=>`<div class="contractClientCard"><div class="contractClientMain"><h3>${esc(c.name)}</h3><div class="contractClientMeta"><span>☎ ${esc(c.phone||'Non renseigné')}</span><span>Facturation : ${esc(c.mode||'Mensuelle')}</span><span>Remise appliquée : ${Number(c.remise||0)}%</span></div>${c.obs?`<p>${esc(c.obs)}</p>`:''}</div>${admin?`<div class="contractClientActions"><button class="contractEditBtn" onclick="editContractClient('${c.id}')">Modifier</button><button class="contractInvoiceBtn" onclick="openContractClientInvoicePage('${c.id}')">Facture</button><button class="contractDeleteBtn" onclick="deleteContractClient('${c.id}')">Supprimer</button></div>`:''}</div>`).join('')||'<p class="notice">Aucun client sous contrat enregistré.</p>'}</div>`
}
function contractClientSales(c,allSales){
  const n=String(c?.name||'').toLowerCase().trim();
  return (allSales||[]).filter(s=>s.clientType==='contrat' && (s.contractClientId===c?.id || String(s.client||'').toLowerCase().includes(n))).sort((a,b)=>new Date(a.date)-new Date(b.date));
}
function contractInvoiceKeyForSale(c,s){
  const d=new Date(s.date||Date.now()), y=d.getFullYear(), m=d.getMonth()+1;
  if(String(c?.mode||'').toLowerCase().includes('trimes')){const q=Math.floor((m-1)/3)+1; return `${y}-T${q}`;}
  return `${y}-${String(m).padStart(2,'0')}`;
}
function contractInvoicePeriodLabel(key){return String(key||'').includes('-T')?String(key).replace('-T',' / Trimestre '):String(key||'')}
function contractClientInvoiceRows(c,allSales){
  const rows={};
  contractClientSales(c,allSales).forEach(s=>{const key=contractInvoiceKeyForSale(c,s); rows[key]=rows[key]||{key,total:0,count:0,items:[]}; rows[key].total+=Number(s.total||0); rows[key].count++; rows[key].items.push(s);});
  const remise=Number(c?.remise||0);
  return Object.values(rows).sort((a,b)=>String(b.key).localeCompare(String(a.key))).map(r=>Object.assign(r,{net:r.total-(r.total*remise/100)}));
}
function openContractClientInvoicePage(cid){
  const {d,company}=current(); const c=(d.clients||[]).find(x=>x.id===cid&&x.companyId===company.id); if(!c) return g3Alert('Client introuvable','Client introuvable','danger');
  const rows=contractClientInvoiceRows(c,getCompanyValidatedSales());
  if(!rows.length) g3Alert('Aucune consommation trouvée pour ce client sous contrat.','Aucune consommation','info');
  shell(`<div class="g2panel printable contractInvoicePage"><div class="reportActions no-print"><button onclick="renderDash('contrats')">Retour clients sous contrat</button><button onclick="window.print()">Imprimer la page</button></div><div class="contractInvoiceHead"><h1>FACTURES DU CLIENT SOUS CONTRAT</h1><h2>${esc(c.name)}</h2><p>${esc(c.phone||'')} — ${esc(c.mode||'Mensuelle')} — Remise ${Number(c.remise||0)}%</p></div><div class="contractInvoiceTableWrap"><table class="g2table contractInvoiceTable"><thead><tr><th>Type de facturation</th><th>Période facturée</th><th>Montant</th><th class="no-print">Action</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(c.mode||'Mensuelle')}</td><td>${esc(contractInvoicePeriodLabel(r.key))}</td><td>${money(r.net)}</td><td class="no-print"><button class="contractInvoiceBtn" onclick="printContractClientInvoicePeriod('${c.id}','${r.key}')">Imprimer</button></td></tr>`).join('')||'<tr><td colspan="4">Aucune facture disponible pour ce client.</td></tr>'}</tbody></table></div></div>`,'contrats',{printTitle:'LISTE DES FACTURES DU CLIENT SOUS CONTRAT'});
}
function printContractClientInvoicePeriod(cid,key){
  const {d,company}=current(); const c=(d.clients||[]).find(x=>x.id===cid&&x.companyId===company.id); if(!c) return g3Alert('Client introuvable','Client introuvable','danger');
  const all=getCompanyValidatedSales(); const row=contractClientInvoiceRows(c,all).find(r=>r.key===key); if(!row) return g3Alert('Aucune consommation trouvée pour ce client sous contrat.','Aucune consommation','info');
  const remise=Number(c.remise||0), ref='FCC-'+String(key).replace(/[^0-9A-Z]/gi,'')+'-'+randomPart(4), now=new Date();
  shell(`<div class="g2panel printable"><div class="reportActions no-print"><button onclick="openContractClientInvoicePage('${c.id}')">Retour liste factures</button><button onclick="window.print()">Imprimer / PDF</button></div><div class="reportBox monthlyInvoice contractInvoicePrint">${freeWatermark(company)}<h1>FACTURE MENSUELLE CLIENT SOUS CONTRAT</h1><h3>${esc(company.name)} — ${esc(contractInvoicePeriodLabel(key))}</h3><div class="ficheSeparator"></div><div class="ficheInfoGrid"><div><b>Référence :</b> ${esc(ref)}</div><div><b>Client :</b> ${esc(c.name)}</div><div><b>Téléphone :</b> ${esc(c.phone||'')}</div><div><b>Type de facturation :</b> ${esc(c.mode||'Mensuelle')}</div><div><b>Date :</b> ${now.toLocaleString('fr-FR')}</div><div><b>Remise :</b> ${remise}%</div></div><table class="g2table contractMonthlyTable"><colgroup><col style="width:10%"><col style="width:18%"><col style="width:23%"><col style="width:8%"><col style="width:14%"><col style="width:12%"><col style="width:15%"></colgroup><thead><tr><th>Date</th><th>Service / Produit</th><th>Note / Détail</th><th>Qté</th><th>Prix unitaire</th><th>Total</th><th>Observation</th></tr></thead><tbody>${row.items.map(s=>{const detail=[s.detail,s.description,s.itemDetail].filter(Boolean).join(' — ') || s.note || ''; const obs=s.note && detail!==s.note ? s.note : (s.id||''); return `<tr><td>${new Date(s.date).toLocaleString('fr-FR')}</td><td>${esc(s.name)}</td><td>${esc(detail)}</td><td>${Number(s.qty||1)}</td><td>${money(s.unit||0)}</td><td>${money(s.total||0)}</td><td>${esc(obs)}</td></tr>`}).join('')}<tr class="total"><td colspan="5">TOTAL CONSOMMATION</td><td>${money(row.total)}</td><td></td></tr><tr class="total"><td colspan="5">REMISE ${remise}%</td><td>${money(row.total-row.net)}</td><td></td></tr><tr class="total"><td colspan="5">NET À PAYER</td><td>${money(row.net)}</td><td></td></tr></tbody></table>${qrBlock(ref,company,row.net,now.toISOString())}<div class="signatureZone"><span>Signature client</span><span>Cachet / Signature entreprise</span></div></div></div>`,'contrats',{printTitle:'FACTURE MENSUELLE CLIENT SOUS CONTRAT'});
}
function contractPeriodDefaults(){
  const now=new Date();
  const y=String(now.getFullYear());
  const m=String(now.getMonth()+1).padStart(2,'0');
  const d=String(now.getDate()).padStart(2,'0');
  return {type:'mois',year:y,month:m,day:d};
}
function contractPeriodLabel(type,year,month,day){
  if(type==='jour') return 'Jour sélectionné : '+year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  if(type==='annee') return 'Année sélectionnée : '+year;
  return 'Mois sélectionné : '+year+'-'+String(month).padStart(2,'0');
}
function clientConsumptionBlock(sales){
  const contratSales=(sales||[]).filter(s=>s.clientType==='contrat'&&s.client).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const def=contractPeriodDefaults();
  const baseYear=Number(def.year||new Date().getFullYear());
  const years=[...new Set([
    ...Array.from({length:21},(_,i)=>baseYear+10-i),
    ...contratSales.map(s=>new Date(s.date||Date.now()).getFullYear()).filter(Boolean)
  ])].sort((a,b)=>b-a);
  if(!years.includes(baseYear)) years.unshift(baseYear);
  const initial=contratSales.filter(s=>{
    const date=String(s.date||'').slice(0,10), yy=date.slice(0,4), mm=date.slice(5,7);
    return yy===def.year && mm===def.month;
  });
  const total=initial.reduce((a,b)=>a+Number(b.total||0),0);
  return `<div class="contractConsumptionBlock"><h1>CONSOMMATION CLIENTS SOUS CONTRAT</h1><h3 id="contractPeriodLabel">${contractPeriodLabel('mois',def.year,def.month,def.day)}</h3><div class="contractFilterBox contractPeriodFilterBox no-print"><div class="contractPeriodFilterLine"><h4>CHOISIR LA PÉRIODE</h4><div class="contractFilterGrid"><label>Type de filtre<select id="contractFilterType" onchange="toggleContractPeriodFields(true)"><option value="jour">Vente du Jour</option><option value="mois" selected>Vente du Mois</option><option value="annee">Vente de l’Année</option></select></label><label class="contractYearField">Année<select id="contractFilterYear" onchange="applyContractConsumptionFilter()">${years.map(y=>`<option value="${y}" ${String(y)===def.year?'selected':''}>${y}</option>`).join('')}</select></label><label class="contractMonthField">Mois<select id="contractFilterMonth" onchange="applyContractConsumptionFilter()">${monthsList.map((m,i)=>{const v=String(i+1).padStart(2,'0'); return `<option value="${v}" ${v===def.month?'selected':''}>${m}</option>`}).join('')}</select></label><label class="contractDayField">Jour<select id="contractFilterDay" onchange="applyContractConsumptionFilter()">${Array.from({length:31},(_,i)=>{const v=String(i+1).padStart(2,'0'); return `<option value="${v}" ${v===def.day?'selected':''}>${i+1}</option>`}).join('')}</select></label></div></div></div>${clientTable(contratSales)}<div id="contractConsumptionTotal" class="totalLine contractConsumptionTotal">Total consommation : ${money(total)}</div></div>`;
}
function clientTable(contratSales){
  return `<div class="contractConsumptionWrap"><table class="g2table contractConsumptionTable" id="contractConsumptionTable"><thead><tr><th>Date</th><th>Client</th><th>Service consommé</th><th>Quantité</th><th>Prix unitaire</th><th>Total</th><th>Observation</th></tr></thead><tbody>${(contratSales||[]).map(s=>`<tr data-date="${esc(String(s.date||'').slice(0,10))}" data-total="${Number(s.total||0)}"><td>${new Date(s.date).toLocaleString('fr-FR')}</td><td>${esc(s.client)}</td><td>${esc(s.name)}</td><td>${Number(s.qty||1)}</td><td>${money(s.unit||0)}</td><td>${money(s.total)}</td><td>${esc(s.note||'')}</td></tr>`).join('')||'<tr class="emptyContractRow"><td colspan="7">Aucune consommation trouvée pour les clients sous contrat.</td></tr>'}</tbody></table><div id="contractNoResult" class="notice contractNoResult hidden">Aucune consommation trouvée pour cette période.</div></div>`
}
function toggleContractPeriodFields(apply=true){
  const t=$('#contractFilterType')?.value||'mois';
  const def=contractPeriodDefaults();
  const yearEl=$('#contractFilterYear'), monthEl=$('#contractFilterMonth'), dayEl=$('#contractFilterDay');
  if(yearEl && !yearEl.value) yearEl.value=def.year;
  if(monthEl && !monthEl.value) monthEl.value=def.month;
  if(dayEl && !dayEl.value) dayEl.value=def.day;
  const showYear=true;
  const showMonth=(t==='jour'||t==='mois');
  const showDay=(t==='jour');
  const setVisible=(selector,visible)=>{
    document.querySelectorAll(selector).forEach(e=>{
      e.style.setProperty('display', visible ? 'flex' : 'none', 'important');
      e.setAttribute('aria-hidden', visible ? 'false' : 'true');
    });
  };
  setVisible('.contractYearField', showYear);
  setVisible('.contractMonthField', showMonth);
  setVisible('.contractDayField', showDay);
  if(yearEl) yearEl.disabled=!showYear;
  if(monthEl) monthEl.disabled=!showMonth;
  if(dayEl) dayEl.disabled=!showDay;
  if(apply) applyContractConsumptionFilter();
}
function applyContractConsumptionFilter(){
  const table=$('#contractConsumptionTable'); if(!table) return;
  toggleContractPeriodFields(false);
  const t=$('#contractFilterType')?.value||'mois', y=$('#contractFilterYear')?.value||'', m=$('#contractFilterMonth')?.value||'', d=$('#contractFilterDay')?.value||'';
  let total=0, label=contractPeriodLabel(t,y||contractPeriodDefaults().year,m||contractPeriodDefaults().month,d||contractPeriodDefaults().day), visible=0;
  document.querySelectorAll('#contractConsumptionTable tbody tr[data-date]').forEach(r=>{
    const date=r.dataset.date||'', yy=date.slice(0,4), mm=date.slice(5,7), dd=date.slice(8,10);
    let ok=true;
    if(t==='jour') ok=y&&m&&d ? (yy===String(y)&&mm===String(m).padStart(2,'0')&&dd===String(d).padStart(2,'0')) : true;
    else if(t==='mois') ok=y&&m ? (yy===String(y)&&mm===String(m).padStart(2,'0')) : true;
    else if(t==='annee') ok=y ? yy===String(y) : true;
    r.style.display=ok?'':'none';
    if(ok){visible++; total+=Number(r.dataset.total||0);}
  });
  const totalEl=$('#contractConsumptionTotal'); if(totalEl) totalEl.textContent='Total consommation : '+money(total);
  const lab=$('#contractPeriodLabel'); if(lab) lab.textContent=label;
  const no=$('#contractNoResult'); if(no) no.classList.toggle('hidden', visible>0 || document.querySelectorAll('#contractConsumptionTable tbody tr[data-date]').length===0);
}
function globalSalesReport(items,sales){
  const map={};
  sales.forEach(s=>{
    const it=items.find(i=>i.id===s.itemId||i.name===s.name);
    const key=(s.name||'Produit / service non précisé')+'__'+(it?.cat||'SERVICE / PRODUIT');
    if(!map[key]) map[key]={name:s.name||'Produit / service non précisé',cat:it?.cat||'SERVICE / PRODUIT',clientsServed:0,qty:0,total:0,serviceFee:0,charges:0,profit:0,count:0};
    const r=map[key];
    r.clientsServed+=saleClientsServedValue(s);
    r.qty+=Number(s.qty||0);
    r.total+=Number(s.total||0);
    r.serviceFee+=Number(s.serviceFee||0);
    r.charges+=Number(s.charges||0);
    r.profit+=Number(s.profit||0);
    r.count+=1;
  });
  const rows=Object.values(map);
  if(!rows.length) return '<div class="serviceBlock"><h2>Ventes généralisées des produits et services vendus</h2><p>Aucune vente enregistrée.</p></div>';
  const tn=rows.reduce((a,b)=>a+b.count,0), tClients=rows.reduce((a,b)=>a+b.clientsServed,0), tq=rows.reduce((a,b)=>a+b.qty,0), tt=rows.reduce((a,b)=>a+b.total,0), tf=rows.reduce((a,b)=>a+b.serviceFee,0), tc=rows.reduce((a,b)=>a+b.charges,0), tp=rows.reduce((a,b)=>a+b.profit,0);
  return `<div class="serviceBlock"><h2>Ventes généralisées des produits et services vendus</h2><table><tr><th>Catégorie</th><th>Produit / Service</th><th>Nombre de ventes</th><th>Clients servis</th><th>Quantité totale</th><th>Chiffre d’affaires</th><th>Frais service</th><th>Charges estimées</th><th>Bénéfice estimé</th></tr>${rows.map(r=>`<tr><td>${esc(r.cat)}</td><td>${esc(r.name)}</td><td>${r.count}</td><td>${r.clientsServed}</td><td>${r.qty}</td><td>${money(r.total)}</td><td>${money(r.serviceFee||0)}</td><td>${money(r.charges)}</td><td>${money(r.profit)}</td></tr>`).join('')}<tr class="total"><td colspan="2">TOTAL GLOBAL</td><td>${tn}</td><td>${tClients}</td><td>${tq}</td><td>${money(tt)}</td><td>${money(tf)}</td><td>${money(tc)}</td><td>${money(tp)}</td></tr></table></div>`;
}

function legacyClientTable(sales){const contratSales=sales.filter(s=>s.clientType==='contrat'&&s.client); const map={}; contratSales.forEach(s=>{(map[s.client]=map[s.client]||[]).push(s)}); return `<div class="contractConsumptionWrap"><table class="g2table contractConsumptionTable"><thead><tr><th>Date</th><th>Client</th><th>Service consommé</th><th>Quantité</th><th>Prix unitaire</th><th>Total</th><th>Observation</th></tr></thead><tbody>${Object.entries(map).flatMap(([c,rows])=>rows.map(s=>`<tr><td>${new Date(s.date).toLocaleString('fr-FR')}</td><td>${esc(c)}</td><td>${esc(s.name)}</td><td>${Number(s.qty||1)}</td><td>${money(s.unit||0)}</td><td>${money(s.total)}</td><td>${esc(s.id)}</td></tr>`)).join('')||'<tr><td colspan="7">Aucun client sous contrat.</td></tr>'}</tbody></table></div>`}
function autoBoutiqueChargePercent(i){const sell=Number(i.sell||0), buy=Number(i.buy||0); if(!sell||!buy) return 0; return Math.round((buy/sell*100)*100)/100}
function isBoutiqueItem(i){return String(i?.type||'boutique').toLowerCase()!=='service'}
function chargesBase(items){return `<div class="reportBox slim"><h1>BASE DE CALCUL DES CHARGES</h1><h3>Produits et services — GLOBAL MARKET</h3><table><tr><th>Catégorie / Service principal</th><th>Produit / Service / Prestation</th><th>Estimation des charges (%)</th><th>Base de calcul</th></tr>${items.map(i=>{const boutique=isBoutiqueItem(i); const pct=boutique?autoBoutiqueChargePercent(i):(i.charge||30); return `<tr><td>${esc(i.cat||'SERVICE')}</td><td>${esc(i.name)}</td><td>${boutique?`<input type="number" value="${pct}" readonly disabled title="Calcul automatique : prix d’achat / prix de vente"><div class="miniNote">Automatique — prix d’achat / prix de vente</div>`:`<input class="chargeInput" data-id="${i.id}" type="number" min="0" max="100" value="${pct}">`}</td><td>${boutique?`Basé automatiquement sur le prix d’achat dans le prix de vente<br><b>${money(i.buy||0)} / ${money(i.sell||0)}</b>`:'Pourcentage appliqué sur le montant vendu'}</td></tr>`}).join('')||'<tr><td colspan="4">Ajoutez d’abord vos produits ou services dans Stocks.</td></tr>'}</table></div>`}
function saveChargePercentages(){if(!requireAdmin()) return;const {d,company}=current(); document.querySelectorAll('.chargeInput[data-id]').forEach(inp=>{const it=d.items.find(i=>i.id===inp.dataset.id&&i.companyId===company.id); if(it&&!isBoutiqueItem(it)) it.charge=+inp.value||0}); save(d); alert('Pourcentages enregistrés. Les produits BOUTIQUE restent calculés automatiquement avec le prix d’achat.'); renderDash('param')}
function getDefaultObligations(){return [['Salaire Agent de réception et d’enregistrement','Des bénéfices généraux',30000],['Salaire Agent d’opération','Des bénéfices généraux',30000],['Salaire Agent de propreté','Des bénéfices généraux',20000],['Salaire Directeur','Des bénéfices généraux',100000],['Électricité','Des bénéfices généraux',10000],['Internet','Des bénéfices généraux',15000]].map(r=>({id:id('obl'),designation:r[0],provenance:r[1],amount:r[2],baseType:'general',percent:0,targetId:null,targetName:''}))}
function getObligationsForMonth(d,cid,year,month){
  d.monthlyObligations=d.monthlyObligations||{};
  d.monthlyObligations[cid]=d.monthlyObligations[cid]||{};
  const y=String(year||getManageYear());
  const m=String(Number(month||0));
  d.monthlyObligations[cid][y]=d.monthlyObligations[cid][y]||{};
  d.monthlyObligations[cid][y][m]=d.monthlyObligations[cid][y][m]||[];
  return d.monthlyObligations[cid][y][m];
}
function getObligations(d,cid){
  return getObligationsForMonth(d,cid,getManageYear(),getActiveMonth());
}
function obligationForm(){
  const {d,company}=current();
  const categories=getCompanyCategories(d,company.id);
  const items=d.items.filter(i=>i.companyId===company.id).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fr'));
  const catOpts=categories.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  const itemOpts=items.map(i=>`<option value="${i.id}">${esc(i.name)} — ${esc(i.cat||i.type||'Produit / service')}</option>`).join('');
  return `<div class="formCard obligationForm"><input id="oEdit" type="hidden">
    <div class="grid three obligationGrid">
      <input id="oDesignation" placeholder="Désignation de l’obligation">
      <select id="oBaseType" onchange="toggleObligationMode()">
        <option value="general">Basée sur les bénéfices généraux</option>
        <option value="category">Basée sur une catégorie</option>
        <option value="item">Basée sur un produit ou service</option>
      </select>
      <select id="oCategoryTarget" class="obligationTarget" style="display:none"><option value="">Choisir une catégorie</option>${catOpts}</select>
      <select id="oItemTarget" class="obligationTarget" style="display:none"><option value="">Choisir un produit / service</option>${itemOpts}</select>
      <input id="oAmount" type="number" placeholder="Montant fixe à payer">
      <div class="field" id="oPercentBox" style="display:none"><input id="oPercent" type="number" placeholder="% du bénéfice concerné" min="0" max="100"></div>
      <button onclick="addObligation()" id="oSaveBtn">Ajouter obligation</button>
      <button class="btn2" onclick="clearObligationForm()">Vider le formulaire</button>
    </div>
    <p class="small darkSmall">Choisissez la base de l’obligation : bénéfices généraux, une catégorie complète, ou un produit/service précis. Pour catégorie et produit/service, le montant est calculé sur le bénéfice de l’exercice actif.</p>
  </div>`
}
function getActiveExerciseSales(){return getCompanyValidatedSales().filter(isInActiveExercise);}
function getObligationBaseInfoForSales(r, salesRows){
  const {d,company}=current();
  const sales=Array.isArray(salesRows)?salesRows:getActiveExerciseSales();
  const baseType=r.baseType || (r.itemId?'item':'general');
  if(baseType==='category'){
    const cat=r.targetName||r.category||r.provenance||'';
    const ids=(d.items||[]).filter(i=>i.companyId===company.id&&String(i.cat||'')===String(cat)).map(i=>i.id);
    const rows=sales.filter(s=>ids.includes(s.itemId)||String(s.cat||'')===String(cat));
    return {label:'Catégorie : '+cat, profit:rows.reduce((a,b)=>a+Number(b.profit||0),0), total:rows.reduce((a,b)=>a+Number(b.total||0),0)};
  }
  if(baseType==='item'){
    const iid=r.targetId||r.itemId;
    const item=(d.items||[]).find(i=>i.id===iid&&i.companyId===company.id);
    const name=item?.name||r.targetName||r.provenance||'';
    const rows=sales.filter(s=>s.itemId===iid || String(s.name||'')===String(name));
    return {label:'Produit / service : '+name, profit:rows.reduce((a,b)=>a+Number(b.profit||0),0), total:rows.reduce((a,b)=>a+Number(b.total||0),0)};
  }
  const profit=sales.reduce((a,b)=>a+Number(b.profit||0),0);
  return {label:'Des bénéfices généraux', profit, total:sales.reduce((a,b)=>a+Number(b.total||0),0)};
}
function getObligationBaseInfo(r){
  return getObligationBaseInfoForSales(r, getActiveExerciseSales());
}
function getObligationValueForSales(r, salesRows){
  const baseType=r.baseType || (r.itemId?'item':'general');
  if(baseType==='general' && !Number(r.percent||0)) return Number(r.amount||0);
  const info=getObligationBaseInfoForSales(r, salesRows);
  return Math.round(Number(info.profit||0)*(Number(r.percent||0)/100));
}
function getObligationValue(r){
  return getObligationValueForSales(r, getActiveExerciseSales());
}
function getMonthlyObligationTotal(obligations, salesRows){
  return (obligations||[]).reduce((a,r)=>a+getObligationValueForSales(r, salesRows||[]),0);
}
function toggleObligationMode(){
  const t=$('#oBaseType')?.value||'general';
  const cat=$('#oCategoryTarget'), item=$('#oItemTarget'), amount=$('#oAmount'), pct=$('#oPercentBox');
  if(cat) cat.style.display=t==='category'?'block':'none';
  if(item) item.style.display=t==='item'?'block':'none';
  if(amount){amount.style.display=t==='general'?'block':'none'; amount.placeholder=t==='general'?'Montant fixe à payer':'Montant calculé automatiquement';}
  if(pct) pct.style.display=t==='general'?'none':'flex';
}
function clearObligationForm(){
  ['oEdit','oDesignation','oAmount','oPercent'].forEach(k=>{const el=$('#'+k); if(el) el.value=''});
  const t=$('#oBaseType'); if(t)t.value='general';
  const c=$('#oCategoryTarget'); if(c)c.value='';
  const i=$('#oItemTarget'); if(i)i.value='';
  const b=$('#oSaveBtn'); if(b)b.textContent='Ajouter obligation';
  toggleObligationMode();
}
function obligationsBox(profit, rows=null, admin=false){
  const {d,company}=current();
  rows=rows||getObligations(d,company.id);
  const total=rows.reduce((a,b)=>a+getObligationValue(b),0);
  const safeTotal=Math.max(total,1);
  const currentMonth=monthsList[getActiveMonth()]+' '+getManageYear();
  const rowHtml=rows.map(r=>{
    const val=getObligationValue(r);
    const pct=val/safeTotal*100;
    const fourchette=profit*(pct/100);
    return `<tr>
      <td>${esc(r.designation)}</td>
      <td>${esc(r.provenance||'Des bénéfices généraux')}</td>
      <td><span class="calcBadge">${pct.toFixed(2)}%</span></td>
      <td><span class="calcBadge">${money(fourchette)}</span></td>
      <td><span class="calcBadge">${money(val)}</span></td>
      <td><span class="calcBadge">${pct.toFixed(2)}%</span></td>
      ${admin?`<td class="actionCell"><div class="rowActions"><button onclick="editObligation('${r.id}')">Modifier</button><button class="danger" onclick="deleteObligation('${r.id}')">Supprimer</button></div></td>`:''}
    </tr>`;
  }).join('');
  return `<div class="reportBox slim obligationsReport">
    <h1>OBLIGATIONS MENSUELLES</h1>
    <h3>Charges fixes mensuelles — GLOBAL MARKET</h3>
    <div class="notice"><b>Mois concerné :</b> ${currentMonth}</div>
    <table class="obligationsTable">
      <thead>
        <tr>
          <th rowspan="2">Désignation</th>
          <th rowspan="2">Provenance</th>
          <th colspan="2">Fourchette</th>
          <th colspan="2">Salaire</th>
          ${admin?'<th rowspan="2">Action</th>':''}
        </tr>
        <tr>
          <th>% basé sur le total des obligations</th>
          <th>Valeur = (total bénéfices généraux × % basé sur le total des obligations)</th>
          <th>À payer</th>
          <th>% basé sur le total des obligations</th>
        </tr>
      </thead>
      <tbody>
        ${rowHtml}
        <tr class="total">
          <td colspan="2">TOTAL OBLIGATIONS À PAYER</td>
          <td><span class="calcBadge">100%</span></td>
          <td><span class="calcBadge">${money(profit)}</span></td>
          <td><span class="calcBadge">${money(total)}</span></td>
          <td><span class="calcBadge">100%</span></td>
          ${admin?'<td></td>':''}
        </tr>
      </tbody>
    </table>
  </div>`
}
function monthsGrid(sales,obligations=[]){
  const year=getManageYear(), activeMonth=getActiveMonth();
  const rows=monthsList.map((m,i)=>{
    const ms=sales.filter(s=>{const dt=new Date(s.date); return dt.getFullYear()===year && dt.getMonth()===i});
    const monthObligations=getObligationsForMonth(current().d,current().company.id,year,i);
    const obligationTotal=getMonthlyObligationTotal(monthObligations, ms);
    const commandes=ms.length, articles=ms.reduce((a,b)=>a+Number(b.qty||0),0), ca=ms.reduce((a,b)=>a+Number(b.total||0),0), serviceFee=ms.reduce((a,b)=>a+Number(b.serviceFee||0),0), charges=ms.reduce((a,b)=>a+Number(b.charges||0),0), benef=ms.reduce((a,b)=>a+Number(b.profit||0),0), net=benef-obligationTotal;
    return {m,i,commandes,articles,ca,serviceFee,charges,benef,obligations:obligationTotal,net};
  });
  const total=rows.reduce((a,r)=>({commandes:a.commandes+r.commandes,articles:a.articles+r.articles,ca:a.ca+r.ca,serviceFee:a.serviceFee+r.serviceFee,charges:a.charges+r.charges,benef:a.benef+r.benef,obligations:a.obligations+r.obligations,net:a.net+r.net}),{commandes:0,articles:0,ca:0,serviceFee:0,charges:0,benef:0,obligations:0,net:0});
  return `<div class="monthsGrid">${rows.map(r=>`<div class="monthCard ${r.i===activeMonth?'active':''}"><h4>${r.m}</h4><p>Commandes : <b>${r.commandes}</b><br>CA : <b>${money(r.ca)}</b><br>Net : <b>${money(r.net)}</b></p><button onclick="openManagementMonth(${r.i})">Ouvrir ce mois</button></div>`).join('')}</div>
  <table class="g2table yearlyTable"><tr><th>Mois</th><th>Commandes</th><th>Articles</th><th>Chiffre d’affaires</th><th>Frais service</th><th>Charges estimées</th><th>Bénéfice estimé</th><th>Obligations</th><th>Résultat net</th></tr>${rows.map(r=>`<tr class="${r.i===activeMonth?'activeYearRow':''}"><td>${r.m}</td><td>${r.commandes}</td><td>${r.articles}</td><td>${money(r.ca)}</td><td>${money(r.serviceFee)}</td><td>${money(r.charges)}</td><td>${money(r.benef)}</td><td>${money(r.obligations)}</td><td>${money(r.net)}</td></tr>`).join('')}<tr class="total"><td>TOTAL ANNUEL</td><td>${total.commandes}</td><td>${total.articles}</td><td>${money(total.ca)}</td><td>${money(total.serviceFee)}</td><td>${money(total.charges)}</td><td>${money(total.benef)}</td><td>${money(total.obligations)}</td><td>${money(total.net)}</td></tr></table>`
}
function usersTable(users,admin){return `<table class="g2table"><tr><th>Nom</th><th>Email</th><th>Rôle</th><th>Horaire caisse</th><th>Statut</th><th>Action</th></tr>${users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${u.role==='caisse'?esc(caisseAllowedRangeLabel(u)):'—'}</td><td>${esc(u.status)}${u.mustChangePassword?' <span class="saleBadge">mot de passe temporaire</span>':''}</td><td class="actionCell">${admin?`<div class="rowActions">${u.role!=='admin'?`<button class="danger" onclick="blockUser('${u.id}')">Bloquer</button>`:''}${u.role==='caisse'?`<button class="btn2" onclick="resetUserPasswordDirect('${u.id}')">Réinitialiser</button>`:'<span class="notice">Admin : Super Admin</span>'}</div>`:''}</td></tr>`).join('')}</table>`}
function bilanSalesRows(items,sales){
  const map={};
  (sales||[]).forEach(s=>{
    const it=(items||[]).find(i=>i.companyId===s.companyId&&(i.id===s.itemId||String(i.name||'')===String(s.name||'')));
    const cat=String(it?.cat||s.cat||'SERVICE / PRODUIT');
    const name=String(s.name||it?.name||'Produit / service non précisé');
    const key=cat+'__'+name;
    if(!map[key]) map[key]={cat,name,count:0,clientsServed:0,qty:0,total:0,serviceFee:0,charges:0,profit:0};
    const r=map[key];
    r.count+=1;
    r.clientsServed+=saleClientsServedValue(s);
    r.qty+=Number(s.qty||0);
    r.total+=Number(s.total||0);
    r.serviceFee+=Number(s.serviceFee||0);
    r.charges+=Number(s.charges||0);
  });
  return Object.values(map)
    .map(r=>({...r,profit:Number(r.total||0)-Number(r.charges||0)}))
    .sort((a,b)=>a.cat.localeCompare(b.cat,'fr')||a.name.localeCompare(b.name,'fr'));
}
function bilanReportCode(company,dt=new Date()){
  const code=String(company?.name||'ENT').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,6)||'ENT';
  const stamp=dt.toISOString().replace(/[-:.TZ]/g,'').slice(0,14);
  return `BILAN-${code}-${stamp}`;
}
function bilanOptionalLine(label,value){return String(value||'').trim()?`<span><b>${esc(label)} :</b> ${esc(value)}</span>`:''}
function bilanCompanyHeader(company,generatedAt){
  const p=companyReportProfile(company);
  const logo=p.logo?`<img src="${esc(p.logo)}" alt="Logo de ${esc(p.name)}">`:`<span>${esc(companyInitials(p.name))}</span>`;
  const legal=[p.legalForm,p.capital?`au capital de ${p.capital}`:''].filter(Boolean).join(' ');
  return `<header class="bilanCompanyHeader">
    <div class="bilanLogoBlock"><div class="bilanLogo">${logo}</div><small>${esc(p.name)}</small></div>
    <div class="bilanCompanyIdentity">
      <strong>${esc(p.name)}</strong>
      <div class="bilanLegalLines">${legal?`<span>${esc(legal)}</span>`:''}${bilanOptionalLine('RCCM',p.rccm)}${bilanOptionalLine('Compte contribuable',p.taxAccount)}${bilanOptionalLine('Siège social',p.address)}${bilanOptionalLine('Tél.',p.phone)}${bilanOptionalLine('E-mail',p.email)}</div>
      ${p.activity?`<em>${esc(p.activity)}</em>`:''}
    </div>
    <div class="bilanTitleBand"><div class="bilanDateBox"><i>◷</i><span><b>Date : ${generatedAt.toLocaleDateString('fr-FR')}</b><b>Heure : ${generatedAt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</b></span></div><h1>RAPPORT BILAN DÉTAILLÉ DE L’ENTREPRISE</h1></div>
  </header>`;
}
function bilanSignatureBlock(company){
  const p=companyReportProfile(company);
  const images=[p.signature?`<img src="${esc(p.signature)}" alt="Signature">`:'',p.stamp?`<img src="${esc(p.stamp)}" alt="Cachet">`:''].join('');
  return `<div class="bilanSignature"><b>${esc(p.responsibleTitle||'LE RESPONSABLE')}</b><div class="bilanSignatureImages">${images}</div><span>${p.owner?esc(p.owner):''}</span><i></i></div>`;
}
function buildBilanOfficialReport(company,items,sales,obligations,generatedAt=new Date()){
  const p=companyReportProfile(company), rows=bilanSalesRows(items,sales), reportNo=bilanReportCode(company,generatedAt);
  const totals=rows.reduce((a,r)=>({count:a.count+r.count,clients:a.clients+r.clientsServed,qty:a.qty+r.qty,total:a.total+r.total,fee:a.fee+r.serviceFee,charges:a.charges+r.charges,profit:a.profit+r.profit}),{count:0,clients:0,qty:0,total:0,fee:0,charges:0,profit:0});
  const obligationTotal=getMonthlyObligationTotal(obligations,sales), net=totals.profit-obligationTotal;
  const body=rows.length?rows.map(r=>`<tr><td>${esc(r.cat)}</td><td>${esc(r.name)}</td><td>${r.count}</td><td>${r.clientsServed}</td><td>${r.qty}</td><td>${companyMoney(r.total,company)}</td><td>${companyMoney(r.serviceFee,company)}</td><td>${companyMoney(r.charges,company)}</td><td>${companyMoney(r.profit,company)}</td></tr>`).join(''):`<tr><td colspan="9" class="bilanEmpty">Aucune vente n’a été enregistrée pour cette entreprise au cours de l’exercice sélectionné.</td></tr>`;
  const logoTheme=`--bilan-primary:${p.primary};--bilan-accent:${p.accent}`;
  return `<article class="bilanOfficialReport" style="${logoTheme}" data-company-id="${esc(p.id)}" data-report-number="${esc(reportNo)}">
    ${bilanCompanyHeader(company,generatedAt)}
    <div class="bilanExercise"><strong>${esc(p.name)} — Exercice actif : ${esc(monthsList[getActiveMonth()])} ${getManageYear()}</strong><span>N° Rapport : ${esc(reportNo)} | Date : ${generatedAt.toLocaleString('fr-FR')}</span></div>
    <div class="bilanMainFrame">
      <section class="bilanSection"><h2>VENTES GÉNÉRALES DES PRODUITS ET SERVICES VENDUS</h2><div class="bilanTableWrap"><table class="bilanSalesTable"><thead><tr><th>CATÉGORIE</th><th>PRODUIT / SERVICE</th><th>NOMBRE DE VENTES</th><th>CLIENTS SERVIS</th><th>QUANTITÉ TOTALE</th><th>CHIFFRE D’AFFAIRES</th><th>FRAIS SERVICE</th><th>CHARGES ESTIMÉES</th><th>BÉNÉFICE ESTIMÉ</th></tr></thead><tbody>${body}${rows.length?`<tr class="bilanTotal"><td colspan="2">TOTAL GLOBAL</td><td>${totals.count}</td><td>${totals.clients}</td><td>${totals.qty}</td><td>${companyMoney(totals.total,company)}</td><td>${companyMoney(totals.fee,company)}</td><td>${companyMoney(totals.charges,company)}</td><td>${companyMoney(totals.profit,company)}</td></tr>`:''}</tbody></table></div></section>
      <section class="bilanSection bilanSummarySection"><h2>RÉSUMÉ FINANCIER DE L’EXERCICE ACTIF</h2><table class="bilanSummaryTable"><thead><tr><th>INDICATEUR</th><th>VALEUR</th></tr></thead><tbody>
        <tr><td>Nombre total de clients servis</td><td>${totals.clients}</td></tr><tr><td>Nombre total de ventes</td><td>${totals.count}</td></tr><tr><td>Quantité totale vendue</td><td>${totals.qty}</td></tr><tr><td>Chiffre d’affaires total</td><td>${companyMoney(totals.total,company)}</td></tr><tr><td>Total des frais de service</td><td>${companyMoney(totals.fee,company)}</td></tr><tr><td>Total des charges estimées</td><td>${companyMoney(totals.charges,company)}</td></tr><tr><td>Bénéfice net estimé avant obligations</td><td>${companyMoney(totals.profit,company)}</td></tr><tr><td>Total obligations mensuelles calculées</td><td>${companyMoney(obligationTotal,company)}</td></tr><tr class="bilanNet"><td>Résultat net réel estimé après obligations</td><td>${companyMoney(net,company)}</td></tr>
      </tbody></table></section>
    </div>
    ${bilanSignatureBlock(company)}
    <footer class="bilanReportFooter"><span>${esc(p.name)}</span><b>${esc(reportNo)}</b><span>Page <i class="bilanPageNumber"></i></span></footer>
  </article>`;
}
function applyBilanPeriod(){
  const y=Math.max(1,Number($('#bilanYear')?.value||getManageYear())); const m=Math.max(0,Math.min(11,Number($('#bilanMonth')?.value||getActiveMonth())));
  saveManagementPeriod(y,m); showBilan();
}
function exportBilanCsv(){
  const {d,company}=current(); if(!company)return;
  const sales=getCompanyValidatedSales().filter(s=>s.companyId===company.id&&isInActiveExercise(s)); const items=(d.items||[]).filter(i=>i.companyId===company.id); const rows=bilanSalesRows(items,sales);
  const sep=';'; const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  const lines=[[company.name],[`Exercice ${monthsList[getActiveMonth()]} ${getManageYear()}`],[],['Catégorie','Produit / Service','Nombre de ventes','Clients servis','Quantité totale',`Chiffre d’affaires (${companyCurrency(company)})`,`Frais service (${companyCurrency(company)})`,`Charges estimées (${companyCurrency(company)})`,`Bénéfice estimé (${companyCurrency(company)})`],...rows.map(r=>[r.cat,r.name,r.count,r.clientsServed,r.qty,r.total,r.serviceFee,r.charges,r.profit])];
  const blob=new Blob(['\ufeff'+lines.map(row=>row.map(q).join(sep)).join('\r\n')],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`bilan-${slugify(company.name)}-${getManageYear()}-${String(getActiveMonth()+1).padStart(2,'0')}.csv`; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);
}
function openBilanPdfPage(){
  const report=document.querySelector('.bilanOfficialReport');
  if(!report) return g3Alert('Le rapport bilan n’est pas encore disponible.','Impression impossible','danger');
  const popup=window.open('','_blank');
  if(!popup) return g3Alert('Autorisez les fenêtres contextuelles afin d’ouvrir l’aperçu PDF A4.','Fenêtre bloquée','warning');
  const stylesheet=[...document.querySelectorAll('link[rel="stylesheet"]')].map(link=>link.href).find(Boolean)||'';
  const reportNumber=report.dataset.reportNumber||'RAPPORT-BILAN';
  const companyName=report.querySelector('.bilanCompanyIdentity>strong')?.textContent?.trim()||'Entreprise';
  popup.document.open();
  popup.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(reportNumber)} - ${esc(companyName)}</title>${stylesheet?`<link rel="stylesheet" href="${esc(stylesheet)}">`:''}<style>
  @page{size:A4 portrait;margin:7mm 7mm 14mm}
  html,body{margin:0!important;padding:0!important;min-width:0!important;background:#edf3f2!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  *{box-sizing:border-box!important}
  .bilanPrintToolbar{position:fixed;top:12px;right:12px;z-index:9999;display:flex;gap:8px;padding:8px;border:1px solid #cbdad7;border-radius:14px;background:rgba(255,255,255,.96);box-shadow:0 10px 28px rgba(0,50,48,.16)}
  .bilanPrintToolbar button{border:0;border-radius:10px;padding:11px 14px;background:#00544f;color:#fff;font:800 13px Arial,sans-serif;cursor:pointer}
  .bilanPrintToolbar button:last-child{background:#d4a900;color:#122928}
  .bilanPrintDocument{width:210mm;max-width:100%;margin:18px auto 40px;overflow:visible}
  .bilanPrintDocument>.bilanOfficialReport{width:210mm!important;max-width:100%!important;margin:0 auto!important;overflow:hidden!important}
  @media print{
    html,body{width:auto!important;height:auto!important;margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important}
    .bilanPrintToolbar{display:none!important}
    .bilanPrintDocument{display:block!important;width:100%!important;max-width:196mm!important;margin:0 auto!important;padding:0!important;overflow:visible!important}
    .bilanPrintDocument>.bilanOfficialReport{display:block!important;width:100%!important;max-width:196mm!important;min-height:276mm!important;margin:0 auto!important;padding:0 0 8mm!important;box-shadow:none!important;overflow:visible!important;background:#fff!important}
    .bilanPrintDocument .bilanCompanyHeader:before{margin:0 0 3mm!important}
    .bilanPrintDocument .bilanTableWrap{width:100%!important;max-width:100%!important;overflow:visible!important}
    .bilanPrintDocument table{width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important}
    .bilanPrintDocument th,.bilanPrintDocument td{max-width:0!important;overflow-wrap:anywhere!important;word-break:normal!important;white-space:normal!important}
    .bilanPrintDocument thead{display:table-header-group!important}
    .bilanPrintDocument tr{break-inside:avoid!important;page-break-inside:avoid!important}
    .bilanPrintDocument .bilanSummarySection,.bilanPrintDocument .bilanSignature{break-inside:avoid-page!important;page-break-inside:avoid!important}
    .bilanPrintDocument .bilanReportFooter{position:fixed!important;left:0!important;right:0!important;bottom:-10.5mm!important}
    .bilanPrintDocument .bilanPageNumber:after{content:counter(page)!important}
  }
  </style></head><body><div class="bilanPrintToolbar"><button onclick="window.print()">Imprimer / Enregistrer en PDF</button><button onclick="window.close()">Fermer</button></div><main class="bilanPrintDocument">${report.outerHTML}</main></body></html>`);
  popup.document.close();
  const launchPrint=()=>{
    const images=[...popup.document.images];
    Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true})}))).then(()=>setTimeout(()=>{popup.focus();popup.print()},450));
  };
  if(popup.document.readyState==='complete') launchPrint(); else popup.addEventListener('load',launchPrint,{once:true});
}
function showBilan(){
  if(!requireAdmin('La caisse ne peut pas voir le bilan détaillé, les bénéfices ou les charges globales.')) return;
  const {d,company}=current(); if(!company) return g3Alert('Aucune entreprise n’est liée à cette session.','Entreprise introuvable','danger');
  const sales=getCompanyValidatedSales().filter(s=>s.companyId===company.id&&isInActiveExercise(s));
  const items=(d.items||[]).filter(i=>i.companyId===company.id);
  const obligations=getObligationsForMonth(d,company.id,getManageYear(),getActiveMonth());
  const generatedAt=new Date(); const p=companyReportProfile(company);
  const missing=[!p.name?'raison sociale':'',!p.address?'adresse':'',!p.phone?'téléphone':'',!p.activity?'activité principale':''].filter(Boolean);
  const warning=missing.length?`<div class="bilanProfileWarning no-print">Informations facultatives à compléter dans <b>Mon compte</b> : ${esc(missing.join(', '))}. Le rapport utilise uniquement les informations de l’entreprise connectée.</div>`:`<div class="bilanConnectedNotice no-print">✓ Rapport sécurisé : profil, ventes, charges et obligations de <b>${esc(p.name)}</b> uniquement.</div>`;
  const monthOptions=monthsList.map((m,i)=>`<option value="${i}" ${i===getActiveMonth()?'selected':''}>${esc(m)}</option>`).join('');
  shell(`<section class="section printable active bilanDetailPage"><div class="bilanToolbar no-print"><button onclick="show('rapports')">← Retour aux rapports</button><label>Mois<select id="bilanMonth">${monthOptions}</select></label><label>Année<input id="bilanYear" type="number" min="2000" max="2200" value="${getManageYear()}"></label><button onclick="applyBilanPeriod()">Actualiser</button><button onclick="openBilanPdfPage()">Imprimer / Télécharger PDF</button><button onclick="exportBilanCsv()">Exporter Excel (CSV)</button></div>${warning}${buildBilanOfficialReport(company,items,sales,obligations,generatedAt)}</section>`,'rapports',{noGlobalPrintHeader:true,noGlobalFooter:true});
}
function fichePaiementBox(){
  const {d,company}=current();
  const sales=getCompanyValidatedSales().filter(isInActiveExercise);
  const ca=sales.reduce((a,b)=>a+b.total,0);
  const profit=sales.reduce((a,b)=>a+b.profit,0);
  const rows=getObligations(d,company.id);
  const total=rows.reduce((a,r)=>a+getObligationValue(r),0);
  const now=new Date();
  const mois=monthsList[getActiveMonth()]+' '+getManageYear();
  const ref='FPO-'+now.toISOString().replace(/[-:.TZ]/g,'').slice(0,12);
  const byGroup={};
  rows.forEach(r=>{const g=r.group||guessObligationGroup(r.designation); (byGroup[g]=byGroup[g]||[]).push(r)});
  const groups=Object.keys(byGroup);
  const body=groups.map(g=>`<tr class="ficheGroup"><td colspan="4">${esc(g)}</td></tr>`+byGroup[g].map(r=>`<tr>
    <td>${esc(r.designation)}</td>
    <td>${esc(r.provenance||'Des bénéfices généraux')}</td>
    <td class="salaryCell">${r.percent?esc(String(r.percent).replace('.',','))+'%':money(getObligationValue(r)).replace(' FCFA','')}</td>
    <td class="signatureCell"></td>
  </tr>`).join('')).join('');
  return `<div class="reportBox fichePaiementReport">
    <h1>FICHE DE PAIEMENT DES OBLIGATIONS MENSUELLES</h1>
    <h3>${esc(company.name)} — GLOBAL MARKET</h3>
    <div class="ficheSeparator"></div>
    <div class="ficheInfoGrid">
      <div><b>Référence :</b> ${ref}</div>
      <div><b>Mois concerné :</b> ${mois}</div>
      <div><b>Date d’édition :</b> ${now.toLocaleString('fr-FR')}</div>
      <div><b>Chiffre d’affaires :</b> ${money(ca)}</div>
      <div><b>Bénéfice avant obligations :</b> ${money(profit)}</div>
      <div><b>Total à prévoir :</b> ${money(total)}</div>
    </div>
    <table class="fichePaiementTable">
      <thead>
        <tr><th>Désignation</th><th>Provenance</th><th colspan="2">Salaire</th><th>Observation / Signature</th></tr>
        <tr><th></th><th></th><th>fixe</th><th>payer</th><th></th></tr>
      </thead>
      <tbody>
        ${body || '<tr><td colspan="5" class="emptyCart">Aucune obligation enregistrée.</td></tr>'}
        <tr class="total"><td colspan="2">TOTAL À PRÉVOIR</td><td>${money(total)}</td><td></td><td></td></tr>
      </tbody>
    </table>
  </div>`
}
function guessObligationGroup(txt=''){
  const t=String(txt).toLowerCase();
  if(t.includes('salaire')||t.includes('agent')||t.includes('directeur')||t.includes('personnel')) return 'Rémunération du personnel';
  if(t.includes('impôt')||t.includes('cnps')||t.includes('fiscal')||t.includes('social')) return 'Charges fiscales et sociales';
  return 'Frais généraux et charges d’exploitation';
}
function showFichePaiement(){if(!requireAdmin('La caisse ne peut pas voir les charges globales.')) return;shell(`<div class="g2panel printable"><div class="reportActions no-print"><button onclick="show('param')">Retour paramètres</button><button onclick="showFichePaiement()">Actualiser la fiche</button><button onclick="window.print()">Imprimer / PDF</button></div>${fichePaiementBox()}</div>`,'param',{printTitle:'FICHE DE PAIEMENT DES OBLIGATIONS MENSUELLES'})}
function openCustomCategoryBox(){document.querySelector('#customCategoryBox')?.classList.toggle('hidden')}
function addCustomCategory(){
  if(!requireAdmin()) return;
  const cat=$('#customCatName')?.value?.trim()||'';
  const kind=$('#customCatKind')?.value||'boutique';
  if(!cat) return openStockCategoryPopup();
  const {d,company}=current();
  const rows=getCompanyCategoryRecords(d,company.id);
  if(rows.some(c=>String(c.name).toLowerCase()===cat.toLowerCase())) return alert('Cette catégorie existe déjà.');
  rows.push({name:cat,kind});
  saveCompanyCategoryRecords(d,company.id,rows);
  save(d); alert('Catégorie ajoutée avec succès.'); renderDash('stocks');
}


async function editCategory(cat){openStockCategoryPopup(cat)}
function editCategoryEncoded(v){editCategory(decodeURIComponent(v||''))}
function deleteCategoryEncoded(v){deleteCategory(decodeURIComponent(v||''))}
async function deleteCategory(cat){
  if(!requireAdmin()) return;
  const {d,company}=current();
  const count=(d.items||[]).filter(i=>i.companyId===company.id&&i.cat===cat).length;
  if(count>0) return alert('Suppression sécurisée refusée : cette catégorie contient '+count+' produit(s) ou service(s). Modifiez la catégorie ou les éléments au lieu de les supprimer afin d’éviter toute perte accidentelle.');
  if(!(await g3Confirm('Supprimer cette catégorie vide ?','Suppression catégorie'))) return;
  const rows=getCompanyCategoryRecords(d,company.id).filter(c=>c.name!==cat);
  saveCompanyCategoryRecords(d,company.id,rows); save(d); renderDash('stocks');
}

function updateAutoProductCharge(){
  const cat=$('#pCat')?.value||'';
  const selectedKind=$('#pCat')?.selectedOptions?.[0]?.dataset?.kind||categoryKind(cat);
  const isService=selectedKind==='service'||$('#pType')?.value==='service';
  const inp=$('#pCharge'), help=$('#chargeHelp');
  if(!inp) return;
  if(isService){ inp.readOnly=false; inp.disabled=false; if(help)help.textContent='Service : % appliqué sur le montant vendu.'; return; }
  const buy=Number($('#pBuy')?.value||0), sell=Number($('#pSell')?.value||0);
  const pct=sell>0?Math.round((buy/sell*100)*100)/100:0;
  inp.value=pct; inp.readOnly=true; inp.disabled=true;
  if(help) help.textContent='Produit : % automatique = prix d’achat unitaire ÷ prix de vente unitaire × 100.';
}
function previewStockPhoto(input){const file=input?.files?.[0]; const prev=$('#pPhotoPreview'); const hidden=$('#pPhotoData'); if(!file){return;} if(!file.type.startsWith('image/')){alert('Veuillez choisir une image valide.'); input.value=''; return;} if(file.size>850000){alert('Image trop lourde. Choisissez une photo inférieure à 850 Ko pour une sauvegarde plus fiable.'); input.value=''; return;} const reader=new FileReader(); reader.onload=e=>{const val=e.target.result||''; if(hidden) hidden.value=val; if(prev){prev.classList.remove('stockPhotoEmpty','hidden'); prev.innerHTML=`<img src="${val}" alt="Aperçu photo"><div><strong>Photo sélectionnée</strong><small>Prête à être enregistrée.</small></div>`;} const rm=$('#pRemovePhoto'); if(rm) rm.checked=false;}; reader.readAsDataURL(file);} 
function setStockPhotoPreview(src){const prev=$('#pPhotoPreview'), hidden=$('#pPhotoData'); if(hidden) hidden.value=src||''; if(prev){ if(src){prev.classList.remove('stockPhotoEmpty','hidden'); prev.innerHTML=`<img src="${src}" alt="Photo actuelle"><div><strong>Photo actuelle</strong><small>Visible dans la boutique client.</small></div>`;} else {prev.classList.remove('hidden'); prev.classList.add('stockPhotoEmpty'); prev.innerHTML='<span class="photoIcon">📷</span><strong>Aucune photo</strong><small>Photo visible par les clients dans la boutique publique.</small>';}}}
function removeStockPhoto(){const hidden=$('#pPhotoData'); if(hidden) hidden.value=''; const pf=$('#pPhoto'); if(pf) pf.value=''; const rm=$('#pRemovePhoto'); if(rm) rm.checked=true; setStockPhotoPreview('');}
async function addItem(){
  if(!requireAdmin('La caisse ne peut pas gérer les stocks.')) return;
  if(!ensureActiveExerciseEditable()) return;
  const {d,company}=current(), cid=company.id;
  const eid=$('#pEdit')?.value;
  const existing=eid?(d.items||[]).find(i=>i.id===eid&&i.companyId===cid):null;
  const cat=$('#pCat')?.value||'';
  if(!cat) return alert('Sélectionnez ou créez une catégorie.');
  const selectedKind=$('#pCat')?.selectedOptions?.[0]?.dataset?.kind||categoryKind(cat);
  const isService=selectedKind==='service'||($('#pType')?.value==='service');
  const servicePrice=+($('#pServicePrice')?.value||0);
  const buy=isService?0:(+$('#pBuy')?.value||0), sell=isService?servicePrice:(+($('#pSell')?.value||0));
  const charge=isService?(+($('#pCharge')?.value||0)):autoBoutiqueChargePercent({buy,sell});
  const removePhoto=!!$('#pRemovePhoto')?.checked;
  const photoData=$('#pPhotoData')?.value||'';
  const photo=removePhoto?'':(photoData||existing?.photo||'');
  const detail=($('#pDetail')?.value||'').trim();
  const stockType=isService?'none':($('#pStockType')?.value||'limited');
  const stock=isService?0:(stockType==='unlimited'?0:(+$('#pStock')?.value||0));
  const obj={companyId:cid,code:eid?($('#pCode')?.value||uniqueItemCode(d,cid,eid)):uniqueItemCode(d,cid),name:$('#pName').value,cat:cat,detail,marketplaceDesc:detail,buy,sell,stockType,stock,alert:isService?0:(+$('#pAlert')?.value||5),charge,type:isService?'service':'boutique',photo,updatedAt:new Date().toISOString()};
  obj.stockInitial=existing?.stockInitial ?? stock;
  obj.createdAt=existing?.createdAt || new Date().toISOString();
  if(!obj.name) return alert('Nom obligatoire');
  if(d.items.some(i=>i.companyId===cid&&i.id!==eid&&String(i.code||'').toUpperCase()===String(obj.code||'').toUpperCase())) obj.code=uniqueItemCode(d,cid,eid);
  if(eid){const it=d.items.find(i=>i.id===eid&&i.companyId===cid); if(it) Object.assign(it,obj)}else{d.items.push(Object.assign({id:id('itm')},obj))}
  save(d); document.querySelector('.stockModalBackdrop')?.remove(); alert(eid?'Produit/service modifié avec succès.':'Produit/service enregistré avec succès.'); window.g3StockTab='products'; renderDash('stocks');
}
function editItem(iid){openStockItemPopup(iid)}
async function deleteItem(iid){if(!requireAdmin('La caisse ne peut pas supprimer les stocks.')) return;const {d,company}=current(); const it=(d.items||[]).find(i=>i.id===iid&&i.companyId===company.id); if(!it) return alert('Élément introuvable.'); if(!(await g3Confirm('Supprimer cet élément du stock ? L’historique des ventes déjà effectuées restera conservé dans les rapports.','Suppression stock sécurisée'))) return; d.items=d.items.filter(i=>!(i.id===iid&&i.companyId===company.id)); save(d); alert('Élément supprimé du stock. Historique des ventes conservé.'); renderDash('stocks')}

function legacy1_clearItemForm(){
  ['pEdit','pName','pDetail','pBuy','pSell','pServicePrice','pStock','pAlert','pCharge','pPhotoData'].forEach(k=>{const el=$('#'+k); if(el) el.value=(k==='pAlert'?5:k==='pStock'?0:k==='pCharge'?30:'')});
  const pc=$('#pCat'); if(pc) pc.value='';
  const pst=$('#pStockType'); if(pst)pst.value='limited';
  setStockPhotoPreview('');
  const pf=$('#pPhoto'); if(pf) pf.value='';
  const rm=$('#pRemovePhoto'); if(rm) rm.checked=false;
  toggleChargeField();
  const {d,company}=current(); const c=$('#pCode'); if(c&&company)c.value=uniqueItemCode(d,company.id);
}
function toggleChargeField(){
  const cat=$('#pCat')?.value||'';
  const selectedKind=$('#pCat')?.selectedOptions?.[0]?.dataset?.kind||categoryKind(cat);
  const hasCat=!!cat;
  const isService=hasCat&&(selectedKind==='service');
  const form=document.querySelector('.stockFormReorg');
  if(form){form.classList.toggle('serviceMode',!!isService); form.classList.toggle('productMode',hasCat&&!isService);}
  document.querySelectorAll('.itemField').forEach(el=>{el.style.display=hasCat?'flex':'none'});
  const price=$('#servicePriceField'); if(price) price.style.display=(hasCat&&isService)?'flex':'none';
  document.querySelectorAll('.stockTypeOnly').forEach(el=>{el.style.display=(hasCat&&!isService)?'flex':'none'});
  document.querySelectorAll('.stockOnly').forEach(el=>{el.style.display=(hasCat&&!isService)?'flex':'none'});
  const pt=$('#pType'); if(pt) pt.value=hasCat?(isService?'service':'boutique'):'';
  toggleStockQuantityField(); updateAutoProductCharge();
}
function toggleStockQuantityField(){
  const st=$('#pStockType')?.value||'limited';
  document.querySelectorAll('.stockQtyOnly').forEach(el=>{el.style.display=st==='limited'?'flex':'none'});
  const stock=$('#pStock'); if(stock && st==='unlimited') stock.value=0;
}

function addObligation(){
  if(!requireAdmin()) return;if(!ensureActiveExerciseEditable()) return;
  const {d,company}=current(); const rows=getObligations(d,company.id);
  const designation=$('#oDesignation')?.value.trim()||'', baseType=$('#oBaseType')?.value||'general', editId=$('#oEdit')?.value;
  const amount=+($('#oAmount')?.value||0), percent=+($('#oPercent')?.value||0);
  if(!designation) return g3Alert('Désignation obligatoire','Champ obligatoire','info');
  let obj={designation,baseType,amount:0,percent:0,targetId:null,targetName:'',itemId:null,provenance:'Des bénéfices généraux'};
  if(baseType==='general'){
    if(!amount) return g3Alert('Montant fixe obligatoire pour les bénéfices généraux','Champ obligatoire','info');
    obj.amount=amount; obj.percent=0;
  }else if(baseType==='category'){
    const cat=$('#oCategoryTarget')?.value||'';
    if(!cat) return g3Alert('Choisissez la catégorie concernée','Champ obligatoire','info');
    if(!percent) return g3Alert('Indiquez le pourcentage du bénéfice de cette catégorie','Champ obligatoire','info');
    obj.percent=percent; obj.targetName=cat; obj.provenance='Catégorie : '+cat;
  }else{
    const iid=$('#oItemTarget')?.value||'';
    const item=d.items.find(i=>i.id===iid&&i.companyId===company.id);
    if(!item) return g3Alert('Choisissez le produit ou service concerné','Champ obligatoire','info');
    if(!percent) return g3Alert('Indiquez le pourcentage du bénéfice de ce produit/service','Champ obligatoire','info');
    obj.percent=percent; obj.targetId=item.id; obj.targetName=item.name; obj.itemId=item.id; obj.provenance='Produit / service : '+item.name;
  }
  if(editId){const r=rows.find(x=>x.id===editId); if(r) Object.assign(r,obj); g3Success('Obligation mensuelle modifiée avec succès.','Modification réussie');}
  else{rows.push(Object.assign({id:id('obl')},obj)); g3Success('Obligation mensuelle ajoutée avec succès.','Enregistrement réussi');}
  save(d); renderDash('param')
}
function editObligation(oid){
  if(!requireAdmin()) return;if(!ensureActiveExerciseEditable()) return;
  const {d,company}=current(); const r=getObligations(d,company.id).find(o=>o.id===oid); if(!r) return;
  const baseType=r.baseType || (r.itemId?'item':'general');
  const e=$('#oEdit'); if(e)e.value=r.id;
  $('#oDesignation').value=r.designation||'';
  const bt=$('#oBaseType'); if(bt)bt.value=baseType;
  const cat=$('#oCategoryTarget'); if(cat)cat.value=r.targetName||r.category||'';
  const item=$('#oItemTarget'); if(item)item.value=r.targetId||r.itemId||'';
  $('#oAmount').value=r.amount||'';
  const pc=$('#oPercent'); if(pc)pc.value=r.percent||'';
  const b=$('#oSaveBtn'); if(b)b.textContent='Enregistrer la modification';
  toggleObligationMode(); document.querySelector('#oDesignation')?.scrollIntoView({behavior:'smooth',block:'center'})
}
async function deleteObligation(oid){if(!requireAdmin()) return;if(!ensureActiveExerciseEditable()) return;const {d,company}=current(); if(!(await g3Confirm('Supprimer cette obligation mensuelle ?','Suppression obligation mensuelle'))) return; d.obligations=d.obligations||{}; d.obligations[company.id]=getObligations(d,company.id).filter(o=>o.id!==oid); save(d); g3Success('Obligation mensuelle supprimée.','Suppression effectuée'); renderDash('param')}
function addContractClient(){if(!ensureActiveExerciseEditable()) return;const {d,company}=current(); if(!assertPlanFeature(company,'contracts','Clients sous contrat disponibles avec les plans Free et Business.')) return; d.clients=d.clients||[]; const name=$('#ccName')?.value.trim(); if(!name) return g3Alert('Nom du client contrat obligatoire.','Champ obligatoire','info'); const editId=$('#ccEdit')?.value||''; const obj={companyId:company.id,name,phone:$('#ccPhone')?.value.trim()||'',mode:$('#ccMode')?.value||'Mensuelle',remise:+($('#ccRemise')?.value||0),obs:$('#ccObs')?.value.trim()||'',updatedAt:new Date().toISOString()}; if(editId){const c=d.clients.find(x=>x.id===editId&&x.companyId===company.id); if(c){Object.assign(c,obj); g3Success('Client sous contrat modifié avec succès.','Modification réussie');} }else{d.clients.push(Object.assign({id:id('cli'),createdAt:new Date().toISOString()},obj)); g3Success('Client sous contrat enregistré avec succès.','Enregistrement réussi');} save(d); closeContractClientPopup(); renderDash('contrats')}
function editContractClient(cid){if(!ensureActiveExerciseEditable()) return;const {d,company}=current(); const c=(d.clients||[]).find(x=>x.id===cid&&x.companyId===company.id); if(!c) return alert('Client introuvable'); const m=document.querySelector('#contractClientModal'); if(m)m.classList.remove('hidden'); $('#ccEdit').value=c.id; $('#ccName').value=c.name||''; $('#ccPhone').value=c.phone||''; $('#ccMode').value=c.mode||'Mensuelle'; $('#ccRemise').value=Number(c.remise||0); $('#ccObs').value=c.obs||''; const title=document.querySelector('#contractClientModal h2'); if(title)title.textContent='Modification du client sous contrat'; const b=$('#ccSaveBtn'); if(b)b.textContent='Enregistrer'; setTimeout(()=>$('#ccName')?.focus(),60);} 
async function deleteContractClient(cid){if(!ensureActiveExerciseEditable()) return;const {d,company}=current(); if(!(await g3Confirm('Supprimer définitivement ce client contrat ?','Suppression client contrat'))) return; d.clients=(d.clients||[]).filter(c=>!(c.id===cid&&c.companyId===company.id)); save(d); g3Success('Client sous contrat supprimé.','Suppression effectuée'); renderDash('contrats')}
function findClientSalesByName(name){const n=String(name||'').toLowerCase(); return getCompanyValidatedSales().filter(s=>s.clientType==='contrat'&&String(s.client||'').toLowerCase().includes(n));}
function generateMonthlyClientInvoiceByName(encodedName){generateMonthlyClientInvoice('', decodeURIComponent(encodedName||''));}
function generateMonthlyClientInvoice(cid='', clientName=''){ if(cid) return openContractClientInvoicePage(cid); const sales=findClientSalesByName(clientName); if(!sales.length) return g3Alert('Aucune consommation trouvée pour ce client sous contrat.','Aucune consommation','info'); g3Alert('Veuillez sélectionner le client dans la liste pour ouvrir sa page facture.','Facture client','info'); }


function toggleSaleClientFields(){const t=$('#saleClientType')?.value||'particulier'; const p=$('#saleClientParticulier'), c=$('#saleClientContrat'); if(p)p.classList.toggle('hidden',t!=='particulier'); if(c)c.classList.toggle('hidden',t!=='contrat')}
function resetSaleSelection(){['saleItem','saleName','saleChoiceInfo','saleDetail','salePrice','saleStock','saleAmount'].forEach(k=>{const el=$('#'+k); if(el)el.value=''}); const q=$('#saleQty'); if(q)q.value=1; const f=$('#saleServiceFee'); if(f)f.value=0; const n=$('#saleNote'); if(n)n.value=''; const box=$('#saleAutoFields'); if(box)box.classList.add('hidden')}
function toggleSaleCategory(){
  const sel=$('#saleCat'); const kind=sel?.selectedOptions?.[0]?.dataset?.kind||'';
  const mode=kind==='service'?'service':kind==='boutique'?'boutique':'';
  const m=$('#saleMode'); if(m)m.value=mode;
  const serviceMode=$('#serviceLookupMode'); if(serviceMode)serviceMode.classList.toggle('hidden',!mode);
  const lbl=$('#saleLookupLabel'); if(lbl)lbl.textContent=mode==='boutique'?'2. Sélection du produit':'2. Sélection du service';
  const help=$('#saleLookupHelp'); if(help)help.textContent=mode==='boutique'?'Après le choix d’une catégorie PRODUIT, l’utilisateur peut saisir le code ou sélectionner dans la liste complète des produits enregistrés.':'Après le choix d’une catégorie SERVICE, l’utilisateur peut saisir le code ou sélectionner dans la liste complète des services enregistrés.';
  const lookup=$('#saleServiceLookup'); if(lookup)lookup.value='code';
  const code=$('#saleCodeInput'); if(code)code.value='';
  const list=$('#saleServiceSelect'); if(list)list.innerHTML='<option value="">Choisir un élément enregistré</option>'; const search=$('#saleListSearch'); if(search)search.value=''; const dl=$('#saleCodeSuggestions'); if(dl)dl.innerHTML='';
  resetSaleSelection(); refreshSaleCodeSuggestions(); toggleSaleLookupMode();
}
function toggleSaleLookupMode(){
  const mode=$('#saleMode')?.value||'';
  const lookup=$('#saleServiceLookup')?.value||'code';
  const codeBox=$('#saleCodeBox'), listBox=$('#serviceListBox');
  if(mode){
    if(codeBox)codeBox.classList.toggle('hidden',lookup!=='code');
    if(listBox)listBox.classList.toggle('hidden',lookup!=='list');
    if(lookup==='list') populateSaleItemList();
  }else{
    if(codeBox)codeBox.classList.remove('hidden');
    if(listBox)listBox.classList.add('hidden');
  }
  const code=$('#saleCodeInput'); if(code)code.value='';
  const list=$('#saleServiceSelect'); if(list && lookup!=='list')list.value=''; const search=$('#saleListSearch'); if(search && lookup!=='list')search.value='';
  resetSaleSelection(); refreshSaleCodeSuggestions();
}
function getSaleCandidates(){
  const {d,company}=current(); const cat=$('#saleCat')?.value||''; const mode=$('#saleMode')?.value||'';
  return (d.items||[]).filter(i=>{
    if(i.companyId!==company.id || String(i.cat||'')!==cat) return false;
    const kind=saleRegisterKind(i);
    if(mode==='boutique') return kind==='boutique' && saleRegisterItemVisible(i);
    if(mode==='service') return kind==='service';
    return saleRegisterItemVisible(i);
  });
}
function refreshSaleCodeSuggestions(){
  const dl=$('#saleCodeSuggestions'); if(!dl)return;
  const rows=getSaleCandidates();
  dl.innerHTML=rows.map(i=>`<option value="${esc(i.code||'')}">${esc(i.name||'')} — Code ${esc(i.code||'')}</option><option value="${esc(i.name||'')}">Code ${esc(i.code||'')}</option>`).join('');
}
function populateSaleItemList(){
  const mode=$('#saleMode')?.value||''; const list=$('#saleServiceSelect'); if(!list)return;
  const q=String($('#saleListSearch')?.value||'').trim().toLowerCase();
  const rows=getSaleCandidates().filter(i=>!q || String(i.name||'').toLowerCase().includes(q) || String(i.code||'').toLowerCase().includes(q));
  const label=mode==='boutique'?'produit':'service';
  const l1=$('#saleListLabel'); if(l1)l1.textContent='Liste déroulante des '+label+'s enregistrés';
  const h=$('#saleListHelp'); if(h)h.textContent='Recherchez par nom ou code, sélectionnez le '+label+', puis enregistrez la vente directement dans le rapport.';
  list.innerHTML='<option value="">Choisir un '+label+' enregistré</option>'+rows.map(i=>`<option value="${esc(i.id)}">${esc(i.name||label)} — Code ${esc(i.code||'')}</option>`).join('');
}
function applySaleItem(item,mode){
  const set=(k,v)=>{const el=$('#'+k); if(el)el.value=v??''};
  mode=mode || (isBoutiqueItem(item)?'boutique':'service');
  set('saleMode',mode); set('saleItem',item.id); set('saleName',item.name||'');
  set('saleChoiceInfo',mode==='boutique'?`${item.name||''} / Code : ${item.code||''} / ${item.stockType==='unlimited'?'Stock illimité':'Stock : '+Number(item.stock||0)}`:`${item.name||''} / ${item.code||''} / service`);
  set('saleDetail',mode==='service'?(item.detail||item.cat||'Détail service'):(item.detail||item.cat||'Détail produit'));
  set('salePrice',mode==='boutique'?Number(item.sell||0):'');
  set('saleStock',mode==='boutique'?(item.stockType==='unlimited'?'Stock illimité':Number(item.stock||0)):'Stock non applicable');
  const box=$('#saleAutoFields'); if(box)box.classList.add('hidden');
  openSaleCartPopup(item.id,mode);
}

function salePopupNumber(v){const n=Number(String(v??'').replace(/\s/g,'').replace(',','.')); return Number.isFinite(n)?n:0;}
function salePopupQty(id='saleCartQty'){
  const el=$('#'+id); let q=Math.floor(salePopupNumber(el?.value||1));
  if(!q || q<1) q=1;
  if(el) el.value=q;
  return q;
}
function salePopupClientsServed(id='saleCartClientsServed'){
  const el=$('#'+id); let count=Math.floor(salePopupNumber(el?.value||1));
  if(!count || count<1) count=1;
  if(el) el.value=count;
  return count;
}
function saleClientsServedValue(s){
  const count=Math.floor(Number(s?.clientsServed||0));
  return count>=1?count:1;
}
function closeSaleCartPopup(){document.querySelector('.saleCartPopupBackdrop')?.remove();}
function saleCartBatchCurrency(){const {company}=current(); return companyCurrency(company)||'FCFA';}
function saleCartBatchRowHTML(item,isProduct,index,active=false){
  const suggested=Number(item?.sell||0)>0?Number(item.sell||0):'';
  const priceValue=suggested!==''?String(suggested):'';
  const first=index===0;
  return `<tr class="saleCartBatchRow" data-row-index="${index}" data-active="${active?'1':'0'}">
    <td><div class="saleCartMoneyInput"><input class="saleBatchPrice" type="number" min="0" step="any" value="${esc(priceValue)}" placeholder="0" ${isProduct?'readonly':''} oninput="markSaleCartBatchRow(this);updateSaleCartPopupTotals()"><span>${esc(saleCartBatchCurrency())}</span></div></td>
    <td><div class="saleCartMoneyInput"><input class="saleBatchFee" type="number" min="0" step="any" value="${isProduct?'0':(first?'0':'')}" placeholder="0" ${isProduct?'readonly':''} oninput="markSaleCartBatchRow(this);updateSaleCartPopupTotals()"><span>${esc(saleCartBatchCurrency())}</span></div></td>
    <td><input class="saleBatchQty" type="number" min="1" step="1" value="${first?'1':''}" placeholder="1" inputmode="numeric" oninput="markSaleCartBatchRow(this);updateSaleCartPopupTotals()"></td>
    <td><input class="saleBatchClients" type="number" min="1" step="1" value="${first?'1':''}" placeholder="1" inputmode="numeric" oninput="markSaleCartBatchRow(this);updateSaleCartPopupTotals()"></td>
    <td><input class="saleBatchNote" type="text" value="" placeholder="Note facultative" oninput="markSaleCartBatchRow(this);updateSaleCartPopupTotals()"></td>
    <td class="saleCartBatchAction"><button type="button" class="saleCartBatchDelete" title="Supprimer cette ligne" aria-label="Supprimer cette ligne" onclick="removeSaleCartBatchRow(this)">🗑</button></td>
  </tr>`;
}
function markSaleCartBatchRow(el){const row=el?.closest?.('.saleCartBatchRow'); if(row) row.dataset.active='1';}
function saleCartBatchRows(){return [...document.querySelectorAll('.saleCartBatchRow')];}
function addSaleCartBatchRow(){
  const {d,company}=current(); const iid=$('#saleCartItemId')?.value||'';
  const item=(d.items||[]).find(i=>i.id===iid&&i.companyId===company.id); if(!item)return;
  const mode=$('#saleCartMode')?.value||saleRegisterKind(item); const isProduct=mode==='boutique';
  const body=$('#saleCartBatchBody'); if(!body)return;
  const index=Number(body.dataset.nextIndex||saleCartBatchRows().length||0); body.dataset.nextIndex=String(index+1);
  body.insertAdjacentHTML('beforeend',saleCartBatchRowHTML(item,isProduct,index,true));
  updateSaleCartPopupTotals();
  setTimeout(()=>body.querySelector(`tr[data-row-index="${index}"] ${isProduct?'.saleBatchQty':'.saleBatchPrice'}`)?.focus(),40);
}
function removeSaleCartBatchRow(btn){
  const rows=saleCartBatchRows();
  if(rows.length<=1) return g3Alert('Le formulaire doit conserver au moins une ligne.','Ligne obligatoire','info');
  btn?.closest?.('.saleCartBatchRow')?.remove(); updateSaleCartPopupTotals();
}
function readSaleCartBatchRow(row,isProduct){
  const price=Math.max(0,salePopupNumber(row.querySelector('.saleBatchPrice')?.value||0));
  const fee=Math.max(0,salePopupNumber(row.querySelector('.saleBatchFee')?.value||0));
  const qtyRaw=String(row.querySelector('.saleBatchQty')?.value||'').trim();
  const clientsRaw=String(row.querySelector('.saleBatchClients')?.value||'').trim();
  const qty=qtyRaw===''?0:Math.floor(salePopupNumber(qtyRaw));
  const clientsServed=clientsRaw===''?0:Math.floor(salePopupNumber(clientsRaw));
  const note=String(row.querySelector('.saleBatchNote')?.value||'').trim();
  const active=row.dataset.active==='1'||qtyRaw!==''||clientsRaw!==''||note!==''||(!isProduct&&price>0)||(!isProduct&&fee>0);
  return {row,price,fee,qty,clientsServed,note,active};
}
function saleCartBatchValues(){
  const isProduct=($('#saleCartMode')?.value||'')==='boutique';
  return saleCartBatchRows().map(r=>readSaleCartBatchRow(r,isProduct));
}
function openSaleCartPopup(itemId,mode=''){
  captureSaleCartClient(false);
  const {d,company}=current();
  const item=(d.items||[]).find(i=>i.id===itemId && i.companyId===company.id);
  if(!item) return g3Alert('Produit ou service introuvable.','Sélection invalide','info');
  mode=mode || saleRegisterKind(item);
  const isProduct=mode==='boutique' || saleRegisterKind(item)==='boutique';
  if(isProduct && String(item.stockType||'limited').toLowerCase()!=='unlimited' && saleRegisterStockQty(item)<=0){
    return g3Alert('Ce produit est en rupture de stock et ne peut pas être ajouté au panier.','Stock insuffisant','info');
  }
  closeSaleCartPopup();
  const rows=[0,1,2].map(i=>saleCartBatchRowHTML(item,isProduct,i,i===0)).join('');
  document.body.insertAdjacentHTML('beforeend',`
    <div class="saleCartPopupBackdrop" role="dialog" aria-modal="true">
      <div class="saleCartPopupCard saleCartBatchCard">
        <button type="button" class="saleCartClose" onclick="closeSaleCartPopup()" aria-label="Fermer">×</button>
        <div class="saleCartHead saleCartBatchHead">
          <div class="saleCartIcon">${isProduct?'🛒':'🧾'}</div>
          <div><h2>Remplissez les services de la même catégorie et ajoutez au panier</h2><p>Le client sera choisi avant la validation du panier.</p></div>
        </div>
        <input id="saleCartItemId" type="hidden" value="${esc(item.id)}">
        <input id="saleCartMode" type="hidden" value="${isProduct?'boutique':'service'}">
        <section class="saleCartBatchSection saleCartBatchInfoSection">
          <h3>Informations du produit ou service</h3>
          <div class="saleCartBatchInfoGrid">
            <label>Catégorie<input value="${esc(item.cat||'')}" readonly></label>
            <label>Code<input value="${esc(item.code||'')}" readonly></label>
            <label>Nom du produit ou service<input value="${esc(item.name||'')}" readonly></label>
            <label>Détail<input value="${esc(item.detail||item.marketplaceDesc||'')}" readonly></label>
          </div>
        </section>
        <section class="saleCartBatchSection">
          <div class="saleCartBatchSectionTitle"><h3>Liste des produits ou services vendus</h3><span>${isProduct?'Produit':'Service'} • ${esc(item.cat||'Sans catégorie')}</span></div>
          <div class="saleCartBatchTableWrap">
            <table class="saleCartBatchTable">
              <thead><tr><th>Prix vente du service</th><th>Frais service</th><th>Quantité</th><th>Nb de clients servis</th><th>Note</th><th>Action</th></tr></thead>
              <tbody id="saleCartBatchBody" data-next-index="3">${rows}</tbody>
            </table>
          </div>
          <button type="button" class="saleCartAddRowBtn" onclick="addSaleCartBatchRow()"><span>＋</span> Ajouter une ligne</button>
          <div class="saleCartBatchHelper">ⓘ Les lignes enregistrées seront ajoutées séparément et alignées dans le panier habituel.</div>
        </section>
        <section class="saleCartBatchSection saleCartBatchSummarySection">
          <h3>Résumé</h3>
          <div class="saleCartBatchSummary">
            <div><span class="saleCartSummaryIcon green">🛒</span><small>Total Prix vente du service</small><b id="saleBatchTotalPrice">${money(0)}</b></div>
            <div><span class="saleCartSummaryIcon blue">▤</span><small>Total Frais service</small><b id="saleBatchTotalFee">${money(0)}</b></div>
            <div><span class="saleCartSummaryIcon orange">□</span><small>Quantité générale</small><b id="saleBatchTotalQty">0</b></div>
            <div><span class="saleCartSummaryIcon purple">♙</span><small>Nb total de clients servis</small><b id="saleBatchTotalClients">0</b></div>
          </div>
        </section>
        <div class="saleCartActions saleCartBatchActions">
          <button type="button" class="btn2" onclick="closeSaleCartPopup()">Annuler</button>
          <button type="button" class="saleCartAddBtn" onclick="confirmAddSaleCartPopup()">ENREGISTRER LES SERVICES</button>
        </div>
      </div>
    </div>`);
  updateSaleCartPopupTotals();
  setTimeout(()=>document.querySelector('.saleCartBatchRow[data-row-index="0"] '+(isProduct?'.saleBatchQty':'.saleBatchPrice'))?.focus(),80);
}
function updateSaleCartPopupTotals(){
  const mode=$('#saleCartMode')?.value||''; const isProduct=mode==='boutique';
  let totalPrice=0,totalFee=0,totalQty=0,totalClients=0;
  saleCartBatchValues().forEach(v=>{
    if(!v.active)return;
    totalPrice+=isProduct?(v.price*Math.max(0,v.qty||0)):v.price;
    totalFee+=isProduct?0:v.fee;
    totalQty+=Math.max(0,v.qty||0);
    totalClients+=Math.max(0,v.clientsServed||0);
  });
  const tp=$('#saleBatchTotalPrice'); if(tp)tp.textContent=money(totalPrice);
  const tf=$('#saleBatchTotalFee'); if(tf)tf.textContent=money(totalFee);
  const tq=$('#saleBatchTotalQty'); if(tq)tq.textContent=String(totalQty);
  const tc=$('#saleBatchTotalClients'); if(tc)tc.textContent=String(totalClients);
}
function clearSaleLookupAfterPopup(){
  const code=$('#saleCodeInput'); if(code)code.value='';
  const list=$('#saleServiceSelect'); if(list)list.value='';
  resetSaleSelection(); refreshSaleCodeSuggestions(); if($('#saleServiceLookup')?.value==='list') populateSaleItemList();
}
function confirmAddSaleCartPopup(){
  if(!ensureActiveExerciseEditable()) return;
  const {d,user,company}=current(); const cid=company.id;
  const iid=$('#saleCartItemId')?.value||$('#saleItem')?.value||'';
  const item=(d.items||[]).find(i=>i.id===iid&&i.companyId===cid);
  const mode=$('#saleCartMode')?.value || ($('#saleMode')?.value||'');
  if(!item) return g3Alert('Le produit ou service sélectionné est introuvable.','Ajout impossible','info');
  const saleKindFinal=(mode==='boutique'||saleRegisterKind(item)==='boutique')?'boutique':'service';
  const isProduct=saleKindFinal==='boutique';
  const rows=saleCartBatchValues().filter(v=>v.active);
  if(!rows.length) return g3Alert('Renseignez au moins une ligne avant l’enregistrement.','Aucune ligne renseignée','info');
  for(let i=0;i<rows.length;i++){
    const v=rows[i];
    if(v.qty<1) return g3Alert('Ligne '+(i+1)+' : la quantité doit être supérieure ou égale à 1.','Quantité obligatoire','info');
    if(v.clientsServed<1) return g3Alert('Ligne '+(i+1)+' : le nombre de clients servis doit être supérieur ou égal à 1.','Clients servis obligatoires','info');
    if(v.price<=0) return g3Alert('Ligne '+(i+1)+' : renseignez un prix de vente supérieur à 0.','Prix obligatoire','info');
    if(v.fee<0) return g3Alert('Ligne '+(i+1)+' : les frais service ne peuvent pas être négatifs.','Frais invalides','info');
  }
  if(isProduct){
    const requested=rows.reduce((sum,v)=>sum+Number(v.qty||0),0);
    const currentStock=saleRegisterStockQty(item);
    const reserved=getCompanyCartSales().filter(s=>s.itemId===item.id).reduce((a,b)=>a+Number(b.qty||0),0);
    if(String(item.stockType||'limited').toLowerCase()!=='unlimited'&&currentStock<reserved+requested) return g3Alert('La quantité totale demandée dépasse le stock encore disponible pour ce panier.','Stock insuffisant','danger');
  }
  captureSaleCartClient(false);
  d.sales=d.sales||[];
  const now=Date.now();
  rows.forEach((v,index)=>{
    let unit=0,total=0,charges=0,serviceFee=0,serviceBasePrice=0;
    if(isProduct){
      unit=v.price; total=unit*v.qty; charges=Number(item.buy||0)*v.qty; serviceFee=0; serviceBasePrice=0;
    }else{
      serviceBasePrice=v.price; serviceFee=v.fee; total=serviceBasePrice+serviceFee; unit=v.qty?total/v.qty:0; charges=serviceBasePrice*(Number(item.charge||0)/100);
    }
    const stamp=new Date(now+index).toISOString();
    const sid='GG-'+stamp.replace(/[-:.TZ]/g,'').slice(0,14)+'-'+String(Math.floor(Math.random()*900+100));
    d.sales.push({id:sid,companyId:cid,userId:user.id,client:'',name:item.name,qty:v.qty,clientsServed:v.clientsServed,unit,total,serviceFee,serviceBasePrice,charges,profit:total-charges,date:stamp,cartCreatedAt:stamp,saleStatus:'cart',status:'cart',cartPending:true,validatedAt:'',docSecureLink:secureDocLink(sid),docQr:true,clientType:'',contractClientId:'',itemCode:item.code||'',itemId:item.id,category:item.cat||'',detail:item.detail||item.marketplaceDesc||'',saleKind:saleKindFinal,note:v.note});
  });
  save(d);
  logCaisseAction('Ajout multiple au panier',rows.length+' ligne(s) '+(item.name||'')+' ajoutée(s) au panier');
  closeSaleCartPopup(); clearSaleLookupAfterPopup(); renderDash('vente');
  g3Success(rows.length+' ligne(s) ajoutée(s) séparément au panier. Choisissez le client puis cliquez sur « Encaisser et valider ».','Panier mis à jour');
}

function findSaleItemByCode(){
  const sel=$('#saleCat'); const cat=sel?.value||''; const term=String($('#saleCodeInput')?.value||'').trim();
  resetSaleSelection(); if(!cat){return alert('Choisissez d’abord une catégorie.')} if(!term) return;
  const q=term.toLowerCase();
  const rows=getSaleCandidates().filter(i=>String(i.code||'').toLowerCase()===q || String(i.name||'').toLowerCase().includes(q));
  if(rows.length===1){ applySaleItem(rows[0],($('#saleMode')?.value||'boutique')); return; }
  if(rows.length>1){ const dl=$('#saleCodeSuggestions'); if(dl)dl.innerHTML=rows.map(i=>`<option value="${esc(i.name||'')}">Code ${esc(i.code||'')}</option><option value="${esc(i.code||'')}">${esc(i.name||'')}</option>`).join(''); }
}
function findSaleItemBySelect(){
  const {d,company}=current(); const sel=$('#saleCat'); const cat=sel?.value||''; const iid=$('#saleServiceSelect')?.value||'';
  resetSaleSelection(); if(!cat)return alert('Choisissez d’abord une catégorie.'); if(!iid)return;
  const mode=$('#saleMode')?.value||'';
  const item=(d.items||[]).find(i=>i.companyId===company.id&&i.id===iid&&String(i.cat||'')===cat&&(mode==='boutique'?isBoutiqueItem(i):!isBoutiqueItem(i)));
  if(!item)return; applySaleItem(item,mode==='boutique'?'boutique':'service');
}
function updateSaleAmount(){
  const m=$('#saleMode')?.value||''; const a=$('#saleAmount'); if(!a) return;
  const {d,company}=current(); const item=d.items.find(i=>i.id===$('#saleItem')?.value&&i.companyId===company.id); const q=Number($('#saleQty')?.value||0);
  if(!item){a.value=''; return;}
  if(m==='boutique'){a.value=q*Number(item.sell||0); return;}
  const servicePrice=Number($('#salePrice')?.value||0), fee=Number($('#saleServiceFee')?.value||0);
  a.value=servicePrice+fee;
}
function getSaleClientLabel(){const t=$('#saleClientType')?.value||'particulier'; if(t==='contrat'){const sel=$('#saleContractClient'); return sel?.selectedOptions?.[0]?.textContent?.trim()||''} const name=$('#saleClientName')?.value?.trim()||''; const phone=$('#saleClientPhone')?.value?.trim()||''; const adr=$('#saleClientAddress')?.value?.trim()||''; return [name,phone,adr].filter(Boolean).join(' / ')}
function openClientContractPopup(){document.querySelector('#clientContractModal')?.classList.remove('hidden')}
function closeClientContractPopup(){document.querySelector('#clientContractModal')?.classList.add('hidden')}
function addContractClientFromSale(){if(!ensureActiveExerciseEditable()) return;const {d,company}=current(); if(!assertPlanFeature(company,'contracts','Clients sous contrat disponibles avec les plans Free et Business.')) return; d.clients=d.clients||[]; const name=$('#ccNamePopup')?.value.trim(); if(!name) return alert('Nom du client obligatoire'); const newClient={id:id('cli'),companyId:company.id,name,phone:$('#ccPhonePopup')?.value.trim()||'',mode:$('#ccModePopup')?.value||'Mensuelle',remise:+($('#ccRemisePopup')?.value||0),obs:$('#ccObsPopup')?.value.trim()||'',createdAt:new Date().toISOString()}; d.clients.push(newClient); const meta=getSaleCartMeta(d,company.id); meta.clientType='contrat'; meta.contractClientId=newClient.id; save(d); closeClientContractPopup(); renderDash('vente')}

function addSale(){
  const {d,company}=current(); const iid=$('#saleItem')?.value||'';
  const item=(d.items||[]).find(i=>i.id===iid&&i.companyId===company.id);
  if(!$('#saleCat')?.value) return g3Alert('Choisissez d’abord une catégorie.','Catégorie obligatoire','info');
  if(!item) return g3Alert('Sélectionnez un produit ou un service valide.','Sélection obligatoire','info');
  openSaleCartPopup(item.id,$('#saleMode')?.value||'');
}
async function resetUserPasswordDirect(uid){
  if(!requireAdmin('Réservé à l’administrateur.')) return;
  const {d,company}=current(); const u=(d.users||[]).find(x=>x.id===uid&&x.companyId===company.id);
  if(!u||u.role!=='caisse') return alert('Réinitialisation refusée : un administrateur d’entreprise peut réinitialiser uniquement un compte Caisse. Pour un compte Administrateur, contactez le Super Admin GLOBAL MARKET.');
  if(!(await g3Confirm('Réinitialiser le mot de passe de '+(u.name||u.email)+' ?','Réinitialisation mot de passe'))) return;
  const temp=makeTempPassword(); await setObjectPassword(u,temp); u.status='active'; u.mustChangePassword=true;
  resetLoginAttempts(u.email); save(d);
  alert('Nouveau mot de passe temporaire :\n\n'+temp+'\n\nIl est chiffré dans le système. L’utilisateur devra le changer à la prochaine connexion.');
  renderDash('param');
}
async function addUser(){
  if(!requireAdmin('La caisse ne peut pas créer ni voir les mots de passe des utilisateurs.')) return;
  const {d,company}=current();
  if(!assertPlanFeature(company,'multi_users','Le multi-utilisateur est disponible avec les plans Free et Business.')) return;
  if(!canCreateMoreUsers(company,d)) return alert('Limite utilisateurs atteinte pour le plan '+planDef(company).statut+' : '+userLimitLabel(company)+' utilisateur(s).');
  const email=$('#uEmail')?.value.trim().toLowerCase()||'', pass=$('#uPass')?.value||'', role=$('#uRole')?.value||'caisse';
  if(!email||!pass) return alert('Email et mot de passe obligatoires.');
  if(pass.length<6) return alert('Le mot de passe doit contenir au moins 6 caractères.');
  if(d.users.some(u=>u.companyId===company.id&&String(u.email||'').toLowerCase()===email)) return alert('Email déjà utilisé');
  const newUser={id:id('usr'),companyId:company.id,name:$('#uName')?.value||'',email,role,status:'active',sessionMinutes:0,caisseStartTime:role==='caisse'?normalizeHour($('#uStart')?.value,'07:00'):'',caisseEndTime:role==='caisse'?normalizeHour($('#uEnd')?.value,'22:00'):'',createdAt:new Date().toISOString()};
  await setObjectPassword(newUser,pass); d.users.push(newUser); save(d); renderDash('param');
}
function blockUser(uid){const d=seed(), u=d.users.find(x=>x.id===uid); if(u)u.status='blocked'; save(d); renderDash('param')}

function superPasswordResetRequestsBox(){
  const d=seed();
  const rows=(d.passwordResetRequests||[]).filter(r=>r.role==='admin').slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return `<div class="superTableWrap"><table class="superTable"><thead><tr><th>Date</th><th>Entreprise</th><th>Administrateur</th><th>Contact</th><th>Motif</th><th>Statut</th><th>Action</th></tr></thead><tbody>${rows.map(r=>{const c=(d.companies||[]).find(x=>x.id===r.companyId); return `<tr><td>${new Date(r.createdAt).toLocaleString('fr-FR')}</td><td>${esc(c?.name||'-')}</td><td><b>${esc(r.userName||r.email)}</b><br><small>${esc(r.email||'')}</small></td><td>${esc(r.phone||'')}</td><td>${esc(r.reason||'')}</td><td>${esc(r.status||'')}</td><td>${r.status==='pending'?`<button class="detailsBtn" onclick="resetPasswordRequestBySuper('${r.id}')">Générer mot de passe</button>`:'<span class="statusPill active">traité</span>'}</td></tr>`}).join('')||'<tr><td colspan="7">Aucune demande administrateur en attente.</td></tr>'}</tbody></table></div>`;
}
async function resetPasswordRequestBySuper(rid){
  const {d,user}=current();
  if(user?.role!=='superadmin') return alert('Réservé au Super Admin GLOBAL MARKET.');
  const r=(d.passwordResetRequests||[]).find(x=>x.id===rid&&x.role==='admin');
  if(!r) return alert('Demande administrateur introuvable.');
  const u=(d.users||[]).find(x=>x.id===r.userId&&x.role==='admin');
  if(!u) return alert('Compte administrateur introuvable.');
  const temp=makeTempPassword(); await setObjectPassword(u,temp); u.status='active'; u.mustChangePassword=true;
  r.status='done'; r.doneAt=new Date().toISOString(); r.doneBy=user.id; resetLoginAttempts(u.email); save(d);
  alert('Mot de passe temporaire généré pour l’administrateur '+(u.name||u.email)+' :\n\n'+temp+'\n\nIl est chiffré et devra être changé à la prochaine connexion.');
  renderSuper();
}
async function superResetAdminPassword(uid){
  const {d,user}=current();
  if(user?.role!=='superadmin') return alert('Réservé au Super Admin GLOBAL MARKET.');
  const u=(d.users||[]).find(x=>x.id===uid&&x.role==='admin');
  if(!u) return alert('Compte administrateur introuvable.');
  if(!(await g3Confirm('Générer un mot de passe temporaire pour cet administrateur ?','Mot de passe temporaire'))) return;
  const temp=makeTempPassword(); await setObjectPassword(u,temp); u.status='active'; u.mustChangePassword=true;
  resetLoginAttempts(u.email); save(d);
  alert('Mot de passe temporaire généré pour '+(u.name||u.email)+' :\n\n'+temp+'\n\nIl est chiffré et devra être changé à la prochaine connexion.');
  closeSuperModal(); showCompanyDetails(u.companyId);
}
function renderSuper(){const {d,user}=current(); const ca=(d.companies||[]).some(c=>c.v6Stats)?(d.companies||[]).reduce((n,c)=>n+Number(c.v6Stats?.salesTotal||0),0):d.sales.filter(isSaleValidated).reduce((a,b)=>a+b.total,0); const active=d.companies.filter(c=>statusCompany(c)==='active'||statusCompany(c)==='trial').length; const expired=d.companies.filter(c=>statusCompany(c)==='expired').length; app.innerHTML=globalUniversalHeader('super')+`<div class="superShell superUnifiedShell"><aside class="superSide"><div class="superBrand"><div class="superLogo">MS</div><div><h2>MEGA SERVICES</h2><p>Super Admin GLOBAL MARKET</p></div></div><div class="superMenu"><button class="active" onclick="renderSuper()">📊 Vue générale</button><button onclick="exportData()">📤 Exporter données</button><button class="danger" onclick="logout()">🚪 Déconnexion</button></div><div class="superNote">Gestion centrale des entreprises, abonnements, utilisateurs et chiffres déclarés.</div></aside><main class="superMain"><div class="superHero"><div><span class="superKicker">Administration centrale</span><h1>Gestion professionnelle des entreprises inscrites</h1><p>Suivi des abonnements, contrôle des statuts, chiffre d’affaires et actions rapides MEGA SERVICES.</p></div><button class="superExport" onclick="exportData()">📤 Exporter données</button></div><div class="superStats"><div class="superStat"><span>🏢</span><small>Entreprises</small><b>${d.companies.length}</b></div><div class="superStat"><span>✅</span><small>Actives</small><b>${active}</b></div><div class="superStat"><span>⏳</span><small>Expirées</small><b>${expired}</b></div><div class="superStat"><span>💰</span><small>CA déclaré</small><b>${money(ca)}</b></div></div><section class="superPanel"><div class="superPanelHead"><div><h2>Entreprises inscrites</h2><p>Liste simplifiée : cliquez sur <b>Voir détails</b> devant chaque entreprise pour ouvrir la fiche complète avec les actions.</p></div><span>${d.companies.length} entreprise(s)</span></div><div class="superTableWrap"><table class="superTable superCompanyList"><thead><tr><th>Entreprise</th><th>Responsable</th><th>Abonnement</th><th>CA déclaré</th><th>Actions</th></tr></thead><tbody>${d.companies.map(c=>{let s=c.v6Stats?Number(c.v6Stats.salesTotal||0):d.sales.filter(x=>x.companyId===c.id&&isSaleValidated(x)).reduce((a,b)=>a+b.total,0), st=statusCompany(c); return `<tr><td><div class="companyNameLine"><button class="detailsBtn" onclick="showCompanyDetails('${c.id}')">Voir détails</button><strong>${esc(c.name)}</strong></div></td><td>${esc(c.owner)}</td><td><span class="statusPill ${st}">${st}</span><br><small>${esc(planDef(c).label)} — Fin : ${esc(c.subscriptionEnd)}</small></td><td><b>${money(s)}</b></td><td><div class="superCompanyActions"><button class="detailsBtn wide" onclick="showCompanyDetails('${c.id}')">Ouvrir la fiche</button><button class="danger companyDeleteBtn" data-delete-company="${c.id}" onclick="deleteCompanyAccount('${c.id}')">Supprimer le compte</button></div></td></tr>`}).join('')}</tbody></table></div></section><section class="superPanel"><div class="superPanelHead"><div><h2>Réinitialisation mots de passe Administrateur</h2><p>Règle de sécurité : seul le Super Admin GLOBAL MARKET peut réinitialiser un compte Administrateur d’entreprise.</p></div></div>${superPasswordResetRequestsBox()}</section></main></div>`}

function showCompanyDetails(cid){const d=seed(), c=d.companies.find(x=>x.id===cid); if(!c)return; const us=d.users.filter(u=>u.companyId===c.id), sales=d.sales.filter(x=>x.companyId===c.id&&isSaleValidated(x)), pay=d.payments.filter(x=>x.companyId===c.id); const ca=c.v6Stats?Number(c.v6Stats.salesTotal||0):sales.reduce((a,b)=>a+b.total,0), articles=sales.reduce((a,b)=>a+(Number(b.qty)||0),0), saleCount=c.v6Stats?Number(c.v6Stats.salesCount||0):sales.length, paymentCount=c.v6Stats?Number(c.v6Stats.paymentCount||0):pay.length, st=statusCompany(c); const old=document.querySelector('.superModalBackdrop'); if(old)old.remove(); const box=document.createElement('div'); box.className='superModalBackdrop'; box.innerHTML=`<div class="superCompanyModal"><button class="superClose" onclick="closeSuperModal()">×</button><div class="companyModalHead"><div><span class="superKicker">Fiche entreprise</span><h2>${esc(c.name)}</h2><p>Informations d’inscription, abonnement, utilisateurs, chiffre d’affaires et gestion des accès.</p></div><span class="statusPill ${st}">${st}</span></div><div class="companyDetailGrid"><div><small>Responsable</small><b>${esc(c.owner)}</b></div><div><small>Téléphone</small><b>${esc(c.phone)}</b></div><div><small>Email</small><b>${esc(c.email)}</b></div><div><small>Type de commerce</small><b>${esc(c.businessType)}</b></div><div><small>Plan</small><b>${esc(c.plan)}</b></div><div><small>Début abonnement</small><b>${esc(c.subscriptionStart||'-')}</b></div><div><small>Fin abonnement</small><b>${esc(c.subscriptionEnd||'-')}</b></div><div><small>Utilisateurs</small><b>${us.length}</b></div><div><small>Ventes réalisées</small><b>${saleCount}</b></div><div><small>Articles vendus</small><b>${articles}</b></div><div><small>Chiffre d’affaires</small><b>${money(ca)}</b></div><div><small>Paiements enregistrés</small><b>${paymentCount}</b></div></div><h3>Utilisateurs du compte</h3><div class="miniList">${us.length?us.map(u=>`<div><b>${esc(u.name)}</b><span>${esc(u.role)} — ${esc(u.email)} — ${esc(u.status||'active')}${u.mustChangePassword?' — mot de passe temporaire':''}</span>${u.role==='admin'?`<button class="detailsBtn" onclick="superResetAdminPassword('${u.id}')">Réinitialiser admin</button>`:''}</div>`).join(''):'<em>Aucun utilisateur enregistré.</em>'}</div>${planActivationButtons(c.id,planCode(c))}<div class="superModalActions"><button onclick="renewCompany('${c.id}');closeSuperModal()">Renouveler</button><button class="soft" onclick="setCompanyStatus('${c.id}','suspended');closeSuperModal()">Suspendre</button><button class="danger" onclick="setCompanyStatus('${c.id}','blocked');closeSuperModal()">Bloquer</button><button class="ok" onclick="setCompanyStatus('${c.id}','active');closeSuperModal()">Activer</button><button class="danger companyDeleteBtn" data-delete-company="${c.id}" onclick="deleteCompanyAccount('${c.id}')">Supprimer définitivement le compte</button></div></div>`; document.body.appendChild(box)}
function closeSuperModal(){const m=document.querySelector('.superModalBackdrop'); if(m)m.remove()}

async function deleteCompanyAccount(cid){
  const d=seed();
  const company=(d.companies||[]).find(item=>item.id===cid);
  if(!company) return g3Alert('Entreprise introuvable.','Suppression entreprise','warn');
  const first=await g3Confirm(
    `Supprimer définitivement le compte « ${company.name} » ? Tous ses utilisateurs, sessions et données actives seront retirés de GLOBAL MARKET.`,
    'Suppression sécurisée d’une entreprise'
  );
  if(!first) return;
  const typed=await g3Prompt(
    `Saisissez exactement le nom de l’entreprise pour confirmer :\n${company.name}`,
    '',
    'Confirmation du nom de l’entreprise'
  );
  if(String(typed||'').trim()!==String(company.name||'').trim()){
    return g3Alert('Le nom saisi ne correspond pas. Suppression annulée.','Suppression entreprise','warn');
  }
  const finalWord=await g3Prompt('Tapez SUPPRIMER pour confirmer définitivement.','','Dernière confirmation');
  if(String(finalWord||'').trim().toUpperCase()!=='SUPPRIMER'){
    return g3Alert('Confirmation finale incorrecte. Suppression annulée.','Suppression entreprise','warn');
  }
  const buttons=[...document.querySelectorAll(`[data-delete-company="${cid}"]`)];
  buttons.forEach(button=>{button.disabled=true;button.dataset.oldText=button.textContent;button.textContent='Suppression…'});
  try{
    const result=await secureEmployeePost('/api/companies/delete',{companyId:cid,companyName:company.name,confirmation:'SUPPRIMER'});
    if(result.data){CLOUD_DATA=normalizeData(result.data);CLOUD_LAST_ACK_DATA=cloneCloudData(CLOUD_DATA);CLOUD_DATA_READY=true}else await cloudLoadData();
    closeSuperModal();
    renderSuper();
    g3Success(result.message||'Compte entreprise supprimé avec succès.','Suppression terminée');
  }catch(error){
    g3Alert(secureErrorMessage(error,'Suppression du compte entreprise impossible.'),'Suppression entreprise','warn');
  }finally{
    buttons.forEach(button=>{button.disabled=false;button.textContent=button.dataset.oldText||'Supprimer le compte'});
  }
}

async function renewCompany(cid){const d=seed(), c=d.companies.find(x=>x.id===cid); const days=Number(await g3Prompt('Nombre de jours ?', '30','Renouvellement')||0), amount=Number(await g3Prompt('Montant payé ?', '0','Paiement')||0); if(!c||!days)return; c.status='active'; c.plan='Abonnement '+days+' jours'; c.subscriptionStart=today(); c.subscriptionEnd=new Date(Date.now()+days*86400000).toISOString().slice(0,10); d.payments.push({id:id('pay'),companyId:cid,amount,plan:c.plan,date:new Date().toISOString()}); save(d); renderSuper()}
function setCompanyStatus(cid,st){const d=seed(), c=d.companies.find(x=>x.id===cid); if(c)c.status=st; save(d); renderSuper()}
function exportData(){if(!requireAdmin('La caisse ne peut pas exporter toute la base de données.')) return;const blob=new Blob([JSON.stringify(seed(),null,2)],{type:'application/json'}), a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='global3-sauvegarde.json'; a.click()}
window.addEventListener('error',e=>{app.innerHTML='<div class="wrap"><div class="card"><h1>GLOBAL MARKET</h1><p>Une erreur a été détectée, mais la page n’est pas blanche.</p><pre>'+esc(e.message)+'</pre><button onclick="cloudStart()">Réessayer</button></div></div>'});
cloudStart();



function availableSubscriptionPlansHTML(){
  const plans=[
    {code:'FREE',name:'PLAN FREE',price:0,duration:'21 jours',status:'FREE',tag:'Essai complet',dest:['Toutes les entreprises'],features:['Accès complet à toute l’application','Toutes les sections disponibles','Produits, services et catégories illimités','Marketplace et clients sous contrat','Durée fixe de 21 jours']},
    {code:'BUSINESS',name:'PLAN BUSINESS',price:BUSINESS_PLAN_AMOUNT,duration:'365 jours',status:'BUSINESS',tag:'Accès annuel complet',dest:['Toutes les entreprises'],features:['Accès complet à toute l’application','Toutes les sections disponibles','Produits, services et catégories illimités','Marketplace et clients sous contrat','Durée fixe de 365 jours']}
  ];
  return `<div class="g2panel subscriptionPlansBox"><div class="subscriptionPlansHead"><div><h3>Deux plans simples et complets</h3><p>Les deux plans donnent accès à toutes les fonctionnalités. Seule la durée d’utilisation change.</p></div><span>GLOBAL MARKET</span></div><div class="subscriptionPlansGrid twoPlans">${plans.map(p=>`<article class="subscriptionPlanCard ${p.code==='BUSINESS'?'premiumPlan':''}"><div class="planTopLine"><span>${esc(p.tag)}</span><b>${esc(p.status)}</b></div><h2>${esc(p.name)}</h2><div class="planPrice">${money(p.price)} <small>/ ${esc(p.duration)}</small></div><p class="planDest"><b>Destiné à :</b> ${p.dest.map(esc).join(' • ')}</p><ul>${p.features.map(f=>`<li>✅ ${esc(f)}</li>`).join('')}</ul>${p.code==='FREE'?`<button class="freePlanBtn" disabled>Activé automatiquement pendant 21 jours</button>`:`<button class="buyPlanBtn" onclick="openSubscriptionPayment('BUSINESS')">Acheter pour ${money(BUSINESS_PLAN_AMOUNT)}</button>`}</article>`).join('')}</div></div>`;
}

function openSubscriptionPayment(code){
  if(code==='FREE'){alert('Le Plan Free est activé automatiquement pendant 21 jours à la création de l’entreprise.');return;} if(code!=='BUSINESS') return;
  const {company}=current(); const plan=GLOBAL_MARKET_PLANS[code]||GLOBAL_MARKET_PLANS.FREE;
  const ticket='GG-'+today().replaceAll('-','')+'-'+randomPart(5); const amount=Number(plan.price||0);
  const usdRate=600;
  const amountUsd=Math.ceil((amount/usdRate)*100)/100;
  const wave='https://pay.wave.com/m/M_ci_Enx-2JNAklk-/c/ci/?amount='+amount;
  const usdt='TELcLXo2sFUEnzVTJnX25dvanqca6VLwyM';
  const usdtPayload='USDT TRC20 | Adresse: '+usdt+' | Montant: '+amountUsd+' USD | Ticket: '+ticket;
  const qr=(data)=>'https://api.qrserver.com/v1/create-qr-code/?size=190x190&margin=8&data='+encodeURIComponent(data);
  const old=document.querySelector('.subscriptionPaymentBackdrop'); if(old)old.remove();
  const box=document.createElement('div'); box.className='subscriptionPaymentBackdrop';
  box.innerHTML=`<div class="subscriptionPaymentModal"><button class="subscriptionClose" onclick="this.closest('.subscriptionPaymentBackdrop').remove()">×</button><div class="paymentHero"><div><span>GLOBAL MARKET • Plan Business annuel</span><h2>${esc(plan.label)}</h2><p>Vérifiez les informations, sélectionnez le moyen de paiement puis le QR Code correspondant s’affichera.</p></div><b id="g3payHeroAmount">${money(amount)}</b></div><div class="paymentGrid"><label>N° de ticket<input id="g3payTicket" value="${ticket}" readonly></label><label>Entreprise<input id="g3payCompany" value="${esc(company?.name||'')}" readonly></label><label>Nom complet<input id="g3payName" placeholder="Nom du responsable"></label><label>WhatsApp / Téléphone<input id="g3payPhone" placeholder="Ex : 0777041790"></label><label>Pack choisi<input value="${esc(plan.label)}" readonly></label><label>Montant à payer<input id="g3payAmountDisplay" value="${money(amount)}" readonly></label></div><div class="paymentSummary"><h3>Résumé de la commande</h3><p><b>Produit :</b> GLOBAL MARKET — ${esc(plan.label)}</p><p><b>Code pack :</b> ${esc(plan.code)}</p><p><b>Mode d’accès :</b> Activation du Plan Business pendant 365 jours après validation par le Super Admin.</p><p><b>Montant FCFA :</b> ${money(amount)}</p><p><b>Montant USDT TRC20 :</b> ${amountUsd} $</p></div><div class="paymentMethodSelect"><h3>Choisir le moyen de paiement</h3><div><button type="button" onclick="selectSubscriptionPaymentMethod('wave')">Wave Côte d’Ivoire</button><button type="button" onclick="selectSubscriptionPaymentMethod('usdt')">USDT TRC20</button></div><small>Sélectionnez d’abord un moyen de paiement pour afficher uniquement son QR Code.</small></div><div class="paymentChoices paymentQrChoices"><div id="g3payWaveBox" class="payQrPanel" style="display:none"><h4>Paiement Wave Côte d’Ivoire</h4><div class="qrPayBox"><img src="${qr(wave)}" alt="QR Code Paiement Wave"><p>Montant : <b>${money(amount)}</b><br>Scannez ce QR Code pour ouvrir le paiement Wave.</p></div><a href="${wave}" target="_blank" rel="noopener">Ouvrir Wave</a></div><div id="g3payUsdtBox" class="payQrPanel" style="display:none"><h4>USDT TRC20</h4><div class="qrPayBox"><img src="${qr(usdtPayload)}" alt="QR Code USDT TRC20"><p>Montant à payer : <b>${amountUsd} $</b><br>Réseau : <b>TRC20</b><br>Adresse : ${esc(usdt)}</p></div><button onclick="navigator.clipboard&&navigator.clipboard.writeText('${usdt}')">Copier l’adresse</button></div></div><div class="paymentFinal"><input type="hidden" id="g3payMethod" value=""><label>Référence de transaction*<input id="g3payRef" placeholder="Référence Wave / USDT"></label><label>Note complémentaire<textarea id="g3payNote" placeholder="Facultatif"></textarea></label><button onclick="sendSubscriptionPaymentWhatsApp('${plan.code}','${ticket}',${amount},${amountUsd})">J’ai payé</button><small>Les informations de commande seront envoyées au support MEGA SERVICES par WhatsApp.</small></div></div>`;
  document.body.appendChild(box);
}
function selectSubscriptionPaymentMethod(method){
  const waveBox=$('#g3payWaveBox'), usdtBox=$('#g3payUsdtBox'), methodInput=$('#g3payMethod'), amountInput=$('#g3payAmountDisplay'), hero=$('#g3payHeroAmount');
  if(methodInput) methodInput.value=method;
  if(waveBox) waveBox.style.display=method==='wave'?'block':'none';
  if(usdtBox) usdtBox.style.display=method==='usdt'?'block':'none';
  document.querySelectorAll('.paymentMethodSelect button').forEach(b=>b.classList.remove('activePayMethod'));
  const active=[...document.querySelectorAll('.paymentMethodSelect button')].find(b=>method==='wave'?b.textContent.includes('Wave'):b.textContent.includes('USDT'));
  if(active) active.classList.add('activePayMethod');
  const usdText=document.querySelector('#g3payUsdtBox .qrPayBox b')?.textContent||'';
  const fcfaText=document.querySelector('#g3payWaveBox .qrPayBox b')?.textContent||'';
  if(method==='usdt'){ if(amountInput) amountInput.value=usdText; if(hero) hero.textContent=usdText; }
  if(method==='wave'){ if(amountInput) amountInput.value=fcfaText; if(hero) hero.textContent=fcfaText; }
}
function sendSubscriptionPaymentWhatsApp(code,ticket,amount,amountUsd){
  const {company}=current(); const plan=GLOBAL_MARKET_PLANS[code]||GLOBAL_MARKET_PLANS.FREE;
  const name=($('#g3payName')?.value||'').trim(), phone=($('#g3payPhone')?.value||'').trim(), ref=($('#g3payRef')?.value||'').trim(), note=($('#g3payNote')?.value||'').trim(), method=($('#g3payMethod')?.value||'').trim();
  if(!method){alert('Veuillez d’abord sélectionner le moyen de paiement.');return;}
  if(!name||!phone||!ref){alert('Veuillez renseigner le nom, le téléphone et la référence de transaction.');return;}
  const methodLabel=method==='usdt'?'USDT TRC20':'Wave Côte d’Ivoire';
  const amountLabel=method==='usdt'?(amountUsd+' $') : money(amount);
  const msg=`Bonjour MEGA SERVICES, je viens de payer un abonnement GLOBAL MARKET.%0A%0AEntreprise : ${encodeURIComponent(company?.name||'')}%0AResponsable : ${encodeURIComponent(name)}%0ATéléphone : ${encodeURIComponent(phone)}%0ATicket : ${encodeURIComponent(ticket)}%0APack : ${encodeURIComponent(plan.label)}%0AStatut demandé : ${encodeURIComponent(plan.statut)}%0AMoyen de paiement : ${encodeURIComponent(methodLabel)}%0AMontant : ${encodeURIComponent(amountLabel)}%0ARéférence transaction : ${encodeURIComponent(ref)}%0ANote : ${encodeURIComponent(note||'-')}%0A%0AMerci de valider mon abonnement.`;
  window.open('https://wa.me/'+supportPhone+'?text='+msg,'_blank');
}

function printPlanPaymentReceipt(paymentId){
  const {d,company}=current(); const p=(d.payments||[]).find(x=>x.id===paymentId&&x.companyId===company.id); if(!p)return alert('Paiement introuvable.');
  const ref=p.ref||p.id, dt=new Date(p.date||Date.now()).toLocaleString('fr-FR'), plan=esc(p.plan||planDef(company).label);
  const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reçu abonnement ${esc(ref)}</title><style>${globalPrintThemeStyles('portrait')}@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#eef4f3;font-family:Arial,Helvetica,sans-serif;color:#102b2a;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{position:fixed;right:16px;top:16px;z-index:10;display:flex;gap:8px}.toolbar button{border:0;border-radius:12px;padding:12px 16px;background:#00625d;color:#fff;font-weight:900}.receipt{position:relative;width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:7mm 8mm 18mm}.receiptTitle{text-align:center;margin:2mm 0 8mm}.receiptTitle h1{margin:0;color:#004a48;font-size:7mm}.receiptTitle p{margin:2mm 0 0;color:#555;font-size:3mm}.receiptBadge{display:block;width:max-content;margin:0 auto 8mm;padding:2.2mm 10mm;background:#004a48;color:#fff;border-left:2mm solid #e1a500;font-size:3.5mm;font-weight:1000}.grid{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-bottom:7mm}.box{border:.3mm solid #d9e4e2;border-radius:3mm;padding:5mm;background:#fbfefd;min-height:19mm}.box small{display:block;color:#667;margin-bottom:1.4mm;font-size:2.6mm;font-weight:900;text-transform:uppercase}.box b{font-size:4mm;color:#102b2a}.amount{border-radius:3mm;padding:7mm;background:#062b29;color:#fff;display:flex;justify-content:space-between;align-items:center;margin:7mm 0}.amount span{font-size:3.3mm;color:#d7eee9}.amount b{font-size:8mm}.foot{display:grid;grid-template-columns:1fr 1fr;gap:18mm;margin-top:16mm}.sign{border-top:.3mm solid #222;text-align:center;padding-top:3mm;color:#333;font-weight:900;font-size:3mm}@media print{body{background:#fff}.toolbar{display:none}.receipt{margin:0;width:210mm;min-height:297mm}}</style></head><body><div class="toolbar"><button onclick="window.print()">Imprimer / PDF</button><button onclick="window.close()">Fermer</button></div><main class="receipt">${globalPrintHeaderHTML(company,'REÇU OFFICIEL D’ABONNEMENT')}<div class="receiptTitle"><h1>REÇU OFFICIEL D’ABONNEMENT</h1><p>Référence : <b>${esc(ref)}</b></p></div><div class="receiptBadge">REÇU DE PAIEMENT</div><div class="grid"><div class="box"><small>Entreprise</small><b>${esc(company.name||'')}</b></div><div class="box"><small>Responsable</small><b>${esc(company.owner||'')}</b></div><div class="box"><small>Plan payé</small><b>${plan}</b></div><div class="box"><small>Date du paiement</small><b>${esc(dt)}</b></div><div class="box"><small>Statut</small><b>${esc(p.status||'Payé')}</b></div><div class="box"><small>Moyen / observation</small><b>${esc(p.method||'-')}</b></div></div><div class="amount"><span>Montant reçu</span><b>${money(p.amount||0)}</b></div><div class="foot"><div class="sign">Signature client</div><div class="sign">Cachet / Signature GLOBAL MARKET</div></div>${globalPrintFooterHTML(company,'Reçu d’abonnement')}</main></body></html>`;
  const w=window.open('','_blank'); if(!w){alert('Autorisez les popups pour imprimer le reçu.');return;} w.document.open(); w.document.write(html); w.document.close(); setTimeout(()=>w.focus(),200);
}

function showSubscriptionPage(){
  const {d,user,company}=current(); if(!user||user.role!=='admin') return alert('Accès réservé à l’administrateur entreprise.');
  const users=(d.users||[]).filter(u=>u.companyId===company.id); const info=getSubscriptionInfo(company,users);
  const payments=(d.payments||[]).filter(p=>p.companyId===company.id);
  shell(`<section class="section active"><div class="g2panel subscriptionHero"><div><h2><span></span> Mon abonnement</h2><p class="sub">Espace client entreprise : suivi de l’abonnement, renouvellement, support et fonctionnalités actives.</p></div></div>${accountNav('subscription')}
  <div class="subscriptionGrid">
    <div class="subCard"><small>Type d’abonnement</small><b>${esc(planDef(company).label)}</b></div>
    <div class="subCard"><small>Statut</small><b>${esc(planStatusText(company))}</b></div>
    <div class="subCard"><small>Date d’activation</small><b>${esc(company.subscriptionStart||company.createdAt||'')}</b></div>
    <div class="subCard"><small>Date d’expiration</small><b>${esc(company.subscriptionEnd||'')}</b></div>
    <div class="subCard"><small>Nombre d’utilisateurs</small><b>${info.users}</b></div>
    <div class="subCard"><small>Durée restante</small><b>${info.left} jour(s)</b></div>
  </div>
  ${availableSubscriptionPlansHTML()}
  <div class="g2panel"><h3>Historique paiements</h3><table class="g2table"><tr><th>Date</th><th>Référence</th><th>Plan</th><th>Montant</th><th>Statut</th><th>Reçu</th></tr>${payments.map(p=>`<tr><td>${esc(p.date||'')}</td><td>${esc(p.ref||p.id||'')}</td><td>${esc(p.plan||company.plan||'')}</td><td>${money(p.amount||0)}</td><td>${esc(p.status||'Payé')}</td><td><button class="btn2" onclick="printPlanPaymentReceipt('${p.id}')">Tirer le reçu</button></td></tr>`).join('')||'<tr><td colspan="6">Aucun paiement enregistré pour le moment.</td></tr>'}</table></div>
  <div class="subscriptionActions subscriptionSupportOnly"><button class="supportContactBtn" onclick="openSupportWhatsApp()">Contacter le support</button></div></section>`,'account');
}


function marketplaceSourceItems(d,cid){return (d.items||[]).filter(i=>i.companyId===cid);}
function marketplaceVisibleItems(d,cid){return marketplaceSourceItems(d,cid).filter(i=>!i.marketplaceHidden);}
function showMarketplacePage(){if(isCaisse()) return alert('Accès interdit : la caisse ne peut pas administrer la marketplace.');
  const {d,user,company}=current();
  if(!user){showGlobalBusinessLogin();return;}
  if(!assertPlanFeature(company,'marketplace','Marketplace disponible avec les plans Free et Business.')) return renderDash('home');
  const cid=company.id;
  d.orders=d.orders||[]; save(d);
  const items=marketplaceSourceItems(d,cid);
  const visible=marketplaceVisibleItems(d,cid);
  const hidden=items.filter(i=>i.marketplaceHidden);
  const products=visible.filter(i=>isBoutiqueItem(i));
  const orders=d.orders.filter(o=>o.companyId===cid&&!o.adminDeleted).slice().reverse();
  const recentItems=visible.slice().reverse().slice(0,8);
  const totalStock=products.reduce((a,b)=>a+(b.stockType==='unlimited'?0:Number(b.stock||0)),0);
  const caOrders=orders.reduce((a,b)=>a+Number(b.total||0),0);
  const active=window.marketplaceAdminSection||'stock';
  const pageTitle=active==='preview'?'Aperçu boutique client':(active==='stock'?'Produits / services du stock général':(active==='recent'?'Produits récents':'Commandes récentes'));
  let pageHtml='';
  if(active==='stock'){
    pageHtml=`<div class="mkPanel mkAdminSinglePage" id="marketFormPanel">
      <h2>Produits / services du stock général</h2>
      <p class="sub">Choisissez ce que le client peut voir dans la boutique publique. Masqué = invisible côté client.</p>
      <div class="mkCatalogTop"><input class="marketSearch" id="marketSearchAdmin" placeholder="Rechercher dans le stock général..." oninput="filterMarketAdminRows()"><select id="marketVisibilityFilter" onchange="filterMarketAdminRows()"><option value="">Tous</option><option value="visible">Visibles</option><option value="hidden">Masqués</option></select></div>
      <div class="marketStockRows">${items.map(i=>marketAdminRow(i)).join('')||'<p class="notice">Aucun produit ou service enregistré. Ajoutez d’abord vos articles dans la section Stocks.</p>'}</div>
    </div>`;
  }else if(active==='preview'){
    pageHtml=`<div class="mkPanel mkAdminSinglePage mkCatalogPanel">
      <div class="mkCatalogTop"><h2>Aperçu boutique client</h2><input class="marketSearch" id="marketSearch" placeholder="Rechercher un produit visible..." oninput="filterMarketCards()"><select><option>Plus récents</option><option>Prix croissant</option><option>En ligne</option></select></div>
      <div class="marketCatalog mkCatalogCards">${visible.map(i=>marketItemCard(i)).join('')||'<p class="notice">Aucun article visible dans la boutique client.</p>'}</div>
    </div>`;
  }else if(active==='recent'){
    pageHtml=`<div class="mkPanel mkAdminSinglePage">
      <div class="mkPanelHead"><h2>Produits récents</h2><a onclick="showMarketplaceAdminPage('stock')">Voir le stock général</a></div>
      <div class="mkRecentList mkRecentPageList">${recentItems.map(i=>marketRecentRow(i)).join('')||'<p class="notice">Aucun article visible. Rendez visibles les éléments du stock général.</p>'}</div>
    </div>`;
  }else{
    pageHtml=`<div class="mkPanel mkAdminSinglePage mkOrdersPanel">
      <div class="mkPanelHead"><h2>Commandes récentes</h2><a onclick="showMarketplaceAdminPage('stock')">Retour stock</a></div>
      <table class="mkOrdersTable"><tr><th>N° COMMANDE</th><th>CLIENT</th><th>ARTICLES</th><th>MONTANT</th><th>STATUT</th><th>DATE</th><th>ACTION</th></tr>${orders.map(o=>`<tr><td><button class="orderLinkBtn" onclick="openMarketplaceOrderPopup('${esc(o.id||'CMD')}',true)">#${esc(o.id||'CMD')}</button></td><td><b>${esc(o.client||'Client')}</b><br><small>${esc(o.clientPhone||'')}${o.clientEmail?' · '+esc(o.clientEmail):''}</small></td><td>${orderItemsCount(o)} article(s)</td><td>${money(orderTotal(o))}</td><td><span class="mkStatus">${esc(orderMainStatus(o))}</span></td><td>${new Date(o.date).toLocaleDateString('fr-FR')}</td><td><button class="danger smallDeleteOrder" onclick="deleteMarketplaceOrder('${esc(o.id||'CMD')}',true)">Supprimer</button></td></tr>`).join('')||'<tr><td colspan="7">Aucune commande récente.</td></tr>'}</table>
    </div>`;
  }
  shell(`<section class="section active marketplacePage marketplaceClean">
    <div class="mkTopHero compactMarketHeader mkHeaderSimple">
      <div class="mkBrandBlock">
        <div class="mkLogoRound">GG</div>
        <div><h1>Marketplace</h1></div>
      </div>
      <div class="mkHeroBtns mkHeroBtnsHorizontal"><button onclick="openPublicShop()">Voir boutique publique</button><button class="payConfigBtn" onclick="openMarketplacePaymentConfig()">Configurer paiement</button><button class="deliveryConfigBtn" onclick="openMarketplaceDeliveryConfig()">Livraison & expédition</button><button class="clientReportBtn" onclick="openMarketplaceClientsReport()">Mes clients enregistrés</button><button class="darkBtn" onclick="shareText('${marketplaceUrl(company)}')">Partager le lien</button></div>
    </div>

    <div class="mkStatsRow">
      <div><i>👁</i><small>Vues boutique</small><b>2 458</b><span>+18% ce mois</span></div>
      <div><i>📦</i><small>Articles visibles</small><b>${visible.length}</b><span>Masqués : ${hidden.length}</span></div>
      <div><i>🛒</i><small>Commandes</small><b>${orders.length}</b><span>+${Math.min(12,orders.length)} ce mois</span></div>
      <div><i>💼</i><small>Chiffre d’affaires</small><b>${money(caOrders)}</b><span>Marketplace</span></div>
      <div><i>⭐</i><small>Avis clients</small><b>4.8/5</b><span>★★★★★</span></div>
      <div><i>🧺</i><small>Stock général visible</small><b>${totalStock}</b><span>produits</span></div>
    </div>

    <div class="mkSectionButtons mkSectionButtonsFour">
      <button class="${active==='preview'?'active':''}" onclick="showMarketplaceAdminPage('preview')">Aperçu boutique client</button>
      <button class="${active==='stock'?'active':''}" onclick="showMarketplaceAdminPage('stock')">Produits / services du stock général</button>
      <button class="${active==='recent'?'active':''}" onclick="showMarketplaceAdminPage('recent')">Produits récents</button>
      <button class="${active==='orders'?'active':''}" onclick="showMarketplaceAdminPage('orders')">Commandes récentes</button>
    </div>

    <div class="mkPageTitle"><h2>${pageTitle}</h2></div>
    <div class="mkSinglePageWrap">${pageHtml}</div>
  </section>`,'marketplace');
}
function showMarketplaceAdminPage(type){window.marketplaceAdminSection=type||'stock'; showMarketplacePage();}
function mkProductVisual(i){if(i&&i.photo){return `<img loading="lazy" decoding="async" src="${esc(i.photo)}" alt="${esc(i.name||'Article')}" class="mkProductPhoto">`;} const n=(i.name||'').toLowerCase(); if(n.includes('imprim')) return '🖨️'; if(n.includes('souris')) return '🖱️'; if(n.includes('clé')||n.includes('usb')) return '💾'; if(n.includes('casque')||n.includes('audio')) return '🎧'; if(n.includes('montre')) return '⌚'; if(n.includes('phone')||n.includes('portable')||n.includes('laptop')||n.includes('ordinateur')) return '💻'; if(!isBoutiqueItem(i)) return '🛠️'; return '📦'}
function itemMarketPrice(i){return Number(i.sell||i.price||0)}
function marketStockLabel(i){return isBoutiqueItem(i)?(i.stockType==='unlimited'?'Stock illimité':'Stock : '+Number(i.stock||0)):'Service disponible'}
function marketRecentRow(i){const rupture=(isBoutiqueItem(i)&&i.stockType!=='unlimited'&&Number(i.stock||0)<=0); return `<div class="mkRecentRow"><div class="mkThumb">${mkProductVisual(i)}</div><div><b>${esc(i.name)}</b><small>${esc(i.cat||'Sans catégorie')}</small></div><strong>${money(itemMarketPrice(i))}<small>${marketStockLabel(i)}</small></strong><span class="${rupture?'mkRupture':'mkOnline'}">${rupture?'RUPTURE':'VISIBLE'}</span><button class="miniBtn" onclick="toggleMarketplaceVisibility('${i.id}')">${i.marketplaceHidden?'👁':'🚫'}</button></div>`}
function marketItemCard(i){const rupture=(isBoutiqueItem(i)&&i.stockType!=='unlimited'&&Number(i.stock||0)<=0); return `<div class="marketCard mkProductCard" data-search="${esc((i.name+' '+i.cat+' '+i.type+' '+(i.marketplacePromo||'')+' '+(i.marketplaceDesc||i.detail||'')).toLowerCase())}">${i.marketplacePromo?`<div class="mkPromoBadge">${esc(i.marketplacePromo)}</div>`:''}<div class="mkProductImg">${mkProductVisual(i)}</div><h3>${esc(i.name)}</h3><p>${esc(i.cat||'Sans catégorie')}</p><em class="mkCardDesc">${esc(i.marketplaceDesc||i.detail||'')}</em><div class="mkStars">★ 4.8 <small>(20)</small></div><b>${money(itemMarketPrice(i))}</b><small>${marketStockLabel(i)}</small><span class="${rupture?'mkRupture':'mkOnline'}">${rupture?'RUPTURE':'VISIBLE CLIENT'}</span><div class="marketCardActions"><button onclick="fakeCustomerOrder('${i.id}')">🛒</button><button class="btn2" onclick="toggleMarketplaceVisibility('${i.id}')">Masquer</button></div></div>`}
function marketAdminRow(i){const hidden=!!i.marketplaceHidden; const rupture=(isBoutiqueItem(i)&&i.stockType!=='unlimited'&&Number(i.stock||0)<=0); return `<div class="mkRecentRow marketAdminRow" data-hidden="${hidden?'hidden':'visible'}" data-search="${esc((i.name+' '+i.cat+' '+i.code+' '+i.type+' '+(i.marketplaceDesc||i.detail||'')).toLowerCase())}"><div class="mkThumb">${mkProductVisual(i)}</div><div><b>${esc(i.name)}</b><small>${esc(i.code||'')} • ${esc(i.cat||'Sans catégorie')} • ${isBoutiqueItem(i)?'Produit':'Service'}</small></div><strong>${money(itemMarketPrice(i))}<small>${marketStockLabel(i)}</small></strong><span class="${hidden?'mkRupture':(rupture?'mkRupture':'mkOnline')}">${hidden?'MASQUÉ':(rupture?'RUPTURE':'VISIBLE')}</span><button class="miniBtn" onclick="toggleMarketplaceVisibility('${i.id}')">${hidden?'Afficher':'Masquer'}</button><button class="miniBtn" onclick="editMarketplaceInfo('${i.id}')">Promo</button></div>`}
function filterMarketAdminRows(){const q=($('#marketSearchAdmin')?.value||'').toLowerCase(); const f=$('#marketVisibilityFilter')?.value||''; document.querySelectorAll('.marketAdminRow').forEach(r=>{const okSearch=r.dataset.search.includes(q); const okFilter=!f||r.dataset.hidden===f; r.style.display=(okSearch&&okFilter)?'flex':'none';});}
function toggleMarketplaceVisibility(iid){const {d,company}=current(); const it=(d.items||[]).find(i=>i.id===iid&&i.companyId===company.id); if(!it) return; it.marketplaceHidden=!it.marketplaceHidden; save(d); showMarketplacePage();}
async function editMarketplaceInfo(iid){const {d,company}=current(); const it=(d.items||[]).find(i=>i.id===iid&&i.companyId===company.id); if(!it) return; const promo=await g3Prompt('Badge / promotion visible en boutique client :',it.marketplacePromo||'','Promotion marketplace'); if(promo===null) return; const desc=await g3Prompt('Description courte visible en boutique client :',it.marketplaceDesc||it.detail||'','Description marketplace'); if(desc===null) return; it.marketplacePromo=promo||''; it.marketplaceDesc=desc||''; save(d); showMarketplacePage();}

function marketplaceOrderBenefit(d,o){
  return normalizeOrderItems(o).reduce((sum,line)=>{
    const it=(d.items||[]).find(x=>x.id===line.itemId&&x.companyId===o.companyId);
    const total=Number(line.total||0); const qty=Number(line.qty||1);
    const product=isBoutiqueItem(it||{type:line.type});
    const charges=product?Number(it?.buy||0)*qty:total*(Number(it?.charge||0)/100);
    return sum+(total-charges);
  },0);
}
function openMarketplaceClientsReport(){
  const {d,company}=current(); const cid=company.id;
  const clients=(d.marketClients||[]).filter(c=>c.companyId===cid);
  const allOrders=(d.orders||[]).filter(o=>o.companyId===cid&&!o.adminDeleted);
  const orders=allOrders.filter(o=>!isMarketplaceOrderCancelled(o));
  const stats=clients.map(c=>{
    const os=orders.filter(o=>o.clientId===c.id);
    const ca=os.reduce((a,o)=>a+orderTotal(o),0);
    const benef=os.reduce((a,o)=>a+marketplaceOrderBenefit(d,o),0);
    const articles=os.reduce((a,o)=>a+orderItemsCount(o),0);
    const last=os[0]?.date?new Date(os.sort((a,b)=>new Date(b.date)-new Date(a.date))[0].date).toLocaleDateString('fr-FR'):'-';
    return {c,os,ca,benef,articles,last};
  }).sort((a,b)=>b.ca-a.ca);
  const totalCa=stats.reduce((a,x)=>a+x.ca,0), totalBenef=stats.reduce((a,x)=>a+x.benef,0), totalOrders=orders.length;
  const rows=stats.map((x,i)=>`<tr class="clientReportRow rank${i<3?i+1:'Other'}"><td>${i+1}</td><td><b>${esc(x.c.name)}</b><small>${esc(x.c.phone||'')} ${x.c.email?'— '+esc(x.c.email):''}</small></td><td>${new Date(x.c.createdAt||Date.now()).toLocaleDateString('fr-FR')}</td><td>${x.os.length}</td><td>${x.articles}</td><td>${money(x.ca)}</td><td>${money(x.benef)}</td><td>${x.last}</td><td><button class="btn2" onclick="openClientPurchaseDetails('${esc(x.c.id)}')">Détails achats</button></td></tr>`).join('')||'<tr><td colspan="9">Aucun client enregistré.</td></tr>';
  const html=`<div class="marketPayModalBackdrop" id="marketClientsReportModal"><div class="marketPayModal clientsReportBox"><button class="marketPayClose" onclick="document.getElementById('marketClientsReportModal')?.remove()">×</button><h2>Rapport général des clients et leurs achats</h2><div class="clientReportStats"><div><small>Clients</small><b>${clients.length}</b></div><div><small>Commandes</small><b>${totalOrders}</b></div><div><small>Chiffre d’affaires</small><b>${money(totalCa)}</b></div><div><small>Bénéfice estimé</small><b>${money(totalBenef)}</b></div></div><p class="sub">Classement automatique par chiffre d’affaires client. Les commandes annulées ne sont pas comptées dans les totaux.</p><div class="clientOrdersScroll"><table class="mkOrdersTable clientReportTable"><tr><th>Rang</th><th>Client</th><th>Inscription</th><th>Lots</th><th>Articles</th><th>Chiffre d’affaires</th><th>Bénéfice estimé</th><th>Dernier achat</th><th>Détail</th></tr>${rows}</table></div><div class="marketPayActions"><button onclick="printMarketplaceClientsReportOnly()">Imprimer</button><button class="btn2" onclick="document.getElementById('marketClientsReportModal')?.remove()">Fermer</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}

function printMarketplaceClientsReportOnly(){
  const modal=document.getElementById('marketClientsReportModal');
  const table=modal?.querySelector('.clientReportTable');
  if(!table) return alert('Aucune liste de clients à imprimer.');
  const cleanTable=table.cloneNode(true);
  cleanTable.querySelectorAll('tr').forEach(tr=>{const cells=tr.children;if(cells.length){cells[cells.length-1].remove();}});
  const {company}=current();
  const w=window.open('','_blank');
  if(!w) return alert('Autorisez les fenêtres popup pour imprimer.');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Liste des clients enregistrés</title><style>${globalPrintThemeStyles('landscape')}@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#fff;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{position:fixed;top:10px;right:10px;z-index:20;display:flex;gap:8px}.toolbar button{border:0;border-radius:10px;padding:10px 14px;font-weight:900;cursor:pointer;background:#0f766e;color:#fff}.page{position:relative;width:297mm;min-height:210mm;padding:6mm 7mm 18mm;margin:0 auto}.pageTitle{text-align:center;margin:0 0 5mm}.pageTitle h1{margin:0;color:#0f766e;font-size:6mm;text-transform:uppercase}.pageTitle h2{margin:1.5mm 0 0;font-size:3.2mm;color:#334155}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:2.45mm}th{background:#0f766e;color:#fff;padding:2.2mm 1mm;border:.25mm solid #0b5f59;text-align:center}td{padding:2mm 1mm;border:.25mm solid #cbd5e1;text-align:center;word-break:break-word;color:#111827!important;font-weight:700}td:nth-child(2),th:nth-child(2){text-align:left;width:22%}tr:nth-child(even) td{background:#f5faf9!important}small{display:block;color:#334155!important;font-weight:700;margin-top:.8mm}@media print{.toolbar{display:none}.page{margin:0;width:297mm;min-height:210mm}.g3pf{left:7mm;right:7mm}}</style></head><body><div class="toolbar"><button onclick="window.print()">Imprimer</button><button onclick="window.close()">Fermer</button></div><main class="page">${globalPrintHeaderHTML(company,'RAPPORT GÉNÉRAL DES CLIENTS ET DE LEURS ACHATS')}<div class="pageTitle"><h1>Rapport général des clients et leurs achats</h1><h2>Liste des clients enregistrés seulement</h2></div>${cleanTable.outerHTML}${globalPrintFooterHTML(company,'Rapport clients')}</main></body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),300);
}

function openClientPurchaseDetails(clientId){
  const {d,company}=current(); const client=(d.marketClients||[]).find(c=>c.id===clientId&&c.companyId===company.id); if(!client) return;
  const orders=(d.orders||[]).filter(o=>o.companyId===company.id&&o.clientId===clientId).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const rows=orders.map(o=>`<tr class="${isMarketplaceOrderCancelled(o)?'cancelledOrderLine':'activeOrderLine'}"><td><button class="orderLinkBtn" onclick="openMarketplaceOrderPopup('${esc(o.id)}',true)">#${esc(o.id)}</button></td><td>${new Date(o.date).toLocaleString('fr-FR')}</td><td>${orderItemsCount(o)} article(s)</td><td>${money(orderTotal(o))}</td><td>${isMarketplaceOrderCancelled(o)?'Non compté':money(marketplaceOrderBenefit(d,o))}</td><td>${esc(o.paymentMethod||'-')}</td><td><span class="${isMarketplaceOrderCancelled(o)?'cancelledBadge':'activeBadge'}">${esc(orderMainStatus(o))}</span></td></tr>`).join('')||'<tr><td colspan="7">Aucun achat.</td></tr>';
  const html=`<div class="marketPayModalBackdrop" id="clientPurchaseDetailsModal"><div class="marketPayModal clientPurchaseDetailsBox"><button class="marketPayClose" onclick="document.getElementById('clientPurchaseDetailsModal')?.remove()">×</button><h2>Détails achats client</h2><p><b>${esc(client.name)}</b><br>Téléphone : ${esc(client.phone||'-')}<br>Email : ${esc(client.email||'-')}</p><div class="clientOrdersScroll"><table class="mkOrdersTable"><tr><th>N° commande</th><th>Date</th><th>Articles</th><th>Montant</th><th>Bénéfice</th><th>Paiement</th><th>Statut</th></tr>${rows}</table></div><div class="marketPayActions"><button class="btn2" onclick="document.getElementById('clientPurchaseDetailsModal')?.remove()">Fermer</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}

function openMarketplacePaymentConfig(){
  const {company}=current();
  const wave=company.marketWaveBusinessLink||'';
  const usdt=company.marketUsdtTrc20||'';
  const html=`<div class="marketPayModalBackdrop" id="marketPayModal"><div class="marketPayModal"><button class="marketPayClose" onclick="closeMarketplacePaymentConfig()">×</button><h2>Configurer paiement Marketplace</h2><p>Ces informations seront utilisées côté boutique client pour faciliter le paiement des commandes.</p><label>Lien Wave Business<input id="marketWaveBusinessLink" placeholder="Ex : lien Wave Business" value="${esc(wave)}"></label><small>Le montant de la commande sera ajouté automatiquement au lien pour afficher le QR code de paiement au client.</small><label>Adresse USDT TRC20<input id="marketUsdtTrc20" placeholder="Adresse USDT TRC20" value="${esc(usdt)}"></label><div class="marketPayActions"><button onclick="saveMarketplacePaymentConfig()">Enregistrer</button><button class="btn2" onclick="closeMarketplacePaymentConfig()">Fermer</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function closeMarketplacePaymentConfig(){document.getElementById('marketPayModal')?.remove();}
function saveMarketplacePaymentConfig(){
  const {d,company}=current();
  const c=(d.companies||[]).find(x=>x.id===company.id);
  if(!c) return;
  c.marketWaveBusinessLink=($('#marketWaveBusinessLink')?.value||'').trim();
  c.marketUsdtTrc20=($('#marketUsdtTrc20')?.value||'').trim();
  save(d); closeMarketplacePaymentConfig(); alert('Paramètres de paiement Marketplace enregistrés.'); showMarketplacePage();
}
function buildWavePaymentLink(link,amount){
  link=(link||'').trim(); amount=Number(amount||0);
  if(!link) return '';
  if(link.includes('{amount}')) return link.replaceAll('{amount}',String(amount));
  if(link.includes('MONTANT')) return link.replaceAll('MONTANT',String(amount));
  const sep=link.includes('?')?'&':'?';
  return link+sep+'amount='+encodeURIComponent(String(amount));
}
function getPublicClient(companyId){
  const cid=window.publicShopClientId||'';
  if(!cid) return null;
  const d=seed();
  return (d.marketClients||[]).find(c=>c.id===cid&&c.companyId===companyId)||null;
}

function getPublicCart(companyId){
  window.publicShopCart=window.publicShopCart||{};
  window.publicShopCart[companyId]=window.publicShopCart[companyId]||[];
  return window.publicShopCart[companyId];
}
function publicCartCount(companyId){return getPublicCart(companyId).reduce((a,x)=>a+Number(x.qty||0),0)}
function showPublicToast(msg){
  document.querySelector('.publicToast')?.remove();
  const div=document.createElement('div');
  div.className='publicToast';
  div.textContent=msg;
  document.body.appendChild(div);
  setTimeout(()=>div.remove(),2000);
}
async function addToPublicCart(companyId,itemId){
  const d=seed(); const it=(d.items||[]).find(x=>x.id===itemId&&x.companyId===companyId&&!x.marketplaceHidden);
  if(!it) return alert('Article introuvable.');
  const qty=isBoutiqueItem(it)?Math.max(1,Number(await g3Prompt('Quantité à ajouter au panier :','1','Quantité panier')||1)):1;
  const cart=getPublicCart(companyId); const line=cart.find(x=>x.itemId===itemId);
  if(line) line.qty=Number(line.qty||0)+qty; else cart.push({itemId,qty});
  refreshPublicCartBadge(companyId);
  showPublicToast('Commande ajouter au panier');
}
function refreshPublicCartBadge(companyId){const b=document.getElementById('publicCartBadge'); if(b) b.textContent=publicCartCount(companyId);}
function deliveryFeeRateForSubtotal(subtotal){
  const amount=Math.max(0,Number(subtotal||0));
  if(amount<=0) return 0;
  if(amount<=4999) return 0.10;
  if(amount<=24999) return 0.05;
  if(amount<=99999) return 0.02;
  return 0.015;
}
function publicCartPricing(companyId){
  const subtotal=publicCartTotal(companyId);
  const deliveryRate=deliveryFeeRateForSubtotal(subtotal);
  const deliveryFee=Math.round(subtotal*deliveryRate);
  return {subtotal,deliveryRate,deliveryFee,total:subtotal+deliveryFee};
}
function deliveryRateLabel(rate){
  const value=Number(rate||0)*100;
  return `${Number.isInteger(value)?value:value.toFixed(1).replace('.',',')} %`;
}
function openPublicCart(companyId){
  document.getElementById('publicCartModal')?.remove();
  const d=seed(); const cart=getPublicCart(companyId); const client=getPublicClient(companyId);
  const clientName=client?.name||''; const clientPhone=client?.phone||'';
  const rows=cart.map((line,idx)=>{const it=(d.items||[]).find(x=>x.id===line.itemId&&x.companyId===companyId); if(!it) return ''; const price=itemMarketPrice(it), total=price*Number(line.qty||1); return `<tr><td>${idx+1}</td><td>${esc(it.name)}</td><td>${esc(it.cat||'-')}</td><td><input class="cartQtyInput" type="number" min="1" value="${Number(line.qty||1)}" onchange="updatePublicCartQty('${companyId}','${line.itemId}',this.value)"></td><td>${money(price)}</td><td><b>${money(total)}</b></td><td><button class="miniDanger" onclick="removePublicCartItem('${companyId}','${line.itemId}')">Retirer</button></td></tr>`}).join('');
  const pricing=publicCartPricing(companyId);
  const html=`<div class="marketPayModalBackdrop publicOrderBackdrop" id="publicCartModal"><div class="marketPayModal publicCartBox publicOrderForm"><button class="marketPayClose" onclick="document.getElementById('publicCartModal')?.remove()">×</button>
    <div class="publicOrderHeader"><div><span>VALIDATION DE LA COMMANDE</span><h2>Mon panier</h2><p class="sub">Vérifiez les articles, les frais de livraison et choisissez votre mode de paiement.</p></div><div class="publicOrderSecure">🔒 Commande sécurisée</div></div>
    <section class="publicOrderSection"><h3>1. Articles commandés</h3><div class="clientOrdersScroll publicOrderTableScroll"><table class="mkOrdersTable"><tr><th>N°</th><th>Produit / Service</th><th>Catégorie</th><th>Qté</th><th>Prix</th><th>Total</th><th>Action</th></tr>${rows||'<tr><td colspan="7">Panier vide.</td></tr>'}</table></div></section>
    <section class="publicOrderSection publicCustomerSection"><h3>2. Informations du client</h3><div class="publicCustomerFields"><label>Nom du client *<input id="publicOrderClientName" autocomplete="name" value="${esc(clientName)}" placeholder="Nom et prénoms"></label><label>Contact du client *<input id="publicOrderClientPhone" autocomplete="tel" inputmode="tel" value="${esc(clientPhone)}" placeholder="Ex : 0700000000"></label></div><p class="publicCustomerHelp">Aucun compte client n’est nécessaire pour passer la commande.</p></section>
    <div class="publicCheckoutGrid">
      <section class="publicOrderSection"><h3>3. Récapitulatif</h3><div class="publicPricingSummary"><div><span>Sous-total des articles</span><b>${money(pricing.subtotal)}</b></div><div><span>Frais de livraison (${deliveryRateLabel(pricing.deliveryRate)})</span><b>${money(pricing.deliveryFee)}</b></div><div class="grandTotal"><span>Total à payer</span><b>${money(pricing.total)}</b></div></div><details class="deliveryFeeDetails"><summary>Voir le barème des frais de livraison</summary><p>5 à 4 999 F : 10 % · 5 000 à 24 999 F : 5 % · 25 000 à 99 999 F : 2 % · 100 000 F et plus : 1,5 %.</p></details></section>
      <section class="publicOrderSection"><h3>4. Mode de paiement</h3><div class="checkoutTimingChoices"><button type="button" class="active" data-checkout-timing="delivery" onclick="selectPublicCheckoutMode('${companyId}','delivery')"><span>🚚</span><b>Payer à la livraison</b><small>Réglez lorsque votre commande vous est remise.</small></button><button type="button" data-checkout-timing="now" onclick="selectPublicCheckoutMode('${companyId}','now')"><span>⚡</span><b>Payer maintenant</b><small>Utilisez Wave ou USDT TRC20.</small></button></div><div id="publicCartPayBox" class="publicPaymentChoiceBox checkoutPaymentPanel"><div class="deliveryPaymentNotice"><span>🚚</span><div><b>Paiement à la livraison</b><p>Aucun identifiant de transaction n’est requis.</p></div></div><button class="paidBtn deliveryValidateBtn" onclick="finalizePublicCartPayment('${companyId}','PAIEMENT À LA LIVRAISON')" ${cart.length?'':'disabled'}>Valider ma commande</button></div></section>
    </div>
    <div class="marketPayActions publicOrderFooter"><button onclick="document.getElementById('publicCartModal')?.remove()">Continuer mes achats</button><button class="btn2" onclick="getPublicCart('${companyId}').length=0;openPublicCart('${companyId}');refreshPublicCartBadge('${companyId}')">Vider le panier</button></div>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function updatePublicCartQty(companyId,itemId,qty){const cart=getPublicCart(companyId); const line=cart.find(x=>x.itemId===itemId); if(line) line.qty=Math.max(1,Number(qty||1)); openPublicCart(companyId); refreshPublicCartBadge(companyId);}
function removePublicCartItem(companyId,itemId){const cart=getPublicCart(companyId); const i=cart.findIndex(x=>x.itemId===itemId); if(i>=0) cart.splice(i,1); openPublicCart(companyId); refreshPublicCartBadge(companyId);}
function publicCartTotal(companyId){
  const d=seed(); const cart=getPublicCart(companyId);
  return cart.reduce((sum,line)=>{const it=(d.items||[]).find(x=>x.id===line.itemId&&x.companyId===companyId); return sum+(it?itemMarketPrice(it)*Number(line.qty||1):0)},0);
}
function fcfaToUsdt(total){return (Number(total||0)/600).toFixed(2);}
function selectPublicCheckoutMode(companyId,mode){
  document.querySelectorAll('[data-checkout-timing]').forEach(btn=>btn.classList.toggle('active',btn.dataset.checkoutTiming===mode));
  const box=document.getElementById('publicCartPayBox'); if(!box) return;
  if(mode==='delivery'){
    box.innerHTML=`<div class="deliveryPaymentNotice"><span>🚚</span><div><b>Paiement à la livraison</b><p>Aucun identifiant de transaction n’est requis maintenant.</p></div></div><button class="paidBtn deliveryValidateBtn" onclick="finalizePublicCartPayment('${companyId}','PAIEMENT À LA LIVRAISON')">Valider ma commande</button>`;
    return;
  }
  box.innerHTML=`<div class="payNowIntro"><b>Choisissez le moyen de paiement</b><p>Le montant affiché comprend les frais de livraison.</p></div><div class="paymentChoiceBtns"><button onclick="payPublicCart('${companyId}','WAVE')">Payer avec Wave</button><button class="btn2" onclick="payPublicCart('${companyId}','USDT TRC20')">Payer en USDT TRC20</button></div><div class="transactionHelp">Après le paiement, inscrivez obligatoirement l’identifiant de la transaction.</div>`;
}
function payPublicCart(companyId,method){
  const d=seed(); const c=(d.companies||[]).find(x=>x.id===companyId); const cart=getPublicCart(companyId);
  if(!cart.length) return alert('Panier vide.');
  const pricing=publicCartPricing(companyId); const total=pricing.total;
  let content='';
  if(method==='WAVE'){
    const waveLink=buildWavePaymentLink(c?.marketWaveBusinessLink,total); const qr=waveLink?'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(waveLink):'';
    content=waveLink?`<div class="payQrBox"><img src="${qr}" alt="QR Code Wave"><a href="${esc(waveLink)}" target="_blank" rel="noopener">Ouvrir le paiement Wave</a><p>Montant total à payer : <b>${money(total)}</b></p></div>`:'<p class="notice">Lien Wave Business non configuré par le vendeur.</p>';
  }else{
    const usd=fcfaToUsdt(total);
    const payload=`USDT TRC20\nAdresse: ${c?.marketUsdtTrc20||''}\nMontant: ${usd} USD`; const qr=c?.marketUsdtTrc20?'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(payload):'';
    content=c?.marketUsdtTrc20?`<div class="payQrBox"><img src="${qr}" alt="QR Code USDT TRC20"><div class="usdtBox"><small>Adresse USDT TRC20</small><b>${esc(c.marketUsdtTrc20)}</b><small>Montant total à payer : ${usd} USD</small></div></div>`:'<p class="notice">Adresse USDT TRC20 non configurée par le vendeur.</p>';
  }
  const proof=`<div class="paymentProofBox transactionProofBox"><h3>Confirmation du paiement</h3><label>Identifiant de la transaction *<input id="publicTransactionId" autocomplete="off" placeholder="Ex : référence Wave ou TxID USDT"></label><label>Capture du paiement (facultatif)<input id="publicPayCapture" type="file" accept="image/*"></label><button class="paidBtn" onclick="finalizePublicCartPayment('${companyId}','${method}')">J’ai payé — Valider la commande</button></div>`;
  const box=document.getElementById('publicCartPayBox'); if(box) box.innerHTML=content+proof;
}
function readPaymentCaptureAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    if(!file) return resolve('');
    if(!String(file.type||'').startsWith('image/')) return reject(new Error('La capture doit être une image.'));
    if(Number(file.size||0)>500000) return reject(new Error('La capture dépasse 500 Ko. Réduisez sa taille avant de poursuivre.'));
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result||'');
    reader.onerror=()=>reject(reader.error||new Error('Lecture capture impossible'));
    reader.readAsDataURL(file);
  });
}
async function finalizePublicCartPayment(companyId,method){
  const d=seed(); const client=getPublicClient(companyId); const cart=getPublicCart(companyId);
  if(!client) return openClientRegisterPopup(companyId); if(!cart.length) return alert('Panier vide.');
  const payOnDelivery=method==='PAIEMENT À LA LIVRAISON';
  const transactionId=($('#publicTransactionId')?.value||'').trim(); const file=$('#publicPayCapture')?.files?.[0];
  if(!payOnDelivery&&!transactionId) return alert('Veuillez inscrire l’identifiant de la transaction.');
  let captureData='';
  if(file){
    try{captureData=await readPaymentCaptureAsDataUrl(file);}catch(e){return alert('Impossible de charger la capture de paiement.');}
  }
  d.orders=d.orders||[];
  const orderItems=[];
  for(const line of [...cart]){
    const it=(d.items||[]).find(x=>x.id===line.itemId&&x.companyId===companyId&&!x.marketplaceHidden); if(!it) continue;
    const qty=Number(line.qty||1); if(isBoutiqueItem(it)&&it.stockType!=='unlimited'&&Number(it.stock||0)<qty){ alert('Stock insuffisant pour : '+it.name); return; }
  }
  for(const line of [...cart]){
    const it=(d.items||[]).find(x=>x.id===line.itemId&&x.companyId===companyId&&!x.marketplaceHidden); if(!it) continue;
    const qty=Number(line.qty||1); if(isBoutiqueItem(it)&&it.stockType!=='unlimited') it.stock=Number(it.stock||0)-qty;
    const unit=itemMarketPrice(it); const amount=unit*qty;
    orderItems.push({itemId:it.id,item:it.name,category:it.cat||'',type:isBoutiqueItem(it)?'Produit':'Service',qty,unit,total:amount});
  }
  const subtotal=orderItems.reduce((a,x)=>a+Number(x.total||0),0);
  const deliveryFeeRate=deliveryFeeRateForSubtotal(subtotal);
  const deliveryFee=Math.round(subtotal*deliveryFeeRate);
  const total=subtotal+deliveryFee; const oid=id('cmd');
  d.orders.push({
    id:oid, companyId, clientId:client.id, client:client.name, clientPhone:client.phone, date:new Date().toISOString(),
    items:orderItems, item:orderItems.map(x=>x.item).join(', '), qty:orderItems.reduce((a,x)=>a+Number(x.qty||0),0), subtotal,deliveryFeeRate,deliveryFee,total,
    paymentMethod:method, paymentTiming:payOnDelivery?'delivery':'now', paymentStatus:payOnDelivery?'À payer à la livraison':'Paiement déclaré par le client',
    paymentCurrency:method==='USDT TRC20'?'USD':'FCFA', paymentAmount:method==='USDT TRC20'?fcfaToUsdt(total):total,
    transactionId:payOnDelivery?'':transactionId, paymentProofType:file?'capture':'transaction_id', paymentRef:payOnDelivery?'':transactionId,
    paymentCaptureName:file?(file.name||'capture'):'', paymentCaptureData:captureData,
    validationStatus:'En attente de validation', deliveryStatus:'En attente de validation', afterSaleStatus:'', delivery:'En attente de validation',
    source:'lot panier boutique client avec frais de livraison'
  });
  save(d); cart.length=0; refreshPublicCartBadge(companyId);
  showOrderSentModal(companyId);
}
function showOrderSentModal(companyId){
  document.querySelector('.orderSentModal')?.remove();
  const d=seed(); const c=(d.companies||[]).find(x=>x.id===companyId);
  const html=`<div class="marketPayModalBackdrop orderSentModal"><div class="marketPayModal orderSentBox"><h2>Commande Envoyée</h2><p>Votre commande a été envoyée au Marketplace administrateur.</p><button onclick="document.querySelector('.orderSentModal')?.remove();document.getElementById('publicCartModal')?.remove();renderPublicShop('${esc(c?.shopSlug||'')}')">OK</button></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function openClientRegisterPopup(companyId){
  const html=`<div class="marketPayModalBackdrop" id="clientRegisterModal"><div class="marketPayModal clientAuthModal"><button class="marketPayClose" onclick="document.getElementById('clientRegisterModal')?.remove()">×</button><h2>Inscription espace client</h2><p>Facultatif : créez un espace uniquement si vous souhaitez disposer d’un compte client.</p><label>Nom complet<input id="clientRegName" placeholder="Nom et prénom"></label><label>Téléphone<input id="clientRegPhone" placeholder="Ex : 0700000000"></label><label>Email<input id="clientRegEmail" placeholder="Email facultatif"></label><label>Mot de passe<input id="clientRegPass" type="password" placeholder="Créer un mot de passe"></label><div class="marketPayActions"><button onclick="savePublicClientRegister('${companyId}')">Créer mon espace client</button><button class="btn2" onclick="openClientLoginPopup('${companyId}')">J’ai déjà un compte</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function openClientLoginPopup(companyId){
  document.getElementById('clientRegisterModal')?.remove();
  document.getElementById('clientSpaceModal')?.remove();
  const html=`<div class="marketPayModalBackdrop" id="clientLoginModal"><div class="marketPayModal clientAuthModal"><button class="marketPayClose" onclick="document.getElementById('clientLoginModal')?.remove()">×</button><h2>Connexion espace client</h2><label>Téléphone<input id="clientLoginPhone" placeholder="Téléphone"></label><label>Mot de passe<input id="clientLoginPass" type="password" placeholder="Mot de passe"></label><div class="marketPayActions"><button onclick="loginPublicClient('${companyId}')">Ouvrir mon espace</button><button class="btn2" onclick="document.getElementById('clientLoginModal')?.remove();openClientRegisterPopup('${companyId}')">Inscription</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
async function savePublicClientRegister(companyId){
  const d=seed(); d.marketClients=d.marketClients||[];
  const name=($('#clientRegName')?.value||'').trim(), phone=($('#clientRegPhone')?.value||'').trim(), email=($('#clientRegEmail')?.value||'').trim(), pass=($('#clientRegPass')?.value||'').trim();
  if(!name||!phone||!pass) return alert('Nom, téléphone et mot de passe obligatoires.');
  if(pass.length<6) return alert('Le mot de passe doit contenir au moins 6 caractères.');
  if(d.marketClients.some(c=>c.companyId===companyId&&c.phone===phone)) return alert('Ce téléphone est déjà inscrit. Connectez-vous à votre espace client.');
  const client={id:id('clt'),companyId,name,phone,email,createdAt:new Date().toISOString()};
  await setObjectPassword(client,pass); d.marketClients.push(client); save(d); window.publicShopClientId=client.id;
  document.getElementById('clientRegisterModal')?.remove(); alert('Inscription réussie. Votre espace client est créé.'); renderPublicShop((d.companies||[]).find(c=>c.id===companyId)?.shopSlug||'');
}
async function loginPublicClient(companyId){
  const d=seed(); const phone=($('#clientLoginPhone')?.value||'').trim(), pass=($('#clientLoginPass')?.value||'').trim();
  const client=(d.marketClients||[]).find(c=>c.companyId===companyId&&c.phone===phone);
  if(!client||!(await verifyObjectPassword(client,pass))) return alert('Téléphone ou mot de passe incorrect.');
  window.publicShopClientId=client.id; document.getElementById('clientLoginModal')?.remove(); openClientSpace(companyId);
}
function openClientSpace(companyId){
  document.getElementById('clientSpaceModal')?.remove();
  const d=seed(); const c=(d.companies||[]).find(x=>x.id===companyId); const client=getPublicClient(companyId);
  if(!client) return openClientLoginPopup(companyId);
  const clientDeletedSet=new Set([...(client.deletedOrderIds||[]),...((d.clientDeletedOrders&&d.clientDeletedOrders[client.id])||[])]);
  const orders=(d.orders||[]).filter(o=>o.companyId===companyId&&o.clientId===client.id&&!((o.clientDeletedIds||[]).includes(client.id))&&!clientDeletedSet.has(o.id)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const rows=orders.map(o=>`<tr><td><button class="orderLinkBtn" onclick="openMarketplaceOrderPopup('${esc(o.id||'CMD')}',false)">#${esc(o.id||'CMD')}</button></td><td>${new Date(o.date).toLocaleDateString('fr-FR')}</td><td>${orderItemsCount(o)} article(s)</td><td>${money(orderTotal(o))}</td><td>${esc(o.paymentMethod||'Non choisi')}</td><td>${esc(orderMainStatus(o))}</td><td><button class="danger smallDeleteOrder" onclick="deleteMarketplaceOrder('${esc(o.id||'CMD')}',false)">Supprimer</button></td></tr>`).join('')||'<tr><td colspan="7">Aucune commande pour le moment.</td></tr>';
  const html=`<div class="marketPayModalBackdrop" id="clientSpaceModal"><div class="marketPayModal clientSpaceBox"><button class="marketPayClose" onclick="document.getElementById('clientSpaceModal')?.remove()">×</button><h2>Espace client</h2><p><b>${esc(client.name)}</b><br>${esc(client.phone)} ${client.email?'— '+esc(client.email):''}</p><h3>Historique / suivi de mes commandes</h3><div class="clientOrdersScroll"><table class="mkOrdersTable"><tr><th>N° LOT</th><th>Date</th><th>Articles</th><th>Total</th><th>Paiement</th><th>Statut</th><th>Action</th></tr>${rows}</table></div><div class="marketPayActions"><button onclick="document.getElementById('clientSpaceModal')?.remove()">Fermer</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}

function normalizeOrderItems(o){
  if(o&&Array.isArray(o.items)&&o.items.length) return o.items;
  if(!o) return [];
  return [{itemId:o.itemId||'',item:o.item||'Commande',category:o.category||'',type:o.type||'',qty:Number(o.qty||1),unit:Number(o.unit||0),total:Number(o.total||0)}];
}
function orderItemsCount(o){return normalizeOrderItems(o).reduce((a,x)=>a+Number(x.qty||1),0)}
function orderTotal(o){return Number(o?.total||normalizeOrderItems(o).reduce((a,x)=>a+Number(x.total||0),0)||0)}
function orderMainStatus(o){return marketplaceValidationValue(o)==='Annuler'?(o?.afterSaleStatus||'Annuler'):(o?.deliveryStatus||o?.validationStatus||o?.delivery||'En attente de validation')}
function isMarketplaceOrderCancelled(o){return marketplaceValidationValue(o)==='Annuler'||String(o?.validationStatus||o?.delivery||'').toLowerCase().includes('annul')||String(o?.afterSaleStatus||'').toLowerCase().includes('rembours');}
function openMarketplaceOrderPopup(orderId,isAdmin){
  document.getElementById('marketOrderDetailsModal')?.remove();
  const d=seed(); const o=(d.orders||[]).find(x=>String(x.id)===String(orderId));
  if(!o) return alert('Commande introuvable.');
  const items=normalizeOrderItems(o);
  const rows=items.map((it,i)=>`<tr><td>${i+1}</td><td>${esc(it.item||'Article')}</td><td>${esc(it.category||'-')}</td><td>${esc(it.type||'-')}</td><td>${Number(it.qty||1)}</td><td>${money(it.unit||0)}</td><td><b>${money(it.total||0)}</b></td></tr>`).join('');
  const valState=marketplaceValidationValue(o); const autoDelivery=marketplaceDeliveryByValidation(valState);
  const statusAdmin=isAdmin?`<div class="orderStatusGrid statusSelectColor"><label>Validation<select id="orderValidationStatus" onchange="toggleMarketplaceActionField()"><option value="En attente de validation" ${valState==='En attente de validation'?'selected':''}>En attente de validation</option><option value="Validée" ${valState==='Validée'?'selected':''}>Validée</option><option value="Terminer" ${valState==='Terminer'?'selected':''}>Terminer</option><option value="Annuler" ${valState==='Annuler'?'selected':''}>Annuler</option></select></label><label>Livraison<select id="orderDeliveryStatus" disabled><option ${autoDelivery==='Aucune action'?'selected':''}>Aucune action</option><option ${autoDelivery==='En cours de livraison'?'selected':''}>En cours de livraison</option><option ${autoDelivery==='Livrée'?'selected':''}>Livrée</option></select></label><label id="orderRefundActionBox" style="display:${valState==='Annuler'?'block':'none'}">Action<select id="orderAfterSaleStatus"><option value="En cours de remboursement" ${o.afterSaleStatus==='En cours de remboursement'?'selected':''}>En cours de remboursement</option><option value="Rembourser" ${o.afterSaleStatus==='Rembourser'||o.afterSaleStatus==='Remboursée'?'selected':''}>Rembourser</option></select></label></div><div class="marketPayActions"><button onclick="saveMarketplaceOrderStatus('${esc(o.id)}')">Enregistrer les détails</button><button class="btn2" onclick="document.getElementById('marketOrderDetailsModal')?.remove()">Fermer</button></div>`:`<div class="orderStatusRead"><p><b>Validation :</b> ${esc(marketplaceValidationValue(o))}</p><p><b>Livraison :</b> ${esc(o.deliveryStatus||marketplaceDeliveryByValidation(marketplaceValidationValue(o)))}</p><p><b>Action :</b> ${esc(o.afterSaleStatus||'Aucune action')}</p></div><div class="marketPayActions"><button onclick="document.getElementById('marketOrderDetailsModal')?.remove()">Fermer</button></div>`;
  const proof=o.paymentMethod==='PAIEMENT À LA LIVRAISON'?'Paiement prévu à la livraison':('Identifiant transaction : '+(o.transactionId||o.paymentRef||'-'));
  const proofLink=o.paymentProofType==='capture'&&o.paymentCaptureData?`<a class="paymentCaptureLink" href="${o.paymentCaptureData}" target="_blank" download="${esc(o.paymentCaptureName||'capture-paiement.png')}">📎 Ouvrir / télécharger la capture de paiement</a>`:(o.paymentProofType==='capture'?'<span class="paymentCaptureMissing">Capture indiquée, mais aucun fichier lisible enregistré.</span>':'');
  const html=`<div class="marketPayModalBackdrop" id="marketOrderDetailsModal"><div class="marketPayModal orderDetailsBox ${isAdmin?'adminOrderDetails':'clientOrderDetails'}"><button class="marketPayClose" onclick="document.getElementById('marketOrderDetailsModal')?.remove()">×</button><h2>Détails commande #${esc(o.id)}</h2><p><b>Client :</b> ${esc(o.client||'Client')} — ${esc(o.clientPhone||'')}${o.clientEmail?' — '+esc(o.clientEmail):''}<br><b>Date :</b> ${new Date(o.date).toLocaleString('fr-FR')}<br><b>Livraison :</b> ${esc(o.deliveryCity||'-')}${o.shippingMethod?' — '+esc(o.shippingMethod):''}${o.deliveryNeighborhood?'<br><b>Quartier :</b> '+esc(o.deliveryNeighborhood):''}${o.deliveryAddressDetail?'<br><b>Détail adresse :</b> '+esc(o.deliveryAddressDetail):''}<br><b>Paiement :</b> ${esc(o.paymentMethod||'-')} — ${esc(proof)}</p>${proofLink?`<div class="paymentProofLinkBox">${proofLink}</div>`:''}<div class="clientOrdersScroll"><table class="mkOrdersTable orderDetailsLines"><tr><th>N°</th><th>Produit / Service</th><th>Catégorie</th><th>Type</th><th>Qté</th><th>PU</th><th>Total</th></tr>${rows}</table></div><div class="orderFinancialSummary"><div><span>Sous-total</span><b>${money(Number(o.subtotal??(orderTotal(o)-Number(o.deliveryFee||0))))}</b></div><div><span>Frais d’expédition${o.shippingMethod?' — '+esc(o.shippingMethod):' ('+deliveryRateLabel(Number(o.deliveryFeeRate||0))+')'}</span><b>${money(Number(o.deliveryFee||0))}</b></div><div class="total"><span>Total lot</span><b>${money(orderTotal(o))}</b></div></div><h3>Détails remplis par l’administrateur Marketplace</h3>${statusAdmin}</div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}


function marketplaceValidationValue(o){
  const v=String(o?.validationStatus||'En attente de validation').trim().toLowerCase();
  if(v.includes('termin')) return 'Terminer';
  if(v.includes('annul')) return 'Annuler';
  if(v.includes('valid')) return 'Validée';
  return 'En attente de validation';
}
function marketplaceDeliveryByValidation(v){
  v=String(v||'').toLowerCase();
  if(v.includes('valid')) return 'En cours de livraison';
  if(v.includes('termin')) return 'Livrée';
  return 'Aucune action';
}
function toggleMarketplaceActionField(){
  const v=$('#orderValidationStatus')?.value||'En attente de validation';
  const livraison=marketplaceDeliveryByValidation(v);
  const del=$('#orderDeliveryStatus'); if(del) del.value=livraison;
  const box=$('#orderRefundActionBox'); if(box) box.style.display=(v==='Annuler')?'block':'none';
}
async function deleteMarketplaceOrder(orderId,isAdmin){
  if(!(await g3Confirm('Supprimer cette commande seulement de cette liste ?','Suppression commande'))) return;
  const d=seed(); const o=(d.orders||[]).find(x=>String(x.id)===String(orderId));
  if(!o) return alert('Commande introuvable.');
  if(isAdmin){
    // Suppression indépendante côté administrateur : la commande disparaît seulement de « Commandes récentes ».
    o.adminDeleted=true;
  }else{
    // Suppression indépendante et persistante côté client : la commande reste dans les rapports admin,
    // mais elle ne réapparaît plus dans l’espace client après déconnexion/reconnexion.
    const client=getPublicClient(o.companyId);
    const cid=client?.id||o.clientId||'';
    o.clientDeletedIds=o.clientDeletedIds||[];
    if(cid && !o.clientDeletedIds.includes(cid)) o.clientDeletedIds.push(cid);
    const savedClient=(d.marketClients||[]).find(c=>c.id===cid);
    if(savedClient){
      savedClient.deletedOrderIds=savedClient.deletedOrderIds||[];
      if(!savedClient.deletedOrderIds.includes(o.id)) savedClient.deletedOrderIds.push(o.id);
    }
    d.clientDeletedOrders=d.clientDeletedOrders||{};
    if(cid){
      d.clientDeletedOrders[cid]=d.clientDeletedOrders[cid]||[];
      if(!d.clientDeletedOrders[cid].includes(o.id)) d.clientDeletedOrders[cid].push(o.id);
    }
  }
  save(d);
  cloudSaveNow(CLOUD_DATA).catch(e=>console.error('Sauvegarde immédiate suppression commande',e));
  document.getElementById('marketOrderDetailsModal')?.remove();
  if(isAdmin) showMarketplacePage(); else { document.getElementById('clientSpaceModal')?.remove(); openClientSpace(o.companyId); }
}

function restoreMarketplaceOrderStock(d,o){
  if(!o || o.stockRestored) return;
  normalizeOrderItems(o).forEach(line=>{
    const it=(d.items||[]).find(x=>x.id===line.itemId&&x.companyId===o.companyId);
    if(it && isBoutiqueItem(it) && it.stockType!=='unlimited') it.stock=Number(it.stock||0)+Number(line.qty||0);
  });
  o.stockRestored=true;
}
function removeMarketplaceOrderFromReport(d,o){
  if(!o) return;
  d.sales=(d.sales||[]).filter(s=>!(s.marketplaceOrderId===o.id));
  o.marketplaceReported=false;
  o.reportSaleIds=[];
}
function addMarketplaceOrderToReport(d,o){
  if(!o || o.marketplaceReported) return;
  d.sales=d.sales||[];
  const ids=[];
  normalizeOrderItems(o).forEach(line=>{
    const qty=Number(line.qty||1), unit=Number(line.unit||0), total=Number(line.total||unit*qty);
    const it=(d.items||[]).find(x=>x.id===line.itemId&&x.companyId===o.companyId);
    const product=isBoutiqueItem(it||{type:line.type});
    const charges=product?Number(it?.buy||0)*qty:total*(Number(it?.charge||0)/100);
    const sid=id('mkp');
    d.sales.push({
      id:sid,companyId:o.companyId,userId:'marketplace',client:o.client||'Client boutique',
      name:line.item||'Commande Marketplace',qty,unit,total,serviceFee:0,charges,profit:total-charges,
      date:o.date||new Date().toISOString(),docSecureLink:secureDocLink(sid),docQr:true,
      clientType:'marketplace',itemCode:it?.code||'',itemId:line.itemId||'',category:line.category||it?.cat||'',
      saleKind:product?'boutique':'service',note:'Vente Marketplace validée — commande '+(o.id||''),
      source:'marketplace',marketplaceOrderId:o.id
    });
    ids.push(sid);
  });
  o.marketplaceReported=true;
  o.reportSaleIds=ids;
}
function saveMarketplaceOrderStatus(orderId){
  const d=seed(); const o=(d.orders||[]).find(x=>String(x.id)===String(orderId)); if(!o) return alert('Commande introuvable.');
  const validation=$('#orderValidationStatus')?.value||'En attente de validation';
  o.validationStatus=validation;
  o.deliveryStatus=marketplaceDeliveryByValidation(validation);
  o.afterSaleStatus=validation==='Annuler'?($('#orderAfterSaleStatus')?.value||'En cours de remboursement'):'';
  if(validation==='Annuler'){
    restoreMarketplaceOrderStock(d,o);
    removeMarketplaceOrderFromReport(d,o);
  }else if(validation==='Validée'||validation==='Terminer'){
    addMarketplaceOrderToReport(d,o);
  }else{
    removeMarketplaceOrderFromReport(d,o);
  }
  o.delivery=orderMainStatus(o);
  save(d); alert('Détails de la commande enregistrés.'); document.getElementById('marketOrderDetailsModal')?.remove(); showMarketplacePage();
}
function requirePublicClientBeforePay(companyId,itemId){
  if(!getPublicClient(companyId)){ alert('Veuillez vous inscrire ou vous connecter avant de commander.'); openClientRegisterPopup(companyId); return; }
  openPublicPaymentModal(companyId,itemId);
}
function ensurePublicOrder(companyId,itemId,qty,total,method){
  const d=seed(); const it=(d.items||[]).find(x=>x.id===itemId&&x.companyId===companyId&&!x.marketplaceHidden); const client=getPublicClient(companyId);
  if(!it||!client) return null;
  if(isBoutiqueItem(it) && it.stockType!=='unlimited' && Number(it.stock||0)<qty) { alert('Stock insuffisant.'); return null; }
  if(isBoutiqueItem(it) && it.stockType!=='unlimited') it.stock=Number(it.stock||0)-qty;
  d.orders=d.orders||[];
  const order={id:id('cmd'),companyId,clientId:client.id,client:client.name,clientPhone:client.phone,date:new Date().toISOString(),item:it.name,itemId:it.id,total,qty,paymentMethod:method,delivery:'Paiement en attente',source:'boutique client'};
  d.orders.push(order); save(d); return order;
}
function showPublicPaymentChoice(companyId,itemId,qty,total,method){
  const d=seed(); const c=(d.companies||[]).find(x=>x.id===companyId); const it=(d.items||[]).find(x=>x.id===itemId&&x.companyId===companyId&&!x.marketplaceHidden);
  if(!c||!it) return;
  const order=ensurePublicOrder(companyId,itemId,qty,total,method); if(!order) return;
  let content='';
  if(method==='WAVE'){
    const waveLink=buildWavePaymentLink(c.marketWaveBusinessLink,total); const qr=waveLink?'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(waveLink):'';
    content=waveLink?`<div class="payQrBox"><img src="${qr}" alt="QR Code Wave"><a href="${esc(waveLink)}" target="_blank">Payer avec Wave Business</a></div>`:'<p class="notice">Lien Wave Business non configuré par le vendeur.</p>';
  }else{
    const payload=`USDT TRC20\nAdresse: ${c.marketUsdtTrc20||''}\nMontant commande: ${total} FCFA\nCommande: ${order.id}`;
    const qr=c.marketUsdtTrc20?'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(payload):'';
    content=c.marketUsdtTrc20?`<div class="payQrBox"><img src="${qr}" alt="QR Code USDT TRC20"><div class="usdtBox"><small>Adresse USDT TRC20</small><b>${esc(c.marketUsdtTrc20)}</b><small>Commande #${esc(order.id)} — ${money(total)}</small></div></div>`:'<p class="notice">Adresse USDT TRC20 non configurée par le vendeur.</p>';
  }
  const box=document.getElementById('publicPaymentChoiceBox'); if(box) box.innerHTML=content+`<p class="notice">Commande enregistrée dans votre espace client : #${esc(order.id)}</p>`;
}
async function openPublicPaymentModal(companyId,itemId){
  const d=seed(); const c=(d.companies||[]).find(x=>x.id===companyId); const it=(d.items||[]).find(x=>x.id===itemId&&x.companyId===companyId&&!x.marketplaceHidden);
  if(!c||!it) return alert('Article introuvable.');
  const client=getPublicClient(companyId); if(!client) return openClientRegisterPopup(companyId);
  const qty=isBoutiqueItem(it)?Math.max(1,Number(await g3Prompt('Quantité :','1','Quantité')||1)):1;
  const total=itemMarketPrice(it)*qty;
  const html=`<div class="marketPayModalBackdrop" id="publicPaymentModal"><div class="marketPayModal publicPayBox"><button class="marketPayClose" onclick="document.getElementById('publicPaymentModal')?.remove()">×</button><h2>Paiement commande</h2><p>Client : <b>${esc(client.name)}</b><br><b>${esc(it.name)}</b><br>Quantité : ${qty} — Montant : <b>${money(total)}</b></p><div class="paymentChoiceBtns"><button onclick="showPublicPaymentChoice('${companyId}','${itemId}',${qty},${total},'WAVE')">Paiement Wave</button><button class="btn2" onclick="showPublicPaymentChoice('${companyId}','${itemId}',${qty},${total},'USDT TRC20')">Paiement USDT TRC20</button></div><div id="publicPaymentChoiceBox" class="publicPaymentChoiceBox"><p class="notice">Choisissez d’abord votre moyen de paiement pour afficher le QR Code.</p></div><div class="marketPayActions"><button onclick="openClientSpace('${companyId}')">Voir mon espace client</button><button class="btn2" onclick="document.getElementById('publicPaymentModal')?.remove()">Fermer</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}


function previewMkImage(e){}
function openPublicProductPhoto(companyId,itemId){
  const d=seed(); const it=(d.items||[]).find(x=>x.id===itemId&&x.companyId===companyId);
  if(!it || !it.photo) return;
  const html=`<div class="publicPhotoModal" id="publicPhotoModal" onclick="if(event.target.id==='publicPhotoModal')this.remove()"><div class="publicPhotoModalCard"><button class="publicPhotoClose" onclick="document.getElementById('publicPhotoModal')?.remove()">×</button><img src="${esc(it.photo)}" alt="${esc(it.name||'Produit')}"><h2>${esc(it.name||'Produit / service')}</h2><p>${esc(it.marketplaceDesc||it.detail||it.cat||'')}</p></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}

function saveShopSettings(){const {d,company}=current(); const c=d.companies.find(x=>x.id===company.id); c.shopBanner=$('#shopBanner')?.value||c.name; c.phone=$('#shopContact')?.value||c.phone; c.shopColor=$('#shopColor')?.value||'#004a48'; c.shopSlug=slugify(c.name); save(d); alert('Boutique publique mise à jour.'); showMarketplacePage();}
function openPublicShop(){const {company}=current(); window.open(marketplaceUrl(company),'_blank')}
function filterMarketCards(){const q=($('#marketSearch')?.value||'').toLowerCase(); document.querySelectorAll('.marketCard').forEach(c=>c.style.display=c.dataset.search.includes(q)?'':'none')}
function focusMarketForm(){document.getElementById('marketFormPanel')?.scrollIntoView({behavior:'smooth',block:'start'});}
function toggleMarketType(){}
function clearMarketForm(){}
function saveMarketItem(){alert('La Marketplace est maintenant basée sur le stock général. Ajoutez ou modifiez les produits/services dans la section Stocks, puis affichez/masquez ici.');}
function editMarketItem(iid){editMarketplaceInfo(iid)}
function deleteMarketItem(iid){toggleMarketplaceVisibility(iid)}
async function fakeCustomerOrder(iid){const {d,company}=current(); const it=(d.items||[]).find(i=>i.id===iid&&i.companyId===company.id&&!i.marketplaceHidden); if(!it) return; const client=await g3Prompt('Nom du client pour la commande :','Client boutique','Client marketplace'); if(!client) return; const qty=isBoutiqueItem(it)?Math.max(1,Number(await g3Prompt('Quantité :','1','Quantité commande')||1)):1; if(isBoutiqueItem(it) && it.stockType!=='unlimited' && Number(it.stock||0)<qty) return alert('Stock général insuffisant.'); if(isBoutiqueItem(it) && it.stockType!=='unlimited') it.stock=Number(it.stock||0)-qty; d.orders=d.orders||[]; d.orders.push({id:id('cmd'),companyId:company.id,date:new Date().toISOString(),client,item:it.name,total:itemMarketPrice(it)*qty,qty,delivery:'Commande reçue',source:'marketplace'}); save(d); alert('Commande client enregistrée. Le stock général de l’entreprise a été mis à jour.'); showMarketplacePage();}
async function updateOrderStatus(oid){const {d,company}=current(); const o=(d.orders||[]).find(x=>x.id===oid&&x.companyId===company.id); if(!o) return; const st=await g3Prompt('Statut livraison :',o.delivery||'Commande reçue','Statut livraison'); if(st){o.delivery=st; save(d); showMarketplacePage();}}


const GLOBAL_MARKET_HOME_PAGE_SIZE=16;
function globalMarketBrandMark(){return `<span class="gmHomeLogoMark" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28"/><path d="M15 21h6l5 22h22l4-15H25M29 50a3 3 0 1 0 0 .1M45 50a3 3 0 1 0 0 .1M21 13c6 5 16 6 23 1M18 37c9 3 21 3 31 0M32 8c-7 7-10 15-9 24M32 8c7 7 10 15 9 24"/></svg></span>`}
function globalMarketCardHtml(i,company={}){
  const desc=String(i.marketplaceDesc||i.detail||i.desc||'Produit ou service proposé sur GLOBAL MARKET.');
  const category=String(i.cat||'Produits & services');
  const shop=String(company.name||i.shop||'Entreprise partenaire');
  const type=isBoutiqueItem(i)?'product':'service';
  const price=itemMarketPrice(i);
  const dt=new Date(i.createdAt||i.date||i.updatedAt||0).getTime()||0;
  const visual=i.photo?`<img loading="lazy" decoding="async" src="${esc(i.photo)}" alt="${esc(i.name||'Produit ou service')}" loading="lazy">`:`<div class="gmHomeCardEmoji">${mkProductVisual(i)}</div>`;
  const shopSlug=encodeURIComponent(company.shopSlug||slugify(company.name||''));
  const cid=String(i.companyId||company.id||'');
  const iid=String(i.id||'');
  const unavailable=type==='product'&&i.stockType!=='unlimited'&&Number(i.stock||0)<=0;
  const actions=`<button type="button" class="gmHomeGhostBtn" onclick="event.stopPropagation();location.hash='#boutique/${shopSlug}';render()">Voir la boutique</button>${unavailable?`<button type="button" class="gmHomeCartBtn" disabled>Stock épuisé</button>`:`<button type="button" class="gmHomeCartBtn" onclick="event.stopPropagation();addGlobalMarketItemToCart('${esc(cid)}','${esc(iid)}')">${officialShopIcon('cart')} Ajouter au panier</button>`}`;
  return `<article class="gmHomeCatalogCard gmHomeCatalogCardClickable" role="button" tabindex="0" aria-label="Voir les détails de ${esc(i.name||'ce produit ou service')}" onclick="openGlobalMarketItemPopup('${esc(cid)}','${esc(iid)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openGlobalMarketItemPopup('${esc(cid)}','${esc(iid)}')}" data-type="${type}" data-cat="${esc(category)}" data-search="${esc((String(i.name||'')+' '+category+' '+shop+' '+desc).toLowerCase())}" data-date="${dt}" data-price="${price}" data-name="${esc(String(i.name||'').toLowerCase())}">
    <div class="gmHomeCardMedia"><span class="gmHomeNewBadge">NOUVEAU</span>${visual}</div>
    <div class="gmHomeCardContent"><div class="gmHomeShopName">${officialShopIcon(type==='service'?'spark':'bag')}<span>${esc(shop)}</span></div><h3>${esc(i.name||'Produit / service')}</h3><small class="gmHomeCardCategory">${esc(category)}</small><p>${esc(desc)}</p><strong>${money(price)}</strong><div class="gmHomeCardActions">${actions}</div></div>
  </article>`;
}
function openGlobalMarketItemPopup(companyId,itemId){
  document.getElementById('gmMarketItemDetailsModal')?.remove();
  const d=seed();
  const item=(d.items||[]).find(x=>String(x.id)===String(itemId)&&String(x.companyId)===String(companyId)&&!x.marketplaceHidden);
  if(!item)return alert('Ce produit ou service n’est plus disponible.');
  const company=(d.companies||[]).find(c=>String(c.id)===String(companyId))||{};
  const product=isBoutiqueItem(item);
  const description=String(item.marketplaceDesc||item.detail||item.desc||'Aucune description complémentaire.');
  const category=String(item.cat||'Produits & services');
  const price=itemMarketPrice(item);
  const stock=product?(item.stockType==='unlimited'?'Disponible':`${Math.max(0,Number(item.stock||0))} en stock`):'Service disponible';
  const visual=item.photo?`<img loading="lazy" decoding="async" src="${esc(item.photo)}" alt="${esc(item.name||'Produit ou service')}">`:`<div class="gmItemDetailFallback">${mkProductVisual(item)}</div>`;
  const slug=encodeURIComponent(company.shopSlug||slugify(company.name||''));
  const extra=[item.code?`<div><span>Code</span><b>${esc(item.code)}</b></div>`:'',`<div><span>Catégorie</span><b>${esc(category)}</b></div>`,`<div><span>Type</span><b>${product?'Produit':'Service'}</b></div>`,`<div><span>Disponibilité</span><b>${esc(stock)}</b></div>`].join('');
  document.body.insertAdjacentHTML('beforeend',`<div class="gmHomeAuthBackdrop" id="gmMarketItemDetailsModal" onclick="if(event.target.id==='gmMarketItemDetailsModal')this.remove()"><section class="gmHomeAuthCard gmItemDetailCard"><button class="gmHomeAuthClose" aria-label="Fermer" onclick="document.getElementById('gmMarketItemDetailsModal')?.remove()">×</button><div class="gmItemDetailMedia">${visual}<span class="gmHomeNewBadge">NOUVEAU</span></div><div class="gmItemDetailBody"><span class="gmHomeModalKicker">${product?'PRODUIT':'SERVICE'} GLOBAL MARKET</span><h2>${esc(item.name||'Produit / service')}</h2><button type="button" class="gmItemDetailShop" onclick="document.getElementById('gmMarketItemDetailsModal')?.remove();location.hash='#boutique/${slug}';render()">${officialShopIcon('bag')} ${esc(company.name||'Boutique partenaire')}</button><p>${esc(description)}</p><div class="gmItemDetailMeta">${extra}</div><div class="gmItemDetailPrice"><span>Prix</span><strong>${money(price)}</strong></div><div class="gmItemDetailActions"><button type="button" class="gmHomeGhostBtn" onclick="document.getElementById('gmMarketItemDetailsModal')?.remove();location.hash='#boutique/${slug}';render()">Voir la boutique</button><button type="button" class="gmHomeCartBtn" onclick="addGlobalMarketItemToCart('${esc(companyId)}','${esc(itemId)}')">${officialShopIcon('cart')} Ajouter au panier</button></div></div></section></div>`);
}
function globalPublicCompanyOptions(selected=''){
  const companies=(seed().companies||[]).filter(c=>hasPlanFeature(c,'public_shop'));
  return companies.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selected)?'selected':''}>${esc(c.name||'Entreprise')}</option>`).join('');
}
function renderGlobalShop(){
  const d=seed();
  const companies=(d.companies||[]).filter(c=>hasPlanFeature(c,'public_shop'));
  const companyMap=new Map(companies.map(c=>[c.id,c]));
  const realItems=(GM_V6_CURRENT_CATALOG_ITEMS.length?GM_V6_CURRENT_CATALOG_ITEMS:(d.items||[])).filter(i=>{const c=companyMap.get(i.companyId);return c&&!i.marketplaceHidden});
  const displayItems=realItems;
  const cats=(GM_V6_CATALOG_META?.categories?.length?GM_V6_CATALOG_META.categories:[...new Set(displayItems.map(i=>String(i.cat||'').trim()).filter(Boolean))]).sort((a,b)=>String(a).localeCompare(String(b),'fr'));
  const cards=displayItems.map(i=>globalMarketCardHtml(i,companyMap.get(i.companyId)||{})).join('');
  const emptyCopy=realItems.length?'<b>Aucun résultat</b><span>Modifiez votre recherche ou vos filtres.</span>':'<b>Aucun produit ou service publié pour le moment.</b><span>Les offres apparaîtront ici dès leur publication par les boutiques GLOBAL MARKET.</span>';
  app.innerHTML=`<main class="gmHomePage">
    ${globalUniversalHeader('public')}

    <section class="gmHomeHero">
      <div class="gmHomeHeroCopy"><span class="gmHomeEyebrow">GLOBAL MARKET · MARKETPLACE PROFESSIONNELLE</span><h1>Votre marketplace moderne<br>pour acheter, vendre et<br>développer vos <em>produits et services</em></h1><p>GLOBAL MARKET connecte clients, commerçants, prestataires de services et entreprises sur une plateforme fiable, sécurisée et performante.</p><p class="gmHomeHeroStrong">Tout ce dont votre entreprise a besoin, au même endroit.</p><div class="gmHomeBenefits"><div>${officialShopIcon('shield')}<span><b>Paiement</b><small>100% sécurisé</small></span></div><div>${officialShopIcon('truck')}<span><b>Livraison rapide</b><small>partout</small></span></div><div>${officialShopIcon('spark')}<span><b>Satisfaction & qualité</b><small>de service</small></span></div></div><button type="button" class="gmHomeCta" onclick="openGlobalBusinessAuth('register')">Proposer vos produits et services ${officialShopIcon('arrow')}</button></div>
      <div class="gmHomeHeroVisual"><img src="assets/global-market-hero.png" alt="GLOBAL MARKET sur ordinateur, smartphone et supports de livraison"><div class="gmHomeHeroGlow"></div></div>
    </section>

    <section class="gmHomeFilters" id="gmHomeCatalogTop"><label>${officialShopIcon('menu')}<select id="globalShopCat" onchange="filterGlobalShop(true)"><option value="">Toutes les catégories</option>${cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label><label><select id="globalShopType" onchange="filterGlobalShop(true)"><option value="">Tous les types</option><option value="product">Produits</option><option value="service">Services</option></select></label><form onsubmit="event.preventDefault();filterGlobalShop(true)"><input id="globalShopSearch" type="search" placeholder="Rechercher un produit, un service ou une entreprise..." oninput="filterGlobalShop(true)"><button type="submit">${officialShopIcon('search')}</button></form><label class="gmHomeSort"><span>Trier par</span><select id="globalShopSort" onchange="filterGlobalShop(true)"><option value="recent">Les plus récents</option><option value="priceAsc">Prix croissant</option><option value="priceDesc">Prix décroissant</option><option value="name">Nom A–Z</option></select></label></section>

    <section class="gmHomeCatalogSection"><div class="gmHomeCatalogHead"><div><h2>Produits & services disponibles</h2><p>Découvrez les offres publiées par les boutiques et entreprises partenaires.</p></div><span id="gmHomeResultCount"></span></div><div id="gmHomeCatalogGrid" class="gmHomeCatalogGrid">${cards}</div><div id="gmHomeEmpty" class="gmHomeEmpty" hidden>${emptyCopy}</div><nav id="gmHomePagination" class="gmHomePagination" aria-label="Pagination du catalogue"></nav></section>
    <footer class="gmHomeFooter"><div>${globalMarketBrandMark()}<span><b>GLOBAL MARKET</b><small>Produits & services en toute confiance</small></span></div><nav class="gmHomeLegalLinks" aria-label="Informations légales"><button type="button" onclick="openLegalPopup('cgu')">Conditions générales d'utilisation</button><button type="button" onclick="openLegalPopup('privacy')">Notre politique de confidentialité</button></nav><p>Marketplace multi-entreprises · © 2026 MEGA SERVICES SARL U</p></footer>
  </main>`;
  window.globalMarketPage=1;
  requestAnimationFrame(()=>{const meta=GM_V6_CATALOG_META?.pagination;if(meta){window.globalMarketPage=Number(meta.page||1);const count=document.getElementById('gmHomeResultCount');if(count)count.textContent=Number(meta.total||0)?`${meta.total} résultat${Number(meta.total)>1?'s':''} · page ${meta.page}/${meta.pages}`:'0 résultat';renderGlobalMarketPagination(Number(meta.pages||1));}else filterGlobalShop(false);refreshGlobalMarketCartBadge();initFlexibleHorizontalMenu()});
}
function syncGlobalMarketSearch(sourceId){const source=document.getElementById(sourceId),target=document.getElementById('globalShopSearch');if(target)target.value=source?.value||'';filterGlobalShop(true);document.getElementById('gmHomeCatalogTop')?.scrollIntoView({behavior:'smooth',block:'start'});}
let GM_V6_CATALOG_TIMER=null,GM_V6_CATALOG_LOADING=false;
async function gmV6LoadCatalogPage(page=1){
  if(GM_V6_CATALOG_LOADING)return;GM_V6_CATALOG_LOADING=true;
  try{
    const q=String(document.getElementById('globalShopSearch')?.value||'').trim(),type=document.getElementById('globalShopType')?.value||'',category=document.getElementById('globalShopCat')?.value||'',sort=document.getElementById('globalShopSort')?.value||'recent';
    const params=new URLSearchParams({page:String(Math.max(1,Number(page||1))),pageSize:String(GLOBAL_MARKET_HOME_PAGE_SIZE),q,type,category,sort});
    const j=await fetchApiJsonWithRetry('/api/v6/catalog?'+params.toString(),{cache:'no-store'},10000,2);
    const incoming=Array.isArray(j.items)?j.items:[],baseRequest=!q&&!type&&!category,authoritativeEmpty=Boolean(j.authoritativeEmpty);
    let shown=incoming;
    if(incoming.length)gmV6RememberGoodCatalog(incoming);
    else if(baseRequest&&!authoritativeEmpty){shown=gmV6StableCatalogItems([],false);console.warn('[GLOBAL MARKET V6.0.5] Réponse catalogue vide non autoritative ignorée; dernier catalogue valide conservé.');}
    else if(authoritativeEmpty&&baseRequest){GM_V6_CURRENT_CATALOG_ITEMS=[];GM_V6_LAST_GOOD_CATALOG_ITEMS=[];GM_V6_CATALOG_CACHE.clear();}
    GM_V6_CATALOG_META={pagination:j.pagination||{},categories:j.categories||[],authoritativeEmpty};
    if(incoming.length||authoritativeEmpty||!baseRequest)GM_V6_CURRENT_CATALOG_ITEMS=shown;
    for(const c of j.companies||[]){const idx=CLOUD_DATA.companies.findIndex(x=>x.id===c.id);if(idx>=0)CLOUD_DATA.companies[idx]={...CLOUD_DATA.companies[idx],...c};else CLOUD_DATA.companies.push(c)}
    for(const it of shown)if(it?.id)GM_V6_CATALOG_CACHE.set(it.id,it);
    if(shown.length){CLOUD_DATA.items=[...GM_V6_CATALOG_CACHE.values()];gmV610RememberBrowserCatalog(CLOUD_DATA.items,CLOUD_DATA.companies||[]);}
    window.globalMarketPage=Number(j.pagination?.page||1);
    const companyMap=new Map((CLOUD_DATA.companies||[]).map(c=>[c.id,c])),grid=document.getElementById('gmHomeCatalogGrid');if(grid)grid.innerHTML=shown.map(i=>globalMarketCardHtml(i,companyMap.get(i.companyId)||{})).join('');
    const serverTotal=Number(j.pagination?.total||0),total=(baseRequest&&!authoritativeEmpty&&!incoming.length&&shown.length)?Math.max(serverTotal,shown.length):serverTotal,pages=Math.max(1,Number(j.pagination?.pages||1)),count=document.getElementById('gmHomeResultCount');if(count)count.textContent=total?`${total} résultat${total>1?'s':''} · page ${window.globalMarketPage}/${pages}`:'0 résultat';const empty=document.getElementById('gmHomeEmpty');if(empty)empty.hidden=shown.length>0;renderGlobalMarketPagination(pages);
  }catch(e){
    console.warn('Catalogue V6 non actualisé',e);
    if(gmV6IsBaseCatalogRequest()){
      const shown=gmV6StableCatalogItems([],false),grid=document.getElementById('gmHomeCatalogGrid');
      if(grid&&shown.length){const companyMap=new Map((CLOUD_DATA.companies||[]).map(c=>[c.id,c]));grid.innerHTML=shown.map(i=>globalMarketCardHtml(i,companyMap.get(i.companyId)||{})).join('');document.getElementById('gmHomeEmpty')?.setAttribute('hidden','');}
    }
  }finally{GM_V6_CATALOG_LOADING=false}
}
function filterGlobalShop(resetPage=true){if(resetPage)window.globalMarketPage=1;if(GM_V6_CATALOG_TIMER)clearTimeout(GM_V6_CATALOG_TIMER);GM_V6_CATALOG_TIMER=setTimeout(()=>gmV6LoadCatalogPage(window.globalMarketPage||1),180)}
function renderGlobalMarketPagination(pages){
  const nav=document.getElementById('gmHomePagination');if(!nav)return;if(pages<=1){nav.innerHTML='<button disabled>‹</button><button class="active">1</button><button disabled>›</button>';return}
  const current=Number(window.globalMarketPage||1);let nums=[];if(pages<=7)nums=Array.from({length:pages},(_,i)=>i+1);else{const set=new Set([1,2,pages-1,pages,current-1,current,current+1].filter(n=>n>=1&&n<=pages));nums=[...set].sort((a,b)=>a-b)}let html=`<button ${current<=1?'disabled':''} onclick="changeGlobalShopPage(-1)">‹</button>`,prev=0;for(const n of nums){if(prev&&n-prev>1)html+='<span>…</span>';html+=`<button class="${n===current?'active':''}" onclick="setGlobalShopPage(${n})">${n}</button>`;prev=n}html+=`<button ${current>=pages?'disabled':''} onclick="changeGlobalShopPage(1)">›</button>`;nav.innerHTML=html;
}
function setGlobalShopPage(page){window.globalMarketPage=Math.max(1,Number(page||1));gmV6LoadCatalogPage(window.globalMarketPage);document.getElementById('gmHomeCatalogTop')?.scrollIntoView({behavior:'smooth',block:'start'})}
function changeGlobalShopPage(delta){setGlobalShopPage(Number(window.globalMarketPage||1)+Number(delta||0))}
function globalMarketCartCount(){window.publicShopCart=window.publicShopCart||{};return Object.values(window.publicShopCart).reduce((sum,cart)=>sum+(Array.isArray(cart)?cart.reduce((a,x)=>a+Number(x.qty||0),0):0),0)}
function refreshGlobalMarketCartBadge(){const badge=document.getElementById('gmGlobalCartBadge');if(badge)badge.textContent=globalMarketCartCount();}
async function addGlobalMarketItemToCart(companyId,itemId){await addToPublicCart(companyId,itemId);refreshGlobalMarketCartBadge();}
function openGlobalMarketCart(){
  window.publicShopCart=window.publicShopCart||{};const d=seed();const companyMap=new Map((d.companies||[]).map(c=>[c.id,c]));
  const groups=Object.entries(window.publicShopCart).filter(([,cart])=>Array.isArray(cart)&&cart.length);
  if(!groups.length)return alert('Votre panier est vide.');
  if(groups.length===1)return openPublicCart(groups[0][0]);
  document.getElementById('gmGlobalCartModal')?.remove();
  const rows=groups.map(([cid,cart])=>{const c=companyMap.get(cid)||{};return `<button type="button" onclick="document.getElementById('gmGlobalCartModal')?.remove();openPublicCart('${esc(cid)}')"><span>${officialShopIcon('bag')}<b>${esc(c.name||'Boutique')}</b><small>${publicCartCount(cid)} article(s)</small></span><strong>${money(publicCartTotal(cid))}</strong>${officialShopIcon('arrow')}</button>`}).join('');
  document.body.insertAdjacentHTML('beforeend',`<div class="gmHomeAuthBackdrop" id="gmGlobalCartModal" onclick="if(event.target.id==='gmGlobalCartModal')this.remove()"><section class="gmHomeAuthCard gmGlobalCartCard"><button class="gmHomeAuthClose" onclick="document.getElementById('gmGlobalCartModal')?.remove()">×</button><span class="gmHomeModalKicker">MON PANIER</span><h2>Choisir une boutique</h2><p>Vos articles sont regroupés par vendeur pour conserver un paiement et une livraison cohérents.</p><div class="gmGlobalCartGroups">${rows}</div></section></div>`);
}
function openGlobalBusinessAuth(mode='login'){
  document.getElementById('gmBusinessAuthModal')?.remove();
  const createFirst=mode==='register';
  const html=`<div class="gmHomeAuthBackdrop" id="gmBusinessAuthModal" onclick="if(event.target.id==='gmBusinessAuthModal')this.remove()"><section class="gmHomeAuthCard"><button class="gmHomeAuthClose" onclick="document.getElementById('gmBusinessAuthModal')?.remove()">×</button><span class="gmHomeModalKicker">ESPACE BOUTIQUE</span><h2>${createFirst?'Proposez vos produits et services':'Créer ma boutique ou se connecter'}</h2><p>Connectez-vous à votre espace entreprise ou créez votre boutique GLOBAL MARKET.</p><div class="gmHomeBusinessSplit"><div class="gmHomeAuthPane"><h3>Connexion entreprise</h3><label>Profil<select id="loginRole"><option value="admin">Administrateur</option><option value="caisse">Caisse</option></select></label><label>Nom utilisateur / Email<input id="loginEmail" type="text" autocomplete="username" placeholder="votre@email.com"></label><label>Mot de passe<input id="loginPass" type="password" autocomplete="current-password" placeholder="Votre mot de passe"></label><div id="loginMessage" class="ggLoginMessage" role="status" aria-live="polite"></div><button id="loginSubmitBtn" type="button" class="gmHomePrimaryAuth" onclick="guardedBusinessLogin()"><span class="ggBtnLabel">Se connecter</span></button><button type="button" class="gmHomeTextBtn" onclick="document.getElementById('gmBusinessAuthModal')?.remove();openForgotPasswordPopup()">Mot de passe oublié ?</button></div><div class="gmHomeCreatePane"><div class="gmHomeCreateIcon">${officialShopIcon('bag')}</div><h3>Vous êtes commerçant ou prestataire ?</h3><p>Créez votre boutique, publiez vos produits et services et gérez votre activité depuis un espace professionnel.</p><button type="button" class="gmHomeCreateBtn" onclick="document.getElementById('gmBusinessAuthModal')?.remove();openCompanyRegistrationFromShop()">Créer ma boutique</button></div></div></section></div>`;
  document.body.insertAdjacentHTML('beforeend',html);setTimeout(()=>document.getElementById(createFirst?'loginEmail':'loginEmail')?.focus(),50);
}
function openGlobalClientAuth(mode='login'){
  document.getElementById('gmClientAuthModal')?.remove();
  document.getElementById('clientLoginModal')?.remove();
  document.getElementById('clientRegisterModal')?.remove();
  const d=seed(),companies=(d.companies||[]).filter(c=>hasPlanFeature(c,'public_shop'));
  if(!companies.length)return alert('Aucune boutique n’est encore disponible pour créer un compte client.');
  const selected=PUBLIC_CLIENT_SESSION?.companyId||companies[0].id;
  const options=globalPublicCompanyOptions(selected);
  const isRegister=mode==='register';
  const fields=isRegister?`<label>Nom complet<input id="clientRegName" placeholder="Nom et prénom"></label><label>Téléphone<input id="clientRegPhone" placeholder="Ex : 0700000000"></label><label>Email<input id="clientRegEmail" type="email" placeholder="Email facultatif"></label><label>Mot de passe<input id="clientRegPass" type="password" placeholder="Créer un mot de passe"></label><button class="gmHomePrimaryAuth" onclick="submitGlobalClientRegister()">Créer mon compte client</button><button class="gmHomeTextBtn" onclick="openGlobalClientAuth('login')">J’ai déjà un compte</button>`:`<label>Téléphone<input id="clientLoginPhone" placeholder="Votre téléphone"></label><label>Mot de passe<input id="clientLoginPass" type="password" placeholder="Votre mot de passe"></label><button class="gmHomePrimaryAuth" onclick="submitGlobalClientLogin()">Se connecter</button><button class="gmHomeTextBtn" onclick="openGlobalClientAuth('register')">Créer un compte client</button>`;
  const modalId=isRegister?'clientRegisterModal':'clientLoginModal';
  document.body.insertAdjacentHTML('beforeend',`<div class="gmHomeAuthBackdrop" id="${modalId}" onclick="if(event.target.id==='${modalId}')this.remove()"><section class="gmHomeAuthCard gmClientAuthCard"><button class="gmHomeAuthClose" onclick="document.getElementById('${modalId}')?.remove()">×</button><span class="gmHomeModalKicker">COMPTE CLIENT</span><h2>${isRegister?'Créer un compte client':'Se connecter à mon compte client'}</h2><p>Choisissez la boutique concernée puis renseignez vos informations.</p><label>Boutique / entreprise<select id="gmClientCompany">${options}</select></label>${fields}</section></div>`);
}
function submitGlobalClientLogin(){const cid=document.getElementById('gmClientCompany')?.value;if(!cid)return alert('Veuillez choisir une boutique.');loginPublicClient(cid);}
function submitGlobalClientRegister(){const cid=document.getElementById('gmClientCompany')?.value;if(!cid)return alert('Veuillez choisir une boutique.');savePublicClientRegister(cid);}
function openGlobalProductPhoto(itemId){
  const d=seed(); const it=(d.items||[]).find(x=>x.id===itemId); if(!it||!it.photo) return;
  const c=(d.companies||[]).find(x=>x.id===it.companyId)||{};
  const html=`<div class="publicPhotoModal" id="globalPhotoModal" onclick="if(event.target.id==='globalPhotoModal')this.remove()"><div class="publicPhotoModalCard globalPhotoCard"><button class="publicPhotoClose" onclick="document.getElementById('globalPhotoModal')?.remove()">×</button><img src="${esc(it.photo)}" alt="${esc(it.name||'Produit')}"><h2>${esc(it.name||'Produit / service')}</h2><p><b>${esc(c.name||'Entreprise')}</b> — ${esc(it.cat||'Catégorie')}</p><p>${esc(it.marketplaceDesc||it.detail||'')}</p></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}

function officialShopIcon(name){
  const icons={
    bag:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 8.5h11l1 12h-13l1-12Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/><rect x="11" y="13" width="5" height="4.5" rx="1"/><path d="M12.5 13v-1a1 1 0 0 1 2 0v1"/></svg>',
    user:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
    cart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>',
    search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    menu:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    phone:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10 5h4M11 18.5h2"/></svg>',
    computer:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
    electronic:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 17V7a4 4 0 0 1 8 0v10"/><path d="M8 11H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2M16 11h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/></svg>',
    home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8"/><path d="M5.5 10v10h13V10M9.5 20v-6h5v6"/></svg>',
    fashion:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4 4 7l2.5 4L9 9v11h6V9l2.5 2L20 7l-4-3a5 5 0 0 1-8 0Z"/></svg>',
    beauty:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6v5H9zM8 8h8l1 12H7L8 8Z"/><path d="M10 12h4"/></svg>',
    food:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v7a3 3 0 0 0 3 3V3M8 13v8M15 3v18M15 9c3 0 4-2 4-4V3h-4"/></svg>',
    truck:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    shield:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>',
    support:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13a8 8 0 0 1 16 0"/><path d="M4 13v4h3v-5H4M20 13v4h-3v-5h3M17 19c-1 1.3-2.6 2-5 2"/></svg>',
    refresh:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5"/></svg>',
    spark:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>'
  };
  return `<span class="officialSvgIcon">${icons[name]||icons.spark}</span>`;
}
function officialPopularCategoryForItem(item){
  const text=String((item?.cat||'')+' '+(item?.name||'')+' '+(item?.detail||'')+' '+(item?.marketplaceDesc||'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(/telephone|smartphone|tablette|mobile/.test(text)) return 'phones';
  if(/informat|ordinateur|laptop|imprimante|logiciel/.test(text)) return 'computers';
  if(/electron|audio|casque|ecouteur|television|camera/.test(text)) return 'electronics';
  if(/maison|cuisine|menage|meuble|decoration/.test(text)) return 'home';
  if(/mode|vetement|habit|accessoire|chaussure|sac|pagne/.test(text)) return 'fashion';
  if(/sante|beaute|cosmetique|coiffure|parfum|savon/.test(text)) return 'beauty';
  if(/aliment|boisson|riz|poisson|restaurant|epicerie|nourriture/.test(text)) return 'food';
  return '';
}
const OFFICIAL_SHOP_PAGE_SIZE=16;
function filterOfficialShop(){
  const q=String(document.getElementById('officialShopSearch')?.value||'').toLowerCase().trim();
  const category=String(document.getElementById('officialShopCategory')?.value||'');
  const mode=window.officialShopMode||'all';
  const matched=[];
  document.querySelectorAll('.officialProductCard').forEach(card=>{
    const okQ=!q||String(card.dataset.search||'').includes(q);
    const okCategory=!category||(category.startsWith('popular:')?card.dataset.popular===category.slice(8):card.dataset.cat===category);
    const okMode=mode==='all'||(mode==='promotions'&&card.dataset.promo==='1')||(mode==='new'&&card.dataset.new==='1');
    if(okQ&&okCategory&&okMode) matched.push(card);
  });
  const total=matched.length;
  const pages=Math.max(1,Math.ceil(total/OFFICIAL_SHOP_PAGE_SIZE));
  window.officialShopPage=Math.min(Math.max(1,Number(window.officialShopPage||1)),pages);
  const first=(window.officialShopPage-1)*OFFICIAL_SHOP_PAGE_SIZE;
  const last=first+OFFICIAL_SHOP_PAGE_SIZE;
  const matchedSet=new Set(matched.slice(first,last));
  document.querySelectorAll('.officialProductCard').forEach(card=>card.hidden=!matchedSet.has(card));
  const empty=document.getElementById('officialShopEmpty');
  if(empty) empty.hidden=total>0||!document.querySelector('.officialProductCard');
  const count=document.getElementById('officialShopVisibleCount');
  if(count) count.textContent=total?`${total} article${total>1?'s':''} · Page ${window.officialShopPage}/${pages}`:'0 article';
  const pagination=document.getElementById('officialShopPagination');
  const previous=document.getElementById('officialShopPrevious');
  const next=document.getElementById('officialShopNext');
  const label=document.getElementById('officialShopPageLabel');
  if(pagination) pagination.hidden=total<=OFFICIAL_SHOP_PAGE_SIZE;
  if(previous) previous.disabled=window.officialShopPage<=1;
  if(next) next.disabled=window.officialShopPage>=pages;
  if(label) label.textContent=`Page ${window.officialShopPage} sur ${pages}`;
}
function resetOfficialShopPage(){window.officialShopPage=1;}
function changeOfficialShopPage(delta){
  window.officialShopPage=Math.max(1,Number(window.officialShopPage||1)+Number(delta||0));
  filterOfficialShop();
  document.getElementById('officialProducts')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function submitOfficialShopSearch(event){ if(event) event.preventDefault(); window.officialShopMode='all'; resetOfficialShopPage(); updateOfficialShopNav(); filterOfficialShop(); document.getElementById('officialProducts')?.scrollIntoView({behavior:'smooth',block:'start'}); }
function selectOfficialShopCategory(key){
  const select=document.getElementById('officialShopCategory');
  if(select) select.value=key?`popular:${key}`:'';
  window.officialShopMode='all'; resetOfficialShopPage(); updateOfficialShopNav(); filterOfficialShop();
  document.getElementById('officialProducts')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function setOfficialShopMode(mode){
  window.officialShopMode=mode||'all'; resetOfficialShopPage();
  updateOfficialShopNav(); filterOfficialShop();
  document.getElementById('officialProducts')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function updateOfficialShopNav(){
  const mode=window.officialShopMode||'all';
  document.querySelectorAll('[data-official-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.officialMode===mode));
}
function scrollOfficialShopProducts(){ window.officialShopMode='all'; resetOfficialShopPage(); updateOfficialShopNav(); filterOfficialShop(); document.getElementById('officialProducts')?.scrollIntoView({behavior:'smooth',block:'start'}); }
function toggleOfficialCategoriesMenu(){ document.getElementById('officialCategoryMenu')?.classList.toggle('open'); }

function renderPublicShop(slug){
  const d=seed(); const decodedSlug=decodeURIComponent(slug||'');
  const c=(d.companies||[]).find(x=>slugify(x.name)===decodedSlug||x.shopSlug===decodedSlug);
  if(!c){app.innerHTML=`<div class="loginPage"><div class="loginBox"><div class="loginLeft"><div class="logoG">GG</div><h1>Boutique introuvable</h1><p>Le lien public demandé n’existe pas encore.</p><button onclick="goGlobalMarketHome()">Retour à l’accueil</button></div></div></div>`;return;}
  if(!hasPlanFeature(c,'public_shop')){app.innerHTML=`<div class="loginPage"><div class="loginBox"><div class="loginLeft"><div class="logoG">GG</div><h1>Boutique publique non active</h1><p>Cette boutique publique n’est pas disponible.</p><button onclick="goGlobalMarketHome()">Retour à l’accueil</button></div></div></div>`;return;}
  const items=(d.items||[]).filter(i=>i.companyId===c.id&&!i.marketplaceHidden && !(isBoutiqueItem(i)&&i.stockType!=='unlimited'&&Number(i.stock||0)<=0));
  const categories=[...new Set(items.map(i=>String(i.cat||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  const popularDefs=[
    {key:'phones',label:'Téléphones & Tablettes',icon:'phone',sample:128},
    {key:'computers',label:'Informatique',icon:'computer',sample:96},
    {key:'electronics',label:'Électronique',icon:'electronic',sample:154},
    {key:'home',label:'Maison & Cuisine',icon:'home',sample:213},
    {key:'fashion',label:'Mode & Accessoires',icon:'fashion',sample:178},
    {key:'beauty',label:'Santé & Beauté',icon:'beauty',sample:96},
    {key:'food',label:'Alimentation',icon:'food',sample:120}
  ];
  const popularCards=popularDefs.map(def=>{
    const matches=items.filter(i=>officialPopularCategoryForItem(i)===def.key);
    const visual=matches.find(i=>i.photo);
    const count=matches.length;
    return `<button type="button" class="officialCategoryCard" onclick="selectOfficialShopCategory('${def.key}')"><span class="officialCategoryVisual">${visual?`<img src="${esc(visual.photo)}" alt="${esc(def.label)}">`:officialShopIcon(def.icon)}</span><span class="officialCategoryText"><b>${esc(def.label)}</b><small>${count?`${count} produit${count>1?'s':''}`:`${def.sample} produits`}</small></span><span class="officialCategoryArrow">${officialShopIcon('arrow')}</span></button>`;
  }).join('');
  const productCards=items.map((i,index)=>{
    const popular=officialPopularCategoryForItem(i);
    const search=String((i.name||'')+' '+(i.cat||'')+' '+(i.marketplacePromo||'')+' '+(i.marketplaceDesc||i.detail||'')).toLowerCase();
    const isNew=index<8;
    return `<article class="officialProductCard" data-popular="${esc(popular)}" data-cat="${esc(String(i.cat||''))}" data-promo="${i.marketplacePromo?'1':'0'}" data-new="${isNew?'1':'0'}" data-search="${esc(search)}">
      <div class="officialProductBadges"><span>${isBoutiqueItem(i)?'PRODUIT':'SERVICE'}</span>${isNew?'<span class="new">NOUVEAU</span>':''}${i.marketplacePromo?`<span class="promo">${esc(i.marketplacePromo)}</span>`:''}</div>
      <button type="button" class="officialProductImage ${i.photo?'clickable':''}" ${i.photo?`onclick="openPublicProductPhoto('${c.id}','${i.id}')" title="Agrandir la photo"`:''}>${mkProductVisual(i)}${i.photo?'<span class="officialZoom">⌕ Agrandir</span>':''}</button>
      <div class="officialProductContent"><small>${esc(i.cat||'Produits & services')}</small><h3>${esc(i.name)}</h3><p>${esc(i.marketplaceDesc||i.detail||'Produit sélectionné par la boutique.')}</p><div class="officialProductMeta"><strong>${money(itemMarketPrice(i))}</strong><span>${marketStockLabel(i)}</span></div></div>
      <button type="button" class="officialAddCart" onclick="addToPublicCart('${c.id}','${i.id}')">${officialShopIcon('cart')}<span>Ajouter au panier</span></button>
    </article>`;
  }).join('');
  const categoryOptions=popularDefs.map(x=>`<option value="popular:${x.key}">${esc(x.label)}</option>`).join('')+categories.map(cat=>`<option value="${esc(cat)}">${esc(cat)}</option>`).join('');
  const companySlogan=String(c.activity||'Produits et services de qualité');
  const bannerName=String(c.name||'Votre entreprise');
  window.officialShopMode='all'; window.officialShopPage=1;
  app.innerHTML=globalUniversalHeader('shop')+`<div class="publicShop officialStore">
    <header class="officialHeader">
      <div class="officialHeaderMain">
        <button class="officialBrand" type="button" onclick="location.hash='#boutique/${encodeURIComponent(c.shopSlug||slugify(c.name))}'" aria-label="Accueil de la boutique">
          <span class="officialBrandLogo">${officialShopIcon('bag')}</span><span><b>${esc(bannerName)}</b><small>${esc(companySlogan)}</small></span>
        </button>
        <form class="officialSearch" onsubmit="submitOfficialShopSearch(event)">
          <input id="officialShopSearch" type="search" placeholder="Rechercher un produit, une marque…" aria-label="Rechercher dans la boutique" oninput="resetOfficialShopPage();filterOfficialShop()">
          <select id="officialShopCategory" aria-label="Toutes les catégories" onchange="resetOfficialShopPage();filterOfficialShop()"><option value="">Toutes catégories</option>${categoryOptions}</select>
          <button type="submit" aria-label="Rechercher">${officialShopIcon('search')}</button>
        </form>
        <div class="officialAccountActions">
          <button type="button" class="officialHeaderCart" onclick="openPublicCart('${c.id}')"><span>${officialShopIcon('cart')}</span><span><small>Votre</small><b>Panier</b></span><i id="publicCartBadge">${publicCartCount(c.id)}</i></button>
        </div>
      </div>
      <nav class="officialNav officialNavSimplified">
        <div class="officialNavLinks"><button type="button" class="active" onclick="scrollOfficialShopProducts()">Produits & services de la boutique</button></div>
      </nav>
    </header>

    <main>

      <section class="officialProductsSection" id="officialProducts">
        <div class="officialSectionHeading"><div><span>NOTRE CATALOGUE</span><h2>Produits & services</h2><p>Découvrez les offres disponibles chez ${esc(bannerName)}.</p></div><div class="officialProductCount"><b id="officialShopVisibleCount">${items.length} article${items.length>1?'s':''}</b><button type="button" onclick="document.getElementById('officialShopSearch').value='';document.getElementById('officialShopCategory').value='';resetOfficialShopPage();setOfficialShopMode('all')">${officialShopIcon('refresh')} Réinitialiser</button></div></div>
        <div class="officialProductsGrid">${productCards}</div>
        <div class="officialShopPagination" id="officialShopPagination" hidden><button type="button" id="officialShopPrevious" onclick="changeOfficialShopPage(-1)">← Précédent</button><span id="officialShopPageLabel">Page 1 sur 1</span><button type="button" id="officialShopNext" class="next" onclick="changeOfficialShopPage(1)">Suivant →</button></div>
        <div class="officialEmpty" id="officialShopEmpty" hidden><span>🔎</span><h3>Aucun résultat trouvé</h3><p>Essayez une autre recherche ou affichez toutes les catégories.</p><button type="button" onclick="document.getElementById('officialShopSearch').value='';document.getElementById('officialShopCategory').value='';resetOfficialShopPage();setOfficialShopMode('all')">Afficher tout le catalogue</button></div>
        ${items.length?'':`<div class="officialEmpty"><span>🛍️</span><h3>Catalogue en préparation</h3><p>${esc(bannerName)} ajoutera bientôt ses produits et services.</p></div>`}
      </section>
    </main>
    <footer class="officialFooter"><div><b>${esc(bannerName)}</b><span>${esc(companySlogan)}</span></div><nav class="gmHomeLegalLinks" aria-label="Informations légales"><button type="button" onclick="openLegalPopup('cgu')">Conditions générales d'utilisation</button><button type="button" onclick="openLegalPopup('privacy')">Notre politique de confidentialité</button></nav><p>© 2026 ${esc(bannerName)} — Boutique officielle propulsée par GLOBAL MARKET.</p></footer>
  </div>`;
  requestAnimationFrame(()=>{filterOfficialShop();initFlexibleHorizontalMenu()});
}


/* === GHOST PATCH : Gestion de stock dashboard pro (2026-07-08) === */
function getStockEntries(d,cid){ return (d.stockEntries||[]).filter(x=>x.companyId===cid); }
function getStockOutputs(d,cid){ return (d.stockOutputs||[]).filter(x=>x.companyId===cid); }
function getItemStockEntries(itemId){ const {d,company}=current(); return getStockEntries(d,company.id).filter(x=>String(x.itemId||'')===String(itemId||'')); }
function getItemStockOutputs(itemId){ const {d,company}=current(); return getStockOutputs(d,company.id).filter(x=>String(x.itemId||'')===String(itemId||'')); }
function stockUserAvatarLabel(u){ const name=String(u?.name||u?.email||'U').trim(); return esc((name[0]||'U').toUpperCase()); }
function stockStatusInfo(i,sales=[]){ const s=stockStatsForItem(i,sales); let label='Service', cls='service';
  if(s.boutique){
    if(Number(i.stock||0)<=0 && i.stockType!=='unlimited'){ label='Rupture'; cls='danger'; }
    else if(Number(i.stock||0)<=Number(i.alert||5) && i.stockType!=='unlimited'){ label='Stock faible'; cls='warning'; }
    else { label='En stock'; cls='success'; }
  }
  return {label,cls,stats:s};
}
function legacy1_stockDashboardStats(items=[],sales=[]){
  const products=items.filter(isBoutiqueItem), cats=new Set(items.map(i=>i.cat).filter(Boolean));
  const total=products.reduce((a,i)=>a+(Number(i.stock||0)*Number(i.buy||0)),0);
  const profitStock=products.reduce((a,i)=>{const qty=i.stockType==='unlimited'?0:Math.max(0,Number(i.stock||0)); return a+qty*(Number(itemMarketPrice(i)||i.sell||0)-Number(i.buy||0));},0);
  const low=products.filter(i=>Number(i.stock||0)>0 && Number(i.stock||0)<=Number(i.alert||5) && i.stockType!=='unlimited').length;
  return {categories:cats.size,products:products.length,low,total,profitStock};
}
function stockHeaderSearchValue(){ return String($('#stockDashboardSearch')?.value||'').toLowerCase().trim(); }
function legacy2_stockSection(items,admin=false,sales=[]){
  const {user,company}=current();
  const stats=stockDashboardStats(items,sales);
  const low=stats.low;
  return `<div class="g2panel stockDashShell">
    <div class="stockDashHeader">
      <div class="stockDashTitleWrap"><h2>Gestion de stock</h2><p class="sub">Tableau de bord professionnel pour gérer les catégories, les produits, les entrées, les sorties, les valeurs et les statistiques de stock.</p></div>
      <div class="stockDashSearch"><span>🔎</span><input id="stockDashboardSearch" placeholder="Rechercher un produit, une catégorie, un code..." oninput="filterStockManagerTable()"></div>
      <div class="stockUserZone no-print">
        <button class="stockIconBtn"><span>🔔</span><b>${low}</b></button>
        <button class="stockIconBtn" title="Aide">❔</button>
        <button class="stockIconBtn" title="Paramètres" onclick="show('param')">⚙️</button>
        <div class="stockUserBadge"><div class="stockAvatar">${stockUserAvatarLabel(user)}</div><div><strong>${esc(user?.name||user?.email||'Utilisateur')}</strong><small>${user?.role==='admin'?'Administrateur':'Caisse'}</small></div><span>▾</span></div>
      </div>
    </div>
    ${stockDashboardCards(items,sales)}
    <div class="stockActionRow no-print">
      ${admin?'<button class="stockActionBtn primary" onclick="openStockItemPopup()">➕ Ajouter un produit</button>':''}
      <button class="stockActionBtn" onclick="openStockCategoriesManager()">🗂 Gestion des catégories</button>
      ${admin?'<button class="stockActionBtn" onclick="openStockMovementPopup(\'in\')">⬇️ Entrées de stock</button><button class="stockActionBtn" onclick="openStockMovementPopup(\'out\')">⬆️ Sorties de stock</button>':''}
      <button class="stockActionBtn dark" onclick="openStockPrintMenu()">🖨 Imprimer</button>
    </div>
    <div class="stockMainGrid">
      <aside class="stockFilterPane">
        <div class="stockPaneHead"><h3>Filtres</h3><p>Affinez rapidement la liste des produits et services.</p></div>
        ${stockFilterPanel()}
      </aside>
      <section class="stockTablePane">
        <div class="stockPaneHead"><h3>Liste des produits</h3><div class="stockPaneMeta"><span id="stockManagerCount">0 élément</span><span id="stockManagerValue">Valeur : 0 FCFA</span></div></div>
        ${stockManagerTable(items,admin,sales)}
      </section>
    </div>
    <div class="stockBottomGrid">
      <section class="stockChartBlock">
        <div class="stockPaneHead"><h3>Évolution de la valeur du stock</h3><div class="stockMiniFilter"><select id="stockChartRange" onchange="renderStockTrendChart()"><option value="6">6 derniers mois</option><option value="12">12 derniers mois</option><option value="year">Cette année</option></select></div></div>
        <div id="stockTrendChartWrap">${renderStockTrendChartMarkup()}</div>
      </section>
      <aside class="stockValueCardWrap">${stockCurrentValueCard(items,sales)}</aside>
    </div>
  </div>`;
}
function stockDashboardCards(items=[],sales=[]){
  const stats=stockDashboardStats(items,sales);
  const cards=[
    ['🗂','Catégories',stats.categories,'0 % depuis le mois dernier'],
    ['👜','Produits',stats.products,'↑ 12 % depuis le mois dernier'],
    ['⚠️','Stock faible',stats.low,'↑ 9 % depuis le mois dernier'],
    ['🗄️','Valeur du stock',money(stats.total),'Bénéfices : '+money(stats.profitStock||0),'↑ 8,5 % depuis le mois dernier']
  ];
  return `<div class="stockDashCards">${cards.map(c=>`<div class="stockDashCard"><div class="stockDashCardIcon">${c[0]}</div><div><span>${esc(c[1])}</span><strong>${esc(String(c[2]))}</strong><small>${esc(c[3])}</small>${c[4]?`<em class="stockCardExtra">${esc(c[4])}</em>`:''}</div></div>`).join('')}</div>`;
}
function stockFilterPanel(){
  const {d,company}=current();
  const cats=getCompanyCategories(d,company.id);
  return `<div class="stockFilterFields no-print">
    <label>Catégorie<select id="stockManagerCategory" onchange="filterStockManagerTable()"><option value="">Toutes les catégories</option>${cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label>
    <label>Nom du produit<input id="stockManagerName" placeholder="Rechercher un produit..." oninput="filterStockManagerTable()"></label>
    <label>Code<input id="stockManagerCode" placeholder="Rechercher un code..." oninput="filterStockManagerTable()"></label>
    <label>Statut<select id="stockManagerStatus" onchange="filterStockManagerTable()"><option value="">Tous les statuts</option><option value="en stock">En stock</option><option value="stock faible">Stock faible</option><option value="rupture">Rupture</option></select></label>
    <div class="grid two compactGrid"><label>Prix achat min<input id="stockManagerBuy" type="number" placeholder="0" oninput="filterStockManagerTable()"></label><label>Prix vente min<input id="stockManagerSell" type="number" placeholder="0" oninput="filterStockManagerTable()"></label></div>
    <label>Stock disponible min<input id="stockManagerQty" type="number" placeholder="0" oninput="filterStockManagerTable()"></label>
    <label>Date d’enregistrement<input id="stockManagerDate" type="date" onchange="filterStockManagerTable()"></label>
    <div class="stockFilterBtns"><button class="stockActionBtn primary" onclick="filterStockManagerTable()">Filtrer</button><button class="stockActionBtn" onclick="resetStockManagerFilters()">Réinitialiser</button></div>
  </div>`;
}
function stockManagerTable(items=[],admin=false,sales=[]){
  return `<div class="stockManagerTableWrap"><table class="g2table stockManagerTable"><thead><tr><th>Code</th><th>Img</th><th>Produit</th><th>Cat.</th><th>Qté</th><th>Achat</th><th>Vente</th><th>Val. stock</th><th>État</th><th>Act.</th></tr></thead><tbody id="stockManagerTbody">${items.map(i=>stockManagerRow(i,admin,sales)).join('')||'<tr><td colspan="10">Aucun produit ou service enregistré.</td></tr>'}</tbody></table></div>`;
}
function stockManagerRow(i,admin=false,sales=[]){
  const info=stockStatusInfo(i,sales), s=info.stats;
  const qty=s.boutique?(i.stockType==='unlimited'?'Illimité':Number(i.stock||0)):'Service';
  const value=s.boutique?(Number(i.stock||0)*Number(i.buy||0)):0;
  const img=i.photo?`<img loading="lazy" decoding="async" src="${esc(i.photo)}" alt="${esc(i.name||'')}" class="stockMiniImg">`:'<div class="stockMiniImg stockMiniImgPlaceholder">📦</div>';
  const search=[i.name,i.cat,i.code,info.label,i.buy,i.sell,qty].join(' ').toLowerCase();
  const dt=(i.createdAt||i.updatedAt||'').slice(0,10);
  const statusLabel=info.label.toLowerCase();
  return `<tr class="stockMgrRow" data-id="${esc(i.id)}" data-search="${esc(search)}" data-category="${esc(String(i.cat||'').toLowerCase())}" data-name="${esc(String(i.name||'').toLowerCase())}" data-code="${esc(String(i.code||'').toLowerCase())}" data-status="${esc(statusLabel)}" data-buy="${Number(i.buy||0)}" data-sell="${Number(i.sell||0)}" data-qty="${s.boutique?Number(i.stock||0):0}" data-date="${esc(dt)}" data-value="${value}">
      <td data-label="Code">${esc(i.code||'-')}</td>
      <td data-label="Image">${img}</td>
      <td data-label="Produit"><div class="stockProdCell"><strong>${esc(i.name||'-')}</strong><small>${esc(i.detail||i.marketplaceDesc||'')}</small></div></td>
      <td data-label="Catégorie">${esc(i.cat||'-')}</td>
      <td data-label="Quantité">${esc(String(qty))}</td>
      <td data-label="Prix d’achat">${money(i.buy||0)}</td>
      <td data-label="Prix de vente">${money(i.sell||0)}</td>
      <td data-label="Valeur stock">${money(value)}</td>
      <td data-label="Statut"><span class="stockStateBadge ${info.cls}">${esc(info.label)}</span></td>
      <td data-label="Actions"><div class="stockActionMini"> <button onclick="openStockItemDetail('${esc(i.id)}')">👁 Voir détails</button>${admin?`<button class="btn2" onclick="openStockItemPopup('${esc(i.id)}')">✏️ Modifier</button><button class="danger" onclick="deleteItem('${esc(i.id)}')">🗑 Supprimer</button>`:''}</div></td>
    </tr>`;
}
function resetStockManagerFilters(){ ['stockDashboardSearch','stockManagerName','stockManagerCode','stockManagerDate','stockManagerBuy','stockManagerSell','stockManagerQty'].forEach(id=>{const el=$('#'+id); if(el) el.value='';}); ['stockManagerCategory','stockManagerStatus'].forEach(id=>{const el=$('#'+id); if(el) el.value='';}); filterStockManagerTable(); }
function filterStockManagerTable(){
  const rows=[...document.querySelectorAll('.stockMgrRow')]; if(!rows.length) return;
  const search=stockHeaderSearchValue();
  const cat=String($('#stockManagerCategory')?.value||'').toLowerCase();
  const name=String($('#stockManagerName')?.value||'').toLowerCase();
  const code=String($('#stockManagerCode')?.value||'').toLowerCase();
  const status=String($('#stockManagerStatus')?.value||'').toLowerCase();
  const buy=Number($('#stockManagerBuy')?.value||0), sell=Number($('#stockManagerSell')?.value||0), qty=Number($('#stockManagerQty')?.value||0);
  const date=String($('#stockManagerDate')?.value||'');
  let count=0, totalValue=0;
  rows.forEach(r=>{
    let ok=true;
    if(search && !String(r.dataset.search||'').includes(search)) ok=false;
    if(cat && r.dataset.category!==cat) ok=false;
    if(name && !r.dataset.name.includes(name)) ok=false;
    if(code && !r.dataset.code.includes(code)) ok=false;
    if(status && r.dataset.status!==status) ok=false;
    if(buy && Number(r.dataset.buy||0)<buy) ok=false;
    if(sell && Number(r.dataset.sell||0)<sell) ok=false;
    if(qty && Number(r.dataset.qty||0)<qty) ok=false;
    if(date && r.dataset.date!==date) ok=false;
    r.style.display=ok?'':'none';
    if(ok){ count++; totalValue += Number(r.dataset.value||0); }
  });
  const countEl=$('#stockManagerCount'); if(countEl) countEl.textContent=count+' élément(s)';
  const valueEl=$('#stockManagerValue'); if(valueEl) valueEl.textContent='Valeur : '+money(totalValue);
}
function initStockManager(){ setTimeout(()=>{ filterStockManagerTable(); renderStockTrendChart(); }, 20); }
function openStockCategoriesManager(){
  const {d,company}=current();
  const items=(d.items||[]).filter(i=>i.companyId===company.id); const sales=getCompanyValidatedSales(); const admin=current().user.role==='admin';
  const html=`<div class="modalBackdrop stockModalBackdrop" onclick="closeStockModal(event)"><div class="stockProModal stockCategoryManagerModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockModalBackdrop')?.remove()">×</button>${stockCategoriesPage(items,admin,sales)}</div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function openStockMovementPopup(kind='in'){
  if(!requireAdmin('La caisse ne peut pas gérer les mouvements de stock.')) return;
  const {d,company}=current(); const items=(d.items||[]).filter(i=>i.companyId===company.id&&isBoutiqueItem(i));
  const inMode=kind==='in';
  const html=`<div class="modalBackdrop stockModalBackdrop" onclick="closeStockModal(event)"><div class="stockProModal stockMovementModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockModalBackdrop')?.remove()">×</button><h2>${inMode?'Entrées de stock':'Sorties de stock'}</h2><p class="sub">Enregistrez un mouvement de stock professionnel et mettez à jour automatiquement les statistiques.</p><div class="grid two">
  <label>Produit<select id="stockMoveItem" onchange="syncStockMovementFields()"><option value="">Choisir un produit</option>${items.map(i=>`<option value="${esc(i.id)}" data-code="${esc(i.code||'')}" data-cat="${esc(i.cat||'')}" data-buy="${Number(i.buy||0)}" data-stock="${Number(i.stock||0)}">${esc(i.name)} — ${esc(i.code||'')}</option>`).join('')}</select></label>
  <label>Code produit<input id="stockMoveCode" readonly placeholder="Automatique"></label>
  <label>Catégorie<input id="stockMoveCat" readonly placeholder="Automatique"></label>
  <label>${inMode?'Quantité entrée':'Quantité sortie'}<input id="stockMoveQty" type="number" min="1" value="1"></label>
  ${inMode?'<label>Prix d’achat<input id="stockMoveBuy" type="number" min="0" placeholder="Prix achat"></label><label>Fournisseur<input id="stockMovePartner" placeholder="Nom du fournisseur"></label>':'<label>Motif de sortie<input id="stockMovePartner" placeholder="Motif de sortie"></label><label>Stock disponible<input id="stockMoveStock" readonly placeholder="Automatique"></label>'}
  <label>Date ${inMode?'d’entrée':''}<input id="stockMoveDate" type="date" value="${today()}"></label>
  <label class="fullRow">Note<textarea id="stockMoveNote" rows="3" placeholder="Observation complémentaire"></textarea></label>
  <input type="hidden" id="stockMoveKind" value="${kind}">
  </div><div class="modalActions"><button class="orangeBtn" onclick="saveStockMovement()">${inMode?'Enregistrer l’entrée':'Enregistrer la sortie'}</button><button class="btn2" onclick="document.querySelector('.stockModalBackdrop')?.remove()">Annuler</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html); setTimeout(()=>$('#stockMoveItem')?.focus(),40);
}
function syncStockMovementFields(){ const opt=$('#stockMoveItem')?.selectedOptions?.[0]; if(!opt) return; if($('#stockMoveCode')) $('#stockMoveCode').value=opt.dataset.code||''; if($('#stockMoveCat')) $('#stockMoveCat').value=opt.dataset.cat||''; if($('#stockMoveBuy')) $('#stockMoveBuy').value=opt.dataset.buy||''; if($('#stockMoveStock')) $('#stockMoveStock').value=opt.dataset.stock||''; }
function saveStockMovement(){
  if(!requireAdmin('La caisse ne peut pas gérer les mouvements de stock.')) return;
  const {d,company}=current(); const kind=$('#stockMoveKind')?.value||'in', iid=$('#stockMoveItem')?.value||''; const it=(d.items||[]).find(x=>x.companyId===company.id&&x.id===iid);
  if(!it) return g3Alert('Veuillez sélectionner un produit.','Mouvement de stock');
  const qty=Math.max(1, Number($('#stockMoveQty')?.value||0)); const date=$('#stockMoveDate')?.value||today(); const note=$('#stockMoveNote')?.value||''; const partner=$('#stockMovePartner')?.value||'';
  d.stockEntries=d.stockEntries||[]; d.stockOutputs=d.stockOutputs||[];
  if(kind==='out' && it.stockType!=='unlimited' && Number(it.stock||0)<qty) return g3Alert('Impossible d’enregistrer cette sortie : la quantité demandée dépasse le stock disponible.','Stock insuffisant','warn');
  if(kind==='in'){
    const buy=Number($('#stockMoveBuy')?.value||it.buy||0); it.buy=buy; it.stock=Number(it.stock||0)+qty; it.stockInitial=Number(it.stockInitial||0)+qty;
    d.stockEntries.push({id:id('stin'),companyId:company.id,itemId:it.id,name:it.name,code:it.code,cat:it.cat,qty,buy,partner,note,date,createdAt:new Date().toISOString()});
  } else {
    if(it.stockType!=='unlimited') it.stock=Number(it.stock||0)-qty;
    d.stockOutputs.push({id:id('stout'),companyId:company.id,itemId:it.id,name:it.name,code:it.code,cat:it.cat,qty,partner,note,date,createdAt:new Date().toISOString()});
  }
  it.updatedAt=new Date().toISOString(); save(d); document.querySelector('.stockModalBackdrop')?.remove(); g3Alert(kind==='in'?'Entrée de stock enregistrée avec succès.':'Sortie de stock enregistrée avec succès.','Gestion de stock'); renderDash('stocks');
}
async function deleteItem(iid){ if(!requireAdmin('La caisse ne peut pas supprimer les stocks.')) return; const {d,company}=current(); const it=(d.items||[]).find(i=>i.id===iid&&i.companyId===company.id); if(!it) return g3Alert('Élément introuvable.','Gestion de stock'); if(!(await g3Confirm('Supprimer cet élément du stock ? L’historique des ventes déjà effectuées restera conservé dans les rapports.','Suppression stock sécurisée'))) return; d.items=d.items.filter(i=>!(i.id===iid&&i.companyId===company.id)); save(d); g3Alert('Élément supprimé du stock. Historique des ventes conservé.','Gestion de stock'); renderDash('stocks'); }
async function deleteCategory(cat){ if(!requireAdmin()) return; const {d,company}=current(); const count=(d.items||[]).filter(i=>i.companyId===company.id&&i.cat===cat).length; if(count>0) return g3Alert('Suppression sécurisée refusée : cette catégorie contient '+count+' produit(s) ou service(s). Modifiez la catégorie ou les éléments au lieu de les supprimer afin d’éviter toute perte accidentelle.','Suppression catégorie','warn'); if(!(await g3Confirm('Supprimer cette catégorie vide ?','Suppression catégorie'))) return; const rows=getCompanyCategoryRecords(d,company.id).filter(c=>c.name!==cat); saveCompanyCategoryRecords(d,company.id,rows); save(d); renderDash('stocks'); }
function openStockItemDetail(iid){
  const {d,company}=current(); const i=(d.items||[]).find(x=>x.id===iid&&x.companyId===company.id); if(!i)return g3Alert('Élément introuvable.','Gestion de stock');
  const s=stockStatsForItem(i,(d.sales||[]).filter(x=>x.companyId===company.id));
  const entries=getItemStockEntries(iid), outputs=getItemStockOutputs(iid);
  const entryRows=entries.map(x=>`<tr><td>${esc(String(x.date||'').slice(0,10))}</td><td>${Number(x.qty||0)}</td><td>${money(x.buy||i.buy||0)}</td><td>${esc(x.partner||'-')}</td><td>${esc(x.note||'-')}</td></tr>`).join('')||'<tr><td colspan="5">Aucune entrée enregistrée.</td></tr>';
  const outRows=outputs.map(x=>`<tr><td>${esc(String(x.date||'').slice(0,10))}</td><td>${Number(x.qty||0)}</td><td>${esc(x.partner||'-')}</td><td>${esc(x.note||'-')}</td></tr>`).join('')||'<tr><td colspan="4">Aucune sortie enregistrée.</td></tr>';
  const salesRows=s.sales.map(x=>`<tr><td>${new Date(x.date).toLocaleString('fr-FR')}</td><td>${esc(x.client||'-')}</td><td>${Number(x.qty||0)}</td><td>${money(x.unit||0)}</td><td>${money(x.total||0)}</td><td>${money(x.profit||0)}</td></tr>`).join('')||'<tr><td colspan="6">Aucune vente enregistrée pour cet élément.</td></tr>';
  const benefitPotential=(Number(i.sell||0)-Number(i.buy||0))*Math.max(0,Number(i.stock||0));
  const html=`<div class="modalBackdrop stockModalBackdrop" onclick="closeStockModal(event)"><div class="stockProModal stockDetailModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockModalBackdrop')?.remove()">×</button><h2>Détail du produit ou service</h2><h3>${esc(i.name||'')}</h3><div class="stockDetailGrid"><div><small>Code</small><b>${esc(i.code||'-')}</b></div><div><small>Catégorie</small><b>${esc(i.cat||'-')}</b></div><div><small>Description</small><b>${esc(i.detail||i.marketplaceDesc||'-')}</b></div><div><small>Quantité restante</small><b>${s.boutique?(i.stockType==='unlimited'?'Illimité':Number(i.stock||0)):'Service'}</b></div><div><small>Prix d’achat</small><b>${money(i.buy||0)}</b></div><div><small>Prix de vente</small><b>${money(i.sell||0)}</b></div><div><small>Valeur du stock</small><b>${money((Number(i.stock||0)*Number(i.buy||0)))}</b></div><div><small>Bénéfice potentiel</small><b>${money(benefitPotential)}</b></div><div><small>Valeur totale vendue</small><b>${money(s.valueSold)}</b></div><div><small>Marge bénéficiaire</small><b>${money((Number(i.sell||0)-Number(i.buy||0)))}</b></div><div><small>Bénéfice réalisé</small><b>${money(s.realized)}</b></div><div><small>Bénéfice restant potentiel</small><b>${money(s.remainingPotential)}</b></div></div><h3>Historique des entrées en stock</h3><table class="g2table"><tr><th>Date</th><th>Quantité</th><th>Prix achat</th><th>Fournisseur</th><th>Note</th></tr>${entryRows}</table><h3>Historique des sorties</h3><table class="g2table"><tr><th>Date</th><th>Quantité</th><th>Motif</th><th>Note</th></tr>${outRows}</table><h3>Historique des ventes</h3><table class="g2table"><tr><th>Date</th><th>Client</th><th>Quantité</th><th>Prix unitaire</th><th>Total</th><th>Bénéfice</th></tr>${salesRows}</table><div class="modalActions"><button class="darkBtn" onclick="openStockItemPdfPage('${esc(i.id)}')">Imprimer</button><button class="btn2" onclick="document.querySelector('.stockModalBackdrop')?.remove()">Fermer</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function openStockPrintMenu(){
  const {d,company}=current(); const items=(d.items||[]).filter(i=>i.companyId===company.id); const cats=[...new Set(items.map(i=>i.cat).filter(Boolean))];
  const html=`<div class="modalBackdrop stockModalBackdrop" onclick="closeStockModal(event)"><div class="stockProModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockModalBackdrop')?.remove()">×</button><h2>Impression du stock</h2><p class="sub">Imprimez la liste complète, la liste filtrée, une catégorie, les stocks faibles, les ruptures ou le résumé global.</p><div class="stockPrintMenu"><button onclick="printStockSubset('all')">Liste complète</button><button onclick="printStockSubset('filtered')">Liste filtrée</button><button onclick="printStockSubset('low')">Produits en stock faible</button><button onclick="printStockSubset('out')">Produits en rupture</button><button onclick="printStockSubset('summary')">Résumé valeur du stock</button><label>Par catégorie<select id="stockPrintCategorySelect"><option value="">Choisir une catégorie</option>${cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label><button class="orangeBtn" onclick="printStockSubset('category')">Imprimer la catégorie</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function printStockSubset(mode='all'){
  const {d,company}=current(); const cid=company.id; const itemsAll=(d.items||[]).filter(i=>i.companyId===cid); let rows=itemsAll; let title='Stock';
  if(mode==='filtered'){ rows=getVisibleStockManagerItems(); title='Liste filtrée'; }
  else if(mode==='low'){ rows=itemsAll.filter(i=>isBoutiqueItem(i)&&Number(i.stock||0)>0&&Number(i.stock||0)<=Number(i.alert||5)&&i.stockType!=='unlimited'); title='Produits en stock faible'; }
  else if(mode==='out'){ rows=itemsAll.filter(i=>isBoutiqueItem(i)&&Number(i.stock||0)<=0&&i.stockType!=='unlimited'); title='Produits en rupture'; }
  else if(mode==='category'){ const c=$('#stockPrintCategorySelect')?.value||''; rows=itemsAll.filter(i=>String(i.cat||'')===String(c)); title='Catégorie : '+c; }
  else if(mode==='summary'){ rows=itemsAll; title='Résumé de la valeur du stock'; }
  const html=standaloneStockHTML(company,rows,title); const w=window.open('','_blank'); if(!w){ const blob=new Blob([html],{type:'text/html;charset=utf-8'}); location.href=URL.createObjectURL(blob); return;} w.document.open(); w.document.write(html); w.document.close(); document.querySelector('.stockModalBackdrop')?.remove();
}
function getVisibleStockManagerItems(){ const {d,company}=current(); const ids=new Set([...document.querySelectorAll('.stockMgrRow')].filter(r=>r.style.display!=='none').map(r=>r.dataset.id)); return (d.items||[]).filter(i=>i.companyId===company.id && ids.has(i.id)); }
function buildStockTrendSeries(range='6'){
  const {d,company}=current(); const cid=company.id; const items=(d.items||[]).filter(i=>i.companyId===cid&&isBoutiqueItem(i)); const entries=getStockEntries(d,cid); const outputs=getStockOutputs(d,cid);
  const now=new Date(); const points=[];
  let months=[];
  if(String(range)==='year'){
    const y=now.getFullYear(); for(let m=0;m<=now.getMonth();m++) months.push(new Date(y,m,1));
  } else {
    const count=Math.max(1, Number(range||6)); for(let i=count-1;i>=0;i--) months.push(new Date(now.getFullYear(), now.getMonth()-i, 1));
  }
  months.forEach(dt=>{
    const end=new Date(dt.getFullYear(), dt.getMonth()+1, 0, 23,59,59,999);
    let total=0;
    items.forEach(it=>{
      if(it.stockType==='unlimited') return;
      let qty=Number(it.stock||0);
      entries.forEach(e=>{ if(String(e.itemId||'')===String(it.id) && new Date(e.date||e.createdAt||0)>end) qty-=Number(e.qty||0); });
      outputs.forEach(o=>{ if(String(o.itemId||'')===String(it.id) && new Date(o.date||o.createdAt||0)>end) qty+=Number(o.qty||0); });
      const createdAt=new Date(it.createdAt||it.updatedAt||0);
      if(createdAt && !isNaN(createdAt) && createdAt>end) qty=0;
      total += Math.max(0,qty) * Number(it.buy||0);
    });
    points.push({label:dt.toLocaleDateString('fr-FR',{month:'short', year:'2-digit'}), value:Math.round(total)});
  });
  return points;
}
function stockTrendSvg(points){
  if(!points.length) return '<div class="stockChartEmpty">Aucune donnée disponible pour tracer le graphique.</div>';
  const w=700, h=240, pad=30; const vals=points.map(p=>p.value); const max=Math.max(...vals,1), min=Math.min(...vals,0), span=Math.max(1,max-min); const step=(w-pad*2)/Math.max(1,points.length-1);
  const coords=points.map((p,i)=>{ const x=pad+i*step, y=h-pad-((p.value-min)/span)*(h-pad*2); return {x,y,label:p.label,value:p.value};});
  const line=coords.map((c,i)=>(i?'L':'M')+c.x.toFixed(1)+' '+c.y.toFixed(1)).join(' '); const area=line+' L '+coords[coords.length-1].x.toFixed(1)+' '+(h-pad)+' L '+coords[0].x.toFixed(1)+' '+(h-pad)+' Z';
  const grid=[0,.25,.5,.75,1].map(r=>{ const y=h-pad-r*(h-pad*2); const val=Math.round(min+r*span); return `<g><line x1="${pad}" y1="${y}" x2="${w-pad}" y2="${y}" stroke="#e2e8f0"/><text x="4" y="${y+4}" font-size="11" fill="#64748b">${money(val)}</text></g>`; }).join('');
  const labels=coords.map(c=>`<text x="${c.x}" y="${h-8}" text-anchor="middle" font-size="11" fill="#64748b">${esc(c.label)}</text>`).join('');
  const pointsMarkup=coords.map(c=>`<g><circle cx="${c.x}" cy="${c.y}" r="4" fill="#0d6efd"/><title>${esc(c.label)} : ${money(c.value)}</title></g>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="stockTrendSvg" aria-label="Évolution de la valeur du stock">${grid}<path d="${area}" fill="rgba(13,110,253,.12)"></path><path d="${line}" fill="none" stroke="#0d6efd" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>${pointsMarkup}${labels}</svg>`;
}
function renderStockTrendChartMarkup(){ const points=buildStockTrendSeries('6'); return `<div class="stockChartCanvas">${stockTrendSvg(points)}</div>`; }
function renderStockTrendChart(){ const range=$('#stockChartRange')?.value||'6'; const points=buildStockTrendSeries(range); const wrap=$('#stockTrendChartWrap'); if(wrap) wrap.innerHTML=`<div class="stockChartCanvas">${stockTrendSvg(points)}</div>`; const box=$('#stockValueCardDynamic'); if(box) box.outerHTML=stockCurrentValueCard(current().d.items.filter(i=>i.companyId===current().company.id), getCompanyValidatedSales(), points); }
function stockCurrentValueCard(items=[],sales=[],points=null){ const stats=stockDashboardStats(items,sales); points=points||buildStockTrendSeries($('#stockChartRange')?.value||'6'); const first=points[0]?.value||0, last=points[points.length-1]?.value||0; const pct=first?(((last-first)/first)*100):0; const sign=pct>=0?'↑':'↓'; return `<div class="stockValueCard" id="stockValueCardDynamic"><h3>Valeur actuelle</h3><strong>${money(stats.total)}</strong><small>${sign} ${Math.abs(pct).toFixed(1)} % sur la période sélectionnée</small><ul><li>Produits en stock faible : <b>${stats.low}</b></li><li>Total catégories : <b>${stats.categories}</b></li><li>Total produits : <b>${stats.products}</b></li></ul></div>`; }



/* === GLOBAL3 : Section Gestion de stock tableau de bord moderne — correctif final === */
function legacy3_stockSection(items,admin=false,sales=[]){
  const {d,company,user}=current();
  items=items||[]; sales=sales||[];
  window.g3StockChartRange=window.g3StockChartRange||'6';
  const cats=getCompanyCategories(d,company.id);
  const stats=stockDashboardStats(items,sales);
  const avatar=(user?.name||company?.name||'U').trim().slice(0,1).toUpperCase();
  return `<div class="stockDashShell">
    <header class="stockDashHeader no-print">
      <div class="stockDashTitle"><h2>Gestion de stock</h2><p>Tableau de bord moderne des produits, catégories, entrées, sorties et valeurs du stock.</p></div>
      <div class="stockGlobalSearch"><span>🔎</span><input id="stockDashGlobalSearch" placeholder="Rechercher un produit, une catégorie, un code..." oninput="filterStockDashboardTable()"></div>
      <div class="stockUserZone">
        <button title="Notifications">🔔<b>${stats.low+stats.out}</b></button><button title="Aide">❔</button><button title="Paramètres" onclick="show('param')">⚙️</button>
        <div class="stockAvatar">${esc(avatar)}</div><div class="stockUserText"><strong>${esc(user?.name||company?.owner||company?.name||'Utilisateur')}</strong><small>${esc(user?.role||'Administrateur')}</small></div><span>⌄</span>
      </div>
    </header>
    <section class="stockDashStatGrid">
      ${stockDashCard('▦','Catégories',stats.categories,'0 % depuis le mois dernier','neutral')}
      ${stockDashCard('🛍️','Produits',stats.products,'↑ 12 % depuis le mois dernier','good')}
      ${stockDashCard('⚠️','Stock faible',stats.low,'↑ 9 % depuis le mois dernier','warn')}
      ${stockDashCard('🗄️','Valeur du stock',money(stats.valueStock),'Bénéfices : '+money((Number(stats.profitStock||0)+Number(stats.profitServices||0))),'good','↑ 8,5 % depuis le mois dernier')}
    </section>
    <nav class="stockDashActions no-print">
      ${admin?'<button onclick="openStockItemPopup()">➕ Ajouter un produit</button>':''}
      <button onclick="openStockCategoriesDashboard()">▦ Gestion des catégories</button>
      ${admin?'<button onclick="openStockEntryPopup()">⬇️ Entrées de stock</button><button onclick="openStockOutputPopup()">⬆️ Sorties de stock</button>':''}
      <button onclick="openDashboardStockPrint()">🖨️ Imprimer</button>
    </nav>
    <main class="stockDashMain">
      <aside class="stockFilterPanel no-print">
        <h3>Filtres</h3>
        <label>Filtre par catégorie<select id="stockDashCat" onchange="filterStockDashboardTable()"><option value="">Toutes les catégories</option>${cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label>
        <label>Filtre par nom du produit<input id="stockDashName" placeholder="Rechercher un produit..." oninput="filterStockDashboardTable()"></label>
        <label>Filtre par code<input id="stockDashCode" placeholder="Rechercher un code..." oninput="filterStockDashboardTable()"></label>
        <label>Filtre par statut<select id="stockDashStatus" onchange="filterStockDashboardTable()"><option value="">Tous les statuts</option><option value="en stock">En stock</option><option value="stock faible">Stock faible</option><option value="rupture">Rupture</option></select></label>
        <div class="stockFilterBtns"><button onclick="filterStockDashboardTable()">Filtrer</button><button type="button" onclick="resetStockDashboardFilters()">Réinitialiser</button></div>
      </aside>
      <section class="stockTablePanel">
        <div class="stockTablePanelHead"><div><h3>Produits enregistrés</h3><p id="stockDashCount">${items.length} produit(s) ou service(s)</p></div><div class="stockMiniLegend"><span class="stockBadge in">En stock</span><span class="stockBadge low">Stock faible</span><span class="stockBadge out">Rupture</span></div></div>
        <div class="stockDashTableWrap"><table class="stockDashTable"><thead><tr><th>Code</th><th>Img</th><th>Produit</th><th>Cat.</th><th>Qté</th><th>Achat</th><th>Vente</th><th>Val. stock</th><th>État</th><th>Act.</th></tr></thead><tbody id="stockDashTbody">${items.map(i=>stockDashRow(i,admin,sales)).join('')||'<tr><td colspan="10">Aucun produit ou service enregistré.</td></tr>'}</tbody><tfoot><tr><td colspan="7">Total liste affichée</td><td id="stockDashTotalValue">${money(stats.valueStock)}</td><td colspan="2"></td></tr></tfoot></table></div>
      </section>
    </main>
    ${stockEvolutionBlock(items,sales)}
    <script>setTimeout(function(){filterStockDashboardTable();},80)</script>
  </div>`;
}
function stockDashCard(icon,title,value,evolution,type,extra){return `<article class="stockDashCard ${type||''}"><div class="stockDashCardIcon">${icon}</div><div><span>${esc(title)}</span><strong>${esc(value)}</strong><small>${esc(evolution)}</small>${extra?`<em class="stockCardExtra">${esc(extra)}</em>`:''}</div></article>`;}
function stockDashboardStatus(i){
  if(!isBoutiqueItem(i)) return {label:'En stock',key:'en stock',cls:'in',qty:'Service',value:0};
  const qty=i.stockType==='unlimited'?999999:Number(i.stock||0), min=Number(i.alert||5), buy=Number(i.buy||0);
  if(i.stockType==='unlimited') return {label:'En stock',key:'en stock',cls:'in',qty:'Illimité',value:0};
  if(qty<=0) return {label:'Rupture',key:'rupture',cls:'out',qty:0,value:0};
  if(qty<=min) return {label:'Stock faible',key:'stock faible',cls:'low',qty,value:qty*buy};
  return {label:'En stock',key:'en stock',cls:'in',qty,value:qty*buy};
}
function stockDashboardStats(items=[],sales=[]){
  const cats=new Set(items.map(i=>i.cat).filter(Boolean));
  return items.reduce((a,i)=>{
    const st=stockDashboardStatus(i);
    if(isBoutiqueItem(i)){
      a.products++;
      const qty=(i.stockType==='unlimited')?0:Math.max(0,Number(i.stock||0));
      const buy=Number(i.buy||0);
      const sell=Number(itemMarketPrice(i)||i.sell||0);
      a.profitStock+=qty*(sell-buy);
      a.saleValue+=qty*sell;
    }else{
      a.services++;
      const serviceProfit=Number(itemMarketPrice(i)||i.sell||0)-Number(i.serviceCost||0);
      if((i.serviceAvailable||'yes')!=='no') a.profitServices+=serviceProfit;
    }
    if(st.cls==='low')a.low++;
    if(st.cls==='out')a.out++;
    a.valueStock+=Number(st.value||0);
    return a;
  },{categories:cats.size,products:0,services:0,low:0,out:0,valueStock:0,saleValue:0,profitStock:0,profitServices:0});
}
function stockDashRow(i,admin=false,sales=[]){
  const st=stockDashboardStatus(i), s=stockStatsForItem(i,sales||[]), img=i.photo?`<img loading="lazy" decoding="async" src="${esc(i.photo)}" alt="${esc(i.name||'Produit')}">`:'<span class="stockNoImg">📦</span>';
  const search=[i.name,i.cat,i.code,st.label,i.buy,i.sell,st.qty].join(' ').toLowerCase();
  return `<tr class="stockDashRow" data-id="${esc(i.id)}" data-search="${esc(search)}" data-cat="${esc(String(i.cat||'').toLowerCase())}" data-name="${esc(String(i.name||'').toLowerCase())}" data-code="${esc(String(i.code||'').toLowerCase())}" data-status="${esc(st.key)}" data-value="${Number(st.value||0)}">
    <td data-label="Code"><b>${esc(i.code||'-')}</b></td>
    <td data-label="Image"><div class="stockProductImg">${img}</div></td>
    <td data-label="Produit"><strong>${esc(i.name||'')}</strong><small>${esc(i.detail||i.marketplaceDesc||'')}</small></td>
    <td data-label="Catégorie">${esc(i.cat||'-')}</td>
    <td data-label="Quantité">${esc(st.qty)}</td>
    <td data-label="Prix d’achat">${isBoutiqueItem(i)?money(i.buy||0):'-'}</td>
    <td data-label="Prix de vente">${money(itemMarketPrice(i)||i.sell||0)}</td>
    <td data-label="Valeur stock"><b>${money(st.value)}</b></td>
    <td data-label="Statut"><span class="stockBadge ${st.cls}">${esc(st.label)}</span></td>
    <td data-label="Actions"><div class="stockDashRowActions"><button title="Voir détails" onclick="openStockItemDetailPro('${esc(i.id)}')">👁️</button>${admin?`<button title="Modifier" onclick="openStockItemPopup('${esc(i.id)}')">✏️</button><button title="Supprimer" class="dangerMini" onclick="deleteItem('${esc(i.id)}')">🗑️</button>`:''}</div></td>
  </tr>`;
}
function filterStockDashboardTable(){
  const q=String(document.getElementById('stockDashGlobalSearch')?.value||'').toLowerCase();
  const cat=String(document.getElementById('stockDashCat')?.value||'').toLowerCase();
  const name=String(document.getElementById('stockDashName')?.value||'').toLowerCase();
  const code=String(document.getElementById('stockDashCode')?.value||'').toLowerCase();
  const status=String(document.getElementById('stockDashStatus')?.value||'').toLowerCase();
  let count=0,total=0;
  document.querySelectorAll('.stockDashRow').forEach(r=>{
    let ok=true;
    if(q && !(r.dataset.search||'').includes(q)) ok=false;
    if(cat && r.dataset.cat!==cat) ok=false;
    if(name && !(r.dataset.name||'').includes(name)) ok=false;
    if(code && !(r.dataset.code||'').includes(code)) ok=false;
    if(status && r.dataset.status!==status) ok=false;
    r.dataset.match=ok?'1':'0'; r.style.display=ok?'':'none';
    if(ok){count++; total+=Number(r.dataset.value||0);}
  });
  const c=document.getElementById('stockDashCount'); if(c)c.textContent=count+' produit(s) ou service(s) trouvé(s)';
  const t=document.getElementById('stockDashTotalValue'); if(t)t.textContent=money(total);
}
function legacy1_resetStockDashboardFilters(){['stockDashGlobalSearch','stockDashCat','stockDashName','stockDashCode','stockDashStatus'].forEach(id=>{const el=document.getElementById(id); if(el)el.value='';}); filterStockDashboardTable();}
function getDashboardFilteredStockItems(){
  const {d,company}=current(); const items=(d.items||[]).filter(i=>i.companyId===company.id); const rows=[...document.querySelectorAll('.stockDashRow')].filter(r=>r.dataset.match==='1' || r.style.display!=='none');
  if(rows.length){const ids=new Set(rows.map(r=>r.dataset.id)); return items.filter(i=>ids.has(i.id));}
  return items;
}
function stockMovementsForCompany(d,companyId){d.stockMovements=Array.isArray(d.stockMovements)?d.stockMovements:[]; return d.stockMovements.filter(m=>m.companyId===companyId);}
function legacy1_stockMovementRows(i,type){
  const {d,company}=current(); const rows=stockMovementsForCompany(d,company.id).filter(m=>m.itemId===i.id && (!type || m.type===type)).sort((a,b)=>new Date(b.date||b.createdAt)-new Date(a.date||a.createdAt));
  return rows.map(m=>`<tr><td>${esc((m.date||m.createdAt||'').slice(0,10))}</td><td>${esc(m.type==='entry'?'Entrée':'Sortie')}</td><td>${Number(m.qty||0)}</td><td>${m.type==='entry'?money(m.buy||0):esc(m.reason||'-')}</td><td>${esc(m.supplier||m.note||'')}</td></tr>`).join('')||'<tr><td colspan="5">Aucun historique enregistré.</td></tr>';
}
function legacy1_stockDetailMovementBlocks(i){
  const {user}=current(); const currentUser=esc(user?.name||user?.email||'Utilisateur');
  if(!isBoutiqueItem(i)) return `<section class="stockFormBlock"><h3>Approvisionnement / Retrait</h3><p class="sub">Ces opérations concernent uniquement les produits physiques. Cet élément est un service.</p></section>`;
  return `<input id="pEdit" type="hidden" value="${esc(i.id||'')}"><section class="stockFormBlock stockDetailMoveBlock"><h3>Approvisionnement</h3><p class="sub">Ajouter une quantité au stock existant depuis la fiche détaillée.</p><div class="stockFullGrid"><label>Produit concerné<input readonly value="${esc(i.name||'')} — ${esc(i.code||'')}"><input id="stockFullSupplyItem" type="hidden" value="${esc(i.id||'')}"></label><label>Quantité à ajouter<input id="stockFullSupplyQty" type="number" min="1" value="1"></label><label>Prix d’achat de l’approvisionnement<input id="stockFullSupplyBuy" type="number" min="0" value="${Number(i.buy||0)}"></label><label>Fournisseur<input id="stockFullSupplySupplier" placeholder="Fournisseur"></label><label>Date<input id="stockFullSupplyDate" type="date" value="${today()}"></label><label>Note<input id="stockFullSupplyNote" placeholder="Note"></label></div><div class="modalActions"><button class="orangeBtn" onclick="saveStockSupplyFromFull()">⬇️ Approvisionner</button></div></section><section class="stockFormBlock stockDetailMoveBlock"><h3>Retrait / sortie de stock</h3><p class="sub">Retirer une quantité du stock avec contrôle du stock disponible.</p><div class="stockFullGrid"><label>Produit concerné<input readonly value="${esc(i.name||'')} — stock ${i.stockType==='unlimited'?'illimité':Number(i.stock||0)}"><input id="stockFullOutItem" type="hidden" value="${esc(i.id||'')}"></label><label>Quantité à retirer<input id="stockFullOutQty" type="number" min="1" value="1"></label><label>Motif du retrait<select id="stockFullOutReason"><option>vente</option><option>perte</option><option>produit endommagé</option><option>transfert</option><option>usage interne</option><option>correction de stock</option><option>autre</option></select></label><label>Date<input id="stockFullOutDate" type="date" value="${today()}"></label><label>Responsable<input id="stockFullOutResponsible" value="${currentUser}"></label><label>Note<input id="stockFullOutNote" placeholder="Note"></label></div><div class="modalActions"><button class="danger" onclick="saveStockOutputFromFull()">⬆️ Retirer du stock</button></div></section>`;
}
function legacy1_openStockItemDetailPro(iid){
  const {d,company}=current(); const i=(d.items||[]).find(x=>x.id===iid&&x.companyId===company.id); if(!i)return g3Alert('Élément introuvable.','Gestion de stock','warn');
  const sales=getCompanyValidatedSales(); const s=stockStatsForItem(i,sales); const st=stockDashboardStatus(i); const benefPotential=isBoutiqueItem(i)?Math.max(0,Number(i.stock||0)*(Number(i.sell||0)-Number(i.buy||0))):0;
  const salesRows=s.sales.map(x=>`<tr><td>${new Date(x.date).toLocaleString('fr-FR')}</td><td>${esc(x.client||'-')}</td><td>${Number(x.qty||0)}</td><td>${money(x.total||0)}</td><td>${money(x.profit||0)}</td></tr>`).join('')||'<tr><td colspan="5">Aucune vente enregistrée.</td></tr>';
  const html=`<div class="modalBackdrop stockModalBackdrop" onclick="closeStockModal(event)"><div class="stockProModal stockDetailModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockModalBackdrop')?.remove()">×</button><h2>Voir détails</h2><p class="sub">Informations détaillées du produit ou service sélectionné.</p><div class="stockDetailHero"><div class="stockProductImg big">${i.photo?`<img loading="lazy" decoding="async" src="${esc(i.photo)}" alt="${esc(i.name||'Produit')}">`:'📦'}</div><div><h3>${esc(i.name||'')}</h3><span class="stockBadge ${st.cls}">${esc(st.label)}</span><p>${esc(i.detail||i.marketplaceDesc||'Aucune description.')}</p></div></div><div class="stockDetailGrid"><div><small>Code</small><b>${esc(i.code||'-')}</b></div><div><small>Catégorie</small><b>${esc(i.cat||'-')}</b></div><div><small>Quantité</small><b>${esc(st.qty)}</b></div><div><small>Prix d’achat</small><b>${isBoutiqueItem(i)?money(i.buy||0):'-'}</b></div><div><small>Prix de vente</small><b>${money(itemMarketPrice(i)||i.sell||0)}</b></div><div><small>Valeur du stock</small><b>${money(st.value)}</b></div><div><small>Bénéfice potentiel</small><b>${money(benefPotential)}</b></div><div><small>Bénéfice réalisé</small><b>${money(s.realized)}</b></div></div>${stockDetailMovementBlocks(i)}<h3>Historique des entrées</h3><table class="g2table"><tr><th>Date</th><th>Type</th><th>Quantité</th><th>Prix / motif</th><th>Fournisseur / note</th></tr>${stockMovementRows(i,'entry')}</table><h3>Historique des sorties</h3><table class="g2table"><tr><th>Date</th><th>Type</th><th>Quantité</th><th>Prix / motif</th><th>Fournisseur / note</th></tr>${stockMovementRows(i,'output')}</table><h3>Historique des ventes</h3><table class="g2table"><tr><th>Date</th><th>Client</th><th>Quantité</th><th>Total</th><th>Bénéfice</th></tr>${salesRows}</table><div class="modalActions"><button class="darkBtn" onclick="openStockItemPdfPage('${esc(i.id)}')">Imprimer</button><button class="btn2" onclick="document.querySelector('.stockModalBackdrop')?.remove()">Fermer</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function stockProductOptions(){
  const {d,company}=current(); return (d.items||[]).filter(i=>i.companyId===company.id&&isBoutiqueItem(i)).map(i=>`<option value="${esc(i.id)}">${esc(i.name||'Produit')} — ${esc(i.code||'')} — stock ${i.stockType==='unlimited'?'illimité':Number(i.stock||0)}</option>`).join('');
}
function openStockEntryPopup(){
  if(!requireAdmin('La caisse ne peut pas gérer les entrées de stock.')) return;
  const opts=stockProductOptions();
  const html=`<div class="modalBackdrop stockModalBackdrop" onclick="closeStockModal(event)"><div class="stockProModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockModalBackdrop')?.remove()">×</button><h2>Entrées de stock</h2><p class="sub">Enregistrer une entrée, augmenter automatiquement la quantité et conserver l’historique.</p><div class="grid two"><label>Produit<select id="stockEntryItem" onchange="fillStockMoveInfo('entry')"><option value="">Sélectionner un produit</option>${opts}</select></label><label>Code produit<input id="stockEntryCode" readonly></label><label>Catégorie<input id="stockEntryCat" readonly></label><label>Quantité entrée<input id="stockEntryQty" type="number" min="1" value="1"></label><label>Prix d’achat<input id="stockEntryBuy" type="number" min="0"></label><label>Fournisseur<input id="stockEntrySupplier" placeholder="Nom du fournisseur"></label><label>Date d’entrée<input id="stockEntryDate" type="date" value="${today()}"></label><label>Note<input id="stockEntryNote" placeholder="Observation"></label></div><div class="modalActions"><button class="orangeBtn" onclick="saveStockEntry()">Enregistrer</button><button class="btn2" onclick="document.querySelector('.stockModalBackdrop')?.remove()">Annuler</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function openStockOutputPopup(){
  if(!requireAdmin('La caisse ne peut pas gérer les sorties de stock.')) return;
  const opts=stockProductOptions();
  const html=`<div class="modalBackdrop stockModalBackdrop" onclick="closeStockModal(event)"><div class="stockProModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockModalBackdrop')?.remove()">×</button><h2>Sorties de stock</h2><p class="sub">Enregistrer une sortie, diminuer automatiquement la quantité et empêcher les sorties supérieures au stock disponible.</p><div class="grid two"><label>Produit<select id="stockOutputItem" onchange="fillStockMoveInfo('output')"><option value="">Sélectionner un produit</option>${opts}</select></label><label>Code produit<input id="stockOutputCode" readonly></label><label>Catégorie<input id="stockOutputCat" readonly></label><label>Quantité sortie<input id="stockOutputQty" type="number" min="1" value="1"></label><label>Motif de sortie<input id="stockOutputReason" placeholder="Casse, retrait interne, correction..."></label><label>Date<input id="stockOutputDate" type="date" value="${today()}"></label><label class="fullRow">Note<input id="stockOutputNote" placeholder="Observation"></label></div><div class="modalActions"><button class="orangeBtn" onclick="saveStockOutput()">Enregistrer</button><button class="btn2" onclick="document.querySelector('.stockModalBackdrop')?.remove()">Annuler</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function fillStockMoveInfo(type){
  const {d,company}=current(); const prefix=type==='entry'?'stockEntry':'stockOutput'; const idv=document.getElementById(prefix+'Item')?.value||''; const it=(d.items||[]).find(i=>i.id===idv&&i.companyId===company.id); if(!it)return;
  const code=document.getElementById(prefix+'Code'), cat=document.getElementById(prefix+'Cat'); if(code)code.value=it.code||''; if(cat)cat.value=it.cat||''; if(type==='entry'){const buy=document.getElementById('stockEntryBuy'); if(buy)buy.value=Number(it.buy||0);}
}
function saveStockEntry(){
  if(!requireAdmin()) return; const {d,company}=current(); const idv=document.getElementById('stockEntryItem')?.value||''; const it=(d.items||[]).find(i=>i.id===idv&&i.companyId===company.id); if(!it)return alert('Sélectionnez un produit.');
  const qty=Math.max(0,Number(document.getElementById('stockEntryQty')?.value||0)); if(qty<=0)return alert('Quantité entrée obligatoire.');
  const buy=Math.max(0,Number(document.getElementById('stockEntryBuy')?.value||it.buy||0)); const oldStock=it.stockType==='unlimited'?0:Number(it.stock||0); if(it.stockType!=='unlimited') it.stock=oldStock+qty; it.stockInitial=Number(it.stockInitial ?? oldStock)+qty; if(buy) it.buy=buy; it.updatedAt=new Date().toISOString();
  d.stockMovements=Array.isArray(d.stockMovements)?d.stockMovements:[]; d.stockMovements.push({id:id('ent'),companyId:company.id,itemId:it.id,code:it.code||'',cat:it.cat||'',product:it.name||'',type:'entry',qty,buy,supplier:document.getElementById('stockEntrySupplier')?.value||'',date:document.getElementById('stockEntryDate')?.value||today(),note:document.getElementById('stockEntryNote')?.value||'',createdAt:new Date().toISOString()});
  save(d); document.querySelector('.stockModalBackdrop')?.remove(); alert('Entrée de stock enregistrée avec succès.'); renderDash('stocks');
}
function saveStockOutput(){
  if(!requireAdmin()) return; const {d,company}=current(); const idv=document.getElementById('stockOutputItem')?.value||''; const it=(d.items||[]).find(i=>i.id===idv&&i.companyId===company.id); if(!it)return alert('Sélectionnez un produit.');
  const qty=Math.max(0,Number(document.getElementById('stockOutputQty')?.value||0)); if(qty<=0)return alert('Quantité sortie obligatoire.'); if(it.stockType!=='unlimited' && qty>Number(it.stock||0)) return alert('Sortie impossible : quantité supérieure au stock disponible.');
  if(it.stockType!=='unlimited') it.stock=Number(it.stock||0)-qty; it.updatedAt=new Date().toISOString(); d.stockMovements=Array.isArray(d.stockMovements)?d.stockMovements:[]; d.stockMovements.push({id:id('sor'),companyId:company.id,itemId:it.id,code:it.code||'',cat:it.cat||'',product:it.name||'',type:'output',qty,reason:document.getElementById('stockOutputReason')?.value||'',date:document.getElementById('stockOutputDate')?.value||today(),note:document.getElementById('stockOutputNote')?.value||'',createdAt:new Date().toISOString()});
  save(d); document.querySelector('.stockModalBackdrop')?.remove(); alert('Sortie de stock enregistrée avec succès.'); renderDash('stocks');
}
function openStockCategoriesDashboard(){
  const {d,company}=current(); const items=(d.items||[]).filter(i=>i.companyId===company.id), sales=getCompanyValidatedSales(), records=getCompanyCategoryRecords(d,company.id);
  const body=records.map(c=>stockCategoryCard(c,items,true,sales)).join('')||'<div class="emptyCart">Aucune catégorie enregistrée.</div>';
  const html=`<div class="modalBackdrop stockModalBackdrop" onclick="closeStockModal(event)"><div class="stockProModal stockCategoriesModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockModalBackdrop')?.remove()">×</button><div class="stockPageTitle"><div><h2>Gestion des catégories</h2><p>Liste des catégories, nombre de produits, valeurs d’achat, ventes estimées et bénéfices potentiels.</p></div><button class="orangeBtn" onclick="openStockCategoryPopup()">+ Ajouter catégorie</button></div><div class="stockCategoryGrid">${body}</div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function openDashboardStockPrint(){
  const {company}=current(); const rows=getDashboardFilteredStockItems(); const html=standaloneStockHTML(company,rows,'Rapport gestion de stock'); const w=window.open('','_blank'); if(!w){const blob=new Blob([html],{type:'text/html;charset=utf-8'}); location.href=URL.createObjectURL(blob); return;} w.document.open(); w.document.write(html); w.document.close();
}
function stockEvolutionBlock(items=[],sales=[]){
  const range=window.g3StockChartRange||'6', months=range==='year'?(new Date().getMonth()+1):Number(range||6), data=stockEvolutionData(items,sales,months); const max=Math.max(1,...data.map(x=>x.value));
  const pts=data.map((x,i)=>{const xPos=40+(i*(520/Math.max(1,data.length-1))); const yPos=180-(x.value/max*140); return `${xPos},${yPos}`;}).join(' ');
  const circles=data.map((x,i)=>{const xPos=40+(i*(520/Math.max(1,data.length-1))); const yPos=180-(x.value/max*140); return `<circle cx="${xPos}" cy="${yPos}" r="4"><title>${esc(x.label)} : ${money(x.value)}</title></circle>`;}).join('');
  const labels=data.map((x,i)=>{const xPos=40+(i*(520/Math.max(1,data.length-1))); return `<text x="${xPos}" y="214" text-anchor="middle">${esc(x.label)}</text>`;}).join('');
  const current=data[data.length-1]?.value||0, previous=data[data.length-2]?.value||current, pct=previous?(((current-previous)/previous)*100):0;
  return `<section class="stockEvolution"><div class="stockEvolutionHead"><div><h3>Évolution de la valeur du stock</h3><p>Suivi automatique basé sur le stock actuel, les ventes et les mouvements enregistrés.</p></div><select class="no-print" onchange="window.g3StockChartRange=this.value;renderDash('stocks')"><option value="6" ${range==='6'?'selected':''}>6 derniers mois</option><option value="12" ${range==='12'?'selected':''}>12 derniers mois</option><option value="year" ${range==='year'?'selected':''}>Cette année</option></select></div><div class="stockEvolutionGrid"><div class="stockChartBox"><svg viewBox="0 0 600 230" role="img" aria-label="Évolution de la valeur du stock"><defs><linearGradient id="stockArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#0d6efd" stop-opacity=".25"/><stop offset="100%" stop-color="#0d6efd" stop-opacity=".03"/></linearGradient></defs><path d="M40 190 L40 180 ${data.map((x,i)=>{const xPos=40+(i*(520/Math.max(1,data.length-1))); const yPos=180-(x.value/max*140); return `L${xPos} ${yPos}`;}).join(' ')} L560 190 Z" fill="url(#stockArea)"></path><polyline points="${pts}" fill="none" stroke="#0d6efd" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></polyline>${circles}${labels}</svg></div><aside class="stockCurrentValue"><span>Valeur actuelle</span><strong>${money(current)}</strong><small>${pct>=0?'↑':'↓'} ${Math.abs(pct).toFixed(1).replace('.',',')} %</small></aside></div></section>`;
}
function stockEvolutionData(items=[],sales=[],months=6){
  const {d,company}=current(); const now=new Date(); const moves=stockMovementsForCompany(d,company.id); const out=[];
  for(let n=months-1;n>=0;n--){const dt=new Date(now.getFullYear(),now.getMonth()-n,1); const end=new Date(dt.getFullYear(),dt.getMonth()+1,0,23,59,59); let value=0; items.forEach(i=>{if(!isBoutiqueItem(i))return; let qty=i.stockType==='unlimited'?0:Number(i.stock||0); sales.filter(s=>String(s.itemId||'')===String(i.id||'') && new Date(s.date)>end).forEach(s=>qty+=Number(s.qty||0)); moves.filter(m=>m.itemId===i.id && new Date(m.date||m.createdAt)>end).forEach(m=>{qty += m.type==='output'?Number(m.qty||0):-Number(m.qty||0);}); value+=Math.max(0,qty)*Number(i.buy||0);}); out.push({label:String(dt.getMonth()+1).padStart(2,'0')+'/'+String(dt.getFullYear()).slice(2),value});}
  return out;
}


/* === CORRECTION FINALE — Gestion de stock : ligne filtres + popup complet produit/service === */
function stockSection(items,admin=false,sales=[]){
  const {d,company,user}=current();
  items=items||[]; sales=sales||[];
  window.g3StockChartRange=window.g3StockChartRange||'6';
  const cats=getCompanyCategories(d,company.id);
  const stats=stockDashboardStats(items,sales);
  const avatar=(user?.name||company?.name||'U').trim().slice(0,1).toUpperCase();
  return `<div class="stockDashShell stockDashShellFinal">
    <header class="stockDashHeader no-print">
      <div class="stockDashTitle"><h2>Gestion de stock</h2><p>Tableau de bord moderne des produits, catégories, valeurs du stock et mouvements.</p></div>
      <div class="stockGlobalSearch"><span>🔎</span><input id="stockDashGlobalSearch" placeholder="Rechercher un produit, une catégorie, un code..." oninput="filterStockDashboardTable()"></div>
      <div class="stockUserZone">
        <button title="Notifications">🔔<b>${stats.low+stats.out}</b></button><button title="Aide">❔</button><button title="Paramètres" onclick="show('param')">⚙️</button>
        <div class="stockAvatar">${esc(avatar)}</div><div class="stockUserText"><strong>${esc(user?.name||company?.owner||company?.name||'Utilisateur')}</strong><small>${esc(user?.role||'Administrateur')}</small></div><span>⌄</span>
      </div>
    </header>
    <section class="stockDashStatGrid">
      ${stockDashCard('▦','Catégories',stats.categories,'0 % depuis le mois dernier','neutral')}
      ${stockDashCard('🛍️','Produits',stats.products,'↑ 12 % depuis le mois dernier','good')}
      ${stockDashCard('⚠️','Stock faible',stats.low,'↑ 9 % depuis le mois dernier','warn')}
      ${stockDashCard('🗄️','Valeur du stock',money(stats.valueStock),'Bénéfices : '+money((Number(stats.profitStock||0)+Number(stats.profitServices||0))),'good','↑ 8,5 % depuis le mois dernier')}
    </section>
    <div class="stockPrimaryActionLine no-print">
      ${admin?'<button class="stockAddMainBtn" onclick="openStockItemPopup()">➕ Ajouter un produit/service</button><button class="stockAddCategoryBtn" onclick="openStockCategoryPopup()">🏷️ Ajouter une catégorie</button>':''}
    </div>
    <nav class="stockDashActions stockFilterHorizontalLine no-print">
      <label class="stockTopFilter"><span>Catégorie</span><select id="stockDashCat" onchange="filterStockDashboardTable()"><option value="">Toutes</option>${cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label>
      <label class="stockTopFilter"><span>Nom du produit</span><input id="stockDashName" placeholder="Rechercher..." oninput="filterStockDashboardTable()"></label>
      <label class="stockTopFilter"><span>Code</span><input id="stockDashCode" placeholder="Code" oninput="filterStockDashboardTable()"></label>
      <label class="stockTopFilter"><span>Statut</span><select id="stockDashStatus" onchange="filterStockDashboardTable()"><option value="">Tous</option><option value="en stock">En stock</option><option value="stock faible">Stock faible</option><option value="rupture">Rupture</option></select></label>
      <button class="stockPrintTopBtn" onclick="openDashboardStockPrint()">🖨️ Imprimer</button>
    </nav>
    <main class="stockDashMain stockDashMainNoFilter">
      <section class="stockTablePanel">
        <div class="stockTablePanelHead"><div><h3>Produits enregistrés</h3><p id="stockDashCount">${items.length} produit(s) ou service(s)</p></div><div class="stockMiniLegend"><span class="stockBadge in">En stock</span><span class="stockBadge low">Stock faible</span><span class="stockBadge out">Rupture</span></div></div>
        <div class="stockDashTableWrap"><table class="stockDashTable"><thead><tr><th>Code</th><th>Img</th><th>Produit</th><th>Cat.</th><th>Qté</th><th>Achat</th><th>Vente</th><th>Val. stock</th><th>État</th><th>Act.</th></tr></thead><tbody id="stockDashTbody">${items.map(i=>stockDashRow(i,admin,sales)).join('')||'<tr><td colspan="10">Aucun produit ou service enregistré.</td></tr>'}</tbody><tfoot><tr><td colspan="7">Total liste affichée</td><td id="stockDashTotalValue">${money(stats.valueStock)}</td><td colspan="2"></td></tr></tfoot></table></div>
      </section>
    </main>
    ${stockEvolutionBlock(items,sales)}
    <script>setTimeout(function(){filterStockDashboardTable();},80)</script>
  </div>`;
}

function openStockItemPopup(iid=''){
  if(!requireAdmin('La caisse ne peut pas gérer les stocks.')) return;
  const {d,company}=current(); const i=iid?(d.items||[]).find(x=>x.id===iid&&x.companyId===company.id):null;
  const html=`<div class="modalBackdrop stockModalBackdrop" onclick="closeStockModal(event)"><div class="stockProModal stockItemFullModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockModalBackdrop')?.remove()">×</button>${stockFullItemForm(company,i)}</div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  setTimeout(()=>{ if(i){fillStockItemForm(i);} else {clearItemForm(); stockSelectItemType('boutique');} stockUpdateFullCalc(); },80);
}

function stockFullItemForm(company,item=null){
  const {d,user}=current();
  const catRecords=getCompanyCategoryRecords(d,company.id);
  const catOptions='<option value="">Sélectionner une catégorie</option>'+catRecords.map(c=>`<option value="${esc(c.name)}" data-kind="${esc(c.kind||'boutique')}">${esc(c.name)} — ${c.kind==='service'?'Service':'Produit'}</option>`).join('');
  const productOptions=(d.items||[]).filter(i=>i.companyId===company.id&&isBoutiqueItem(i)).map(i=>`<option value="${esc(i.id)}">${esc(i.name||'Produit')} — ${esc(i.code||'')} — stock ${i.stockType==='unlimited'?'illimité':Number(i.stock||0)}</option>`).join('');
  const editing=!!item;
  const currentUser=esc(user?.name||user?.email||'Utilisateur');
  return `<div class="stockFullForm">
    <div class="stockFullHeader"><div><h2>Ajouter / modifier un produit ou service</h2><p>Formulaire complet de création et modification.</p></div><span class="stockFullBadge">GLOBAL MARKET</span></div>
    <input id="pEdit" type="hidden" value="${esc(item?.id||'')}"><input id="pType" type="hidden" value="${item?(isBoutiqueItem(item)?'boutique':'service'):'boutique'}">
    <section class="stockFormBlock"><h3>1. Type d’élément</h3><div class="stockTypeChooser"><button type="button" id="typeProductBtn" onclick="stockSelectItemType('boutique')">📦 Produit</button><button type="button" id="typeServiceBtn" onclick="stockSelectItemType('service')">🧾 Service</button></div></section>
    <section class="stockFormBlock"><h3>2. Informations principales</h3><div class="stockFullGrid">
      <label>Catégorie <select id="pCat" required onchange="stockSyncTypeFromCategory(); stockUpdateFullCalc()">${catOptions}</select></label>
      <label>Code <div class="stockInlineAdd"><input id="pCode" value="${editing?esc(item.code||''):esc(uniqueItemCode(d,company.id))}" placeholder="PRD001 ou SRV001"><button type="button" onclick="stockGenerateCode()">Auto</button></div></label>
      <label>Nom du produit ou service <input id="pName" placeholder="Exemple : Ordinateur portable, Impression couleur, Transfert mobile money..." oninput="stockUpdateFullCalc()"></label>
      <label>Description / Détails <textarea id="pDetail" rows="3" placeholder="Décrire le produit ou le service"></textarea></label>
      <label>Image <div class="stockPhotoBox"><div id="pPhotoPreview" class="stockPhotoPreview stockPhotoEmpty"><span class="photoIcon">📷</span><strong>Aucune photo</strong><small>Aperçu immédiat après sélection.</small></div><div class="photoActions"><label class="photoChooseBtn" for="pPhoto">Choisir une image</label><button type="button" class="photoDeleteBtn" onclick="removeStockPhoto()">Supprimer</button></div><input id="pPhoto" class="photoInputHidden" type="file" accept="image/*" onchange="previewStockPhoto(this)"><input id="pPhotoData" type="hidden"><input id="pRemovePhoto" type="checkbox" class="hidden"></div></label>
    </div></section>
    <section class="stockFormBlock productFields"><h3>3. Champs spécifiques aux produits</h3><div class="stockFullGrid">
      <label>Quantité initiale <input id="pStock" type="number" min="0" value="0" oninput="stockUpdateFullCalc()"></label>
      <label>Seuil minimum de stock <input id="pAlert" type="number" min="0" value="5" oninput="stockUpdateFullCalc()"></label>
      <label>Prix d’achat unitaire <input id="pBuy" type="number" min="0" placeholder="FCFA" oninput="stockUpdateFullCalc()"></label>
      <label>Prix de vente unitaire <input id="pSell" type="number" min="0" placeholder="FCFA" oninput="stockUpdateFullCalc()"></label>
      <label>Fournisseur <input id="pSupplier" placeholder="Nom du fournisseur"></label>
      <label>Date d’approvisionnement <input id="pSupplyDate" type="date" value="${today()}"></label>
      <label>Emplacement / rayon <input id="pLocation" placeholder="Rayon A, dépôt 1..."></label>
      <label>Type de stock <select id="pStockType" onchange="toggleStockQuantityField(); stockUpdateFullCalc()"><option value="limited">Stock limité</option><option value="unlimited">Stock illimité</option></select></label>
    </div></section>
    <section class="stockFormBlock serviceFields"><h3>4. Champs spécifiques aux services</h3><div class="stockFullGrid">
      <label>Prix de base du service <input id="pServiceBase" type="number" min="0" placeholder="FCFA" oninput="stockUpdateFullCalc()"></label>
      <label>Frais du service <input id="pServiceFee" type="number" min="0" placeholder="FCFA" oninput="stockUpdateFullCalc()"></label>
      <label>Coût interne estimé <input id="pServiceCost" type="number" min="0" placeholder="FCFA" oninput="stockUpdateFullCalc()"></label>
      <label>Durée estimée <input id="pServiceDuration" placeholder="30 minutes, 1 jour..."></label>
      <label>Responsable du service <input id="pServiceResponsible" value="${currentUser}" placeholder="Responsable"></label>
      <label>Service disponible <select id="pServiceAvailable"><option value="yes">Oui</option><option value="no">Non</option></select></label>
      <input id="pServicePrice" type="hidden"><input id="pCharge" type="hidden" value="30">
    </div></section>
    <section class="stockFormBlock"><h3>5. Calculs automatiques</h3><div class="stockCalcGrid"><div><small>Valeur totale d’achat</small><b id="calcBuyTotal">0 FCFA</b></div><div><small>Valeur totale de vente estimée</small><b id="calcSaleTotal">0 FCFA</b></div><div><small>Bénéfice potentiel estimé</small><b id="calcBenefitTotal">0 FCFA</b></div><div><small>Statut</small><b id="calcStockStatus">En stock</b></div></div></section>
    <section class="stockFormBlock"><h3>6. Historique des mouvements</h3><div class="stockHistoryFilters no-print"><input id="stockHxDate" type="date" onchange="filterStockFullHistory()"><select id="stockHxType" onchange="filterStockFullHistory()"><option value="">Tous mouvements</option><option value="creation">Création</option><option value="modification">Modification</option><option value="entry">Approvisionnement</option><option value="output">Retrait</option></select><input id="stockHxResponsible" placeholder="Responsable" oninput="filterStockFullHistory()"></div><div class="stockHistoryWrap"><table class="g2table"><thead><tr><th>Date</th><th>Type</th><th>Qté avant</th><th>Qté mouvementée</th><th>Qté après</th><th>Responsable</th><th>Note</th></tr></thead><tbody id="stockFullHistoryBody">${stockFullHistoryRows(item?.id||'')}</tbody></table></div></section>
    <div class="stockFullActions no-print"><button class="orangeBtn" onclick="addItem()">💾 Enregistrer</button><button onclick="addItem()">✏️ Modifier</button><button class="btn2" onclick="clearItemForm()">↺ Réinitialiser</button><button class="btn2" onclick="document.querySelector('.stockModalBackdrop')?.remove()">Fermer</button><button class="darkBtn" onclick="printStockFormSheet()">🖨️ Imprimer fiche</button></div>
  </div>`;
}

function stockSelectItemType(type){
  const t=type==='service'?'service':'boutique'; const pType=$('#pType'); if(pType) pType.value=t;
  document.querySelector('.stockFullForm')?.classList.toggle('serviceMode',t==='service');
  document.querySelector('.stockFullForm')?.classList.toggle('productMode',t!=='service');
  $('#typeProductBtn')?.classList.toggle('active',t!=='service'); $('#typeServiceBtn')?.classList.toggle('active',t==='service');
  stockUpdateFullCalc();
}
function stockSyncTypeFromCategory(){ const opt=$('#pCat')?.selectedOptions?.[0]; if(opt?.dataset?.kind==='service') stockSelectItemType('service'); else if(opt?.dataset?.kind==='boutique') stockSelectItemType('boutique'); }
function stockGenerateCode(){ const {d,company}=current(); const t=$('#pType')?.value==='service'?'SRV':'PRD'; const el=$('#pCode'); if(el) el.value=uniqueItemCode(d,company.id).replace(/^ITM/i,t).slice(0,7); }
function stockQuickAddCategoryFromFullForm(){
  if(!requireAdmin()) return; const {d,company}=current(); const name=String($('#quickStockCat')?.value||'').trim(); if(!name) return g3Alert('Nom de catégorie obligatoire.','Catégorie');
  const kind=$('#pType')?.value==='service'?'service':'boutique'; const rows=getCompanyCategoryRecords(d,company.id); if(rows.some(c=>String(c.name||'').toLowerCase()===name.toLowerCase())) return g3Alert('Cette catégorie existe déjà.','Catégorie','warn');
  rows.push({name,kind}); saveCompanyCategoryRecords(d,company.id,rows); save(d); const sel=$('#pCat'); if(sel){ sel.insertAdjacentHTML('beforeend',`<option value="${esc(name)}" data-kind="${kind}">${esc(name)} — ${kind==='service'?'Service':'Produit'}</option>`); sel.value=name; } $('#quickStockCat').value=''; g3Alert('Catégorie ajoutée avec succès.','Catégorie'); stockSelectItemType(kind);
}
function stockUpdateFullCalc(){
  const type=$('#pType')?.value==='service'?'service':'boutique'; const qty= type==='service'?1:Math.max(0,Number($('#pStock')?.value||0)); const buy=type==='service'?Math.max(0,Number($('#pServiceCost')?.value||0)):Math.max(0,Number($('#pBuy')?.value||0));
  const sell= type==='service'?(Math.max(0,Number($('#pServiceBase')?.value||0))+Math.max(0,Number($('#pServiceFee')?.value||0))):Math.max(0,Number($('#pSell')?.value||0));
  const alertMin=Math.max(0,Number($('#pAlert')?.value||5)); let status='En stock'; if(type!=='service'){ if(qty<=0) status='Rupture'; else if(qty<=alertMin) status='Stock faible'; }
  const buyTotal=qty*buy, saleTotal=qty*sell, benefit=saleTotal-buyTotal;
  if($('#pServicePrice')) $('#pServicePrice').value=sell; if($('#pCharge')) $('#pCharge').value=sell>0?Math.round((buy/sell*100)*100)/100:0;
  if($('#calcBuyTotal')) $('#calcBuyTotal').textContent=money(buyTotal); if($('#calcSaleTotal')) $('#calcSaleTotal').textContent=money(saleTotal); if($('#calcBenefitTotal')) $('#calcBenefitTotal').textContent=money(benefit); if($('#calcStockStatus')) $('#calcStockStatus').textContent=status;
}
function fillStockItemForm(i){
  const {d,company}=current(); const isService=!isBoutiqueItem(i); stockSelectItemType(isService?'service':'boutique');
  $('#pEdit') && ($('#pEdit').value=i.id); $('#pCode') && ($('#pCode').value=i.code||uniqueItemCode(d,company.id,i.id)); $('#pName') && ($('#pName').value=i.name||''); $('#pDetail') && ($('#pDetail').value=i.marketplaceDesc||i.detail||'');
  $('#pCat') && ($('#pCat').value=i.cat||''); $('#pStockType') && ($('#pStockType').value=i.stockType||'limited'); $('#pStock') && ($('#pStock').value=i.stock||0); $('#pAlert') && ($('#pAlert').value=i.alert||5); $('#pBuy') && ($('#pBuy').value=i.buy||0); $('#pSell') && ($('#pSell').value=i.sell||0);
  $('#pSupplier') && ($('#pSupplier').value=i.supplier||''); $('#pSupplyDate') && ($('#pSupplyDate').value=(i.supplyDate||i.createdAt||today()).slice(0,10)); $('#pLocation') && ($('#pLocation').value=i.location||'');
  $('#pServiceBase') && ($('#pServiceBase').value=Number(i.serviceBase??i.sell??0)); $('#pServiceFee') && ($('#pServiceFee').value=Number(i.serviceFee||0)); $('#pServiceCost') && ($('#pServiceCost').value=Number(i.serviceCost||0)); $('#pServiceDuration') && ($('#pServiceDuration').value=i.serviceDuration||''); $('#pServiceResponsible') && ($('#pServiceResponsible').value=i.serviceResponsible||''); $('#pServiceAvailable') && ($('#pServiceAvailable').value=i.serviceAvailable==='no'?'no':'yes');
  setStockPhotoPreview(i.photo||''); const rm=$('#pRemovePhoto'); if(rm) rm.checked=false; ['stockFullSupplyItem','stockFullOutItem'].forEach(id=>{const el=$('#'+id); if(el) el.value=i.id;}); stockUpdateFullCalc();
}
function clearItemForm(){
  ['pEdit','pName','pDetail','pBuy','pSell','pServiceBase','pServiceFee','pServiceCost','pServiceDuration','pSupplier','pLocation','pPhotoData'].forEach(k=>{const el=$('#'+k); if(el) el.value='';});
  const {d,company,user}=current(); $('#pCode') && ($('#pCode').value=uniqueItemCode(d,company.id)); $('#pCat') && ($('#pCat').value=''); $('#pStock') && ($('#pStock').value=0); $('#pAlert') && ($('#pAlert').value=5); $('#pStockType') && ($('#pStockType').value='limited'); $('#pSupplyDate') && ($('#pSupplyDate').value=today()); $('#pServiceResponsible') && ($('#pServiceResponsible').value=user?.name||user?.email||''); $('#pServiceAvailable') && ($('#pServiceAvailable').value='yes'); setStockPhotoPreview(''); const pf=$('#pPhoto'); if(pf) pf.value=''; const rm=$('#pRemovePhoto'); if(rm) rm.checked=false; stockSelectItemType('boutique'); stockUpdateFullCalc();
}
async function addItem(){
  if(!requireAdmin('La caisse ne peut pas gérer les stocks.')) return; if(!ensureActiveExerciseEditable()) return;
  const {d,company,user}=current(), cid=company.id; d.items=Array.isArray(d.items)?d.items:[]; d.stockMovements=Array.isArray(d.stockMovements)?d.stockMovements:[];
  const eid=$('#pEdit')?.value||''; const existing=eid?d.items.find(i=>i.id===eid&&i.companyId===cid):null; const type=$('#pType')?.value==='service'?'service':'boutique'; const cat=String($('#pCat')?.value||'').trim(); const code=String($('#pCode')?.value||'').trim()||uniqueItemCode(d,cid,eid);
  if(!cat) return g3Alert('Catégorie obligatoire.','Ajouter / modifier','info'); const name=String($('#pName')?.value||'').trim(); if(!name) return g3Alert('Nom du produit ou service obligatoire.','Ajouter / modifier','info');
  if(d.items.some(i=>i.companyId===cid&&i.id!==eid&&String(i.code||'').toUpperCase()===code.toUpperCase())) return g3Alert('Ce code existe déjà. Veuillez utiliser un code unique.','Code obligatoire','warn');
  const qtyBefore=existing?Number(existing.stock||0):0; const serviceBase=Number($('#pServiceBase')?.value||0), serviceFee=Number($('#pServiceFee')?.value||0), serviceCost=Number($('#pServiceCost')?.value||0); const isService=type==='service';
  const stockType=isService?'none':($('#pStockType')?.value||'limited'); const stock=isService?0:(stockType==='unlimited'?0:Number($('#pStock')?.value||0)); const buy=isService?serviceCost:Number($('#pBuy')?.value||0); const sell=isService?(serviceBase+serviceFee):Number($('#pSell')?.value||0); const charge=sell>0?Math.round((buy/sell*100)*100)/100:0; const removePhoto=!!$('#pRemovePhoto')?.checked; const photoData=$('#pPhotoData')?.value||''; const photo=removePhoto?'':(photoData||existing?.photo||''); const detail=String($('#pDetail')?.value||'').trim();
  const obj={companyId:cid,code,name,cat,detail,marketplaceDesc:detail,buy,sell,stockType,stock,alert:isService?0:Number($('#pAlert')?.value||5),charge,type:isService?'service':'boutique',photo,supplier:$('#pSupplier')?.value||'',supplyDate:$('#pSupplyDate')?.value||'',location:$('#pLocation')?.value||'',serviceBase,serviceFee,serviceCost,serviceDuration:$('#pServiceDuration')?.value||'',serviceResponsible:$('#pServiceResponsible')?.value||'',serviceAvailable:$('#pServiceAvailable')?.value||'yes',updatedAt:new Date().toISOString()};
  obj.stockInitial=existing?.stockInitial ?? stock; obj.createdAt=existing?.createdAt || new Date().toISOString();
  let savedId=eid; if(eid){const it=d.items.find(i=>i.id===eid&&i.companyId===cid); if(it) Object.assign(it,obj);} else {savedId=id('itm'); d.items.push(Object.assign({id:savedId},obj));}
  d.stockMovements.push({id:id(eid?'mod':'cre'),companyId:cid,itemId:savedId,code,cat,product:name,type:eid?'modification':'creation',qtyBefore,qty:isService?0:Math.abs(stock-qtyBefore),qtyAfter:stock,responsible:user?.name||user?.email||'Utilisateur',note:eid?'Modification de la fiche':'Création de la fiche',date:today(),createdAt:new Date().toISOString()});
  save(d); document.querySelector('.stockModalBackdrop')?.remove(); g3Alert(eid?'Produit/service modifié avec succès.':'Produit/service enregistré avec succès.','Gestion de stock'); renderDash('stocks');
}
function stockResolveMovementItem(selectId){ const {d,company}=current(); const explicit=$('#'+selectId)?.value||''; const currentId=$('#pEdit')?.value||''; return (d.items||[]).find(i=>i.companyId===company.id && i.id===(explicit||currentId)); }
function saveStockSupplyFromFull(){
  if(!requireAdmin()) return; const {d,company,user}=current(); d.stockMovements=Array.isArray(d.stockMovements)?d.stockMovements:[]; const it=stockResolveMovementItem('stockFullSupplyItem'); if(!it) return g3Alert('Sélectionnez ou modifiez d’abord un produit concerné.','Approvisionnement','info'); if(!isBoutiqueItem(it)) return g3Alert('L’approvisionnement concerne uniquement les produits physiques.','Approvisionnement','warn');
  const qty=Number($('#stockFullSupplyQty')?.value||0); if(qty<=0) return g3Alert('Quantité à ajouter obligatoire.','Approvisionnement','info'); const before=Number(it.stock||0), buy=Number($('#stockFullSupplyBuy')?.value||it.buy||0); if(it.stockType!=='unlimited') it.stock=before+qty; it.stockInitial=Number(it.stockInitial??before)+qty; if(buy) it.buy=buy; it.updatedAt=new Date().toISOString();
  d.stockMovements.push({id:id('ent'),companyId:company.id,itemId:it.id,code:it.code||'',cat:it.cat||'',product:it.name||'',type:'entry',qtyBefore:before,qty,qtyAfter:Number(it.stock||0),buy,supplier:$('#stockFullSupplySupplier')?.value||'',responsible:user?.name||user?.email||'Utilisateur',date:$('#stockFullSupplyDate')?.value||today(),note:$('#stockFullSupplyNote')?.value||'',createdAt:new Date().toISOString()}); save(d); document.querySelector('.stockModalBackdrop')?.remove(); g3Alert('Approvisionnement enregistré avec succès.','Gestion de stock'); renderDash('stocks');
}
function saveStockOutputFromFull(){
  if(!requireAdmin()) return; const {d,company,user}=current(); d.stockMovements=Array.isArray(d.stockMovements)?d.stockMovements:[]; const it=stockResolveMovementItem('stockFullOutItem'); if(!it) return g3Alert('Sélectionnez ou modifiez d’abord un produit concerné.','Retrait / sortie','info'); if(!isBoutiqueItem(it)) return g3Alert('Le retrait concerne uniquement les produits physiques.','Retrait / sortie','warn');
  const qty=Number($('#stockFullOutQty')?.value||0); if(qty<=0) return g3Alert('Quantité à retirer obligatoire.','Retrait / sortie','info'); const before=Number(it.stock||0); if(it.stockType!=='unlimited' && qty>before) return g3Alert('Retrait impossible : quantité supérieure au stock disponible.','Stock insuffisant','warn'); if(it.stockType!=='unlimited') it.stock=before-qty; it.updatedAt=new Date().toISOString();
  d.stockMovements.push({id:id('sor'),companyId:company.id,itemId:it.id,code:it.code||'',cat:it.cat||'',product:it.name||'',type:'output',qtyBefore:before,qty,qtyAfter:Number(it.stock||0),reason:$('#stockFullOutReason')?.value||'',responsible:$('#stockFullOutResponsible')?.value||user?.name||user?.email||'Utilisateur',date:$('#stockFullOutDate')?.value||today(),note:$('#stockFullOutNote')?.value||'',createdAt:new Date().toISOString()}); save(d); document.querySelector('.stockModalBackdrop')?.remove(); g3Alert('Retrait de stock enregistré avec succès.','Gestion de stock'); renderDash('stocks');
}
function stockFullHistoryRows(itemId){
  const {d,company}=current(); const rows=stockMovementsForCompany(d,company.id).filter(m=>!itemId || String(m.itemId||'')===String(itemId)).sort((a,b)=>new Date(b.date||b.createdAt)-new Date(a.date||a.createdAt));
  return rows.map(m=>`<tr class="stockHxRow" data-date="${esc(String(m.date||m.createdAt||'').slice(0,10))}" data-type="${esc(m.type||'')}" data-responsible="${esc(String(m.responsible||'').toLowerCase())}"><td>${esc(String(m.date||m.createdAt||'').slice(0,10))}</td><td>${esc(m.type==='entry'?'Approvisionnement':m.type==='output'?'Retrait':m.type==='creation'?'Création':'Modification')}</td><td>${Number(m.qtyBefore||0)}</td><td>${Number(m.qty||0)}</td><td>${Number(m.qtyAfter||0)}</td><td>${esc(m.responsible||'-')}</td><td>${esc(m.note||m.reason||m.supplier||'-')}</td></tr>`).join('')||'<tr><td colspan="7">Aucun mouvement enregistré.</td></tr>';
}
function filterStockFullHistory(){ const date=$('#stockHxDate')?.value||'', type=$('#stockHxType')?.value||'', resp=String($('#stockHxResponsible')?.value||'').toLowerCase(); document.querySelectorAll('.stockHxRow').forEach(r=>{let ok=true; if(date&&r.dataset.date!==date)ok=false; if(type&&r.dataset.type!==type)ok=false; if(resp&&!r.dataset.responsible.includes(resp))ok=false; r.style.display=ok?'':'none';}); }
function stockFillMovementProduct(mode){ const idv=$('#'+(mode==='supply'?'stockFullSupplyItem':'stockFullOutItem'))?.value||''; const {d,company}=current(); const it=(d.items||[]).find(i=>i.id===idv&&i.companyId===company.id); if(mode==='supply' && it && $('#stockFullSupplyBuy')) $('#stockFullSupplyBuy').value=Number(it.buy||0); }
function printStockFormSheet(){ const idv=$('#pEdit')?.value||''; if(idv) return openStockItemPdfPage(idv); g3Alert('Enregistrez d’abord la fiche avant l’impression.','Imprimer fiche','info'); }
function resetStockDashboardFilters(){['stockDashGlobalSearch','stockDashCat','stockDashName','stockDashCode','stockDashStatus'].forEach(id=>{const el=document.getElementById(id); if(el)el.value='';}); filterStockDashboardTable();}


/* === CORRECTION BUGS — Popups catégories + détails stock (2026-07-08) === */
function stockSafeEnc(v){ return encodeURIComponent(String(v??'')); }
function stockSafeDec(v){ try{return decodeURIComponent(String(v??''));}catch(e){return String(v??'');} }
function stockCategoryPopupRows(){
  const {d,company}=current();
  const rows=getCompanyCategoryRecords(d,company.id);
  const items=(d.items||[]).filter(i=>i.companyId===company.id);
  return rows.map(c=>{
    const name=String(c.name||'');
    const enc=stockSafeEnc(name);
    const linked=items.filter(i=>String(i.cat||'')===name);
    const totalBuy=linked.reduce((s,i)=>s+(isBoutiqueItem(i)?Number(i.stock||0)*Number(i.buy||0):Number(i.buy||0)),0);
    const totalSale=linked.reduce((s,i)=>s+(isBoutiqueItem(i)?Number(i.stock||0)*Number(i.sell||0):Number(i.sell||0)),0);
    const benefit=totalSale-totalBuy;
    return `<tr data-cat-row="${esc(name.toLowerCase())}">
      <td><b>${esc(name||'-')}</b></td>
      <td><span class="stockCatTypeBadge ${c.kind==='service'?'service':'product'}">${c.kind==='service'?'Service':'Produit'}</span></td>
      <td>${linked.length}</td>
      <td>${money(totalBuy)}</td>
      <td>${money(totalSale)}</td>
      <td>${money(benefit)}</td>
      <td><div class="stockCatTableActions"><button class="btn2" type="button" onclick="stockEditCategoryPopupEncoded('${enc}')">✏️ Modifier</button><button class="danger" type="button" onclick="deleteStockCategoryFromPopupEncoded('${enc}')">🗑️ Supprimer</button></div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="7">Aucune catégorie enregistrée.</td></tr>';
}
function stockRefreshCategoryPopupTable(){
  const tb=document.getElementById('stockCategoryPopupTbody');
  if(tb) tb.innerHTML=stockCategoryPopupRows();
  const {d,company}=current();
  const sel=document.getElementById('stockDashCat');
  if(sel){
    const current=sel.value;
    const cats=getCompanyCategories(d,company.id);
    sel.innerHTML='<option value="">Toutes</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    sel.value=current;
  }
}
function openStockCategoryPopup(cat=''){
  if(!requireAdmin()) return;
  const {d,company}=current();
  const rec=cat?getCompanyCategoryRecords(d,company.id).find(c=>String(c.name||'')===String(cat)):null;
  const html=`<div class="modalBackdrop stockModalBackdrop" onclick="closeStockModal(event)"><div class="stockProModal stockCategoryListModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockModalBackdrop')?.remove()">×</button>
    <div class="stockCategoryPopupHeader"><div><h2>Ajouter une catégorie</h2><p class="sub">Ajoutez une catégorie et gérez directement toutes les catégories disponibles.</p></div><span>GLOBAL MARKET</span></div>
    <input id="stockCatEditOld" type="hidden" value="${esc(rec?.name||'')}">
    <section class="stockFormBlock"><h3>Formulaire catégorie</h3><div class="grid two"><label>Nom de la catégorie<input id="stockCatName" value="${esc(rec?.name||'')}" placeholder="Ex : Boutique, Impression, Mobile money"></label><label>Type<select id="stockCatKind"><option value="boutique" ${rec?.kind!=='service'?'selected':''}>Catégorie PRODUIT</option><option value="service" ${rec?.kind==='service'?'selected':''}>Catégorie SERVICE</option></select></label></div><div class="modalActions"><button class="orangeBtn" type="button" onclick="saveStockCategoryFromPopup()">Enregistrer</button><button class="btn2" type="button" onclick="stockResetCategoryPopupForm()">Réinitialiser</button><button class="btn2" type="button" onclick="document.querySelector('.stockModalBackdrop')?.remove()">Fermer</button></div></section>
    <section class="stockFormBlock"><h3>Liste des catégories disponibles</h3><p class="sub">Chaque ligne permet de modifier ou supprimer une catégorie. La suppression reste bloquée si des produits/services sont liés.</p><div class="stockCategoryTableWrap"><table class="g2table stockCategoryPopupTable"><thead><tr><th>Catégorie</th><th>Type</th><th>Nb éléments</th><th>Valeur achat</th><th>Valeur vente</th><th>Bénéfice potentiel</th><th>Actions</th></tr></thead><tbody id="stockCategoryPopupTbody">${stockCategoryPopupRows()}</tbody></table></div></section>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  setTimeout(()=>document.getElementById('stockCatName')?.focus(),50);
}
function stockResetCategoryPopupForm(){
  const old=document.getElementById('stockCatEditOld'); if(old) old.value='';
  const name=document.getElementById('stockCatName'); if(name) name.value='';
  const kind=document.getElementById('stockCatKind'); if(kind) kind.value='boutique';
  name?.focus();
}
function stockEditCategoryInPopup(cat){ stockEditCategoryPopupEncoded(stockSafeEnc(cat)); }
function stockEditCategoryPopupEncoded(enc){
  if(!requireAdmin()) return;
  const cat=stockSafeDec(enc);
  const {d,company}=current();
  const rec=getCompanyCategoryRecords(d,company.id).find(c=>String(c.name||'')===String(cat));
  if(!rec) return g3Alert('Catégorie introuvable.','Modifier catégorie','warn');
  document.querySelector('.stockCategoryEditBackdrop')?.remove();
  const html=`<div class="modalBackdrop stockCategoryEditBackdrop" onclick="closeStockCategoryEditModal(event)"><div class="stockProModal stockCategoryEditModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockCategoryEditBackdrop')?.remove()">×</button>
    <h2>Modifier la catégorie</h2><p class="sub">Modifiez le nom ou le type de la catégorie sélectionnée.</p>
    <input id="stockCatEditModalOld" type="hidden" value="${esc(rec.name||'')}">
    <div class="grid two"><label>Nouveau nom<input id="stockCatEditModalName" value="${esc(rec.name||'')}" placeholder="Nom de la catégorie"></label><label>Type<select id="stockCatEditModalKind"><option value="boutique" ${rec.kind!=='service'?'selected':''}>Catégorie PRODUIT</option><option value="service" ${rec.kind==='service'?'selected':''}>Catégorie SERVICE</option></select></label></div>
    <div class="modalActions"><button class="orangeBtn" type="button" onclick="saveStockCategoryEditModal()">Enregistrer la modification</button><button class="btn2" type="button" onclick="document.querySelector('.stockCategoryEditBackdrop')?.remove()">Annuler</button></div>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  setTimeout(()=>document.getElementById('stockCatEditModalName')?.focus(),50);
}
function closeStockCategoryEditModal(e){ if(e.target.classList.contains('stockCategoryEditBackdrop')) e.target.remove(); }
function saveStockCategoryEditModal(){
  if(!requireAdmin()) return;
  const {d,company}=current();
  const old=String(document.getElementById('stockCatEditModalOld')?.value||'').trim();
  const name=String(document.getElementById('stockCatEditModalName')?.value||'').trim();
  const kind=document.getElementById('stockCatEditModalKind')?.value||'boutique';
  if(!name) return g3Alert('Nom de catégorie obligatoire.','Modifier catégorie','info');
  const rows=getCompanyCategoryRecords(d,company.id);
  if(rows.some(c=>String(c.name||'')!==old && String(c.name||'').toLowerCase()===name.toLowerCase())) return g3Alert('Cette catégorie existe déjà.','Modifier catégorie','warn');
  const rec=rows.find(c=>String(c.name||'')===old);
  if(!rec) return g3Alert('Catégorie introuvable.','Modifier catégorie','warn');
  rec.name=name; rec.kind=kind;
  (d.items||[]).forEach(i=>{ if(i.companyId===company.id && String(i.cat||'')===old){ i.cat=name; i.type=kind==='service'?'service':'boutique'; i.updatedAt=new Date().toISOString(); }});
  saveCompanyCategoryRecords(d,company.id,rows); save(d);
  document.querySelector('.stockCategoryEditBackdrop')?.remove();
  stockRefreshCategoryPopupTable();
  g3Alert('Catégorie modifiée avec succès.','Catégorie');
  renderDash('stocks');
}
async function deleteStockCategoryFromPopupEncoded(enc){ return deleteStockCategoryFromPopup(stockSafeDec(enc)); }
async function deleteStockCategoryFromPopup(cat){
  if(!requireAdmin()) return;
  const {d,company}=current();
  const name=String(cat||'');
  const count=(d.items||[]).filter(i=>i.companyId===company.id && String(i.cat||'')===name).length;
  if(count>0) return g3Alert('Suppression sécurisée refusée : cette catégorie contient '+count+' produit(s) ou service(s). Modifiez d’abord les éléments liés afin d’éviter toute perte accidentelle.','Suppression catégorie','warn');
  if(!(await g3Confirm('Supprimer définitivement cette catégorie vide ?','Suppression catégorie'))) return;
  const rows=getCompanyCategoryRecords(d,company.id).filter(c=>String(c.name||'')!==name);
  saveCompanyCategoryRecords(d,company.id,rows); save(d);
  stockRefreshCategoryPopupTable();
  g3Alert('Catégorie supprimée avec succès.','Catégorie');
  renderDash('stocks');
}
function saveStockCategoryFromPopup(){
  if(!requireAdmin()) return;
  const {d,company}=current();
  const old=String(document.getElementById('stockCatEditOld')?.value||'').trim();
  const name=String(document.getElementById('stockCatName')?.value||'').trim();
  const kind=document.getElementById('stockCatKind')?.value||'boutique';
  if(!name) return g3Alert('Nom de catégorie obligatoire.','Catégorie','info');
  const rows=getCompanyCategoryRecords(d,company.id);
  if(rows.some(c=>String(c.name||'')!==old && String(c.name||'').toLowerCase()===name.toLowerCase())) return g3Alert('Cette catégorie existe déjà.','Catégorie','warn');
  if(old){
    const rec=rows.find(c=>String(c.name||'')===old); if(rec){rec.name=name; rec.kind=kind;}
    (d.items||[]).forEach(i=>{ if(i.companyId===company.id && String(i.cat||'')===old){ i.cat=name; i.type=kind==='service'?'service':'boutique'; i.updatedAt=new Date().toISOString(); }});
  }else rows.push({name,kind});
  saveCompanyCategoryRecords(d,company.id,rows); save(d);
  stockResetCategoryPopupForm(); stockRefreshCategoryPopupTable();
  g3Alert(old?'Catégorie modifiée avec succès.':'Catégorie ajoutée avec succès.','Catégorie');
  renderDash('stocks');
}
function stockMovementRows(i,type){
  const {d,company}=current();
  const rows=stockMovementsForCompany(d,company.id).filter(m=>String(m.itemId||'')===String(i.id||'') && (!type || m.type===type)).sort((a,b)=>new Date(b.date||b.createdAt)-new Date(a.date||a.createdAt));
  return rows.map(m=>`<tr><td>${esc(String(m.date||m.createdAt||'').slice(0,10)||'-')}</td><td>${esc(m.type==='entry'?'Approvisionnement':m.type==='output'?'Retrait / sortie':m.type||'-')}</td><td>${Number(m.qty||0)}</td><td>${m.type==='entry'?money(m.buy||0):esc(m.reason||'-')}</td><td>${esc(m.supplier||m.responsible||m.note||'-')}</td></tr>`).join('')||'<tr><td colspan="5">Aucun historique enregistré.</td></tr>';
}
function stockDetailMovementBlocks(i){
  const {user}=current(); const currentUser=esc(user?.name||user?.email||'Utilisateur');
  if(!isBoutiqueItem(i)) return `<section class="stockFormBlock"><h3>Approvisionnement / Retrait</h3><p class="sub">Ces opérations concernent uniquement les produits physiques. Cet élément est un service.</p></section>`;
  return `<input id="pEdit" type="hidden" value="${esc(i.id||'')}">
  <section class="stockFormBlock stockDetailMoveBlock"><h3>Approvisionnement</h3><p class="sub">Ajouter une quantité au stock existant depuis la fiche détaillée.</p><div class="stockFullGrid"><label>Produit concerné<input readonly value="${esc(i.name||'')} — ${esc(i.code||'')}"><input id="stockFullSupplyItem" type="hidden" value="${esc(i.id||'')}"></label><label>Quantité à ajouter<input id="stockFullSupplyQty" type="number" min="1" value="1"></label><label>Prix d’achat de l’approvisionnement<input id="stockFullSupplyBuy" type="number" min="0" value="${Number(i.buy||0)}"></label><label>Fournisseur<input id="stockFullSupplySupplier" placeholder="Fournisseur"></label><label>Date<input id="stockFullSupplyDate" type="date" value="${today()}"></label><label>Note<input id="stockFullSupplyNote" placeholder="Note"></label></div><div class="modalActions"><button class="orangeBtn" onclick="saveStockSupplyFromFull()">⬇️ Approvisionner</button></div></section>
  <section class="stockFormBlock stockDetailMoveBlock"><h3>Retrait / sortie de stock</h3><p class="sub">Retirer une quantité du stock avec contrôle du stock disponible.</p><div class="stockFullGrid"><label>Produit concerné<input readonly value="${esc(i.name||'')} — stock ${i.stockType==='unlimited'?'illimité':Number(i.stock||0)}"><input id="stockFullOutItem" type="hidden" value="${esc(i.id||'')}"></label><label>Quantité à retirer<input id="stockFullOutQty" type="number" min="1" value="1"></label><label>Motif du retrait<select id="stockFullOutReason"><option>vente</option><option>perte</option><option>produit endommagé</option><option>transfert</option><option>usage interne</option><option>correction de stock</option><option>autre</option></select></label><label>Date<input id="stockFullOutDate" type="date" value="${today()}"></label><label>Responsable<input id="stockFullOutResponsible" value="${currentUser}"></label><label>Note<input id="stockFullOutNote" placeholder="Note"></label></div><div class="modalActions"><button class="danger" onclick="saveStockOutputFromFull()">⬆️ Retirer du stock</button></div></section>`;
}
function openStockItemDetailPro(iid){
  const {d,company}=current();
  const i=(d.items||[]).find(x=>String(x.id||'')===String(iid||'') && x.companyId===company.id);
  if(!i) return g3Alert('Élément introuvable.','Gestion de stock','warn');
  const sales=getCompanyValidatedSales().filter(x=>(String(x.itemId||'')===String(i.id||'') || String(x.itemCode||'')===String(i.code||''))); 
  const isProd=isBoutiqueItem(i);
  const qty=isProd?(i.stockType==='unlimited'?'Illimité':Number(i.stock||0)):'Service';
  const buy=Number(i.buy||i.serviceCost||0);
  const sell=Number(itemMarketPrice(i)||i.sell||0);
  const valStock=isProd && i.stockType!=='unlimited'?Number(i.stock||0)*buy:0;
  const benefPotential=isProd && i.stockType!=='unlimited'?Math.max(0,Number(i.stock||0)*(sell-buy)):Math.max(0,sell-buy);
  const realized=sales.reduce((a,s)=>a+Number(s.profit||Math.max(0,Number(s.total||0)-Number(s.charges||0))),0);
  const st=stockDashboardStatus(i);
  const salesRows=sales.map(x=>`<tr><td>${esc(new Date(x.date||Date.now()).toLocaleString('fr-FR'))}</td><td>${esc(x.client||'-')}</td><td>${Number(x.qty||1)}</td><td>${money(x.total||0)}</td><td>${money(x.profit||0)}</td></tr>`).join('')||'<tr><td colspan="5">Aucune vente enregistrée.</td></tr>';
  const html=`<div class="modalBackdrop stockModalBackdrop" onclick="closeStockModal(event)"><div class="stockProModal stockDetailModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockModalBackdrop')?.remove()">×</button>
    <h2>Voir détails</h2><p class="sub">Informations détaillées du produit ou service sélectionné.</p>
    <div class="stockDetailHero"><div class="stockProductImg big">${i.photo?`<img loading="lazy" decoding="async" src="${esc(i.photo)}" alt="${esc(i.name||'Produit')}">`:'📦'}</div><div><h3>${esc(i.name||'')}</h3><span class="stockBadge ${st.cls}">${esc(st.label)}</span><p>${esc(i.detail||i.marketplaceDesc||'Aucune description.')}</p></div></div>
    <div class="stockDetailGrid"><div><small>Code</small><b>${esc(i.code||'-')}</b></div><div><small>Catégorie</small><b>${esc(i.cat||'-')}</b></div><div><small>Quantité</small><b>${esc(qty)}</b></div><div><small>Prix d’achat</small><b>${isProd?money(buy):'-'}</b></div><div><small>Prix de vente</small><b>${money(sell)}</b></div><div><small>Valeur du stock</small><b>${money(valStock)}</b></div><div><small>Bénéfice potentiel</small><b>${money(benefPotential)}</b></div><div><small>Bénéfice réalisé</small><b>${money(realized)}</b></div></div>
    ${stockDetailMovementBlocks(i)}
    <h3>Historique des entrées</h3><table class="g2table"><thead><tr><th>Date</th><th>Type</th><th>Quantité</th><th>Prix / motif</th><th>Fournisseur / note</th></tr></thead><tbody>${stockMovementRows(i,'entry')}</tbody></table>
    <h3>Historique des sorties</h3><table class="g2table"><thead><tr><th>Date</th><th>Type</th><th>Quantité</th><th>Prix / motif</th><th>Fournisseur / note</th></tr></thead><tbody>${stockMovementRows(i,'output')}</tbody></table>
    <h3>Historique des ventes</h3><table class="g2table"><thead><tr><th>Date</th><th>Client</th><th>Quantité</th><th>Total</th><th>Bénéfice</th></tr></thead><tbody>${salesRows}</tbody></table>
    <div class="modalActions"><button class="darkBtn" onclick="openStockItemPdfPage('${esc(i.id)}')">Imprimer</button><button class="btn2" onclick="document.querySelector('.stockModalBackdrop')?.remove()">Fermer</button></div>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}

/* === CORRECTIF SÉCURITÉ SERVEUR CLOUDFLARE — 2026-07-26 ===
   - Authentification exclusivement dans _worker.js
   - Aucun hash/sel dans le navigateur
   - Sessions HttpOnly + jeton CSRF
   - Données limitées à l'entreprise connectée
*/
async function secureEmployeePost(path,payload={}){
  let lastError=null;
  for(let attempt=0;attempt<6;attempt++){
    try{
      const r=await fetchWithTimeout(path,{method:'POST',headers:employeeSecurityHeaders(),body:JSON.stringify(payload),cache:'no-store'},25000);
      return await readApiPayload(r);
    }catch(error){
      lastError=error;
      if(!isTransientCloudSaveError(error)||attempt===5) throw error;
      const serverDelay=Math.max(0,Number(error?.retryAfter||0)*1000);
      await waitMs(Math.max(serverDelay,[300,700,1400,2600,4200,6500][attempt])+Math.floor(Math.random()*150));
    }
  }
  throw lastError;
}
async function securePublicPost(path,payload={}){
  let lastError=null;
  for(let attempt=0;attempt<6;attempt++){
    try{
      const r=await fetchWithTimeout(path,{method:'POST',headers:clientSecurityHeaders(),body:JSON.stringify(payload),cache:'no-store'},25000);
      return await readApiPayload(r);
    }catch(error){
      lastError=error;
      if(!isTransientCloudSaveError(error)||attempt===5) throw error;
      const serverDelay=Math.max(0,Number(error?.retryAfter||0)*1000);
      await waitMs(Math.max(serverDelay,[300,700,1400,2600,4200,6500][attempt])+Math.floor(Math.random()*150));
    }
  }
  throw lastError;
}
function secureErrorMessage(error,fallback='Opération sécurisée impossible.'){
  if(error?.status===429&&error?.code==='RATE_LIMITED')return error.message||'Trop de tentatives. Réessayez plus tard.';
  if(error?.code==='STORAGE_BUSY'||error?.status===503)return 'Synchronisation temporairement retardée. Vos données restent affichées et GLOBAL MARKET continue automatiquement en arrière-plan.';
  if(error?.code==='SETUP_REQUIRED') return 'Les secrets Cloudflare SUPER_ADMIN_EMAIL et SUPER_ADMIN_INITIAL_PASSWORD doivent être configurés avant la première connexion Super Admin.';
  if(error?.name==='AbortError') return 'Le serveur met plus de temps que prévu à répondre. GLOBAL MARKET poursuit la synchronisation sans bloquer votre espace.';
  const msg=String(error?.message||'').trim();
  if(/operation was aborted/i.test(msg)||/failed to fetch/i.test(msg)||/network/i.test(msg)) return 'Connexion au serveur impossible pour le moment. Vérifiez votre réseau puis réessayez.';
  if(/service cloud n.a pas répondu|momentanément occupé|stockage.*occupé/i.test(msg)) return 'Synchronisation temporairement retardée. Vos données restent affichées et GLOBAL MARKET continue automatiquement en arrière-plan.';
  return msg||fallback;
}
async function openGlobalShopLogin(){location.hash='#home';try{await cloudLoadPublicData()}catch(e){console.error(e);CLOUD_DATA=defaultData()}renderGlobalShop();}
async function login(){
  const identifier=($('#loginEmail')?.value||'').trim().toLowerCase();
  const password=$('#loginPass')?.value||'';
  const role=$('#loginRole')?.value||'caisse';
  setLoginMessage('','');
  if(!identifier){setLoginMessage('Le nom utilisateur ou l’e-mail est obligatoire.','error');$('#loginEmail')?.focus();return}
  if(!password){setLoginMessage('Le mot de passe est obligatoire.','error');$('#loginPass')?.focus();return}
  setLoginLoading(true);
  try{
    const j=await fetchApiJsonWithRetry('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,password,role})},30000,2);
    CLOUD_SESSION=j.session||null;
    if(j.data&&typeof j.data==='object'){
      CLOUD_DATA=normalizeData(j.data);
      CLOUD_LAST_ACK_DATA=cloneCloudData(CLOUD_DATA);
      CLOUD_DATA_READY=true;
    }else{
      await cloudLoadData();
    }
    const u=(CLOUD_DATA.users||[]).find(x=>x.id===CLOUD_SESSION?.userId);
    if(!u) throw new Error('Profil utilisateur non chargé.');
    if(j.mustChangePassword){
      const changed=await enforcePasswordChange(u);
      if(!changed) await cloudClearSession();
      return;
    }
    setLoginMessage('Identité vérifiée. Ouverture de votre espace sécurisé…','success');
    if(u.role==='caisse') logCaisseAction('Connexion caisse','Connexion authentifiée par le serveur Cloudflare');
    document.getElementById('gmBusinessAuthModal')?.remove();
    location.hash='#app';
    render();
    setTimeout(()=>cloudLoadData({allowStale:true,background:true}).then(()=>{if(location.hash==='#app')render()}).catch(e=>console.info('[V6.1] données complètes en cours de synchronisation',e?.message||e)),150);
  }catch(e){
    console.error(e);
    setLoginMessage(secureErrorMessage(e,'Identifiant ou mot de passe incorrect.'),'error');
  }finally{setLoginLoading(false)}
}
async function registerCompany(){
  if(REGISTER_REQUEST_IN_PROGRESS)return;
  const payload={
    name:$('#cName')?.value.trim()||'', legalForm:$('#cLegalForm')?.value.trim()||'',
    rccm:$('#cRccm')?.value.trim()||'', taxAccount:$('#cTaxAccount')?.value.trim()||'',
    activity:$('#cActivity')?.value.trim()||'', owner:$('#cOwner')?.value.trim()||'',
    address:$('#cAddress')?.value.trim()||'', phone:$('#cPhone')?.value.trim()||'',
    email:$('#cEmail')?.value.trim().toLowerCase()||'', password:$('#cPass')?.value||'',
    businessType:$('#cType')?.value||'boutique'
  };
  const requiredFields=[
    ['name','#cName','la raison sociale'],['legalForm','#cLegalForm','la forme juridique'],
    ['rccm','#cRccm','le RCCM'],['taxAccount','#cTaxAccount','le compte contribuable'],
    ['businessType','#cType','le type de commerce'],['activity','#cActivity','l’activité principale'],
    ['owner','#cOwner','le gérant ou responsable'],['address','#cAddress','l’adresse'],
    ['phone','#cPhone','le téléphone'],['email','#cEmail','l’e-mail'],['password','#cPass','le mot de passe administrateur']
  ];
  const missing=requiredFields.find(([key])=>!String(payload[key]||'').trim());
  if(missing){
    alert('Veuillez renseigner '+missing[2]+'.');
    document.querySelector(missing[1])?.focus();
    return;
  }
  if(payload.password.length<10){alert('Le mot de passe administrateur doit contenir au moins 10 caractères.');$('#cPass')?.focus();return}
  if(!/[A-Z]/.test(payload.password)||!/[a-z]/.test(payload.password)||!/[0-9]/.test(payload.password)||!/[^A-Za-z0-9]/.test(payload.password)){alert('Le mot de passe doit contenir une majuscule, une minuscule, un chiffre et un caractère spécial.');$('#cPass')?.focus();return}
  const emailInput=$('#cEmail');
  if(emailInput&&!emailInput.checkValidity()){alert('Veuillez saisir une adresse e-mail valide.');emailInput.focus();return}
  setRegisterLoading(true);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  try{
    const r=await fetchWithTimeout('/api/register-company',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},15000);
    const j=await readApiPayload(r);
    CLOUD_SESSION=j.session||null;
    if(j.data&&typeof j.data==='object'){
      CLOUD_DATA=normalizeData(j.data);
      CLOUD_LAST_ACK_DATA=cloneCloudData(CLOUD_DATA);
      CLOUD_DATA_READY=true;
    }else{
      await cloudLoadData();
    }
    closeRegisterPopup();
    render();
    setTimeout(()=>alert('Entreprise créée avec succès. Le compte administrateur associé est actif et les données ont été enregistrées de manière sécurisée.'),0);
  }catch(e){
    alert(secureErrorMessage(e,'Création de l’entreprise impossible.'));
  }finally{
    setRegisterLoading(false);
  }
}
async function requestPasswordReset(){
  const identifier=($('#fpEmail')?.value||'').trim().toLowerCase();
  const role=$('#fpRole')?.value||'caisse';
  const phone=($('#fpPhone')?.value||'').trim();
  const reason=($('#fpReason')?.value||'Mot de passe oublié').trim();
  if(!identifier) return alert('Veuillez saisir votre email / identifiant.');
  try{
    const r=await fetchWithTimeout('/api/password/request-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,role,phone,reason})},10000);
    const j=await readApiPayload(r);
    closeForgotPasswordPopup();
    alert(j.message||'Si le compte existe, la demande a été transmise.');
  }catch(e){alert(secureErrorMessage(e,'Demande impossible.'))}
}
async function enforcePasswordChange(u){
  if(!u) return false;
  const np=await g3Prompt('Mot de passe temporaire détecté. Saisissez un nouveau mot de passe personnel comprenant au moins 10 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial :','','Changement obligatoire');
  if(!np) return false;
  try{
    await secureEmployeePost('/api/password/change',{newPassword:np});
    CLOUD_SESSION=null; CLOUD_DATA=defaultData();
    alert('Nouveau mot de passe enregistré. Toutes les anciennes sessions ont été invalidées. Reconnectez-vous.');
    showGlobalBusinessLogin();
    return true;
  }catch(e){alert(secureErrorMessage(e,'Changement du mot de passe impossible.'));return false}
}
async function addAccountUser(){
  if(!requireAdmin()) return;
  const {d,company}=current();
  if(!assertPlanFeature(company,'multi_users','Le multi-utilisateur est disponible avec les plans Free et Business.')) return;
  if(!canCreateMoreUsers(company,d)) return alert('Limite utilisateurs atteinte pour le plan '+planDef(company).statut+' : '+userLimitLabel(company)+' utilisateur(s).');
  const payload={name:$('#accNewName')?.value.trim()||'',email:$('#accNewEmail')?.value.trim().toLowerCase()||'',password:$('#accNewPass')?.value||'',role:$('#accNewRole')?.value||'caisse',caisseStartTime:$('#accNewStart')?.value||'07:00',caisseEndTime:$('#accNewEnd')?.value||'22:00'};
  if(!payload.name||!payload.email||!payload.password) return alert('Nom, email et mot de passe obligatoires.');
  try{await secureEmployeePost('/api/users/create',payload);await cloudLoadData();showAccountUsersPage()}catch(e){alert(secureErrorMessage(e,'Création utilisateur impossible.'))}
}
async function addUser(){
  if(!requireAdmin('La caisse ne peut pas créer des utilisateurs.')) return;
  const {d,company}=current();
  if(!assertPlanFeature(company,'multi_users','Le multi-utilisateur est disponible avec les plans Free et Business.')) return;
  if(!canCreateMoreUsers(company,d)) return alert('Limite utilisateurs atteinte pour le plan '+planDef(company).statut+' : '+userLimitLabel(company)+' utilisateur(s).');
  const payload={name:$('#uName')?.value||'',email:$('#uEmail')?.value.trim().toLowerCase()||'',password:$('#uPass')?.value||'',role:$('#uRole')?.value||'caisse',caisseStartTime:$('#uStart')?.value||'07:00',caisseEndTime:$('#uEnd')?.value||'22:00'};
  if(!payload.email||!payload.password) return alert('Email et mot de passe obligatoires.');
  try{await secureEmployeePost('/api/users/create',payload);await cloudLoadData();renderDash('param')}catch(e){alert(secureErrorMessage(e,'Création utilisateur impossible.'))}
}
async function saveAccountUser(uid){
  if(!requireAdmin()) return;
  const {d,company,user}=current(); const old=d.users.find(x=>x.id===uid&&x.companyId===company.id);
  if(!old) return alert('Utilisateur introuvable.');
  const payload={userId:uid,name:$(`#auName_${uid}`)?.value.trim()||old.name,email:$(`#auEmail_${uid}`)?.value.trim().toLowerCase()||old.email,role:$(`#auRole_${uid}`)?.value||old.role,status:$(`#auStatus_${uid}`)?.value||'active',caisseStartTime:$(`#auStart_${uid}`)?.value||'07:00',caisseEndTime:$(`#auEnd_${uid}`)?.value||'22:00'};
  const newPass=$(`#auPass_${uid}`)?.value||''; if(newPass) payload.password=newPass;
  try{
    await secureEmployeePost('/api/users/update',payload);
    const invalidatesSelf=uid===user.id&&(newPass||payload.email!==old.email||payload.role!==old.role);
    if(invalidatesSelf){CLOUD_SESSION=null;CLOUD_DATA=defaultData();alert('Compte modifié. Pour votre sécurité, reconnectez-vous.');return showGlobalBusinessLogin()}
    await cloudLoadData(); alert('Utilisateur modifié.'); showAccountUsersPage();
  }catch(e){alert(secureErrorMessage(e,'Modification utilisateur impossible.'))}
}
async function deleteAccountUser(uid){
  if(!requireAdmin()) return;
  if(!(await g3Confirm('Supprimer définitivement cet utilisateur et son accès ?','Suppression utilisateur'))) return;
  try{await secureEmployeePost('/api/users/delete',{userId:uid});await cloudLoadData();showAccountUsersPage()}catch(e){alert(secureErrorMessage(e,'Suppression impossible.'))}
}
async function blockUser(uid){
  if(!requireAdmin()) return;
  const u=(seed().users||[]).find(x=>x.id===uid); if(!u) return;
  try{await secureEmployeePost('/api/users/update',{userId:uid,status:'blocked'});await cloudLoadData();renderDash('param')}catch(e){alert(secureErrorMessage(e,'Blocage impossible.'))}
}
async function resetUserPasswordDirect(uid){
  if(!requireAdmin('Réservé à l’administrateur.')) return;
  const u=(seed().users||[]).find(x=>x.id===uid); if(!u) return alert('Utilisateur introuvable.');
  if(!(await g3Confirm('Réinitialiser le mot de passe de '+(u.name||u.email)+' ?','Réinitialisation mot de passe'))) return;
  try{const j=await secureEmployeePost('/api/users/reset-password',{userId:uid});await cloudLoadData();alert('Nouveau mot de passe temporaire :\n\n'+j.temporaryPassword+'\n\nToutes les anciennes sessions de cet utilisateur sont invalidées.');renderDash('param')}catch(e){alert(secureErrorMessage(e,'Réinitialisation impossible.'))}
}
async function resetPasswordRequestByAdmin(rid){
  if(!requireAdmin('Réservé à l’administrateur.')) return;
  const r=(seed().passwordResetRequests||[]).find(x=>x.id===rid); if(!r) return alert('Demande introuvable.');
  try{const j=await secureEmployeePost('/api/users/reset-password',{userId:r.userId,requestId:rid});await cloudLoadData();alert('Mot de passe temporaire :\n\n'+j.temporaryPassword+'\n\nToutes les anciennes sessions sont invalidées.');renderDash('param')}catch(e){alert(secureErrorMessage(e,'Réinitialisation impossible.'))}
}
async function resetPasswordRequestBySuper(rid){
  const {user}=current(); if(user?.role!=='superadmin') return alert('Réservé au Super Admin GLOBAL MARKET.');
  const r=(seed().passwordResetRequests||[]).find(x=>x.id===rid); if(!r) return alert('Demande introuvable.');
  try{const j=await secureEmployeePost('/api/users/reset-password',{userId:r.userId,requestId:rid});await cloudLoadData();alert('Mot de passe temporaire de l’administrateur :\n\n'+j.temporaryPassword+'\n\nToutes ses anciennes sessions sont invalidées.');renderSuper()}catch(e){alert(secureErrorMessage(e,'Réinitialisation impossible.'))}
}
async function superResetAdminPassword(uid){
  const {user}=current(); if(user?.role!=='superadmin') return alert('Réservé au Super Admin GLOBAL MARKET.');
  if(!(await g3Confirm('Générer un mot de passe temporaire pour cet administrateur ?','Mot de passe temporaire'))) return;
  try{const j=await secureEmployeePost('/api/users/reset-password',{userId:uid});await cloudLoadData();alert('Mot de passe temporaire :\n\n'+j.temporaryPassword+'\n\nToutes les anciennes sessions sont invalidées.');closeSuperModal();const u=(seed().users||[]).find(x=>x.id===uid);if(u)showCompanyDetails(u.companyId)}catch(e){alert(secureErrorMessage(e,'Réinitialisation impossible.'))}
}
async function savePublicClientRegister(companyId){
  const payload={companyId,name:($('#clientRegName')?.value||'').trim(),phone:($('#clientRegPhone')?.value||'').trim(),email:($('#clientRegEmail')?.value||'').trim(),password:($('#clientRegPass')?.value||'').trim()};
  if(!payload.name||!payload.phone||!payload.password) return alert('Nom, téléphone et mot de passe obligatoires.');
  try{
    const r=await fetchWithTimeout('/api/public/client/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},12000);
    const j=await readApiPayload(r); PUBLIC_CLIENT_SESSION=j.session||null; window.publicShopClientId=j.client?.id||'';
    await cloudLoadPublicData(); document.getElementById('clientRegisterModal')?.remove(); alert('Inscription réussie. Votre espace client est sécurisé côté serveur.');
    const c=(seed().companies||[]).find(x=>x.id===companyId); renderPublicShop(c?.shopSlug||'');
  }catch(e){alert(secureErrorMessage(e,'Inscription client impossible.'))}
}
async function loginPublicClient(companyId){
  const phone=($('#clientLoginPhone')?.value||'').trim(),password=($('#clientLoginPass')?.value||'').trim();
  try{
    const r=await fetchWithTimeout('/api/public/client/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId,phone,password})},12000);
    const j=await readApiPayload(r); PUBLIC_CLIENT_SESSION=j.session||null; window.publicShopClientId=j.client?.id||'';
    await cloudLoadPublicData(); document.getElementById('clientLoginModal')?.remove(); render(); setTimeout(()=>openClientSpace(companyId),0);
  }catch(e){alert(secureErrorMessage(e,'Téléphone ou mot de passe incorrect.'))}
}
async function logoutPublicClient(companyId){
  try{await fetchWithTimeout('/api/public/client/session',{method:'DELETE',headers:clientSecurityHeaders()},6000)}catch(e){}
  PUBLIC_CLIENT_SESSION=null; window.publicShopClientId=''; await cloudLoadPublicData();
  location.hash='#home'; renderGlobalShop();
}
async function finalizePublicCartPayment(companyId,method){
  const cart=getPublicCart(companyId);
  if(!cart.length) return alert('Panier vide.');
  const clientName=($('#publicOrderClientName')?.value||'').trim();
  const clientPhone=($('#publicOrderClientPhone')?.value||'').trim();
  if(!clientName||!clientPhone) return alert('Veuillez renseigner le nom et le contact du client.');
  const payOnDelivery=method==='PAIEMENT À LA LIVRAISON';
  const transactionId=($('#publicTransactionId')?.value||'').trim();
  const file=$('#publicPayCapture')?.files?.[0];
  if(!payOnDelivery&&!transactionId) return alert('Veuillez inscrire l’identifiant de la transaction.');
  let paymentCaptureData='';
  if(file){try{paymentCaptureData=await readPaymentCaptureAsDataUrl(file)}catch(e){return alert('Impossible de charger la capture.')}}
  try{
    const payload={
      companyId, clientName, clientPhone,
      cart:cart.map(x=>({itemId:x.itemId,qty:Number(x.qty||1)})),
      paymentMethod:method,
      paymentProofType:payOnDelivery?'none':(file?'capture':'transaction_id'),
      paymentRef:payOnDelivery?'':transactionId,
      paymentCaptureName:file?.name||'', paymentCaptureData
    };
    const r=await fetchWithTimeout('/api/public/order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'},20000);
    await readApiPayload(r);
    cart.length=0; refreshPublicCartBadge(companyId);
    try{await cloudLoadPublicData()}catch(e){console.warn('Actualisation publique après commande non disponible',e)}
    showOrderSentModal(companyId);
  }catch(e){alert(secureErrorMessage(e,'Envoi de la commande impossible.'))}
}

async function deleteMarketplaceOrder(orderId,isAdmin){
  if(!(await g3Confirm('Supprimer cette commande seulement de cette liste ?','Suppression commande'))) return;
  if(isAdmin){
    const d=seed(),o=(d.orders||[]).find(x=>String(x.id)===String(orderId)); if(!o)return alert('Commande introuvable.');
    o.adminDeleted=true; save(d); document.getElementById('marketOrderDetailsModal')?.remove(); showMarketplacePage(); return;
  }
  try{
    await securePublicPost('/api/public/order/delete',{orderId});
    const companyId=getPublicClient(PUBLIC_CLIENT_SESSION?.companyId)?.companyId||PUBLIC_CLIENT_SESSION?.companyId;
    await cloudLoadPublicData(); document.getElementById('marketOrderDetailsModal')?.remove(); document.getElementById('clientSpaceModal')?.remove(); if(companyId)openClientSpace(companyId);
  }catch(e){alert(secureErrorMessage(e,'Suppression impossible.'))}
}

/* ========================================================================
   GLOBAL MARKET V5.0 — COMPTE CLIENT GLOBAL + PANIER UNIQUE MULTI-BOUTIQUES
   ======================================================================== */
function currentGlobalClient(){
  const cid=PUBLIC_CLIENT_SESSION?.clientId||window.publicShopClientId||'';
  if(!cid)return null;
  return (seed().marketClients||[]).find(c=>String(c.id)===String(cid))||null;
}
function getPublicClient(){return currentGlobalClient();}
function openCurrentGlobalClientSpace(){return openClientSpace();}
function logoutCurrentGlobalClient(){return logoutPublicClient();}

function globalUniversalHeader(active='public',options={}){
  const {user}=current();
  const restricted=Boolean(options.restricted);
  const client=!user?currentGlobalClient():null;
  let nav='';
  let actions='';
  const home=`<button type="button" class="${active==='public'?'active':''}" onclick="goGlobalMarketHome()">${officialShopIcon('home')}<span>Accueil</span></button>`;
  if(user){
    if(user.role==='superadmin'){
      nav=home+(restricted?'':`<button type="button" class="${active==='super'?'active':''}" onclick="renderSuper()">▦ Administration</button><button type="button" onclick="exportData()">📤 Exporter données</button>`);
    }else if(user.role==='admin'){
      const adminLabels={home:'▦ Tableau de bord',vente:'☰ Ventes',rapports:'▣ Rapports',contrats:'▣ Clients',stocks:'📦 Stocks',mois:'📅 12 mois',param:'⚙ Paramètres',marketplace:'🛍 Marketplace'};
      const adminOrder=['home','vente','rapports','contrats','stocks','mois','param','marketplace'];
      nav=home+(restricted?'':adminOrder.map(x=>`<button type="button" class="${active===x?'active':''}" onclick="show('${x}')">${adminLabels[x]}</button>`).join(''));
    }else if(user.role==='caisse'){
      const caisseLabels={home:'▦ Tableau de bord',vente:'☰ Ventes',rapports:'▣ Rapports'};
      nav=home+(restricted?'':['home','vente','rapports'].map(x=>`<button type="button" class="${active===x?'active':''}" onclick="show('${x}')">${caisseLabels[x]}</button>`).join(''));
    }else{
      nav=home;
    }
    const role=user.role==='superadmin'?'Super Admin':user.role==='admin'?'Administrateur':user.role==='caisse'?'Caisse':'Utilisateur';
    actions=`<div class="gmUniversalUser"><span class="gmUniversalIdentity">👤 <b>${esc(user.name||user.email||role)}</b><small>${esc(role)}</small></span>${user.role==='admin'&&!restricted?'<button type="button" class="gmUniversalAccount" onclick="showAccountPage()">Mon compte</button>':''}<button type="button" class="gmUniversalLogout" onclick="logout()">Déconnexion</button></div>`;
  }else if(client){
    nav=home+(restricted?'':`<button type="button" class="${active==='client'?'active':''}" onclick="openClientSpace()">${officialShopIcon('user')}<span>Mon espace client</span></button><button type="button" onclick="openGlobalMarketCart()">${officialShopIcon('cart')}<span>Mon panier</span></button>`);
    actions=`<div class="gmUniversalUser"><span class="gmUniversalIdentity">👤 <b>${esc(client.name||'Client')}</b><small>Compte client</small></span><button type="button" class="gmUniversalLogout" onclick="logoutPublicClient()">Déconnexion</button></div>`;
  }else{
    nav=home;
    actions=`<div class="gmUniversalGuestActions"><button type="button" class="gmUniversalBusinessBtn" onclick="openGlobalBusinessAuth()">${officialShopIcon('bag')}<span><b>Créer ma boutique</b><small>ou se connecter</small></span></button><button type="button" class="gmUniversalClientBtn" onclick="openGlobalClientAuth('login')">${officialShopIcon('user')}<span><b>Créer un compte client</b><small>ou se connecter</small></span></button><button type="button" class="gmUniversalCart" onclick="openGlobalMarketCart()" aria-label="Ouvrir le panier">${officialShopIcon('cart')}<i id="gmGlobalCartBadge">0</i></button></div>`;
  }
  return `<header class="gmUniversalHeader"><button type="button" class="gmUniversalBrand" onclick="goGlobalMarketHome()">${globalMarketBrandMark()}<span><b>GLOBAL MARKET</b><small>Produits & services en toute confiance</small></span></button><nav class="gmUniversalNav" aria-label="Menu du profil connecté">${nav}</nav><div class="gmUniversalActions">${actions}</div></header>`;
}

function globalClientCartKey(){return String(PUBLIC_CLIENT_SESSION?.clientId||window.publicShopClientId||'');}
function getGlobalClientCart(){
  const key=globalClientCartKey();
  window.GLOBAL_MARKET_CLIENT_CARTS=window.GLOBAL_MARKET_CLIENT_CARTS||{};
  if(!key)return null;
  window.GLOBAL_MARKET_CLIENT_CARTS[key]=window.GLOBAL_MARKET_CLIENT_CARTS[key]||[];
  return window.GLOBAL_MARKET_CLIENT_CARTS[key];
}
function getPublicCart(companyId){
  const cart=getGlobalClientCart()||[];
  return cart.filter(line=>String(line.companyId)===String(companyId));
}
function globalMarketCartCount(){return (getGlobalClientCart()||[]).reduce((sum,line)=>sum+Number(line.qty||0),0);}
function publicCartCount(companyId){return getPublicCart(companyId).reduce((sum,line)=>sum+Number(line.qty||0),0);}
function refreshGlobalMarketCartBadge(){document.querySelectorAll('#gmGlobalCartBadge').forEach(b=>b.textContent=globalMarketCartCount());}
function refreshPublicCartBadge(companyId){const b=document.getElementById('publicCartBadge');if(b)b.textContent=publicCartCount(companyId);refreshGlobalMarketCartBadge();}

async function addToPublicCart(companyId,itemId){
  const client=currentGlobalClient();
  if(!client){
    openGlobalClientAuth('login');
    return alert('Vous devez disposer d’un compte client GLOBAL MARKET et être connecté pour utiliser votre panier.');
  }
  const d=seed();const it=(d.items||[]).find(x=>x.id===itemId&&x.companyId===companyId&&!x.marketplaceHidden);
  if(!it)return alert('Article introuvable.');
  const qty=isBoutiqueItem(it)?Math.max(1,Number(await g3Prompt('Quantité à ajouter au panier :','1','Quantité panier')||1)):1;
  const cart=getGlobalClientCart();
  const line=cart.find(x=>String(x.itemId)===String(itemId));
  if(line)line.qty=Number(line.qty||0)+qty;else cart.push({companyId,itemId,qty});
  refreshPublicCartBadge(companyId);showPublicToast('Article ajouté à votre panier unique GLOBAL MARKET.');
}
async function addGlobalMarketItemToCart(companyId,itemId){await addToPublicCart(companyId,itemId);refreshGlobalMarketCartBadge();}
function updatePublicCartQty(companyId,itemId,qty){const cart=getGlobalClientCart()||[];const line=cart.find(x=>String(x.itemId)===String(itemId));if(line)line.qty=Math.max(1,Number(qty||1));openGlobalMarketCart();}
function removePublicCartItem(companyId,itemId){const cart=getGlobalClientCart()||[];const i=cart.findIndex(x=>String(x.itemId)===String(itemId));if(i>=0)cart.splice(i,1);refreshGlobalMarketCartBadge();openGlobalMarketCart();}
function clearGlobalClientCart(){const cart=getGlobalClientCart();if(cart)cart.length=0;refreshGlobalMarketCartBadge();}
function publicCartTotal(companyId){const d=seed();return getPublicCart(companyId).reduce((sum,line)=>{const it=(d.items||[]).find(x=>x.id===line.itemId);return sum+(it?itemMarketPrice(it)*Number(line.qty||1):0)},0);}
function openPublicCart(){return openGlobalMarketCart();}

function globalCartPricing(){
  const d=seed(),cart=getGlobalClientCart()||[],groups=new Map();
  for(const line of cart){const it=(d.items||[]).find(x=>x.id===line.itemId);if(!it)continue;const subtotal=(groups.get(it.companyId)||0)+itemMarketPrice(it)*Number(line.qty||1);groups.set(it.companyId,subtotal);}
  let subtotal=0,deliveryFee=0;for(const amount of groups.values()){subtotal+=amount;deliveryFee+=Math.round(amount*deliveryFeeRateForSubtotal(amount));}
  return {subtotal,deliveryFee,total:subtotal+deliveryFee,shopCount:groups.size};
}
function openGlobalMarketCart(){
  document.getElementById('gmGlobalCartModal')?.remove();
  const client=currentGlobalClient();
  if(!client){openGlobalClientAuth('login');return;}
  const d=seed(),cart=getGlobalClientCart()||[],companyMap=new Map((d.companies||[]).map(c=>[c.id,c]));
  if(!cart.length)return alert('Votre panier est vide.');
  const grouped=new Map();
  cart.forEach(line=>{const it=(d.items||[]).find(x=>x.id===line.itemId);if(!it)return;if(!grouped.has(it.companyId))grouped.set(it.companyId,[]);grouped.get(it.companyId).push({line,it});});
  const groupsHtml=[...grouped.entries()].map(([cid,rows])=>{const company=companyMap.get(cid)||{};const subtotal=rows.reduce((s,r)=>s+itemMarketPrice(r.it)*Number(r.line.qty||1),0);const fee=Math.round(subtotal*deliveryFeeRateForSubtotal(subtotal));return `<section class="gmUnifiedCartShop"><div class="gmUnifiedCartShopHead"><div>${officialShopIcon('bag')}<span><b>${esc(company.name||'Boutique')}</b><small>${rows.length} référence(s)</small></span></div><strong>${money(subtotal+fee)}</strong></div><div class="gmUnifiedCartLines">${rows.map(({line,it})=>`<div class="gmUnifiedCartLine"><div class="gmUnifiedCartThumb">${it.photo?`<img src="${esc(it.photo)}" alt="">`:mkProductVisual(it)}</div><div class="gmUnifiedCartInfo"><b>${esc(it.name)}</b><small>${esc(it.cat||'Produit / service')}</small><span>${money(itemMarketPrice(it))}</span></div><label>Qté<input type="number" min="1" value="${Number(line.qty||1)}" onchange="updatePublicCartQty('${esc(cid)}','${esc(it.id)}',this.value)"></label><strong>${money(itemMarketPrice(it)*Number(line.qty||1))}</strong><button class="miniDanger" onclick="removePublicCartItem('${esc(cid)}','${esc(it.id)}')">Retirer</button></div>`).join('')}</div><div class="gmUnifiedCartShopFoot"><span>Sous-total : <b>${money(subtotal)}</b></span><span>Livraison : <b>${money(fee)}</b></span></div></section>`}).join('');
  const pricing=globalCartPricing();
  document.body.insertAdjacentHTML('beforeend',`<div class="gmHomeAuthBackdrop" id="gmGlobalCartModal" onclick="if(event.target.id==='gmGlobalCartModal')this.remove()"><section class="gmHomeAuthCard gmUnifiedCartCard"><button class="gmHomeAuthClose" onclick="document.getElementById('gmGlobalCartModal')?.remove()">×</button><span class="gmHomeModalKicker">PANIER UNIQUE CLIENT</span><div class="gmUnifiedCartTitle"><div><h2>Mon panier GLOBAL MARKET</h2><p>Un seul panier pour vos produits et services de plusieurs boutiques.</p></div><span class="gmCartClientChip">${officialShopIcon('user')} ${esc(client.name||'Client connecté')}</span></div><div class="gmUnifiedCartGroups">${groupsHtml}</div><div class="gmUnifiedCartSummary"><div><span>Sous-total général</span><b>${money(pricing.subtotal)}</b></div><div><span>Frais de livraison répartis par boutique</span><b>${money(pricing.deliveryFee)}</b></div><div class="grand"><span>Total général</span><b>${money(pricing.total)}</b></div></div><div class="gmUnifiedCartActions"><button class="btn2" onclick="clearGlobalClientCart();document.getElementById('gmGlobalCartModal')?.remove()">Vider le panier</button><button class="gmHomePrimaryAuth" onclick="finalizeGlobalMarketCart()">Passer ma commande</button></div></section></div>`);
}
async function finalizeGlobalMarketCart(){
  const client=currentGlobalClient(),cart=getGlobalClientCart()||[];
  if(!client){openGlobalClientAuth('login');return alert('Connexion client obligatoire pour passer une commande.');}
  if(!cart.length)return alert('Votre panier est vide.');
  const button=document.querySelector('.gmUnifiedCartActions .gmHomePrimaryAuth');if(button){button.disabled=true;button.textContent='Envoi de la commande…';}
  try{
    const payload={cart:cart.map(x=>({itemId:x.itemId,qty:Number(x.qty||1)})),paymentMethod:'PAIEMENT À LA LIVRAISON'};
    const r=await fetchWithTimeout('/api/public/order',{method:'POST',headers:clientSecurityHeaders({'Content-Type':'application/json'}),body:JSON.stringify(payload),cache:'no-store'},25000);
    const j=await readApiPayload(r);
    cart.length=0;refreshGlobalMarketCartBadge();
    await cloudLoadPublicData();
    document.getElementById('gmGlobalCartModal')?.remove();
    document.body.insertAdjacentHTML('beforeend',`<div class="marketPayModalBackdrop orderSentModal"><div class="marketPayModal orderSentBox"><h2>Commande envoyée</h2><p>Votre commande <b>#${esc(j.checkoutId||'GLOBAL')}</b> a été répartie automatiquement entre <b>${Number(j.orders?.length||0)} boutique(s)</b>.</p><p>Vous pouvez suivre chaque lot depuis votre espace client.</p><div class="marketPayActions"><button onclick="document.querySelector('.orderSentModal')?.remove();openClientSpace()">Suivre mes commandes</button><button class="btn2" onclick="document.querySelector('.orderSentModal')?.remove();goGlobalMarketHome()">Retour à l’accueil</button></div></div></div>`);
  }catch(e){alert(secureErrorMessage(e,'Envoi de la commande impossible.'));if(button){button.disabled=false;button.textContent='Passer ma commande';}}
}
async function finalizePublicCartPayment(companyId,method){return finalizeGlobalMarketCart();}

function openGlobalClientAuth(mode='login'){
  document.getElementById('gmClientAuthModal')?.remove();document.getElementById('clientLoginModal')?.remove();document.getElementById('clientRegisterModal')?.remove();
  const isRegister=mode==='register',modalId=isRegister?'clientRegisterModal':'clientLoginModal';
  const fields=isRegister?`<label>Nom complet<input id="clientRegName" placeholder="Nom et prénom"></label><label>Téléphone<input id="clientRegPhone" placeholder="Ex : 0700000000"></label><label>Email<input id="clientRegEmail" type="email" placeholder="Email facultatif"></label><label>Mot de passe<input id="clientRegPass" type="password" placeholder="Majuscule, minuscule, chiffre et caractère spécial"></label><button class="gmHomePrimaryAuth" onclick="submitGlobalClientRegister()">Créer mon compte client</button><button class="gmHomeTextBtn" onclick="openGlobalClientAuth('login')">J’ai déjà un compte</button>`:`<label>Téléphone<input id="clientLoginPhone" placeholder="Votre téléphone"></label><label>Mot de passe<input id="clientLoginPass" type="password" placeholder="Votre mot de passe"></label><button class="gmHomePrimaryAuth" onclick="submitGlobalClientLogin()">Se connecter</button><button class="gmHomeTextBtn" onclick="openGlobalClientAuth('register')">Créer un compte client</button>`;
  document.body.insertAdjacentHTML('beforeend',`<div class="gmHomeAuthBackdrop" id="${modalId}" onclick="if(event.target.id==='${modalId}')this.remove()"><section class="gmHomeAuthCard gmClientAuthCard"><button class="gmHomeAuthClose" onclick="document.getElementById('${modalId}')?.remove()">×</button><span class="gmHomeModalKicker">COMPTE CLIENT GLOBAL</span><h2>${isRegister?'Créer mon compte GLOBAL MARKET':'Connexion client GLOBAL MARKET'}</h2><p>Un seul compte client pour acheter dans toutes les boutiques, disposer d’un panier unique et suivre tout votre historique.</p>${fields}</section></div>`);
}
function submitGlobalClientLogin(){return loginPublicClient();}
function submitGlobalClientRegister(){return savePublicClientRegister();}
function openClientLoginPopup(){return openGlobalClientAuth('login');}
function openClientRegisterPopup(){return openGlobalClientAuth('register');}

async function savePublicClientRegister(){
  const payload={name:($('#clientRegName')?.value||'').trim(),phone:($('#clientRegPhone')?.value||'').trim(),email:($('#clientRegEmail')?.value||'').trim(),password:($('#clientRegPass')?.value||'').trim()};
  if(!payload.name||!payload.phone||!payload.password)return alert('Nom, téléphone et mot de passe obligatoires.');
  try{const r=await fetchWithTimeout('/api/public/client/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},12000);const j=await readApiPayload(r);PUBLIC_CLIENT_SESSION=j.session||null;window.publicShopClientId=j.client?.id||'';await cloudLoadPublicData();document.getElementById('clientRegisterModal')?.remove();render();setTimeout(()=>openClientSpace(),0);}catch(e){alert(secureErrorMessage(e,'Inscription client impossible.'));}
}
async function loginPublicClient(){
  const phone=($('#clientLoginPhone')?.value||'').trim(),password=($('#clientLoginPass')?.value||'').trim();
  try{const j=await fetchApiJsonWithRetry('/api/public/client/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,password})},12000,3);PUBLIC_CLIENT_SESSION=j.session||null;window.publicShopClientId=j.client?.id||'';await cloudLoadPublicData();document.getElementById('clientLoginModal')?.remove();render();setTimeout(()=>openClientSpace(),0);}catch(e){alert(secureErrorMessage(e,'Téléphone ou mot de passe incorrect.'));}
}
async function logoutPublicClient(){
  try{await fetchWithTimeout('/api/public/client/session',{method:'DELETE',headers:clientSecurityHeaders()},6000)}catch(e){}
  PUBLIC_CLIENT_SESSION=null;window.publicShopClientId='';CLOUD_DATA=defaultData();
  try{await cloudLoadPublicData()}catch(e){}
  location.hash='#home';renderGlobalShop();
}

function openClientSpace(){
  document.getElementById('clientSpaceModal')?.remove();
  const d=seed(),client=currentGlobalClient();if(!client)return openGlobalClientAuth('login');
  const deleted=new Set([...(client.deletedOrderIds||[]),...((d.clientDeletedOrders&&d.clientDeletedOrders[client.id])||[])]);
  const companyMap=new Map((d.companies||[]).map(c=>[c.id,c]));
  const orders=(d.orders||[]).filter(o=>o.clientId===client.id&&!((o.clientDeletedIds||[]).includes(client.id))&&!deleted.has(o.id)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const rows=orders.map(o=>{const shop=o.shopName||companyMap.get(o.companyId)?.name||'Boutique';return `<tr><td><button class="orderLinkBtn" onclick="openMarketplaceOrderPopup('${esc(o.id||'CMD')}',false)">#${esc(o.id||'CMD')}</button><small class="gmCheckoutRef">${esc(o.checkoutId||'')}</small></td><td>${esc(shop)}</td><td>${new Date(o.date).toLocaleDateString('fr-FR')}</td><td>${orderItemsCount(o)} article(s)</td><td>${money(orderTotal(o))}</td><td>${esc(o.paymentMethod||'Non choisi')}</td><td><span class="mkStatus">${esc(orderMainStatus(o))}</span></td><td><button class="danger smallDeleteOrder" onclick="deleteMarketplaceOrder('${esc(o.id||'CMD')}',false)">Supprimer</button></td></tr>`}).join('')||'<tr><td colspan="8">Aucune commande pour le moment.</td></tr>';
  document.body.insertAdjacentHTML('beforeend',`<div class="marketPayModalBackdrop" id="clientSpaceModal"><div class="marketPayModal clientSpaceBox gmGlobalClientSpace"><button class="marketPayClose" onclick="document.getElementById('clientSpaceModal')?.remove()">×</button><div class="gmClientSpaceHead"><div><span class="gmHomeModalKicker">ESPACE CLIENT GLOBAL MARKET</span><h2>${esc(client.name)}</h2><p>${esc(client.phone)} ${client.email?'— '+esc(client.email):''}</p></div></div><h3>Historique et suivi de toutes mes commandes</h3><p class="sub">Chaque lot correspond à la boutique qui doit préparer vos produits. Les statuts sont mis à jour séparément par les administrateurs concernés.</p><div class="clientOrdersScroll"><table class="mkOrdersTable"><tr><th>N° LOT</th><th>Boutique</th><th>Date</th><th>Articles</th><th>Total</th><th>Paiement</th><th>Statut</th><th>Action</th></tr>${rows}</table></div><div class="marketPayActions"><button onclick="document.getElementById('clientSpaceModal')?.remove()">Fermer</button></div></div></div>`);
}
async function deleteMarketplaceOrder(orderId,isAdmin){
  if(!(await g3Confirm('Supprimer cette commande seulement de cette liste ?','Suppression commande')))return;
  if(isAdmin){const d=seed(),o=(d.orders||[]).find(x=>String(x.id)===String(orderId));if(!o)return alert('Commande introuvable.');o.adminDeleted=true;save(d);document.getElementById('marketOrderDetailsModal')?.remove();showMarketplacePage();return;}
  try{await securePublicPost('/api/public/order/delete',{orderId});await cloudLoadPublicData();document.getElementById('marketOrderDetailsModal')?.remove();document.getElementById('clientSpaceModal')?.remove();openClientSpace();}catch(e){alert(secureErrorMessage(e,'Suppression impossible.'));}
}


/* ========================================================================
   GLOBAL MARKET V5.5 — PANIER 3 SECTIONS & MINIMUM HORS VILLE
   ======================================================================== */
const GM_DEFAULT_DELIVERY_CITIES=[
  {name:'DIABO'},{name:'BOUAKE'},{name:'YAMOUSSOUKRO'},{name:'ABIDJAN'},
  {name:'ABENGOUROU'},{name:'MAN'},{name:'MANKONO'},{name:'KOROGHO'},{name:'KATIOLA'}
];
const GM_DEFAULT_LOCAL_NEIGHBORHOODS=[
  {id:'retrait-boutique',name:'RETRAIT A LA BOUTIQUE',pickup:true},
  {id:'quartier-1',name:'QUARTIER 1'},{id:'quartier-2',name:'QUARTIER 2'},{id:'quartier-3',name:'QUARTIER 3'},
  {id:'quartier-4',name:'QUARTIER 4'},{id:'quartier-5',name:'QUARTIER 5'},{id:'quartier-6',name:'QUARTIER 6'},
  {id:'quartier-7',name:'QUARTIER 7'},{id:'quartier-8',name:'QUARTIER 8'},{id:'quartier-9',name:'QUARTIER 9'}
];
const GM_DEFAULT_SHIPPING_METHODS=[
  {id:'retrait-boutique',name:'RETRAIT A LA BOUTIQUE',fee:0},
  {id:'jumia-ci',name:'JUMIA CI',fee:0},
  {id:'utb-transport',name:'UTB TRANSPORT',fee:0},
  {id:'avs-transport',name:'AVS TRANSPORT',fee:0},
  {id:'autres',name:'AUTRES',fee:0}
];
function gmDeliveryToken(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toUpperCase();
}
function gmMethodId(value){
  return gmDeliveryToken(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||('mode-'+Math.random().toString(36).slice(2,8));
}
function gmInferHomeCity(company){
  const known=GM_DEFAULT_DELIVERY_CITIES.map(x=>x.name);
  const source=gmDeliveryToken(company?.marketDeliveryConfig?.homeCity||company?.city||company?.address||'');
  const match=known.find(city=>source.includes(gmDeliveryToken(city)));
  if(match)return match;
  const raw=String(company?.city||company?.address||'').split(',')[0].trim();
  if(raw && raw.length<=50 && !/\d/.test(raw)) return gmDeliveryToken(raw);
  return 'DIABO';
}
function gmIsPickupMethod(method){const t=gmDeliveryToken(method?.name);return t.includes('RETRAIT')&&t.includes('BOUTIQUE');}
function gmIsPickupNeighborhood(neighborhood){return gmIsPickupMethod(neighborhood)||String(neighborhood?.id||'')==='retrait-boutique';}
function gmMarketplaceDeliveryConfig(company){
  const raw=company?.marketDeliveryConfig&&typeof company.marketDeliveryConfig==='object'?company.marketDeliveryConfig:{};
  const homeCity=gmDeliveryToken(raw.homeCity||gmInferHomeCity(company));
  let cities=(Array.isArray(raw.cities)?raw.cities:GM_DEFAULT_DELIVERY_CITIES).slice(0,10).map(x=>({name:gmDeliveryToken(x?.name)})).filter(x=>x.name);
  const seenCities=new Set();cities=cities.filter(x=>{const t=gmDeliveryToken(x.name);if(seenCities.has(t))return false;seenCities.add(t);return true;});
  if(homeCity&&!seenCities.has(homeCity)){cities.unshift({name:homeCity});cities=cities.slice(0,10);}

  const pickupNeighborhood={id:'retrait-boutique',name:'RETRAIT A LA BOUTIQUE',pickup:true};
  const rawNeighborhoods=Array.isArray(raw.neighborhoods)&&raw.neighborhoods.length?raw.neighborhoods:GM_DEFAULT_LOCAL_NEIGHBORHOODS;
  const neighborhoods=[pickupNeighborhood],seenNeighborhoods=new Set([gmDeliveryToken(pickupNeighborhood.name)]);
  for(const row of rawNeighborhoods){
    const name=gmDeliveryToken(row?.name);if(!name||gmIsPickupNeighborhood(row)||seenNeighborhoods.has(name))continue;
    seenNeighborhoods.add(name);neighborhoods.push({id:String(row?.id||gmMethodId(name)),name});if(neighborhoods.length>=10)break;
  }
  for(const row of GM_DEFAULT_LOCAL_NEIGHBORHOODS){
    if(neighborhoods.length>=10)break;const name=gmDeliveryToken(row.name);if(gmIsPickupNeighborhood(row)||seenNeighborhoods.has(name))continue;
    seenNeighborhoods.add(name);neighborhoods.push({id:row.id,name});
  }

  const rawMethods=(Array.isArray(raw.methods)&&raw.methods.length?raw.methods:GM_DEFAULT_SHIPPING_METHODS)
    .map(x=>({id:String(x?.id||gmMethodId(x?.name)).trim(),name:gmDeliveryToken(x?.name),fee:Math.max(0,Math.round(Number(x?.fee||0)))})).filter(x=>x.name);
  const pickup={id:'retrait-boutique',name:'RETRAIT A LA BOUTIQUE',fee:0};
  const methods=[pickup];const seenMethods=new Set([pickup.id]);
  for(const row of rawMethods){
    if(gmIsPickupMethod(row)||String(row.id)==='retrait-boutique')continue;
    const id=String(row.id||gmMethodId(row.name));if(seenMethods.has(id))continue;
    seenMethods.add(id);methods.push({id,name:row.name,fee:row.fee});if(methods.length>=10)break;
  }
  return {homeCity,cities,neighborhoods,methods};
}
function gmLocalDeliveryRate(subtotal){return deliveryFeeRateForSubtotal(Number(subtotal||0));}
function gmDeliveryConfigCityRow(city={},homeCity=''){
  const local=gmDeliveryToken(city.name)===gmDeliveryToken(homeCity);
  return `<div class="gmDeliveryConfigRow gmDeliveryCityRow">
    <input class="gmDeliveryCityName" maxlength="50" placeholder="Ville de livraison" value="${esc(gmDeliveryToken(city.name||''))}" oninput="gmRefreshDeliveryConfigRows()">
    <span class="gmDeliveryLocalHint">${local?'Ville de la boutique • quartiers + pourcentage local automatique':'Ville hors boutique • frais du moyen d’expédition uniquement'}</span>
    <button type="button" class="miniDanger gmDeliveryCityRemove" onclick="this.closest('.gmDeliveryCityRow')?.remove()">Retirer</button>
  </div>`;
}
function gmDeliveryNeighborhoodRow(neighborhood={},index=0){
  const locked=index===0||gmIsPickupNeighborhood(neighborhood);
  const name=locked?'RETRAIT A LA BOUTIQUE':gmDeliveryToken(neighborhood.name||`QUARTIER ${index}`);
  return `<div class="gmDeliveryConfigRow gmDeliveryNeighborhoodRow ${locked?'gmDeliveryNeighborhoodLocked':''}" data-neighborhood-id="${esc(locked?'retrait-boutique':String(neighborhood.id||gmMethodId(name)))}">
    <input class="gmDeliveryNeighborhoodName" maxlength="60" value="${esc(name)}" ${locked?'disabled':''}>
    <span class="gmDeliveryLocalHint">${locked?'🔒 Retrait local obligatoire • frais 0 FCFA':'Quartier local • frais calculé automatiquement par pourcentage'}</span>
    ${locked?'<button type="button" class="gmLockedMethodBtn" disabled>Verrouillé</button>':'<span class="gmDeliveryNeighborhoodIndex">'+String(index).padStart(2,'0')+'</span>'}
  </div>`;
}
function gmShippingMethodRow(method={}){
  const locked=String(method.id||'')==='retrait-boutique'||gmIsPickupMethod(method);
  const name=locked?'RETRAIT A LA BOUTIQUE':gmDeliveryToken(method.name||'');
  const fee=locked?0:Math.max(0,Number(method.fee||0));
  return `<div class="gmDeliveryConfigRow gmShippingMethodRow ${locked?'gmShippingMethodLocked':''}" data-method-id="${esc(locked?'retrait-boutique':String(method.id||gmMethodId(name)))}">
    <input class="gmShippingMethodName" maxlength="60" placeholder="Moyen d’expédition" value="${esc(name)}" ${locked?'disabled':''}>
    <input class="gmShippingMethodFee" type="number" min="0" step="50" placeholder="Frais du moyen (FCFA)" value="${fee}" ${locked?'disabled':''}>
    <span class="gmDeliveryLocalHint">${locked?'🔒 Moyen système • frais verrouillé à 0 FCFA':'Utilisé uniquement pour les livraisons hors de la ville de la boutique'}</span>
    ${locked?'<button type="button" class="gmLockedMethodBtn" disabled>Verrouillé</button>':'<button type="button" class="miniDanger" onclick="this.closest(\'.gmShippingMethodRow\')?.remove()">Retirer</button>'}
  </div>`;
}
function openMarketplaceDeliveryConfig(){
  document.getElementById('marketDeliveryConfigModal')?.remove();
  const {company}=current();if(!company)return;
  const cfg=gmMarketplaceDeliveryConfig(company);
  const html=`<div class="marketPayModalBackdrop" id="marketDeliveryConfigModal"><div class="marketPayModal gmDeliveryConfigModal">
    <button class="marketPayClose" onclick="document.getElementById('marketDeliveryConfigModal')?.remove()">×</button>
    <span class="gmHomeModalKicker">MARKETPLACE • LIVRAISON</span>
    <h2>Configuration livraison & expédition</h2>
    <p class="gmDeliveryIntro">Configurez la livraison locale par <b>quartier</b> et l’expédition vers les autres villes par <b>moyen d’expédition</b>.</p>
    <section class="gmDeliveryConfigSection">
      <div class="gmDeliveryConfigTitle"><div><h3>1. Ville de la boutique</h3><p>Dans cette ville, aucun moyen d’expédition n’est facturé : le frais local est calculé automatiquement par pourcentage, sauf retrait à la boutique à 0 FCFA.</p></div></div>
      <label class="gmDeliveryHomeLabel">Ville où est installée la boutique<input id="gmDeliveryHomeCity" maxlength="50" value="${esc(cfg.homeCity)}" oninput="gmRefreshDeliveryConfigRows()"></label>
      <div class="gmLocalRateGrid"><span>5 à 4 999 F <b>10 %</b></span><span>5 000 à 24 999 F <b>5 %</b></span><span>25 000 à 99 999 F <b>2 %</b></span><span>100 000 F et + <b>1,5 %</b></span></div>
    </section>
    <section class="gmDeliveryConfigSection">
      <div class="gmDeliveryConfigTitle"><div><h3>2. Quartiers de livraison locale</h3><p>Liste préremplie de 10 choix pour la ville de la boutique. « Retrait à la boutique » reste verrouillé ; renommez les 9 quartiers selon votre zone.</p></div></div>
      <div id="gmDeliveryNeighborhoodRows" class="gmDeliveryConfigRows">${cfg.neighborhoods.slice(0,10).map((x,i)=>gmDeliveryNeighborhoodRow(x,i)).join('')}</div>
      <small class="gmDeliveryLimit">10 choix obligatoires : 1 retrait boutique + 9 quartiers.</small>
    </section>
    <section class="gmDeliveryConfigSection">
      <div class="gmDeliveryConfigTitle"><div><h3>3. Villes de livraison</h3><p>Maximum 10 villes, ville de la boutique comprise. Les villes hors boutique n’utilisent jamais le pourcentage local.</p></div><button type="button" class="btn2" onclick="gmAddDeliveryCityRow()">+ Ajouter une ville</button></div>
      <div id="gmDeliveryCitiesRows" class="gmDeliveryConfigRows">${cfg.cities.map(x=>gmDeliveryConfigCityRow(x,cfg.homeCity)).join('')}</div>
      <small class="gmDeliveryLimit">Maximum : 10 villes.</small>
    </section>
    <section class="gmDeliveryConfigSection">
      <div class="gmDeliveryConfigTitle"><div><h3>4. Moyens d’expédition</h3><p>Utilisés pour les villes hors de la ville de la boutique. Autres villes : frais du moyen uniquement. « Retrait à la boutique » reste verrouillé à 0 FCFA.</p></div><button type="button" class="btn2" onclick="gmAddShippingMethodRow()">+ Ajouter un moyen</button></div>
      <div id="gmShippingMethodsRows" class="gmDeliveryConfigRows">${cfg.methods.map(gmShippingMethodRow).join('')}</div>
      <small class="gmDeliveryLimit">Vous pouvez enregistrer jusqu’à 10 moyens d’expédition.</small>
    </section>
    <div class="marketPayActions"><button id="gmSaveDeliveryConfigBtn" onclick="saveMarketplaceDeliveryConfig()">Enregistrer la configuration</button><button class="btn2" onclick="document.getElementById('marketDeliveryConfigModal')?.remove()">Fermer</button></div>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  gmRefreshDeliveryConfigRows();
}
function gmAddDeliveryCityRow(){
  const box=document.getElementById('gmDeliveryCitiesRows');if(!box)return;
  if(box.querySelectorAll('.gmDeliveryCityRow').length>=10)return alert('Maximum 10 villes de livraison.');
  box.insertAdjacentHTML('beforeend',gmDeliveryConfigCityRow({},($('#gmDeliveryHomeCity')?.value||'')));
}
function gmAddShippingMethodRow(){
  const box=document.getElementById('gmShippingMethodsRows');if(!box)return;
  if(box.querySelectorAll('.gmShippingMethodRow').length>=10)return alert('Maximum 10 moyens d’expédition.');
  box.insertAdjacentHTML('beforeend',gmShippingMethodRow({name:'',fee:0}));
}
function gmRefreshDeliveryConfigRows(){
  const home=gmDeliveryToken($('#gmDeliveryHomeCity')?.value||'');
  document.querySelectorAll('#gmDeliveryCitiesRows .gmDeliveryCityRow').forEach(row=>{
    const name=gmDeliveryToken(row.querySelector('.gmDeliveryCityName')?.value||'');
    const hint=row.querySelector('.gmDeliveryLocalHint'),remove=row.querySelector('.gmDeliveryCityRemove');
    const local=!!home&&name===home;
    if(hint)hint.textContent=local?'Ville de la boutique • quartiers + pourcentage local automatique':'Ville hors boutique • frais du moyen d’expédition uniquement';
    if(remove){remove.disabled=local;remove.textContent=local?'Obligatoire':'Retirer';}
  });
}
async function saveMarketplaceDeliveryConfig(){
  const {d,company}=current();const target=(d.companies||[]).find(x=>x.id===company?.id);if(!target)return;
  const homeCity=gmDeliveryToken($('#gmDeliveryHomeCity')?.value||'');if(!homeCity)return alert('Renseignez la ville où est installée la boutique.');
  const cityRows=[...document.querySelectorAll('#gmDeliveryCitiesRows .gmDeliveryCityRow')].map(row=>({name:gmDeliveryToken(row.querySelector('.gmDeliveryCityName')?.value||'')})).filter(x=>x.name);
  const uniqueCities=[];const citySeen=new Set();
  for(const row of [{name:homeCity},...cityRows]){const t=gmDeliveryToken(row.name);if(!t||citySeen.has(t))continue;citySeen.add(t);uniqueCities.push({name:t});if(uniqueCities.length>=10)break;}

  const neighborhoodRows=[...document.querySelectorAll('#gmDeliveryNeighborhoodRows .gmDeliveryNeighborhoodRow:not(.gmDeliveryNeighborhoodLocked)')]
    .map((row,i)=>({id:String(row.dataset.neighborhoodId||''),name:gmDeliveryToken(row.querySelector('.gmDeliveryNeighborhoodName')?.value||'')}));
  if(neighborhoodRows.length!==9||neighborhoodRows.some(x=>!x.name))return alert('Renseignez les 9 quartiers de livraison locale.');
  const neighborhoodSeen=new Set(['RETRAIT A LA BOUTIQUE']);
  const neighborhoods=[{id:'retrait-boutique',name:'RETRAIT A LA BOUTIQUE',pickup:true}];
  for(const row of neighborhoodRows){if(neighborhoodSeen.has(row.name))return alert('Chaque quartier de livraison doit avoir un nom différent.');neighborhoodSeen.add(row.name);neighborhoods.push({id:gmMethodId(row.name),name:row.name});}

  const methodRows=[...document.querySelectorAll('#gmShippingMethodsRows .gmShippingMethodRow:not(.gmShippingMethodLocked)')].map(row=>({name:gmDeliveryToken(row.querySelector('.gmShippingMethodName')?.value||''),fee:Math.max(0,Math.round(Number(row.querySelector('.gmShippingMethodFee')?.value||0)))})).filter(x=>x.name);
  const uniqueMethods=[{id:'retrait-boutique',name:'RETRAIT A LA BOUTIQUE',fee:0}];const methodSeen=new Set(['retrait-boutique']);
  for(const row of methodRows){const id=gmMethodId(row.name);if(id==='retrait-boutique'||methodSeen.has(id)||gmIsPickupMethod(row))continue;methodSeen.add(id);uniqueMethods.push({id,name:row.name,fee:row.fee});if(uniqueMethods.length>=10)break;}
  target.marketDeliveryConfig={homeCity,cities:uniqueCities,neighborhoods,methods:uniqueMethods,updatedAt:new Date().toISOString()};
  const btn=$('#gmSaveDeliveryConfigBtn');if(btn){btn.disabled=true;btn.textContent='ENREGISTREMENT…';}
  try{save(d);await cloudSaveNow(d);document.getElementById('marketDeliveryConfigModal')?.remove();alert('Configuration de livraison et d’expédition enregistrée.');showMarketplacePage();}
  catch(e){if(btn){btn.disabled=false;btn.textContent='Enregistrer la configuration';}alert(secureErrorMessage(e,'Enregistrement de la configuration impossible.'));}
}

function gmCartDeliveryState(){
  window.GLOBAL_MARKET_CART_DELIVERY=window.GLOBAL_MARKET_CART_DELIVERY||{city:'',neighborhood:'',addressDetail:'',methods:{}};
  window.GLOBAL_MARKET_CART_DELIVERY.methods=window.GLOBAL_MARKET_CART_DELIVERY.methods||{};
  window.GLOBAL_MARKET_CART_DELIVERY.neighborhood=window.GLOBAL_MARKET_CART_DELIVERY.neighborhood||'';
  return window.GLOBAL_MARKET_CART_DELIVERY;
}
function gmCartGroupedLines(){
  const d=seed(),cart=getGlobalClientCart()||[],grouped=new Map();
  for(const line of cart){const it=(d.items||[]).find(x=>x.id===line.itemId);if(!it)continue;if(!grouped.has(it.companyId))grouped.set(it.companyId,[]);grouped.get(it.companyId).push({line,it});}
  return grouped;
}
function gmCartAvailableCities(grouped,companyMap){
  const entries=[...grouped.keys()];if(!entries.length)return [];
  const configs=entries.map(cid=>gmMarketplaceDeliveryConfig(companyMap.get(cid)||{}));
  const first=configs[0].cities||[];
  return first.filter(city=>configs.every(cfg=>(cfg.cities||[]).some(x=>gmDeliveryToken(x.name)===gmDeliveryToken(city.name))));
}
function gmCartLocalNeighborhoods(grouped,companyMap,city){
  const localConfigs=[...grouped.keys()].map(cid=>gmMarketplaceDeliveryConfig(companyMap.get(cid)||{})).filter(cfg=>gmDeliveryToken(cfg.homeCity)===gmDeliveryToken(city));
  if(!localConfigs.length)return [];
  let common=(localConfigs[0].neighborhoods||[]).slice();
  for(const cfg of localConfigs.slice(1))common=common.filter(n=>(cfg.neighborhoods||[]).some(x=>gmDeliveryToken(x.name)===gmDeliveryToken(n.name)));
  const normal=common.filter(x=>!gmIsPickupNeighborhood(x)),pickup=common.filter(gmIsPickupNeighborhood);
  return [...normal,...pickup];
}
function gmAvailableShippingMethods(company,city){
  const cfg=gmMarketplaceDeliveryConfig(company);
  const local=gmDeliveryToken(city)===gmDeliveryToken(cfg.homeCity);
  if(local)return [];
  return (cfg.methods||[]).filter(method=>!gmIsPickupMethod(method));
}
function gmSetCartDeliveryCity(value){const st=gmCartDeliveryState();st.city=gmDeliveryToken(value);st.neighborhood='';st.methods={};openGlobalMarketCart();}
function gmSetCartNeighborhood(value){const st=gmCartDeliveryState();st.neighborhood=gmDeliveryToken(value);openGlobalMarketCart();}
function gmSetCartAddressDetail(value){gmCartDeliveryState().addressDetail=String(value||'').slice(0,500);}
function gmSetCartShippingMethod(companyId,value){gmCartDeliveryState().methods[String(companyId)]=String(value||'');openGlobalMarketCart();}
function gmCartShopPricing(companyId,rows,company,city){
  const st=gmCartDeliveryState(),cfg=gmMarketplaceDeliveryConfig(company);
  const subtotal=rows.reduce((sum,r)=>sum+itemMarketPrice(r.it)*Number(r.line.qty||1),0);
  const local=gmDeliveryToken(city)===gmDeliveryToken(cfg.homeCity);
  if(local){
    const neighborhood=(cfg.neighborhoods||[]).find(x=>gmDeliveryToken(x.name)===gmDeliveryToken(st.neighborhood));
    if(!neighborhood)return {subtotal,cityFee:0,methodFee:0,deliveryFee:0,total:subtotal,method:null,neighborhood:null,rate:0,valid:false,local:true,pickup:false,minimumOutside:0,minimumMet:true};
    const pickup=gmIsPickupNeighborhood(neighborhood),rate=pickup?0:gmLocalDeliveryRate(subtotal),cityFee=pickup?0:Math.round(Number(subtotal||0)*rate);
    const pickupMethod=pickup?{id:'retrait-boutique',name:'RETRAIT A LA BOUTIQUE',fee:0}:null;
    return {subtotal,cityFee,methodFee:0,deliveryFee:cityFee,total:subtotal+cityFee,method:pickupMethod,neighborhood,rate,valid:true,local:true,pickup,minimumOutside:0,minimumMet:true};
  }
  const methods=gmAvailableShippingMethods(company,city);
  let selected=methods.find(x=>String(x.id)===String(st.methods[String(companyId)]));
  if(!selected)selected=methods[0]||null;
  if(selected)st.methods[String(companyId)]=String(selected.id);
  if(!selected)return {subtotal,cityFee:0,methodFee:0,deliveryFee:0,total:subtotal,method:null,neighborhood:null,rate:0,valid:false,local:false,pickup:false};
  const methodFee=Math.max(0,Math.round(Number(selected.fee||0)));
  return {subtotal,cityFee:0,methodFee,deliveryFee:methodFee,total:subtotal+methodFee,method:selected,neighborhood:null,rate:0,valid:true,local:false,pickup:false};
}
function globalCartPricing(){
  const d=seed(),companyMap=new Map((d.companies||[]).map(c=>[c.id,c])),grouped=gmCartGroupedLines(),cities=gmCartAvailableCities(grouped,companyMap),st=gmCartDeliveryState();
  if(!cities.some(x=>gmDeliveryToken(x.name)===gmDeliveryToken(st.city)))st.city=cities[0]?.name||'';
  const localNeighborhoods=gmCartLocalNeighborhoods(grouped,companyMap,st.city);
  if(localNeighborhoods.length&&!localNeighborhoods.some(x=>gmDeliveryToken(x.name)===gmDeliveryToken(st.neighborhood)))st.neighborhood=localNeighborhoods[0]?.name||'';
  if(!localNeighborhoods.length)st.neighborhood='';
  let subtotal=0,deliveryFee=0,valid=!!st.city&&cities.length>0;
  for(const [cid,rows] of grouped){const p=gmCartShopPricing(cid,rows,companyMap.get(cid)||{},st.city);subtotal+=p.subtotal;deliveryFee+=p.deliveryFee;valid=valid&&p.valid;}
  return {subtotal,deliveryFee,total:subtotal+deliveryFee,shopCount:grouped.size,valid,city:st.city,cities,localNeighborhoods};
}
function openGlobalMarketCart(){
  document.getElementById('gmGlobalCartModal')?.remove();
  const client=currentGlobalClient();if(!client){openGlobalClientAuth('login');return;}
  const d=seed(),companyMap=new Map((d.companies||[]).map(c=>[c.id,c])),grouped=gmCartGroupedLines();
  if(!grouped.size)return alert('Votre panier est vide.');
  const st=gmCartDeliveryState(),cities=gmCartAvailableCities(grouped,companyMap);
  if(!cities.some(x=>gmDeliveryToken(x.name)===gmDeliveryToken(st.city)))st.city=cities[0]?.name||'';
  const localNeighborhoods=gmCartLocalNeighborhoods(grouped,companyMap,st.city);
  if(localNeighborhoods.length&&!localNeighborhoods.some(x=>gmDeliveryToken(x.name)===gmDeliveryToken(st.neighborhood)))st.neighborhood=localNeighborhoods[0]?.name||'';
  if(!localNeighborhoods.length)st.neighborhood='';
  const cityOptions=cities.map(x=>`<option value="${esc(x.name)}" ${gmDeliveryToken(x.name)===gmDeliveryToken(st.city)?'selected':''}>${esc(x.name)}</option>`).join('');
  let subtotalGeneral=0,feeGeneral=0,allMethodsValid=!!st.city&&cities.length>0;
  const groupsHtml=[...grouped.entries()].map(([cid,rows])=>{
    const company=companyMap.get(cid)||{},pricing=gmCartShopPricing(cid,rows,company,st.city);
    subtotalGeneral+=pricing.subtotal;feeGeneral+=pricing.deliveryFee;allMethodsValid=allMethodsValid&&pricing.valid;
    return `<section class="gmUnifiedCartShop">
      <div class="gmUnifiedCartShopHead"><div>${officialShopIcon('bag')}<span><b>${esc(company.name||'Boutique')}</b><small>${rows.length} référence(s)</small></span></div><strong>${money(pricing.total)}</strong></div>
      <div class="gmUnifiedCartLines">${rows.map(({line,it})=>`<div class="gmUnifiedCartLine"><div class="gmUnifiedCartThumb">${it.photo?`<img src="${esc(it.photo)}" alt="">`:mkProductVisual(it)}</div><div class="gmUnifiedCartInfo"><b>${esc(it.name)}</b><small>${esc(it.cat||'Produit / service')}</small><span>${money(itemMarketPrice(it))}</span></div><label>Qté<input type="number" min="1" value="${Number(line.qty||1)}" onchange="updatePublicCartQty('${esc(cid)}','${esc(it.id)}',this.value)"></label><strong>${money(itemMarketPrice(it)*Number(line.qty||1))}</strong><button class="miniDanger" onclick="removePublicCartItem('${esc(cid)}','${esc(it.id)}')">Retirer</button></div>`).join('')}</div>
    </section>`;
  }).join('');
  const pricings=[...grouped.entries()].map(([cid,rows])=>({cid,company:companyMap.get(cid)||{},pricing:gmCartShopPricing(cid,rows,companyMap.get(cid)||{},st.city)}));
  const requiresAddress=pricings.some(x=>!x.pricing.pickup);
  const hasLocal=pricings.some(x=>x.pricing.local),hasOutside=pricings.some(x=>!x.pricing.local);
  const total=subtotalGeneral+feeGeneral;
  const outsideOrderMinimumMet=!hasOutside||total>=10000;
  const neighborhoodOptions=localNeighborhoods.map(n=>`<option value="${esc(n.name)}" ${gmDeliveryToken(n.name)===gmDeliveryToken(st.neighborhood)?'selected':''}>${esc(n.name)}${gmIsPickupNeighborhood(n)?' — 0 FCFA':''}</option>`).join('');
  const neighborhoodSelector=hasLocal?`<label class="gmCartNeighborhoodField">Quartier de livraison *<select id="gmCartDeliveryNeighborhood" onchange="gmSetCartNeighborhood(this.value)">${neighborhoodOptions||'<option>Aucun quartier commun configuré</option>'}</select></label>`:'';
  const shippingSelectors=pricings.filter(x=>!x.pricing.local).map(({cid,company,pricing})=>{
    const methods=gmAvailableShippingMethods(company,st.city);
    const methodOptions=methods.map(m=>`<option value="${esc(m.id)}" ${pricing.method?.id===m.id?'selected':''}>${esc(m.name)}</option>`).join('');
    return `<label class="gmCartShippingChoice"><span>${grouped.size>1?'Moyen — '+esc(company.name||'Boutique'):'Moyen d’expédition'} *</span><select onchange="gmSetCartShippingMethod('${esc(cid)}',this.value)" ${methods.length?'':'disabled'}>${methodOptions||'<option>Aucun moyen disponible</option>'}</select></label>`;
  }).join('');
  const outsideMethodFee=pricings.reduce((sum,x)=>sum+Number(x.pricing.methodFee||0),0);
  const localDeliveryFee=pricings.reduce((sum,x)=>sum+Number(x.pricing.cityFee||0),0);
  const shippingBody=hasOutside
    ?`${shippingSelectors}<label>Frais d’expédition<input class="gmCartAutoFee" value="${esc(money(outsideMethodFee))}" readonly></label><small class="gmCartSectionHint">Hors ville de la boutique : seuls les frais du moyen choisi sont appliqués. Aucun pourcentage local n’est ajouté.</small>`
    :`<div class="gmCartLocalMode"><b>Livraison locale par quartier</b><span>${gmIsPickupNeighborhood({name:st.neighborhood})?'Retrait à la boutique sélectionné.':'Le moyen d’expédition n’est pas utilisé dans la ville de la boutique.'}</span></div><label>Frais d’expédition<input class="gmCartAutoFee" value="${esc(money(localDeliveryFee))}" readonly></label>`;
  const minWarning=!outsideOrderMinimumMet?`<div class="gmOutsideMinimumWarning"><b>Minimum hors ville : 10 000 FCFA par commande.</b><span>Total actuel : ${money(total)} — ajoutez ${money(Math.max(0,10000-total))} pour pouvoir commander.</span></div>`:'';
  const addressCard=cities.length?`<section class="gmCartCheckoutCard gmCartAddressCard"><div class="gmCartCheckoutHead"><span>1</span><h3>Adresse de livraison</h3></div><label>Ville de livraison *<select id="gmCartDeliveryCity" onchange="gmSetCartDeliveryCity(this.value)">${cityOptions}</select></label>${neighborhoodSelector}<label>Détail sur l’adresse de livraison ${requiresAddress?'*':''}<textarea id="gmCartDeliveryAddress" maxlength="500" placeholder="Quartier, rue, immeuble, porte, repère..." oninput="gmSetCartAddressDetail(this.value)">${esc(st.addressDetail||'')}</textarea></label></section>`:`<section class="gmCartCheckoutCard gmDeliveryUnavailable"><div class="gmCartCheckoutHead"><span>1</span><h3>Adresse de livraison</h3></div><p>Aucune ville de livraison commune n’est configurée pour toutes les boutiques de ce panier.</p><small>Retirez un article d’une boutique ou demandez aux administrateurs d’ajouter une ville commune.</small></section>`;
  const shippingCard=`<section class="gmCartCheckoutCard gmCartShippingCard"><div class="gmCartCheckoutHead"><span>2</span><h3>Moyen d’expédition</h3></div>${cities.length?shippingBody:'<p>Indisponible tant qu’aucune ville commune n’est configurée.</p>'}</section>`;
  const summaryCard=`<section class="gmCartCheckoutCard gmCartSummaryCard"><div class="gmCartCheckoutHead"><span>3</span><h3>Résumé de la commande</h3></div><div class="gmUnifiedCartSummary gmDeliveryCartSummary"><div><span>Sous-total produits & services</span><b>${money(subtotalGeneral)}</b></div><div><span>Frais de livraison / expédition</span><b>${money(feeGeneral)}</b></div><div class="grand"><span>Total général</span><b>${money(total)}</b></div></div>${minWarning}</section>`;
  const orderDisabled=!allMethodsValid||!cities.length||(hasLocal&&!localNeighborhoods.length)||!outsideOrderMinimumMet;
  document.body.insertAdjacentHTML('beforeend',`<div class="gmHomeAuthBackdrop" id="gmGlobalCartModal" onclick="if(event.target.id==='gmGlobalCartModal')this.remove()"><section class="gmHomeAuthCard gmUnifiedCartCard"><button class="gmHomeAuthClose" onclick="document.getElementById('gmGlobalCartModal')?.remove()">×</button><span class="gmHomeModalKicker">PANIER UNIQUE CLIENT</span><div class="gmUnifiedCartTitle"><div><h2>Mon panier GLOBAL MARKET</h2><p>Un seul panier pour vos produits et services de plusieurs boutiques.</p></div><span class="gmCartClientChip">${officialShopIcon('user')} ${esc(client.name||'Client connecté')}</span></div><div class="gmUnifiedCartMain"><div class="gmUnifiedCartGroups">${groupsHtml}</div><div class="gmCartCheckoutGrid">${addressCard}${shippingCard}${summaryCard}</div></div><div class="gmUnifiedCartActions"><button class="btn2" onclick="clearGlobalClientCart();document.getElementById('gmGlobalCartModal')?.remove()">Vider le panier</button><button class="gmHomePrimaryAuth" onclick="finalizeGlobalMarketCart()" ${orderDisabled?'disabled':''}>Passer ma commande</button></div></section></div>`);
}
async function finalizeGlobalMarketCart(){
  const client=currentGlobalClient(),cart=getGlobalClientCart()||[],st=gmCartDeliveryState();
  if(!client){openGlobalClientAuth('login');return alert('Connexion client obligatoire pour passer une commande.');}
  if(!cart.length)return alert('Votre panier est vide.');
  const pricing=globalCartPricing();if(!pricing.valid)return alert('La configuration de livraison de ce panier est incomplète.');
  const d=seed(),companyMap=new Map((d.companies||[]).map(c=>[c.id,c])),grouped=gmCartGroupedLines();
  const shopPricings=[...grouped.entries()].map(([cid,rows])=>gmCartShopPricing(cid,rows,companyMap.get(cid)||{},st.city));
  const hasOutside=shopPricings.some(p=>!p.local);
  if(hasOutside&&Number(pricing.total||0)<10000)return alert(`Toute commande hors de la ville de la boutique doit avoir un total général d’au moins 10 000 FCFA. Total actuel : ${money(pricing.total)}.`);
  const hasLocal=shopPricings.some(p=>p.local);
  if(hasLocal&&!String(st.neighborhood||'').trim())return alert('Choisissez le quartier de livraison.');
  const requiresAddress=shopPricings.some(p=>!p.pickup);
  if(requiresAddress&&!String(st.addressDetail||'').trim())return alert('Renseignez le détail sur l’adresse de livraison.');
  const shippingByCompany=[...grouped.entries()].map(([cid,rows])=>{const p=gmCartShopPricing(cid,rows,companyMap.get(cid)||{},st.city);return {companyId:cid,methodId:p.local?'':(p.method?.id||'')};});
  const button=document.querySelector('.gmUnifiedCartActions .gmHomePrimaryAuth');if(button){button.disabled=true;button.textContent='Envoi de la commande…';}
  try{
    const payload={cart:cart.map(x=>({itemId:x.itemId,qty:Number(x.qty||1)})),paymentMethod:'PAIEMENT À LA LIVRAISON',deliveryCity:st.city,deliveryNeighborhood:String(st.neighborhood||'').trim(),deliveryAddressDetail:String(st.addressDetail||'').trim(),shippingByCompany};
    const r=await fetchWithTimeout('/api/public/order',{method:'POST',headers:clientSecurityHeaders({'Content-Type':'application/json'}),body:JSON.stringify(payload),cache:'no-store'},25000);
    const j=await readApiPayload(r);cart.length=0;window.GLOBAL_MARKET_CART_DELIVERY={city:'',neighborhood:'',addressDetail:'',methods:{}};refreshGlobalMarketCartBadge();await cloudLoadPublicData();document.getElementById('gmGlobalCartModal')?.remove();
    document.body.insertAdjacentHTML('beforeend',`<div class="marketPayModalBackdrop orderSentModal"><div class="marketPayModal orderSentBox"><h2>Commande envoyée</h2><p>Votre commande <b>#${esc(j.checkoutId||'GLOBAL')}</b> a été enregistrée pour <b>${esc(st.city)}</b> et répartie entre <b>${Number(j.orders?.length||0)} boutique(s)</b>.</p><p>Vous pouvez suivre chaque lot depuis votre espace client.</p><div class="marketPayActions"><button onclick="document.querySelector('.orderSentModal')?.remove();openClientSpace()">Suivre mes commandes</button><button class="btn2" onclick="document.querySelector('.orderSentModal')?.remove();goGlobalMarketHome()">Retour à l’accueil</button></div></div></div>`);
  }catch(e){alert(secureErrorMessage(e,'Envoi de la commande impossible.'));if(button){button.disabled=false;button.textContent='Passer ma commande';}}
}
async function finalizePublicCartPayment(companyId,method){return finalizeGlobalMarketCart();}

let GM_BUSINESS_LOGIN_BUSY=false;
async function guardedBusinessLogin(){
  if(GM_BUSINESS_LOGIN_BUSY)return;
  GM_BUSINESS_LOGIN_BUSY=true;
  const btn=document.getElementById('loginSubmitBtn');if(btn)btn.disabled=true;
  try{return await login();}finally{GM_BUSINESS_LOGIN_BUSY=false;if(btn&&!btn.getAttribute('aria-busy'))btn.disabled=false;}
}
let GM_CLIENT_LOGIN_BUSY=false,GM_CLIENT_REGISTER_BUSY=false;
async function loginPublicClient(){
  if(GM_CLIENT_LOGIN_BUSY)return;GM_CLIENT_LOGIN_BUSY=true;
  const btn=document.querySelector('#clientLoginModal .gmHomePrimaryAuth');if(btn){btn.disabled=true;btn.textContent='CONNEXION EN COURS…';}
  const phone=($('#clientLoginPhone')?.value||'').trim(),password=($('#clientLoginPass')?.value||'').trim();
  if(!phone||!password){GM_CLIENT_LOGIN_BUSY=false;if(btn){btn.disabled=false;btn.textContent='Se connecter';}return alert('Téléphone et mot de passe obligatoires.');}
  try{const j=await fetchApiJsonWithRetry('/api/public/client/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,password})},12000,3);PUBLIC_CLIENT_SESSION=j.session||null;window.publicShopClientId=j.client?.id||'';await cloudLoadPublicData();document.getElementById('clientLoginModal')?.remove();render();setTimeout(()=>openClientSpace(),0);}catch(e){alert(secureErrorMessage(e,'Téléphone ou mot de passe incorrect.'));}finally{GM_CLIENT_LOGIN_BUSY=false;if(btn?.isConnected){btn.disabled=false;btn.textContent='Se connecter';}}
}
async function savePublicClientRegister(){
  if(GM_CLIENT_REGISTER_BUSY)return;GM_CLIENT_REGISTER_BUSY=true;
  const btn=document.querySelector('#clientRegisterModal .gmHomePrimaryAuth');if(btn){btn.disabled=true;btn.textContent='CRÉATION EN COURS…';}
  const payload={name:($('#clientRegName')?.value||'').trim(),phone:($('#clientRegPhone')?.value||'').trim(),email:($('#clientRegEmail')?.value||'').trim(),password:($('#clientRegPass')?.value||'').trim()};
  if(!payload.name||!payload.phone||!payload.password){GM_CLIENT_REGISTER_BUSY=false;if(btn){btn.disabled=false;btn.textContent='Créer mon compte client';}return alert('Nom, téléphone et mot de passe obligatoires.');}
  try{const r=await fetchWithTimeout('/api/public/client/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},12000);const j=await readApiPayload(r);PUBLIC_CLIENT_SESSION=j.session||null;window.publicShopClientId=j.client?.id||'';await cloudLoadPublicData();document.getElementById('clientRegisterModal')?.remove();render();setTimeout(()=>openClientSpace(),0);}catch(e){alert(secureErrorMessage(e,'Inscription client impossible.'));}finally{GM_CLIENT_REGISTER_BUSY=false;if(btn?.isConnected){btn.disabled=false;btn.textContent='Créer mon compte client';}}
}
function gmTogglePasswordField(input,button){
  const show=input.type==='password';input.type=show?'text':'password';input.dataset.gmPassword='1';
  button.textContent=show?'🙈':'👁';button.setAttribute('aria-label',show?'Masquer le mot de passe':'Afficher le mot de passe');button.setAttribute('aria-pressed',String(show));
}
function gmEnhancePasswordFields(root=document){
  const scope=root&&root.querySelectorAll?root:document;
  scope.querySelectorAll('input[type="password"][id],input[data-gm-password="1"][id]').forEach(input=>{
    if(input.closest('.gmRegisterPasswordControl')||input.closest('.gmPasswordWrap'))return;
    input.dataset.gmPassword='1';
    const parent=input.parentNode;if(!parent)return;
    const wrap=document.createElement('span');wrap.className='gmPasswordWrap';parent.insertBefore(wrap,input);wrap.appendChild(input);
    const button=document.createElement('button');button.type='button';button.className='gmPasswordEye';button.textContent='👁';button.setAttribute('aria-label','Afficher le mot de passe');button.setAttribute('aria-pressed','false');button.onclick=()=>gmTogglePasswordField(input,button);wrap.appendChild(button);
  });
}
setTimeout(()=>gmEnhancePasswordFields(document),0);
if(window.MutationObserver){
  const gmPasswordObserver=new MutationObserver(records=>{for(const record of records){for(const node of record.addedNodes||[]){if(node?.nodeType===1)gmEnhancePasswordFields(node);}}});
  gmPasswordObserver.observe(document.documentElement,{childList:true,subtree:true});
}



/* ========================================================================
   GLOBAL MARKET V5.6 — SUIVI CLIENT, PAIEMENTS, MESSAGERIE & À PROPOS
   ======================================================================== */
function gm56OrderCancelled(o){return String(o?.validationStatus||o?.delivery||'').toLowerCase().includes('annul')}
function gm56OrderPaidConfirmed(o){return String(o?.paymentStatus||'').toLowerCase().includes('confirm')}
function gm56OrderDelivered(o){return String(o?.deliveryStatus||o?.delivery||'').toLowerCase().includes('livr')&&!String(o?.deliveryStatus||'').toLowerCase().includes('cours')}
function gm56OrderValidated(o){return String(o?.validationStatus||'').toLowerCase().includes('valid')&&!gm56OrderCancelled(o)}
function gm56OrderPaymentSubmitted(o){return Boolean(String(o?.transactionId||o?.paymentRef||'').trim())||String(o?.paymentStatus||'').toLowerCase().includes('déclar')}
function orderMainStatus(o){
  if(gm56OrderCancelled(o))return 'Commande annulée';
  if(gm56OrderDelivered(o))return 'Livrée';
  if(gm56OrderPaidConfirmed(o))return 'Livraison en cours';
  if(gm56OrderValidated(o))return gm56OrderPaymentSubmitted(o)?'Paiement en vérification':'Commande validée';
  return 'En attente';
}
function gm56OrderItemsSummary(o){
  return normalizeOrderItems(o).map(x=>`${esc(x.item||'Article')} × ${Number(x.qty||1)}`).join('<br>')||'Aucun article';
}
function gm56OrderClientAction(o){
  if(gm56OrderCancelled(o))return `<span class="gm56OrderState cancelled">Commande annulée</span>`;
  if(gm56OrderDelivered(o))return `<span class="gm56OrderState delivered">Livrée</span>`;
  if(gm56OrderPaidConfirmed(o))return `<span class="gm56OrderState shipping">Livraison en cours</span>`;
  if(gm56OrderValidated(o)){
    if(gm56OrderPaymentSubmitted(o))return `<span class="gm56OrderState verifying">Paiement en vérification</span>`;
    return `<button class="gm56PayOrderBtn" onclick="openClientOrderPayment('${esc(o.id)}')">Régler ma commande</button>`;
  }
  return `<span class="gm56OrderState waiting">En attente</span>`;
}
function gm56ClientOrderControls(o){
  const paid=gm56OrderPaidConfirmed(o),cancelled=gm56OrderCancelled(o);
  const cancel=!paid&&!cancelled?`<button class="gm56CancelOrderBtn" onclick="cancelClientMarketplaceOrder('${esc(o.id)}')">Annuler</button>`:'';
  const del=!paid&&cancelled?`<button class="gm56DeleteOrderBtn" onclick="deleteMarketplaceOrder('${esc(o.id)}',false)">Supprimer</button>`:'';
  return `<div class="gm56OrderRowControls"><button class="btn2" onclick="openMarketplaceOrderPopup('${esc(o.id)}',false)">Détails</button>${cancel}${del}</div>`;
}
function gm56ClientOrdersMarkup(){
  const d=seed(),client=currentGlobalClient();if(!client)return '<p class="notice">Connexion client requise.</p>';
  const companyMap=new Map((d.companies||[]).map(c=>[c.id,c]));
  const orders=(d.orders||[]).filter(o=>String(o.clientId||'')===String(client.id||'')).sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!orders.length)return '<div class="gm56EmptyState"><span>🛒</span><b>Aucune commande affichée.</b><p>GLOBAL MARKET vérifie aussi votre ancien historique V5/V6.</p><button class="btn2" onclick="gmV612ForceClientOrderRecovery()">Restaurer mes anciennes commandes</button></div>';
  const groups=new Map();
  orders.forEach(o=>{const cid=String(o.companyId||'');if(!groups.has(cid))groups.set(cid,[]);groups.get(cid).push(o)});
  return [...groups.entries()].map(([cid,rows])=>{
    const shop=rows[0]?.shopName||companyMap.get(cid)?.name||'Boutique';
    const body=rows.map(o=>`<tr><td><button class="orderLinkBtn" onclick="openMarketplaceOrderPopup('${esc(o.id)}',false)">#${esc(o.id)}</button><small class="gmCheckoutRef">${esc(o.checkoutId||'')}</small></td><td>${new Date(o.date||Date.now()).toLocaleString('fr-FR')}</td><td>${gm56OrderItemsSummary(o)}</td><td><small>${esc(o.deliveryCity||'-')}${o.deliveryNeighborhood?' · '+esc(o.deliveryNeighborhood):''}</small></td><td><b>${money(orderTotal(o))}</b></td><td>${gm56OrderClientAction(o)}</td><td>${gm56ClientOrderControls(o)}</td></tr>`).join('');
    return `<section class="gm56ClientShopGroup"><div class="gm56ClientShopHead">${officialShopIcon('bag')}<div><b>${esc(shop)}</b><small>${rows.length} commande(s) / lot(s)</small></div></div><div class="clientOrdersScroll"><table class="mkOrdersTable gm56ClientOrdersTable"><tr><th>Commande</th><th>Date</th><th>Produits / services</th><th>Livraison</th><th>Total</th><th>Statut / paiement</th><th>Actions</th></tr>${body}</table></div></section>`;
  }).join('');
}
function gm56ClientAccountMarkup(){
  const c=currentGlobalClient();if(!c)return '';
  return `<div class="gm56ClientAccountGrid"><section><h3>Informations du client</h3><label>Nom complet<input id="gm56ClientName" value="${esc(c.name||'')}"></label><label>Identifiant / téléphone<input id="gm56ClientPhone" value="${esc(c.phone||'')}"></label><label>Email<input id="gm56ClientEmail" type="email" value="${esc(c.email||'')}"></label><p class="gm56AccountMeta">Compte créé le ${new Date(c.createdAt||Date.now()).toLocaleDateString('fr-FR')}</p></section><section><h3>Sécurité du compte</h3><label>Mot de passe actuel<input id="gm56ClientCurrentPass" type="password" autocomplete="current-password" placeholder="Requis si vous changez l'identifiant ou le mot de passe"></label><label>Nouveau mot de passe<input id="gm56ClientNewPass" type="password" autocomplete="new-password" placeholder="Laisser vide pour conserver le mot de passe"></label><small>Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.</small><button class="gmHomePrimaryAuth" onclick="saveGlobalClientAccount()">Enregistrer mes modifications</button></section></div>`;
}
function gm56ClientMessagesMarkup(){
  const d=seed(),client=currentGlobalClient();if(!client)return '';
  const companies=(d.companies||[]).filter(c=>hasPlanFeature(c,'public_shop'));
  const map=new Map(companies.map(c=>[c.id,c]));
  const msgs=(d.marketMessages||[]).filter(m=>m.clientId===client.id&&!m.clientDeleted).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const rows=msgs.map(m=>`<tr><td><input type="checkbox" class="gm56ClientMsgCheck" value="${esc(m.id)}"></td><td>${esc(map.get(m.companyId)?.name||'Boutique')}</td><td><span class="gm56MsgFrom ${m.senderType==='admin'?'admin':'client'}">${m.senderType==='admin'?'Boutique':'Vous'}</span></td><td>${esc(m.body||'')}</td><td>${new Date(m.createdAt||Date.now()).toLocaleString('fr-FR')}</td><td><button class="btn2" onclick="gm56OpenClientMessageComposer('${esc(m.companyId)}')">Répondre</button></td></tr>`).join('')||'<tr><td colspan="6">Aucun message.</td></tr>';
  return `<section class="gm56ClientMessageComposer"><div><h3>Nouveau message</h3><p>Écrivez directement à une boutique GLOBAL MARKET.</p></div><label>Boutique<select id="gm56ClientMessageCompany">${companies.map(c=>`<option value="${esc(c.id)}">${esc(c.name||'Boutique')}</option>`).join('')}</select></label><label>Message<textarea id="gm56ClientMessageText" maxlength="3000" placeholder="Votre demande..."></textarea></label><button class="gmHomePrimaryAuth" onclick="gm56SendClientMessage()">Envoyer le message</button></section><div class="gm56MessageToolbar"><label><input type="checkbox" onchange="document.querySelectorAll('.gm56ClientMsgCheck').forEach(x=>x.checked=this.checked)"> Tout sélectionner</label><button class="gm56DeleteOrderBtn" onclick="gm56DeleteClientMessages()">Supprimer la sélection</button></div><div class="clientOrdersScroll"><table class="mkOrdersTable"><tr><th></th><th>Boutique</th><th>De</th><th>Message</th><th>Date</th><th>Action</th></tr>${rows}</table></div>`;
}
function gm56RenderClientSpaceTab(tab='orders'){
  const body=document.getElementById('gm56ClientSpaceBody');if(!body)return;
  document.querySelectorAll('.gm56ClientSpaceTabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  body.innerHTML=tab==='account'?gm56ClientAccountMarkup():tab==='messages'?gm56ClientMessagesMarkup():gm56ClientOrdersMarkup();
  gmEnhancePasswordFields(body);
}

async function gmV611RefreshClientSpace(tab='orders'){
  const client=currentGlobalClient();if(!client||!PUBLIC_CLIENT_SESSION?.clientId)return null;
  try{
    if(tab==='messages'){
      const j=await fetchApiJsonWithRetry('/api/v6/client/messages?page=1&pageSize=100',{cache:'no-store'},12000,2);
      if(Array.isArray(j.messages)){
        const keep=(CLOUD_DATA.marketMessages||[]).filter(m=>String(m.clientId||'')!==String(client.id));
        CLOUD_DATA.marketMessages=[...keep,...j.messages];
      }
      return j;
    }
    if(tab==='orders'){
      const j=await fetchApiJsonWithRetry('/api/v6/client/orders?page=1&pageSize=100',{cache:'no-store'},20000,2);
      // Une réponse vide non autoritative ne doit jamais effacer l'historique déjà visible.
      if(Array.isArray(j.orders)&&(j.orders.length||j.authoritative)){
        const keep=(CLOUD_DATA.orders||[]).filter(o=>String(o.clientId||'')!==String(client.id||''));
        CLOUD_DATA.orders=[...keep,...j.orders.map(o=>({...o,clientId:client.id}))];
      }
      return j;
    }
  }catch(e){console.info('[V6.1.2] historique client en cours de restauration',e?.message||e)}
  return null;
}

async function gmV612ForceClientOrderRecovery(){
  const client=currentGlobalClient();if(!client||!PUBLIC_CLIENT_SESSION?.clientId)return openGlobalClientAuth('login');
  const btn=document.querySelector('#gm56ClientSpaceBody .gm56EmptyState button');if(btn){btn.disabled=true;btn.textContent='Restauration en cours…';}
  try{
    const j=await fetchApiJsonWithRetry('/api/v6/client/orders?page=1&pageSize=100&recover=1',{cache:'no-store'},30000,2);
    if(Array.isArray(j.orders)){
      const keep=(CLOUD_DATA.orders||[]).filter(o=>String(o.clientId||'')!==String(client.id||''));
      if(j.orders.length||j.authoritative)CLOUD_DATA.orders=[...keep,...j.orders.map(o=>({...o,clientId:client.id}))];
    }
    gm56RenderClientSpaceTab('orders');
    if(j.orders?.length)alert(`${j.orders.length} commande(s) retrouvée(s) dans votre historique.`);
    else if(!j.authoritative)alert('La restauration historique est encore en cours. Réessayez dans quelques instants.');
    else alert('Aucune ancienne commande rattachable à ce compte n’a été trouvée automatiquement.');
  }catch(e){alert(secureErrorMessage(e,'Restauration des anciennes commandes impossible.'));}
  finally{if(btn?.isConnected){btn.disabled=false;btn.textContent='Restaurer mes anciennes commandes';}}
}

function openClientSpace(tab='orders'){
  if(!['orders','account','messages'].includes(tab))tab='orders';
  document.getElementById('clientSpaceModal')?.remove();
  const client=currentGlobalClient();if(!client)return openGlobalClientAuth('login');
  document.body.insertAdjacentHTML('beforeend',`<div class="marketPayModalBackdrop" id="clientSpaceModal"><div class="marketPayModal clientSpaceBox gmGlobalClientSpace gm56ClientSpace"><button class="marketPayClose" onclick="document.getElementById('clientSpaceModal')?.remove()">×</button><div class="gmClientSpaceHead"><div><span class="gmHomeModalKicker">ESPACE CLIENT GLOBAL MARKET</span><h2>${esc(client.name||'Client')}</h2><p>${esc(client.phone||'')} ${client.email?'— '+esc(client.email):''}</p></div></div><div class="gm56ClientSpaceTabs"><button data-tab="orders" onclick="gm56RenderClientSpaceTab('orders')">Mes commandes</button><button data-tab="account" onclick="gm56RenderClientSpaceTab('account')">Mon compte</button><button data-tab="messages" onclick="gm56RenderClientSpaceTab('messages')">Message</button></div><div id="gm56ClientSpaceBody"></div><div class="marketPayActions"><button class="btn2" onclick="document.getElementById('clientSpaceModal')?.remove()">Fermer</button></div></div></div>`);
  gm56RenderClientSpaceTab(tab);
  // Actualisation ciblée : ne recharge pas tout GLOBAL MARKET pour afficher les commandes/messages du client.
  if(tab==='orders'||tab==='messages')gmV611RefreshClientSpace(tab).then(()=>{if(document.getElementById('clientSpaceModal'))gm56RenderClientSpaceTab(tab)});
}
async function saveGlobalClientAccount(){
  const payload={name:($('#gm56ClientName')?.value||'').trim(),phone:($('#gm56ClientPhone')?.value||'').trim(),email:($('#gm56ClientEmail')?.value||'').trim(),currentPassword:($('#gm56ClientCurrentPass')?.value||''),newPassword:($('#gm56ClientNewPass')?.value||'')};
  try{const j=await securePublicPost('/api/public/client/profile',payload);if(j.session)PUBLIC_CLIENT_SESSION=j.session;await cloudLoadPublicData();alert('Votre compte client a été mis à jour.');openClientSpace('account');render();}catch(e){alert(secureErrorMessage(e,'Modification du compte impossible.'))}
}
async function cancelClientMarketplaceOrder(orderId){
  if(!(await g3Confirm('Annuler cette commande ? Après annulation, vous pourrez la supprimer de votre liste.','Annuler la commande')))return;
  try{await securePublicPost('/api/public/order/cancel',{orderId});await cloudLoadPublicData();openClientSpace('orders');}catch(e){alert(secureErrorMessage(e,'Annulation impossible.'))}
}
async function deleteMarketplaceOrder(orderId,isAdmin){
  if(isAdmin){
    if(!(await g3Confirm('Retirer cette commande de la liste administrateur ?','Suppression commande')))return;
    const d=seed(),o=(d.orders||[]).find(x=>String(x.id)===String(orderId));if(!o)return alert('Commande introuvable.');o.adminDeleted=true;save(d);await cloudSaveNow(d).catch(()=>{});document.getElementById('marketOrderDetailsModal')?.remove();showMarketplacePage();return;
  }
  if(!(await g3Confirm('Supprimer définitivement cette commande annulée ? Elle disparaîtra aussi de la liste de la boutique.','Suppression définitive')))return;
  try{await securePublicPost('/api/public/order/delete',{orderId});await cloudLoadPublicData();document.getElementById('marketOrderDetailsModal')?.remove();openClientSpace('orders');}catch(e){alert(secureErrorMessage(e,'Suppression impossible.'))}
}
function openClientOrderPayment(orderId){
  document.getElementById('gm56ClientPaymentModal')?.remove();
  const d=seed(),o=(d.orders||[]).find(x=>String(x.id)===String(orderId)&&x.clientId===currentGlobalClient()?.id);if(!o)return alert('Commande introuvable.');
  const c=(d.companies||[]).find(x=>x.id===o.companyId)||{};const enabled=gm56OrderValidated(o)&&!gm56OrderCancelled(o)&&!gm56OrderPaidConfirmed(o);
  document.body.insertAdjacentHTML('beforeend',`<div class="marketPayModalBackdrop" id="gm56ClientPaymentModal"><div class="marketPayModal gm56ClientPaymentBox"><button class="marketPayClose" onclick="document.getElementById('gm56ClientPaymentModal')?.remove()">×</button><span class="gmHomeModalKicker">RÈGLEMENT DE COMMANDE</span><h2>#${esc(o.id)}</h2><p>Boutique : <b>${esc(o.shopName||c.name||'Boutique')}</b><br>Total : <b>${money(orderTotal(o))}</b></p><div class="gm56PaymentChoiceBtns"><button ${enabled?'':'disabled'} onclick="selectClientOrderPayment('${esc(o.id)}','WAVE')">Régler avec Wave</button><button ${enabled?'':'disabled'} onclick="selectClientOrderPayment('${esc(o.id)}','USDT TRC20')">Régler avec USDT TRC20</button></div>${enabled?'':'<p class="notice">Ces moyens de paiement s’activent après validation de la commande par l’administrateur de la boutique.</p>'}<div id="gm56PaymentQrZone" class="gm56PaymentQrZone"><p>Choisissez votre moyen de paiement.</p></div><input type="hidden" id="gm56PaymentMethod"><label>ID de la transaction<input id="gm56PaymentTransaction" placeholder="Saisissez l’identifiant de la transaction"></label><div class="marketPayActions"><button id="gm56IPaidBtn" onclick="submitClientOrderPayment('${esc(o.id)}')" ${enabled?'':'disabled'}>J’ai payé</button><button class="btn2" onclick="document.getElementById('gm56ClientPaymentModal')?.remove()">Fermer</button></div></div></div>`);
}
function selectClientOrderPayment(orderId,method){
  const d=seed(),o=(d.orders||[]).find(x=>String(x.id)===String(orderId)),c=(d.companies||[]).find(x=>x.id===o?.companyId)||{};if(!o)return;
  const zone=$('#gm56PaymentQrZone'),input=$('#gm56PaymentMethod');if(input)input.value=method;
  let payload='',label='';
  if(method==='WAVE'){
    const link=buildWavePaymentLink(c.marketWaveBusinessLink,orderTotal(o));if(!link){zone.innerHTML='<p class="notice">Le lien Wave n’est pas encore configuré par cette boutique.</p>';return}payload=link;label=`Wave · ${money(orderTotal(o))}`;
  }else{
    if(!c.marketUsdtTrc20){zone.innerHTML='<p class="notice">Le paiement USDT TRC20 n’est pas encore configuré par cette boutique.</p>';return}payload=`USDT TRC20 | ${c.marketUsdtTrc20} | Commande ${o.id} | Total ${orderTotal(o)} FCFA`;label='USDT TRC20';
  }
  const qr='https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data='+encodeURIComponent(payload);
  zone.innerHTML=`<div class="gm56QrCard"><img src="${qr}" alt="QR Code ${esc(method)}"><b>${esc(label)}</b><small>Scannez le QR Code pour effectuer le règlement auprès de la boutique.</small>${method==='WAVE'?`<a href="${esc(payload)}" target="_blank" rel="noopener">Ouvrir le paiement Wave</a>`:`<code>${esc(c.marketUsdtTrc20)}</code>`}</div>`;
}
async function submitClientOrderPayment(orderId){
  const method=($('#gm56PaymentMethod')?.value||'').trim(),transactionId=($('#gm56PaymentTransaction')?.value||'').trim();if(!method)return alert('Choisissez un moyen de paiement.');if(!transactionId)return alert('Renseignez l’ID de la transaction.');
  const btn=$('#gm56IPaidBtn');if(btn){btn.disabled=true;btn.textContent='Envoi…'}
  try{await securePublicPost('/api/public/order/payment',{orderId,method,transactionId});await cloudLoadPublicData();document.getElementById('gm56ClientPaymentModal')?.remove();alert('Paiement déclaré. La boutique doit maintenant confirmer la transaction.');openClientSpace('orders');}catch(e){alert(secureErrorMessage(e,'Déclaration de paiement impossible.'));if(btn){btn.disabled=false;btn.textContent='J’ai payé'}}
}
function gm56OpenClientMessageComposer(companyId){gm56RenderClientSpaceTab('messages');setTimeout(()=>{const s=$('#gm56ClientMessageCompany');if(s)s.value=companyId;$('#gm56ClientMessageText')?.focus()},20)}
async function gm56SendClientMessage(){
  const companyId=$('#gm56ClientMessageCompany')?.value||'',message=($('#gm56ClientMessageText')?.value||'').trim();if(!companyId||!message)return alert('Choisissez la boutique et saisissez votre message.');
  try{const r=await fetchWithTimeout('/api/public/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId,message})},12000);await readApiPayload(r);await cloudLoadPublicData();gm56RenderClientSpaceTab('messages');alert('Message envoyé à la boutique.');}catch(e){alert(secureErrorMessage(e,'Envoi du message impossible.'))}
}
async function gm56DeleteClientMessages(){
  const ids=[...document.querySelectorAll('.gm56ClientMsgCheck:checked')].map(x=>x.value);if(!ids.length)return alert('Sélectionnez au moins un message.');if(!(await g3Confirm('Supprimer les messages sélectionnés de votre espace client ?','Suppression messages')))return;
  try{await securePublicPost('/api/public/message/delete',{ids});await cloudLoadPublicData();gm56RenderClientSpaceTab('messages');}catch(e){alert(secureErrorMessage(e,'Suppression impossible.'))}
}

const GM56_BASE_OPEN_CLIENT_AUTH=openGlobalClientAuth;
openGlobalClientAuth=function(mode='login'){
  GM56_BASE_OPEN_CLIENT_AUTH(mode);
  if(mode!=='register'){
    const card=document.querySelector('#clientLoginModal .gmClientAuthCard');if(card&&!card.querySelector('.gm56ClientForgotBtn')){
      const btn=document.createElement('button');btn.type='button';btn.className='gmHomeTextBtn gm56ClientForgotBtn';btn.textContent='Mot de passe oublié ?';btn.onclick=()=>{document.getElementById('clientLoginModal')?.remove();openClientForgotPassword()};card.appendChild(btn);
    }
  }
};
function openClientForgotPassword(){
  document.getElementById('gm56ClientForgotModal')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="gmHomeAuthBackdrop" id="gm56ClientForgotModal"><section class="gmHomeAuthCard gm56ClientForgotCard"><button class="gmHomeAuthClose" onclick="document.getElementById('gm56ClientForgotModal')?.remove()">×</button><span class="gmHomeModalKicker">COMPTE CLIENT</span><h2>Mot de passe oublié</h2><p>Votre demande sera transmise au Super Admin GLOBAL MARKET pour réinitialisation.</p><label>Identifiant / téléphone<input id="gm56ResetClientPhone" placeholder="Votre téléphone de connexion"></label><label>Motif<textarea id="gm56ResetClientReason" placeholder="Mot de passe oublié"></textarea></label><button class="gmHomePrimaryAuth" onclick="submitClientForgotPassword()">Envoyer la demande</button></section></div>`);
}
async function submitClientForgotPassword(){
  const phone=($('#gm56ResetClientPhone')?.value||'').trim(),reason=($('#gm56ResetClientReason')?.value||'Mot de passe oublié').trim();if(!phone)return alert('Saisissez votre identifiant / téléphone.');
  try{const r=await fetchWithTimeout('/api/public/client/request-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,reason})},10000);const j=await readApiPayload(r);document.getElementById('gm56ClientForgotModal')?.remove();alert(j.message||'Demande transmise.');}catch(e){alert(secureErrorMessage(e,'Demande impossible.'))}
}
const GM56_BASE_OPEN_FORGOT=openForgotPasswordPopup;
openForgotPasswordPopup=function(){
  GM56_BASE_OPEN_FORGOT();
  const modal=document.getElementById('forgotPasswordModal');const p=modal?.querySelector('.modalCard > p.sub');if(p)p.textContent='Administrateur réinitialisé par Globalmarket et Caisse réinitialisé par votre Administrateur';
  modal?.querySelectorAll('.reportFilters,.marketSearch,.mkCatalogTop,.filterBar,.searchBar').forEach(x=>x.remove());
};
function superPasswordResetRequestsBox(){
  const d=seed();const rows=(d.passwordResetRequests||[]).filter(r=>['admin','client'].includes(r.role)).slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return `<div class="superTableWrap"><table class="superTable"><thead><tr><th>Date</th><th>Compte / entreprise</th><th>Utilisateur</th><th>Profil</th><th>Contact</th><th>Motif</th><th>Statut</th><th>Action</th></tr></thead><tbody>${rows.map(r=>{const c=(d.companies||[]).find(x=>x.id===r.companyId);const action=r.status==='pending'?(r.role==='client'?`<button class="detailsBtn" onclick="resetClientPasswordRequestBySuper('${esc(r.id)}')">Générer mot de passe</button>`:`<button class="detailsBtn" onclick="resetPasswordRequestBySuper('${esc(r.id)}')">Générer mot de passe</button>`):'<span class="statusPill active">traité</span>';return `<tr><td>${new Date(r.createdAt||Date.now()).toLocaleString('fr-FR')}</td><td>${r.role==='client'?'Compte client GLOBAL MARKET':esc(c?.name||'-')}</td><td><b>${esc(r.userName||r.email||'-')}</b><br><small>${esc(r.email||'')}</small></td><td>${r.role==='client'?'Client':esc(r.role||'')}</td><td>${esc(r.phone||'')}</td><td>${esc(r.reason||'')}</td><td>${esc(r.status||'')}</td><td>${action}</td></tr>`}).join('')||'<tr><td colspan="8">Aucune demande de réinitialisation.</td></tr>'}</tbody></table></div>`;
}
async function resetClientPasswordRequestBySuper(rid){
  const r=(seed().passwordResetRequests||[]).find(x=>x.id===rid&&x.role==='client');if(!r)return alert('Demande client introuvable.');
  try{const j=await secureEmployeePost('/api/client/reset-password',{clientId:r.userId,requestId:rid});await cloudLoadData();alert('Mot de passe temporaire du client :\n\n'+j.temporaryPassword+'\n\nCommuniquez-le au client de manière sécurisée.');renderSuper();}catch(e){alert(secureErrorMessage(e,'Réinitialisation du compte client impossible.'))}
}

function gm56MarketplaceMessagesPanel(){
  const {d,company}=current();const msgs=(d.marketMessages||[]).filter(m=>m.companyId===company.id&&!m.adminDeleted).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const rows=msgs.map(m=>`<tr><td><input type="checkbox" class="gm56AdminMsgCheck" value="${esc(m.id)}"></td><td><b>${esc(m.clientName||'Client')}</b><small>${esc(m.clientPhone||'')} ${m.clientEmail?'· '+esc(m.clientEmail):''}</small></td><td><span class="gm56MsgFrom ${m.senderType==='admin'?'admin':'client'}">${m.senderType==='admin'?'Boutique':'Client'}</span></td><td>${esc(m.body||'')}</td><td>${new Date(m.createdAt||Date.now()).toLocaleString('fr-FR')}</td><td><button class="btn2" onclick="openAdminMessageReply('${esc(m.id)}')">Répondre</button></td></tr>`).join('')||'<tr><td colspan="6">Aucun message reçu.</td></tr>';
  return `<div class="mkPanel mkAdminSinglePage gm56MessagesPanel"><div class="mkPanelHead"><div><h2>Messages clients</h2><p class="sub">Consultez et répondez aux demandes reçues depuis votre boutique publique et les comptes clients.</p></div></div><div class="gm56MessageToolbar"><label><input type="checkbox" onchange="document.querySelectorAll('.gm56AdminMsgCheck').forEach(x=>x.checked=this.checked)"> Tout sélectionner</label><button class="danger" onclick="gm56DeleteAdminMessages()">Supprimer la sélection</button></div><div class="clientOrdersScroll"><table class="mkOrdersTable"><tr><th></th><th>Client</th><th>De</th><th>Message</th><th>Date</th><th>Action</th></tr>${rows}</table></div></div>`;
}
const GM56_BASE_SHOW_MARKETPLACE=showMarketplacePage;
showMarketplacePage=function(){
  GM56_BASE_SHOW_MARKETPLACE();
  const active=window.marketplaceAdminSection||'stock';
  const nav=document.querySelector('.mkSectionButtons');if(nav&&!nav.querySelector('.gm56MessagesTab'))nav.insertAdjacentHTML('beforeend',`<button class="gm56MessagesTab ${active==='messages'?'active':''}" onclick="showMarketplaceAdminPage('messages')">Messages</button>`);
  const hero=document.querySelector('.mkHeroBtns');if(hero&&!hero.querySelector('.gm56MessagesHeroBtn'))hero.insertAdjacentHTML('beforeend','<button class="gm56MessagesHeroBtn" onclick="showMarketplaceAdminPage(\'messages\')">Messages clients</button>');
  if(active==='messages'){
    const wrap=document.querySelector('.mkSinglePageWrap');if(wrap)wrap.innerHTML=gm56MarketplaceMessagesPanel();const title=document.querySelector('.mkPageTitle h2');if(title)title.textContent='Messages clients';
  }
};
function openAdminMessageReply(messageId){
  document.getElementById('gm56AdminReplyModal')?.remove();const {d,company}=current();const m=(d.marketMessages||[]).find(x=>x.id===messageId&&x.companyId===company.id);if(!m)return alert('Message introuvable.');
  document.body.insertAdjacentHTML('beforeend',`<div class="marketPayModalBackdrop" id="gm56AdminReplyModal"><div class="marketPayModal"><button class="marketPayClose" onclick="document.getElementById('gm56AdminReplyModal')?.remove()">×</button><h2>Répondre à ${esc(m.clientName||'Client')}</h2><div class="gm56OriginalMessage">${esc(m.body||'')}</div><label>Votre réponse<textarea id="gm56AdminReplyText" maxlength="3000" placeholder="Saisissez votre réponse..."></textarea></label><div class="marketPayActions"><button onclick="sendAdminMessageReply('${esc(m.id)}')">Envoyer</button><button class="btn2" onclick="document.getElementById('gm56AdminReplyModal')?.remove()">Fermer</button></div></div></div>`);
}
async function sendAdminMessageReply(messageId){
  const {d,company,user}=current(),src=(d.marketMessages||[]).find(x=>x.id===messageId&&x.companyId===company.id),text=($('#gm56AdminReplyText')?.value||'').trim();if(!src||!text)return alert('Réponse obligatoire.');
  d.marketMessages=d.marketMessages||[];d.marketMessages.push({id:id('msg'),companyId:company.id,clientId:src.clientId||'',clientName:src.clientName||'',clientPhone:src.clientPhone||'',clientEmail:src.clientEmail||'',senderType:'admin',senderName:user?.name||company.name||'Boutique',body:text,createdAt:new Date().toISOString(),adminDeleted:false,clientDeleted:false,readByAdmin:true,readByClient:false});save(d);try{await cloudSaveNow(d)}catch(e){}document.getElementById('gm56AdminReplyModal')?.remove();showMarketplaceAdminPage('messages');
}
async function gm56DeleteAdminMessages(){
  const ids=new Set([...document.querySelectorAll('.gm56AdminMsgCheck:checked')].map(x=>x.value));if(!ids.size)return alert('Sélectionnez au moins un message.');if(!(await g3Confirm('Supprimer les messages sélectionnés de votre espace boutique ?','Suppression messages')))return;
  const {d,company}=current();(d.marketMessages||[]).forEach(m=>{if(m.companyId===company.id&&ids.has(String(m.id))){m.adminDeleted=true;m.adminDeletedAt=new Date().toISOString()}});save(d);await cloudSaveNow(d).catch(()=>{});showMarketplaceAdminPage('messages');
}

function openPublicContactForm(companyId){
  document.getElementById('gm56PublicContactModal')?.remove();const d=seed(),c=(d.companies||[]).find(x=>x.id===companyId),client=currentGlobalClient();if(!c)return alert('Boutique introuvable.');
  document.body.insertAdjacentHTML('beforeend',`<div class="marketPayModalBackdrop" id="gm56PublicContactModal"><div class="marketPayModal gm56ContactBox"><button class="marketPayClose" onclick="document.getElementById('gm56PublicContactModal')?.remove()">×</button><span class="gmHomeModalKicker">CONTACTER LA BOUTIQUE</span><h2>${esc(c.name||'Boutique')}</h2><p>Envoyez votre demande directement à l’administrateur de cette boutique.</p>${client?'':`<label>Nom<input id="gm56ContactName" placeholder="Votre nom"></label><label>Téléphone<input id="gm56ContactPhone" placeholder="Votre contact"></label><label>Email<input id="gm56ContactEmail" type="email" placeholder="Facultatif"></label>`}<label>Message<textarea id="gm56ContactText" maxlength="3000" placeholder="Votre message..."></textarea></label><div class="marketPayActions"><button onclick="submitPublicContactMessage('${esc(c.id)}')">Envoyer</button><button class="btn2" onclick="document.getElementById('gm56PublicContactModal')?.remove()">Fermer</button></div>${client?'':'<small>Connectez-vous à un compte client pour retrouver les réponses directement dans votre espace Message.</small>'}</div></div>`);
}
async function submitPublicContactMessage(companyId){
  const payload={companyId,message:($('#gm56ContactText')?.value||'').trim(),name:($('#gm56ContactName')?.value||'').trim(),phone:($('#gm56ContactPhone')?.value||'').trim(),email:($('#gm56ContactEmail')?.value||'').trim()};if(!payload.message)return alert('Saisissez votre message.');
  try{const r=await fetchWithTimeout('/api/public/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},12000);await readApiPayload(r);document.getElementById('gm56PublicContactModal')?.remove();if(PUBLIC_CLIENT_SESSION?.clientId)await cloudLoadPublicData();alert('Votre message a été envoyé à la boutique.');}catch(e){alert(secureErrorMessage(e,'Envoi impossible.'))}
}
const GM56_BASE_RENDER_PUBLIC_SHOP=renderPublicShop;
renderPublicShop=function(slug){
  GM56_BASE_RENDER_PUBLIC_SHOP(slug);
  const d=seed(),decoded=decodeURIComponent(slug||''),c=(d.companies||[]).find(x=>slugify(x.name)===decoded||x.shopSlug===decoded);const btn=document.querySelector('.officialHeaderCart');
  if(c&&btn){btn.onclick=()=>openPublicContactForm(c.id);btn.classList.add('gm56ContactUsBtn');btn.innerHTML=`<span>${officialShopIcon('support')}</span><span><small>Besoin d’aide ?</small><b>Contactez-nous</b></span>`;}
};

function openMarketplaceOrderPopup(orderId,isAdmin){
  document.getElementById('marketOrderDetailsModal')?.remove();const d=seed(),o=(d.orders||[]).find(x=>String(x.id)===String(orderId));if(!o)return alert('Commande introuvable.');const items=normalizeOrderItems(o),company=(d.companies||[]).find(c=>c.id===o.companyId)||{};
  const rows=items.map((it,i)=>`<tr><td>${i+1}</td><td>${esc(it.item||'Article')}</td><td>${esc(it.category||'-')}</td><td>${esc(it.type||'-')}</td><td>${Number(it.qty||1)}</td><td>${money(it.unit||0)}</td><td><b>${money(it.total||0)}</b></td></tr>`).join('');
  let workflow='';
  if(isAdmin){
    if(gm56OrderCancelled(o))workflow=`<div class="gm56AdminWorkflow cancelled"><b>Commande annulée</b><p>${esc(o.afterSaleStatus||'Commande annulée')}</p></div>`;
    else if(gm56OrderDelivered(o))workflow=`<div class="gm56AdminWorkflow delivered"><b>Commande livrée</b><p>Le paiement et la livraison sont confirmés.</p></div>`;
    else if(gm56OrderPaidConfirmed(o))workflow=`<div class="gm56AdminWorkflow shipping"><b>Paiement confirmé</b><p>La livraison est en cours.</p><button onclick="gm56AdminConfirmDelivery('${esc(o.id)}')">Confirmer la livraison</button></div>`;
    else if(gm56OrderPaymentSubmitted(o)&&gm56OrderValidated(o))workflow=`<div class="gm56AdminWorkflow paycheck"><b>Paiement déclaré par le client</b><p>Moyen : ${esc(o.paymentMethod||'-')}<br>ID transaction : <strong>${esc(o.transactionId||o.paymentRef||'-')}</strong>${o.clientPaymentSubmittedAt?'<br>Déclaré le '+new Date(o.clientPaymentSubmittedAt).toLocaleString('fr-FR'):''}</p><button onclick="gm56AdminConfirmPayment('${esc(o.id)}')">Confirmer le paiement</button><button class="danger" onclick="gm56AdminSetOrderValidation('${esc(o.id)}','Annuler')">Annuler la commande</button></div>`;
    else if(gm56OrderValidated(o))workflow=`<div class="gm56AdminWorkflow validated"><b>Commande validée</b><p>En attente du règlement par le client.</p><button class="danger" onclick="gm56AdminSetOrderValidation('${esc(o.id)}','Annuler')">Annuler la commande</button></div>`;
    else workflow=`<div class="gm56AdminWorkflow waiting"><b>Commande en attente</b><p>Validez la commande pour activer les moyens de paiement du client.</p><button onclick="gm56AdminSetOrderValidation('${esc(o.id)}','Validée')">Valider la commande</button><button class="danger" onclick="gm56AdminSetOrderValidation('${esc(o.id)}','Annuler')">Annuler la commande</button></div>`;
  }else workflow=`<div class="gm56ClientStatusBlock">${gm56OrderClientAction(o)}${gm56ClientOrderControls(o)}</div>`;
  const paymentInfo=`<div class="gm56OrderInfoGrid"><div><span>Boutique</span><b>${esc(o.shopName||company.name||'Boutique')}</b></div><div><span>Client</span><b>${esc(o.client||'-')}</b><small>${esc(o.clientPhone||'')}</small></div><div><span>Livraison</span><b>${esc(o.deliveryCity||'-')}</b><small>${esc(o.deliveryNeighborhood||'')} ${o.deliveryAddressDetail?'· '+esc(o.deliveryAddressDetail):''}</small></div><div><span>Paiement</span><b>${esc(o.paymentMethod||'Non réglé')}</b><small>${esc(o.paymentStatus||'En attente')}</small></div></div>`;
  document.body.insertAdjacentHTML('beforeend',`<div class="marketPayModalBackdrop" id="marketOrderDetailsModal"><div class="marketPayModal orderDetailsBox gm56OrderDetails"><button class="marketPayClose" onclick="document.getElementById('marketOrderDetailsModal')?.remove()">×</button><span class="gmHomeModalKicker">COMMANDE MARKETPLACE</span><h2>#${esc(o.id)}</h2>${paymentInfo}<div class="clientOrdersScroll"><table class="mkOrdersTable"><tr><th>N°</th><th>Produit / Service</th><th>Catégorie</th><th>Type</th><th>Qté</th><th>PU</th><th>Total</th></tr>${rows}</table></div><div class="orderFinancialSummary"><div><span>Sous-total</span><b>${money(Number(o.subtotal??(orderTotal(o)-Number(o.deliveryFee||0))))}</b></div><div><span>Frais d’expédition</span><b>${money(Number(o.deliveryFee||0))}</b></div><div class="total"><span>Total lot</span><b>${money(orderTotal(o))}</b></div></div>${workflow}<div class="marketPayActions"><button class="btn2" onclick="document.getElementById('marketOrderDetailsModal')?.remove()">Fermer</button></div></div></div>`);
}
async function gm56PersistOrderAdmin(d,o){save(d);try{await cloudSaveNow(d)}catch(e){console.error(e)}document.getElementById('marketOrderDetailsModal')?.remove();showMarketplaceAdminPage('orders')}
async function gm56AdminSetOrderValidation(orderId,status){
  const d=seed(),o=(d.orders||[]).find(x=>x.id===orderId);if(!o)return;
  if(status==='Annuler'){
    if(gm56OrderPaidConfirmed(o))return alert('Le paiement étant déjà confirmé, cette commande ne peut plus être annulée ici.');restoreMarketplaceOrderStock(d,o);removeMarketplaceOrderFromReport(d,o);o.validationStatus='Annuler';o.deliveryStatus='Aucune action';o.afterSaleStatus='Annulée par la boutique';o.delivery='Commande annulée';o.cancelledAt=new Date().toISOString();o.cancelledBy='admin';
  }else{o.validationStatus='Validée';o.paymentStatus=gm56OrderPaymentSubmitted(o)?(o.paymentStatus||'Paiement déclaré par le client'):'En attente de paiement';o.deliveryStatus='En attente de paiement';o.delivery='Commande validée';}
  await gm56PersistOrderAdmin(d,o);
}
async function gm56AdminConfirmPayment(orderId){
  const d=seed(),o=(d.orders||[]).find(x=>x.id===orderId);if(!o)return;if(!gm56OrderPaymentSubmitted(o))return alert('Aucune transaction n’a encore été déclarée par le client.');o.paymentStatus='Paiement confirmé';o.paymentConfirmedAt=new Date().toISOString();o.deliveryStatus='En cours de livraison';o.delivery='En cours de livraison';o.validationStatus='Validée';addMarketplaceOrderToReport(d,o);await gm56PersistOrderAdmin(d,o);
}
async function gm56AdminConfirmDelivery(orderId){
  const d=seed(),o=(d.orders||[]).find(x=>x.id===orderId);if(!o)return;if(!gm56OrderPaidConfirmed(o))return alert('Confirmez d’abord le paiement.');o.deliveryStatus='Livrée';o.delivery='Livrée';o.deliveredAt=new Date().toISOString();await gm56PersistOrderAdmin(d,o);
}

const GM56_BASE_RENDER_GLOBAL_SHOP=renderGlobalShop;
renderGlobalShop=function(){
  GM56_BASE_RENDER_GLOBAL_SHOP();
  document.querySelector('.gmHomeHero')?.remove();
  document.querySelector('.gm56AboutLaunch')?.remove();
  const nav=document.querySelector('.gmUniversalNav');if(nav&&!nav.querySelector('.gm56AboutNav'))nav.insertAdjacentHTML('beforeend','<button type="button" class="gm56AboutNav" onclick="openGlobalAboutPage()">À propos</button>');
};
function openGlobalAboutPage(){
  app.innerHTML=`<main class="gm56AboutPage gm561AboutPage">
    ${globalUniversalHeader('about')}
    <section class="gm561AboutHero">
      <div class="gm561AboutHeroCopy"><span class="gm561Eyebrow">À PROPOS DE GLOBAL MARKET</span><h1>Gérez votre activité.<br><em>Vendez en ligne.</em><br>Restez proche de vos clients.</h1><p>GLOBAL MARKET réunit la gestion commerciale d’une entreprise et une marketplace multi-boutiques dans une seule plateforme claire, professionnelle et accessible.</p><div class="gm561AboutHeroActions"><button class="gm561Primary" onclick="openGlobalBusinessAuth('register')">Créer ma boutique</button><button class="gm561Secondary" onclick="goGlobalMarketHome()">Voir le marketplace</button></div><div class="gm561TrustRow"><span>✓ Gestion centralisée</span><span>✓ Boutique publique</span><span>✓ Commandes & paiements</span><span>✓ Messagerie client</span></div></div>
      <div class="gm561AboutHeroVisual"><div class="gm561VisualFrame"><img src="assets/global-market-hero.png" alt="Présentation de la plateforme GLOBAL MARKET"><div class="gm561VisualBadge top"><b>Marketplace</b><small>Produits & services</small></div><div class="gm561VisualBadge bottom"><b>Gestion complète</b><small>Stocks · ventes · clients</small></div></div></div>
    </section>
    <section class="gm561AboutBand"><article><b>01</b><span>Une seule plateforme</span><small>Gestion et vente en ligne réunies.</small></article><article><b>02</b><span>Multi-boutiques</span><small>Chaque vendeur gère son activité indépendamment.</small></article><article><b>03</b><span>Suivi client</span><small>Commandes, paiements, livraison et messages.</small></article><article><b>04</b><span>Accessible partout</span><small>Ordinateur, tablette et téléphone.</small></article></section>
    <section class="gm561AboutSection gm561AboutPresentation"><div class="gm561SectionHead"><span>PRÉSENTATION</span><h2>GLOBAL MARKET, bien plus qu’une simple boutique en ligne</h2><p>La plateforme accompagne l’entreprise de l’enregistrement d’un article jusqu’à la vente, au paiement, à la livraison et au suivi du client.</p></div><div class="gm561FeatureGrid"><article><i>▦</i><h3>Gestion commerciale</h3><p>Stocks, ventes, encaissements, clients, rapports et indicateurs dans un espace unique.</p></article><article><i>🛍</i><h3>Boutique en ligne</h3><p>Catalogue public professionnel pour présenter et vendre vos produits et services.</p></article><article><i>⌁</i><h3>Commandes organisées</h3><p>Les commandes sont regroupées par boutique et suivies jusqu’à la livraison.</p></article><article><i>◈</i><h3>Paiements configurables</h3><p>Wave et USDT TRC20 avec QR Code et identification de transaction.</p></article><article><i>✉</i><h3>Messagerie intégrée</h3><p>Clients et vendeurs peuvent échanger directement depuis leurs espaces.</p></article><article><i>⌂</i><h3>Livraison personnalisée</h3><p>Villes, quartiers, moyens d’expédition et frais configurés par chaque boutique.</p></article></div></section>
    <section class="gm561Mission"><div class="gm561MissionLead"><span>NOTRE MISSION</span><h2>Digitaliser le commerce local sans le compliquer.</h2><p>GLOBAL MARKET veut donner aux commerçants, entreprises et prestataires un outil concret pour mieux gérer, mieux vendre et construire une relation durable avec leurs clients.</p></div><div class="gm561MissionPoints"><article><b>Visibilité</b><p>Permettre aux boutiques d’être découvertes au-delà de leur emplacement physique.</p></article><article><b>Confiance</b><p>Rendre le parcours de commande, de paiement et de livraison plus lisible.</p></article><article><b>Performance</b><p>Donner au responsable des données utiles pour piloter son activité au quotidien.</p></article></div></section>
    <section class="gm561AboutSection gm561UsersSection"><div class="gm561SectionHead"><span>POUR QUI ?</span><h2>Une solution pensée pour tout l’écosystème commercial</h2></div><div class="gm561UsersGrid"><article><div>🏪</div><h3>Commerçants & boutiques</h3><p>Gérez les produits, les stocks et les commandes depuis un espace professionnel.</p></article><article><div>🧰</div><h3>Prestataires de services</h3><p>Présentez vos prestations, vos tarifs et recevez les demandes de vos clients.</p></article><article><div>🏢</div><h3>Entreprises</h3><p>Centralisez les opérations, utilisateurs, ventes, rapports et paramètres.</p></article><article><div>🛒</div><h3>Clients</h3><p>Achetez auprès de plusieurs boutiques, suivez vos commandes et échangez avec les vendeurs.</p></article></div></section>
    <section class="gm561AboutGuide"><div class="gm561GuideTitle"><span>GUIDE D’UTILISATION</span><h2>Créer votre boutique en 5 étapes</h2><p>Un parcours simple pour publier vos premières offres sur GLOBAL MARKET.</p></div><div class="gm561GuideFlow"><article><b>1</b><div><h3>Créer ma boutique</h3><p>Depuis l’accueil, choisissez « Créer ma boutique ou se connecter » puis lancez l’inscription.</p></div></article><article><b>2</b><div><h3>Renseigner l’entreprise</h3><p>Complétez l’identité, le responsable, les contacts et vos identifiants sécurisés.</p></div></article><article><b>3</b><div><h3>Ajouter les produits et services</h3><p>Enregistrez vos offres dans le stock général et activez leur visibilité Marketplace.</p></div></article><article><b>4</b><div><h3>Configurer vente & livraison</h3><p>Définissez les moyens de paiement, villes, quartiers, expéditions et frais.</p></div></article><article><b>5</b><div><h3>Partager votre boutique</h3><p>Diffusez le lien public et recevez commandes, paiements et messages dans votre espace.</p></div></article></div></section>
    <section class="gm561AboutCta"><div>${globalMarketBrandMark()}</div><div><span>PRÊT À COMMENCER ?</span><h2>Donnez une vitrine digitale professionnelle à votre activité.</h2><p>Créez votre boutique GLOBAL MARKET et gérez votre commerce depuis un seul espace.</p></div><button onclick="openGlobalBusinessAuth('register')">Créer ma boutique</button></section>
    <footer class="gmHomeFooter gm561AboutFooter"><div>${globalMarketBrandMark()}<span><b>GLOBAL MARKET</b><small>Produits & services en toute confiance</small></span></div><nav class="gmHomeLegalLinks" aria-label="Informations légales"><button type="button" onclick="openLegalPopup('cgu')">Conditions générales d'utilisation</button><button type="button" onclick="openLegalPopup('privacy')">Notre politique de confidentialité</button></nav><p>© 2026 MEGA SERVICES SARL U</p></footer>
  </main>`;initFlexibleHorizontalMenu();
}

function gm56NotifyPopup(message,buttonLabel,handler,tone='info'){
  const box=document.createElement('div');box.className=`gm56LiveNotify ${tone}`;box.innerHTML=`<button class="gm56NotifyClose" aria-label="Fermer">×</button><b>${esc(message)}</b><button class="gm56NotifyAction">${esc(buttonLabel)}</button>`;box.querySelector('.gm56NotifyClose').onclick=()=>box.remove();box.querySelector('.gm56NotifyAction').onclick=()=>{box.remove();handler&&handler()};document.body.appendChild(box);setTimeout(()=>box.remove(),18000);
}
let GM56_NOTIFY_CONTEXT='',GM56_NOTIFY_ORDERS=new Map(),GM56_NOTIFY_MESSAGES=new Set(),GM56_NOTIFY_TIMER=null,GM56_NOTIFY_POLLING=false;
function gm56NotificationContext(){if(CLOUD_SESSION?.userId)return `emp:${CLOUD_SESSION.userId}:${CLOUD_SESSION.companyId||''}`;if(PUBLIC_CLIENT_SESSION?.clientId)return `client:${PUBLIC_CLIENT_SESSION.clientId}`;return 'guest'}
function gm56PrimeNotifications(){
  const key=gm56NotificationContext();GM56_NOTIFY_CONTEXT=key;GM56_NOTIFY_ORDERS=new Map();GM56_NOTIFY_MESSAGES=new Set();const d=seed();
  if(key.startsWith('emp:')){const cid=CLOUD_SESSION?.companyId;(d.orders||[]).filter(o=>o.companyId===cid).forEach(o=>GM56_NOTIFY_ORDERS.set(o.id,orderMainStatus(o)));(d.marketMessages||[]).filter(m=>m.companyId===cid&&m.senderType==='client').forEach(m=>GM56_NOTIFY_MESSAGES.add(m.id));}
  else if(key.startsWith('client:')){const client=currentGlobalClient();(d.orders||[]).filter(o=>o.clientId===client?.id).forEach(o=>GM56_NOTIFY_ORDERS.set(o.id,orderMainStatus(o)));(d.marketMessages||[]).filter(m=>m.clientId===client?.id&&m.senderType==='admin').forEach(m=>GM56_NOTIFY_MESSAGES.add(m.id));}
}
async function gm56PollNotifications(){
  const ctx=gm56NotificationContext();if(ctx==='guest'||document.hidden||CLOUD_SAVE_PENDING||GM56_NOTIFY_POLLING)return;if(ctx!==GM56_NOTIFY_CONTEXT){gm56PrimeNotifications();return}
  GM56_NOTIFY_POLLING=true;
  try{if(CLOUD_SESSION)await cloudLoadData();else await cloudLoadPublicData();const d=seed();
    if(ctx.startsWith('emp:')){const cid=CLOUD_SESSION?.companyId;for(const o of (d.orders||[]).filter(x=>x.companyId===cid)){if(!GM56_NOTIFY_ORDERS.has(o.id)){gm56NotifyPopup('Vous avez une nouvelle commande','Voir la commande',()=>showMarketplaceAdminPage('orders'),'order')}GM56_NOTIFY_ORDERS.set(o.id,orderMainStatus(o))}for(const m of (d.marketMessages||[]).filter(x=>x.companyId===cid&&x.senderType==='client')){if(!GM56_NOTIFY_MESSAGES.has(m.id))gm56NotifyPopup('Vous avez un nouveau message','Voir le message',()=>showMarketplaceAdminPage('messages'),'message');GM56_NOTIFY_MESSAGES.add(m.id)}}
    else{const client=currentGlobalClient();for(const o of (d.orders||[]).filter(x=>x.clientId===client?.id)){const now=orderMainStatus(o),old=GM56_NOTIFY_ORDERS.get(o.id);if(old&&old!==now)gm56NotifyPopup(`Commande est ${now.toLowerCase()}`,'Voir la commande',()=>openClientSpace('orders'),'order');GM56_NOTIFY_ORDERS.set(o.id,now)}for(const m of (d.marketMessages||[]).filter(x=>x.clientId===client?.id&&x.senderType==='admin')){if(!GM56_NOTIFY_MESSAGES.has(m.id))gm56NotifyPopup('Vous avez un nouveau message','Voir le message',()=>openClientSpace('messages'),'message');GM56_NOTIFY_MESSAGES.add(m.id)}}
  }catch(e){console.warn('Notifications GLOBAL MARKET non actualisées',e)}finally{GM56_NOTIFY_POLLING=false}
}
let GM_V6_WS=null,GM_V6_WS_RETRY=0,GM_V6_WS_TIMER=null;
function gmV6MergeRealtimeEvent(evt){if(evt?.order){const arr=CLOUD_DATA.orders||(CLOUD_DATA.orders=[]),i=arr.findIndex(x=>x.id===evt.order.id);if(i>=0)arr[i]={...arr[i],...evt.order};else arr.unshift(evt.order)}if(evt?.message){const arr=CLOUD_DATA.marketMessages||(CLOUD_DATA.marketMessages=[]),i=arr.findIndex(x=>x.id===evt.message.id);if(i>=0)arr[i]={...arr[i],...evt.message};else arr.unshift(evt.message)}}
function gmV6HandleRealtime(evt){gmV6MergeRealtimeEvent(evt);if(evt.type==='order'){if(CLOUD_SESSION)gm56NotifyPopup(evt.action==='new'?'Vous avez une nouvelle commande':`Commande mise à jour : ${orderMainStatus(evt.order||{}).toLowerCase()}`,'Voir la commande',()=>showMarketplaceAdminPage('orders'),'order');else if(PUBLIC_CLIENT_SESSION?.clientId)gm56NotifyPopup(`Commande est ${orderMainStatus(evt.order||{}).toLowerCase()}`,'Voir la commande',()=>openClientSpace('orders'),'order')}if(evt.type==='message'){gm56NotifyPopup('Vous avez un nouveau message','Voir le message',()=>CLOUD_SESSION?showMarketplaceAdminPage('messages'):openClientSpace('messages'),'message')}}
let GM_V6_REALTIME_AVAILABLE=null;let GM_V6_REALTIME_STATUS_IN_FLIGHT=null;
async function gmV6RealtimeAvailable(){if(GM_V6_REALTIME_AVAILABLE!==null)return GM_V6_REALTIME_AVAILABLE;if(GM_V6_REALTIME_STATUS_IN_FLIGHT)return GM_V6_REALTIME_STATUS_IN_FLIGHT;GM_V6_REALTIME_STATUS_IN_FLIGHT=(async()=>{try{const r=await fetch('/api/v6/realtime-status',{cache:'no-store'});const j=await r.json();GM_V6_REALTIME_AVAILABLE=Boolean(j?.available)}catch{GM_V6_REALTIME_AVAILABLE=false}finally{GM_V6_REALTIME_STATUS_IN_FLIGHT=null}return GM_V6_REALTIME_AVAILABLE})();return GM_V6_REALTIME_STATUS_IN_FLIGHT;}
async function gmV6ConnectRealtime(){if(GM_V6_WS_TIMER){clearTimeout(GM_V6_WS_TIMER);GM_V6_WS_TIMER=null}if(!CLOUD_SESSION&&!PUBLIC_CLIENT_SESSION?.clientId)return;if(!(await gmV6RealtimeAvailable())){console.info('[GLOBAL MARKET V6.0.1] Temps réel externe non lié : secours léger activé.');return}try{GM_V6_WS?.close();const proto=location.protocol==='https:'?'wss:':'ws:';GM_V6_WS=new WebSocket(`${proto}//${location.host}/api/v6/realtime`);GM_V6_WS.onopen=()=>{GM_V6_WS_RETRY=0;console.info('[GLOBAL MARKET V6] Temps réel connecté')};GM_V6_WS.onmessage=e=>{try{gmV6HandleRealtime(JSON.parse(e.data))}catch(err){console.warn(err)}};GM_V6_WS.onclose=()=>{const delay=Math.min(30000,1000*Math.pow(1.8,Math.min(GM_V6_WS_RETRY++,7)));GM_V6_WS_TIMER=setTimeout(gmV6ConnectRealtime,delay)};GM_V6_WS.onerror=()=>{try{GM_V6_WS.close()}catch{}}}catch(e){GM_V6_WS_TIMER=setTimeout(gmV6ConnectRealtime,5000)}}
function gm56StartNotifications(){if(GM56_NOTIFY_TIMER)clearInterval(GM56_NOTIFY_TIMER);setTimeout(()=>{gm56PrimeNotifications();gmV6ConnectRealtime()},900);GM56_NOTIFY_TIMER=setInterval(()=>{if(!GM_V6_WS||GM_V6_WS.readyState!==WebSocket.OPEN)gm56PollNotifications()},600000)}
gm56StartNotifications();


/* === GLOBAL MARKET V6.0 : chargements ciblés supplémentaires === */
let GM_V6_ADMIN_MARKET_REFRESH=null;
async function gmV6RefreshAdminMarketplace(){
  if(!CLOUD_SESSION||CLOUD_SESSION.role==='superadmin')return;
  if(GM_V6_ADMIN_MARKET_REFRESH)return GM_V6_ADMIN_MARKET_REFRESH;
  GM_V6_ADMIN_MARKET_REFRESH=(async()=>{try{const j=await fetchApiJsonWithRetry('/api/v6/admin/marketplace-snapshot',{cache:'no-store'},9000,2);if(Array.isArray(j.orders))CLOUD_DATA.orders=j.orders;if(Array.isArray(j.messages))CLOUD_DATA.marketMessages=j.messages;if(Array.isArray(j.items)){const keep=(CLOUD_DATA.items||[]).filter(i=>i.companyId!==CLOUD_SESSION.companyId);CLOUD_DATA.items=[...keep,...j.items]}if(Array.isArray(j.marketClients))CLOUD_DATA.marketClients=j.marketClients;return j}catch(e){console.warn('[GLOBAL MARKET V6] Snapshot marketplace différé',e);return null}finally{GM_V6_ADMIN_MARKET_REFRESH=null}})();
  return GM_V6_ADMIN_MARKET_REFRESH;
}
const GM_V6_BASE_SHOW_MARKETPLACE_ADMIN=showMarketplaceAdminPage;
showMarketplaceAdminPage=function(type){window.marketplaceAdminSection=type||'stock';if((type==='orders'||type==='messages')&&CLOUD_SESSION){gmV6RefreshAdminMarketplace().finally(()=>showMarketplacePage());return;}return GM_V6_BASE_SHOW_MARKETPLACE_ADMIN(type)};

const GM_V6_SHOP_CATALOG_LOADED=new Set();
const GM_V6_BASE_RENDER_PUBLIC_SHOP=renderPublicShop;
renderPublicShop=function(slug){
  const d=seed(),decoded=decodeURIComponent(slug||''),company=(d.companies||[]).find(x=>slugify(x.name)===decoded||x.shopSlug===decoded);
  if(company&&!GM_V6_SHOP_CATALOG_LOADED.has(company.id)){
    GM_V6_SHOP_CATALOG_LOADED.add(company.id);
    fetchApiJsonWithRetry('/api/v6/catalog?companyId='+encodeURIComponent(company.id)+'&page=1&pageSize=48',{cache:'no-store'},9000,2).then(j=>{for(const it of j.items||[])GM_V6_CATALOG_CACHE.set(it.id,it);CLOUD_DATA.items=[...GM_V6_CATALOG_CACHE.values()];GM_V6_BASE_RENDER_PUBLIC_SHOP(slug)}).catch(()=>{GM_V6_SHOP_CATALOG_LOADED.delete(company.id);GM_V6_BASE_RENDER_PUBLIC_SHOP(slug)});
    app.innerHTML=globalUniversalHeader('shop')+'<div class="gmV6LoadingShop"><div class="gmV6Spinner"></div><h2>Ouverture de la boutique…</h2><p>Chargement ciblé du catalogue.</p></div>';return;
  }
  return GM_V6_BASE_RENDER_PUBLIC_SHOP(slug);
};
