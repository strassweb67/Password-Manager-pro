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
  // Dans les WebViews in-app : on masque (fallback CSS) pour garder la fluidité
  if (IN_APP) { nodes.forEach(function(c){ c.classList.add('gl-off'); }); return; }

  var DPR_CAP = MOBILE ? 1.6 : 2;

  nodes.forEach(function(canvas, idx){
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

    scene.add(new THREE.AmbientLight(0x24407e, 0.45));
    var key = new THREE.DirectionalLight(0xdfeaff, 1.4); key.position.set(4, 6, 6); scene.add(key);
    var rim = new THREE.PointLight(0x8fb4ff, 55, 40); rim.position.set(-5, -3, 5); scene.add(rim);
    var rim2 = new THREE.PointLight(0x9a6bff, 40, 40); rim2.position.set(5, 4, -4); scene.add(rim2);

    // Verre translucide RÉEL : clair, on voit à travers, teinte bleue par
    // absorption (Beer-Lambert) — pas de blanc laiteux (iridescence retirée)
    var mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xffffff), metalness: 0, roughness: 0.0,
      transmission: 1, thickness: 2.2, ior: 1.5,
      clearcoat: 1, clearcoatRoughness: 0.03,
      specularIntensity: 1, specularColor: new THREE.Color(0xffffff),
      attenuationColor: new THREE.Color(0x2f5bff), attenuationDistance: 0.7,
      envMapIntensity: 1.35, transparent: true
    });
    // Diamant : octaèdre facetté
    var geo = new THREE.OctahedronGeometry(1.2, 0);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.scale.y = 1.35;                 // un peu allongé → look diamant
    scene.add(mesh);

    var onScreen = true, raf = 0, t = 0.6 * idx;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function(es){ onScreen = es[0].isIntersecting; if (onScreen) tick(); }, { threshold: 0.01 }).observe(canvas);
    }
    addEventListener('resize', function(){ var s = csize(); renderer.setSize(s, s, false); }, { passive:true });

    function frame(){
      raf = 0; if (!onScreen) return;
      t += 0.016;
      mesh.rotation.y = t * 0.7;
      mesh.rotation.x = Math.sin(t * 0.5) * 0.35;
      renderer.render(scene, cam);
      tick();
    }
    function tick(){ if (!raf && onScreen) raf = requestAnimationFrame(frame); }
    tick();
  });
})();
