-- ═══════════════════════════════════════════════════════════════════════════
--  RENAISSANCE — SCHÉMA COMPLET, DE A À Z
--  Projet : tetknufkdhntmfjssjeg.supabase.co
--
--  UN SEUL FICHIER pour toute la base : tracking visiteurs, fiches clients,
--  inscriptions Zyra / BGH Party, diagnostics et paiements Revolut.
--
--  ✅ NON DESTRUCTIF : ne supprime aucune donnée, ne vide aucune table.
--     Sur une base existante il complète ce qui manque et laisse le reste
--     intact. Sur une base vierge il monte tout depuis zéro.
--     Re-jouable autant de fois que voulu.
--
--  À faire : SQL Editor → New query → coller → Run.
--
--  ⚠️ Le bloc de remise à zéro est tout en bas, COMMENTÉ. Ne le décommente
--     que si tu acceptes de perdre définitivement visiteurs et fiches.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  1. VISITEURS                                                          ║
-- ╚═════════════════════════════════════════════════════════════════════════╝

create table if not exists public.visitors (
  id            uuid primary key default gen_random_uuid(),
  session_id    text not null unique,
  created_at    timestamptz default now(),
  last_seen     timestamptz default now(),
  visit_count   int         default 1,
  ip_unique_key text,
  ip text, ip_city text, ip_region text, ip_country text,
  ip_org text, ip_postal text, ip_timezone text,
  ip_lat float8, ip_lng float8,
  geoloc_granted boolean default false,
  geoloc_lat float8, geoloc_lng float8,
  geoloc_acc text, geoloc_alt text, geoloc_speed text,
  notif_granted boolean default false,
  traffic_source text default 'Direct',
  traffic_icon   text default '🏠',
  traffic_method text default 'direct',
  utm_source text, utm_medium text, utm_campaign text,
  referrer_raw text,
  os_type text, device_model text, browser text, browser_version text,
  platform text, vendor text, touch_points int,
  hardware_concurrency int, device_memory text,
  screen_w int, screen_h int, screen_avail_w int, screen_avail_h int,
  pixel_ratio float4, inner_w int, inner_h int, color_depth int,
  battery_level text, battery_charging text,
  battery_charge_time text, battery_discharge_time text,
  net_type text, net_downlink text, net_rtt text, net_save_data boolean,
  lang text, langs text, timezone text,
  cookies_enabled boolean, do_not_track text, online boolean,
  user_agent text
);

-- Rattrapage pour une table créée avant ces colonnes
alter table public.visitors add column if not exists last_seen      timestamptz default now();
alter table public.visitors add column if not exists visit_count    int         default 1;
alter table public.visitors add column if not exists ip_unique_key  text;
alter table public.visitors add column if not exists traffic_source text default 'Direct';
alter table public.visitors add column if not exists traffic_icon   text default '🏠';
alter table public.visitors add column if not exists traffic_method text default 'direct';
alter table public.visitors add column if not exists utm_source     text;
alter table public.visitors add column if not exists utm_medium     text;
alter table public.visitors add column if not exists utm_campaign   text;
alter table public.visitors add column if not exists referrer_raw   text;

create unique index if not exists idx_visitors_ip_key   on public.visitors (ip_unique_key) where ip_unique_key is not null;
create index        if not exists idx_visitors_session  on public.visitors (session_id);
create index        if not exists idx_visitors_created  on public.visitors (created_at desc);
create index        if not exists idx_visitors_source   on public.visitors (traffic_source);
create index        if not exists idx_visitors_country  on public.visitors (ip_country);


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  2. SESSIONS DE VISITE                                                 ║
-- ╚═════════════════════════════════════════════════════════════════════════╝

create table if not exists public.visit_sessions (
  id             uuid primary key default gen_random_uuid(),
  visitor_id     uuid references public.visitors(id) on delete cascade,
  ip_key         text not null,
  session_id     text,
  created_at     timestamptz default now(),
  ip             text,
  traffic_source text,
  traffic_icon   text,
  os_type        text,
  browser        text,
  battery_level  text,
  net_type       text,
  screen_w       int,
  screen_h       int,
  geoloc_granted boolean default false,
  notif_granted  boolean default false,
  user_agent     text
);

