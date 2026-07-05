-- Migration 004: rule-based fraud detection + push notification support.
-- Run after 001, 002, 003 in the Supabase SQL Editor (existing installs).
-- Fresh installs: skip — schema.sql includes all of this.

alter table public.status_reports
  add column if not exists flagged_suspicious boolean not null default false;

create table if not exists public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  flag_type text not null check (flag_type in ('reporter_velocity', 'vendor_burst')),
  reporter_id uuid references auth.users(id),
  vendor_id uuid references public.vendors(id) on delete cascade,
  status_report_id uuid references public.status_reports(id) on delete set null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  details jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

create index if not exists fraud_flags_unreviewed_idx
  on public.fraud_flags (created_at desc) where reviewed_at is null;

alter table public.fraud_flags enable row level security;

drop policy if exists "fraud_flags: agent read" on public.fraud_flags;
create policy "fraud_flags: agent read" on public.fraud_flags
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_agent = true)
  );

drop policy if exists "fraud_flags: agent update" on public.fraud_flags;
create policy "fraud_flags: agent update" on public.fraud_flags
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_agent = true)
  );

-- Push notifications: one Expo push token per profile. A person can only
-- be signed into one device's notifications at a time in this simple
-- model — reinstalling or signing in elsewhere overwrites the old token,
-- which is fine since stale tokens just fail silently on send.
alter table public.profiles
  add column if not exists expo_push_token text;
