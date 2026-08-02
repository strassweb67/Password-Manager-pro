/* ═══════════════════════════════════════════════════════════════════
   RENAISSANCE — Fond WebGL animé du hero (verre bleu, cohérent avec l'intro)
   Bulles de verre translucides + poussière d'étoiles + nébuleuse douce.
   Léger : DPR plafonné, pause hors-écran, respecte prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

(function(){
  const host = document.getElementById('heroGL');
  if (!host) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: host, antialias:true, alpha:true, powerPreference:'high-performance' }); }
  catch(e){ return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
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

  // Bulles : chrome gris métallisé OPAQUE (même look que l'intro), jamais coupées
  const ballMat = new THREE.MeshPhysicalMaterial({
    color:new THREE.Color(0x14161d), metalness:1.0, roughness:0.2,
    clearcoat:1, clearcoatRoughness:0.1, envMapIntensity:2.1
  });
  const orbs = new THREE.Group(); scene.add(orbs);
  const geo = new THREE.SphereGeometry(1, 32, 32);
  const COUNT = innerWidth < 720 ? 9 : 14;
  const balls = [];
  for (let i=0;i<COUNT;i++){
    const b = new THREE.Mesh(geo, ballMat);
    b.scale.setScalar(0.7 + Math.random()*2.1);
    b.position.set((Math.random()-.5)*44, (Math.random()-.5)*30, (Math.random()-.5)*14);
    b.renderOrder = 2;
    b.userData = { sp:0.25+Math.random()*0.7, ph:Math.random()*6.28, base:b.position.clone() };
    orbs.add(b); balls.push(b);
  }

  // Poussière d'étoiles
  const N = innerWidth < 720 ? 1400 : 2600;
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

  let t = 0, raf = 0;
  function frame(){
    raf = 0; if (!onScreen) return;
    t += 0.016;
    m.x += (m.tx-m.x)*0.05; m.y += (m.ty-m.y)*0.05;
    orbs.rotation.y = Math.sin(t*0.06)*0.06 + m.x*0.1;
    balls.forEach(b => {
      b.position.y = b.userData.base.y + Math.sin(t*b.userData.sp+b.userData.ph)*2.2;
      b.position.x = b.userData.base.x + Math.cos(t*b.userData.sp*0.8+b.userData.ph)*1.6;
    });
    stars.rotation.y = t*0.012 + m.x*0.1; stars.rotation.x = m.y*0.05;
    camera.position.x += (m.x*4 - camera.position.x)*0.04;
    camera.position.y += (m.y*2.6 - camera.position.y)*0.04;
    camera.lookAt(0,0,0);
    renderer.render(scene, camera);
    tick();
  }
  function tick(){ if(!raf && onScreen && !reduce) raf = requestAnimationFrame(frame); }

  if (reduce){ renderer.render(scene, camera); } else { tick(); }
})();