create index if not exists idx_vs_visitor on public.visit_sessions (visitor_id);
create index if not exists idx_vs_created on public.visit_sessions (created_at desc);
create index if not exists idx_vs_ip_key  on public.visit_sessions (ip_key);


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  3. ÉTAPES DU PARCOURS                                                 ║
-- ╚═════════════════════════════════════════════════════════════════════════╝

create table if not exists public.visitor_events (
  id         uuid primary key default gen_random_uuid(),
  visitor_id uuid references public.visitors(id) on delete cascade,
  session_id text not null,
  created_at timestamptz default now(),
  label      text not null,
  event_time text
);

create index if not exists idx_ve_visitor on public.visitor_events (visitor_id);
create index if not exists idx_ve_session on public.visitor_events (session_id);


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  4. COMPTEURS DE TRAFIC                                                ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
-- ⚠️ traffic_stats agrège par (stat_date, source) : UNE ligne par jour ET
-- par source. Toute fonction qui agrège sur `source` seule écrase
-- l'historique journalier.

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

create index if not exists idx_pv_date        on public.page_visits  (visit_date desc);
create index if not exists idx_ts_date_source on public.traffic_stats (stat_date desc, source);


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  5. FICHES CLIENTS — diagnostics, Zyra, BGH Party, paiements           ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
-- Une seule table, distinguée par `source` :
--   'diag'          → diagnostic Renaissance (fiche client complète)
--   'zyra'          → inscrit liste d'attente Zyra
--   'bgh-party'     → inscrit BGH Party
--   '__site_config' → ligne technique (prix + lien Revolut), jamais affichée

create table if not exists public.diag_leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  ts              timestamptz,
  email           text,
  tel             text,
  code_postal     text,
  age             text,
  profil          text,
  potentiel       int,
  exploite        int,
  axe_prioritaire text,
  scores          jsonb,
  reponses        jsonb,
  reponses_texte  jsonb,
  source          text,
  paid            boolean not null default false,
  paid_at         timestamptz,
  amount          text,
  currency        text,
  payment_ref     text,
  access_token    text,
  pay_started_at  timestamptz,
  payer_name      text,
  needs_review    boolean not null default false
);

-- Rattrapage colonne par colonne : c'est l'absence d'UNE seule d'entre elles
-- qui faisait échouer la requête de l'admin en 400, affiché à tort comme
-- « connexion Supabase échouée » alors que la base répondait normalement.
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
alter table public.diag_leads add column if not exists access_token    text;
alter table public.diag_leads add column if not exists pay_started_at  timestamptz;
alter table public.diag_leads add column if not exists payer_name      text;
alter table public.diag_leads add column if not exists needs_review    boolean not null default false;

create index        if not exists diag_leads_created_idx  on public.diag_leads (created_at desc);
create index        if not exists diag_leads_ts_idx       on public.diag_leads (ts desc);
create index        if not exists diag_leads_source_idx   on public.diag_leads (source);
create index        if not exists diag_leads_paid_idx     on public.diag_leads (paid);
create unique index if not exists diag_leads_token_uidx   on public.diag_leads (access_token) where access_token is not null;
create index        if not exists diag_leads_paystart_idx on public.diag_leads (pay_started_at desc) where pay_started_at is not null;
create index        if not exists diag_leads_review_idx   on public.diag_leads (needs_review) where needs_review = true;


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  6. PAIEMENTS REVOLUT REÇUS                                            ║
-- ╚═════════════════════════════════════════════════════════════════════════╝

create table if not exists public.rn_payments (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  received_at     timestamptz not null default now(),
  msg_id          text unique,
  payer_name      text,
  amount          numeric,
  currency        text default 'EUR',
  raw_subject     text,
  matched_lead_id uuid references public.diag_leads(id) on delete set null,
  status          text not null default 'unmatched'
);

create index if not exists rn_payments_recv_idx   on public.rn_payments (received_at desc);
create index if not exists rn_payments_status_idx on public.rn_payments (status);


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  7. FONCTIONS — tracking                                               ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
-- Suppression préalable de toutes les signatures : PostgreSQL refuse un
-- `create or replace` qui changerait un nom de paramètre ou un type de retour.
do $$
declare f record;
begin
  for f in
    select oid::regprocedure as sig
      from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname in ('increment_page_visit', 'increment_traffic_source', 'upsert_visitor')
  loop
    execute 'drop function if exists ' || f.sig || ' cascade';
  end loop;
