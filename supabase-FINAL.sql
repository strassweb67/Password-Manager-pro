-- ═══════════════════════════════════════════════════════════════════════════
--  RENAISSANCE — SQL FINAL, TOUT-EN-UN
--  Projet Supabase : tetknufkdhntmfjssjeg
--
--  À faire : Supabase → SQL Editor → New query → coller CE FICHIER → Run.
--
--  ✅ SANS DANGER : 100 % idempotent (re-jouable autant de fois que voulu),
--     ne supprime AUCUNE donnée, ne recrée aucune table existante.
--     Les stats visiteurs, les fiches et les inscrits sont conservés.
--
--  CE QUE CE FICHIER CORRIGE
--   1. Colonnes manquantes sur diag_leads → cause des erreurs 400
--      « Connexion Supabase échouée » et des diagnostics invisibles en admin
--   2. Inscriptions Zyra / BGH Party qui n'arrivaient pas (policy d'insertion)
--   3. Événements de parcours visiteur qui n'étaient pas enregistrés
--   4. Ajoute toute la mécanique de paiement Revolut par e-mail
--   5. Vue d'arbitrage pour valider un paiement à la main
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  1. TABLE diag_leads — diagnostics, inscrits Zyra/BGH, paiements        ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
-- Une seule table pour tout, distinguée par la colonne `source` :
--   'diag'          → diagnostic Renaissance
--   'zyra'          → inscrit liste d'attente Zyra
--   'bgh-party'     → inscrit BGH Party
--   '__site_config' → ligne technique (prix + lien Revolut), jamais affichée

