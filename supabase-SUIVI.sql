-- ═══════════════════════════════════════════════════════════════════════════
--  RENAISSANCE — Suivi des clients par Yanis
--  À exécuter APRÈS supabase-COMPLET.sql : SQL Editor → New query → Run.
--
--  ✅ NON DESTRUCTIF : ajoute deux colonnes et une fonction, ne touche à rien.
--
--  Ce que ça permet dans l'admin :
--   • marquer une fiche « à faire » / « en cours » / « fait »
--   • écrire une note libre sur le client (ce qui a été dit, quoi envoyer…)
--   • le tout enregistré dans Supabase, donc conservé et partagé
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.diag_leads
  add column if not exists suivi_statut text not null default 'a_faire',
  add column if not exists suivi_note   text,
  add column if not exists suivi_maj    timestamptz;

-- Trois valeurs seulement, pour que le tri reste fiable dans le temps.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'diag_leads_suivi_statut_chk') then
    alter table public.diag_leads
      add constraint diag_leads_suivi_statut_chk
      check (suivi_statut in ('a_faire','en_cours','fait'));
  end if;
end $$;

create index if not exists diag_leads_suivi_idx on public.diag_leads (suivi_statut);


-- ── Enregistrer le suivi (admin, service_role) ────────────────────────────
-- Ne touche QUE le suivi : ni le paiement, ni les réponses, ni l'e-mail.
-- Un passage `null` laisse la valeur existante inchangée, ce qui permet de
-- modifier le statut sans écraser la note, et inversement.
create or replace function public.rn_set_suivi(
  p_lead_id uuid,
  p_statut  text default null,
  p_note    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_row public.diag_leads%rowtype;
begin
  if p_statut is not null and p_statut not in ('a_faire','en_cours','fait') then
    raise exception 'statut invalide : %', p_statut;
  end if;

  update public.diag_leads
     set suivi_statut = coalesce(p_statut, suivi_statut),
         suivi_note   = coalesce(p_note,   suivi_note),
         suivi_maj    = now()
   where id = p_lead_id
  returning * into v_row;

  if not found then
    raise exception 'fiche introuvable';
  end if;

  insert into public.rn_history (lead_id, source, email, event, detail)
  values (v_row.id, v_row.source, v_row.email, 'suivi_maj',
          jsonb_build_object('statut', v_row.suivi_statut,
                             'note_presente', v_row.suivi_note is not null));

  return jsonb_build_object('statut', v_row.suivi_statut, 'lead_id', v_row.id);
end;
$$;

revoke all on function public.rn_set_suivi(uuid, text, text) from public;


-- ── Vue de travail : la file d'attente de Yanis ───────────────────────────
create or replace view public.v_suivi as
  select id,
         coalesce(ts, created_at) as date,
         email,
         source,
         profil,
         potentiel,
         paid                     as paye,
         pay_started_at is not null as a_lance_paiement,
         suivi_statut,
         suivi_note,
         suivi_maj
    from public.diag_leads
   where coalesce(source,'diag') <> '__site_config'
   order by (suivi_statut = 'fait'),            -- les « fait » en dernier
            coalesce(ts, created_at) desc;

revoke all on public.v_suivi from anon, authenticated;


-- ── Vérification ──────────────────────────────────────────────────────────
select suivi_statut, count(*) as fiches
  from public.diag_leads
 where coalesce(source,'diag') <> '__site_config'
 group by suivi_statut
 order by suivi_statut;
