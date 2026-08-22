const base=(process.argv[2]||process.env.GLOBAL_MARKET_URL||'').replace(/\/$/,'');
const key=process.argv[3]||process.env.V6_MIGRATION_KEY||'';
if(!base||!key){console.error('Usage: node scripts/migrate-v6.mjs https://votre-site.pages.dev VOTRE_CLE_MIGRATION');process.exit(1)}
const status=await fetch(base+'/api/v6/migration-status',{headers:{'Cache-Control':'no-store'}}).then(r=>r.json()).catch(()=>null);
console.log('[V6] état avant migration:',status);
if(status?.ready){console.log('[V6] migration déjà terminée.');process.exit(0)}
const r=await fetch(base+'/api/v6/migrate',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:'{}'});
const j=await r.json().catch(()=>({}));
if(!r.ok){console.error('[V6] échec migration:',j);process.exit(1)}
console.log('[V6] migration terminée:',j);
const health=await fetch(base+'/api/health',{headers:{'Cache-Control':'no-store'}}).then(r=>r.json()).catch(()=>null);
console.log('[V6] santé:',health);
if(!health?.relationalV6){console.error('[V6] le mode relationnel n’est pas actif.');process.exit(1)}
