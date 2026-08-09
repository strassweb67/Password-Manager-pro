-- ═══════════════════════════════════════════════════════════════════════════
--  CORRECTIF URGENT — répare les dégâts de supabase-FINAL.sql v1
--
--  À exécuter MAINTENANT : SQL Editor → New query → coller → Run.
--
--  CE QUI S'EST PASSÉ
--  Le script précédent supposait que traffic_stats agrégeait par `source`.
--  En réalité ta table agrège par (stat_date, source) — une ligne par jour
--  et par source. Le script a donc :
--    • supprimé ta fonction increment_traffic_source qui fonctionnait
--    • créé une version qui écrase tout sur une seule ligne par source
--    • ajouté un index unique sur (source) qui empêche toute nouvelle
--      journée d'être enregistrée
--
--  Conséquence : depuis son exécution, le comptage du trafic par source ne
--  fonctionne plus correctement. Les données déjà en base ne sont pas
--  perdues — seule la fonction d'écriture était fausse.
--
--  Ce fichier restaure le comportement d'origine.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Retirer l'index unique fautif ──────────────────────────────────────
-- Il empêchait d'avoir deux jours différents pour une même source.
drop index if exists public.traffic_stats_source_uidx;

-- Index redondant avec la contrainte unique(visit_date) déjà présente.
drop index if exists public.page_visits_date_uidx;


-- ── 2. Retirer la colonne ajoutée à tort ──────────────────────────────────
-- `updated_at` ne fait pas partie du schéma d'origine et n'est utilisée
-- nulle part dans le site.
alter table public.traffic_stats drop column if exists updated_at;


-- ── 3. Restaurer les fonctions d'origine ──────────────────────────────────
-- Suppression de toutes les signatures existantes, puis recréation à
-- l'identique de tes versions v3 qui fonctionnaient.
do $$
declare f record;
begin
  for f in
    select oid::regprocedure as sig
      from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname in ('increment_page_visit', 'increment_traffic_source')
  loop
    execute 'drop function if exists ' || f.sig || ' cascade';
  end loop;
end $$;

-- Compteur de visites journalier — inchangé par rapport à ta v3.
create or replace function public.increment_page_visit()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.page_visits (visit_date, count)
  values (current_date, 1)
  on conflict (visit_date)
  do update set count = public.page_visits.count + 1;
end;
$$;

-- Compteur de trafic par SOURCE ET PAR JOUR — c'est le vrai schéma.
-- `p_icon` reçoit une valeur par défaut pour rester compatible avec les
-- appels du site, qui passent toujours les deux paramètres.
create or replace function public.increment_traffic_source(p_source text, p_icon text default '🏠')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.traffic_stats (stat_date, source, icon, count)
  values (current_date, p_source, p_icon, 1)
  on conflict (stat_date, source)
  do update set count = public.traffic_stats.count + 1;
end;
$$;

grant execute on function public.increment_page_visit()               to anon, authenticated;
grant execute on function public.increment_traffic_source(text, text) to anon, authenticated;


-- ── 4. Vérification ───────────────────────────────────────────────────────
-- Doit afficher 2 lignes : les deux fonctions restaurées.
select p.proname            as fonction,
       pg_get_function_identity_arguments(p.oid) as parametres
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('increment_page_visit', 'increment_traffic_source')
 order by p.proname;

-- Doit afficher les colonnes d'origine, SANS updated_at.
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'traffic_stats'
 order by ordinal_position;

-- Tes données de trafic, intactes.
select stat_date, source, icon, count
  from public.traffic_stats
 order by stat_date desc, count desc
 limit 20;
