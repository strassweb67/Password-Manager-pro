/* ═══════════════════════════════════════════════════════════════════
   RENAISSANCE — Boules chromées dans les boutons
   Injecte, dans chaque bouton d'action, quelques billes métallisées
   (mêmes que l'écran de chargement) qui bougent en continu, sur un léger
   flou iOS. Couvre aussi les boutons créés dynamiquement (funnel, CRM).
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var SEL = '.btn-fp, .ch-btn, .nav-diag, .gi-cta';
  var CLS = ['bo-1','bo-2','bo-3','bo-4'];

  function seed(btn){
    if (!btn || btn.__orbs) return;
    // ne pas injecter dans un bouton minuscule (icônes)
    var r = btn.getBoundingClientRect();
    if (r.width && r.width < 74) return;
    btn.__orbs = true;
    btn.classList.add('has-orbs');
    var wrap = document.createElement('span');
    wrap.className = 'btn-orbs';
    wrap.setAttribute('aria-hidden','true');
    var n = r.width > 220 ? 5 : 4;
    for (var i=0;i<n;i++){
      var o = document.createElement('i');
      o.className = 'btn-orb ' + CLS[i % CLS.length];
      var s = 11 + (i*4) % 13;                 // 11–24px
      o.style.width = o.style.height = s + 'px';
      o.style.left = (6 + (i*29) % 82) + '%';
      o.style.top  = (10 + (i*37) % 62) + '%';
      o.style.animationDelay = (-(i*1.9)).toFixed(1) + 's';
      wrap.appendChild(o);
    }
    btn.insertBefore(wrap, btn.firstChild);
  }

  function run(){
    try { document.querySelectorAll(SEL).forEach(seed); } catch(e){}
  }

  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run);
  window.addEventListener('load', run);
  setTimeout(run, 1500);

  // boutons créés dynamiquement (tunnel diagnostic, CRM…)
  if (window.MutationObserver){
    var mo = new MutationObserver(function(muts){
      for (var i=0;i<muts.length;i++){
        if (muts[i].addedNodes && muts[i].addedNodes.length){ run(); return; }
      }
    });
    var start = function(){ if (document.body) mo.observe(document.body, { childList:true, subtree:true }); };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  }
})();
