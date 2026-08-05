/* ═══════════════════════════════════════════════════════════════════
   RENAISSANCE — Accents « diamants » au-dessus des titres.
   • Desktop (GPU large) : vrai verre WebGL (transmission / reflets), comme l'intro.
   • Mobile / navigateurs fragiles / WebViews : diamant SVG taillé (brillant),
     facettes vectorielles + dégradé verre + reflet qui balaie la pierre + léger
     flottement. Vectoriel = net à toutes tailles, ultra-léger, animé par le
     compositeur → AUCUN contexte WebGL, donc jamais de blanc/glitch/plantage.
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
  // Le vrai verre WebGL (MeshPhysicalMaterial + transmission) est la fonction
  // la plus lourde de three.js : plusieurs contextes saturent les GPU mobiles →
  // le diamant devenait blanc/glitché puis disparaissait, ou l'onglet plantait.
  // → Sur mobile / WebView / navigateurs fragiles, on affiche un diamant SVG
  //   taillé (facettes + reflet animé) : magnifique, net, léger et SANS WebGL.
  //   Le vrai verre WebGL reste sur desktop.
  var WEAKBROWSER = MOBILE && /YaBrowser|Firefox|FxiOS|Opera Mini|OPR\//i.test(_ua);
  function glLite(){ try{ return localStorage.getItem('rn_gl_lite')==='1'; }catch(e){ return false; } }
  var NO_GL = IN_APP || MOBILE || WEAKBROWSER || glLite();

  /* ─────────────────────────────────────────────────────────────────
     DIAMANT SVG TAILLÉ (mobile / fragile / in-app) — remplace le canvas
     ───────────────────────────────────────────────────────────────── */
  var _uid = 0;
  function svgGem(el){
    if (!el || el.tagName !== 'CANVAS') return;             // déjà remplacé
    var gold = el.hasAttribute && el.hasAttribute('data-gold');
    var u = 'gm' + (_uid++);
    var c = gold
      ? {tab1:'#fff6d0',tab2:'#ffe79c',cl:'#f0c85a',cr:'#e0b53f',pv1:'#e3b53a',pv2:'#8a6810',pc:'#ffde84',pr:'#8f6d0e',spec:'#fffbe8'}
      : {tab1:'#eef3ff',tab2:'#b9caff',cl:'#7f9bef',cr:'#5f7ce0',pv1:'#6f8ce8',pv2:'#1f337f',pc:'#93aaff',pr:'#2b3f8f',spec:'#ffffff'};
    var svg =
      '<svg class="gl-svg '+ (el.className||'') +'" viewBox="0 0 100 100" aria-hidden="true">'
      + '<defs>'
      +   '<linearGradient id="pav'+u+'" x1="0" y1="0.34" x2="0" y2="1"><stop offset="0" stop-color="'+c.pv1+'"/><stop offset="1" stop-color="'+c.pv2+'"/></linearGradient>'
      +   '<linearGradient id="tab'+u+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+c.tab1+'"/><stop offset="1" stop-color="'+c.tab2+'"/></linearGradient>'
      +   '<linearGradient id="gl'+u+'" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
      +   '<clipPath id="cp'+u+'"><path d="M30,14 L70,14 L86,42 L50,95 L14,42 Z"/></clipPath>'
      + '</defs>'
      + '<g clip-path="url(#cp'+u+')">'
      +   '<polygon points="30,14 70,14 62,42 38,42" fill="url(#tab'+u+')"/>'
      +   '<polygon points="30,14 38,42 14,42" fill="'+c.cl+'"/>'
      +   '<polygon points="70,14 86,42 62,42" fill="'+c.cr+'"/>'
      +   '<polygon points="14,42 38,42 50,95" fill="url(#pav'+u+')"/>'
      +   '<polygon points="38,42 62,42 50,95" fill="'+c.pc+'"/>'
      +   '<polygon points="62,42 86,42 50,95" fill="'+c.pr+'"/>'
      +   '<g transform="rotate(-18 50 50)"><rect x="-34" y="-16" width="24" height="150" fill="url(#gl'+u+')"><animateTransform attributeName="transform" type="translate" from="0 0" to="150 0" dur="3.4s" repeatCount="indefinite"/></rect></g>'
      + '</g>'
      + '<path d="M30,14 L70,14 L86,42 L50,95 L14,42 Z M30,14 L38,42 M70,14 L62,42 M14,42 L86,42 M38,42 L50,95 M62,42 L50,95" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="1" stroke-linejoin="round"/>'
      + '<ellipse cx="45" cy="24" rx="9" ry="3.6" fill="'+c.spec+'" opacity="0.7"/>'
      + '</svg>';
    var tmp = document.createElement('div');
    tmp.innerHTML = svg;
    var node = tmp.firstChild;
    if (el.id) node.id = el.id;                              // conserve #gc-diamond (taille modal)
    if (el.parentNode) el.parentNode.replaceChild(node, el);
  }

  // Exposé pour les canvases initialisés à la demande (ex. modal géoloc)
  window.__glDiamond = function(el, idx){
    if (NO_GL) { svgGem(el); return; }
    makeDiamond(el, idx || 0);
  };

  if (NO_GL) {
    // CSS auto-injecté (marche sur toutes les pages + la modal, sans toucher aux feuilles)
    var st = document.createElement('style');
    st.textContent = '.gl-svg{display:block;overflow:visible;animation:glSvgFloat 4.2s ease-in-out infinite;}'
      + '@keyframes glSvgFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}';
    (document.head || document.documentElement).appendChild(st);
    nodes.forEach(function(c){ svgGem(c); });
    return;
  }

  /* ─────────────────────────────────────────────────────────────────
     DESKTOP — vrai verre WebGL, contexte créé/libéré selon la visibilité.
     ───────────────────────────────────────────────────────────────── */
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
    nodes.forEach(function(c){ factory(c, 0); });
  }

  /* ─────────────────────────────────────────────────────────────────
     DIAMANT FACETTÉ — Canvas 2D (mobile / fragile / in-app)
     Octaèdre vu de face : 4 facettes triangulaires séparées par une arête
     verticale et une arête horizontale. L'arête verticale oscille → illusion
     de rotation 3D ; la lumière tourne autour des facettes ; un éclat glisse.
     ───────────────────────────────────────────────────────────────── */
  function makeGem(canvas, idx){
    var ctx;
    try { ctx = canvas.getContext('2d'); } catch(e){}
    if (!ctx){ canvas.classList.add('gl-off'); return null; }

    var gold = canvas.hasAttribute && canvas.hasAttribute('data-gold');
    var dpr  = Math.min(window.devicePixelRatio || 1, 2);
    var pal  = gold
      ? { deep:[110,78,0],  mid:[240,186,32], hi:[255,244,205] }
      : { deep:[20,38,110], mid:[64,104,240], hi:[214,228,255] };

    var S = 84;
    function sizeUp(){
      S = canvas.clientWidth || 84;
      canvas.width  = Math.round(S * dpr);
      canvas.height = Math.round(S * dpr);
    }
    sizeUp();

    var onScreen = true, raf = 0, disposed = false, t = 0.7 * (idx || 0);

    function mix(a,b,k){ return [a[0]+(b[0]-a[0])*k, a[1]+(b[1]-a[1])*k, a[2]+(b[2]-a[2])*k]; }
    function rgb(c,al){ return 'rgba('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+','+(al==null?1:al)+')'; }

    function facet(C, A, B, b){
      var mx=(A[0]+B[0])/2, my=(A[1]+B[1])/2;
      var g=ctx.createLinearGradient(C[0],C[1], mx,my);
      g.addColorStop(0, rgb(mix(pal.mid, pal.hi,   0.30+0.55*b)));
      g.addColorStop(1, rgb(mix(pal.deep,pal.mid,  0.10+0.55*b)));
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.moveTo(C[0],C[1]); ctx.lineTo(A[0],A[1]); ctx.lineTo(B[0],B[1]); ctx.closePath(); ctx.fill();
    }

    function draw(){
      ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,S,S);

      var cx = S*0.5, cy = S*0.5 + Math.sin(t*0.6)*S*0.03;   // léger flottement
      var top = cy-S*0.44, bot = cy+S*0.44, left = S*0.17, right = S*0.83;
      var ridgeX = cx + S*0.14*Math.sin(t);                  // arête verticale qui oscille → rotation
      var T=[ridgeX,top], B=[ridgeX,bot], L=[left,cy], R=[right,cy], C=[ridgeX,cy];
      var bTL=0.5+0.5*Math.sin(t),         bTR=0.5+0.5*Math.sin(t+1.5708),
          bBR=0.5+0.5*Math.sin(t+3.1416),  bBL=0.5+0.5*Math.sin(t+4.7124);

      // halo doux derrière (profondeur)
      var rg=ctx.createRadialGradient(cx,cy,2, cx,cy,S*0.5);
      rg.addColorStop(0, rgb(pal.mid,0.26)); rg.addColorStop(1, rgb(pal.mid,0));
      ctx.fillStyle=rg; ctx.fillRect(0,0,S,S);

      // facettes + cœur lumineux + éclat, découpés dans la silhouette du diamant
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(T[0],T[1]); ctx.lineTo(L[0],L[1]); ctx.lineTo(B[0],B[1]); ctx.lineTo(R[0],R[1]); ctx.closePath();
      ctx.clip();
      facet(C,T,L,bTL); facet(C,T,R,bTR); facet(C,R,B,bBR); facet(C,B,L,bBL);
      var cg=ctx.createRadialGradient(ridgeX,cy,0, ridgeX,cy,S*0.24);
      cg.addColorStop(0, rgb(pal.hi,0.85)); cg.addColorStop(1, rgb(pal.hi,0));
      ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(ridgeX,cy,S*0.24,0,6.283); ctx.fill();
      var sp = 0.55+0.45*Math.sin(t*1.3);
      var spx = cx + Math.cos(t*1.1)*S*0.15;
      var spy = top + (bot-top)*(0.30+0.14*Math.sin(t*0.9));
      ctx.fillStyle=rgb([255,255,255], 0.85*sp);
      ctx.beginPath(); ctx.arc(spx,spy, S*0.032*sp+0.5, 0,6.283); ctx.fill();
      ctx.restore();

      // arêtes cristallines (contour + les deux arêtes centrales)
      ctx.lineJoin='round';
      ctx.strokeStyle=rgb(pal.hi,0.55); ctx.lineWidth=Math.max(1,S*0.012);
      ctx.beginPath();
      ctx.moveTo(T[0],T[1]); ctx.lineTo(L[0],L[1]); ctx.lineTo(B[0],B[1]); ctx.lineTo(R[0],R[1]); ctx.closePath();
      ctx.moveTo(T[0],T[1]); ctx.lineTo(B[0],B[1]);
      ctx.moveTo(L[0],L[1]); ctx.lineTo(R[0],R[1]);
      ctx.stroke();
    }

    function frame(){ raf=0; if(!onScreen||disposed) return; t+=0.03; draw(); loop(); }
    function loop(){ if(!raf && onScreen && !disposed) raf=requestAnimationFrame(frame); }
    function onResize(){ if(disposed) return; sizeUp(); }
    addEventListener('resize', onResize, { passive:true });
    loop();

    return { dispose:function(){
      if (disposed) return; disposed = true;
      if (raf) cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
    } };
  }

  /* ─────────────────────────────────────────────────────────────────
     DIAMANT DE VERRE — WebGL (desktop uniquement)
     ───────────────────────────────────────────────────────────────── */
  function makeDiamond(canvas, idx){
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas:canvas, antialias:!MOBILE, alpha:true, powerPreference:'default', failIfMajorPerformanceCaveat:false });
    } catch(e){ svgGem(canvas); return null; }

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
