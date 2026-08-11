/* ═══════════════════════════════════════════════════════════════════════════
   RENAISSANCE — L'adresse saisie existe-t-elle vraiment ?

   Une adresse bien formée n'est pas une adresse valide : « azer@azer.fr »
   satisfait n'importe quelle expression régulière. D'où les fausses adresses
   dans les fiches.

   On vérifie donc que le domaine sait recevoir du courrier, en demandant ses
   enregistrements MX au DNS par HTTPS. C'est ce qui élimine les domaines
   inventés, sans rien envoyer et sans rien changer au parcours.

   Trois limites, assumées et volontaires :
   • On valide le domaine, pas la boîte. « nimportequoi@gmail.com » passera :
     seul un e-mail de confirmation avec lien prouverait qu'une boîte existe,
     et ce parcours n'envoie aucun e-mail.
   • Si le DNS est injoignable, on laisse passer. Bloquer un vrai client à
     cause d'une coupure réseau coûte plus cher qu'une fiche à trier.
   • La liste des adresses jetables est forcément incomplète : il en naît
     chaque semaine. Elle attrape les plus courantes.

   Expose window.rnVerifEmail(adresse) → Promise<{ok, msg}>
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var FORME = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* Il n'y a volontairement aucune liste de fournisseurs de confiance.
     Une première version évitait la requête DNS pour gmail.com, orange.fr et
     consorts — c'était plus rapide, mais ça créait deux chemins de code et
     rendait les essais impossibles à interpréter : une adresse Gmail n'était
     pas vérifiée comme les autres. Toute adresse suit désormais le même
     contrôle, sans exception. */

  /* Adresses jetables : le domaine reçoit vraiment, le MX ne les écarte donc
     pas — mais la boîte s'autodétruit et le client est injoignable. */
  var JETABLES = ('yopmail.com yopmail.fr yopmail.net jetable.org mailinator.com '
    + 'guerrillamail.com sharklasers.com 10minutemail.com 10minutemail.net '
    + 'temp-mail.org tempmail.com tempmail.net throwawaymail.com trashmail.com '
    + 'getnada.com maildrop.cc fakeinbox.com mohmal.com emailondeck.com '
    + 'tempr.email dispostable.com spam4.me mytemp.email moakt.com '
    + 'inboxkitten.com discard.email mailnesia.com armyspy.com cuvox.de '
    + 'dayrep.com einrot.com fleckens.hu gustr.com jourrapide.com '
    + 'rhyta.com superrito.com teleworm.us').split(' ');

  /* Fautes de frappe fréquentes : ces domaines sont souvent déposés et
     répondent au DNS, le contrôle MX les laisserait donc passer. */
  var FAUTES = {
    'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmaill.com': 'gmail.com',
    'gmail.co': 'gmail.com', 'gmail.fr': 'gmail.com', 'gnail.com': 'gmail.com',
    'gmail.cm': 'gmail.com', 'gmail.con': 'gmail.com', 'gamil.com': 'gmail.com',
    'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
    'hotmali.fr': 'hotmail.fr', 'hotmial.fr': 'hotmail.fr',
    'outlok.com': 'outlook.com', 'outlool.com': 'outlook.com', 'outloook.fr': 'outlook.fr',
    'yaho.com': 'yahoo.com', 'yahou.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
    'orang.fr': 'orange.fr', 'oranges.fr': 'orange.fr', 'orange.com': 'orange.fr',
    'wanadou.fr': 'wanadoo.fr', 'wandoo.fr': 'wanadoo.fr',
    'laposte.fr': 'laposte.net', 'lapost.net': 'laposte.net',
    'icloud.fr': 'icloud.com', 'iclould.com': 'icloud.com',
    'fre.fr': 'free.fr', 'sfr.com': 'sfr.fr'
  };

  var memoire = {};   // une adresse n'est interrogée qu'une fois

  /* Interroge le DNS par HTTPS. Deux résolveurs : si le premier ne répond
     pas, le second prend le relais ; si aucun ne répond, on ne bloque pas. */
  function dns(domaine, type) {
    var sources = [
      'https://cloudflare-dns.com/dns-query?type=' + type + '&name=' + encodeURIComponent(domaine),
      'https://dns.google/resolve?type=' + type + '&name=' + encodeURIComponent(domaine)
    ];
    var i = 0;
    function essai() {
      if (i >= sources.length) return Promise.resolve(null);
      var url = sources[i++];
      var opts = { headers: { accept: 'application/dns-json' } };
      if (typeof AbortController === 'function') {
        var ctl = new AbortController();
        opts.signal = ctl.signal;
        setTimeout(function () { try { ctl.abort(); } catch (e) {} }, 5000);
      }
      return fetch(url, opts)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return j || essai(); })
        .catch(function () { return essai(); });
    }
    return essai();
  }

  function verifier(adresse) {
    var em = String(adresse || '').trim();

    if (!FORME.test(em)) return Promise.resolve({ ok: false, msg: 'Entre un email valide.' });

    var dom = em.split('@').pop().toLowerCase();

    if (FAUTES[dom])
      return Promise.resolve({ ok: false, msg: 'Tu voulais sûrement écrire @' + FAUTES[dom] + ' ?' });

    if (JETABLES.indexOf(dom) >= 0)
      return Promise.resolve({ ok: false, msg: 'Les adresses jetables ne sont pas acceptées — mets ton adresse habituelle.' });

    if (memoire[dom]) return Promise.resolve(memoire[dom]);

    var refus = { ok: false, msg: "Ce domaine ne reçoit pas d'e-mails. Vérifie l'adresse." };

    return dns(dom, 'MX').then(function (j) {
      if (!j) return { ok: true, msg: '' };            // DNS muet → on laisse passer
      if (j.Status === 3) {                             // NXDOMAIN : domaine inexistant
        memoire[dom] = refus; return refus;
      }
      /* Avoir un MX ne suffit pas : encore faut-il qu'il mène quelque part.
         azer.fr en est l'exemple — il annonce ms96527062.msv1.invalid.outlook.com,
         le serveur fictif que Microsoft laisse aux domaines déclarés mais
         jamais routés. Le courrier y rebondit.
         On écarte donc d'abord les cibles impossibles par construction : le MX
         nul du standard (RFC 7505, cible réduite à un point), tout nom
         contenant le label réservé « invalid », et localhost. */
      var cibles = (j.Answer || []).filter(function (a) { return a.type === 15; })
        .map(function (a) {
          return String(a.data || '').replace(/^\d+\s+/, '').replace(/\.$/, '').toLowerCase();
        })
        .filter(function (c) {
          return c && c !== 'localhost' && !/(^|\.)invalid(\.|$)/.test(c);
        });

      if (!cibles.length) {
        var avaitMX = (j.Answer || []).some(function (a) { return a.type === 15; });
        if (avaitMX) { memoire[dom] = refus; return refus; }   // que des MX fictifs
      } else {
        /* Puis la règle générale, qui couvre les astuces qu'on n'a pas listées :
           le serveur de courrier annoncé existe-t-il ? */
        return dns(cibles[0], 'A').then(function (m) {
          if (!m) return { ok: true, msg: '' };                // DNS muet → on laisse passer
          var repond = m.Status === 0 && (m.Answer || []).some(function (a) {
            return a.type === 1 || a.type === 5 || a.type === 28;
          });
          memoire[dom] = repond ? { ok: true, msg: '' } : refus;
          return memoire[dom];
        }).catch(function () { return { ok: true, msg: '' }; });
      }

      /* Sans MX, un domaine peut encore recevoir sur son adresse IP :
         on ne refuse qu'après avoir vérifié qu'il n'existe même pas. */
      return dns(dom, 'A').then(function (k) {
        if (!k) return { ok: true, msg: '' };
        var vit = (k.Answer || []).some(function (a) { return a.type === 1 || a.type === 5; });
        memoire[dom] = vit ? { ok: true, msg: '' } : refus;
        return memoire[dom];
      });
    }).catch(function () { return { ok: true, msg: '' }; });
  }

  window.rnVerifEmail = verifier;
})();
