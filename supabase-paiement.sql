-- ═══════════════════════════════════════════════════════════════════════════
--  RENAISSANCE — Confirmation automatique des paiements Revolut par e-mail
--  À exécuter UNE FOIS : Supabase → SQL Editor → New query → Run
--  Projet : tetknufkdhntmfjssjeg
--
--  Principe : le compte Revolut encaisse (compte classique, pas d'API).
--  Une règle de transfert filtrée envoie la notification « vous avez reçu
--  10 € » vers une boîte Gmail dédiée. Un script Google lit ce mail et
--  appelle rn_confirm_payment() ci-dessous, qui rapproche le paiement de la
--  commande en attente et débloque le client automatiquement.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── 1) Colonnes ajoutées à la table existante ──────────────────────────────
alter table public.diag_leads
  add column if not exists access_token   text,        -- jeton privé du client
  add column if not exists pay_started_at timestamptz, -- clic « payer »
  add column if not exists payer_name     text,        -- nom lu dans le mail
  add column if not exists needs_review   boolean not null default false;

-- Un jeton = une fiche (les NULL historiques restent tolérés)
create unique index if not exists diag_leads_token_uidx
  on public.diag_leads (access_token) where access_token is not null;

create index if not exists diag_leads_paystart_idx
  on public.diag_leads (pay_started_at desc) where pay_started_at is not null;

create index if not exists diag_leads_review_idx
  on public.diag_leads (needs_review) where needs_review = true;


-- ── 2) Boîte de réception des paiements ────────────────────────────────────
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

-- RLS active SANS aucune policy → totalement inaccessible avec la clé anon.
-- Seul le service_role (script Google + admin) peut lire/écrire.
alter table public.rn_payments enable row level security;


-- ── 3) Le client signale qu'il part payer ──────────────────────────────────
-- Appelée par le navigateur (clé anon) au moment d'ouvrir l'onglet Revolut.
-- Ne renvoie rien : impossible d'en tirer la moindre information.
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


-- ── 4) Le client demande « est-ce que mon paiement est arrivé ? » ──────────
-- Appelée en boucle par la page d'attente (clé anon).
-- Ne renvoie QUE l'état de la fiche correspondant au jeton fourni :
-- aucun e-mail, aucune donnée d'une autre fiche ne peut fuiter.
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


-- ── 5) Le script Google déclare un paiement reçu ───────────────────────────
-- Appelée UNIQUEMENT par le script Apps Script avec la clé service_role.
-- Rapprochement par fenêtre de temps : le mail Revolut ne contient pas
-- l'e-mail du client, seulement le nom du payeur. On cherche donc les
-- commandes dont le clic « payer » tombe dans la fenêtre du paiement.
--   • exactement 1 candidate  → paiement validé, client débloqué
--   • plusieurs candidates    → toutes marquées « à vérifier » (arbitrage admin)
--   • aucune candidate        → paiement enregistré, en attente d'arbitrage
-- Aucun accès n'est JAMAIS débloqué sans un vrai mail « argent reçu ».
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
  v_dup      public.rn_payments%rowtype;
  v_ids      uuid[];
  v_count    int;
  v_status   text;
  v_lead     uuid;
  v_pay_id   uuid;
  -- Fenêtre de rapprochement : un client met rarement plus de 45 min à payer.
  v_back     interval := interval '45 minutes';
  v_fwd      interval := interval '5 minutes';
begin
  if p_msg_id is null or length(trim(p_msg_id)) = 0 then
    raise exception 'msg_id obligatoire (idempotence)';
  end if;

  -- Idempotence : le script peut relire deux fois le même mail sans risque.
  select * into v_dup from public.rn_payments where msg_id = p_msg_id;
  if found then
    return jsonb_build_object(
      'status', 'duplicate',
      'payment_id', v_dup.id,
      'lead_id', v_dup.matched_lead_id
    );
  end if;

  -- Commandes en attente dont le clic « payer » encadre l'heure du paiement
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
    v_status := 'matched';
    v_lead   := v_ids[1];
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
    -- On ne devine PAS. Les deux fiches passent en arbitrage manuel.
    update public.diag_leads
       set needs_review = true
     where id = any(v_ids);
  end if;

  return jsonb_build_object(
    'status',     v_status,
    'payment_id', v_pay_id,
    'lead_id',    v_lead,
    'candidates', v_count
  );
end;
$$;

-- Réservée au service_role : jamais appelable depuis le navigateur.
revoke all on function
  public.rn_confirm_payment(text, text, numeric, timestamptz, text) from public;


-- ── 6) Arbitrage manuel depuis l'admin (service_role) ──────────────────────
-- Rattache un paiement reçu à une fiche précise, ou valide une fiche à la main
-- (client qui a payé mais dont le mail n'est jamais arrivé).
create or replace function public.rn_resolve_payment(
  p_payment_id uuid,
  p_lead_id    uuid
)
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
     set matched_lead_id = p_lead_id,
         status          = 'matched'
   where id = p_payment_id;

  -- Les autres fiches de l'arbitrage repassent en attente normale
  update public.diag_leads
     set needs_review = false
   where needs_review = true
     and coalesce(paid, false) = false;

  return jsonb_build_object('status', 'matched', 'lead_id', p_lead_id);
end;
$$;

revoke all on function public.rn_resolve_payment(uuid, uuid) from public;


-- ═══════════════════════════════════════════════════════════════════════════
--  RAPPEL SÉCURITÉ
--  La clé service_role est aujourd'hui écrite en clair dans index.html.
--  Elle donne un accès TOTAL à la base à quiconque lit le code source.
--  À régénérer et sortir de la page dès que possible (voir SETUP.md).
--  Le nouveau flux de paiement ci-dessus n'en dépend PAS côté navigateur :
--  la page cliente n'utilise que rn_start_payment() et rn_check_paid(),
--  toutes deux inoffensives même avec la clé anon publique.
-- ═══════════════════════════════════════════════════════════════════════════
