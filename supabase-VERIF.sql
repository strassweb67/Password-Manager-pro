-- ═══════════════════════════════════════════════════════════════════════════
--  VÉRIFICATION — état réel de la base, sans rien modifier
--  Lecture seule : cette requête n'écrit rien, ne crée rien, ne supprime rien.
--  Coller dans SQL Editor → Run → copier le tableau résultat.
-- ═══════════════════════════════════════════════════════════════════════════

select 'A. colonnes diag_leads' as controle,
       coalesce((select string_agg(column_name, ', ' order by ordinal_position)
                   from information_schema.columns
                  where table_schema='public' and table_name='diag_leads'),
                '❌ TABLE ABSENTE') as resultat

union all
select 'B. fonctions paiement',
       coalesce((select string_agg(proname || '(' || pg_get_function_identity_arguments(oid) || ')', '  |  ' order by proname)
                   from pg_proc
                  where pronamespace='public'::regnamespace and proname like 'rn|_%' escape '|'),
                '❌ AUCUNE')

union all
select 'C. table rn_payments',
       coalesce((select string_agg(column_name, ', ' order by ordinal_position)
                   from information_schema.columns
                  where table_schema='public' and table_name='rn_payments'),
                '❌ ABSENTE')

union all
select 'D. colonnes traffic_stats',
       coalesce((select string_agg(column_name, ', ' order by ordinal_position)
                   from information_schema.columns
                  where table_schema='public' and table_name='traffic_stats'),
                '❌ ABSENTE')

union all
select 'E. conflit increment_traffic_source',
       coalesce((select case when pg_get_functiondef(oid) like '%stat|_date, source%' escape '|'
                             then '✅ (stat_date, source) — correct'
                             else '❌ mauvaise clé de conflit — relancer supabase-CORRECTIF.sql' end
                   from pg_proc
                  where pronamespace='public'::regnamespace and proname='increment_traffic_source'
                  limit 1),
                '❌ FONCTION ABSENTE')

union all
select 'F. index fautif sur (source)',
       coalesce((select '❌ ENCORE PRÉSENT — relancer supabase-CORRECTIF.sql'
                   from pg_indexes
                  where schemaname='public' and indexname='traffic_stats_source_uidx'
                  limit 1),
                '✅ absent, c''est bon')

union all
select 'G. policies diag_leads',
       coalesce((select string_agg(policyname || ' [' || cmd || ']', '  |  ' order by policyname)
                   from pg_policies
                  where schemaname='public' and tablename='diag_leads'),
                '❌ AUCUNE — les insertions échoueront')

union all
select 'H. contenu',
       (select 'diag=' || count(*) filter (where source='diag')
             || ' · zyra=' || count(*) filter (where source='zyra')
             || ' · bgh=' || count(*) filter (where source='bgh-party')
             || ' · payés=' || count(*) filter (where paid)
          from public.diag_leads)

union all
select 'I. visiteurs / trafic',
       (select 'visiteurs=' || (select count(*) from public.visitors)
             || ' · lignes traffic_stats=' || (select count(*) from public.traffic_stats)
             || ' · jours page_visits=' || (select count(*) from public.page_visits));
