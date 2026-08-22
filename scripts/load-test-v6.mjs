const base=(process.argv[2]||process.env.GLOBAL_MARKET_URL||'').replace(/\/$/,'');
const concurrency=Math.max(1,Math.min(1000,Number(process.argv[3]||50)));
const requests=Math.max(concurrency,Math.min(20000,Number(process.argv[4]||concurrency*5)));
if(!base){console.error('Usage: node scripts/load-test-v6.mjs https://votre-site.pages.dev [concurrence] [requêtes]');process.exit(1)}
const times=[];let ok=0,fail=0,next=0;const errors=new Map();
async function one(i){const start=performance.now();try{const page=(i%8)+1;const r=await fetch(`${base}/api/v6/catalog?page=${page}&pageSize=16`,{headers:{'Cache-Control':'no-cache'}});const body=await r.text();if(!r.ok)throw new Error(`${r.status} ${body.slice(0,160)}`);ok++;times.push(performance.now()-start)}catch(e){fail++;const k=String(e.message||e);errors.set(k,(errors.get(k)||0)+1)}}
async function worker(){while(true){const i=next++;if(i>=requests)return;await one(i)}}
console.log(`[load-test] ${requests} requêtes, concurrence ${concurrency}`);const t0=performance.now();await Promise.all(Array.from({length:Math.min(concurrency,requests)},worker));const elapsed=performance.now()-t0;times.sort((a,b)=>a-b);const pct=p=>times.length?times[Math.min(times.length-1,Math.floor(times.length*p))]:0;
console.log(JSON.stringify({ok,fail,errorRate:requests?fail/requests:0,elapsedMs:Math.round(elapsed),requestsPerSecond:Number((requests/(elapsed/1000)).toFixed(2)),p50Ms:Math.round(pct(.50)),p95Ms:Math.round(pct(.95)),p99Ms:Math.round(pct(.99)),errors:[...errors.entries()].slice(0,10)},null,2));
if(fail)process.exitCode=2;
