/* ═══════════════════════════════════════════════════════════════════
   RENAISSANCE — Scroll cinématique (parallax + reveal), vanilla, 0 dépendance
   - Parallax "Osmo-like" sur les images de fond (.card-media img, [data-cine-par])
   - Reveal doux à l'apparition ([data-cine-in], .cine-in)
   - Respecte prefers-reduced-motion. Neutralisé dans les WebViews in-app.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ua = navigator.userAgent || '';
  var inApp = /Instagram|FBAN|FBAV|FB_IAB|Snapchat|TikTok|BytedanceWebview|musical_ly/i.test(ua);
  if (reduce) return; // pas d'animation si l'utilisateur le demande

  /* ── Styles injectés ── */
  var css = document.createElement('style');
  css.textContent = [
    '[data-cine-par]{will-change:transform;transition:none;}',
    '.cine-in-init{opacity:0;transform:translateY(38px) scale(.985);}',
    '.cine-in-init.cine-vis{opacity:1;transform:none;transition:opacity 1.05s cubic-bezier(.16,1,.3,1),transform 1.05s cubic-bezier(.16,1,.3,1);}',
    '.cine-par-wrap{overflow:hidden;}'
  ].join('');
  document.head.appendChild(css);

  /* ── PARALLAX ──────────────────────────────────────────────────── */
  var pars = [];
  function collectParallax(){
    var targets = [];
    // Images de fond des cartes = les "couches" qui dérivent au scroll
    document.querySelectorAll('.card-media img, .card-media-rn img').forEach(function(img){ targets.push({el:img, amp:0.16}); });
    // Cibles explicites
    document.querySelectorAll('[data-cine-par]').forEach(function(el){
      targets.push({el:el, amp:parseFloat(el.getAttribute('data-cine-amp')||'0.18')});
    });
    targets.forEach(function(t){
      var el = t.el;
      if (el.__cinePar) return;
      el.__cinePar = true;
      el.setAttribute('data-cine-par','');
      // agrandit légèrement pour éviter les bords vides lors du décalage
      var host = el.closest('.card-media, .card-media-rn') || el.parentElement;
      if (host) host.classList.add('cine-par-wrap');
      el.style.transform = 'translate3d(0,0,0) scale(1.2)';
      el.style.willChange = 'transform';
      pars.push({el:el, amp:t.amp, host:host||el.parentElement});
    });
  }

  var vh = window.innerHeight || document.documentElement.clientHeight;
  function onResize(){ vh = window.innerHeight || document.documentElement.clientHeight; }

  var ticking = false;
  function updateParallax(){
    ticking = false;
    for (var i=0;i<pars.length;i++){
      var p = pars[i];
      var host = p.host;
      if (!host) continue;
      var r = host.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vh + 80) continue; // hors écran
      // progress -1 (bas) → 1 (haut), 0 au centre du viewport
      var center = r.top + r.height/2;
      var prog = (center - vh/2) / (vh/2 + r.height/2);
      var shift = -prog * p.amp * r.height; // dérive verticale
      p.el.style.transform = 'translate3d(0,'+shift.toFixed(2)+'px,0) scale(1.2)';
    }
  }
  function onScroll(){ if(!ticking){ ticking = true; requestAnimationFrame(updateParallax); } }

  /* ── REVEAL ────────────────────────────────────────────────────── */
  function collectReveal(){
    var els = document.querySelectorAll('[data-cine-in], .cine-in');
    if (!('IntersectionObserver' in window)){
      els.forEach(function(el){ el.classList.add('cine-vis'); }); return;
    }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting){ e.target.classList.add('cine-vis'); io.unobserve(e.target); }
      });
    }, {threshold:.12, rootMargin:'0px 0px -8% 0px'});
    els.forEach(function(el){ el.classList.add('cine-in-init'); io.observe(el); });
  }

  function init(){
    collectParallax();
    collectReveal();
    updateParallax();
    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', function(){ onResize(); updateParallax(); }, {passive:true});
    // re-scan si le DOM change (cartes ajoutées dynamiquement)
    if (window.MutationObserver){
      var mo = new MutationObserver(function(){ collectParallax(); });
      mo.observe(document.body, {childList:true, subtree:true});
      setTimeout(function(){ mo.disconnect(); }, 4000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
