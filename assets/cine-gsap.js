/* ═══════════════════════════════════════════════════════════════════
   RENAISSANCE — Scroll cinématique PRO (GSAP + ScrollTrigger + Lenis)
   Reproduit le feeling "Osmo" : smooth scroll + parallax en couches (scrub).
   Local, aucune dépendance CDN. Respecte prefers-reduced-motion.
   Lenis est stoppé quand le tunnel diagnostic est ouvert.
   ═══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var reduce = false;   /* animations forcées sur tous les appareils (demande explicite) */
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function(){
    if (reduce) return;
    if (!window.gsap || !window.ScrollTrigger){ console.warn('[cine] GSAP/ScrollTrigger absent — animations désactivées'); return; }
    var gsap = window.gsap;
    gsap.registerPlugin(window.ScrollTrigger);
    var ST = window.ScrollTrigger;

    /* ── 1) SMOOTH SCROLL (Lenis) ────────────────────────────────── */
    var lenis = null;
    if (window.Lenis){
      lenis = new window.Lenis({
        duration: 1.15,
        smoothWheel: true,
        // touch laissé natif → le tunnel diagnostic scrolle normalement au doigt
        easing: function(t){ return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }
      });
      lenis.on('scroll', ST.update);
      gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);

      // Stoppe le smooth scroll quand l'overlay diagnostic est ouvert
      var ov = document.getElementById('diagOverlay');
      if (ov && window.MutationObserver){
        new MutationObserver(function(){
          if (ov.classList.contains('open')) lenis.stop(); else lenis.start();
        }).observe(ov, { attributes:true, attributeFilter:['class'] });
      }
    }

    /* ── 2) PARALLAX EN COUCHES sur les grandes images (scrub) ───── */
    var imgs = document.querySelectorAll('.card-media img, .card-media-rn img, [data-cine-par]');
    imgs.forEach(function(img){
      var host = img.closest('.card-media, .card-media-rn') || img.parentElement;
      if (host){ host.style.overflow = 'hidden'; }
      gsap.set(img, { scale: 1.3, transformOrigin: 'center center', willChange: 'transform' });
      gsap.fromTo(img,
        { yPercent: -16 },
        { yPercent: 16, ease: 'none',
          scrollTrigger: { trigger: host || img, start: 'top bottom', end: 'bottom top', scrub: 1 } }
      );
    });

    /* ── 3) HERO cinématique : orbite + aurora dérivent au scroll ── */
    var hero = document.querySelector('header.hero') || document.querySelector('.hero');
    var orbit = document.querySelector('.orbit-wrapper');
    if (hero && orbit){
      gsap.to(orbit, { yPercent: 26, opacity: 0.85, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1 } });
    }
    document.querySelectorAll('.aurora').forEach(function(a, i){
      gsap.to(a, { yPercent: (i % 2 ? 20 : -20), ease: 'none',
        scrollTrigger: { start: 'top top', end: 'max', scrub: 1.5 } });
    });

    /* ── 4) REVEAL cinématique — uniquement les éléments explicitement
       marqués [data-cine-in] (n'entre PAS en conflit avec les reveals
       natifs de la base Nouve1u). ── */
    gsap.utils.toArray('[data-cine-in]').forEach(function(el){
      if (el.closest('#diagOverlay')) return;
      gsap.from(el, {
        opacity: 0, y: 44, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' }
      });
    });

    /* ── 5) NAVBAR liquid-glass : état "scrolled" ── */
    var nav = document.querySelector('.navbar');
    if (nav){
      var setNav = function(){ if (window.scrollY > 40) nav.classList.add('scrolled'); else nav.classList.remove('scrolled'); };
      setNav(); addEventListener('scroll', setNav, {passive:true});
      if (lenis) lenis.on('scroll', setNav);
    }

    /* ── 6) WORD-REVEAL : titres marqués [data-words] ── */
    gsap.utils.toArray('[data-words]').forEach(function(el){
      if (el.dataset.split) return; el.dataset.split = '1';
      var text = el.textContent.trim();
      el.innerHTML = text.split(/(\s+)/).map(function(chunk){
        return /\s+/.test(chunk) ? chunk : '<span class="w" style="display:inline-block">' + chunk + '</span>';
      }).join('');
      gsap.from(el.querySelectorAll('.w'), {
        yPercent: 118, opacity: 0, duration: 0.95, ease: 'power4.out', stagger: 0.08,
        scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' }
      });
    });

    /* ── 7) CADRE PHOTO pro : révélation 3D au scroll + parallax ── */
    gsap.utils.toArray('[data-photo-frame]').forEach(function(el){
      gsap.set(el, { transformPerspective: 1100 });
      gsap.from(el, {
        opacity: 0, y: 60, scale: 0.84, rotateX: 12, transformOrigin: '50% 100%',
        duration: 1.1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 86%', toggleActions: 'play none none none' }
      });
      var img = el.querySelector('img');
      if (img) gsap.fromTo(img, { yPercent: -8 }, { yPercent: 8, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1 } });
    });

    /* ── 8) REVEALS en cascade sur tout le contenu jusqu'en bas ── */
    var revealSel = '.unique-box, .pill-fp, .carte-fp, .card, .mod-row, .faq-it, .use-case, '
                  + '.targets-block, .credit, .sec-t, .hero-sub, .footer-brand, .dg-axis, .zw-feat';
    gsap.utils.toArray(revealSel).forEach(function(el){
      if (el.closest('#diagOverlay') || el.closest('.cine-hero') || el.dataset.cineIn != null) return;
      if (el.dataset.rvDone) return; el.dataset.rvDone = '1';
      gsap.from(el, {
        opacity: 0, y: 40, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' }
      });
    });

    /* ── 9) Bulles chromées "drip" qui s'envolent en montant au scroll ── */
    gsap.utils.toArray('.drip').forEach(function(d){
      gsap.to(d.querySelectorAll('i'), { yPercent: -260, opacity: 0.15, ease: 'none', stagger: 0.04,
        scrollTrigger: { trigger: d.closest('section,header') || d, start: 'top 60%', end: 'bottom top', scrub: 1 } });
    });

    /* ── Recalcule les positions après polices/images ── */
    window.addEventListener('load', function(){ ST.refresh(); });
    setTimeout(function(){ ST.refresh(); }, 700);
  });
})();