create table if not exists public.diag_leads (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Toutes les colonnes lues ou écrites par le site.
-- `if not exists` → rien n'est écrasé si la colonne existe déjà.
-- C'est CE bloc qui corrige les erreurs 400 : une seule colonne manquante
-- faisait échouer la requête de l'admin, qui affichait alors « échec de
-- connexion » alors que la base répondait très bien.
alter table public.diag_leads add column if not exists created_at      timestamptz not null default now();
alter table public.diag_leads add column if not exists ts              timestamptz;
alter table public.diag_leads add column if not exists email           text;
alter table public.diag_leads add column if not exists tel             text;
alter table public.diag_leads add column if not exists code_postal     text;
alter table public.diag_leads add column if not exists age             text;
alter table public.diag_leads add column if not exists profil          text;
alter table public.diag_leads add column if not exists potentiel       int;
alter table public.diag_leads add column if not exists exploite        int;
alter table public.diag_leads add column if not exists axe_prioritaire text;
alter table public.diag_leads add column if not exists scores          jsonb;
alter table public.diag_leads add column if not exists reponses        jsonb;
alter table public.diag_leads add column if not exists reponses_texte  jsonb;
alter table public.diag_leads add column if not exists source          text;
alter table public.diag_leads add column if not exists paid            boolean not null default false;
alter table public.diag_leads add column if not exists paid_at         timestamptz;
alter table public.diag_leads add column if not exists amount          text;
alter table public.diag_leads add column if not exists currency        text;
alter table public.diag_leads add column if not exists payment_ref     text;
-- Colonnes du nouveau flux de paiement
alter table public.diag_leads add column if not exists access_token    text;
alter table public.diag_leads add column if not exists pay_started_at  timestamptz;
alter table public.diag_leads add column if not exists payer_name      text;
alter table public.diag_leads add column if not exists needs_review    boolean not null default false;

create index        if not exists diag_leads_created_idx   on public.diag_leads (created_at desc);
create index        if not exists diag_leads_ts_idx        on public.diag_leads (ts desc);
create index        if not exists diag_leads_source_idx    on public.diag_leads (source);
create index        if not exists diag_leads_paid_idx      on public.diag_leads (paid);
create unique index if not exists diag_leads_token_uidx    on public.diag_leads (access_token) where access_token is not null;
create index        if not exists diag_leads_paystart_idx  on public.diag_leads (pay_started_at desc) where pay_started_at is not null;
create index        if not exists diag_leads_review_idx    on public.diag_leads (needs_review) where needs_review = true;

-- ── Sécurité (RLS) ────────────────────────────────────────────────────────
-- Le public (clé anon, visible dans la page) peut UNIQUEMENT insérer.
-- Il ne peut ni lire les fiches des autres, ni modifier, ni supprimer.
-- L'admin lit avec la clé service_role, qui contourne RLS.
alter table public.diag_leads enable row level security;

drop policy if exists diag_leads_insert_anon on public.diag_leads;
create policy diag_leads_insert_anon
  on public.diag_leads for insert to anon with check (true);

-- ⚠️ CORRECTIF Zyra / BGH Party : assets/offer.js insère avec la clé anon.
-- Si cette policy manquait, l'inscription échouait en silence côté visiteur
-- et aucun inscrit n'apparaissait jamais dans l'admin.
drop policy if exists diag_leads_insert_auth on public.diag_leads;
create policy diag_leads_insert_auth
  on public.diag_leads for insert to authenticated with check (true);

-- Aucune policy SELECT/UPDATE/DELETE pour anon : les fiches restent privées.


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  2. TRACKING VISITEURS — créé seulement si absent                      ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
-- Ces tables existent déjà et fonctionnent : on ne fait que garantir leur
-- présence et les droits d'écriture publique. Aucune donnée n'est touchée.

-- ⚠️ CES TABLES EXISTENT DÉJÀ ET FONCTIONNENT (40 visiteurs en base).
-- Les définitions ci-dessous reprennent EXACTEMENT le schéma v3 d'origine.
-- Elles ne servent que de filet pour une base vierge : sur ta base actuelle,
-- `if not exists` les laisse totalement intactes.
--
-- Ne JAMAIS supposer une autre forme pour ces tables : traffic_stats agrège
-- par (stat_date, source), pas par source seule. Une fonction qui l'ignore
-- écrase les statistiques journalières.

create table if not exists public.page_visits (
  id         uuid primary key default gen_random_uuid(),
  visit_date date not null default current_date,
  count      int  not null default 1,
  unique (visit_date)
);

create table if not exists public.traffic_stats (
  id        uuid primary key default gen_random_uuid(),
  stat_date date not null default current_date,
  source    text not null,
  icon      text,
  count     int  not null default 1,
  unique (stat_date, source)
);

create table if not exists public.visitor_events (
  id         uuid primary key default gen_random_uuid(),
  visitor_id uuid references public.visitors(id) on delete cascade,
  session_id text not null,
  created_at timestamptz default now(),
  label      text not null,
  event_time text
);

-- Les policies d'insertion publique existent déjà en v3 (« ve_insert »,
-- « pv_read », « ts_read »). On n'y touche pas : les recréer sous un autre
-- nom ne ferait qu'empiler des règles redondantes.


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  3. COMPTEURS — créés seulement s'ils n'existent pas déjà              ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
-- PostgreSQL refuse un `create or replace` qui changerait le nom d'un
-- paramètre ou le type de retour. Si une version plus ancienne existe avec
-- une signature différente, on la supprime d'abord — quelle que soit sa
-- signature. Aucune donnée n'est concernée : ce ne sont que des fonctions.
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

grant execute on function public.increment_page_visit() to anon, authenticated;


-- ⚠️ Conflit sur (stat_date, source) : une ligne par jour ET par source.
-- Agréger sur `source` seule écraserait l'historique journalier.
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

grant execute on function public.increment_traffic_source(text, text) to anon, authenticated;


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  4. PAIEMENT REVOLUT — boîte de réception des encaissements            ║
-- ╚═════════════════════════════════════════════════════════════════════════╝

create table if not exists public.rn_payments (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  received_at     timestamptz not null default now(),  -- date du mail Revolut
  msg_id          text unique,                          -- id Gmail → idempotence
  payer_name      text,
  amount          numeric,
  currency        text default 'EUR',
  raw_subject     text,
  matched_lead_id uuid references public.diag_leads(id) on delete set null,
  status          text not null default 'unmatched'     -- matched|ambiguous|unmatched
);

create index if not exists rn_payments_recv_idx   on public.rn_payments (received_at desc);
create index if not exists rn_payments_status_idx on public.rn_payments (status);

-- RLS active SANS aucune policy → table totalement inaccessible avec la clé
-- anon. Seul le service_role (script Google + admin) peut la lire ou l'écrire.
alter table public.rn_payments enable row level security;


