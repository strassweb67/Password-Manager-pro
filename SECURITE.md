# Sécurité — sortir la clé `service_role` de la page

## Le problème, sans détour

`index.html` contient ceci, en clair, ligne ~2776 :

```js
const SUPA_SECRET = 'eyJ...service_role...';
```

Cette clé **contourne toutes les protections de la base par conception**.
N'importe qui fait « Afficher le code source » sur le site et obtient :

- la lecture de **toutes** les fiches clients (e-mails, téléphones, codes
  postaux, réponses au diagnostic, paiements)
- le droit de **modifier** n'importe quelle ligne — dont marquer des fiches
  comme payées
- le droit de **tout supprimer**, base entière comprise

Aucune règle SQL ne protège contre ça : `service_role` est *fait* pour passer
outre. Le fichier `supabase-FINAL.sql` ne peut donc rien y faire.

**Ce risque est très supérieur à celui d'un impayé de 10 €.** Si tu ne devais
faire qu'une seule chose de cette liste, c'est celle-là.

---

## Étape 1 — Considérer la clé actuelle comme compromise

Elle a été publiée sur un site en ligne. On ne peut pas savoir qui l'a déjà
copiée. Elle doit être **révoquée**, pas seulement cachée.

Supabase → **Project Settings** → **API** → **service_role** → **Regenerate**.

⚠️ Dès cette régénération, l'admin du site cesse de fonctionner (il utilise
l'ancienne clé). C'est normal et attendu : l'étape 2 le remet en marche.
Prévois de faire les deux d'affilée.

---

## Étape 2 — Déplacer le pouvoir côté serveur

La fonction est déjà écrite : [`supabase/functions/admin/index.ts`](./supabase/functions/admin/index.ts).

Le navigateur n'envoie plus qu'un mot de passe et reçoit uniquement le
résultat demandé. La clé ne quitte plus jamais Supabase.

```bash
# Depuis le dossier du projet
supabase login
supabase link --project-ref tetknufkdhntmfjssjeg

# Mot de passe admin — long, unique, différent de tous tes autres
supabase secrets set ADMIN_PASSWORD='...'

supabase functions deploy admin --no-verify-jwt
```

Avant de déployer, ouvre le fichier et adapte la liste `ORIGINES` à ton
domaine réel : elle empêche un autre site d'appeler ta fonction.

### Ce que la fonction protège déjà

- **Comparaison à temps constant** du mot de passe — un `===` classique
  répond plus vite quand les premiers caractères sont bons, ce qui permet de
  deviner le secret lettre par lettre.
- **CORS restreint** à tes domaines.
- **Messages d'erreur génériques** — aucun détail de schéma ne fuit.
- **Délai fixe** sur mot de passe invalide.

---

## Étape 3 — Remplacer les appels dans `index.html`

Toutes les fonctions qui passent `useSecret = true` doivent passer par la
nouvelle fonction. Ce sont les seules concernées :

| Fonction actuelle | Devient |
|---|---|
| `loadLeads()` | `adminCall('leads')` |
| `sbLoadVisitors()` | `adminCall('visitors')` |
| `sbLoadVisitStats()` | `adminCall('stats')` |
| `rnCfgLoad()` / `rnCfgSave()` | `adminCall('config_get' / 'config_set')` |
| `sbDeleteVisitor()` | `adminCall('delete_visitor', {id})` |

Helper à ajouter, en remplacement de `SUPA_SECRET` :

```js
const ADMIN_FN = 'https://tetknufkdhntmfjssjeg.supabase.co/functions/v1/admin';

async function adminCall(action, params = {}) {
  const r = await fetch(ADMIN_FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, password: window.__admPwd, params })
  });
  if (!r.ok) throw new Error('admin ' + r.status);
  return r.json();
}
```

`window.__admPwd` est le mot de passe saisi à l'ouverture de l'admin, gardé
en mémoire le temps de la session — **jamais** en `localStorage`, qui survit
à la fermeture de l'onglet.

Puis supprimer purement et simplement la ligne `const SUPA_SECRET = …`.

---

## Étape 4 — Les écritures du diagnostic

`dgSaveSession()` écrit aussi avec `service_role`, alors qu'il s'agit d'une
opération faite par un visiteur ordinaire. Elle doit passer par une fonction
SQL restreinte, qui n'autorise qu'une chose : écrire **sa propre** fiche,
identifiée par son jeton.

Le SQL est prêt dans [`supabase-securite.sql`](./supabase-securite.sql).
À appliquer **en même temps** que le changement de code, sinon les
diagnostics ne s'enregistrent plus.

---

## Ordre recommandé

1. Coller `supabase-FINAL.sql` → répare la base, ne casse rien *(à faire maintenant)*
2. Coller `supabase-securite.sql` → ajoute la fonction d'écriture restreinte
3. Déployer l'Edge Function + `ADMIN_PASSWORD`
4. Modifier `index.html` (étapes 3 et 4)
5. **Puis seulement** régénérer la clé `service_role`

Faire la régénération en dernier évite de couper l'admin pendant les travaux.

---

## Ce qui restera à surveiller ensuite

- La clé `anon` reste publique — c'est normal et prévu. Elle ne peut
  qu'insérer, et appeler `rn_start_payment` / `rn_check_paid`, qui ne
  révèlent rien.
- Le mot de passe admin devient le seul rempart : long, unique, et à changer
  si un doute apparaît.
- Les fiches clients contiennent des données personnelles (e-mail, téléphone,
  code postal). Une purge des fiches anciennes et une mention d'information
  sur le site sont à prévoir.
