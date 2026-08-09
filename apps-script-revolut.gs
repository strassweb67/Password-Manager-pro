/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  RENAISSANCE — Détection automatique des paiements Revolut par e-mail
 *  À installer dans le compte Google : yanisbghdata@gmail.com
 *
 *  CE QUE FAIT CE SCRIPT
 *  Toutes les minutes, il cherche dans cette boîte les notifications Revolut
 *  « vous avez reçu 10 € de X » transférées depuis le compte qui encaisse,
 *  puis il prévient Supabase. La page du client se débloque toute seule.
 *
 *  CE QU'IL NE FAIT PAS
 *  Il ne lit rien d'autre que les mails correspondant au filtre ci-dessous.
 *  Il n'envoie aucun mail. Il ne supprime rien.
 *
 *  INSTALLATION (une seule fois, ~5 minutes)
 *   1. Se connecter sur https://script.google.com AVEC yanisbghdata@gmail.com
 *   2. « Nouveau projet » → coller tout ce fichier
 *   3. Remplir SUPABASE_SERVICE_KEY ci-dessous (Supabase → Project Settings →
 *      API → service_role). NE JAMAIS mettre cette clé dans une page web.
 *   4. Menu ▶ « Exécuter » sur la fonction testerLaConfiguration → autoriser
 *   5. Menu ⏰ « Déclencheurs » → Ajouter un déclencheur :
 *        fonction : verifierPaiements
 *        source   : Horloge  →  Minuteur (minutes)  →  Toutes les minutes
 *
 *  VÉRIFIER QUE ÇA TOURNE : script.google.com → « Exécutions »
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── CONFIGURATION ──────────────────────────────────────────────────────────

var SUPABASE_URL = 'https://tetknufkdhntmfjssjeg.supabase.co';

// ⚠️ Clé service_role. Elle reste ici, dans TON compte Google, jamais dans une
// page web. Supabase → Project Settings → API → service_role → Reveal.
var SUPABASE_SERVICE_KEY = 'À_REMPLIR';

// Montant attendu, en euros. Un mail avec un autre montant est ignoré :
// c'est la garantie qu'un virement sans rapport ne débloque jamais personne.
var MONTANT_ATTENDU = 10;

// Recherche Gmail. Ne remonte que les mails Revolut récents non traités.
// `newer_than:1d` évite de rejouer tout l'historique à chaque exécution.
var RECHERCHE_GMAIL = 'newer_than:1d (from:revolut.com OR subject:Revolut OR "Revolut")';

// Label posé sur les mails déjà traités (créé automatiquement).
var LABEL_TRAITE = 'renaissance-traite';


// ── FONCTION PRINCIPALE (appelée par le déclencheur, toutes les minutes) ───

function verifierPaiements() {
  if (SUPABASE_SERVICE_KEY === 'À_REMPLIR') {
    throw new Error('SUPABASE_SERVICE_KEY non renseignée — voir en haut du fichier.');
  }

  var label = obtenirLabel_(LABEL_TRAITE);
  var fils  = GmailApp.search(RECHERCHE_GMAIL + ' -label:' + LABEL_TRAITE, 0, 30);

  if (!fils.length) return;

  fils.forEach(function (fil) {
    var traiteAuMoinsUn = false;

    fil.getMessages().forEach(function (message) {
      var info = lireNotificationRevolut_(message);
      if (!info) return;                       // pas un « argent reçu » → ignoré

      if (Math.abs(info.montant - MONTANT_ATTENDU) > 0.001) {
        // Montant différent → ce n'est pas une vente du site. On n'y touche pas.
        Logger.log('Ignoré (montant ' + info.montant + ' €) : ' + message.getSubject());
        return;
      }

      var resultat = envoyerASupabase_(info);
      Logger.log(info.payeur + ' · ' + info.montant + ' € → ' + resultat);
      traiteAuMoinsUn = true;
    });

    // Le fil entier est marqué traité : il ne sera plus relu.
    if (traiteAuMoinsUn) fil.addLabel(label);
  });
}


// ── LECTURE D'UNE NOTIFICATION REVOLUT ─────────────────────────────────────

/**
 * Extrait le montant et le nom du payeur d'un mail Revolut.
 * Renvoie null si ce n'est pas une notification « argent reçu ».
 *
 * Revolut a plusieurs formulations selon la langue et le type de virement.
 * On teste plusieurs formats plutôt qu'un seul, pour ne pas rater un paiement.
 */
function lireNotificationRevolut_(message) {
  var sujet = message.getSubject() || '';
  var corps = message.getPlainBody() || '';
  var texte = sujet + '\n' + corps;

  // Doit ressembler à une réception d'argent (FR ou EN)
  var estUneReception =
    /(vous avez re(ç|c)u|argent re(ç|c)u|you (have )?received|received from|paiement re(ç|c)u)/i.test(texte);
  if (!estUneReception) return null;

  var montant = extraireMontant_(texte);
  if (montant === null) return null;

  return {
    msgId:   message.getId(),                  // identifiant Gmail unique → idempotence
    payeur:  extrairePayeur_(texte) || '(inconnu)',
    montant: montant,
    recu:    message.getDate().toISOString(),
    sujet:   sujet.substring(0, 300)
  };
}

