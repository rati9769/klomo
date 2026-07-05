-- Migration 001: adds the two-path vendor onboarding fields (claim_status,
-- source, google_place_id, sourced_note, agent flagging) on top of the
-- original base schema. Safe to run on an existing database — every
-- statement is idempotent (IF NOT EXISTS / OR REPLACE / DROP+CREATE for
-- policies), so running it twice by accident won't break anything.
--
-- Run 001 before 002. If you're setting up a fresh database, skip both —
-- the current backend/supabase/schema.sql already includes everything.

alter table public.profiles
  add column if not exists is_agent boolean not null default false;

alter table public.vendors
  add column if not exists source text not null default 'manual_outreach'
    check (source in ('manual_outreach', 'owner_self', 'google_places_import')),
  add column if not exists claim_status text not null default 'unclaimed'
    check (claim_status in ('unclaimed', 'pending_agent_visit', 'claimed')),
  add column if not exists google_place_id text unique,
  add column if not exists sourced_note text,
  add column if not exists agent_visited_at timestamptz;

create index if not exists vendors_claim_status_idx on public.vendors (claim_status);

create or replace view public.agent_worklist as
  select
    v.id as vendor_id,
    v.name,
    v.address,
    v.category_id,
    v.claim_status,
    v.source,
    v.created_at,
    count(sr.id) filter (where sr.created_at > now() - interval '30 days') as recent_reports
  from public.vendors v
  left join public.status_reports sr on sr.vendor_id = v.id
  where v.claim_status in ('unclaimed', 'pending_agent_visit')
    and v.is_active = true
  group by v.id
  order by recent_reports desc, v.created_at asc;

alter view public.agent_worklist set (security_invoker = true);

drop policy if exists "vendors: agent read all" on public.vendors;
create policy "vendors: agent read all" on public.vendors
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_agent = true)
  );

drop policy if exists "vendors: agent update claim" on public.vendors;
create policy "vendors: agent update claim" on public.vendors
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_agent = true)
  );
