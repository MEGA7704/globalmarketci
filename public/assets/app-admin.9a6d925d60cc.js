/* Module administration, stock et actions sécurisées — GLOBAL MARKET 4.2 */
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
  const st=stockDashboardStatus(i), s=stockStatsForItem(i,sales||[]), img=i.photo?`<img src="${esc(i.photo)}" alt="${esc(i.name||'Produit')}">`:'<span class="stockNoImg">📦</span>';
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
  const html=`<div class="modalBackdrop stockModalBackdrop" onclick="closeStockModal(event)"><div class="stockProModal stockDetailModal" onclick="event.stopPropagation()"><button class="modalClose" onclick="document.querySelector('.stockModalBackdrop')?.remove()">×</button><h2>Voir détails</h2><p class="sub">Informations détaillées du produit ou service sélectionné.</p><div class="stockDetailHero"><div class="stockProductImg big">${i.photo?`<img src="${esc(i.photo)}" alt="${esc(i.name||'Produit')}">`:'📦'}</div><div><h3>${esc(i.name||'')}</h3><span class="stockBadge ${st.cls}">${esc(st.label)}</span><p>${esc(i.detail||i.marketplaceDesc||'Aucune description.')}</p></div></div><div class="stockDetailGrid"><div><small>Code</small><b>${esc(i.code||'-')}</b></div><div><small>Catégorie</small><b>${esc(i.cat||'-')}</b></div><div><small>Quantité</small><b>${esc(st.qty)}</b></div><div><small>Prix d’achat</small><b>${isBoutiqueItem(i)?money(i.buy||0):'-'}</b></div><div><small>Prix de vente</small><b>${money(itemMarketPrice(i)||i.sell||0)}</b></div><div><small>Valeur du stock</small><b>${money(st.value)}</b></div><div><small>Bénéfice potentiel</small><b>${money(benefPotential)}</b></div><div><small>Bénéfice réalisé</small><b>${money(s.realized)}</b></div></div>${stockDetailMovementBlocks(i)}<h3>Historique des entrées</h3><table class="g2table"><tr><th>Date</th><th>Type</th><th>Quantité</th><th>Prix / motif</th><th>Fournisseur / note</th></tr>${stockMovementRows(i,'entry')}</table><h3>Historique des sorties</h3><table class="g2table"><tr><th>Date</th><th>Type</th><th>Quantité</th><th>Prix / motif</th><th>Fournisseur / note</th></tr>${stockMovementRows(i,'output')}</table><h3>Historique des ventes</h3><table class="g2table"><tr><th>Date</th><th>Client</th><th>Quantité</th><th>Total</th><th>Bénéfice</th></tr>${salesRows}</table><div class="modalActions"><button class="darkBtn" onclick="openStockItemPdfPage('${esc(i.id)}')">Imprimer</button><button class="btn2" onclick="document.querySelector('.stockModalBackdrop')?.remove()">Fermer</button></div></div></div>`;
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
    <div class="stockDetailHero"><div class="stockProductImg big">${i.photo?`<img src="${esc(i.photo)}" alt="${esc(i.name||'Produit')}">`:'📦'}</div><div><h3>${esc(i.name||'')}</h3><span class="stockBadge ${st.cls}">${esc(st.label)}</span><p>${esc(i.detail||i.marketplaceDesc||'Aucune description.')}</p></div></div>
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
  const r=await fetchWithTimeout(path,{method:'POST',headers:employeeSecurityHeaders(),body:JSON.stringify(payload)},15000);
  return readApiPayload(r);
}
async function securePublicPost(path,payload={}){
  const r=await fetchWithTimeout(path,{method:'POST',headers:clientSecurityHeaders(),body:JSON.stringify(payload)},15000);
  return readApiPayload(r);
}
function secureErrorMessage(error,fallback='Opération sécurisée impossible.'){
  if(error?.status===429) return error.message||'Trop de tentatives. Réessayez plus tard.';
  if(error?.code==='SETUP_REQUIRED') return 'Les secrets Cloudflare SUPER_ADMIN_EMAIL et SUPER_ADMIN_INITIAL_PASSWORD doivent être configurés avant la première connexion Super Admin.';
  return error?.message||fallback;
}
async function openGlobalShopLogin(){
  location.hash=GLOBAL_MARKET_LOGIN_LINKS.boutiqueHash;
  try{await cloudLoadPublicData()}catch(e){console.error(e);CLOUD_DATA=defaultData()}
  render();
}
async function login(){
  const identifier=($('#loginEmail')?.value||'').trim().toLowerCase();
  const password=$('#loginPass')?.value||'';
  const role=$('#loginRole')?.value||'caisse';
  setLoginMessage('','');
  if(!identifier){setLoginMessage('Le nom utilisateur ou l’e-mail est obligatoire.','error');$('#loginEmail')?.focus();return}
  if(!password){setLoginMessage('Le mot de passe est obligatoire.','error');$('#loginPass')?.focus();return}
  setLoginLoading(true);
  try{
    const r=await fetchWithTimeout('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier,password,role})},12000);
    const j=await readApiPayload(r);
    CLOUD_SESSION=j.session||null;
    if(j.data&&typeof j.data==='object'){
      CLOUD_DATA=normalizeData(j.data);
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
    render();
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
    renderLogin();
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
    if(invalidatesSelf){CLOUD_SESSION=null;CLOUD_DATA=defaultData();alert('Compte modifié. Pour votre sécurité, reconnectez-vous.');return renderLogin()}
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
    await cloudLoadPublicData(); document.getElementById('clientLoginModal')?.remove(); openClientSpace(companyId);
  }catch(e){alert(secureErrorMessage(e,'Téléphone ou mot de passe incorrect.'))}
}
async function logoutPublicClient(companyId){
  try{await fetchWithTimeout('/api/public/client/session',{method:'DELETE',headers:clientSecurityHeaders()},6000)}catch(e){}
  PUBLIC_CLIENT_SESSION=null; window.publicShopClientId=''; await cloudLoadPublicData();
  const c=(seed().companies||[]).find(x=>x.id===companyId); renderPublicShop(c?.shopSlug||'');
}
async function finalizePublicCartPayment(companyId,method){
  const client=getPublicClient(companyId),cart=getPublicCart(companyId);
  if(!client) return openClientRegisterPopup(companyId); if(!cart.length) return alert('Panier vide.');
  const payOnDelivery=method==='PAY_ON_DELIVERY';
  const transactionId=payOnDelivery?'':(($('#publicTransactionId')?.value||'').trim());
  if(!payOnDelivery&&!transactionId) return alert('Veuillez inscrire l’ID ou la référence de la transaction.');
  const submit=document.getElementById('publicOrderSubmitBtn');
  if(submit?.disabled) return;
  const oldLabel=submit?.textContent||'';
  if(submit){submit.disabled=true;submit.textContent='ENREGISTREMENT EN COURS…';}
  try{
    await securePublicPost('/api/public/order',{
      companyId,
      cart:cart.map(x=>({itemId:x.itemId,qty:Number(x.qty||1)})),
      paymentChoice:payOnDelivery?'delivery':'now',
      paymentMethod:method,
      transactionId,
      paymentProofType:payOnDelivery?'none':'transaction_id',
      paymentRef:transactionId
    });
    cart.length=0; refreshPublicCartBadge(companyId); await cloudLoadPublicData(); showOrderSentModal(companyId);
  }catch(e){
    alert(secureErrorMessage(e,'Envoi de la commande impossible.'));
    if(submit){submit.disabled=false;submit.textContent=oldLabel;}
  }
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
