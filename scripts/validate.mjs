import fs from 'node:fs';
const fail=m=>{console.error('[validate V6] '+m);process.exit(1)};
const required=['public/index.html','public/assets/app.js','public/assets/style.css','public/_worker.js','public/_routes.json','wrangler.json','cloudflare/schema-v6.sql','realtime-worker/src/index.js','realtime-worker/wrangler.json','wrangler.pages-with-realtime.json','scripts/migrate-v6.mjs','README_MIGRATION_V6.md'];
for(const f of required)if(!fs.existsSync(f))fail('Fichier obligatoire absent : '+f);
const app=fs.readFileSync('public/assets/app.js','utf8'),worker=fs.readFileSync('public/_worker.js','utf8'),schema=fs.readFileSync('cloudflare/schema-v6.sql','utf8'),rt=fs.readFileSync('realtime-worker/src/index.js','utf8'),wr=JSON.parse(fs.readFileSync('wrangler.json','utf8')),wrRt=JSON.parse(fs.readFileSync('wrangler.pages-with-realtime.json','utf8')),rtwr=JSON.parse(fs.readFileSync('realtime-worker/wrangler.json','utf8'));
try{new Function(app)}catch(e){console.error(e);fail('JavaScript navigateur invalide')}
for(const x of ['gm_companies','gm_items','gm_orders','gm_order_items','gm_market_messages','idx_gm_orders_client','idx_gm_orders_company_status','trg_gm_items_nonnegative_stock'])if(!schema.includes(x))fail('Schéma D1 incomplet : '+x);
for(const x of ['V6_SCHEMA_VERSION','v6MigrateLegacy','withSession','X-D1-Bookmark','handleV6Catalog','LIMIT ? OFFSET ?','handleV6ClientOrders','handleV6AdminOrders','REALTIME_HUB','GLOBAL_MARKET_MEDIA','handleV6AdminMarketplaceSnapshot'])if(!worker.includes(x))fail('Worker V6 incomplet : '+x);
for(const x of ['/api/v6/bootstrap','/api/v6/catalog','GM_V6_D1_BOOKMARK','new WebSocket','gmV6ConnectRealtime','gmV6RefreshAdminMarketplace'])if(!app.includes(x))fail('Client V6 incomplet : '+x);
if(!wr.d1_databases?.some(x=>x.binding==='GLOBAL_MARKET_D1'))fail('Binding D1 absent');
if(!wr.kv_namespaces?.some(x=>x.binding==='GLOBAL_MARKET_KV'))fail('Binding KV absent');
if(!wr.r2_buckets?.some(x=>x.binding==='GLOBAL_MARKET_MEDIA'))fail('Binding R2 absent');
if(wr.durable_objects?.bindings?.some(x=>x.name==='REALTIME_HUB'))fail('wrangler.json doit rester déployable avant la création du Worker temps réel');
if(!wrRt.durable_objects?.bindings?.some(x=>x.name==='REALTIME_HUB'&&x.script_name==='global-market-realtime'))fail('Configuration WebSocket optionnelle absente');
if(!rt.includes('acceptWebSocket')||!rt.includes('getWebSockets')||!rt.includes('serializeAttachment'))fail('WebSocket Hibernation incomplet');
if(!rtwr.migrations?.some(x=>x.new_sqlite_classes?.includes('RealtimeHub')))fail('Migration Durable Object absente');
const routes=JSON.parse(fs.readFileSync('public/_routes.json','utf8'));if(!routes.include?.includes('/api/*'))fail('Routes Pages API invalides');
console.log('[validate V6.0.1] OK — Pages déployable sans dépendance externe; D1 relationnel, pagination SQL, R2 et WebSocket Durable Object optionnel présents.');