end $$;

create or replace function public.increment_page_visit()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.page_visits (visit_date, count)
  values (current_date, 1)
  on conflict (visit_date) do update set count = public.page_visits.count + 1;
end;
$$;

create or replace function public.increment_traffic_source(p_source text, p_icon text default '🏠')
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.traffic_stats (stat_date, source, icon, count)
  values (current_date, p_source, p_icon, 1)
  on conflict (stat_date, source) do update set count = public.traffic_stats.count + 1;
end;
$$;

-- Un seul paramètre JSON : évite toute ambiguïté de signature au GRANT.
create or replace function public.upsert_visitor(payload json)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_ip_key  text;
  v_visitor public.visitors%rowtype;
  v_is_new  boolean := false;
  p         json := payload;
begin
  -- Empreinte : ip + os + navigateur + largeur écran + mémoire
  v_ip_key := md5(
    coalesce(p->>'p_ip','') || coalesce(p->>'p_os_type','') ||
    coalesce(p->>'p_browser','') || coalesce(p->>'p_screen_w','') ||
    coalesce(p->>'p_device_memory','')
  );

  select * into v_visitor from public.visitors where ip_unique_key = v_ip_key limit 1;

  if not found then
    v_is_new := true;
    insert into public.visitors (
      session_id, ip_unique_key, last_seen, visit_count,
      ip, ip_city, ip_region, ip_country, ip_org, ip_postal,
      ip_timezone, ip_lat, ip_lng,
      traffic_source, traffic_icon, traffic_method,
      utm_source, utm_medium, utm_campaign, referrer_raw,
      os_type, device_model, browser, browser_version,
      platform, vendor, touch_points, hardware_concurrency, device_memory,
      screen_w, screen_h, screen_avail_w, screen_avail_h,
      pixel_ratio, inner_w, inner_h, color_depth,
      battery_level, battery_charging, battery_charge_time, battery_discharge_time,
      net_type, net_downlink, net_rtt, net_save_data,
      lang, langs, timezone, cookies_enabled,
      do_not_track, online, user_agent
    ) values (
      p->>'p_session_id', v_ip_key, now(), 1,
      p->>'p_ip', p->>'p_ip_city', p->>'p_ip_region',
      p->>'p_ip_country', p->>'p_ip_org', p->>'p_ip_postal',
      p->>'p_ip_timezone',
      (p->>'p_ip_lat')::float8, (p->>'p_ip_lng')::float8,
      p->>'p_traffic_source', p->>'p_traffic_icon', p->>'p_traffic_method',
      p->>'p_utm_source', p->>'p_utm_medium', p->>'p_utm_campaign',
      p->>'p_referrer_raw',
      p->>'p_os_type', p->>'p_device_model',
      p->>'p_browser', p->>'p_browser_version',
      p->>'p_platform', p->>'p_vendor',
      (p->>'p_touch_points')::int, (p->>'p_hardware_concurrency')::int,
      p->>'p_device_memory',
      (p->>'p_screen_w')::int, (p->>'p_screen_h')::int,
      (p->>'p_screen_avail_w')::int, (p->>'p_screen_avail_h')::int,
      (p->>'p_pixel_ratio')::float4,
      (p->>'p_inner_w')::int, (p->>'p_inner_h')::int, (p->>'p_color_depth')::int,
      p->>'p_battery_level', p->>'p_battery_charging',
      p->>'p_battery_charge_time', p->>'p_battery_discharge_time',
      p->>'p_net_type', p->>'p_net_downlink', p->>'p_net_rtt',
      (p->>'p_net_save_data')::boolean,
      p->>'p_lang', p->>'p_langs', p->>'p_timezone',
      (p->>'p_cookies_enabled')::boolean,
      p->>'p_do_not_track', (p->>'p_online')::boolean, p->>'p_user_agent'
    ) returning * into v_visitor;

  else
    update public.visitors set
      last_seen        = now(),
      visit_count      = visit_count + 1,
      session_id       = p->>'p_session_id',
      battery_level    = p->>'p_battery_level',
      battery_charging = p->>'p_battery_charging',
      net_type         = p->>'p_net_type',
      net_downlink     = p->>'p_net_downlink',
      online           = (p->>'p_online')::boolean,
      traffic_source   = p->>'p_traffic_source',
      traffic_icon     = p->>'p_traffic_icon',
      referrer_raw     = p->>'p_referrer_raw'
    where ip_unique_key = v_ip_key
    returning * into v_visitor;
  end if;

  insert into public.visit_sessions (
    visitor_id, ip_key, session_id, ip, traffic_source, traffic_icon,
    os_type, browser, battery_level, net_type, screen_w, screen_h, user_agent
  ) values (
    v_visitor.id, v_ip_key, p->>'p_session_id',
    p->>'p_ip', p->>'p_traffic_source', p->>'p_traffic_icon',
    p->>'p_os_type', p->>'p_browser',
    p->>'p_battery_level', p->>'p_net_type',
    (p->>'p_screen_w')::int, (p->>'p_screen_h')::int,
    p->>'p_user_agent'
  );

  return json_build_object('is_new', v_is_new, 'visitor_id', v_visitor.id,
                           'visit_count', v_visitor.visit_count);
