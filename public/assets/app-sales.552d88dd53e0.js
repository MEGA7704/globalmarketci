/* Module ventes, rapports et marketplace — GLOBAL MARKET 4.2 */
/* Panier professionnel de la caisse : les lignes restent en attente jusqu'à l'encaissement. */
function getCartCutoffDate(d,cid){
  const clearedAt=(d.cartClearedAt&&d.cartClearedAt[cid])||'';
  const validatedAt=(d.cartValidatedAt&&d.cartValidatedAt[cid])||'';
  if(clearedAt && validatedAt) return String(clearedAt)>String(validatedAt)?clearedAt:validatedAt;
  return clearedAt || validatedAt || '';
}
function getCurrentCompanyCartSales(){ return getCompanyCartSales(); }
function createCheckoutIdempotencyKey(){
  const random=(globalThis.crypto&&typeof globalThis.crypto.randomUUID==='function')?globalThis.crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `checkout:${CLOUD_SESSION?.userId||'user'}:${random}`;
}
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

  const btn=$('#saleCartCheckoutBtn');
  const old=btn?.innerHTML||'';
  const idempotencyKey=createCheckoutIdempotencyKey();
  if(btn){btn.disabled=true;btn.innerHTML='<span>⏳</span> ENCAISSEMENT SÉCURISÉ EN COURS…';}
  try{
    const response=await fetchWithTimeout('/api/cart/checkout',{
      method:'POST',
      headers:employeeSecurityHeaders({'Idempotency-Key':idempotencyKey}),
      body:JSON.stringify({
        idempotencyKey,
        expectedRevision:Number(d?.app?.storageRevision||0),
        cartLineIds:cart.map(s=>String(s.id)),
        client:{
          type:meta.clientType==='contrat'?'contrat':'particulier',
          contractClientId:meta.contractClientId||'',
          name:meta.clientName||'',
          phone:meta.phone||'',
          address:meta.address||''
        }
      })
    },20000);
    const result=await readApiPayload(response);
    if(result.data&&typeof result.data==='object'){
      CLOUD_DATA=normalizeData(result.data);
      CLOUD_DATA_READY=true;
    }else{
      await cloudLoadData();
    }
    clearTimeout(CLOUD_SAVE_TIMER);
    renderDash('vente');
    g3Success(`Encaissement ${result.saleNumber||result.checkoutId||''} validé avec succès. Total : ${money(result.total||0)}.`,'Commande encaissée');
  }catch(e){
    if(e?.code==='COMPANY_DATA_CONFLICT'||e?.code==='CART_CHANGED'||e?.code==='STOCK_INSUFFICIENT'){
      try{await cloudLoadData();renderDash('vente');}catch(_e){}
    }
    if(btn&&document.body.contains(btn)){btn.disabled=false;btn.innerHTML=old;}
    const message=e?.code==='CHECKOUT_IN_PROGRESS'
      ? 'Cet encaissement est déjà en cours. Patientez quelques secondes puis actualisez le panier.'
      : (e?.message||'erreur réseau');
    g3Alert('L’encaissement n’a pas été validé : '+message,'Échec de l’encaissement','danger');
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
  return `<div class="reportA4">${globalPrintHeaderHTML(company)}<div class="reportTitle"><h1>BILAN JOUR</h1><h2>Date du résumé : ${esc(selectedLabel)}</h2></div><div class="goldLine"></div><div class="blockTitle">RÉSUMÉ DES VENTES / JOUR</div><table class="reportTable"><thead><tr><th>Catégorie</th><th>Produit / Service</th><th>Nombre de ventes</th><th>Clients servis</th><th>Quantité totale</th><th>Chiffre d’affaires</th><th>Frais service</th><th>Charges estimées</th><th>Bénéfice estimé</th></tr></thead><tbody>${body}<tr class="total"><td colspan="4"><b>TOTAL JOUR</b></td><td>${tq}</td><td>${money(tt)}</td><td>${money(tf)}</td><td>${money(tc)}</td><td>${money(tp)}</td></tr></tbody></table>${globalPrintFooterHTML(company,'Bilan journalier')}</div>`;
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
  return `<div class="reportA4">${globalPrintHeaderHTML(company)}<div class="reportTitle"><h1>LISTE DES JOURS ET LEURS BILANS</h1><h2>Résumé général par journée de vente</h2></div><div class="goldLine"></div><div class="blockTitle">LISTE DES JOURS ET LEURS BILANS</div><table class="reportTable"><thead><tr><th>Jour</th><th>Nombre de ventes</th><th>Clients servis</th><th>Quantité totale</th><th>Chiffre d’affaires</th><th>Frais service</th><th>Charges estimées</th><th>Bénéfice estimé</th></tr></thead><tbody>${body}<tr class="total"><td colspan="3"><b>TOTAL GÉNÉRAL DES JOURS</b></td><td>${tq}</td><td>${money(tt)}</td><td>${money(tf)}</td><td>${money(tc)}</td><td>${money(tp)}</td></tr></tbody></table>${globalPrintFooterHTML(company,'Liste des bilans journaliers')}</div>`;
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
function applyServiceReportPeriodFilter(){
  const table=$('#serviceReportSalesTable'); if(!table) return;
  toggleServiceReportPeriodFields(false);
  const {type,year,month,day}=getServiceReportFilterValues();
  const q=String($('#invoiceSearch')?.value||'').toLowerCase().trim();
  let total=0, profit=0, count=0, qty=0;
  document.querySelectorAll('#serviceReportSalesTable tbody tr.serviceSaleRow').forEach(r=>{
    const date=r.dataset.date||'', yy=date.slice(0,4), mm=date.slice(5,7), dd=date.slice(8,10);
    let periodOk=true;
    if(type==='jour') periodOk=year&&month&&day ? (yy===String(year)&&mm===String(month).padStart(2,'0')&&dd===String(day).padStart(2,'0')) : true;
    else if(type==='mois') periodOk=year&&month ? (yy===String(year)&&mm===String(month).padStart(2,'0')) : true;
    else if(type==='annee') periodOk=year ? yy===String(year) : true;
    const invoiceOk=!q || String(r.dataset.invoice||'').includes(q);
    const ok=periodOk&&invoiceOk;
    r.style.display=ok?'':'none';
    if(ok){count++; total+=Number(r.dataset.total||0); profit+=Number(r.dataset.profit||0); qty+=Number(r.dataset.qty||0);}
  });
  const label=serviceReportPeriodLabel(type,year,month,day);
  const lab=$('#serviceReportPeriodLabel'); if(lab) lab.textContent=label;
  const st=$('#serviceReportSummaryTotal'); if(st) st.textContent=money(total);
  const sc=$('#serviceReportSummaryCount'); if(sc) sc.textContent=count;
  const sq=$('#serviceReportSummaryQty'); if(sq) sq.textContent=qty;
  const totalLine=$('#serviceReportTotalLine'); if(totalLine) totalLine.textContent='TOTAL PÉRIODE — '+label.replace(' : ',' : ')+' : '+money(total)+(window.g3ReportAdmin?' | Bénéfice : '+money(profit):'');
  const no=$('#serviceReportNoResult'); if(no) no.classList.toggle('hidden', count>0 || !document.querySelector('#serviceReportSalesTable tbody tr.serviceSaleRow'));
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
    return `<tr class="serviceSaleRow" data-date="${esc(String(s.date||'').slice(0,10))}" data-invoice="${esc(inv)}" data-total="${Number(s.total||0)}" data-profit="${Number(s.profit||0)}" data-qty="${Number(s.qty||0)}"><td class="no-print selectCol" data-label="✓"><input class="reportSaleCheck" type="checkbox" value="${esc(sid)}"></td><td class="rtInvoice" data-label="Facture" title="${esc(sid)}">${esc(sid)}</td><td class="rtDate" data-label="Date" title="${esc(fullDate)}">${esc(fmtShortDate(s.date))}</td><td class="rtClient" data-label="Client" title="${esc(clientName+' — '+badge)}"><span class="rtClip">${esc(clientName)}</span> <span class="saleBadge mini">${badge}</span></td><td class="rtCaisse" data-label="Caisse" title="${esc(caisse)}"><span class="saleBadge mini">${esc(caisse)}</span></td><td class="rtItem" data-label="Élément" title="${esc((inf.name||'')+' — '+(inf.detail||''))}">${esc(inf.name)}</td><td class="rtQty" data-label="Qté">${Number(s.qty||1)}</td><td class="rtMoney" data-label="Frais" title="${esc(money(s.serviceFee||0))}">${money(s.serviceFee||0)}</td><td class="rtMoney rtTotal" data-label="Total" title="${esc(money(s.total||0))}">${money(s.total||0)}</td>${admin?actionBtns(esc(sid)):''}</tr>`;
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
  </tbody></table><div id="serviceReportNoResult" class="notice serviceReportNoResult hidden">Aucune vente trouvée pour cette période.</div>
  ${admin?'<div class="clearHistoryBar no-print"><button class="clearHistoryBtn" onclick="clearSalesHistory()">🗑️ Vider l’historique</button><small>Cette action supprimera définitivement toutes les ventes enregistrées.</small></div>':''}
  </div>`;
}
function clientContractSection(clients,admin,sales){
  return `<div class="contractTopActions no-print">
    <button class="contractAddBtn" onclick="openContractClientPopup()">Ajouter client sous contrat</button>
    <button class="contractListBtn" onclick="showContractClientList()">Liste des clients sous contrat</button>
  </div>
  ${clientContractForm()}
  <div id="contractClientListPage" class="contractClientListPage">${clientContractList(clients,admin)}</div>
  ${clientConsumptionBlock(sales)}`;
}
function clientContractForm(){
  return `<div id="contractClientModal" class="modal hidden contractClientModal"><div class="modalOverlay" onclick="closeContractClientPopup()"></div><div class="modalCard contractModalCard"><button class="modalClose" onclick="closeContractClientPopup()">×</button><h2>Formulaire d’ajout client sous contrat</h2><p class="sub">Renseignez les informations du client et validez l’enregistrement.</p><input id="ccEdit" type="hidden"><div class="contractGoldForm"><label>Nom du client contrat<input id="ccName" placeholder="Nom du client contrat"></label><label>Téléphone<input id="ccPhone" placeholder="Téléphone"></label><label>Type de facturation<select id="ccMode"><option value="Mensuelle">Mensuelle</option><option value="Trimestriel">Trimestriel</option></select></label><label>Remise en %<input id="ccRemise" type="number" value="0" min="0" placeholder="Remise %"></label><label class="fullRow">Observation<textarea id="ccObs" rows="3" placeholder="Observation"></textarea></label></div><button id="ccSaveBtn" class="contractSaveBtn" onclick="addContractClient()">Enregistrer</button></div></div>`
}
function showContractClientList(){document.querySelector('#contractClientListPage')?.scrollIntoView({behavior:'smooth',block:'start'});}
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
  shell(`<div class="g2panel printable contractInvoicePage"><div class="reportActions no-print"><button onclick="renderDash('contrats')">Retour clients sous contrat</button><button onclick="window.print()">Imprimer la page</button></div><div class="contractInvoiceHead"><h1>FACTURES DU CLIENT SOUS CONTRAT</h1><h2>${esc(c.name)}</h2><p>${esc(c.phone||'')} — ${esc(c.mode||'Mensuelle')} — Remise ${Number(c.remise||0)}%</p></div><div class="contractInvoiceTableWrap"><table class="g2table contractInvoiceTable"><thead><tr><th>Type de facturation</th><th>Période facturée</th><th>Montant</th><th class="no-print">Action</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(c.mode||'Mensuelle')}</td><td>${esc(contractInvoicePeriodLabel(r.key))}</td><td>${money(r.net)}</td><td class="no-print"><button class="contractInvoiceBtn" onclick="printContractClientInvoicePeriod('${c.id}','${r.key}')">Imprimer</button></td></tr>`).join('')||'<tr><td colspan="4">Aucune facture disponible pour ce client.</td></tr>'}</tbody></table></div></div>`,'contrats');
}
function printContractClientInvoicePeriod(cid,key){
  const {d,company}=current(); const c=(d.clients||[]).find(x=>x.id===cid&&x.companyId===company.id); if(!c) return g3Alert('Client introuvable','Client introuvable','danger');
  const all=getCompanyValidatedSales(); const row=contractClientInvoiceRows(c,all).find(r=>r.key===key); if(!row) return g3Alert('Aucune consommation trouvée pour ce client sous contrat.','Aucune consommation','info');
  const remise=Number(c.remise||0), ref='FCC-'+String(key).replace(/[^0-9A-Z]/gi,'')+'-'+randomPart(4), now=new Date();
  shell(`<div class="g2panel printable"><div class="reportActions no-print"><button onclick="openContractClientInvoicePage('${c.id}')">Retour liste factures</button><button onclick="window.print()">Imprimer / PDF</button></div><div class="reportBox monthlyInvoice contractInvoicePrint">${freeWatermark(company)}<h1>FACTURE MENSUELLE CLIENT SOUS CONTRAT</h1><h3>${esc(company.name)} — ${esc(contractInvoicePeriodLabel(key))}</h3><div class="ficheSeparator"></div><div class="ficheInfoGrid"><div><b>Référence :</b> ${esc(ref)}</div><div><b>Client :</b> ${esc(c.name)}</div><div><b>Téléphone :</b> ${esc(c.phone||'')}</div><div><b>Type de facturation :</b> ${esc(c.mode||'Mensuelle')}</div><div><b>Date :</b> ${now.toLocaleString('fr-FR')}</div><div><b>Remise :</b> ${remise}%</div></div><table class="g2table contractMonthlyTable"><colgroup><col style="width:10%"><col style="width:18%"><col style="width:23%"><col style="width:8%"><col style="width:14%"><col style="width:12%"><col style="width:15%"></colgroup><thead><tr><th>Date</th><th>Service / Produit</th><th>Note / Détail</th><th>Qté</th><th>Prix unitaire</th><th>Total</th><th>Observation</th></tr></thead><tbody>${row.items.map(s=>{const detail=[s.detail,s.description,s.itemDetail].filter(Boolean).join(' — ') || s.note || ''; const obs=s.note && detail!==s.note ? s.note : (s.id||''); return `<tr><td>${new Date(s.date).toLocaleString('fr-FR')}</td><td>${esc(s.name)}</td><td>${esc(detail)}</td><td>${Number(s.qty||1)}</td><td>${money(s.unit||0)}</td><td>${money(s.total||0)}</td><td>${esc(obs)}</td></tr>`}).join('')}<tr class="total"><td colspan="5">TOTAL CONSOMMATION</td><td>${money(row.total)}</td><td></td></tr><tr class="total"><td colspan="5">REMISE ${remise}%</td><td>${money(row.total-row.net)}</td><td></td></tr><tr class="total"><td colspan="5">NET À PAYER</td><td>${money(row.net)}</td><td></td></tr></tbody></table>${qrBlock(ref,company,row.net,now.toISOString())}<div class="signatureZone"><span>Signature client</span><span>Cachet / Signature entreprise</span></div></div></div>`,'contrats');
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
function showBilan(){if(!requireAdmin('La caisse ne peut pas voir le bilan détaillé, les bénéfices ou les charges globales.')) return;const {d,company}=current(), sales=getCompanyValidatedSales().filter(isInActiveExercise), items=d.items.filter(i=>i.companyId===company.id); const ca=sales.reduce((a,b)=>a+Number(b.total||0),0), charges=sales.reduce((a,b)=>a+Number(b.charges||0),0), profit=sales.reduce((a,b)=>a+Number(b.profit||0),0); const oblTotal=getObligations(d,company.id).reduce((a,r)=>a+getObligationValue(r),0); shell(`<div class="g2panel printable"><button onclick="show('rapports')">Retour administrateur</button> <button onclick="window.print()">Imprimer / PDF</button><div class="reportBox"><h1>RAPPORT BILAN DÉTAILLÉ DE L’ENTREPRISE</h1><h3>${esc(company.name)} — Exercice actif : ${monthsList[getActiveMonth()]} ${getManageYear()}<br>N° Rapport : BILAN-${Date.now()} | Date : ${new Date().toLocaleString('fr-FR')}</h3>${globalSalesReport(items,sales)}<div class="serviceBlock"><h2>Résumé financier de l’exercice actif</h2><table><tr><th>Indicateur</th><th>Valeur</th></tr><tr><td>Nombre total de clients servis</td><td>${sales.reduce((total,s)=>total+saleClientsServedValue(s),0)}</td></tr><tr><td>Quantité totale vendue</td><td>${sales.reduce((a,b)=>a+Number(b.qty||0),0)}</td></tr><tr><td>Chiffre d’affaires total</td><td>${money(ca)}</td></tr><tr><td>Total des charges estimées</td><td>${money(charges)}</td></tr><tr><td>Bénéfice net estimé avant obligations</td><td>${money(profit)}</td></tr><tr><td>Total obligations mensuelles calculées</td><td>${money(oblTotal)}</td></tr><tr><td>Résultat net réel estimé après obligations</td><td>${money(profit-oblTotal)}</td></tr></table></div></div></div>`, 'rapports')}
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
function showFichePaiement(){if(!requireAdmin('La caisse ne peut pas voir les charges globales.')) return;shell(`<div class="g2panel printable"><div class="reportActions no-print"><button onclick="show('param')">Retour paramètres</button><button onclick="showFichePaiement()">Actualiser la fiche</button><button onclick="window.print()">Imprimer / PDF</button></div>${fichePaiementBox()}</div>`,'param')}
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
/* fonction historique deleteCategory supprimée : version finale conservée */

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
/* fonction historique addItem supprimée : version finale conservée */
function editItem(iid){openStockItemPopup(iid)}
/* fonction historique deleteItem supprimée : version finale conservée */

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
  const productFields=`
    <label>Prix<input id="saleCartProductPrice" value="${Number(item.sell||0)}" readonly></label>
    <label>Qté<input id="saleCartQty" type="number" min="1" value="1" oninput="updateSaleCartPopupTotals()" onchange="updateSaleCartPopupTotals()"></label>
    <label>Total<input id="saleCartTotal" value="${Number(item.sell||0)}" readonly></label>`;
  const serviceFields=`
    <label>Prix vente du service<input id="saleCartServicePrice" type="number" min="0" placeholder="Saisir le prix de vente" oninput="updateSaleCartPopupTotals()" onchange="updateSaleCartPopupTotals()"></label>
    <label>Frais service<input id="saleCartServiceFee" type="number" min="0" value="0" placeholder="0" oninput="updateSaleCartPopupTotals()" onchange="updateSaleCartPopupTotals()"></label>
    <label>Qté<input id="saleCartQty" type="number" min="1" value="1" oninput="updateSaleCartPopupTotals()" onchange="updateSaleCartPopupTotals()"></label>
    <label>Prix unitaire<input id="saleCartUnit" value="0" readonly></label>
    <label>Total<input id="saleCartTotal" value="0" readonly></label>`;
  document.body.insertAdjacentHTML('beforeend',`
    <div class="saleCartPopupBackdrop" role="dialog" aria-modal="true">
      <div class="saleCartPopupCard">
        <button type="button" class="saleCartClose" onclick="closeSaleCartPopup()">×</button>
        <div class="saleCartHead">
          <div class="saleCartIcon">${isProduct?'📦':'🧾'}</div>
          <div><h2>${isProduct?'Ajouter le produit au panier':'Ajouter le service au panier'}</h2><p>Confirmez les informations. Le client et l’encaissement seront choisis dans le panier.</p></div>
        </div>
        <input id="saleCartItemId" type="hidden" value="${esc(item.id)}">
        <input id="saleCartMode" type="hidden" value="${isProduct?'boutique':'service'}">
        <div class="saleCartGrid">
          <label>Catégorie<input value="${esc(item.cat||'')}" readonly></label>
          <label>Code<input value="${esc(item.code||'')}" readonly></label>
          <label>Nom<input value="${esc(item.name||'')}" readonly></label>
          <label>Détail<input value="${esc(item.detail||'')}" readonly></label>
          ${isProduct?productFields:serviceFields}
          <label>Nb de Clients servis<input id="saleCartClientsServed" type="number" min="1" step="1" value="1" inputmode="numeric" aria-label="Nombre de clients servis"></label>
          <label class="fullRow">Note<textarea id="saleCartNote" rows="2" placeholder="Note ou observation facultative..."></textarea></label>
        </div>
        <div class="saleCartActions">
          <button type="button" class="btn2" onclick="closeSaleCartPopup()">Annuler</button>
          <button type="button" class="saleCartAddBtn" onclick="confirmAddSaleCartPopup()">AJOUTER AU PANIER</button>
        </div>
      </div>
    </div>`);
  updateSaleCartPopupTotals();
  setTimeout(()=>{(isProduct?$('#saleCartQty'):$('#saleCartServicePrice'))?.focus();},80);
}
function updateSaleCartPopupTotals(){
  const mode=$('#saleCartMode')?.value||'';
  const qty=salePopupQty('saleCartQty');
  const totalEl=$('#saleCartTotal');
  if(mode==='boutique'){
    const price=Math.max(0,salePopupNumber($('#saleCartProductPrice')?.value||0));
    const total=price*qty;
    if(totalEl) totalEl.value=String(Math.round(total));
    return;
  }
  const servicePrice=Math.max(0,salePopupNumber($('#saleCartServicePrice')?.value||0));
  const fee=Math.max(0,salePopupNumber($('#saleCartServiceFee')?.value||0));
  const total=servicePrice+fee;
  const unit=qty?total/qty:0;
  if($('#saleCartServiceFee') && $('#saleCartServiceFee').value==='') $('#saleCartServiceFee').value=0;
  if(totalEl) totalEl.value=String(Math.round(total));
  const unitEl=$('#saleCartUnit'); if(unitEl) unitEl.value=String(Math.round(unit));
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
  const qty=salePopupQty('saleCartQty');
  const clientsServed=salePopupClientsServed('saleCartClientsServed');
  if(qty<1) return g3Alert('La quantité doit être supérieure ou égale à 1.','Quantité obligatoire','info');
  if(clientsServed<1) return g3Alert('Le nombre de clients servis doit être supérieur ou égal à 1.','Clients servis obligatoires','info');
  const saleKindFinal=(mode==='boutique'||saleRegisterKind(item)==='boutique')?'boutique':'service';
  let unit=0,total=0,charges=0,serviceFee=0,serviceBasePrice=0;
  if(saleKindFinal==='boutique'){
    unit=Number(item.sell||0);
    if(unit<=0) return g3Alert('Le prix du produit doit être supérieur à 0.','Prix invalide','info');
    const currentStock=saleRegisterStockQty(item);
    const reserved=getCompanyCartSales().filter(s=>s.itemId===item.id).reduce((a,b)=>a+Number(b.qty||0),0);
    if(String(item.stockType||'limited').toLowerCase()!=='unlimited'&&currentStock<reserved+qty) return g3Alert('La quantité demandée dépasse le stock encore disponible pour ce panier.','Stock insuffisant','danger');
    total=unit*qty; charges=Number(item.buy||0)*qty;
  }else{
    serviceBasePrice=Math.max(0,salePopupNumber($('#saleCartServicePrice')?.value||0));
    serviceFee=Math.max(0,salePopupNumber($('#saleCartServiceFee')?.value||0));
    if(serviceBasePrice<=0) return g3Alert('Veuillez saisir le prix de vente du service.','Prix du service obligatoire','info');
    total=serviceBasePrice+serviceFee; unit=qty?total/qty:0;
    if(total<=0||unit<=0) return g3Alert('Le total ou le prix unitaire du service est invalide.','Calcul invalide','info');
    charges=serviceBasePrice*(Number(item.charge||0)/100);
  }
  const note=String($('#saleCartNote')?.value||'').trim();
  captureSaleCartClient(false);
  const sid='GG-'+new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14)+'-'+Math.floor(Math.random()*90+10);
  const nowIso=new Date().toISOString();
  d.sales=d.sales||[];
  d.sales.push({id:sid,companyId:cid,userId:user.id,client:'',name:item.name,qty,clientsServed,unit,total,serviceFee,serviceBasePrice,charges,profit:total-charges,date:nowIso,cartCreatedAt:nowIso,saleStatus:'cart',status:'cart',cartPending:true,validatedAt:'',docSecureLink:secureDocLink(sid),docQr:true,clientType:'',contractClientId:'',itemCode:item.code||'',itemId:item.id,category:item.cat||'',detail:item.detail||'',saleKind:saleKindFinal,note});
  save(d);
  logCaisseAction('Ajout au panier','Article '+(item.name||'')+' ajouté au panier — Qté '+qty);
  closeSaleCartPopup(); clearSaleLookupAfterPopup(); renderDash('vente');
  g3Success('Article ajouté au panier. Choisissez le client puis cliquez sur « Encaisser et valider ».','Panier mis à jour');
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
/* fonction historique resetUserPasswordDirect supprimée : version finale conservée */
/* fonction historique addUser supprimée : version finale conservée */
/* fonction historique blockUser supprimée : version finale conservée */

