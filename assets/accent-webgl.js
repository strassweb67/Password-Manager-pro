/* ═══════════════════════════════════════════════════════════════════
   RENAISSANCE — Accents « diamants » au-dessus des titres.
   • Desktop (GPU large) : vrai verre WebGL (transmission / reflets), comme l'intro.
   • Mobile / navigateurs fragiles / WebViews : MÊME octaèdre, MÊME géométrie et
     MÊME éclairage, mais rendu en Canvas 2D (vraies arêtes 3D projetées +
     facettes à plat + rotation). ~8 triangles par image → featherweight, AUCUN
     contexte WebGL, donc jamais de blanc/glitch/plantage. Rendu quasi identique
     au WebGL (la transmission verre, à peine visible à cette taille, en moins).
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

  // Le vrai verre WebGL (transmission) sature les GPU mobiles (blanc/glitch/plantage).
  // → mobile / fragile / in-app : octaèdre Canvas 2D (identique en forme, sans WebGL).
  var WEAKBROWSER = MOBILE && /YaBrowser|Firefox|FxiOS|Opera Mini|OPR\//i.test(_ua);
  function glLite(){ try{ return localStorage.getItem('rn_gl_lite')==='1'; }catch(e){ return false; } }
  var NO_GL = IN_APP || MOBILE || WEAKBROWSER || glLite();

  var factory = NO_GL ? makeOcta : makeDiamond;

  // Exposé pour les canvases initialisés à la demande (ex. modal géoloc)
  window.__glDiamond = function(el, idx){
    if (el && !el.__d) el.__d = factory(el, idx || 0);
  };

  // Créé à l'approche de l'écran, libéré quand il s'éloigne (WebGL : contexte ;
  // Canvas 2D : simple pause). Guard __d = pas de double init.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){
        var c = e.target;
        if (e.isIntersecting){
          if (!c.__d && !c.classList.contains('gl-off')) c.__d = factory(c, 0);
        } else if (c.__d){ c.__d.dispose(); c.__d = null; }
      });
    }, { rootMargin: '150px' });
    nodes.forEach(function(c){ io.observe(c); });
  } else {
    nodes.forEach(function(c){ if(!c.__d) c.__d = factory(c, 0); });
  }

  /* ─── petits utilitaires 3D (partagés) ─────────────────────────────── */
  function sub(a,b){ return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }
  function cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function dot3(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function unit(a){ var m=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/m,a[1]/m,a[2]/m]; }
  function mix3(a,b,k){ return [a[0]+(b[0]-a[0])*k, a[1]+(b[1]-a[1])*k, a[2]+(b[2]-a[2])*k]; }
  function rgb3(c){ return 'rgb('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+')'; }

  var OV = [[0,1.35,0],[0,-1.35,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];   // sommets octaèdre (y allongé)
  var OF = [[0,2,4],[0,4,3],[0,3,5],[0,5,2],[1,4,2],[1,3,4],[1,5,3],[1,2,5]]; // 8 faces
  var OL  = unit([0.40,0.72,0.78]);   // lumière clé (≈ WebGL key)
  var OL2 = unit([-0.6,-0.35,0.6]);   // lumière d'appoint

  /* ─────────────────────────────────────────────────────────────────
     OCTAÈDRE Canvas 2D (mobile / fragile / in-app)
     ───────────────────────────────────────────────────────────────── */
  function makeOcta(canvas, idx){
    var ctx;
    try { ctx = canvas.getContext('2d'); } catch(e){}
    if (!ctx){ canvas.classList.add('gl-off'); return null; }

    var gold = canvas.hasAttribute && canvas.hasAttribute('data-gold');
    var P = gold
      ? { deep:[92,62,4],  lite:[255,206,74], white:[255,241,201] }
      : { deep:[24,38,108], lite:[150,180,255], white:[212,226,255] };
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var S = 84;
    function sizeUp(){ S = canvas.clientWidth || 84; canvas.width = Math.round(S*dpr); canvas.height = Math.round(S*dpr); }
    sizeUp();

    var onScreen = true, raf = 0, disposed = false, t = 0.7 * (idx || 0);

    function rot(v, ay, ax){
      var cy=Math.cos(ay), sy=Math.sin(ay), x=v[0]*cy-v[2]*sy, z=v[0]*sy+v[2]*cy, y=v[1];
      var cx=Math.cos(ax), sx=Math.sin(ax);
      return [x, y*cx-z*sx, y*sx+z*cx];
    }
    function draw(){
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,S,S);
      var ay=t*0.7, ax=Math.sin(t*0.5)*0.35;
      var cy = S*0.5 + Math.sin(t*0.6)*S*0.03;                 // léger flottement
      var rv = OV.map(function(v){ return rot(v,ay,ax); });
      var d=5.0, base=S*0.25;
      var pv = rv.map(function(v){ var s=base*(d/(d-v[2])); return [S*0.5 + v[0]*s, cy - v[1]*s]; });
      var faces=[];
      for (var i=0;i<OF.length;i++){
        var f=OF[i], a=rv[f[0]], b=rv[f[1]], c=rv[f[2]];
        var n=unit(cross(sub(b,a),sub(c,a)));
        var cen=[(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3,(a[2]+b[2]+c[2])/3];
        if (dot3(n,cen)<0) n=[-n[0],-n[1],-n[2]];               // normale sortante
        if (n[2]<=0) continue;                                  // faces cachées ignorées
        var diff=Math.max(0,dot3(n,OL)), fill=Math.max(0,dot3(n,OL2));
        var shade=Math.min(1, 0.30 + 0.85*diff + 0.15*fill);
        var col=mix3(P.deep,P.lite,shade);
        col=mix3(col, P.white, Math.pow(diff,10)*0.7);          // éclat spéculaire
        faces.push({ z:cen[2], p:[pv[f[0]],pv[f[1]],pv[f[2]]], col:col });
      }
      faces.sort(function(A,B){ return A.z-B.z; });
      for (var j=0;j<faces.length;j++){
        var fc=faces[j];
        ctx.beginPath();
        ctx.moveTo(fc.p[0][0],fc.p[0][1]); ctx.lineTo(fc.p[1][0],fc.p[1][1]); ctx.lineTo(fc.p[2][0],fc.p[2][1]); ctx.closePath();
        ctx.fillStyle=rgb3(fc.col); ctx.fill();
        ctx.lineJoin='round'; ctx.strokeStyle='rgba(255,255,255,.28)'; ctx.lineWidth=1; ctx.stroke();
      }
    }
    function frame(){ raf=0; if(!onScreen||disposed) return; t+=0.016; draw(); loop(); }
    function loop(){ if(!raf && onScreen && !disposed) raf=requestAnimationFrame(frame); }
    function onResize(){ if(disposed) return; sizeUp(); }
    addEventListener('resize', onResize, { passive:true });
    loop();

    return { dispose:function(){
      if (disposed) return; disposed=true;
      if (raf) cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
    } };
  }

  /* ─────────────────────────────────────────────────────────────────
     DIAMANT DE VERRE — WebGL (desktop)
     ───────────────────────────────────────────────────────────────── */
  function makeDiamond(canvas, idx){
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:!MOBILE, alpha:true, powerPreference:'default', failIfMajorPerformanceCaveat:false });
    } catch(e){ makeOcta(canvas, idx); return null; }

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

    var gold = canvas.hasAttribute && canvas.hasAttribute('data-gold');
    scene.add(new THREE.AmbientLight(gold?0x3a2e00:0x24407e, 0.45));
    var key = new THREE.DirectionalLight(gold?0xfff0c8:0xdfeaff, 1.4); key.position.set(4, 6, 6); scene.add(key);
    var rim = new THREE.PointLight(gold?0xffd21e:0x8fb4ff, 55, 40); rim.position.set(-5, -3, 5); scene.add(rim);
    var rim2 = new THREE.PointLight(gold?0xffaa33:0x9a6bff, 40, 40); rim2.position.set(5, 4, -4); scene.add(rim2);

    var mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xffffff), metalness: 0, roughness: 0.0,
      transmission: 1, thickness: 2.2, ior: 1.5,
      clearcoat: 1, clearcoatRoughness: 0.03,
      specularIntensity: 1, specularColor: new THREE.Color(0xffffff),
      attenuationColor: new THREE.Color(gold?0xffcc00:0x2f5bff), attenuationDistance: 0.7,
      envMapIntensity: 1.35, transparent: true
    });
    var geo = new THREE.OctahedronGeometry(1.2, 0);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.scale.y = 1.35;
    scene.add(mesh);

    var onScreen = true, raf = 0, t = 0.6 * (idx || 0), disposed = false;

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
