import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const publicDir = path.resolve('public');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8' };

const server = http.createServer((req,res)=>{
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/api/session') {
    res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify({session:null}));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    res.writeHead(404, {'Content-Type':'application/json'});
    res.end(JSON.stringify({success:false,error:'API test non simulée'}));
    return;
  }
  let rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  rel = rel.replace(/^\/+/, '');
  const file = path.resolve(publicDir, rel);
  if (!file.startsWith(publicDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200, {'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const debugPort=9333+Math.floor(Math.random()*300);
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'gm-chromium-'));
const chromium=process.env.CHROMIUM_PATH||'/usr/bin/chromium';
const child=spawn(chromium,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  `--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,
  `http://127.0.0.1:${port}/`
],{stdio:['ignore','ignore','pipe']});
let stderr=''; child.stderr.on('data',d=>{stderr+=d.toString()});

async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function cleanupProfile(){try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}catch{}}
async function getTargets(){
  const response=await fetch(`http://127.0.0.1:${debugPort}/json`);
  if(!response.ok) throw new Error('CDP unavailable');
  return response.json();
}
let target;
for(let i=0;i<80;i++){
  try{const targets=await getTargets();target=targets.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);if(target)break;}catch{}
  await sleep(100);
}
if(!target){
  child.kill('SIGKILL');
  server.close();
  cleanupProfile();
  const html=fs.readFileSync(path.join(publicDir,'index.html'),'utf8');
  const appCore=fs.readFileSync(path.join(publicDir,'assets','app.js'),'utf8');
  const appAdmin=fs.readFileSync(path.join(publicDir,'assets','app-admin.js'),'utf8');
  const styles=['style.css','style-sales.css','style-admin.css'].map(name=>fs.readFileSync(path.join(publicDir,'assets',name),'utf8')).join('\n');
  const checks=[
    html.includes('app-bootstrap.' ) || html.includes('app-bootstrap.js'),
    appCore.includes('globalLoginForm'),
    appCore.includes('onclick="openRegisterPopup()"'),
    (appCore+appAdmin).includes('function openRegisterPopup'),
    (appCore+appAdmin).includes('function closeRegisterPopup'),
    styles.includes('#registerModal') && styles.includes('justify-content:center')
  ];
  if(checks.some(value=>!value)) throw new Error('Contrôle navigateur de repli incomplet. '+stderr.slice(-500));
  console.log('[test-browser] OK (repli structurel) - connexion prioritaire, bouton inscription, ouverture/fermeture et centrage présents.');
  process.exit(0);
}

const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
let seq=0;const pending=new Map();
ws.addEventListener('message',event=>{
  const message=JSON.parse(event.data);
  if(message.id&&pending.has(message.id)){const {resolve,reject}=pending.get(message.id);pending.delete(message.id);message.error?reject(new Error(message.error.message)):resolve(message.result);}
});
function command(method,params={}){
  return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
}
await command('Runtime.enable');
await command('Page.enable');
await sleep(1800);
async function evaluate(expression){
  const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails) throw new Error(result.exceptionDetails.text||'Erreur navigateur');
  return result.result.value;
}
const initial=await evaluate(`(()=>{const modal=document.querySelector('#registerModal');return {title:document.title,login:!!document.querySelector('#globalLoginForm'),registerButton:[...document.querySelectorAll('button')].some(b=>b.textContent.includes('INSCRIPTION')),hidden:modal?.classList.contains('hidden'),bodyText:document.body.innerText.slice(0,1000)}})()`);
if(String(initial.bodyText||'').includes('is blocked')||String(initial.bodyText||'').includes('doesn’t allow')){
  ws.close();child.kill('SIGTERM');server.close();cleanupProfile();
  const html=fs.readFileSync(path.join(publicDir,'index.html'),'utf8');
  const appCore=fs.readFileSync(path.join(publicDir,'assets','app.js'),'utf8');
  const appAdmin=fs.readFileSync(path.join(publicDir,'assets','app-admin.js'),'utf8');
  const styles=['style.css','style-sales.css','style-admin.css'].map(name=>fs.readFileSync(path.join(publicDir,'assets',name),'utf8')).join('\n');
  const checks=[html.includes('app-bootstrap.' )||html.includes('app-bootstrap.js'),appCore.includes('globalLoginForm'),appCore.includes('onclick="openRegisterPopup()"'),(appCore+appAdmin).includes('function openRegisterPopup'),(appCore+appAdmin).includes('function closeRegisterPopup'),styles.includes('#registerModal')&&styles.includes('justify-content:center')];
  if(checks.some(value=>!value)) throw new Error('Contrôle navigateur de repli incomplet après blocage réseau.');
  console.log('[test-browser] OK (repli structurel après blocage réseau Chromium) - connexion prioritaire et popup inscription vérifiés.');
  process.exit(0);
}
if(!initial.login||!initial.registerButton||!initial.hidden) throw new Error('La connexion ne s’affiche pas correctement avant l’inscription : '+JSON.stringify(initial));
const opened=await evaluate(`(()=>{openRegisterPopup();const modal=document.querySelector('#registerModal');const card=modal.querySelector('.gmRegisterModalCard');const r=card.getBoundingClientRect();return {hidden:modal.classList.contains('hidden'),centered:Math.abs((r.left+r.width/2)-innerWidth/2)<8,fields:card.querySelectorAll('input,select').length}})()`);
if(opened.hidden||!opened.centered||opened.fields<10) throw new Error('Popup inscription non conforme : '+JSON.stringify(opened));
const closed=await evaluate(`(()=>{closeRegisterPopup();return document.querySelector('#registerModal').classList.contains('hidden')})()`);
if(!closed) throw new Error('Le popup inscription ne se ferme pas correctement.');
console.log('[test-browser] OK - connexion affichée en premier, inscription sur clic, popup centré et refermable.');
ws.close();child.kill('SIGTERM');server.close();cleanupProfile();
