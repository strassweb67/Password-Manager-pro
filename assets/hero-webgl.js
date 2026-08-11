/* ═══════════════════════════════════════════════════════════════════
   RENAISSANCE — Fond WebGL animé du hero (verre bleu, cohérent avec l'intro)
   Bulles de verre translucides + poussière d'étoiles + nébuleuse douce.
   Léger : DPR plafonné, pause hors-écran, respecte prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { glSupported } from './gl-probe.js';

(function(){
  const host = document.getElementById('heroGL');
  if (!host) return;
  const reduce = false;   /* animations forcées sur tous les appareils (demande explicite) */

  // Détection perf : navigateurs in-app + mobile → allègement pour rester fluide
  var _ua = navigator.userAgent || '';
  var IN_APP = /Instagram|FBAN|FBAV|FB_IAB|Snapchat|WhatsApp|Line|Messenger|TikTok|Twitter|GSA/i.test(_ua);
  var MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(_ua);
  var LOWMEM = (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
               (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  var WEAKBROWSER = MOBILE && /YaBrowser|Firefox|FxiOS|Opera Mini|OPR\//i.test(_ua);
  function glLite(){ try{ return localStorage.getItem('rn_gl_lite')==='1'; }catch(e){ return false; } }
  function markLite(){ try{ localStorage.setItem('rn_gl_lite','1'); }catch(e){} }
  var LITE = IN_APP || LOWMEM || WEAKBROWSER || glLite();
  var LOW = IN_APP || MOBILE;
  // Chaînes WebGL sur TOUS les navigateurs, WebViews Instagram et TikTok
  // comprises : elles en sont capables, et les écarter sur leur nom laissait un
  // simple dégradé au visiteur venu des réseaux. On interroge le navigateur au
  // lieu de le deviner ; en in-app le rendu tourne en réglages allégés (LITE,
  // ci-dessus). Contexte refusé ou perdu → le fond dégradé reprend seul.
  if (!glSupported()) return;
  // Résolution interne abaissée sur mobile / appareils faibles (invisible,
  // soulage le GPU — cohérent avec l'intro).
  var DPR_CAP = LITE ? 1.0 : (LOWMEM ? 1.1 : (MOBILE ? 1.3 : 2));
  var SPH = LITE ? 20 : (LOW ? 24 : 32);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: host, antialias:!LOW, alpha:true, powerPreference:'default', failIfMajorPerformanceCaveat:false }); }
  catch(e){ return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, DPR_CAP));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(48, innerWidth/innerHeight, 0.1, 200);
  camera.position.set(0, 0, 30);

  scene.add(new THREE.AmbientLight(0x2a3a80, 0.7));
  const key = new THREE.DirectionalLight(0xbfd4ff, 2.1); key.position.set(6,10,8); scene.add(key);
  const rim = new THREE.PointLight(0x6ea0ff, 260, 140); rim.position.set(-14,-6,12); scene.add(rim);
  const rim2 = new THREE.PointLight(0x9a6bff, 170, 140); rim2.position.set(14,8,-6); scene.add(rim2);

  // Chaînes en métal : MÊME matériau chrome sombre que les boules d'avant
  // (couleur + reflets identiques). Maillons torus alternés à 90° → ils
  // s'imbriquent en vraies chaînes. Elles flottent / dérivent comme les boules.
  const ballMat = new THREE.MeshPhysicalMaterial({
    color:new THREE.Color(0x14161d), metalness:1.0, roughness:0.2,
    clearcoat:1, clearcoatRoughness:0.1, envMapIntensity:2.1
  });
  const orbs = new THREE.Group(); scene.add(orbs);
  const linkGeo = new THREE.TorusGeometry(0.5, 0.17, LOW?6:8, LOW?14:22);
  const LINK_STEP = 0.5;                       // = rayon du maillon → imbrication
  function makeChain(n){
    const g = new THREE.Group();
    for (let i=0;i<n;i++){
      const l = new THREE.Mesh(linkGeo, ballMat);
      l.position.y = i*LINK_STEP;
      if (i%2) l.rotation.y = Math.PI/2;        // un maillon sur deux tourné à 90°
      l.renderOrder = 2;
      g.add(l);
    }
    const off=(n-1)*LINK_STEP/2; g.children.forEach(c=>c.position.y-=off);  // centré
    return g;
  }
  const COUNT = LITE ? 12 : (LOW ? 14 : 22);         // chaînes visibles PARTOUT (même Firefox/Yandex)
  const chains = [];
  for (let i=0;i<COUNT;i++){
    const n = LOW ? 5 : (6 + Math.floor(Math.random()*4));   // 6 à 9 maillons → chaînes plus longues
    const b = makeChain(n);
    const r0 = 1.0 + Math.random()*0.85;
    b.scale.setScalar(r0);
    // réparties partout sur la hauteur du hero — étalées de bas en haut (demande :
    // « plus partout et plus bas », pas seulement en haut)
    b.position.set((Math.random()-.5)*22, -14 + Math.random()*26, (Math.random()-.5)*10);
    b.rotation.set(Math.random()*6.28, Math.random()*6.28, Math.random()*6.28);
    b.userData = { sp:0.3+Math.random()*0.9, ph:Math.random()*6.28, base:b.position.clone(), r0:r0,
      ax:1.8+Math.random()*2.4, ay:2.4+Math.random()*2.6, az:0.8+Math.random()*1.4,   // amplitudes de dérive
      spin:new THREE.Vector3((Math.random()-.5)*1.0, (Math.random()-.5)*1.1, (Math.random()-.5)*0.8) };
    orbs.add(b); chains.push(b);
  }

  // Poussière d'étoiles
  const N = LITE ? 500 : (LOW ? 1000 : 2600);
  const pos = new Float32Array(N*3), col = new Float32Array(N*3);
  const cA = new THREE.Color(0x57e0ff), cB = new THREE.Color(0x9a6bff), cW = new THREE.Color(0xffffff);
  for (let i=0;i<N;i++){
    const r = 40 + Math.random()*80, th = Math.random()*6.283, ph = Math.acos(2*Math.random()-1);
    pos[i*3]=r*Math.sin(ph)*Math.cos(th); pos[i*3+1]=r*Math.sin(ph)*Math.sin(th); pos[i*3+2]=r*Math.cos(ph);
    const c = Math.random()<.22?cA:(Math.random()<.44?cB:cW);
    col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos,3));
  sg.setAttribute('color', new THREE.BufferAttribute(col,3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size:0.4, vertexColors:true, transparent:true, opacity:.85, sizeAttenuation:true, depthWrite:false, blending:THREE.AdditiveBlending }));
  scene.add(stars);

  const m = { x:0, y:0, tx:0, ty:0 };
  addEventListener('pointermove', e => { m.tx=(e.clientX/innerWidth*2-1); m.ty=-(e.clientY/innerHeight*2-1); }, {passive:true});
  addEventListener('resize', () => { camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });

  // Pause quand le hero sort de l'écran (perf)
  let onScreen = true;
  const heroSec = document.getElementById('cineHero');
  if (heroSec && 'IntersectionObserver' in window){
    new IntersectionObserver(es => { onScreen = es[0].isIntersecting; if(onScreen) tick(); }, {threshold:0.01}).observe(heroSec);
  }

  // Ne PAS rendre le hero tant que l'intro plein écran est affichée : il est
  // caché derrière l'overlay, mais son rendu consommerait le GPU EN MÊME TEMPS
  // que l'intro → 2 scènes WebGL lourdes simultanées, cause des « écrans qui
  // s'assombrissent » sur GPU mobiles limités. On attend la fin de l'intro.
  // L'overlay #galaxy-intro est présent dès le HTML initial (avant tout script),
  // et reçoit la classe « gi-gone » à la fin de l'intro : c'est le signal fiable,
  // sans course avec l'ajout tardif de « gi-open » sur <html>.
  const introOverlay = document.getElementById('galaxy-intro');
  function introUp(){ return introOverlay && !introOverlay.classList.contains('gi-gone'); }
  if (introOverlay && window.MutationObserver){
    new MutationObserver(function(){ if(!introUp()) tick(); })
      .observe(introOverlay, { attributes:true, attributeFilter:['class'] });
  }

  // Pause aussi le hero quand une modal plein écran est ouverte (géoloc) : elle
  // le recouvre, et le laisser tourner sous un overlay = GPU gaspillé + risque
  // de gel. On reprend dès que la modal est retirée du DOM.
  function modalUp(){
    if (document.getElementById('geo-consent-ov')) return true;         // modal géoloc
    var dg = document.getElementById('diagOverlay');                    // tunnel diagnostic
    if (dg && dg.classList.contains('open')) return true;
    return false;
  }
  if (window.MutationObserver){
    new MutationObserver(function(){ if(!modalUp()){ window.__heroPause = false; tick(); } })
      .observe(document.body, { childList:true, subtree:false });
    var _dg = document.getElementById('diagOverlay');
    if (_dg) new MutationObserver(function(){ if(!modalUp()) tick(); })
      .observe(_dg, { attributes:true, attributeFilter:['class'] });
  }

  // Perte de contexte WebGL : on arrête proprement (le fond redevient
  // transparent, la page reste utilisable) au lieu de figer + disjoncteur :
  // l'appareil passe en mode léger pour les prochains chargements.
  host.addEventListener('webglcontextlost', function(ev){
    ev.preventDefault(); onScreen = false; markLite();
    try{ if(!sessionStorage.getItem('rn_gl_reloaded')){ sessionStorage.setItem('rn_gl_reloaded','1'); setTimeout(function(){ location.reload(); }, 60); } }catch(e){}
  }, false);
  host.addEventListener('webglcontextrestored', function(){ onScreen = true; tick(); }, false);

  // Scroll : les bulles métallisées s'envolent et montent quand on descend
  let scrollProg = 0, rise = 0;
  addEventListener('scroll', () => {
    const h = (heroSec ? heroSec.offsetHeight : innerHeight) || innerHeight;
    scrollProg = Math.min(1, Math.max(0, (window.scrollY || window.pageYOffset || 0) / h));
  }, {passive:true});

  let t = 0, raf = 0;
  function frame(){
    raf = 0; if (!onScreen || introUp() || window.__heroPause || modalUp()) return;
    t += 0.016;
    m.x += (m.tx-m.x)*0.05; m.y += (m.ty-m.y)*0.05;
    rise += (scrollProg - rise) * 0.08;                 // suit le scroll en douceur
    const lift = rise * rise * 20;                      // montée plus douce → les chaînes restent visibles plus bas
    orbs.position.y = lift;                             // les chaînes montent (léger)
    orbs.rotation.y = Math.sin(t*0.06)*0.06 + m.x*0.1;
    chains.forEach((b,i) => {
      const u = b.userData;
      // dérive nette dans TOUTES les directions (bougent partout)
      b.position.y = u.base.y + Math.sin(t*u.sp+u.ph)*u.ay + rise*(2 + (i%4))*0.5;
      b.position.x = u.base.x + Math.cos(t*u.sp*0.85+u.ph)*u.ax;
      b.position.z = u.base.z + Math.sin(t*u.sp*0.6+u.ph*1.3)*u.az;
      b.rotation.x += u.spin.x*0.016;   // tournent franchement → reflets métal vivants
      b.rotation.y += u.spin.y*0.016;
      b.rotation.z += u.spin.z*0.016;
      b.scale.setScalar(u.r0 * (1 - rise*0.45));  // se dispersent/rapetissent en montant
    });
    stars.position.y = rise * 10;
    stars.rotation.y = t*0.012 + m.x*0.1; stars.rotation.x = m.y*0.05;
    camera.position.x += (m.x*4 - camera.position.x)*0.04;
    camera.position.y += (m.y*2.6 - camera.position.y)*0.04;
    camera.lookAt(0,0,0);
    renderer.render(scene, camera);
    tick();
  }
  // Toujours animé (mouvement doux voulu même en "réduire les animations")
  function tick(){ if(!raf && onScreen) raf = requestAnimationFrame(frame); }
  tick();
})();