function superPasswordResetRequestsBox(){
  const d=seed();
  const rows=(d.passwordResetRequests||[]).filter(r=>r.role==='admin').slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  return `<div class="superTableWrap"><table class="superTable"><thead><tr><th>Date</th><th>Entreprise</th><th>Administrateur</th><th>Contact</th><th>Motif</th><th>Statut</th><th>Action</th></tr></thead><tbody>${rows.map(r=>{const c=(d.companies||[]).find(x=>x.id===r.companyId); return `<tr><td>${new Date(r.createdAt).toLocaleString('fr-FR')}</td><td>${esc(c?.name||'-')}</td><td><b>${esc(r.userName||r.email)}</b><br><small>${esc(r.email||'')}</small></td><td>${esc(r.phone||'')}</td><td>${esc(r.reason||'')}</td><td>${esc(r.status||'')}</td><td>${r.status==='pending'?`<button class="detailsBtn" onclick="resetPasswordRequestBySuper('${r.id}')">Générer mot de passe</button>`:'<span class="statusPill active">traité</span>'}</td></tr>`}).join('')||'<tr><td colspan="7">Aucune demande administrateur en attente.</td></tr>'}</tbody></table></div>`;
}
/* fonction historique resetPasswordRequestBySuper supprimée : version finale conservée */
/* fonction historique superResetAdminPassword supprimée : version finale conservée */
function renderSuper(){const {d,user}=current(); const ca=d.sales.filter(isSaleValidated).reduce((a,b)=>a+b.total,0); const active=d.companies.filter(c=>statusCompany(c)==='active'||statusCompany(c)==='trial').length; const expired=d.companies.filter(c=>statusCompany(c)==='expired').length; app.innerHTML=`<div class="superShell"><aside class="superSide"><div class="superBrand"><div class="superLogo">MS</div><div><h2>MEGA SERVICES</h2><p>Super Admin GLOBAL MARKET</p></div></div><div class="superMenu"><button class="active" onclick="renderSuper()">📊 Vue générale</button><button onclick="exportData()">📤 Exporter données</button><button class="danger" onclick="logout()">🚪 Déconnexion</button></div><div class="superNote">Gestion centrale des entreprises, abonnements, utilisateurs et chiffres déclarés.</div></aside><main class="superMain"><div class="superHero"><div><span class="superKicker">Administration centrale</span><h1>Gestion professionnelle des entreprises inscrites</h1><p>Suivi des abonnements, contrôle des statuts, chiffre d’affaires et actions rapides MEGA SERVICES.</p></div><button class="superExport" onclick="exportData()">📤 Exporter données</button></div><div class="superStats"><div class="superStat"><span>🏢</span><small>Entreprises</small><b>${d.companies.length}</b></div><div class="superStat"><span>✅</span><small>Actives</small><b>${active}</b></div><div class="superStat"><span>⏳</span><small>Expirées</small><b>${expired}</b></div><div class="superStat"><span>💰</span><small>CA déclaré</small><b>${money(ca)}</b></div></div><section class="superPanel"><div class="superPanelHead"><div><h2>Entreprises inscrites</h2><p>Liste simplifiée : cliquez sur <b>Voir détails</b> devant chaque entreprise pour ouvrir la fiche complète avec les actions.</p></div><span>${d.companies.length} entreprise(s)</span></div><div class="superTableWrap"><table class="superTable superCompanyList"><thead><tr><th>Entreprise</th><th>Responsable</th><th>Abonnement</th><th>CA déclaré</th><th>Actions</th></tr></thead><tbody>${d.companies.map(c=>{let s=d.sales.filter(x=>x.companyId===c.id&&isSaleValidated(x)).reduce((a,b)=>a+b.total,0), st=statusCompany(c); return `<tr><td><div class="companyNameLine"><button class="detailsBtn" onclick="showCompanyDetails('${c.id}')">Voir détails</button><strong>${esc(c.name)}</strong></div></td><td>${esc(c.owner)}</td><td><span class="statusPill ${st}">${st}</span><br><small>${esc(planDef(c).label)} — Fin : ${esc(c.subscriptionEnd)}</small></td><td><b>${money(s)}</b></td><td><div class="superCompanyActions"><button class="detailsBtn wide" onclick="showCompanyDetails('${c.id}')">Ouvrir la fiche</button><button class="danger companyDeleteBtn" data-delete-company="${c.id}" onclick="deleteCompanyAccount('${c.id}')">Supprimer le compte</button></div></td></tr>`}).join('')}</tbody></table></div></section><section class="superPanel"><div class="superPanelHead"><div><h2>Réinitialisation mots de passe Administrateur</h2><p>Règle de sécurité : seul le Super Admin GLOBAL MARKET peut réinitialiser un compte Administrateur d’entreprise.</p></div></div>${superPasswordResetRequestsBox()}</section></main></div>`}