end;
$$;

grant execute on function public.increment_page_visit()               to anon, authenticated;
grant execute on function public.increment_traffic_source(text, text) to anon, authenticated;
grant execute on function public.upsert_visitor(json)                 to anon, authenticated;


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  8. FONCTIONS — paiement Revolut                                       ║
-- ╚═════════════════════════════════════════════════════════════════════════╝

-- 8a. Le client part payer : on horodate sa commande.
create or replace function public.rn_start_payment(p_token text)
returns void language sql security definer set search_path = public as $$
  update public.diag_leads
     set pay_started_at = now()
   where access_token = p_token and coalesce(paid, false) = false;
$$;

-- 8b. « Mon paiement est-il arrivé ? » — ne renvoie que l'état de SA fiche.
create or replace function public.rn_check_paid(p_token text)
returns table (paid boolean, needs_review boolean, paid_at timestamptz)
language sql security definer stable set search_path = public as $$
  select coalesce(d.paid,false), coalesce(d.needs_review,false), d.paid_at
    from public.diag_leads d where d.access_token = p_token limit 1;
$$;

revoke all on function public.rn_start_payment(text) from public;
revoke all on function public.rn_check_paid(text)    from public;
grant execute on function public.rn_start_payment(text) to anon, authenticated;
grant execute on function public.rn_check_paid(text)    to anon, authenticated;

