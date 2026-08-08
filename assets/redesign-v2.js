/* ═══════════════════════════════════════════════════════════════════
   RENAISSANCE — MOTEUR D'ANIMATION V2 « Cinématique 4D »
   Additif & défensif : ne touche AUCUNE logique métier (diagnostic,
   Supabase, paiement Revolut, admin/CRM). Se greffe sur le markup existant.

   Techniques : cinematic-gsap-lenis-motion-system, staggered-word-reveal,
   masked-reveal, reveal-hover-effect (skills MengTo).

   Règles de sûreté :
     · Réutilise le Lenis existant (window.__lenis) ; n'en crée un que s'il
       manque ET que window.Lenis est présent.
     · N'anime jamais le contenu des overlays plein écran (diagnostic, admin,
       CRM, galaxy-intro, geo-consent).
     · Respecte prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;

  function ready(fn){
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* Zones à NE JAMAIS animer (overlays / logique / canvases WebGL). */
  var SKIP = '#diagOverlay,#galaxy-intro,#geo-consent-card,#vfiches-ov,' +
             '[role="dialog"],canvas,.gi-loading,.gl-diamond';
  function inSkip(el){ return !!(el && el.closest && el.closest(SKIP)); }

  ready(function(){
    var gsap = window.gsap;
    var hasGSAP = !!(gsap && window.ScrollTrigger);
    if (hasGSAP){
      gsap.registerPlugin(window.ScrollTrigger);
      gsap.defaults({ ease:'power3.out', duration:.9 });
    }

    /* ── 1) SMOOTH SCROLL : réutilise l'existant, sinon en crée un ─────── */
    if (hasGSAP && !reduce && !window.__lenis && window.Lenis){
      try{
        var lenis = new window.Lenis({
          duration:1.15, smoothWheel:true,
          easing:function(t){ return Math.min(1, 1.001 - Math.pow(2,-10*t)); }
        });
        lenis.on('scroll', window.ScrollTrigger.update);
        gsap.ticker.add(function(time){ lenis.raf(time*1000); });
        gsap.ticker.lagSmoothing(0);
        window.__lenis = lenis;
        window.__lenisKill  = function(){ try{ lenis.destroy(); }catch(e){} window.__lenis=null; };
        window.__lenisBuild = function(){};
        document.addEventListener('click', function(e){
          var a = e.target.closest('a[href^="#"]'); if(!a) return;
          var href = a.getAttribute('href'); if(!href || href.length<2) return;
          var t = document.querySelector(href); if(!t) return;
          e.preventDefault(); lenis.scrollTo(t, { offset:-10, duration:1.2 });
        });
      }catch(e){}
    }

    if (!hasGSAP){ document.documentElement.classList.remove('rv2-ready'); return; }
    if (reduce){ return; }

    document.documentElement.classList.add('rv2-ready');
    var ST = window.ScrollTrigger;

    /* Sur index.html, cine-gsap.js gère déjà les reveals de .sec-t / .carte-fp
       et le word-splitting. On saute donc nos reveals pour éviter le double
       ciblage, et on ne garde QUE les ajouts non-conflictuels (parallax,
       magnétique, tilt, curseur). Sur les autres pages (pas de cine), on
       exécute nos reveals complets. */
    var doReveals = !window.__cine;

    /* ── 2) WORD REVEAL sur titres à texte pur (sans markup interne) ──── */
    function splitWords(el){
      if (el.dataset.rv2Split) return null;
      var text = el.textContent || '';
      var parts = text.split(/(\s+)/);
      el.textContent = '';
      el.setAttribute('aria-label', text.trim());
      parts.forEach(function(p){
        if (!p.trim()){ el.appendChild(document.createTextNode(p)); return; }
        var mask = document.createElement('span'); mask.className = 'rv2-mask'; mask.setAttribute('aria-hidden','true');
        var w = document.createElement('span'); w.className = 'rv2-word'; w.textContent = p;
        mask.appendChild(w); el.appendChild(mask);
      });
      el.dataset.rv2Split = '1';
      return el.querySelectorAll('.rv2-word');
    }

    var titleSel = '.cine-hero__title,.hero-name,.zyra-title,.sec-t';
    if (doReveals) gsap.utils.toArray(titleSel).forEach(function(el){
      if (inSkip(el)) return;
      // markup interne (ex : .sec-t avec <b> doré) → reveal du bloc entier
      if (el.children.length){
        el.setAttribute('data-rv2','');
        gsap.set(el,{ autoAlpha:0 });
        gsap.fromTo(el,
          { yPercent:14, autoAlpha:0, filter:'blur(10px)' },
          { yPercent:0, autoAlpha:1, filter:'blur(0px)', duration:1.05, ease:'power4.out',
            scrollTrigger:{ trigger:el, start:'top 86%', once:true } });
        return;
      }
      var words = splitWords(el);
      if (!words || !words.length) return;
      el.setAttribute('data-rv2','');
      gsap.set(el,{ autoAlpha:1 });
      gsap.fromTo(words,
        { yPercent:115, autoAlpha:0, filter:'blur(8px)' },
        { yPercent:0, autoAlpha:1, filter:'blur(0px)', duration:.95, ease:'power4.out',
          stagger:.05, scrollTrigger:{ trigger:el, start:'top 84%', once:true } });
    });

    /* ── 3) STAGGER REVEAL : cartes & blocs de contenu des sections ───── */
    if (doReveals) gsap.utils.toArray('.section.dossier').forEach(function(sec){
      if (inSkip(sec)) return;
      var items = Array.prototype.filter.call(
        sec.querySelectorAll('.carte-fp,.fp-card,p,li,figure,blockquote,.faq-item,.step,.pilier,.retour,.chip'),
        function(el){ return !inSkip(el) && !el.closest('.sec-t') && el.offsetParent !== null; }
      ).slice(0, 40);
      if (!items.length) return;
      items.forEach(function(el){ el.setAttribute('data-rv2',''); });
      gsap.set(items,{ autoAlpha:0 });
      gsap.fromTo(items,
        { y:34, autoAlpha:0, filter:'blur(6px)' },
        { y:0, autoAlpha:1, filter:'blur(0px)', duration:.9, ease:'power4.out',
          stagger:.06, scrollTrigger:{ trigger:sec, start:'top 78%', once:true } });
    });

    /* ── 4) PARALLAX de profondeur (feeling « 4D ») ──────────────────── */
    function parallax(el, speed){
      if (inSkip(el)) return;
      gsap.to(el, { yPercent:speed, ease:'none',
        scrollTrigger:{ trigger:el.closest('section')||el, start:'top bottom', end:'bottom top',
          scrub:1.2, invalidateOnRefresh:true } });
    }
    var heroBg = document.querySelector('.cine-hero__bg');
    if (heroBg) parallax(heroBg, 18);
    gsap.utils.toArray('[data-parallax]').forEach(function(el){
      parallax(el, Number(el.getAttribute('data-parallax')) || 12);
    });

    /* ── 5) MAGNETIC + tilt 4D + halo suiveur ────────────────────────── */
    if (!coarse){
      gsap.utils.toArray('.btn-fp,.nav-diag,.cta,.gi-cta,.offer-cta').forEach(function(el){
        if (inSkip(el) && !el.closest('#galaxy-intro')) return;
        var xTo = gsap.quickTo(el,'x',{ duration:.45, ease:'power3.out' });
        var yTo = gsap.quickTo(el,'y',{ duration:.45, ease:'power3.out' });
        el.addEventListener('pointermove', function(ev){
          var r = el.getBoundingClientRect();
          xTo((ev.clientX - r.left - r.width/2) * .28);
          yTo((ev.clientY - r.top - r.height/2) * .28);
        });
        el.addEventListener('pointerleave', function(){ xTo(0); yTo(0); });
      });

      gsap.utils.toArray('.carte-fp,.fp-card').forEach(function(card){
        if (inSkip(card)) return;
        var rxTo = gsap.quickTo(card,'rotationX',{ duration:.5, ease:'power3.out' });
        var ryTo = gsap.quickTo(card,'rotationY',{ duration:.5, ease:'power3.out' });
        card.addEventListener('pointermove', function(ev){
          var r = card.getBoundingClientRect();
          var px = (ev.clientX - r.left)/r.width, py = (ev.clientY - r.top)/r.height;
          ryTo((px - .5) * 8); rxTo((.5 - py) * 8);
          card.style.setProperty('--mx', (px*100)+'%');
          card.style.setProperty('--my', (py*100)+'%');
        });
        card.addEventListener('pointerleave', function(){ rxTo(0); ryTo(0); });
      });
    }

    /* ── 6) CURSEUR cinématique ──────────────────────────────────────── */
    if (!coarse && !reduce){
      var cur = document.createElement('div'); cur.id = 'rv2-cursor';
      var dot = document.createElement('div'); dot.id = 'rv2-cursor-dot';
      document.body.appendChild(cur); document.body.appendChild(dot);
      var cxTo = gsap.quickTo(cur,'x',{ duration:.35, ease:'power3.out' });
      var cyTo = gsap.quickTo(cur,'y',{ duration:.35, ease:'power3.out' });
      var dxTo = gsap.quickTo(dot,'x',{ duration:.12, ease:'power3.out' });
      var dyTo = gsap.quickTo(dot,'y',{ duration:.12, ease:'power3.out' });
      document.addEventListener('pointermove', function(ev){
        cxTo(ev.clientX); cyTo(ev.clientY); dxTo(ev.clientX); dyTo(ev.clientY);
      }, { passive:true });
      document.addEventListener('pointerover', function(ev){
        var hot = ev.target.closest('a,button,[role="button"],.carte-fp,input,textarea');
        cur.classList.toggle('is-hot', !!hot);
      }, { passive:true });
    }

    /* ── 7) MOUSE-PARALLAX très subtil sur le hero (couches de profondeur) */
    if (!coarse){
      var hero = document.querySelector('.cine-hero');
      if (hero){
        var layers = hero.querySelectorAll('.cine-hero__title,.cine-hero__sub,.cine-hero__cta,.hero-name');
        var setters = Array.prototype.map.call(layers, function(l,i){
          return { xTo:gsap.quickTo(l,'x',{duration:.9,ease:'power3.out'}),
                   yTo:gsap.quickTo(l,'y',{duration:.9,ease:'power3.out'}),
                   d:(i+1)*.010 };
        });
        hero.addEventListener('pointermove', function(ev){
          var r = hero.getBoundingClientRect();
          var x = ev.clientX - r.left - r.width/2, y = ev.clientY - r.top - r.height/2;
          setters.forEach(function(s){ s.xTo(x*s.d); s.yTo(y*s.d); });
        }, { passive:true });
      }
    }

    /* ── 8) Rafraîchissements après fonts / images / layout ──────────── */
    window.addEventListener('load', function(){ ST.refresh(); });
    if (document.fonts && document.fonts.ready){ document.fonts.ready.then(function(){ ST.refresh(); }); }
    setTimeout(function(){ ST.refresh(); }, 1200);
  });
})();