/** Trouve le premier montant en euros du texte. Gère « 10,00 € », « €10.00 », « EUR 10 ». */
function extraireMontant_(texte) {
  var motifs = [
    /(\d{1,6}(?:[  ]?\d{3})*(?:[.,]\d{1,2})?)\s*(?:€|EUR|euros?)/i,
    /(?:€|EUR)\s*(\d{1,6}(?:[  ]?\d{3})*(?:[.,]\d{1,2})?)/i
  ];

  for (var i = 0; i < motifs.length; i++) {
    var m = texte.match(motifs[i]);
    if (m) {
      var brut = m[1].replace(/[  ]/g, '').replace(',', '.');
      var val  = parseFloat(brut);
      if (!isNaN(val)) return val;
    }
  }
  return null;
}

/** Extrait le nom du payeur. Sert uniquement à l'arbitrage manuel en cas de doute. */
function extrairePayeur_(texte) {
  var motifs = [
    /re(?:ç|c)u\s+(?:\d[\d\s.,]*\s*(?:€|EUR)\s+)?(?:de la part de|de)\s+([\p{L}][\p{L}\-' .]{1,60}?)\s*(?:\.|\n|,|$)/iu,
    /received\s+(?:[^\n]{0,20}\s+)?from\s+([\p{L}][\p{L}\-' .]{1,60}?)\s*(?:\.|\n|,|$)/iu,
    /from[:\s]+([\p{L}][\p{L}\-' .]{1,60}?)\s*(?:\.|\n|,|$)/iu
  ];

  for (var i = 0; i < motifs.length; i++) {
    var m = texte.match(motifs[i]);
    if (m && m[1]) {
      var nom = m[1].trim().replace(/\s+/g, ' ');
      if (nom.length >= 2) return nom;
    }
  }
  return null;
}


// ── ENVOI VERS SUPABASE ────────────────────────────────────────────────────

function envoyerASupabase_(info) {
  var reponse = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/rn_confirm_payment', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY
    },
    payload: JSON.stringify({
      p_msg_id:   info.msgId,
      p_payer:    info.payeur,
      p_amount:   info.montant,
      p_received: info.recu,
      p_subject:  info.sujet
    }),
    muteHttpExceptions: true
  });

  var code = reponse.getResponseCode();
  var body = reponse.getContentText();

  if (code < 200 || code >= 300) {
    // On laisse remonter : l'erreur apparaît dans « Exécutions » et le mail
    // n'est PAS marqué traité, donc il sera réessayé à la minute suivante.
    throw new Error('Supabase HTTP ' + code + ' — ' + body);
  }
  return body;
}


// ── OUTILS ─────────────────────────────────────────────────────────────────

function obtenirLabel_(nom) {
  return GmailApp.getUserLabelByName(nom) || GmailApp.createLabel(nom);
}


// ── TEST MANUEL (à lancer une fois après l'installation) ───────────────────

/**
 * Vérifie la configuration sans rien modifier :
 *  • la clé Supabase est renseignée et la connexion passe
 *  • les mails Revolut sont bien trouvés dans cette boîte
 *  • le montant et le nom du payeur sont correctement lus
 * Résultat dans le journal (Ctrl+Entrée ou menu « Journal d'exécution »).
 */
function testerLaConfiguration() {
  Logger.log('── Configuration ──');
  Logger.log('Clé Supabase : ' + (SUPABASE_SERVICE_KEY === 'À_REMPLIR'
    ? '❌ NON RENSEIGNÉE'
    : '✅ renseignée (' + SUPABASE_SERVICE_KEY.substring(0, 12) + '…)'));
  Logger.log('Montant attendu : ' + MONTANT_ATTENDU + ' €');

  Logger.log('');
  Logger.log('── Mails Revolut trouvés (7 derniers jours) ──');
  var fils = GmailApp.search('newer_than:7d (from:revolut.com OR subject:Revolut OR "Revolut")', 0, 10);

  if (!fils.length) {
    Logger.log('❌ Aucun mail Revolut dans cette boîte.');
    Logger.log('   → Le transfert filtré n\'est pas encore actif, ou les mails');
    Logger.log('     arrivent sur une autre adresse.');
    return;
  }

  var lisibles = 0;
  fils.forEach(function (fil) {
    fil.getMessages().forEach(function (message) {
      var info = lireNotificationRevolut_(message);
      if (info) {
        lisibles++;
        Logger.log('✅ ' + info.payeur + ' · ' + info.montant + ' € · ' + info.recu
          + (Math.abs(info.montant - MONTANT_ATTENDU) > 0.001 ? '   (montant ≠ ' + MONTANT_ATTENDU + ' € → serait ignoré)' : ''));
      } else {
        Logger.log('➖ non reconnu comme réception : « ' + message.getSubject() + ' »');
      }
    });
  });

  Logger.log('');
  if (lisibles === 0) {
    Logger.log('⚠️ Des mails Revolut existent mais aucun n\'est lu comme une réception.');
    Logger.log('   → Envoie-moi le texte exact d\'un de ces mails, j\'ajuste la lecture.');
  } else {
    Logger.log('✅ ' + lisibles + ' notification(s) correctement lue(s).');
    Logger.log('   Il reste à créer le déclencheur « toutes les minutes » sur verifierPaiements.');
  }
}
