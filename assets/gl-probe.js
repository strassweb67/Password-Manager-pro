/* ═══════════════════════════════════════════════════════════════════
   RENAISSANCE — Le WebGL est-il réellement disponible ?

   Les trois modules 3D décidaient auparavant d'après le nom du navigateur :
   toute WebView portant « Instagram », « TikTok », « Snapchat »… se voyait
   refuser le rendu 3D. Or ces WebViews rendent le WebGL, et c'est par elles
   qu'arrive l'essentiel du trafic — le site s'affichait donc en 2D pile là
   où il devait impressionner.

   On demande donc un contexte au navigateur au lieu de le déduire de son nom.
   Le contexte de test est relâché aussitôt : garder un contexte inutile
   compte dans le quota (8 à 16 selon les appareils) et ferait échouer un
   canvas plus loin dans la page.
   ═══════════════════════════════════════════════════════════════════ */
let cache = null;

export function glSupported(){
  if (cache !== null) return cache;
  cache = false;
  try {
    const c  = document.createElement('canvas');
    const gl = c.getContext('webgl2')
            || c.getContext('webgl')
            || c.getContext('experimental-webgl');
    if (gl && typeof gl.getParameter === 'function' && gl.getParameter(gl.VERSION)) {
      cache = true;
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
  } catch(e){ cache = false; }
  return cache;
}
