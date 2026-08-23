import worker from '../public/_worker.js';

class MemoryKV {
  constructor(){this.map=new Map();}
  async get(key,type){const v=this.map.get(key); if(v===undefined)return null; if(type==='json'){try{return JSON.parse(v)}catch{return null}} return v;}
  async put(key,value){this.map.set(key,String(value));}
  async delete(key){this.map.delete(key);}
  async list({prefix=''}={}){const keys=[...this.map.keys()].filter(k=>k.startsWith(prefix)).sort().map(name=>({name}));return {keys,list_complete:true,cursor:''};}
}

class Prepared {
  constructor(db,sql){this.db=db;this.sql=sql.replace(/\s+/g,' ').trim();this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){return this.db.first(this.sql,this.args);}
  async all(){return this.db.all(this.sql,this.args);}
  async run(){return this.db.run(this.sql,this.args);}
}

class MemoryD1 {
  constructor(){
    this.meta=new Map(); this.chunks=new Map(); this.backups=[]; this.events=[]; this.backupId=0;
    this.companyMeta=new Map(); this.snapshots=[]; this.tables=new Map(); this.checkoutRequests=new Map();
  }
  prepare(sql){return new Prepared(this,sql);}
  async batch(stmts){const out=[];for(const st of stmts)out.push(await st.run());return out;}
  table(name){if(!this.tables.has(name))this.tables.set(name,[]);return this.tables.get(name);}
  async first(sql,a){
    if(sql==='SELECT 1 AS ok')return {ok:1};
    if(sql.startsWith('SELECT (SELECT COUNT(*) FROM gm_items)'))return {items:this.table('gm_items').length,companies:this.table('gm_companies').length};
    if(sql.startsWith("SELECT value FROM gm_meta WHERE key='relational_schema_version'"))return null;
    if(sql.startsWith('SELECT value FROM gm_meta WHERE key=?'))return null;
    if(sql.startsWith('SELECT chunk_count FROM state_meta')){const r=this.meta.get(a[0]);return r?{chunk_count:r.chunk_count}:null;}
    if(sql.startsWith('SELECT data FROM backups')){const rows=this.backups.filter(r=>r.company_id===a[0]).sort((x,y)=>y.id-x.id);return rows[0]?{data:rows[0].data}:null;}
    if(sql.includes('FROM gm_company_storage_meta WHERE company_id = ?')){
      const r=this.companyMeta.get(a[0]); return r?{...r}:null;
    }
    if(sql.startsWith('SELECT checkout_id, status, revision, result_json, error_code, updated_at FROM gm_checkout_requests')){
      const r=this.checkoutRequests.get(`${a[0]}::${a[1]}`); return r?{...r}:null;
    }
    throw new Error('D1 first unsupported: '+sql);
  }
  async all(sql,a){
    if(sql.startsWith('PRAGMA table_info('))return {results:[]};
    if(sql.startsWith('SELECT data FROM state_chunks')){const rows=[...(this.chunks.get(a[0])||new Map()).entries()].sort((x,y)=>x[0]-y[0]).map(([,data])=>({data}));return {results:rows};}
    let m=sql.match(/^SELECT entity_id, data FROM (gm_[a-z_]+) WHERE company_id = \? AND snapshot_id = \?/);
    if(m){return {results:this.table(m[1]).filter(r=>r.company_id===a[0]&&r.snapshot_id===a[1]).sort((x,y)=>String(x.entity_id).localeCompare(String(y.entity_id))).map(r=>({entity_id:r.entity_id,data:r.data}))};}
    if(sql.startsWith('SELECT setting_key, data FROM gm_company_settings')){
      return {results:this.table('gm_company_settings').filter(r=>r.company_id===a[0]&&r.snapshot_id===a[1]).sort((x,y)=>x.setting_key.localeCompare(y.setting_key)).map(r=>({setting_key:r.setting_key,data:r.data}))};
    }
    if(sql.startsWith('SELECT entity_type, entity_id, chunk_index, data FROM gm_large_record_chunks')){
      return {results:this.table('gm_large_record_chunks').filter(r=>r.company_id===a[0]&&r.snapshot_id===a[1]).sort((x,y)=>x.entity_type.localeCompare(y.entity_type)||x.entity_id.localeCompare(y.entity_id)||x.chunk_index-y.chunk_index).map(r=>({...r}))};
    }
    if(sql.startsWith('SELECT snapshot_id FROM gm_company_snapshots')){
      return {results:this.snapshots.filter(r=>r.company_id===a[0]).sort((x,y)=>y.revision-x.revision).map(r=>({snapshot_id:r.snapshot_id}))};
    }
    throw new Error('D1 all unsupported: '+sql);
  }
  async run(sql,a){
    if(sql.startsWith('CREATE TABLE')||sql.startsWith('CREATE INDEX')||sql.startsWith('CREATE UNIQUE INDEX')||sql.startsWith('CREATE TRIGGER'))return {success:true,meta:{changes:0}};
    if(sql.startsWith("INSERT INTO gm_meta(key,value,updated_at) VALUES('relational_schema_version'"))return {success:true,meta:{changes:1}};
    if(sql.startsWith('DELETE FROM state_chunks')){this.chunks.delete(a[0]);return {success:true,meta:{changes:1}};}
    if(sql.startsWith('DELETE FROM state_meta')){this.meta.delete(a[0]);return {success:true,meta:{changes:1}};}
    if(sql.startsWith('DELETE FROM backups WHERE company_id = ? AND id NOT IN')){const id=a[0];const keep=this.backups.filter(r=>r.company_id===id).sort((x,y)=>y.id-x.id).slice(0,20).map(r=>r.id);this.backups=this.backups.filter(r=>r.company_id!==id||keep.includes(r.id));return {success:true,meta:{changes:0}};}
    if(sql==='DELETE FROM backups WHERE company_id = ?'){this.backups=this.backups.filter(r=>r.company_id!==a[0]);return {success:true,meta:{changes:1}};}
    if(sql.startsWith('INSERT INTO state_meta')){this.meta.set(a[0],{chunk_count:a[1],size_bytes:a[2],updated_at:a[3]});return {success:true,meta:{changes:1}};}
    if(sql.startsWith('INSERT INTO state_chunks')){if(!this.chunks.has(a[0]))this.chunks.set(a[0],new Map());this.chunks.get(a[0]).set(a[1],a[2]);return {success:true,meta:{changes:1}};}
    if(sql.startsWith('INSERT INTO backups')){this.backups.push({id:++this.backupId,company_id:a[0],data:a[1],created_at:a[2]});return {success:true,meta:{changes:1}};}
    if(sql.startsWith('INSERT INTO security_events')){this.events.push(a);return {success:true,meta:{changes:1}};}

    if(sql.startsWith('INSERT OR IGNORE INTO gm_checkout_requests')){
      const key=`${a[0]}::${a[1]}`;
      if(this.checkoutRequests.has(key)) return {success:true,meta:{changes:0}};
      this.checkoutRequests.set(key,{company_id:a[0],idempotency_key:a[1],checkout_id:a[2],cashier_id:a[3],status:'processing',revision:0,result_json:'',error_code:'',created_at:a[4],updated_at:a[5]});
      return {success:true,meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE gm_checkout_requests SET checkout_id = ?')){
      const key=`${a[6]}::${a[7]}`; const current=this.checkoutRequests.get(key);
      if(!current) return {success:true,meta:{changes:0}};
      Object.assign(current,{checkout_id:a[0],status:a[1],revision:a[2],result_json:a[3],error_code:a[4],updated_at:a[5]});
      return {success:true,meta:{changes:1}};
    }
    if(sql.startsWith('DELETE FROM gm_checkout_requests WHERE company_id = ?')){
      let changes=0; for(const key of [...this.checkoutRequests.keys()]) if(key.startsWith(`${a[0]}::`)){this.checkoutRequests.delete(key);changes++;}
      return {success:true,meta:{changes}};
    }

    if(sql.startsWith('INSERT INTO gm_company_storage_meta')){
      if(!this.companyMeta.has(a[0]))this.companyMeta.set(a[0],{revision:0,snapshot_id:'',storage_version:a[1],updated_at:a[2]});
      return {success:true,meta:{changes:1}};
    }
    if(sql.startsWith('INSERT INTO gm_company_snapshots')){
      this.snapshots.push({company_id:a[0],snapshot_id:a[1],revision:a[2],status:a[3],created_at:a[4]});
      return {success:true,meta:{changes:1}};
    }
    let m=sql.match(/^INSERT INTO (gm_[a-z_]+)\(company_id, snapshot_id, entity_id, data, updated_at\)/);
    if(m){this.table(m[1]).push({company_id:a[0],snapshot_id:a[1],entity_id:a[2],data:a[3],updated_at:a[4]});return {success:true,meta:{changes:1}};}
    if(sql.startsWith('INSERT INTO gm_company_settings')){this.table('gm_company_settings').push({company_id:a[0],snapshot_id:a[1],setting_key:a[2],data:a[3],updated_at:a[4]});return {success:true,meta:{changes:1}};}
    if(sql.startsWith('INSERT INTO gm_large_record_chunks')){this.table('gm_large_record_chunks').push({company_id:a[0],snapshot_id:a[1],entity_type:a[2],entity_id:a[3],chunk_index:a[4],data:a[5]});return {success:true,meta:{changes:1}};}
    if(sql.startsWith('UPDATE gm_company_storage_meta SET revision = ?')){
      const current=this.companyMeta.get(a[4]);
      if(!current||Number(current.revision)!==Number(a[5]))return {success:true,meta:{changes:0}};
      this.companyMeta.set(a[4],{revision:a[0],snapshot_id:a[1],storage_version:a[2],updated_at:a[3]});
      return {success:true,meta:{changes:1}};
    }
    if(sql.startsWith("UPDATE gm_company_snapshots SET status = 'archived'")){
      let changes=0;for(const r of this.snapshots)if(r.company_id===a[0]&&r.status==='active'){r.status='archived';changes++;}return {success:true,meta:{changes}};
    }
    if(sql.startsWith("UPDATE gm_company_snapshots SET status = 'active'")){
      let changes=0;for(const r of this.snapshots)if(r.company_id===a[0]&&r.snapshot_id===a[1]){r.status='active';changes++;}return {success:true,meta:{changes}};
    }
    m=sql.match(/^DELETE FROM (gm_[a-z_]+) WHERE company_id = \? AND snapshot_id = \?/);
    if(m){const rows=this.table(m[1]);const before=rows.length;this.tables.set(m[1],rows.filter(r=>!(r.company_id===a[0]&&r.snapshot_id===a[1])));return {success:true,meta:{changes:before-this.table(m[1]).length}};}
    m=sql.match(/^DELETE FROM (gm_[a-z_]+) WHERE company_id = \?$/);
    if(m){const rows=this.table(m[1]);const before=rows.length;this.tables.set(m[1],rows.filter(r=>r.company_id!==a[0]));return {success:true,meta:{changes:before-this.table(m[1]).length}};}
    if(sql.startsWith('DELETE FROM gm_company_snapshots WHERE company_id = ? AND snapshot_id = ?')){const before=this.snapshots.length;this.snapshots=this.snapshots.filter(r=>!(r.company_id===a[0]&&r.snapshot_id===a[1]));return {success:true,meta:{changes:before-this.snapshots.length}};}
    if(sql.startsWith('DELETE FROM gm_company_snapshots WHERE company_id = ?')){const before=this.snapshots.length;this.snapshots=this.snapshots.filter(r=>r.company_id!==a[0]);return {success:true,meta:{changes:before-this.snapshots.length}};}
    if(sql.startsWith('DELETE FROM gm_company_storage_meta WHERE company_id = ?')){const changed=this.companyMeta.delete(a[0])?1:0;return {success:true,meta:{changes:changed}};}
    throw new Error('D1 run unsupported: '+sql);
  }
}

function makeEnv(){return {
  GLOBAL_MARKET_KV:new MemoryKV(), GLOBAL_MARKET_D1:new MemoryD1(),
  SUPER_ADMIN_EMAIL:'super@example.test', SUPER_ADMIN_INITIAL_PASSWORD:'StrongPass@123', SUPER_ADMIN_PASSWORD_VERSION:'1',
  ASSETS:{fetch:async()=>new Response('asset')}
};}
const env=makeEnv();
const origin='https://example.test';
async function api(path,{method='GET',body,cookie,csrf,targetEnv=env}={}){
  const headers={Origin:origin,'CF-Connecting-IP':'203.0.113.5'};
  if(body!==undefined)headers['Content-Type']='application/json'; if(cookie)headers.Cookie=cookie; if(csrf)headers['X-CSRF-Token']=csrf;
  const req=new Request(origin+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const res=await worker.fetch(req,targetEnv); const json=await res.json();
  return {res,json,cookie:res.headers.get('set-cookie')?.split(';')[0]||cookie};
}
function assert(cond,msg){if(!cond)throw new Error(msg);}

const health0=await api('/api/health');
assert(health0.res.ok,'health failed');
assert(health0.json.storageVersion===7,'storage version must be 7');
assert(health0.json.storageMode==='transactional-checkout-v7','transactional checkout mode missing');

const reg1=await api('/api/register-company',{method:'POST',body:{name:'Entreprise A',email:'a@example.test',password:'AdminA@12345',owner:'A',businessType:'boutique'}});
assert(reg1.res.status===201,`register A failed: ${JSON.stringify(reg1.json)}`);
const csrf1=reg1.json.session.csrfToken; const company1=reg1.json.data.companies[0].id;
const staleData=structuredClone(reg1.json.data);
staleData.items.push({id:'item-a',companyId:company1,name:'Produit A',sell:100,stock:10,photo:'x'.repeat(450000)});
const save1=await api('/api/save',{method:'POST',body:{data:staleData},cookie:reg1.cookie,csrf:csrf1});
assert(save1.res.ok,`save A failed: ${JSON.stringify(save1.json)}`);
assert(save1.json.revision===2,'A revision should be 2');
assert(env.GLOBAL_MARKET_D1.table('gm_products').some(r=>r.company_id===company1),'A product row missing');
assert(env.GLOBAL_MARKET_D1.table('gm_large_record_chunks').some(r=>r.company_id===company1&&r.entity_type==='items'),'large product chunks missing');
assert(!env.GLOBAL_MARKET_KV.map.has(`state:company:v5:${company1}`),'new company state must not be written as a large KV JSON');

const duplicateStale=structuredClone(staleData);
duplicateStale.items.push({id:'item-a-stale',companyId:company1,name:'Ancien état',sell:1,stock:1});
const conflict=await api('/api/save',{method:'POST',body:{data:duplicateStale},cookie:reg1.cookie,csrf:csrf1});
assert(conflict.res.status===409,'stale save must be rejected');
assert(conflict.json.code==='COMPANY_DATA_CONFLICT','wrong conflict code');


// Encaissement transactionnel : idempotence et concurrence sur le dernier article.
const checkoutSeed=structuredClone((await api('/api/load',{cookie:reg1.cookie})).json);
const currentRev=Number(checkoutSeed.app.storageRevision||0);
const productA=checkoutSeed.items.find(i=>i.id==='item-a'); productA.stock=1; productA.stockType='limited';
checkoutSeed.sales.push(
  {id:'cart-line-1',companyId:company1,userId:reg1.json.session.userId,itemId:'item-a',name:'Produit A',qty:1,unit:100,total:100,clientsServed:1,saleKind:'boutique',saleStatus:'cart',status:'cart',cartPending:true,date:new Date().toISOString()},
  {id:'cart-line-2',companyId:company1,userId:reg1.json.session.userId,itemId:'item-a',name:'Produit A',qty:1,unit:100,total:100,clientsServed:1,saleKind:'boutique',saleStatus:'cart',status:'cart',cartPending:true,date:new Date().toISOString()}
);
const cartSave=await api('/api/save',{method:'POST',body:{data:checkoutSeed},cookie:reg1.cookie,csrf:csrf1});
assert(cartSave.res.ok,'cart seed save failed');
const checkoutRevision=cartSave.json.revision;
const checkoutBody={expectedRevision:checkoutRevision,client:{type:'particulier',name:'Client Test',phone:'0102030405'},cartLineIds:['cart-line-1'],idempotencyKey:'checkout:test:stable:0001'};
const checkout1=await api('/api/cart/checkout',{method:'POST',body:checkoutBody,cookie:reg1.cookie,csrf:csrf1});
assert(checkout1.res.ok,`checkout failed: ${JSON.stringify(checkout1.json)}`);
assert(checkout1.json.checkoutId&&checkout1.json.revision===checkoutRevision+1,'checkout revision/number missing');
const replay=await api('/api/cart/checkout',{method:'POST',body:checkoutBody,cookie:reg1.cookie,csrf:csrf1});
assert(replay.res.ok&&replay.json.replayed===true,'idempotent replay must succeed without duplicate sale');
const afterCheckout=await api('/api/load',{cookie:reg1.cookie});
assert(afterCheckout.json.items.find(i=>i.id==='item-a').stock===0,'stock must be decremented exactly once');
assert(afterCheckout.json.sales.filter(s=>s.checkoutId===checkout1.json.checkoutId).length===1,'checkout must validate exactly one cart line');

const competingBody={expectedRevision:checkoutRevision,client:{type:'particulier',name:'Concurrent'},cartLineIds:['cart-line-2'],idempotencyKey:'checkout:test:concurrent:0002'};
const competing=await api('/api/cart/checkout',{method:'POST',body:competingBody,cookie:reg1.cookie,csrf:csrf1});
assert(competing.res.status===409,'stale concurrent checkout must be rejected');
const afterCompeting=await api('/api/load',{cookie:reg1.cookie});
assert(afterCompeting.json.items.find(i=>i.id==='item-a').stock===0,'concurrent checkout must never create negative stock');
assert(afterCompeting.json.sales.find(s=>s.id==='cart-line-2').cartPending===true,'rejected cart line must remain pending');
console.log('[test-checkout] OK - encaissement serveur idempotent, stock décrémenté une seule fois, concurrence refusée.');

// Deux caissiers concurrents sur le dernier article disponible.
const createCashier1=await api('/api/users/create',{method:'POST',body:{name:'Caisse Un',email:'caisse1@example.test',password:'Caisse1@Secure',role:'caisse',caisseStartTime:'00:00',caisseEndTime:'23:59'},cookie:reg1.cookie,csrf:csrf1});
const createCashier2=await api('/api/users/create',{method:'POST',body:{name:'Caisse Deux',email:'caisse2@example.test',password:'Caisse2@Secure',role:'caisse',caisseStartTime:'00:00',caisseEndTime:'23:59'},cookie:reg1.cookie,csrf:csrf1});
assert(createCashier1.res.status===201&&createCashier2.res.status===201,'cashier creation failed');
const cashier1=await api('/api/login',{method:'POST',body:{email:'caisse1@example.test',password:'Caisse1@Secure',role:'caisse'}});
const cashier2=await api('/api/login',{method:'POST',body:{email:'caisse2@example.test',password:'Caisse2@Secure',role:'caisse'}});
assert(cashier1.res.ok&&cashier2.res.ok,'cashier login failed');
const raceSeed=structuredClone((await api('/api/load',{cookie:reg1.cookie})).json);
raceSeed.items.push({id:'item-race',companyId:company1,name:'Dernier produit',sell:500,stock:1,stockType:'limited',type:'boutique'});
raceSeed.sales.push(
  {id:'race-line-1',companyId:company1,userId:createCashier1.json.user.id,itemId:'item-race',name:'Dernier produit',qty:1,unit:500,total:500,clientsServed:1,saleKind:'boutique',saleStatus:'cart',status:'cart',cartPending:true,date:new Date().toISOString()},
  {id:'race-line-2',companyId:company1,userId:createCashier2.json.user.id,itemId:'item-race',name:'Dernier produit',qty:1,unit:500,total:500,clientsServed:1,saleKind:'boutique',saleStatus:'cart',status:'cart',cartPending:true,date:new Date().toISOString()}
);
const raceSave=await api('/api/save',{method:'POST',body:{data:raceSeed},cookie:reg1.cookie,csrf:csrf1});
assert(raceSave.res.ok,'race seed save failed');
const raceRevision=raceSave.json.revision;
const racePayload1={expectedRevision:raceRevision,client:{type:'particulier',name:'Client Caisse 1'},cartLineIds:['race-line-1'],idempotencyKey:'checkout:cashier:race:0001'};
const racePayload2={expectedRevision:raceRevision,client:{type:'particulier',name:'Client Caisse 2'},cartLineIds:['race-line-2'],idempotencyKey:'checkout:cashier:race:0002'};
const [race1,race2]=await Promise.all([
  api('/api/cart/checkout',{method:'POST',body:racePayload1,cookie:cashier1.cookie,csrf:cashier1.json.session.csrfToken}),
  api('/api/cart/checkout',{method:'POST',body:racePayload2,cookie:cashier2.cookie,csrf:cashier2.json.session.csrfToken})
]);
const raceStatuses=[race1.res.status,race2.res.status].sort((a,b)=>a-b);
assert(raceStatuses[0]===200&&raceStatuses[1]===409,`exactly one cashier must succeed: ${raceStatuses}`);
const raceAfter=await api('/api/load',{cookie:reg1.cookie});
assert(raceAfter.json.items.find(i=>i.id==='item-race').stock===0,'last stock must end at zero');
const raceLines=raceAfter.json.sales.filter(s=>s.id==='race-line-1'||s.id==='race-line-2');
assert(raceLines.filter(s=>s.cartPending===false).length===1,'exactly one cashier sale must be validated');
assert(raceLines.filter(s=>s.cartPending===true).length===1,'the losing cashier cart must remain pending');
console.log('[test-checkout] OK - deux caissiers concurrents : une seule vente validée, aucun stock négatif.');

const reg2=await api('/api/register-company',{method:'POST',body:{name:'Entreprise B',email:'b@example.test',password:'AdminB@12345',owner:'B',businessType:'service'}});
assert(reg2.res.status===201,`register B failed: ${JSON.stringify(reg2.json)}`);
const company2=reg2.json.data.companies[0].id;
const data2=structuredClone(reg2.json.data); data2.items.push({id:'item-b',companyId:company2,name:'Service B',sell:200,type:'service'});
const save2=await api('/api/save',{method:'POST',body:{data:data2},cookie:reg2.cookie,csrf:reg2.json.session.csrfToken});
assert(save2.res.ok,'save B failed');

const load1=await api('/api/load',{cookie:reg1.cookie});
assert(load1.res.ok,'load A failed');
assert(load1.json.companies.length===1&&load1.json.companies[0].id===company1,'A sees wrong company');
assert(load1.json.items.some(i=>i.id==='item-a'),'A item missing');
assert(load1.json.items.find(i=>i.id==='item-a').photo.length===450000,'large record not reconstructed');
assert(!load1.json.items.some(i=>i.id==='item-b'),'A must not see B item');
const load2=await api('/api/load',{cookie:reg2.cookie});
assert(load2.json.items.some(i=>i.id==='item-b'),'B item missing');
assert(!load2.json.items.some(i=>i.id==='item-a'),'B must not see A item');
assert(env.GLOBAL_MARKET_D1.companyMeta.has(company1)&&env.GLOBAL_MARKET_D1.companyMeta.has(company2),'normalized metadata missing');
assert(env.GLOBAL_MARKET_KV.map.has('state:catalog:v5'),'catalog key missing');
console.log('[test-isolation] OK - stockage D1 normalisé, gros enregistrements découpés, conflits refusés, entreprises isolées.');

// Migration automatique depuis l'ancien état global.
const legacyEnv=makeEnv();
const legacyA='ent_legacy_a', legacyB='ent_legacy_b';
await legacyEnv.GLOBAL_MARKET_KV.put('company:global_market_all',JSON.stringify({
  companies:[{id:legacyA,name:'Legacy A',status:'FREE',createdAt:'2026-01-01T00:00:00.000Z'},{id:legacyB,name:'Legacy B',status:'BUSINESS',createdAt:'2026-01-02T00:00:00.000Z'}],
  users:[{id:'usr_legacy_a',companyId:legacyA,name:'Admin A',email:'legacy-a@example.test',role:'admin',status:'active'},{id:'usr_legacy_b',companyId:legacyB,name:'Admin B',email:'legacy-b@example.test',role:'admin',status:'active'}],
  items:[{id:'legacy-item-a',companyId:legacyA,name:'A'},{id:'legacy-item-b',companyId:legacyB,name:'B'}],
  sales:[],payments:[],orders:[],clients:[],marketClients:[],passwordResetRequests:[],app:{name:'GLOBAL MARKET',storageVersion:4}
}));
const migratedHealth=await api('/api/health',{targetEnv:legacyEnv});
assert(migratedHealth.res.ok,'legacy migration health failed');
assert(migratedHealth.json.isolatedCompanies===2,'legacy companies not migrated');
assert(legacyEnv.GLOBAL_MARKET_D1.companyMeta.has(legacyA)&&legacyEnv.GLOBAL_MARKET_D1.companyMeta.has(legacyB),'legacy normalized snapshots missing');
assert(legacyEnv.GLOBAL_MARKET_D1.table('gm_products').some(r=>r.company_id===legacyA),'legacy A product row missing');
assert(legacyEnv.GLOBAL_MARKET_KV.map.has('company:global_market_all'),'legacy backup key must be preserved');
assert(!legacyEnv.GLOBAL_MARKET_KV.map.has(`state:company:v5:${legacyA}`),'migration must not create a new large company KV JSON');
console.log('[test-isolation] OK - migration automatique vers les tables D1 normalisées vérifiée.');
