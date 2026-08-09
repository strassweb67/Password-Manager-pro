# Paiement Revolut — déblocage automatique sans compte Business

Le compte qui encaisse est un **compte Revolut classique**. Un tel compte ne
peut ni rediriger le client vers le site, ni le notifier. La confirmation
passe donc par la **notification e-mail** que Revolut envoie au titulaire.

## Le flux, de bout en bout

```
1. Le client termine le diagnostic         → une fiche est créée (jeton privé)
2. Il clique « Débloquer mon accès »       → écran d'avertissement + compte à rebours 10 s
3. Revolut s'ouvre dans un NOUVEL onglet   → la page du site reste vivante derrière
4. Il paie ses 10 €                        → Revolut envoie « vous avez reçu 10 € de X »
5. Le mail est transféré vers la boîte dédiée
6. Le script Google le lit (toutes les min) → appelle rn_confirm_payment()
7. La page du client interroge le serveur toutes les 3 s → elle se débloque seule
```

**Le client n'a rien à cliquer pour être débloqué.** Il revient sur l'onglet,
c'est déjà fait.

## Ce qui arrive quand le paiement ne passe pas

| Situation | Résultat |
|---|---|
| Il annule / revient en arrière avant la CB | Aucun mail → **jamais débloqué** |
| Carte refusée | Aucun mail → **jamais débloqué** |
| Il ferme l'onglet Revolut sans payer | Aucun mail → **jamais débloqué** |
| Il tape `?rvlt=success` dans l'URL | **N'accorde plus aucun accès** (faille corrigée) |
| Il paie vraiment | Mail reçu → débloqué en ~1 min |

La seule chose qui débloque un accès est un **encaissement réel**. Il n'existe
aucun chemin où le client s'accorde l'accès lui-même.

---

## Installation

### 1) Base de données — une seule fois

Supabase → **SQL Editor** → **New query** → coller
[`supabase-paiement.sql`](./supabase-paiement.sql) → **Run**.

Crée les colonnes de suivi, la table `rn_payments` et les 4 fonctions
(`rn_start_payment`, `rn_check_paid`, `rn_confirm_payment`, `rn_resolve_payment`).

### 2) Boîte e-mail dédiée

Créer / sécuriser **`yanisbghdata@gmail.com`** — mot de passe fort + **2FA**.
Cette boîte reçoit des données de paiement, elle ne sert qu'à ça.

### 3) Transfert filtré, côté compte qui encaisse

Le message prêt à envoyer est dans `message-yanis.txt`.

**L'ordre compte** — Gmail refuse de transférer vers une adresse non vérifiée :

1. Gmail → **Paramètres** → *Transfert et POP/IMAP* → **Ajouter une adresse de
   transfert** → `yanisbghdata@gmail.com`
2. Google envoie un **code de confirmation** à cette adresse → le récupérer et
   le valider
3. **Ensuite seulement** : Gmail → *Filtres* → **Créer un filtre**
   - De : `revolut.com`
   - Contient les mots : `10,00`
   - Action : **Transférer à** `yanisbghdata@gmail.com`

### 4) Script Google

1. Se connecter à <https://script.google.com> **avec `yanisbghdata@gmail.com`**
2. Nouveau projet → coller [`apps-script-revolut.gs`](./apps-script-revolut.gs)
3. Renseigner `SUPABASE_SERVICE_KEY` (Supabase → Project Settings → API →
   `service_role`)
4. Exécuter **`testerLaConfiguration`** → autoriser → lire le journal
5. ⏰ **Déclencheurs** → `verifierPaiements` → Horloge → Minuteur (minutes) →
   **Toutes les minutes**

`testerLaConfiguration` dit précisément ce qui manque : clé absente, aucun mail
Revolut trouvé, ou format de mail non reconnu.

---

## Rapprochement paiement ↔ client

Le mail Revolut contient le **montant** et le **nom du payeur** — jamais son
e-mail. Le rapprochement se fait donc sur la **fenêtre de temps** : une commande
dont le clic « payer » tombe entre `paiement − 45 min` et `paiement + 5 min`.

| Candidates trouvées | Décision |
|---|---|
| 1 | Paiement validé, client débloqué automatiquement |
| plusieurs | Toutes passent en `needs_review` → arbitrage manuel |
| 0 | Paiement enregistré en `unmatched` → arbitrage manuel |

Le système **ne devine jamais**. En cas de doute il n'attribue rien.

### Arbitrage manuel

Tant que l'onglet dédié n'est pas dans l'admin, l'arbitrage se fait en SQL
(Supabase → SQL Editor) :

```sql
-- Paiements reçus non attribués / ambigus
select p.id, p.received_at, p.payer_name, p.amount, p.status
  from rn_payments p
 where p.status <> 'matched'
 order by p.received_at desc;

-- Commandes en attente autour de ce paiement
select id, email, tel, pay_started_at, needs_review
  from diag_leads
 where coalesce(paid,false) = false
   and pay_started_at is not null
 order by pay_started_at desc
 limit 20;

-- Attribuer le paiement à la bonne fiche (débloque le client)
select rn_resolve_payment('<id-du-paiement>', '<id-de-la-fiche>');
```

Le client dont la page est restée ouverte se débloque dans les 3 secondes qui
suivent, sans rien faire.

---

## Limites connues, en toute transparence

- **Ouverture automatique après le compte à rebours.** Les navigateurs bloquent
  souvent `window.open` sans clic. Le cas est géré : un écran clair avec un gros
  bouton « Ouvrir le paiement Revolut » s'affiche à la place. Le bouton
  « Ouvrir maintenant » du compte à rebours, lui, n'est jamais bloqué.
- **Deux clients au même moment.** Deux paiements de 10 € dans la même fenêtre
  → arbitrage manuel. Rare au volume actuel, mais aucun accès n'est attribué au
  hasard.
- **Le mail doit arriver.** Si le transfert est coupé ou si Revolut change le
  format de ses mails, plus rien n'est détecté automatiquement — les paiements
  restent visibles dans `rn_payments` ou en `unmatched`, rien n'est perdu, mais
  il faut arbitrer à la main. `testerLaConfiguration` sert à le vérifier.
- **Dépendance au titulaire du compte.** Ce montage n'existe que parce que le
  compte encaissant n'est pas le nôtre. Si un jour le site encaisse directement
  (Stripe, Revolut Business), tout ceci disparaît au profit d'un webhook signé,
  plus simple et plus sûr.

## ⚠️ Sécurité — point non résolu

La clé `service_role` de Supabase est toujours **écrite en clair dans
`index.html`** (problème préexistant, déjà signalé dans `SETUP.md`). Elle donne
un **accès total à la base** à quiconque lit le code source de la page.

Le nouveau flux de paiement **n'en dépend pas** côté navigateur : la page
cliente n'appelle que `rn_start_payment()` et `rn_check_paid()`, toutes deux
inoffensives avec la clé publique `anon`. Mais le reste de la page, lui, expose
toujours la clé. **À régénérer et sortir de la page** — c'est le point le plus
grave du projet aujourd'hui, bien avant le risque d'impayé sur 10 €.