-- 8c. Le script Google déclare un encaissement (service_role uniquement).
-- Le mail Revolut ne contient pas l'e-mail du client, seulement son nom et
-- le montant → rapprochement par fenêtre de temps autour du clic « payer ».
-- Une seule candidate : validé. Plusieurs, ou aucune : arbitrage manuel.
-- Le système ne devine jamais.
create or replace function public.rn_confirm_payment(
  p_msg_id text, p_payer text, p_amount numeric,
  p_received timestamptz default now(), p_subject text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dup public.rn_payments%rowtype;
  v_ids uuid[]; v_count int; v_status text; v_lead uuid; v_pay_id uuid;
begin
  if p_msg_id is null or length(trim(p_msg_id)) = 0 then
    raise exception 'msg_id obligatoire (garantit l''idempotence)';
  end if;

  select * into v_dup from public.rn_payments where msg_id = p_msg_id;
  if found then
    return jsonb_build_object('status','duplicate','payment_id',v_dup.id,
                              'lead_id',v_dup.matched_lead_id);
  end if;

  select array_agg(id order by pay_started_at desc) into v_ids
    from public.diag_leads
   where coalesce(paid,false) = false
     and source = 'diag'
     and pay_started_at is not null
     and pay_started_at >= p_received - interval '45 minutes'
     and pay_started_at <= p_received + interval '5 minutes';

  v_count := coalesce(array_length(v_ids,1), 0);
  if    v_count = 1 then v_status := 'matched'; v_lead := v_ids[1];
  elsif v_count > 1 then v_status := 'ambiguous';
  else                   v_status := 'unmatched';
  end if;

  insert into public.rn_payments
        (msg_id, payer_name, amount, received_at, raw_subject, matched_lead_id, status)
  values (p_msg_id, p_payer, p_amount, p_received, p_subject, v_lead, v_status)
  returning id into v_pay_id;

  if v_status = 'matched' then
    update public.diag_leads
       set paid = true, paid_at = p_received, payer_name = p_payer,
           amount = p_amount::text, currency = 'EUR',
           payment_ref = 'revolut-mail:' || p_msg_id, needs_review = false
     where id = v_lead;
  elsif v_status = 'ambiguous' then
    update public.diag_leads set needs_review = true where id = any(v_ids);
  end if;

  return jsonb_build_object('status',v_status,'payment_id',v_pay_id,
                            'lead_id',v_lead,'candidates',v_count);
end;
$$;

-- 8d. Rattacher un paiement reçu à une fiche précise.
create or replace function public.rn_resolve_payment(p_payment_id uuid, p_lead_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_pay public.rn_payments%rowtype;
begin
  select * into v_pay from public.rn_payments where id = p_payment_id;
  if not found then raise exception 'paiement introuvable'; end if;

  update public.diag_leads
     set paid = true, paid_at = v_pay.received_at, payer_name = v_pay.payer_name,
         amount = v_pay.amount::text, currency = coalesce(v_pay.currency,'EUR'),
         payment_ref = 'revolut-mail:' || coalesce(v_pay.msg_id, p_payment_id::text) || ' (arbitré)',
         needs_review = false
   where id = p_lead_id;

  update public.rn_payments set matched_lead_id = p_lead_id, status = 'matched'
   where id = p_payment_id;

  update public.diag_leads set needs_review = false
   where needs_review = true and coalesce(paid,false) = false;

  return jsonb_build_object('status','matched','lead_id',p_lead_id);
end;
$$;

-- 8e. Débloquer une fiche à la main quand aucun mail n'est arrivé.
create or replace function public.rn_force_unlock(p_lead_id uuid, p_note text default null)
returns jsonb language sql security definer set search_path = public as $$
  update public.diag_leads
     set paid = true, paid_at = coalesce(paid_at, now()),
         payment_ref = 'manuel' || coalesce(' : ' || p_note, ''), needs_review = false
   where id = p_lead_id
  returning jsonb_build_object('status','unlocked','lead_id',id);
$$;

-- Jamais appelables depuis le navigateur.
revoke all on function public.rn_confirm_payment(text,text,numeric,timestamptz,text) from public;
revoke all on function public.rn_resolve_payment(uuid, uuid) from public;
revoke all on function public.rn_force_unlock(uuid, text)    from public;


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  9. VUE D'ARBITRAGE                                                    ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
-- Chaque paiement non attribué, avec les commandes en attente autour de son
-- horaire. Lisible uniquement avec la clé service_role.
create or replace view public.rn_arbitrage as
  select p.id as payment_id, p.received_at, p.payer_name, p.amount, p.status,
         d.id as lead_id, d.email as lead_email, d.tel as lead_tel, d.pay_started_at
    from public.rn_payments p
    left join public.diag_leads d
           on d.pay_started_at is not null
          and coalesce(d.paid,false) = false
          and d.pay_started_at between p.received_at - interval '45 minutes'
                                   and p.received_at + interval '5 minutes'
   where p.status <> 'matched'
   order by p.received_at desc;

revoke all on public.rn_arbitrage from anon, authenticated;


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  10. SÉCURITÉ (RLS)                                                    ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
-- Principe : le public (clé anon, visible dans la page) peut écrire ce qu'il
-- produit, mais ne peut JAMAIS lire les fiches. La lecture passe par la clé
-- service_role, réservée à l'admin.

alter table public.visitors       enable row level security;
alter table public.visit_sessions enable row level security;
alter table public.visitor_events enable row level security;
alter table public.page_visits    enable row level security;
alter table public.traffic_stats  enable row level security;
alter table public.diag_leads     enable row level security;
alter table public.rn_payments    enable row level security;

-- visitors
drop policy if exists "visitors_insert"       on public.visitors;
drop policy if exists "visitors_select_admin" on public.visitors;
drop policy if exists "visitors_delete_admin" on public.visitors;
drop policy if exists "visitors_update_admin" on public.visitors;
drop policy if exists "visitors_update_func"  on public.visitors;
drop policy if exists "visitors_update_perms" on public.visitors;
create policy "visitors_insert"       on public.visitors for insert with check (true);
create policy "visitors_update_func"  on public.visitors for update using (true);
create policy "visitors_select_admin" on public.visitors for select using (auth.role()='service_role');
create policy "visitors_delete_admin" on public.visitors for delete using (auth.role()='service_role');

-- visit_sessions
drop policy if exists "vis_insert" on public.visit_sessions;
drop policy if exists "vis_select" on public.visit_sessions;
create policy "vis_insert" on public.visit_sessions for insert with check (true);
create policy "vis_select" on public.visit_sessions for select using (auth.role()='service_role');

-- visitor_events
drop policy if exists "ve_insert" on public.visitor_events;
drop policy if exists "ve_select" on public.visitor_events;
create policy "ve_insert" on public.visitor_events for insert with check (true);
create policy "ve_select" on public.visitor_events for select using (auth.role()='service_role');

-- page_visits (compteur affiché publiquement)
drop policy if exists "pv_read"  on public.page_visits;
drop policy if exists "pv_write" on public.page_visits;
create policy "pv_read"  on public.page_visits for select using (true);
create policy "pv_write" on public.page_visits for all using (auth.role()='service_role') with check (true);

-- traffic_stats
drop policy if exists "ts_read"  on public.traffic_stats;
drop policy if exists "ts_write" on public.traffic_stats;
create policy "ts_read"  on public.traffic_stats for select using (true);
create policy "ts_write" on public.traffic_stats for all using (auth.role()='service_role') with check (true);

-- diag_leads : insertion publique (diagnostic, Zyra, BGH Party) — SANS lecture.
-- ⚠️ C'est l'absence de cette policy qui faisait échouer en silence les
-- inscriptions Zyra et BGH Party envoyées par assets/offer.js.
drop policy if exists diag_leads_insert_anon on public.diag_leads;
drop policy if exists diag_leads_insert_auth on public.diag_leads;
create policy diag_leads_insert_anon on public.diag_leads for insert to anon          with check (true);
create policy diag_leads_insert_auth on public.diag_leads for insert to authenticated with check (true);

-- rn_payments : RLS active SANS aucune policy → totalement inaccessible avec
-- la clé anon. Seul le service_role y accède.


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  11. HISTORIQUE — journal de tout ce qui se passe                      ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
-- La table diag_leads garde l'ÉTAT ACTUEL d'une fiche : elle est mise à jour
-- au fil du diagnostic, donc on perd la chronologie. Ce journal conserve
-- chaque étape, horodatée et définitive. Rien n'y est jamais modifié.

create table if not exists public.rn_history (
  id        uuid primary key default gen_random_uuid(),
  at        timestamptz not null default now(),
  lead_id   uuid references public.diag_leads(id) on delete cascade,
  source    text,          -- diag | zyra | bgh-party
  email     text,
  event     text not null, -- inscription | debut_diag | progression | diag_termine
                           -- | paiement_lance | paye | debloque_manuel
  detail    jsonb
);

create index if not exists rn_history_at_idx    on public.rn_history (at desc);
create index if not exists rn_history_lead_idx  on public.rn_history (lead_id);
create index if not exists rn_history_event_idx on public.rn_history (event);
create index if not exists rn_history_email_idx on public.rn_history (email);

alter table public.rn_history enable row level security;
-- Aucune policy → inaccessible avec la clé anon. Lecture admin uniquement.

-- Alimentation automatique : plus rien à faire côté site.
create or replace function public.rn_log_lead()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_event  text;
  v_detail jsonb := '{}'::jsonb;
  v_n_new  int;
  v_n_old  int;
begin
  -- La ligne de configuration du site n'est pas une fiche client.
  if coalesce(new.source,'') = '__site_config' then return new; end if;

  if tg_op = 'INSERT' then
    v_event := case when new.source in ('zyra','bgh-party') then 'inscription'
                    else 'debut_diag' end;

  else
    -- Paiement confirmé : le passage de false à true, jamais l'inverse.
    if coalesce(new.paid,false) and not coalesce(old.paid,false) then
      v_event  := case when coalesce(new.payment_ref,'') like 'manuel%'
                       then 'debloque_manuel' else 'paye' end;
      v_detail := jsonb_build_object('montant', new.amount,
                                     'payeur',  new.payer_name,
                                     'ref',     new.payment_ref);

    elsif new.pay_started_at is not null
      and old.pay_started_at is distinct from new.pay_started_at then
      v_event := 'paiement_lance';

    elsif new.potentiel is not null and old.potentiel is null then
      v_event  := 'diag_termine';
      v_detail := jsonb_build_object('profil',    new.profil,
                                     'potentiel', new.potentiel,
                                     'exploite',  new.exploite,
                                     'axe',       new.axe_prioritaire,
                                     'scores',    new.scores);

    elsif old.email is distinct from new.email and new.email is not null then
      v_event := 'email_saisi';

    else
      -- Simple progression dans le questionnaire : on ne journalise que si le
      -- nombre de réponses a réellement changé, pour ne pas noyer le journal.
      -- jsonb_array_length lève une erreur sur autre chose qu'un tableau —
      -- et une erreur ici bloquerait l'enregistrement de la fiche elle-même.
      v_n_new := case when jsonb_typeof(new.reponses) = 'array'
                      then jsonb_array_length(new.reponses) else 0 end;
      v_n_old := case when jsonb_typeof(old.reponses) = 'array'
                      then jsonb_array_length(old.reponses) else 0 end;

      if v_n_new = v_n_old then return new; end if;

      v_event  := 'progression';
      v_detail := jsonb_build_object('reponses', v_n_new);
    end if;
  end if;

  insert into public.rn_history (lead_id, source, email, event, detail)
  values (new.id, new.source, new.email, v_event, v_detail);

  return new;
end;
$$;

drop trigger if exists trg_rn_log_lead on public.diag_leads;
create trigger trg_rn_log_lead
  after insert or update on public.diag_leads
  for each row execute function public.rn_log_lead();


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  12. VUES ADMIN — tout est lisible d'un coup d'œil                     ║
-- ╚═════════════════════════════════════════════════════════════════════════╝
-- Réservées au service_role : elles contiennent des données personnelles.

-- Inscrits liste d'attente Zyra
create or replace view public.v_zyra as
  select email, tel, coalesce(ts, created_at) as inscrit_le, id
    from public.diag_leads
   where source = 'zyra'
   order by coalesce(ts, created_at) desc;

-- Inscrits BGH Party
create or replace view public.v_bgh as
  select email, tel, coalesce(ts, created_at) as inscrit_le, id
    from public.diag_leads
   where source = 'bgh-party'
   order by coalesce(ts, created_at) desc;

-- Diagnostics : questionnaire + e-mail final + état du paiement
create or replace view public.v_diagnostics as
  select coalesce(ts, created_at)          as date,
         email, tel, code_postal, age,
         profil, potentiel, exploite, axe_prioritaire, scores,
         -- Deux formats coexistent : ancien (tableau direct) et nouveau
         -- ({qa:[…], meta:{…}}). On gère les deux sans jamais lever d'erreur.
         case when jsonb_typeof(reponses_texte->'qa') = 'array'
                   then jsonb_array_length(reponses_texte->'qa')
              when jsonb_typeof(reponses_texte) = 'array'
                   then jsonb_array_length(reponses_texte)
              else 0 end                  as nb_reponses,
         (potentiel is not null)           as termine,
         paid                              as paye,
         paid_at, amount, payer_name, needs_review,
         case when jsonb_typeof(reponses_texte->'qa') = 'array' then reponses_texte->'qa'
              when jsonb_typeof(reponses_texte) = 'array'       then reponses_texte
              else '[]'::jsonb end         as reponses_lisibles,
         id
    from public.diag_leads
   where coalesce(source,'diag') not in ('zyra','bgh-party','__site_config')
   order by coalesce(ts, created_at) desc;

-- Paiements encaissés
create or replace view public.v_paiements as
  select paid_at as paye_le, email, tel, amount as montant, payer_name as payeur,
         payment_ref as reference, profil, id
    from public.diag_leads
   where paid
   order by paid_at desc;

-- Journal complet, toutes sources confondues
create or replace view public.v_historique as
  select h.at as quand, h.event as evenement, h.source, h.email, h.detail, h.lead_id
    from public.rn_history h
   order by h.at desc;

-- Récapitulatif chiffré
create or replace view public.v_resume as
  select (select count(*) from public.diag_leads where source='zyra')                        as inscrits_zyra,
         (select count(*) from public.diag_leads where source='bgh-party')                   as inscrits_bgh,
         (select count(*) from public.diag_leads
           where coalesce(source,'diag') not in ('zyra','bgh-party','__site_config'))        as diagnostics_total,
         (select count(*) from public.diag_leads
           where potentiel is not null)                                                      as diagnostics_termines,
         (select count(*) from public.diag_leads where email is not null and email <> '')    as avec_email,
         (select count(*) from public.diag_leads where paid)                                 as payes,
         (select count(*) from public.diag_leads where needs_review)                         as a_arbitrer,
         (select count(*) from public.visitors)                                              as visiteurs;

revoke all on public.v_zyra, public.v_bgh, public.v_diagnostics,
              public.v_paiements, public.v_historique, public.v_resume,
              public.rn_arbitrage
  from anon, authenticated;


-- ╔═════════════════════════════════════════════════════════════════════════╗
-- ║  13. VÉRIFICATION FINALE                                               ║
-- ╚═════════════════════════════════════════════════════════════════════════╝

select 'tables' as controle,
       (select count(*)::text from pg_tables
         where schemaname='public'
           and tablename in ('visitors','visit_sessions','visitor_events','page_visits',
                             'traffic_stats','diag_leads','rn_payments','rn_history'))
       || ' / 8' as resultat
union all
select 'vues admin',
       (select count(*)::text from pg_views
         where schemaname='public'
           and viewname in ('v_zyra','v_bgh','v_diagnostics','v_paiements',
                            'v_historique','v_resume','rn_arbitrage')) || ' / 7'
union all
select 'fonctions',
       (select count(*)::text from pg_proc
         where pronamespace='public'::regnamespace
           and proname in ('upsert_visitor','increment_page_visit','increment_traffic_source',
                           'rn_start_payment','rn_check_paid','rn_confirm_payment',
                           'rn_resolve_payment','rn_force_unlock','rn_log_lead')) || ' / 9'
union all
select 'journal actif',
       (select case when count(*) > 0 then '✅ oui' else '❌ non' end
          from pg_trigger where tgname = 'trg_rn_log_lead')
union all
select 'visiteurs',       (select count(*)::text from public.visitors)
union all
select 'inscrits Zyra',   (select count(*)::text from public.diag_leads where source='zyra')
union all
select 'inscrits BGH',    (select count(*)::text from public.diag_leads where source='bgh-party')
union all
select 'diagnostics',     (select count(*)::text from public.diag_leads
                            where coalesce(source,'diag') not in ('zyra','bgh-party','__site_config'))
union all
select 'fiches payées',   (select count(*)::text from public.diag_leads where paid)
union all
select 'lignes journal',  (select count(*)::text from public.rn_history);


-- ═══════════════════════════════════════════════════════════════════════════
--  ⛔ REMISE À ZÉRO — NE PAS DÉCOMMENTER SANS RÉFLÉCHIR
--
--  Ce bloc SUPPRIME DÉFINITIVEMENT tous les visiteurs, toutes les fiches
--  clients, tous les inscrits Zyra et BGH Party, et tous les paiements.
--  Il n'existe AUCUN moyen de revenir en arrière.
--
--  Avant de l'utiliser, exporte tes données :
--    Supabase → Table Editor → chaque table → menu ⋯ → Export as CSV
--
--  Puis décommente les lignes ci-dessous, exécute, et relance ce fichier
--  entier pour reconstruire une base vide et propre.
--
--  drop view  if exists public.v_zyra, public.v_bgh, public.v_diagnostics,
--                       public.v_paiements, public.v_historique, public.v_resume,
--                       public.rn_arbitrage cascade;
--  drop table if exists public.rn_history      cascade;
--  drop table if exists public.rn_payments     cascade;
--  drop table if exists public.diag_leads      cascade;
--  drop table if exists public.visit_sessions  cascade;
--  drop table if exists public.visitor_events  cascade;
--  drop table if exists public.traffic_stats   cascade;
--  drop table if exists public.page_visits     cascade;
--  drop table if exists public.visitors        cascade;
-- ═══════════════════════════════════════════════════════════════════════════
