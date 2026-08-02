# Renaissance — Site + Diagnostic + Paiement + Admin

Site multi-pages (accueil, Renaissance, Zyra, BGH Party, 404) avec diagnostic,
paiement Revolut, fiches client et espace admin — le tout branché sur ton
Supabase existant (`tetknufkdhntmfjssjeg`), donc **tes stats visiteurs sont
conservées**.

## Pages
| Fichier | Rôle |
|---|---|
| `index.html` | Accueil (hub : cartes Renaissance / Zyra / BGH Party) |
| `renaissance.html` | Page principale : diagnostic → paiement + admin + CRM |
| `zyra.html`, `bgh-party.html`, `404.html` | Pages existantes |
| `assets/scroll-cine.js` | Animations cinématiques de scroll (parallax + reveal) |

## 1) Base de données (à faire UNE fois)
Ouvre **Supabase → SQL Editor → New query**, colle le contenu de
[`supabase-setup.sql`](./supabase-setup.sql) et clique **Run**.
→ crée la table `diag_leads` (fiches client + paiements) avec la bonne
sécurité (insertion publique via clé `anon`, lecture admin via `service_role`).

Tant que la table n'existe pas, le diagnostic fonctionne quand même (secours
`localStorage`), mais les fiches ne remontent pas dans l'admin.

## 2) Paiement Revolut
Dans `renaissance.html`, cherche `var PAY = {` (bloc `PAIEMENT REVOLUT`) :
1. Revolut Business → **Accepter des paiements → Payment links** → crée un lien
   au montant de ta formation.
2. Colle l'URL dans `REVOLUT_LINK: ""`.
3. Dans les réglages du lien Revolut, mets l'**URL de redirection après
   paiement** sur : `https://TON-DOMAINE/renaissance.html?rvlt=success`

Flux : diagnostic terminé → bouton **« Débloquer mon accès »** → paiement
Revolut → au retour (`?rvlt=success`), la fiche passe automatiquement en
**Paiement validé** et l'écran d'accès s'affiche.
Sans lien configuré, le bouton bascule sur l'offre Skool (secours).

## 3) Admin / CRM
- Ouvre l'admin : clique **« @By Brice Jct »** en bas de `renaissance.html`.
- Mot de passe : identique à ton site actuel.
- Après connexion : bouton **« 📋 Fiches clients »** (en haut à droite) →
  - **Onglet Fiches clients** : toutes les fiches du diagnostic (email, tél, CP,
    âge, profil, scores, les 13 réponses).
  - **Onglet Paiements validés** : uniquement les payés, avec date/heure du
    paiement + toutes les infos du diagnostic.

## ⚠️ Sécurité importante (à traiter)
La clé `service_role` de Supabase est **écrite en clair** dans `renaissance.html`
(ligne `SUPA_SECRET = ...`) — c'était déjà le cas sur ton site d'origine. Cette
clé donne un **accès total** à ta base à quiconque lit le code source de la page.

Recommandé quand tu auras un moment : régénérer cette clé dans Supabase et faire
passer les accès admin par une **Edge Function** (backend) au lieu de la mettre
dans la page. Idem pour vérifier le paiement Revolut côté serveur (webhook +
clé secrète Revolut) plutôt que par la redirection `?rvlt=success`.
