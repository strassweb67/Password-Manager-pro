/* Génère une version 100% à plat (sans dossier) dans ./flat/
   — CSS + polices intégrés dans le HTML (base64)
   — JS gardés en fichiers séparés (fiable, identique au site en ligne)
   — 4 libs d'animation concaténées en un seul anim.js (économie de fichiers)
   Résultat : ~12 fichiers plats, prêts à uploader un par un sur GitHub. */
const fs = require('fs'), path = require('path');
const R = '/home/user/Password-Manager-pro';
const OUT = path.join(R, 'flat');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const read = p => fs.readFileSync(path.join(R, p), 'utf8');
const b64 = p => fs.readFileSync(path.join(R, p)).toString('base64');

// 1) CSS + polices en base64 (l'intégration CSS est sûre : pas d'analyse JS)
let css = read('assets/redesign.css');
const fonts = {
  'fonts/inter-latin-wght-normal.woff2': 'assets/fonts/inter-latin-wght-normal.woff2',
  'fonts/inter-latin-ext-wght-normal.woff2': 'assets/fonts/inter-latin-ext-wght-normal.woff2',
  'fonts/archivo-latin-wght-normal.woff2': 'assets/fonts/archivo-latin-wght-normal.woff2',
  'fonts/archivo-latin-ext-wght-normal.woff2': 'assets/fonts/archivo-latin-ext-wght-normal.woff2',
  'fonts/cinzel-latin-wght.woff2': 'assets/fonts/cinzel-latin-wght.woff2',
};
for (const [ref, file] of Object.entries(fonts)) {
  const data = 'data:font/woff2;base64,' + b64(file);
  css = css.split("url('" + ref + "')").join("url(" + data + ")");
}

// 2) HTML
let html = read('index.html');

// 2z) images → intégrées en base64 dans le HTML (qualité 100% identique,
//     fichiers d'origine inchangés) : rien d'externe, tout dans index.html
const mime = f => f.endsWith('.png') ? 'image/png' : 'image/jpeg';
const dataURI = f => 'data:' + mime(f) + ';base64,' + b64(f);
// l'avatar est désormais intégré (ne peut plus échouer) → on retire le fallback
// onerror qui, sinon, doublerait l'image en base64 (~3 Mo inutiles)
html = html.split(` onerror="this.src='./avatar-yanis.jpg'"`).join('');
['yanis-lambo.jpg', 'avatar-yanis.jpg', 'bg-bgh-party.png', 'bg-renaissance.jpg'].forEach(f => {
  html = html.split('./' + f).join(dataURI(f));
});
// avatar : source principale pointant vers un ancien dépôt → image intégrée
html = html.split('https://raw.githubusercontent.com/yanis-bgh/renaissance/main/avatar-yanis.jpg')
           .join(dataURI('avatar-yanis.jpg'));

// 2a) CSS intégré
html = html.replace('<link rel="stylesheet" href="assets/redesign.css?v=14">',
  '<style id="redesign-css">\n' + css + '\n</style>');

// 2b) importmap → three à plat
html = html.replace(
  '<script type="importmap">{"imports":{"three":"./assets/vendor/three/three.module.js","three/addons/":"./assets/vendor/three/jsm/"}}</script>',
  '<script type="importmap">{"imports":{"three":"./three.module.js"}}</script>');

// 2c) 4 libs d'animation → un seul anim.js (concaténation ordonnée, comme un bundler)
html = html.replace('<script src="assets/vendor/gsap.min.js" defer></script>',
  '<script src="anim.js" defer></script>');
html = html.replace('<script src="assets/vendor/ScrollTrigger.min.js" defer></script>', '');
html = html.replace('<script src="assets/vendor/lenis.min.js" defer></script>', '');
html = html.replace('<script src="assets/cine-gsap.js?v=11" defer></script>', '');

// 2d) modules WebGL → fichiers séparés à plat
html = html.replace('<script type="module" src="assets/gi-webgl.js?v=20"></script>',
  '<script type="module" src="gi-webgl.js"></script>');
html = html.replace('<script type="module" src="assets/hero-webgl.js?v=8"></script>',
  '<script type="module" src="hero-webgl.js"></script>');
html = html.replace('<script type="module" src="assets/accent-webgl.js?v=5"></script>',
  '<script type="module" src="accent-webgl.js"></script>');

fs.writeFileSync(path.join(OUT, 'index.html'), html);

// 3) anim.js = gsap + ScrollTrigger + lenis + cine-gsap (dans l'ordre)
const anim = [
  'assets/vendor/gsap.min.js',
  'assets/vendor/ScrollTrigger.min.js',
  'assets/vendor/lenis.min.js',
  'assets/cine-gsap.js',
].map(f => '/* ' + f + ' */\n' + read(f)).join('\n;\n');
fs.writeFileSync(path.join(OUT, 'anim.js'), anim);

// 4) modules WebGL : imports addons réécrits à plat
const fixImports = s => s
  .replace("from 'three/addons/environments/RoomEnvironment.js'", "from './RoomEnvironment.js'")
  .replace("from 'three/addons/loaders/SVGLoader.js'", "from './SVGLoader.js'");
fs.writeFileSync(path.join(OUT, 'gi-webgl.js'), fixImports(read('assets/gi-webgl.js')));
fs.writeFileSync(path.join(OUT, 'hero-webgl.js'), fixImports(read('assets/hero-webgl.js')));
fs.writeFileSync(path.join(OUT, 'accent-webgl.js'), fixImports(read('assets/accent-webgl.js')));

// 5) three (à plat) + addons
const copy = (src, dst) => fs.copyFileSync(path.join(R, src), path.join(OUT, dst));
copy('assets/vendor/three/three.module.js', 'three.module.js');
copy('assets/vendor/three/three.core.js', 'three.core.js');
copy('assets/vendor/three/jsm/environments/RoomEnvironment.js', 'RoomEnvironment.js');
copy('assets/vendor/three/jsm/loaders/SVGLoader.js', 'SVGLoader.js');

// 6) images : PLUS copiées — chargées depuis GitHub (RAW) → rien à uploader

const files = fs.readdirSync(OUT);
console.log('FLAT files (' + files.length + '):');
files.forEach(f => console.log('  ' + f + '  ' + (fs.statSync(path.join(OUT, f)).size/1024).toFixed(0) + ' Ko'));