function showCompanyDetails(cid){const d=seed(), c=d.companies.find(x=>x.id===cid); if(!c)return; const us=d.users.filter(u=>u.companyId===c.id), sales=d.sales.filter(x=>x.companyId===c.id&&isSaleValidated(x)), pay=d.payments.filter(x=>x.companyId===c.id); const ca=sales.reduce((a,b)=>a+b.total,0), articles=sales.reduce((a,b)=>a+(Number(b.qty)||0),0), st=statusCompany(c); const old=document.querySelector('.superModalBackdrop'); if(old)old.remove(); const box=document.createElement('div'); box.className='superModalBackdrop'; box.innerHTML=`<div class="superCompanyModal"><button class="superClose" onclick="closeSuperModal()">×</button><div class="companyModalHead"><div><span class="superKicker">Fiche entreprise</span><h2>${esc(c.name)}</h2><p>Informations d’inscription, abonnement, utilisateurs, chiffre d’affaires et gestion des accès.</p></div><span class="statusPill ${st}">${st}</span></div><div class="companyDetailGrid"><div><small>Responsable</small><b>${esc(c.owner)}</b></div><div><small>Téléphone</small><b>${esc(c.phone)}</b></div><div><small>Email</small><b>${esc(c.email)}</b></div><div><small>Type de commerce</small><b>${esc(c.businessType)}</b></div><div><small>Plan</small><b>${esc(c.plan)}</b></div><div><small>Début abonnement</small><b>${esc(c.subscriptionStart||'-')}</b></div><div><small>Fin abonnement</small><b>${esc(c.subscriptionEnd||'-')}</b></div><div><small>Utilisateurs</small><b>${us.length}</b></div><div><small>Ventes réalisées</small><b>${sales.length}</b></div><div><small>Articles vendus</small><b>${articles}</b></div><div><small>Chiffre d’affaires</small><b>${money(ca)}</b></div><div><small>Paiements enregistrés</small><b>${pay.length}</b></div></div><h3>Utilisateurs du compte</h3><div class="miniList">${us.length?us.map(u=>`<div><b>${esc(u.name)}</b><span>${esc(u.role)} — ${esc(u.email)} — ${esc(u.status||'active')}${u.mustChangePassword?' — mot de passe temporaire':''}</span>${u.role==='admin'?`<button class="detailsBtn" onclick="superResetAdminPassword('${u.id}')">Réinitialiser admin</button>`:''}</div>`).join(''):'<em>Aucun utilisateur enregistré.</em>'}</div>${planActivationButtons(c.id,planCode(c))}<div class="superModalActions"><button onclick="renewCompany('${c.id}');closeSuperModal()">Renouveler</button><button class="soft" onclick="setCompanyStatus('${c.id}','suspended');closeSuperModal()">Suspendre</button><button class="danger" onclick="setCompanyStatus('${c.id}','blocked');closeSuperModal()">Bloquer</button><button class="ok" onclick="setCompanyStatus('${c.id}','active');closeSuperModal()">Activer</button><button class="danger companyDeleteBtn" data-delete-company="${c.id}" onclick="deleteCompanyAccount('${c.id}')">Supprimer définitivement le compte</button></div></div>`; document.body.appendChild(box)}
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
    if(result.data){CLOUD_DATA=normalizeData(result.data);CLOUD_DATA_READY=true}else await cloudLoadData();
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
  const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reçu abonnement ${esc(ref)}</title><style>${globalPrintThemeStyles('portrait')}@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#eef4f3;font-family:Arial,Helvetica,sans-serif;color:#102b2a;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{position:fixed;right:16px;top:16px;z-index:10;display:flex;gap:8px}.toolbar button{border:0;border-radius:12px;padding:12px 16px;background:#00625d;color:#fff;font-weight:900}.receipt{position:relative;width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:7mm 8mm 18mm}.receiptTitle{text-align:center;margin:2mm 0 8mm}.receiptTitle h1{margin:0;color:#004a48;font-size:7mm}.receiptTitle p{margin:2mm 0 0;color:#555;font-size:3mm}.receiptBadge{display:block;width:max-content;margin:0 auto 8mm;padding:2.2mm 10mm;background:#004a48;color:#fff;border-left:2mm solid #e1a500;font-size:3.5mm;font-weight:1000}.grid{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-bottom:7mm}.box{border:.3mm solid #d9e4e2;border-radius:3mm;padding:5mm;background:#fbfefd;min-height:19mm}.box small{display:block;color:#667;margin-bottom:1.4mm;font-size:2.6mm;font-weight:900;text-transform:uppercase}.box b{font-size:4mm;color:#102b2a}.amount{border-radius:3mm;padding:7mm;background:#062b29;color:#fff;display:flex;justify-content:space-between;align-items:center;margin:7mm 0}.amount span{font-size:3.3mm;color:#d7eee9}.amount b{font-size:8mm}.foot{display:grid;grid-template-columns:1fr 1fr;gap:18mm;margin-top:16mm}.sign{border-top:.3mm solid #222;text-align:center;padding-top:3mm;color:#333;font-weight:900;font-size:3mm}@media print{body{background:#fff}.toolbar{display:none}.receipt{margin:0;width:210mm;min-height:297mm}}</style></head><body><div class="toolbar"><button onclick="window.print()">Imprimer / PDF</button><button onclick="window.close()">Fermer</button></div><main class="receipt">${globalPrintHeaderHTML(company)}<div class="receiptTitle"><h1>REÇU OFFICIEL D’ABONNEMENT</h1><p>Référence : <b>${esc(ref)}</b></p></div><div class="receiptBadge">REÇU DE PAIEMENT</div><div class="grid"><div class="box"><small>Entreprise</small><b>${esc(company.name||'')}</b></div><div class="box"><small>Responsable</small><b>${esc(company.owner||'')}</b></div><div class="box"><small>Plan payé</small><b>${plan}</b></div><div class="box"><small>Date du paiement</small><b>${esc(dt)}</b></div><div class="box"><small>Statut</small><b>${esc(p.status||'Payé')}</b></div><div class="box"><small>Moyen / observation</small><b>${esc(p.method||'-')}</b></div></div><div class="amount"><span>Montant reçu</span><b>${money(p.amount||0)}</b></div><div class="foot"><div class="sign">Signature client</div><div class="sign">Cachet / Signature GLOBAL MARKET</div></div>${globalPrintFooterHTML(company,'Reçu d’abonnement')}</main></body></html>`;
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
  if(!user) return renderLogin();
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
      <table class="mkOrdersTable"><tr><th>N° COMMANDE</th><th>CLIENT</th><th>ARTICLES</th><th>MONTANT</th><th>STATUT</th><th>DATE</th><th>ACTION</th></tr>${orders.map(o=>`<tr><td><button class="orderLinkBtn" onclick="openMarketplaceOrderPopup('${esc(o.id||'CMD')}',true)">#${esc(o.id||'CMD')}</button></td><td>${esc(o.client||'Client')}</td><td>${orderItemsCount(o)} article(s)</td><td>${money(orderTotal(o))}</td><td><span class="mkStatus">${esc(orderMainStatus(o))}</span></td><td>${new Date(o.date).toLocaleDateString('fr-FR')}</td><td><button class="danger smallDeleteOrder" onclick="deleteMarketplaceOrder('${esc(o.id||'CMD')}',true)">Supprimer</button></td></tr>`).join('')||'<tr><td colspan="7">Aucune commande récente.</td></tr>'}</table>
    </div>`;
  }
  shell(`<section class="section active marketplacePage marketplaceClean">
    <div class="mkTopHero compactMarketHeader mkHeaderSimple">
      <div class="mkBrandBlock">
        <div class="mkLogoRound">GG</div>
        <div><h1>Marketplace</h1></div>
      </div>
      <div class="mkHeroBtns mkHeroBtnsHorizontal"><button onclick="openPublicShop()">Voir boutique publique</button><button class="payConfigBtn" onclick="openMarketplacePaymentConfig()">Configurer paiement</button><button class="clientReportBtn" onclick="openMarketplaceClientsReport()">Mes clients enregistrés</button><button class="darkBtn" onclick="shareText('${marketplaceUrl(company)}')">Partager le lien</button></div>
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
function mkProductVisual(i){if(i&&i.photo){return `<img src="${esc(i.photo)}" alt="${esc(i.name||'Article')}" class="mkProductPhoto">`;} const n=(i.name||'').toLowerCase(); if(n.includes('imprim')) return '🖨️'; if(n.includes('souris')) return '🖱️'; if(n.includes('clé')||n.includes('usb')) return '💾'; if(n.includes('casque')||n.includes('audio')) return '🎧'; if(n.includes('montre')) return '⌚'; if(n.includes('phone')||n.includes('portable')||n.includes('laptop')||n.includes('ordinateur')) return '💻'; if(!isBoutiqueItem(i)) return '🛠️'; return '📦'}
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
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Liste des clients enregistrés</title><style>${globalPrintThemeStyles('landscape')}@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#fff;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact}.toolbar{position:fixed;top:10px;right:10px;z-index:20;display:flex;gap:8px}.toolbar button{border:0;border-radius:10px;padding:10px 14px;font-weight:900;cursor:pointer;background:#0f766e;color:#fff}.page{position:relative;width:297mm;min-height:210mm;padding:6mm 7mm 18mm;margin:0 auto}.pageTitle{text-align:center;margin:0 0 5mm}.pageTitle h1{margin:0;color:#0f766e;font-size:6mm;text-transform:uppercase}.pageTitle h2{margin:1.5mm 0 0;font-size:3.2mm;color:#334155}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:2.45mm}th{background:#0f766e;color:#fff;padding:2.2mm 1mm;border:.25mm solid #0b5f59;text-align:center}td{padding:2mm 1mm;border:.25mm solid #cbd5e1;text-align:center;word-break:break-word;color:#111827!important;font-weight:700}td:nth-child(2),th:nth-child(2){text-align:left;width:22%}tr:nth-child(even) td{background:#f5faf9!important}small{display:block;color:#334155!important;font-weight:700;margin-top:.8mm}@media print{.toolbar{display:none}.page{margin:0;width:297mm;min-height:210mm}.g3pf{left:7mm;right:7mm}}</style></head><body><div class="toolbar"><button onclick="window.print()">Imprimer</button><button onclick="window.close()">Fermer</button></div><main class="page">${globalPrintHeaderHTML(company)}<div class="pageTitle"><h1>Rapport général des clients et leurs achats</h1><h2>Liste des clients enregistrés seulement</h2></div>${cleanTable.outerHTML}${globalPrintFooterHTML(company,'Rapport clients')}</main></body></html>`);
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
  if(!getPublicClient(companyId)){ alert('Veuillez vous inscrire ou vous connecter avant d’ajouter au panier.'); openClientRegisterPopup(companyId); return; }
  const d=seed(); const it=(d.items||[]).find(x=>x.id===itemId&&x.companyId===companyId&&!x.marketplaceHidden);
  if(!it) return alert('Article introuvable.');
  const qty=isBoutiqueItem(it)?Math.max(1,Number(await g3Prompt('Quantité à ajouter au panier :','1','Quantité panier')||1)):1;
  const cart=getPublicCart(companyId); const line=cart.find(x=>x.itemId===itemId);
  if(line) line.qty=Number(line.qty||0)+qty; else cart.push({itemId,qty});
  refreshPublicCartBadge(companyId);
  showPublicToast('Commande ajouter au panier');
}
function refreshPublicCartBadge(companyId){const b=document.getElementById('publicCartBadge'); if(b) b.textContent=publicCartCount(companyId);}
function publicDeliveryRate(subtotal){
  subtotal=Number(subtotal||0);
  if(subtotal>=100000) return 1.5;
  if(subtotal>=25000) return 2;
  if(subtotal>=5000) return 5;
  if(subtotal>=5) return 10;
  return 0;
}
function publicDeliveryFee(subtotal){
  subtotal=Number(subtotal||0);
  return Math.round(subtotal*publicDeliveryRate(subtotal)/100);
}
function publicCartPricing(companyId){
  const d=seed(); const cart=getPublicCart(companyId);
  const subtotal=cart.reduce((sum,line)=>{const it=(d.items||[]).find(x=>x.id===line.itemId&&x.companyId===companyId); return sum+(it?itemMarketPrice(it)*Number(line.qty||1):0)},0);
  const deliveryRate=publicDeliveryRate(subtotal);
  const deliveryFee=publicDeliveryFee(subtotal);
  return {subtotal,deliveryRate,deliveryFee,total:subtotal+deliveryFee};
}
function openPublicCart(companyId){
  if(!getPublicClient(companyId)){ alert('Veuillez vous inscrire ou vous connecter pour voir votre panier.'); openClientRegisterPopup(companyId); return; }
  document.getElementById('publicCartModal')?.remove();
  const d=seed(); const cart=getPublicCart(companyId); const pricing=publicCartPricing(companyId);
  const rows=cart.map((line,idx)=>{const it=(d.items||[]).find(x=>x.id===line.itemId&&x.companyId===companyId); if(!it) return ''; const price=itemMarketPrice(it), total=price*Number(line.qty||1); return `<tr><td>${idx+1}</td><td>${esc(it.name)}</td><td>${esc(it.cat||'-')}</td><td><input class="cartQtyInput" type="number" min="1" value="${Number(line.qty||1)}" onchange="updatePublicCartQty('${companyId}','${line.itemId}',this.value)"></td><td>${money(price)}</td><td><b>${money(total)}</b></td><td><button class="miniDanger" onclick="removePublicCartItem('${companyId}','${line.itemId}')">Retirer</button></td></tr>`}).join('');
  const feeLabel=pricing.deliveryRate?`${pricing.deliveryRate}%`:'0%';
  const html=`<div class="marketPayModalBackdrop" id="publicCartModal"><div class="marketPayModal publicCartBox publicCheckoutModal"><button class="marketPayClose" onclick="document.getElementById('publicCartModal')?.remove()">×</button><div class="publicCheckoutHead"><div><span>COMMANDE CLIENT</span><h2>Validation du panier</h2><p>Vérifiez les articles, les frais de livraison et choisissez votre mode de paiement.</p></div><b>${publicCartCount(companyId)} article(s)</b></div><div class="clientOrdersScroll"><table class="mkOrdersTable"><tr><th>N°</th><th>Produit / Service</th><th>Catégorie</th><th>Qté</th><th>Prix</th><th>Total</th><th>Action</th></tr>${rows||'<tr><td colspan="7">Panier vide.</td></tr>'}</table></div><div class="publicOrderTotals"><div><span>Sous-total des produits et services</span><b>${money(pricing.subtotal)}</b></div><div><span>Frais de livraison <small>(${feeLabel})</small></span><b>${money(pricing.deliveryFee)}</b></div><div class="grandTotal"><span>Total à payer</span><b>${money(pricing.total)}</b></div></div><div class="deliveryFeeScale"><strong>Barème de livraison</strong><span>5–4 999 F : 10 %</span><span>5 000–24 999 F : 5 %</span><span>25 000–99 999 F : 2 %</span><span>100 000 F et plus : 1,5 %</span></div><section class="publicPaymentDecision"><h3>Comment souhaitez-vous payer ?</h3><div class="paymentChoiceBtns publicMainPaymentChoices"><button class="payDeliveryChoice" onclick="selectPublicOrderPayment('${companyId}','delivery')"><span>🚚</span><b>Payer à la livraison</b><small>Réglez le montant total lorsque la commande vous est remise.</small></button><button class="payNowChoice" onclick="selectPublicOrderPayment('${companyId}','now')"><span>💳</span><b>Payer maintenant</b><small>Choisissez Wave ou USDT TRC20 et inscrivez l’ID de transaction.</small></button></div><div id="publicCartPayBox" class="publicPaymentChoiceBox"><p class="notice">Sélectionnez votre mode de paiement pour continuer.</p></div></section><div class="marketPayActions"><button onclick="document.getElementById('publicCartModal')?.remove()">Continuer mes achats</button><button class="btn2" onclick="getPublicCart('${companyId}').length=0;openPublicCart('${companyId}');refreshPublicCartBadge('${companyId}')">Vider le panier</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function updatePublicCartQty(companyId,itemId,qty){const cart=getPublicCart(companyId); const line=cart.find(x=>x.itemId===itemId); if(line) line.qty=Math.max(1,Number(qty||1)); openPublicCart(companyId); refreshPublicCartBadge(companyId);}
function removePublicCartItem(companyId,itemId){const cart=getPublicCart(companyId); const i=cart.findIndex(x=>x.itemId===itemId); if(i>=0) cart.splice(i,1); openPublicCart(companyId); refreshPublicCartBadge(companyId);}
function publicCartTotal(companyId){return publicCartPricing(companyId).total;}
function fcfaToUsdt(total){return (Number(total||0)/600).toFixed(2);}
function selectPublicOrderPayment(companyId,choice){
  const cart=getPublicCart(companyId); if(!cart.length) return alert('Panier vide.');
  const pricing=publicCartPricing(companyId); const box=document.getElementById('publicCartPayBox'); if(!box) return;
  document.querySelectorAll('.publicMainPaymentChoices button').forEach(btn=>btn.classList.remove('selected'));
  document.querySelector(choice==='delivery'?'.payDeliveryChoice':'.payNowChoice')?.classList.add('selected');
  if(choice==='delivery'){
    box.innerHTML=`<div class="payOnDeliveryPanel"><span class="paymentPanelIcon">🚚</span><div><h4>Paiement à la livraison</h4><p>Montant à régler au livreur : <b>${money(pricing.total)}</b>, frais de livraison inclus.</p><small>Aucun identifiant de transaction n’est nécessaire.</small></div><button id="publicOrderSubmitBtn" class="paidBtn" onclick="finalizePublicCartPayment('${companyId}','PAY_ON_DELIVERY')">VALIDER LA COMMANDE</button></div>`;
    return;
  }
  box.innerHTML=`<div class="payNowPanel"><div class="payNowIntro"><span class="paymentPanelIcon">🔐</span><div><h4>Paiement immédiat sécurisé</h4><p>Total à payer : <b>${money(pricing.total)}</b>, livraison incluse.</p><small>Choisissez Wave ou USDT TRC20.</small></div></div><div class="instantPaymentMethods"><button onclick="payPublicCart('${companyId}','WAVE')">🌊 Payer avec Wave</button><button onclick="payPublicCart('${companyId}','USDT TRC20')">₮ Payer en USDT TRC20</button></div><div id="publicInstantPaymentDetails" class="publicInstantPaymentDetails"><p class="notice">Choisissez Wave ou USDT TRC20 pour afficher le code de paiement.</p></div></div>`;
}
async function copyPublicPaymentCode(value){
  try{await navigator.clipboard.writeText(String(value||''));showPublicToast('Code de paiement copié.')}catch(e){alert('Copie impossible. Sélectionnez et copiez le code manuellement.');}
}
function payPublicCart(companyId,method){
  const d=seed(); const c=(d.companies||[]).find(x=>x.id===companyId); const client=getPublicClient(companyId); const cart=getPublicCart(companyId);
  if(!client) return openClientRegisterPopup(companyId); if(!cart.length) return alert('Panier vide.');
  const pricing=publicCartPricing(companyId); const total=pricing.total;
  let content='',configured=false;
  if(method==='WAVE'){
    const waveLink=buildWavePaymentLink(c?.marketWaveBusinessLink,total); configured=Boolean(waveLink); const qr=waveLink?'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(waveLink):'';
    content=waveLink?`<div class="payQrBox"><img src="${qr}" alt="QR Code Wave"><a class="publicPaymentCodeBtn" href="${esc(waveLink)}" target="_blank" rel="noopener">OUVRIR LE PAIEMENT WAVE — ${money(total)}</a><p>Le montant inclut <b>${money(pricing.deliveryFee)}</b> de frais de livraison.</p></div>`:'<p class="notice">Lien Wave Business non configuré par le vendeur. Choisissez le paiement à la livraison ou contactez l’entreprise.</p>';
  }else{
    const usd=fcfaToUsdt(total); const address=String(c?.marketUsdtTrc20||''); configured=Boolean(address);
    const payload=`USDT TRC20\nAdresse: ${address}\nMontant: ${usd} USD\nTotal FCFA: ${total}`; const qr=address?'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(payload):'';
    content=address?`<div class="payQrBox"><img src="${qr}" alt="QR Code USDT TRC20"><div class="usdtBox"><small>Adresse USDT TRC20</small><b>${esc(address)}</b><small>Montant à payer : ${usd} USDT</small><button class="publicPaymentCodeBtn" onclick="copyPublicPaymentCode('${esc(address)}')">COPIER L’ADRESSE USDT TRC20</button></div></div>`:'<p class="notice">Adresse USDT TRC20 non configurée par le vendeur. Choisissez le paiement à la livraison ou contactez l’entreprise.</p>';
  }
  const transaction=configured?`<div class="paymentProofBox transactionIdBox"><h3>Identification du paiement</h3><label for="publicTransactionId">ID / référence de la transaction <span>*</span><input id="publicTransactionId" type="text" maxlength="200" autocomplete="off" placeholder="Ex. identifiant Wave ou hash de transaction USDT" required></label><p>Ce numéro permet à l’entreprise de vérifier votre paiement.</p><button id="publicOrderSubmitBtn" class="paidBtn" onclick="finalizePublicCartPayment('${companyId}','${method}')">CONFIRMER LE PAIEMENT ET COMMANDER</button></div>`:'';
  const box=document.getElementById('publicInstantPaymentDetails'); if(box) box.innerHTML=content+transaction;
}
function togglePublicProofFields(){}
function readPaymentCaptureAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    if(!file) return resolve('');
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result||'');
    reader.onerror=()=>reject(reader.error||new Error('Lecture capture impossible'));
    reader.readAsDataURL(file);
  });
}
/* fonction historique finalizePublicCartPayment supprimée : version finale conservée */
function showOrderSentModal(companyId){
  document.querySelector('.orderSentModal')?.remove();
  const d=seed(); const c=(d.companies||[]).find(x=>x.id===companyId);
  const html=`<div class="marketPayModalBackdrop orderSentModal"><div class="marketPayModal orderSentBox"><h2>Commande Envoyée</h2><p>Votre commande a été envoyée au Marketplace administrateur.</p><button onclick="document.querySelector('.orderSentModal')?.remove();document.getElementById('publicCartModal')?.remove();renderPublicShop('${esc(c?.shopSlug||'')}')">OK</button></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function openClientRegisterPopup(companyId){
  const html=`<div class="marketPayModalBackdrop" id="clientRegisterModal"><div class="marketPayModal clientAuthModal"><button class="marketPayClose" onclick="document.getElementById('clientRegisterModal')?.remove()">×</button><h2>Inscription nouveau client</h2><p>Inscription obligatoire avant toute commande dans la boutique client.</p><label>Nom complet<input id="clientRegName" placeholder="Nom et prénom"></label><label>Téléphone<input id="clientRegPhone" placeholder="Ex : 0700000000"></label><label>Email<input id="clientRegEmail" placeholder="Email facultatif"></label><label>Mot de passe<input id="clientRegPass" type="password" placeholder="Créer un mot de passe"></label><div class="marketPayActions"><button onclick="savePublicClientRegister('${companyId}')">Créer mon espace client</button><button class="btn2" onclick="openClientLoginPopup('${companyId}')">J’ai déjà un compte</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function openClientLoginPopup(companyId){
  document.getElementById('clientRegisterModal')?.remove();
  document.getElementById('clientSpaceModal')?.remove();
  const html=`<div class="marketPayModalBackdrop" id="clientLoginModal"><div class="marketPayModal clientAuthModal"><button class="marketPayClose" onclick="document.getElementById('clientLoginModal')?.remove()">×</button><h2>Connexion espace client</h2><label>Téléphone<input id="clientLoginPhone" placeholder="Téléphone"></label><label>Mot de passe<input id="clientLoginPass" type="password" placeholder="Mot de passe"></label><div class="marketPayActions"><button onclick="loginPublicClient('${companyId}')">Ouvrir mon espace</button><button class="btn2" onclick="document.getElementById('clientLoginModal')?.remove();openClientRegisterPopup('${companyId}')">Inscription</button></div></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
/* fonction historique savePublicClientRegister supprimée : version finale conservée */
/* fonction historique loginPublicClient supprimée : version finale conservée */
function openClientSpace(companyId){
  document.getElementById('clientSpaceModal')?.remove();
  const d=seed(); const c=(d.companies||[]).find(x=>x.id===companyId); const client=getPublicClient(companyId);
  if(!client) return openClientLoginPopup(companyId);
  const clientDeletedSet=new Set([...(client.deletedOrderIds||[]),...((d.clientDeletedOrders&&d.clientDeletedOrders[client.id])||[])]);
  const orders=(d.orders||[]).filter(o=>o.companyId===companyId&&o.clientId===client.id&&!((o.clientDeletedIds||[]).includes(client.id))&&!clientDeletedSet.has(o.id)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const rows=orders.map(o=>`<tr><td><button class="orderLinkBtn" onclick="openMarketplaceOrderPopup('${esc(o.id||'CMD')}',false)">#${esc(o.id||'CMD')}</button></td><td>${new Date(o.date).toLocaleDateString('fr-FR')}</td><td>${orderItemsCount(o)} article(s)</td><td>${money(orderTotal(o))}</td><td>${esc(o.paymentMethod||'Non choisi')}</td><td>${esc(orderMainStatus(o))}</td><td><button class="danger smallDeleteOrder" onclick="deleteMarketplaceOrder('${esc(o.id||'CMD')}',false)">Supprimer</button></td></tr>`).join('')||'<tr><td colspan="7">Aucune commande pour le moment.</td></tr>';
  const html=`<div class="marketPayModalBackdrop" id="clientSpaceModal"><div class="marketPayModal clientSpaceBox"><button class="marketPayClose" onclick="document.getElementById('clientSpaceModal')?.remove()">×</button><h2>Espace client</h2><p><b>${esc(client.name)}</b><br>${esc(client.phone)} ${client.email?'— '+esc(client.email):''}</p><h3>Historique / suivi de mes commandes</h3><div class="clientOrdersScroll"><table class="mkOrdersTable"><tr><th>N° LOT</th><th>Date</th><th>Articles</th><th>Total</th><th>Paiement</th><th>Statut</th><th>Action</th></tr>${rows}</table></div><div class="marketPayActions"><button onclick="document.getElementById('clientSpaceModal')?.remove()">Fermer</button><button class="btn2" onclick="logoutPublicClient('${companyId}')">Déconnexion</button></div></div></div>`;
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
  const payOnDelivery=o.paymentChoice==='delivery'||o.paymentMethod==='Paiement à la livraison';
  const proof=payOnDelivery?'Aucune transaction requise':('ID transaction : '+(o.transactionId||o.paymentRef||'-'));
  const proofLink=o.paymentProofType==='capture'&&o.paymentCaptureData?`<a class="paymentCaptureLink" href="${o.paymentCaptureData}" target="_blank" download="${esc(o.paymentCaptureName||'capture-paiement.png')}">📎 Ouvrir / télécharger la capture de paiement</a>`:'';
  const subtotal=Number(o.subtotal??normalizeOrderItems(o).reduce((a,x)=>a+Number(x.total||0),0));
  const deliveryFee=Number(o.deliveryFee||0); const deliveryRate=Number(o.deliveryFeeRate||0);
  const html=`<div class="marketPayModalBackdrop" id="marketOrderDetailsModal"><div class="marketPayModal orderDetailsBox ${isAdmin?'adminOrderDetails':'clientOrderDetails'}"><button class="marketPayClose" onclick="document.getElementById('marketOrderDetailsModal')?.remove()">×</button><h2>Détails commande #${esc(o.id)}</h2><p><b>Client :</b> ${esc(o.client||'Client')} — ${esc(o.clientPhone||'')}<br><b>Date :</b> ${new Date(o.date).toLocaleString('fr-FR')}<br><b>Mode de paiement :</b> ${esc(o.paymentMethod||'-')}<br><b>Statut du paiement :</b> ${esc(o.paymentStatus||'En attente')}<br><b>${esc(proof)}</b></p>${proofLink?`<div class="paymentProofLinkBox">${proofLink}</div>`:''}<div class="clientOrdersScroll"><table class="mkOrdersTable orderDetailsLines"><tr><th>N°</th><th>Produit / Service</th><th>Catégorie</th><th>Type</th><th>Qté</th><th>PU</th><th>Total</th></tr>${rows}</table></div><div class="orderPricingDetails"><div><span>Sous-total</span><b>${money(subtotal)}</b></div><div><span>Frais de livraison (${deliveryRate||0} %)</span><b>${money(deliveryFee)}</b></div><div><span>Total commande</span><b>${money(orderTotal(o))}</b></div></div><h3>Détails remplis par l’administrateur Marketplace</h3>${statusAdmin}</div></div>`;
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
/* fonction historique deleteMarketplaceOrder supprimée : version finale conservée */

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
  const deliveryFee=Number(o.deliveryFee||0);
  if(deliveryFee>0){
    const deliveryId=id('mkp-delivery');
    d.sales.push({
      id:deliveryId,companyId:o.companyId,userId:'marketplace',client:o.client||'Client boutique',
      name:'Frais de livraison',qty:1,unit:deliveryFee,total:deliveryFee,serviceFee:0,charges:0,profit:deliveryFee,
      date:o.date||new Date().toISOString(),docSecureLink:secureDocLink(deliveryId),docQr:true,
      clientType:'marketplace',itemCode:'LIVRAISON',itemId:'',category:'Livraison',saleKind:'service',
      note:'Frais de livraison — commande '+(o.id||''),source:'marketplace',marketplaceOrderId:o.id
    });
    ids.push(deliveryId);
  }
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


function renderGlobalShop(){
  const d=seed();
  const companies=(d.companies||[]).filter(c=>hasPlanFeature(c,'public_shop'));
  const companyMap=new Map(companies.map(c=>[c.id,c]));
  const items=(d.items||[]).filter(i=>{
    const c=companyMap.get(i.companyId);
    return c && !i.marketplaceHidden && !(isBoutiqueItem(i)&&i.stockType!=='unlimited'&&Number(i.stock||0)<=0);
  });
  const cats=[...new Set(items.map(i=>i.cat).filter(Boolean))].sort();
  const cards=items.map(i=>{const c=companyMap.get(i.companyId)||{}; return `<div class="globalProductCard" data-type="${isBoutiqueItem(i)?'product':'service'}" data-cat="${esc(i.cat||'')}" data-search="${esc((i.name+' '+i.cat+' '+c.name+' '+(i.marketplaceDesc||i.detail||'')).toLowerCase())}"><div class="globalCardTop"><span>${isBoutiqueItem(i)?'Produit':'Service'}</span><b>${esc(c.name||'Entreprise')}</b></div><button type="button" class="globalProductImage ${i.photo?'clickable':''}" ${i.photo?`onclick="openGlobalProductPhoto('${i.id}')" title="Agrandir la photo"`:''}>${mkProductVisual(i)}${i.photo?'<small>🔍 Voir photo</small>':''}</button><div class="globalProductBody"><h3>${esc(i.name)}</h3><p>${esc(i.cat||'Sans catégorie')}</p><em>${esc(i.marketplaceDesc||i.detail||'')}</em><div class="globalPriceRow"><strong>${money(itemMarketPrice(i))}</strong><span>${marketStockLabel(i)}</span></div><button onclick="location.hash='boutique/${esc(c.shopSlug||slugify(c.name||''))}';render()">Voir la boutique</button></div></div>`}).join('');
  app.innerHTML=`<div class="globalShopPage"><header class="globalShopHeader"><button onclick="location.hash='';renderLogin()">← Connexion</button><div><h1>Boutique GLOBAL MARKET</h1><p>Tous les produits et services publiés par les entreprises enregistrées.</p></div></header><section class="globalShopHero"><div><small>GLOBAL MARKET MARKETPLACE</small><h2>La boutique générale de toutes les entreprises</h2><p>Comparez les produits, services, prix et boutiques disponibles en un seul endroit.</p></div><div class="globalHeroStats"><span><b>${companies.length}</b> entreprises</span><span><b>${items.length}</b> articles</span></div></section><section class="globalShopFilters"><input id="globalShopSearch" placeholder="Rechercher produit, service ou entreprise..." oninput="filterGlobalShop()"><select id="globalShopType" onchange="filterGlobalShop()"><option value="">Tous types</option><option value="product">Produits</option><option value="service">Services</option></select><select id="globalShopCat" onchange="filterGlobalShop()"><option value="">Toutes catégories</option>${cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></section><main class="globalProductsGrid">${cards||'<p class="notice">Aucun produit ou service publié dans la boutique générale.</p>'}</main><footer>© 2026 GLOBAL MARKET - MEGA SERVICES SARL U. Tous droits réservés.</footer></div>`;
}
function filterGlobalShop(){
  const q=(document.getElementById('globalShopSearch')?.value||'').toLowerCase();
  const t=document.getElementById('globalShopType')?.value||'';
  const cat=document.getElementById('globalShopCat')?.value||'';
  document.querySelectorAll('.globalProductCard').forEach(card=>{
    const okQ=card.dataset.search.includes(q), okT=!t||card.dataset.type===t, okC=!cat||card.dataset.cat===cat;
    card.style.display=(okQ&&okT&&okC)?'':'none';
  });
}
function openGlobalProductPhoto(itemId){
  const d=seed(); const it=(d.items||[]).find(x=>x.id===itemId); if(!it||!it.photo) return;
  const c=(d.companies||[]).find(x=>x.id===it.companyId)||{};
  const html=`<div class="publicPhotoModal" id="globalPhotoModal" onclick="if(event.target.id==='globalPhotoModal')this.remove()"><div class="publicPhotoModalCard globalPhotoCard"><button class="publicPhotoClose" onclick="document.getElementById('globalPhotoModal')?.remove()">×</button><img src="${esc(it.photo)}" alt="${esc(it.name||'Produit')}"><h2>${esc(it.name||'Produit / service')}</h2><p><b>${esc(c.name||'Entreprise')}</b> — ${esc(it.cat||'Catégorie')}</p><p>${esc(it.marketplaceDesc||it.detail||'')}</p></div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}

function publicShopApplyFilters(){
  const query=String(document.getElementById('publicShopSearch')?.value||'').trim().toLowerCase();
  const category=String(document.getElementById('publicShopCategorySelect')?.value||'').trim().toLowerCase();
  const mode=String(window.publicShopCatalogMode||'all');
  const popularGroup=String(window.publicShopPopularGroup||'');
  const pageSize=16;
  const filterSignature=[query,category,mode,popularGroup].join('|');
  if(window.publicShopFilterSignature!==filterSignature){
    window.publicShopFilterSignature=filterSignature;
    window.publicShopPage=1;
  }
  const matching=[];
  document.querySelectorAll('.psProductCard').forEach(card=>{
    const matchesQuery=!query||String(card.dataset.search||'').includes(query);
    const matchesCategory=!category||String(card.dataset.category||'')===category;
    const matchesMode=mode==='all'||(mode==='promo'&&card.dataset.promo==='1')||(mode==='new'&&card.dataset.new==='1');
    const groups=String(card.dataset.groups||'').split(' ').filter(Boolean);
    const matchesPopular=!popularGroup||groups.includes(popularGroup);
    const matches=matchesQuery&&matchesCategory&&matchesMode&&matchesPopular;
    card.hidden=true;
    if(matches) matching.push(card);
  });
  const total=matching.length;
  const totalPages=Math.max(1,Math.ceil(total/pageSize));
  const page=Math.min(Math.max(1,Number(window.publicShopPage||1)),totalPages);
  window.publicShopPage=page;
  const start=(page-1)*pageSize;
  matching.slice(start,start+pageSize).forEach(card=>card.hidden=false);
  const shown=Math.max(0,Math.min(pageSize,total-start));
  const count=document.getElementById('publicShopResultCount');
  if(count) count.textContent=total?`${total} offre${total>1?'s':''} — ${start+1} à ${start+shown}`:'0 offre disponible';
  const empty=document.getElementById('publicShopEmptyState');
  if(empty) empty.hidden=total!==0;
  const pager=document.getElementById('publicShopPagination');
  const previous=document.getElementById('publicShopPrevious');
  const next=document.getElementById('publicShopNext');
  const pageLabel=document.getElementById('publicShopPageLabel');
  if(pager) pager.hidden=total<=pageSize;
  if(previous){previous.disabled=page<=1;previous.hidden=page<=1;}
  if(next){next.disabled=page>=totalPages;next.hidden=page>=totalPages;}
  if(pageLabel) pageLabel.textContent=`Page ${page} sur ${totalPages}`;
}
function publicShopChangePage(direction=1){
  window.publicShopPage=Math.max(1,Number(window.publicShopPage||1)+Number(direction||0));
  publicShopApplyFilters();
  document.getElementById('publicShopCatalog')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function publicShopSetCatalogMode(mode='all'){
  window.publicShopCatalogMode=mode;
  window.publicShopPopularGroup='';
  const status=document.getElementById('publicShopActiveFilter');
  if(status) status.textContent=mode==='promo'?'Promotions':(mode==='new'?'Nouveautés':'Toutes les catégories');
  document.querySelectorAll('.psNavLink').forEach(btn=>btn.classList.toggle('active',btn.dataset.mode===mode));
  publicShopApplyFilters();
  document.getElementById('publicShopCatalog')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function publicShopChooseCategory(category=''){
  window.publicShopCatalogMode='all';
  window.publicShopPopularGroup='';
  const select=document.getElementById('publicShopCategorySelect');
  if(select) select.value=category;
  document.querySelectorAll('.psNavLink').forEach(btn=>btn.classList.toggle('active',btn.dataset.mode==='all'));
  publicShopApplyFilters();
  document.getElementById('publicShopCatalog')?.scrollIntoView({behavior:'smooth',block:'start'});
  document.getElementById('publicShopCategoryMenu')?.classList.remove('open');
}
function publicShopChoosePopularGroup(group,label){
  window.publicShopCatalogMode='all';
  window.publicShopPopularGroup=group||'';
  const search=document.getElementById('publicShopSearch'); if(search) search.value='';
  const select=document.getElementById('publicShopCategorySelect'); if(select) select.value='';
  const status=document.getElementById('publicShopActiveFilter'); if(status) status.textContent=label?'Catégorie : '+label:'Toutes les catégories';
  document.querySelectorAll('.psNavLink').forEach(btn=>btn.classList.toggle('active',btn.dataset.mode==='all'));
  publicShopApplyFilters();
  document.getElementById('publicShopCatalog')?.scrollIntoView({behavior:'smooth',block:'start'});
}
function publicShopToggleCategoryMenu(){document.getElementById('publicShopCategoryMenu')?.classList.toggle('open')}
function publicShopScrollToCatalog(){document.getElementById('publicShopCatalog')?.scrollIntoView({behavior:'smooth',block:'start'})}

function renderPublicShop(slug){
  const d=seed();
  const decoded=decodeURIComponent(slug||'');
  const c=(d.companies||[]).find(x=>slugify(x.name)===decoded||x.shopSlug===decoded);
  if(!c){app.innerHTML=`<div class="loginPage"><div class="loginBox"><div class="loginLeft"><div class="logoG">GM</div><h1>Boutique introuvable</h1><p>Le lien public demandé n’existe pas encore.</p><button onclick="location.hash='';renderLogin()">Retour connexion</button></div></div></div>`;return;}
  if(!hasPlanFeature(c,'public_shop')){app.innerHTML=`<div class="loginPage"><div class="loginBox"><div class="loginLeft"><div class="logoG">GM</div><h1>Boutique publique non active</h1><p>Cette boutique publique n’est pas disponible.</p><button onclick="location.hash='';renderLogin()">Retour connexion</button></div></div></div>`;return;}

  const items=(d.items||[]).filter(i=>i.companyId===c.id&&!i.marketplaceHidden&&!(isBoutiqueItem(i)&&i.stockType!=='unlimited'&&Number(i.stock||0)<=0));
  const categories=[...new Set(items.map(i=>String(i.cat||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  const client=getPublicClient(c.id);
  const orders=(d.orders||[]).filter(o=>o.companyId===c.id&&!/annul|rembours/i.test(String(o.validation||o.delivery||o.status||'')));
  const clientsSatisfied=new Set(orders.map(o=>o.clientId||String(o.clientPhone||'')||String(o.client||'')).filter(Boolean)).size;
  const soldCount=orders.reduce((sum,o)=>sum+Math.max(1,Number(o.qty||orderItemsCount?.(o)||1)),0);
  const slogan=String(c.shopSlogan||c.activity||'Produits et services de qualité').trim();
  const shopColor=/^#[0-9a-f]{6}$/i.test(String(c.shopColor||''))?c.shopColor:'#003F35';
  const now=Date.now();

  const popularDefs=[
    {key:'phones',name:'Téléphones & Tablettes',icon:'📱',keywords:['telephone','téléphone','smartphone','tablette','mobile']},
    {key:'computing',name:'Informatique',icon:'💻',keywords:['informatique','ordinateur','laptop','imprimante','logiciel']},
    {key:'electronics',name:'Électronique',icon:'🎧',keywords:['electronique','électronique','audio','casque','tv','télévision']},
    {key:'home',name:'Maison & Cuisine',icon:'🏠',keywords:['maison','cuisine','ménage','meuble','electromenager','électroménager']},
    {key:'fashion',name:'Mode & Accessoires',icon:'👜',keywords:['mode','vêtement','vetement','accessoire','chaussure','pagne']},
    {key:'beauty',name:'Santé & Beauté',icon:'✨',keywords:['santé','sante','beauté','beaute','cosmétique','cosmetique']},
    {key:'food',name:'Alimentation',icon:'🛒',keywords:['alimentation','alimentaire','boisson','riz','poisson','nourriture']}
  ];
  const groupsFor=item=>{
    const text=(String(item.name||'')+' '+String(item.cat||'')+' '+String(item.marketplaceDesc||item.detail||'')).toLowerCase();
    return popularDefs.filter(def=>def.keywords.some(k=>text.includes(k))).map(def=>def.key);
  };
  const categoryCards=popularDefs.map(def=>{
    const matched=items.filter(i=>groupsFor(i).includes(def.key));
    const visual=matched.find(i=>i.photo)?.photo;
    return `<button type="button" class="psCategoryCard" data-group="${def.key}" onclick="publicShopChoosePopularGroup(this.dataset.group,this.dataset.label)" data-label="${esc(def.name)}"><span class="psCategoryVisual">${visual?`<img src="${esc(visual)}" alt="${esc(def.name)}">`:`<i>${def.icon}</i>`}</span><span><strong>${esc(def.name)}</strong><small>${matched.length} produit${matched.length>1?'s':''}</small></span><b>→</b></button>`;
  }).join('');

  const heroItems=items.filter(i=>i.photo).slice(0,5);
  const heroVisuals=heroItems.length?heroItems.map((i,index)=>`<figure class="psHeroProduct psHeroProduct${index+1}"><img src="${esc(i.photo)}" alt="${esc(i.name)}"><figcaption>${esc(i.name)}</figcaption></figure>`).join(''):`<div class="psFallbackProducts"><span>📱</span><span>🎧</span><span>🥤</span><span>📦</span><span>🛍️</span></div>`;

  const productCards=items.map((i,index)=>{
    const groups=groupsFor(i).join(' ');
    const created=Date.parse(i.createdAt||i.updatedAt||'');
    const isNew=(Number.isFinite(created)&&now-created<=45*86400000)||index<8;
    const isPromo=Boolean(String(i.marketplacePromo||'').trim());
    const search=(String(i.name||'')+' '+String(i.cat||'')+' '+String(i.marketplacePromo||'')+' '+String(i.marketplaceDesc||i.detail||'')).toLowerCase();
    return `<article class="psProductCard publicCard" data-type="${isBoutiqueItem(i)?'product':'service'}" data-category="${esc(String(i.cat||'').toLowerCase())}" data-search="${esc(search)}" data-promo="${isPromo?'1':'0'}" data-new="${isNew?'1':'0'}" data-groups="${groups}">
      <div class="psProductBadges"><span>${isBoutiqueItem(i)?'PRODUIT':'SERVICE'}</span>${isNew?'<span class="new">NOUVEAU</span>':''}${isPromo?`<span class="promo">${esc(i.marketplacePromo)}</span>`:''}</div>
      <button type="button" class="psProductImage" ${i.photo?`onclick="openPublicProductPhoto('${c.id}','${i.id}')" title="Agrandir la photo"`:''}>${mkProductVisual(i)}</button>
      <div class="psProductContent"><small>${esc(i.cat||'Offre')}</small><h3>${esc(i.name)}</h3><p>${esc(i.marketplaceDesc||i.detail||'Produit ou service disponible dans la boutique officielle.')}</p><div class="psProductMeta"><strong>${money(itemMarketPrice(i))}</strong><span>${marketStockLabel(i)}</span></div><button class="psAddCart" onclick="addToPublicCart('${c.id}','${i.id}')">🛒 Ajouter au panier</button></div>
    </article>`;
  }).join('');

  const categoryOptions=categories.map(cat=>`<option value="${esc(cat.toLowerCase())}">${esc(cat)}</option>`).join('');
  const categoryMenu=categories.map(cat=>`<button type="button" data-category="${esc(cat.toLowerCase())}" onclick="publicShopChooseCategory(this.dataset.category)">${esc(cat)}</button>`).join('')||'<span>Aucune catégorie publiée</span>';

  app.innerHTML=`<div class="publicShop publicShopPremium" style="--ps-company:${esc(shopColor)}">
    <header class="psMainHeader">
      <div class="psHeaderInner">
        <button type="button" class="psBrand" onclick="publicShopScrollToCatalog()" aria-label="Accueil boutique">
          <span class="psBrandLogo" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M15 23h34l-3 30H18l-3-30Z"/><path d="M24 26v-7a8 8 0 0 1 16 0v7"/><rect x="27" y="33" width="10" height="10" rx="2"/><path d="M30 33v-3a2 2 0 0 1 4 0v3"/></svg></span>
          <span><strong>${esc(c.name)}</strong><small>${esc(slogan)}</small></span>
        </button>
        <div class="psSearchBar">
          <input id="publicShopSearch" type="search" placeholder="Rechercher un produit, une marque…" oninput="publicShopApplyFilters()" aria-label="Rechercher dans la boutique">
          <select id="publicShopCategorySelect" onchange="publicShopChooseCategory(this.value)" aria-label="Choisir une catégorie"><option value="">Toutes catégories</option>${categoryOptions}</select>
          <button type="button" onclick="publicShopApplyFilters()" aria-label="Lancer la recherche">⌕</button>
        </div>
        <div class="psHeaderActions">
          <button type="button" class="psAccountAction" onclick="${client?`openClientSpace('${c.id}')`:`openClientRegisterPopup('${c.id}')`}"><span>👤</span><span><small>${client?'Bienvenue':'Connexion'}</small><strong>${client?esc(client.name):'Mon compte'}</strong></span></button>
          <button type="button" class="psCartAction" onclick="openPublicCart('${c.id}')"><span>🛒</span><span><small>Votre</small><strong>Panier</strong></span><b id="publicCartBadge">${publicCartCount(c.id)}</b></button>
        </div>
      </div>
    </header>

    <nav class="psNavigation">
      <div class="psNavInner">
        <div class="psCategoryMenuWrap"><button type="button" class="psAllCategories" onclick="publicShopToggleCategoryMenu()">☰ Toutes catégories <span>⌄</span></button><div id="publicShopCategoryMenu" class="psCategoryMenu"><button type="button" onclick="publicShopChooseCategory('')">Toutes les catégories</button>${categoryMenu}</div></div>
        <button type="button" class="psNavLink active" data-mode="all" onclick="publicShopSetCatalogMode('all')">Toutes catégories</button>
        <button type="button" class="psNavLink" data-mode="promo" onclick="publicShopSetCatalogMode('promo')">Promotions</button>
        <button type="button" class="psNavLink" data-mode="new" onclick="publicShopSetCatalogMode('new')">Nouveautés</button>
        <button type="button" class="psNavSupport" onclick="location.hash='boutique-global';render()">Boutique GLOBAL MARKET</button>
      </div>
    </nav>

    <main class="psPage">
      <section class="psHero">
        <div class="psHeroCopy"><span class="psWelcomeBadge">BIENVENUE CHEZ ${esc(c.name).toUpperCase()}</span><h1>La qualité au meilleur prix</h1><p>Découvrez des produits et services sélectionnés pour répondre à vos besoins, avec une commande simple et sécurisée.</p><div class="psHeroButtons"><button onclick="publicShopScrollToCatalog()">Découvrir la boutique</button><button class="outline" onclick="publicShopSetCatalogMode('promo')">Voir les promotions</button></div><div class="psHeroProof"><span>✓ Paiement sécurisé</span><span>✓ Service client disponible</span><span>✓ Produits vérifiés</span></div></div>
        <div class="psHeroScene"><div class="psSatisfaction">SATISFACTION<strong>100 %</strong><small>GARANTIE</small></div><div class="psCartIllustration"><span class="cart">🛒</span>${heroVisuals}<div class="psCompanyBag"><span>🛍️</span><strong>${esc(c.name)}</strong></div></div></div>
      </section>

      <section class="psPopularSection"><div class="psSectionHeading"><div><span></span><div><small>NOS UNIVERS</small><h2>Catégories populaires</h2></div></div><button onclick="publicShopChooseCategory('')">Voir toutes les catégories →</button></div><div class="psCategoryGrid">${categoryCards}</div></section>

      <section id="publicShopCatalog" class="psCatalogSection"><div class="psSectionHeading"><div><span></span><div><small>BOUTIQUE OFFICIELLE</small><h2>Produits et services disponibles</h2></div></div><div class="psCatalogStatus"><span id="publicShopActiveFilter">Toutes les catégories</span><strong id="publicShopResultCount">${items.length} offre${items.length>1?'s':''} disponible${items.length>1?'s':''}</strong></div></div><div class="psProductGrid">${productCards}</div><div id="publicShopEmptyState" class="psEmptyState" ${items.length?'hidden':''}><span>🔎</span><h3>Aucun résultat</h3><p>Modifiez votre recherche ou choisissez une autre catégorie.</p><button onclick="document.getElementById('publicShopSearch').value='';publicShopChooseCategory('')">Afficher toutes les offres</button></div><nav id="publicShopPagination" class="psShopPagination" aria-label="Pagination de la boutique" hidden><button id="publicShopPrevious" type="button" class="previous" onclick="publicShopChangePage(-1)">← PRÉCÉDENT</button><span id="publicShopPageLabel">Page 1 sur 1</span><button id="publicShopNext" type="button" class="next" onclick="publicShopChangePage(1)">SUIVANT →</button></nav></section>

      <section class="psTrustStrip"><article><span>👥</span><div><strong>+${clientsSatisfied}</strong><small>Clients satisfaits</small></div></article><article><span>📦</span><div><strong>+${soldCount}</strong><small>Produits vendus</small></div></article><article><span>🕘</span><div><strong>24/7</strong><small>Service disponible</small></div></article><article><span>🛡️</span><div><strong>Garantie</strong><small>Satisfait ou accompagné</small></div></article></section>
    </main>
    <footer class="psFooter"><div><strong>${esc(c.name)}</strong><span>${esc(slogan)}</span></div><p>© ${new Date().getFullYear()} ${esc(c.name)} — Boutique propulsée par GLOBAL MARKET.</p></footer>
  </div>`;
  window.publicShopCatalogMode='all'; window.publicShopPopularGroup=''; window.publicShopPage=1; window.publicShopFilterSignature=''; publicShopApplyFilters();
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
  const img=i.photo?`<img src="${esc(i.photo)}" alt="${esc(i.name||'')}" class="stockMiniImg">`:'<div class="stockMiniImg stockMiniImgPlaceholder">📦</div>';
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
