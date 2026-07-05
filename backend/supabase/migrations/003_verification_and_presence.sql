-- Migration 003: vendor status verification + presence weighting.
-- Run after 001 and 002 in the Supabase SQL Editor (existing installs).
-- Fresh installs: skip — schema.sql includes all of this.

-- When a USER reports open/closed on a CLAIMED vendor, we create a
-- verification request for the owner. The owner confirms/denies from the
-- app; their response is filed as a vendor report. If they respond while
-- physically near the shop (foreground location captured at response
-- time), the report carries a presence bonus in the trust score.
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  triggering_report_id uuid references public.status_reports(id) on delete set null,
  reported_status text not null check (reported_status in ('open', 'closed')),
  status text not null default 'pending' check (status in ('pending', 'responded', 'expired')),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists verification_requests_vendor_idx
  on public.verification_requests (vendor_id, status, created_at desc);

alter table public.verification_requests enable row level security;

drop policy if exists "verification: owner read" on public.verification_requests;
create policy "verification: owner read" on public.verification_requests
  for select using (
    exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid())
  );

-- Whether the reporter was physically near the shop when reporting.
-- Applies to vendor responses (presence bonus) — null for regular user reports.
alter table public.status_reports
  add column if not exists reporter_was_present boolean;

create or replace function public.vendor_distance_m(
  p_vendor_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns double precision
language sql stable as $$
  select ST_Distance(v.location, ST_MakePoint(p_lng, p_lat)::geography)
  from public.vendors v where v.id = p_vendor_id;
$$;
