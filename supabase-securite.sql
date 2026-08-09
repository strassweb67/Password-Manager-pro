-- ═══════════════════════════════════════════════════════════════════════════
--  RENAISSANCE — Écritures du diagnostic sans clé service_role
--
--  À appliquer APRÈS supabase-FINAL.sql, et EN MÊME TEMPS que la modification
--  de index.html décrite dans SECURITE.md (étape 4).
--
--  Aujourd'hui dgSaveSession() écrit dans diag_leads avec la clé service_role,
--  alors qu'il s'agit d'un simple visiteur qui remplit un formulaire. Cette
--  fonction lui donne exactement le droit nécessaire, et rien de plus :
--  écrire SA fiche, identifiée par son jeton privé.
--
--  Ce qu'un visiteur ne peut PAS faire avec cette fonction :
--   • lire ou modifier la fiche de quelqu'un d'autre (jeton inconnu de lui)
--   • se marquer comme payé (le champ `paid` est ignoré, toujours)
--   • toucher à la ligne de configuration du site
--   • supprimer quoi que ce soit
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.rn_save_session(
  p_token text,
  p_body  jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- Jeton obligatoire et de forme plausible : bloque les appels en masse
  -- avec des valeurs vides ou triviales.
  if p_token is null or length(p_token) < 12 then
    raise exception 'jeton invalide';
  end if;

  select id into v_id from public.diag_leads where access_token = p_token;

  if v_id is null then
    -- Création de la fiche. `paid` n'est JAMAIS pris depuis le client :
    -- il garde sa valeur par défaut (false). Seul un encaissement réel,
    -- via rn_confirm_payment(), peut le passer à true.
    insert into public.diag_leads (
      access_token, source, ts,
      email, tel, code_postal, age, profil,
      potentiel, exploite, axe_prioritaire,
      scores, reponses, reponses_texte
    ) values (
      p_token,
      coalesce(nullif(p_body->>'source', '__site_config'), 'diag'),
      coalesce((p_body->>'ts')::timestamptz, now()),
      p_body->>'email',
      p_body->>'tel',
      p_body->>'code_postal',
      p_body->>'age',
      p_body->>'profil',
      nullif(p_body->>'potentiel', '')::int,
      nullif(p_body->>'exploite', '')::int,
      p_body->>'axe_prioritaire',
      p_body->'scores',
      p_body->'reponses',
      p_body->'reponses_texte'
    );

  else
    -- Mise à jour. `coalesce(nouveau, ancien)` : un champ absent du payload
    -- n'efface jamais une valeur déjà enregistrée.
    update public.diag_leads set
      email           = coalesce(p_body->>'email',           email),
      tel             = coalesce(p_body->>'tel',             tel),
      code_postal     = coalesce(p_body->>'code_postal',     code_postal),
      age             = coalesce(p_body->>'age',             age),
      profil          = coalesce(p_body->>'profil',          profil),
      potentiel       = coalesce(nullif(p_body->>'potentiel','')::int, potentiel),
      exploite        = coalesce(nullif(p_body->>'exploite','')::int,  exploite),
      axe_prioritaire = coalesce(p_body->>'axe_prioritaire', axe_prioritaire),
      scores          = coalesce(p_body->'scores',           scores),
      reponses        = coalesce(p_body->'reponses',         reponses),
      reponses_texte  = coalesce(p_body->'reponses_texte',   reponses_texte)
    where id = v_id
      -- Garde-fou : une fiche déjà payée ne peut plus être réécrite par le
      -- navigateur. Empêche qu'une sauvegarde tardive vienne perturber une
      -- vente confirmée.
      and coalesce(paid, false) = false
      and coalesce(source, '') <> '__site_config';
  end if;
end;
$$;

revoke all on function public.rn_save_session(text, jsonb) from public;
grant execute on function public.rn_save_session(text, jsonb) to anon, authenticated;


-- ── Inscriptions Zyra / BGH Party sans service_role ────────────────────────
-- Remplace l'insertion directe de assets/offer.js. Restreinte aux deux seules
-- sources légitimes : impossible de créer une fausse fiche de diagnostic ou
-- d'écraser la ligne de configuration du site.
create or replace function public.rn_signup(
  p_source text,
  p_email  text,
  p_tel    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_source not in ('zyra', 'bgh-party') then
    raise exception 'source non autorisée';
  end if;
  if p_email is null or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'e-mail invalide';
  end if;

  insert into public.diag_leads (source, email, tel, ts)
  values (p_source, lower(trim(p_email)), nullif(trim(coalesce(p_tel, '')), ''), now());
end;
$$;

revoke all on function public.rn_signup(text, text, text) from public;
grant execute on function public.rn_signup(text, text, text) to anon, authenticated;


-- ── Retirer le droit d'insertion directe ───────────────────────────────────
-- ⚠️ À N'EXÉCUTER QU'APRÈS avoir basculé index.html et offer.js sur les deux
-- fonctions ci-dessus. Tant que le code appelle encore l'API REST en direct,
-- garder ces policies actives, sinon diagnostics et inscriptions cessent
-- d'être enregistrés.
--
-- drop policy if exists diag_leads_insert_anon on public.diag_leads;
-- drop policy if exists diag_leads_insert_auth on public.diag_leads;
