/* Démarrage après chargement de tous les modules. */
window.addEventListener('error',e=>{
  const appNode=document.getElementById('app');
  if(!appNode) return;
  appNode.innerHTML='<div class="wrap"><div class="card"><h1>GLOBAL MARKET</h1><p>Une erreur a été détectée, mais la page n’est pas blanche.</p><pre>'+esc(e.message)+'</pre><button onclick="cloudStart()">Réessayer</button></div></div>';
});
cloudStart();
