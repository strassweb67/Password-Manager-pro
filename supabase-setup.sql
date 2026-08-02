-- ═══════════════════════════════════════════════════════════════════
--  RENAISSANCE — Setup Supabase pour les fiches client + paiements
--  À exécuter UNE FOIS dans : Supabase → SQL Editor → New query → Run
--  Projet : tetknufkdhntmfjssjeg  (le même que le tracking visiteurs)
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

create table if not exists public.diag_leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  ts              timestamptz,                 -- horodatage client (secours)
  email           text,
  tel             text,
  code_postal     text,
  age             text,
  profil          text,
  potentiel       int,
  exploite        int,
  axe_prioritaire text,
  scores          jsonb,                       -- {physique,revenus,environnement,discipline}
  reponses        jsonb,                       -- indices bruts des 13 réponses
  reponses_texte  jsonb,                       -- [{q,r}] lisible pour l'admin
  source          text,
  paid            boolean not null default false,
  paid_at         timestamptz,
  amount          text,
  currency        text,
  payment_ref     text
);

create index if not exists diag_leads_created_idx on public.diag_leads (created_at desc);
create index if not exists diag_leads_paid_idx    on public.diag_leads (paid);

-- RLS : le formulaire public (clé anon) peut UNIQUEMENT insérer.
-- La lecture des fiches se fait côté admin avec la clé service_role
-- (qui contourne RLS) → les fiches restent privées.
alter table public.diag_leads enable row level security;

drop policy if exists diag_leads_insert_anon on public.diag_leads;
create policy diag_leads_insert_anon
  on public.diag_leads
  for insert
  to anon
  with check (true);

-- (Aucune policy SELECT/UPDATE pour anon : réservé au service_role.)
