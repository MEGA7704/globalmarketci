import worker from '../public/_worker.js';

class MemoryKV {
  constructor(){this.map=new Map();}
  async get(key,type){const v=this.map.get(key); if(v===undefined)return null; if(type==='json'){try{return JSON.parse(v)}catch{return null}} return v;}
  async put(key,value){this.map.set(key,String(value));}
  async delete(key){this.map.delete(key);}
  async list({prefix='',cursor}={}){const keys=[...this.map.keys()].filter(k=>k.startsWith(prefix)).sort().map(name=>({name}));return {keys,list_complete:true,cursor:''};}
}

class Prepared {
  constructor(db,sql){this.db=db;this.sql=sql.replace(/\s+/g,' ').trim();this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){return this.db.first(this.sql,this.args);}
  async all(){return this.db.all(this.sql,this.args);}
  async run(){return this.db.run(this.sql,this.args);}
}
class MemoryD1 {
  constructor(){this.meta=new Map();this.chunks=new Map();this.backups=[];this.events=[];this.backupId=0;}
  prepare(sql){return new Prepared(this,sql);}
  async batch(stmts){const out=[];for(const st of stmts)out.push(await st.run());return out;}
  async first(sql,a){
    if(sql.startsWith('SELECT chunk_count FROM state_meta')){const r=this.meta.get(a[0]);return r?{chunk_count:r.chunk_count}:null;}
    if(sql.startsWith('SELECT data FROM backups')){const rows=this.backups.filter(r=>r.company_id===a[0]).sort((x,y)=>y.id-x.id);return rows[0]?{data:rows[0].data}:null;}
    throw new Error('D1 first unsupported: '+sql);
  }
  async all(sql,a){
    if(sql.startsWith('SELECT data FROM state_chunks')){const rows=[...(this.chunks.get(a[0])||new Map()).entries()].sort((x,y)=>x[0]-y[0]).map(([,data])=>({data}));return {results:rows};}
    throw new Error('D1 all unsupported: '+sql);
  }
  async run(sql,a){
    if(sql.startsWith('CREATE TABLE')||sql.startsWith('CREATE INDEX'))return {success:true,meta:{changes:0}};
    if(sql.startsWith('DELETE FROM state_chunks')){this.chunks.delete(a[0]);return {success:true,meta:{changes:1}};}
    if(sql.startsWith('DELETE FROM state_meta')){this.meta.delete(a[0]);return {success:true,meta:{changes:1}};}
    if(sql.startsWith('DELETE FROM backups WHERE company_id = ? AND id NOT IN')){const id=a[0];const keep=this.backups.filter(r=>r.company_id===id).sort((x,y)=>y.id-x.id).slice(0,20).map(r=>r.id);this.backups=this.backups.filter(r=>r.company_id!==id||keep.includes(r.id));return {success:true,meta:{changes:0}};}
    if(sql==='DELETE FROM backups WHERE company_id = ?'){this.backups=this.backups.filter(r=>r.company_id!==a[0]);return {success:true,meta:{changes:1}};}
    if(sql.startsWith('INSERT INTO state_meta')){this.meta.set(a[0],{chunk_count:a[1],size_bytes:a[2],updated_at:a[3]});return {success:true,meta:{changes:1}};}
    if(sql.startsWith('INSERT INTO state_chunks')){if(!this.chunks.has(a[0]))this.chunks.set(a[0],new Map());this.chunks.get(a[0]).set(a[1],a[2]);return {success:true,meta:{changes:1}};}
    if(sql.startsWith('INSERT INTO backups')){this.backups.push({id:++this.backupId,company_id:a[0],data:a[1],created_at:a[2]});return {success:true,meta:{changes:1}};}
    if(sql.startsWith('INSERT INTO security_events')){this.events.push(a);return {success:true,meta:{changes:1}};}
    throw new Error('D1 run unsupported: '+sql);
  }
}

