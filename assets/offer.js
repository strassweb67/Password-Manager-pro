/* ═══════════════════════════════════════════════════════════════════
   RENAISSANCE — Moteur partagé des pages d'offre
   (Renaissance · BGH Party · Zyra) — thème bleu identique au site.
   · Bandeau défilant (duplication pour boucle sans couture)
   · Bulles chromées flottantes (même univers que l'intro)
   · Révélations au scroll (IntersectionObserver → .in)
   · Capture email (localStorage + Supabase best-effort)
   · Détection navigateur in-app (fluidité)
   Aucune dépendance CDN. Le diamant WebGL est géré par accent-webgl.js.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var UA = navigator.userAgent || '';
  var IN_APP = /Instagram|FBAN|FBAV|FB_IAB|Snapchat|WhatsApp|Line|Messenger|TikTok|Twitter|GSA/i.test(UA);
  var MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(UA);
  if (IN_APP) document.documentElement.classList.add('in-app');

  function ready(fn) { document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn); }

  ready(function () {

    /* ── 1) Bandeau défilant : on duplique la piste pour une boucle fluide ── */
    document.querySelectorAll('.marq-t').forEach(function (track) {
      if (track.dataset.dup) return; track.dataset.dup = '1';
      track.innerHTML = track.innerHTML + track.innerHTML;
    });

    /* ── 2) Bulles chromées flottantes (même verre que la page de chargement) ── */
    if (!IN_APP) {
      var host = document.getElementById('glbg');
      if (host) {
        var N = MOBILE ? 5 : 8;
        for (var i = 0; i < N; i++) {
          var o = document.createElement('span');
          o.className = 'orb';
          var sz = 26 + ((i * 37) % 70);           // tailles variées, déterministes
          var left = (7 + (i * 61) % 86);
          var top = (12 + (i * 47) % 78);
          o.style.width = o.style.height = sz + 'px';
          o.style.left = left + 'vw';
          o.style.top = top + 'vh';
          o.style.opacity = (0.22 + (i % 4) * 0.09).toFixed(2);
          o.style.animation = 'orbDrift ' + (16 + i * 3) + 's ease-in-out ' + (-i * 2) + 's infinite';
          host.appendChild(o);
        }
        /* keyframes injectées une seule fois */
        if (!document.getElementById('orb-kf')) {
          var st = document.createElement('style'); st.id = 'orb-kf';
          st.textContent = '@keyframes orbDrift{0%,100%{transform:translate3d(0,0,0)}25%{transform:translate3d(14px,-26px,0)}50%{transform:translate3d(-10px,-46px,0)}75%{transform:translate3d(-18px,-20px,0)}}';
          document.head.appendChild(st);
        }
        /* parallaxe douce des bulles au scroll */
        var orbs = [].slice.call(host.querySelectorAll('.orb'));
        var ticking = false;
        addEventListener('scroll', function () {
          if (ticking) return; ticking = true;
          requestAnimationFrame(function () {
            var y = window.scrollY || 0;
            orbs.forEach(function (el, k) { el.style.marginTop = (y * (0.04 + (k % 3) * 0.03)) * -1 + 'px'; });
            ticking = false;
          });
        }, { passive: true });
      }
    }

    /* ── 3) Révélations au scroll ── */
    var revs = [].slice.call(document.querySelectorAll('.reveal'));
    if ('IntersectionObserver' in window && revs.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      revs.forEach(function (el) { io.observe(el); });
      /* filet : ce qui est déjà visible au chargement */
      requestAnimationFrame(function () {
        revs.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < innerHeight * 0.92) el.classList.add('in');
        });
      });
    } else {
      revs.forEach(function (el) { el.classList.add('in'); });
    }

    /* ── 4) Navbar : état "scrolled" (ombre renforcée) ── */
    var nav = document.querySelector('.nav');
    if (nav) {
      var setNav = function () { nav.style.boxShadow = (scrollY > 30) ? '0 16px 50px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.22)' : ''; };
      setNav(); addEventListener('scroll', setNav, { passive: true });
    }

    /* ── 5) Capture email (waitlist / réservation) ── */
    var SUPA_URL = 'https://tetknufkdhntmfjssjeg.supabase.co';
    var SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldGtudWZrZGhudG1manNzamVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxMTk5NTAsImV4cCI6MjA5ODY5NTk1MH0.CBFgRDPO8nZ_GO93rl4TH_kHDx4dprMSWv5G7ZzfBTM';

    /* Ligne d'erreur créée à la demande : les deux pages n'en avaient pas, et
       un formulaire qui refuse sans rien dire laisse le visiteur bloqué. */
    function dire(form, texte) {
      var l = form.querySelector('.eerr');
      if (!l) {
        l = document.createElement('p');
        l.className = 'eerr';
        l.style.cssText = 'margin:8px 0 0;font-size:12px;line-height:1.5;color:#ff6b7d;';
        form.appendChild(l);
      }
      l.textContent = texte || '';
      l.style.display = texte ? 'block' : 'none';
    }

    document.querySelectorAll('.eform').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = form.querySelector('.einput');
        var telInput = form.querySelector('.einput-tel');
        var email = (input && input.value || '').trim();
        var tel = (telInput && telInput.value || '').trim();

        /* Seule la forme est contrôlée. Une vérification du domaine par le DNS
           a été essayée : elle écartait les domaines inventés, mais bloquait
           aussi des adresses professionnelles valides. Toutes passent, le tri
           se fait dans l'admin. */
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          if (input) { input.style.borderColor = '#ff6b7d'; input.focus(); }
          dire(form, 'Entre un email valide.');
          return;
        }
        if (input) input.style.borderColor = '';
        dire(form, '');

        var source = form.dataset.source || 'offer';
        /* 1) localStorage — jamais perdu */
        try {
          var K = 'rn_waitlist';
          var arr = JSON.parse(localStorage.getItem(K) || '[]');
          arr.push({ email: email, tel: tel, source: source, at: new Date().toISOString() });
          localStorage.setItem(K, JSON.stringify(arr));
        } catch (_) {}
        /* 2) Supabase — best-effort, l'échec n'affecte pas l'UX.
           Table diag_leads existante (colonnes email/tel/source/paid déjà là) :
           aucune modification SQL. Visible dans l'admin (onglets Zyra / BGH). */
        try {
          fetch(SUPA_URL + '/rest/v1/diag_leads', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPA_ANON,
              'Authorization': 'Bearer ' + SUPA_ANON,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ email: email, tel: tel, source: source, paid: false, ts: new Date().toISOString() })
          }).catch(function () {});
        } catch (_) {}
        /* 3) succès visuel */
        var wrap = form.closest('.email') || form.parentElement;
        var succ = wrap && wrap.querySelector('.esucc');
        if (succ) { form.style.display = 'none'; succ.style.display = 'block'; }
        else { input.value = ''; input.placeholder = '✓ C\'est noté — à très vite.'; }
      });
    });

  });
})();