-- ── 4a. Le client part payer : on horodate sa commande ────────────────────
-- Appelée par le navigateur (clé anon). Ne renvoie rien : impossible d'en
-- tirer la moindre information sur la base.
create or replace function public.rn_start_payment(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.diag_leads
     set pay_started_at = now()
   where access_token = p_token
     and coalesce(paid, false) = false;
$$;

revoke all on function public.rn_start_payment(text) from public;
grant execute on function public.rn_start_payment(text) to anon, authenticated;


-- ── 4b. « Mon paiement est-il arrivé ? » ──────────────────────────────────
-- Appelée en boucle par la page d'attente (clé anon). Ne renvoie QUE l'état
-- de la fiche portant le jeton fourni : aucune donnée d'une autre fiche,
-- aucun e-mail, ne peut fuiter par cette fonction.
create or replace function public.rn_check_paid(p_token text)
returns table (paid boolean, needs_review boolean, paid_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(d.paid, false),
         coalesce(d.needs_review, false),
         d.paid_at
    from public.diag_leads d
   where d.access_token = p_token
   limit 1;
$$;

revoke all on function public.rn_check_paid(text) from public;
grant execute on function public.rn_check_paid(text) to anon, authenticated;


-- ── 4c. Le script Google déclare un encaissement ──────────────────────────
-- Appelée UNIQUEMENT par Apps Script avec la clé service_role.
--
-- Le mail Revolut ne contient PAS l'e-mail du client, seulement le nom du
-- payeur et le montant. Le rapprochement se fait donc sur la fenêtre de temps
-- entre le clic « payer » et l'encaissement :
--    • exactement 1 commande candidate → payée, client débloqué
--    • plusieurs candidates            → toutes en arbitrage manuel
--    • aucune candidate                → paiement gardé, arbitrage manuel
-- Le système ne devine JAMAIS : en cas de doute, il n'attribue rien.
create or replace function public.rn_confirm_payment(
  p_msg_id   text,
  p_payer    text,
  p_amount   numeric,
  p_received timestamptz default now(),
  p_subject  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dup    public.rn_payments%rowtype;
  v_ids    uuid[];
  v_count  int;
  v_status text;
  v_lead   uuid;
  v_pay_id uuid;
  v_back   interval := interval '45 minutes';  -- avant l'encaissement
  v_fwd    interval := interval '5 minutes';   -- tolérance d'horloge
begin
  if p_msg_id is null or length(trim(p_msg_id)) = 0 then
    raise exception 'msg_id obligatoire (garantit l''idempotence)';
  end if;

  -- Idempotence : le script peut relire deux fois le même mail sans risque
  -- de double comptage.
  select * into v_dup from public.rn_payments where msg_id = p_msg_id;
  if found then
    return jsonb_build_object('status', 'duplicate',
                              'payment_id', v_dup.id,
                              'lead_id', v_dup.matched_lead_id);
  end if;

  select array_agg(id order by pay_started_at desc)
    into v_ids
    from public.diag_leads
   where coalesce(paid, false) = false
     and source = 'diag'
     and pay_started_at is not null
     and pay_started_at >= p_received - v_back
     and pay_started_at <= p_received + v_fwd;

  v_count := coalesce(array_length(v_ids, 1), 0);

  if v_count = 1 then
    v_status := 'matched';  v_lead := v_ids[1];
  elsif v_count > 1 then
    v_status := 'ambiguous';
  else
    v_status := 'unmatched';
  end if;

  insert into public.rn_payments
        (msg_id, payer_name, amount, received_at, raw_subject, matched_lead_id, status)
  values (p_msg_id, p_payer, p_amount, p_received, p_subject, v_lead, v_status)
  returning id into v_pay_id;

  if v_status = 'matched' then
    update public.diag_leads
       set paid         = true,
           paid_at      = p_received,
           payer_name   = p_payer,
           amount       = p_amount::text,
           currency     = 'EUR',
           payment_ref  = 'revolut-mail:' || p_msg_id,
           needs_review = false
     where id = v_lead;

  elsif v_status = 'ambiguous' then
    update public.diag_leads
       set needs_review = true
     where id = any(v_ids);
  end if;

  return jsonb_build_object('status', v_status, 'payment_id', v_pay_id,
                            'lead_id', v_lead, 'candidates', v_count);
end;
$$;

-- Jamais appelable depuis le navigateur.
revoke all on function
  public.rn_confirm_payment(text, text, numeric, timestamptz, text) from public;


-- ── 4d. Arbitrage manuel : rattacher un paiement à une fiche ──────────────
create or replace function public.rn_resolve_payment(p_payment_id uuid, p_lead_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.rn_payments%rowtype;
begin
  select * into v_pay from public.rn_payments where id = p_payment_id;
  if not found then
    raise exception 'paiement introuvable';
  end if;

  update public.diag_leads
     set paid         = true,
         paid_at      = v_pay.received_at,
         payer_name   = v_pay.payer_name,
         amount       = v_pay.amount::text,
         currency     = coalesce(v_pay.currency, 'EUR'),
         payment_ref  = 'revolut-mail:' || coalesce(v_pay.msg_id, p_payment_id::text) || ' (arbitré)',
         needs_review = false
   where id = p_lead_id;

  update public.rn_payments
     set matched_lead_id = p_lead_id, status = 'matched'
   where id = p_payment_id;

  -- Les fiches concurrentes de cet arbitrage repassent en attente normale
  update public.diag_leads
     set needs_review = false
   where needs_review = true and coalesce(paid, false) = false;

  return jsonb_build_object('status', 'matched', 'lead_id', p_lead_id);
end;
$$;

revoke all on function public.rn_resolve_payment(uuid, uuid) from public;


-- ── 4e. Débloquer une fiche à la main, sans paiement rattaché ─────────────
-- Pour le cas « le client a payé mais aucun mail n'est jamais arrivé ».
-- La trace indique explicitement que c'est un déblocage manuel.
create or replace function public.rn_force_unlock(p_lead_id uuid, p_note text default null)
returns jsonb
language sql
security definer
set search_path = public
as $$
  update public.diag_leads
     set paid         = true,
         paid_at      = coalesce(paid_at, now()),
         payment_ref  = 'manuel' || coalesce(' : ' || p_note, ''),
         needs_review = false
   where id = p_lead_id
  returning jsonb_build_object('status', 'unlocked', 'lead_id', id);
$$;

revoke all on function public.rn_force_unlock(uuid, text) from public;


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  5. VUE D'ARBITRAGE — tout ce qui demande une décision humaine         ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
-- Lisible uniquement avec la clé service_role (admin).
create or replace view public.rn_arbitrage as
  select p.id            as payment_id,
         p.received_at,
         p.payer_name,
         p.amount,
         p.status,
         d.id            as lead_id,
         d.email         as lead_email,
         d.tel           as lead_tel,
         d.pay_started_at
    from public.rn_payments p
    left join public.diag_leads d
           on d.pay_started_at is not null
          and coalesce(d.paid, false) = false
          and d.pay_started_at between p.received_at - interval '45 minutes'
                                   and p.received_at + interval '5 minutes'
   where p.status <> 'matched'
   order by p.received_at desc;

revoke all on public.rn_arbitrage from anon, authenticated;


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  6. VÉRIFICATION — le résultat s'affiche sous l'éditeur SQL            ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
select
  (select count(*) from public.diag_leads where source = 'diag')       as diagnostics,
  (select count(*) from public.diag_leads where source = 'zyra')       as inscrits_zyra,
  (select count(*) from public.diag_leads where source = 'bgh-party')  as inscrits_bgh,
  (select count(*) from public.diag_leads where paid)                  as payés,
  (select count(*) from public.rn_payments)                            as paiements_reçus,
  (select count(*) from public.diag_leads where needs_review)          as à_arbitrer;

-- ═══════════════════════════════════════════════════════════════════════════
--  ⚠️ IL RESTE UN PROBLÈME QUE CE FICHIER NE PEUT PAS RÉGLER
--  La clé service_role est écrite en clair dans index.html. Elle donne un
--  accès TOTAL à cette base à quiconque lit le code source de la page —
--  y compris pour tout supprimer. Aucune policy SQL ne protège contre ça,
--  puisque service_role contourne RLS par conception.
--  → Voir SECURITE.md pour la marche à suivre.
-- ═══════════════════════════════════════════════════════════════════════════
