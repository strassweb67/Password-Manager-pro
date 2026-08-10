# Paiement Revolut — livraison manuelle par Yanis

Le compte qui encaisse est un **compte Revolut classique**. Il ne peut ni
rediriger le client vers le site, ni le notifier. **Le site ne peut donc pas
savoir si un paiement a eu lieu — et il ne fait pas semblant de le savoir.**

C'est Yanis qui constate l'encaissement sur son Revolut et envoie les accès.

## Le flux

```
1. Le client fait le diagnostic          → 13 questions
2. Il laisse son e-mail à la fin         → la fiche complète part dans l'admin
3. Il clique « Débloquer mon accès »     → écran + compte à rebours 10 s
4. Revolut s'ouvre dans un NOUVEL onglet → il paie ses 10 €
5. Écran final : « tu vas être recontacté par e-mail »
6. Yanis voit le paiement sur son Revolut
   → il envoie les accès par mail
   → il marque la fiche « payé » dans l'admin
```

Le site **n'accorde jamais d'accès tout seul**, ni automatiquement, ni sur
simple déclaration du client. Il transmet l'information, rien de plus.

## Ce que Yanis voit dans l'admin

Ouvrir l'admin → **📋 Fiches clients**.

| Vue | Contenu |
|---|---|
| 🧪 **Tous les diagnostics** | Chaque session : e-mail, tél, code postal, profil, potentiel, scores, **les 13 réponses**, et l'état du paiement |
| 📋 **Fiches clients** | Les diagnostics terminés |
| ⏳ **Diagnostics tentés** | Commencés mais abandonnés |
| 🚀 **Inscrits Zyra** | E-mail + téléphone |
| 🎟️ **Inscrits BGH Party** | E-mail + téléphone |
| ✓ **Paiements validés** | Ceux que Yanis a marqués payés |
| 🕓 **Historique complet** | Le journal horodaté de tout |

Une fiche affiche **« 💳 A cliqué payer »** dès que le client est parti sur
Revolut : c'est le signal pour Yanis d'aller vérifier son compte.

### Marquer un client comme payé

Sur la fiche, bouton **« ✓ Marquer comme payé — accès envoyés »**.
Il n'apparaît que sur les fiches non payées **dont le paiement a été lancé** —
pas de validation accidentelle sur un simple visiteur.

La fiche bascule alors dans **Paiements validés**, et l'action est inscrite
dans l'historique.

## Ce qui se passe si le paiement échoue

| Situation | Résultat |
|---|---|
| Le client annule / revient en arrière | La fiche reste « a cliqué payer », rien de plus |
| Carte refusée | Idem — aucun accès n'est envoyé |
| Il ferme l'onglet | Idem |
| Il tape `?rvlt=success` dans l'URL | **N'accorde aucun accès** |
| Il paie vraiment | Yanis le voit sur Revolut et envoie les accès |

Aucun chemin ne permet à un client de s'accorder l'accès lui-même.

## Installation

Une seule chose à faire : coller
[`supabase-COMPLET.sql`](./supabase-COMPLET.sql) dans **Supabase → SQL Editor
→ Run**. Rien d'autre.

Le lien de paiement se règle dans l'admin (⚙ Configuration) ou dans
`index.html`, variable `PAY.REVOLUT_LINK`.

---

## Option — automatiser la détection (pas nécessaire aujourd'hui)

Tout est déjà en place côté base si vous voulez un jour que le site détecte
les paiements sans intervention :
`apps-script-revolut.gs` lit les notifications Revolut transférées vers une
boîte dédiée et appelle `rn_confirm_payment()`.

Cela suppose que le titulaire du compte accepte de transférer ces
notifications — voir `message-yanis.txt`. **Tant que ce n'est pas activé,
l'onglet « Paiements à arbitrer » reste masqué dans l'admin** et la
livraison se fait à la main, comme décrit plus haut.

L'alternative propre, le jour où le volume le justifie : un vrai compte
marchand (Stripe, Revolut Business) avec webhook signé. Plus simple, plus
sûr, et sans dépendre de la boîte mail de personne.

## ⚠️ Sécurité — point non résolu

La clé `service_role` de Supabase est toujours **écrite en clair dans
`index.html`**. Elle donne un **accès total à la base** à quiconque lit le
code source de la page. Voir [`SECURITE.md`](./SECURITE.md).

C'est le vrai risque du projet — bien avant celui d'un impayé de 10 €.