const env={
  GLOBAL_MARKET_KV:new MemoryKV(),
  GLOBAL_MARKET_D1:new MemoryD1(),
  SUPER_ADMIN_EMAIL:'super@example.test',
  SUPER_ADMIN_INITIAL_PASSWORD:'StrongPass@123',
  SUPER_ADMIN_PASSWORD_VERSION:'1',
  ASSETS:{fetch:async()=>new Response('asset')}
};
const origin='https://example.test';
async function api(path,{method='GET',body,cookie,csrf}={}){
  const headers={Origin:origin,'CF-Connecting-IP':'203.0.113.5'};
  if(body!==undefined)headers['Content-Type']='application/json';
  if(cookie)headers.Cookie=cookie;
  if(csrf)headers['X-CSRF-Token']=csrf;
  const req=new Request(origin+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const res=await worker.fetch(req,env);
  const json=await res.json();
  return {res,json,cookie:res.headers.get('set-cookie')?.split(';')[0]||cookie};
}
function assert(cond,msg){if(!cond)throw new Error(msg);}

const health0=await api('/api/health');
assert(health0.res.ok,'health failed');
assert(health0.json.storageVersion===5,'storage version must be 5');

const reg1=await api('/api/register-company',{method:'POST',body:{name:'Entreprise A',email:'a@example.test',password:'AdminA@12345',owner:'A',businessType:'boutique'}});
assert(reg1.res.status===201,`register A failed: ${JSON.stringify(reg1.json)}`);
const csrf1=reg1.json.session.csrfToken;
const company1=reg1.json.data.companies[0].id;
const staleData=structuredClone(reg1.json.data);
staleData.items.push({id:'item-a',companyId:company1,name:'Produit A',sell:100,stock:10});
const save1=await api('/api/save',{method:'POST',body:{data:staleData},cookie:reg1.cookie,csrf:csrf1});
assert(save1.res.ok,`save A failed: ${JSON.stringify(save1.json)}`);
assert(save1.json.revision===2,'A revision should be 2');

const duplicateStale=structuredClone(staleData);
duplicateStale.items.push({id:'item-a-stale',companyId:company1,name:'Ancien état',sell:1,stock:1});
const conflict=await api('/api/save',{method:'POST',body:{data:duplicateStale},cookie:reg1.cookie,csrf:csrf1});
assert(conflict.res.status===409,'stale save must be rejected');
assert(conflict.json.code==='COMPANY_DATA_CONFLICT','wrong conflict code');

const reg2=await api('/api/register-company',{method:'POST',body:{name:'Entreprise B',email:'b@example.test',password:'AdminB@12345',owner:'B',businessType:'service'}});
assert(reg2.res.status===201,`register B failed: ${JSON.stringify(reg2.json)}`);
const company2=reg2.json.data.companies[0].id;
const data2=structuredClone(reg2.json.data);
data2.items.push({id:'item-b',companyId:company2,name:'Service B',sell:200,type:'service'});
const save2=await api('/api/save',{method:'POST',body:{data:data2},cookie:reg2.cookie,csrf:reg2.json.session.csrfToken});
assert(save2.res.ok,'save B failed');

const load1=await api('/api/load',{cookie:reg1.cookie});
assert(load1.res.ok,'load A failed');
assert(load1.json.companies.length===1&&load1.json.companies[0].id===company1,'A sees wrong company');
assert(load1.json.items.some(i=>i.id==='item-a'),'A item missing');
assert(!load1.json.items.some(i=>i.id==='item-b'),'A must not see B item');

const load2=await api('/api/load',{cookie:reg2.cookie});
assert(load2.json.items.some(i=>i.id==='item-b'),'B item missing');
assert(!load2.json.items.some(i=>i.id==='item-a'),'B must not see A item');

assert(env.GLOBAL_MARKET_KV.map.has(`state:company:v5:${company1}`),'A isolated KV key missing');
assert(env.GLOBAL_MARKET_KV.map.has(`state:company:v5:${company2}`),'B isolated KV key missing');
assert(env.GLOBAL_MARKET_KV.map.has('state:catalog:v5'),'catalog key missing');

const health=await api('/api/health');
assert(health.json.isolatedCompanies===2,'health company count wrong');
console.log('[test-isolation] OK - 2 entreprises isolées, conflit obsolète refusé, données séparées.');

// Vérification de la migration automatique depuis l'ancien état global.
const legacyEnv={
  GLOBAL_MARKET_KV:new MemoryKV(),
  GLOBAL_MARKET_D1:new MemoryD1(),
  SUPER_ADMIN_EMAIL:'super@example.test',
  SUPER_ADMIN_INITIAL_PASSWORD:'StrongPass@123',
  SUPER_ADMIN_PASSWORD_VERSION:'1',
  ASSETS:{fetch:async()=>new Response('asset')}
};
const legacyA='ent_legacy_a';
const legacyB='ent_legacy_b';
await legacyEnv.GLOBAL_MARKET_KV.put('company:global_market_all',JSON.stringify({
  companies:[
    {id:legacyA,name:'Legacy A',status:'FREE',createdAt:'2026-01-01T00:00:00.000Z'},
    {id:legacyB,name:'Legacy B',status:'BUSINESS',createdAt:'2026-01-02T00:00:00.000Z'}
  ],
  users:[
    {id:'usr_legacy_a',companyId:legacyA,name:'Admin A',email:'legacy-a@example.test',role:'admin',status:'active'},
    {id:'usr_legacy_b',companyId:legacyB,name:'Admin B',email:'legacy-b@example.test',role:'admin',status:'active'}
  ],
  items:[
    {id:'legacy-item-a',companyId:legacyA,name:'A'},
    {id:'legacy-item-b',companyId:legacyB,name:'B'}
  ],
  sales:[],payments:[],orders:[],clients:[],marketClients:[],passwordResetRequests:[],
  app:{name:'GLOBAL MARKET',storageVersion:4}
}));
async function legacyApi(path){
  const req=new Request(origin+path,{headers:{Origin:origin,'CF-Connecting-IP':'203.0.113.6'}});
  const res=await worker.fetch(req,legacyEnv);
  return {res,json:await res.json()};
}
const migratedHealth=await legacyApi('/api/health');
assert(migratedHealth.res.ok,'legacy migration health failed');
assert(migratedHealth.json.isolatedCompanies===2,'legacy companies not migrated');
assert(legacyEnv.GLOBAL_MARKET_KV.map.has(`state:company:v5:${legacyA}`),'legacy A shard missing');
assert(legacyEnv.GLOBAL_MARKET_KV.map.has(`state:company:v5:${legacyB}`),'legacy B shard missing');
assert(legacyEnv.GLOBAL_MARKET_KV.map.has('company:global_market_all'),'legacy backup key must be preserved');
const migratedA=JSON.parse(await legacyEnv.GLOBAL_MARKET_KV.get(`state:company:v5:${legacyA}`));
assert(migratedA.items.length===1&&migratedA.items[0].id==='legacy-item-a','legacy A data mixed');
assert(!migratedA.items.some(item=>item.companyId===legacyB),'legacy B leaked into A');
console.log('[test-isolation] OK - migration automatique de l’ancien état global vérifiée.');
