/* ═══════════════════════════════════════════════════════════════════
   RENAISSANCE — Accents WebGL : diamants de verre translucides qui tournent
   Même univers que l'intro (verre / transmission / reflets), posés par
   touches sur le site. Léger : petits canvases, DPR plafonné, pause
   hors-écran, désactivés dans les navigateurs in-app pour rester fluides.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

(function(){
  var nodes = [].slice.call(document.querySelectorAll('canvas[data-gl-diamond]'));
  if (!nodes.length) return;

  var _ua = navigator.userAgent || '';
  var IN_APP = /Instagram|FBAN|FBAV|FB_IAB|Snapchat|WhatsApp|Line|Messenger|TikTok|Twitter|GSA/i.test(_ua);
  var MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(_ua);
  var DPR_CAP = MOBILE ? 1.6 : 2;

  // ── STABILITÉ MOBILE ────────────────────────────────────────────────
  // Chaque diamant crée son PROPRE contexte WebGL (renderer + PMREM +
  // RoomEnvironment + matériau à transmission = la fonctionnalité la plus
  // lourde de three.js). Avec l'intro et le hero déjà actifs, 3 diamants
  // de plus = 5 contextes simultanés : les GPU mobiles saturent (mémoire /
  // chaleur) et le navigateur tue l'onglet au bout de ~10-20 s.
  // → Sur mobile ET en WebView in-app, on retombe sur le diamant CSS (dégradé
  //   bleu, quasi identique à cette taille). Le vrai verre WebGL reste sur
  //   desktop, où le budget contexte n'est pas un problème.
  // Détection élargie : certains navigateurs (Android en « mode ordinateur »,
  //   WebViews) ne contiennent pas « Mobile » dans l'UA. On ajoute la mémoire,
  //   le nombre de cœurs et le type de pointeur pour les rattraper.
  // Diamants de verre WebGL restaurés PARTOUT (sections + modal géoloc), sauf
  // sur les navigateurs fragiles (Yandex, Firefox mobile), WebViews in-app, et
  // appareils ayant déjà planté → repli CSS. Chrome/Safari/Samsung/desktop et
  // téléphones capables retrouvent le vrai diamant transparent « comme avant ».
  var WEAKBROWSER = MOBILE && /YaBrowser|Firefox|FxiOS|Opera Mini|OPR\//i.test(_ua);
  function glLite(){ try{ return localStorage.getItem('rn_gl_lite')==='1'; }catch(e){ return false; } }
  // Sur MOBILE : diamant en CSS (dégradé) — fiable et toujours visible. Le verre
  // WebGL des diamants s'affichait blanc/glitché ou disparaissait sur certains
  // GPU mobiles. Le vrai verre WebGL reste sur desktop.
  var NO_GL = IN_APP || MOBILE || WEAKBROWSER || glLite();

  // Exposé pour les canvases créés dynamiquement (ex. modal géoloc)
  window.__glDiamond = function(canvas, idx){
    if (NO_GL) { canvas.classList.add('gl-off'); return; }
    makeDiamond(canvas, idx || 0);
  };

  // Mobile / in-app : fallback CSS (aucun contexte WebGL supplémentaire)
  if (NO_GL) { nodes.forEach(function(c){ c.classList.add('gl-off'); }); return; }

  // Contexte WebGL créé à l'APPROCHE de l'écran et LIBÉRÉ quand le diamant
  // s'éloigne → seuls les diamants visibles gardent un contexte (2-3 max).
  // Indispensable : une dizaine de contextes simultanés satureraient le GPU
  // (surtout sur mobile). Le contexte se recrée quand on revient dessus.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){
        var c = e.target;
        if (e.isIntersecting){
          if (!c.__d && !c.classList.contains('gl-off')) c.__d = makeDiamond(c, 0);
        } else if (c.__d){ c.__d.dispose(); c.__d = null; }
      });
    }, { rootMargin: '150px' });
    nodes.forEach(function(c){ io.observe(c); });
  } else {
    nodes.forEach(function(c){ makeDiamond(c, 0); });
  }

  function makeDiamond(canvas, idx){
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:!MOBILE, alpha:true, powerPreference:'default', failIfMajorPerformanceCaveat:false });
    } catch(e){ canvas.classList.add('gl-off'); return; }

    function csize(){ return canvas.clientWidth || 96; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, DPR_CAP));
    renderer.setSize(csize(), csize(), false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    var scene = new THREE.Scene();
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    var cam = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    cam.position.set(0, 0, 5);

    // Diamant OR (section Zyra) : verre teinté doré au lieu de bleu.
    var gold = canvas.hasAttribute && canvas.hasAttribute('data-gold');
    scene.add(new THREE.AmbientLight(gold?0x3a2e00:0x24407e, 0.45));
    var key = new THREE.DirectionalLight(gold?0xfff0c8:0xdfeaff, 1.4); key.position.set(4, 6, 6); scene.add(key);
    var rim = new THREE.PointLight(gold?0xffd21e:0x8fb4ff, 55, 40); rim.position.set(-5, -3, 5); scene.add(rim);
    var rim2 = new THREE.PointLight(gold?0xffaa33:0x9a6bff, 40, 40); rim2.position.set(5, 4, -4); scene.add(rim2);

    // Verre translucide RÉEL : clair, on voit à travers, teinte (bleue ou dorée)
    // par absorption (Beer-Lambert) — pas de blanc laiteux (iridescence retirée)
    var mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xffffff), metalness: 0, roughness: 0.0,
      transmission: 1, thickness: 2.2, ior: 1.5,
      clearcoat: 1, clearcoatRoughness: 0.03,
      specularIntensity: 1, specularColor: new THREE.Color(0xffffff),
      attenuationColor: new THREE.Color(gold?0xffcc00:0x2f5bff), attenuationDistance: 0.7,
      envMapIntensity: 1.35, transparent: true
    });
    // Diamant : octaèdre facetté
    var geo = new THREE.OctahedronGeometry(1.2, 0);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.scale.y = 1.35;                 // un peu allongé → look diamant
    scene.add(mesh);

    var onScreen = true, raf = 0, t = 0.6 * (idx || 0), disposed = false;

    // Perte de contexte RÉELLE (≠ libération volontaire) → repli CSS + disjoncteur.
    canvas.addEventListener('webglcontextlost', function(ev){ ev.preventDefault(); if (disposed) return; onScreen = false; canvas.classList.add('gl-off'); try{ localStorage.setItem('rn_gl_lite','1'); }catch(e){} }, false);

    function onResize(){ if (disposed) return; var s = csize(); renderer.setSize(s, s, false); }
    addEventListener('resize', onResize, { passive:true });

    function frame(){
      raf = 0; if (!onScreen || disposed) return;
      t += 0.016;
      mesh.rotation.y = t * 0.7;
      mesh.rotation.x = Math.sin(t * 0.5) * 0.35;
      renderer.render(scene, cam);
      tick();
    }
    function tick(){ if (!raf && onScreen && !disposed) raf = requestAnimationFrame(frame); }
    tick();

    // Libère TOUT (contexte GPU compris) quand le diamant s'éloigne de l'écran.
    return { dispose: function(){
      if (disposed) return; disposed = true;
      if (raf) cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      try{
        geo.dispose(); mat.dispose();
        if (pmrem) pmrem.dispose();
        if (scene.environment) scene.environment.dispose();
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      }catch(e){}
    } };
  }
})();
