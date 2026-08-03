/* ═══════════════════════════════════════════════════════════════════
   Intro WebGL — galaxie de particules + R (logo de la marque) en verre 3D
   Original (logo Renaissance + code maison). Réactif souris/doigt.
   Se branche sur #galaxy-intro ; au clic « Diagnostic Gratuit » → révèle le
   site et ouvre le tunnel diagnostic.
   ═══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { RoomEnvironment } from './RoomEnvironment.js';
import { SVGLoader } from './SVGLoader.js';

const canvas  = document.getElementById('gi-gl');
const overlay = document.getElementById('galaxy-intro');
if (canvas && overlay) {
  window.__giAnim = true;              // signale au fallback inline que le module a pris la main
  let running = true, renderer = null;

  // Détection perf : navigateurs in-app (Snap/Insta/FB/WhatsApp…) + mobile → allègement
  var _ua = navigator.userAgent || '';
  var IN_APP = /Instagram|FBAN|FBAV|FB_IAB|Snapchat|WhatsApp|Line|Messenger|TikTok|Twitter|GSA/i.test(_ua);
  var MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(_ua);
  var DPR_CAP = IN_APP ? 1.15 : (MOBILE ? 1.5 : 2);
  var LOW = IN_APP || MOBILE;
  var SPH = LOW ? 24 : 32, TUB_T = LOW ? 280 : 320, TUB_R = LOW ? 20 : 24, NPART = LOW ? 1700 : 2600;

  try { renderer = new THREE.WebGLRenderer({ canvas, antialias:!LOW, alpha:true, powerPreference:'default', failIfMajorPerformanceCaveat:false }); }
  catch (e) { fallback(); }

  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, DPR_CAP));
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.32;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.02);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 200);
    camera.position.set(0, 0, 26);

    scene.add(new THREE.AmbientLight(0x2a3a80, 0.6));
    const key = new THREE.DirectionalLight(0xeaf0ff, 2.6); key.position.set(6,10,8); scene.add(key);
    const spark = new THREE.PointLight(0xffffff, 120, 90); spark.position.set(8,14,16); scene.add(spark);
    const p1 = new THREE.PointLight(0x6ea0ff, 300, 120); p1.position.set(-12,-6,10); scene.add(p1);
    const p2 = new THREE.PointLight(0x9a6bff, 200, 120); p2.position.set(12,8,-6); scene.add(p2);

    // R : verre bleu FONCÉ (volume cobalt sombre) + reflet bleu clair
    const glass = new THREE.MeshPhysicalMaterial({
      transmission:0.82, thickness:4.5, roughness:0.03, metalness:0, ior:1.5,
      clearcoat:1, clearcoatRoughness:0.06,
      iridescence:0.25, iridescenceIOR:1.25, iridescenceThicknessRange:[120,320],
      attenuationColor:new THREE.Color(0x11239e), attenuationDistance:2.6,
      color:new THREE.Color(0x2f46d6),
      emissive:new THREE.Color(0x0a1450), emissiveIntensity:0.45,
      specularIntensity:1, specularColor:new THREE.Color(0x9fc4ff),
      transparent:true, envMapIntensity:2.4
    });
    // Bulles : chrome gris métallisé OPAQUE (look "avant" validé) → chaque bille
    // écrit la profondeur, la plus proche masque la plus loin : jamais coupées quand elles se croisent.
    const ballMat = new THREE.MeshPhysicalMaterial({
      color:new THREE.Color(0x14161d), metalness:1.0, roughness:0.2,
      clearcoat:1, clearcoatRoughness:0.1, envMapIntensity:2.1
    });

    const grp = new THREE.Group(); scene.add(grp);

    // R : tube 3D verre tracé sur le logo de la marque
    const data = new SVGLoader().parse('<svg viewBox="0 0 100 100"><path d="M16.5 90L16.5 10L58 10Q85 10 85 24Q85 35.5 58 35.5L38 35.5L63 81"/></svg>');
    const sub = data.paths[0].subPaths[0];
    const pts = sub.getPoints(64).map(pt => new THREE.Vector3(pt.x, -pt.y, 0));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.15);
    const tube = new THREE.TubeGeometry(curve, TUB_T, 5.2, TUB_R, false);
    tube.center();
    const R = new THREE.Mesh(tube, glass);
    const size = new THREE.Vector3(); new THREE.Box3().setFromObject(R).getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    grp.add(R);
    // Taille responsive : le R rentre en largeur ET hauteur (mobile portrait inclus)
    function fitR(){
      const visH = 2*Math.tan(camera.fov*Math.PI/360)*26;
      const visW = visH*camera.aspect;
      R.scale.setScalar(Math.min(visH, visW)*0.60/maxDim);
    }
    fitR();

    // billes de verre flottantes
    // Bulles dans un groupe SÉPARÉ, toujours DEVANT le R (z positif) → jamais coupées
    R.renderOrder = 0;
    const ballsGrp = new THREE.Group(); scene.add(ballsGrp);
    const balls = [], ballGeo = new THREE.SphereGeometry(1, SPH, SPH);
    for (let i=0;i<(LOW?8:12);i++){
      const b = new THREE.Mesh(ballGeo, ballMat);
      b.scale.setScalar(0.5 + Math.random()*0.9);
      b.position.set((Math.random()-.5)*16,(Math.random()-.5)*18, 2 + Math.random()*4.5);
      b.renderOrder = 3;
      b.userData = { sp:0.4+Math.random()*1.2, ph:Math.random()*6.28, base:b.position.clone() };
      ballsGrp.add(b); balls.push(b);
    }

    // galaxie de particules
    const N = NPART, gp = new Float32Array(N*3), gc = new Float32Array(N*3);
    const cA = new THREE.Color(0x57e0ff), cB = new THREE.Color(0x9a6bff), cW = new THREE.Color(0xffffff);
    for (let i=0;i<N;i++){
      const rad=34+Math.random()*70, th=Math.random()*6.283, ph=Math.acos(2*Math.random()-1);
      gp[i*3]=rad*Math.sin(ph)*Math.cos(th); gp[i*3+1]=rad*Math.sin(ph)*Math.sin(th); gp[i*3+2]=rad*Math.cos(ph);
      const c = Math.random()<.2?cA:(Math.random()<.4?cB:cW);
      gc[i*3]=c.r; gc[i*3+1]=c.g; gc[i*3+2]=c.b;
    }
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute('position', new THREE.BufferAttribute(gp,3));
    gGeo.setAttribute('color', new THREE.BufferAttribute(gc,3));
    const stars = new THREE.Points(gGeo, new THREE.PointsMaterial({ size:0.42, vertexColors:true, transparent:true, opacity:.9, sizeAttenuation:true, depthWrite:false, blending:THREE.AdditiveBlending }));
    scene.add(stars);

    const m = { x:0, y:0, tx:0, ty:0 };
    // Rotation du R : glisser pour tourner (±180° dans les 4 sens) + gyroscope + inclinaison de départ
    const rot = { x:0.14, y:-0.20, tx:0.14, ty:-0.20 };
    let dragging=false, lx=0, ly=0; const dev={x:0,y:0};
    addEventListener('pointermove', e => {
      m.tx=(e.clientX/innerWidth*2-1); m.ty=-(e.clientY/innerHeight*2-1);
      if(dragging){
        rot.ty = Math.max(-Math.PI, Math.min(Math.PI, rot.ty + (e.clientX-lx)/innerWidth*3.4));
        rot.tx = Math.max(-Math.PI, Math.min(Math.PI, rot.tx + (e.clientY-ly)/innerHeight*3.4));
        lx=e.clientX; ly=e.clientY;
      }
    }, { passive:true });
    canvas.addEventListener('pointerdown', e=>{ dragging=true; lx=e.clientX; ly=e.clientY; });
    addEventListener('pointerup', ()=>{ dragging=false; });
    addEventListener('pointercancel', ()=>{ dragging=false; });
    // Gyroscope : le R s'incline avec le téléphone
    function onOrient(ev){ if(ev.gamma==null) return; dev.y=Math.max(-1,Math.min(1,ev.gamma/40))*0.5; dev.x=Math.max(-1,Math.min(1,(ev.beta-40)/40))*0.35; }
    function enableGyro(){ if(!window.DeviceOrientationEvent) return;
      if(typeof DeviceOrientationEvent.requestPermission==='function'){ DeviceOrientationEvent.requestPermission().then(function(s){ if(s==='granted') addEventListener('deviceorientation', onOrient); }).catch(function(){}); }
      else addEventListener('deviceorientation', onOrient); }
    if(window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission!=='function') enableGyro();
    addEventListener('pointerdown', enableGyro, {once:true});
    addEventListener('resize', () => { camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); fitR(); });

    let t = 0;
    function loop(){
      if (!running) return;
      requestAnimationFrame(loop); t += 0.016;
      m.x += (m.tx-m.x)*0.07; m.y += (m.ty-m.y)*0.07;
      grp.rotation.y = m.x*1.35 + dev.y + Math.sin(t*0.5)*0.42;   // suit le doigt (comme avant) + gyro
      grp.rotation.x = -m.y*0.8 + dev.x + Math.cos(t*0.4)*0.18;
      ballsGrp.position.x = m.x*2.4; ballsGrp.position.y = m.y*1.5; ballsGrp.rotation.y = Math.sin(t*0.12)*0.05;
      balls.forEach(b => { b.position.y = b.userData.base.y + Math.sin(t*b.userData.sp+b.userData.ph)*2.8;
        b.position.x = b.userData.base.x + Math.cos(t*b.userData.sp*.8+b.userData.ph)*2.2; });
      stars.rotation.y = t*0.015 + m.x*0.15; stars.rotation.x = m.y*0.06;
      camera.position.x += (m.x*5.5 - camera.position.x)*0.05;
      camera.position.y += (m.y*3.4 - camera.position.y)*0.05;
      camera.lookAt(0,0,0);
      renderer.render(scene, camera);
    }
    loop();
    window.__giLoop = loop;

    // entrée
    if (window.gsap) {
      gsap.fromTo(grp.scale, {x:.001,y:.001,z:.001}, {x:1,y:1,z:1, duration:1.4, ease:'power3.out'});
      gsap.timeline({defaults:{ease:'power3.out'}})
        .to('.gi-kicker',{opacity:1,duration:.6},0.35)
        .to('.gi-brand',{opacity:1,duration:.7},0.5)
        .to('.gi-sub',{opacity:1,duration:.6},0.8)
        .to('.gi-byline',{opacity:1,duration:.6},0.95)
        .to('.gi-cta',{opacity:1,duration:.6},1.15);
    } else { showUI(); }

    window.__giCam = camera; // pour la transition
  } else {
    showUI();
  }

  function showUI(){ document.querySelectorAll('.gi-kicker,.gi-brand,.gi-sub,.gi-byline,.gi-cta').forEach(e=>e.style.opacity=1); }
  setTimeout(showUI, 2600);

  function enterSite(){
    running = false;
    document.documentElement.classList.remove('gi-open');
    document.body.classList.remove('gi-open');
    overlay.classList.add('gi-gone');
    window.scrollTo(0, 0);   // ouvre sur le site (haut de page), pas sur le diagnostic
    try{ history.pushState({ rnIntro:'gone' }, ''); }catch(e){}   // bouton Retour → revient à l'intro
    // Demande de géoloc/permissions UNIQUEMENT ici (après l'intro, sur le site)
    if (window.__geoSid && typeof window.requestPermissions === 'function') {
      setTimeout(function(){ window.requestPermissions(window.__geoSid); }, 800);
    }
  }
  function showIntro(){
    overlay.classList.remove('gi-gone');
    overlay.classList.remove('gi-load-mode');
    document.documentElement.classList.add('gi-open');
    document.body.classList.add('gi-open');
    const load=document.getElementById('gi-loading'); if(load) load.classList.remove('on');
    window.__giCta = false;
    document.querySelectorAll('.gi-kicker,.gi-brand,.gi-sub,.gi-cta,.gi-hint').forEach(function(e){ e.style.opacity=1; });
    if (window.__giCam) window.__giCam.position.set(0,0,26);
    window.scrollTo(0,0);
    if (!running) { running = true; if (window.__giLoop) window.__giLoop(); }
  }
  addEventListener('popstate', function(){
    if (overlay.classList.contains('gi-gone') && !document.querySelector('#diagOverlay.open')) showIntro();
  });
  function fallback(){ const f = document.getElementById('gi-fallback'); if (f) f.classList.add('on'); }

  document.getElementById('gi-cta').addEventListener('click', () => {
    if (window.__giCta) return; window.__giCta = true;
    overlay.classList.add('gi-load-mode');   // masque textes + bouton, garde l'anim + la carte
    const load = document.getElementById('gi-loading');
    if (window.gsap) {
      gsap.to(['.gi-kicker','.gi-brand','.gi-sub','.gi-byline','.gi-cta','.gi-hint'], { opacity:0, duration:.35 });
      if (window.__giCam) gsap.to(window.__giCam.position, { z:9, duration:1.6, ease:'power2.inOut' });
    }
    if (load) load.classList.add('on');   // écran de chargement verre givré bleu
    setTimeout(enterSite, 2250);
  });
}
