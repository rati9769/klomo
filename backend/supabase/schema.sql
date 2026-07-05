-- KLOMO database schema
-- Run this once in Supabase SQL editor (Project > SQL Editor > New query)
-- Requires the PostGIS extension, which Supabase ships with free tier.

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- =========================================================
-- PROFILES
-- One row per Supabase auth user (anonymous or signed-in).
-- We NEVER store passwords/tokens here — auth.users owns that,
-- and it's managed entirely by Supabase Auth.
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_anonymous boolean not null default true,
  is_agent boolean not null default false, -- KLOMO field agents who onboard/verify vendors
  reputation_score numeric not null default 50 check (reputation_score between 0 and 100),
  reports_total int not null default 0,
  reports_confirmed int not null default 0, -- reports later corroborated by others
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user can only see/edit their own profile row.
create policy "profiles: self read" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: self update" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile the moment a Supabase auth user is created
-- (works for anonymous sign-ins and email/phone sign-ins alike).
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, is_anonymous)
  values (new.id, new.is_anonymous);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- CATEGORIES
-- Fixed set of "intentions" — what the tap grid renders.
-- =========================================================
create table public.categories (
  id serial primary key,
  slug text unique not null,
  label text not null,
  icon text not null,           -- tabler icon name used by the app
  sort_order int not null default 0
);

alter table public.categories enable row level security;
create policy "categories: public read" on public.categories for select using (true);

insert into public.categories (slug, label, icon, sort_order) values
  ('cigarette', 'Cigarette', 'ti-cigarette', 1),
  ('chemist', 'Chemist / Pharmacy', 'ti-pill', 2),
  ('water', 'Drinking Water', 'ti-glass-full', 3),
  ('petrol', 'Petrol Pump', 'ti-gas-station', 4),
  ('chai', 'Chai / Tea Stall', 'ti-coffee', 5),
  ('atm', 'ATM', 'ti-credit-card', 6),
  ('grocery', 'Grocery / Kirana', 'ti-shopping-cart', 7),
  ('medical_emergency', 'Emergency Medical', 'ti-first-aid-kit', 8),
  ('mechanic', 'Vehicle Mechanic', 'ti-tool', 9),
  ('food', 'Late Night Food', 'ti-toolsitchen-2', 10);

-- =========================================================
-- VENDORS
-- =========================================================
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id), -- null until a shop owner claims/verifies it
  category_id int not null references public.categories(id),
  name text not null,
  address text,
  phone text,
  location geography(point, 4326) not null,
  verification_level int not null default 0, -- 0 = unclaimed, 1 = phone verified, 2 = doc verified
  -- How this row entered the system, and whether anyone has actually confirmed
  -- it belongs to a real, currently-operating shop.
  source text not null default 'manual_outreach'
    check (source in ('manual_outreach', 'owner_self', 'google_places_import')),
  claim_status text not null default 'unclaimed'
    check (claim_status in ('unclaimed', 'pending_agent_visit', 'claimed')),
  google_place_id text unique, -- dedupe key when re-running the import script
  sourced_note text, -- e.g. "Imported from Google Places. Items are a best guess — please verify."
  agent_visited_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index vendors_location_idx on public.vendors using gist (location);
create index vendors_category_idx on public.vendors (category_id);
create index vendors_claim_status_idx on public.vendors (claim_status);

alter table public.vendors enable row level security;
create policy "vendors: public read" on public.vendors for select using (is_active = true);
create policy "vendors: owner insert" on public.vendors
  for insert with check (auth.uid() is not null);
create policy "vendors: owner update" on public.vendors
  for update using (auth.uid() = owner_id);

-- =========================================================
-- VENDOR STATUS REPORTS
-- Every "Open"/"Closed" tap — from the vendor themself or a passer-by —
-- lands here as an immutable event. Current status is DERIVED, never
-- edited in place, so the history stays honest.
-- =========================================================
create table public.status_reports (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  reporter_id uuid references auth.users(id), -- null-safe: anonymous users still have an auth.uid()
  status text not null check (status in ('open', 'closed')),
  source text not null check (source in ('vendor', 'user')),
  reporter_reputation_snapshot numeric not null default 50,
  created_at timestamptz not null default now()
);

create index status_reports_vendor_idx on public.status_reports (vendor_id, created_at desc);

alter table public.status_reports enable row level security;
create policy "status_reports: public read" on public.status_reports for select using (true);
create policy "status_reports: authenticated insert" on public.status_reports
  for insert with check (auth.uid() is not null);

-- Rate-limit: one report per vendor per user per 5 minutes, enforced app-side
-- (see backend/src/services/trustScore.js) plus this DB check as a backstop.
-- Scoped to source='user' only — a vendor's response to a verification
-- request shares the same (vendor_id, reporter_id) as the customer report
-- that triggered it, and would otherwise get wrongly blocked by this same
-- check. A 'vendor' report is already naturally rate-limited by the
-- verification_requests lifecycle (one pending request at a time), so it
-- doesn't need this trigger's protection.
create function public.enforce_report_cooldown()
returns trigger as $$
begin
  if new.source = 'user' and exists (
    select 1 from public.status_reports
    where vendor_id = new.vendor_id
      and reporter_id = new.reporter_id
      and source = 'user'
      and created_at > now() - interval '5 minutes'
  ) then
    raise exception 'Please wait a few minutes before reporting this vendor again.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger status_report_cooldown
  before insert on public.status_reports
  for each row execute procedure public.enforce_report_cooldown();

-- =========================================================
-- SEARCH EVENTS
-- Powers "Most sought after" (aggregate, anonymous) and
-- "You looked for" (per-user recency list).
-- =========================================================
create table public.search_events (
  id bigserial primary key,
  user_id uuid references auth.users(id),
  category_id int not null references public.categories(id),
  city_geohash text, -- coarse geohash (5-6 chars ~ 5km) so we never store exact home location
  created_at timestamptz not null default now()
);

alter table public.search_events enable row level security;
create policy "search_events: self read" on public.search_events
  for select using (auth.uid() = user_id);
create policy "search_events: authenticated insert" on public.search_events
  for insert with check (auth.uid() is not null);

-- Aggregate view: most sought-after categories per coarse area, last 7 days.
-- No user_id in the output, so it's safe to expose publicly.
create view public.trending_categories as
  select category_id, city_geohash, count(*) as taps
  from public.search_events
  where created_at > now() - interval '7 days'
  group by category_id, city_geohash;

alter view public.trending_categories set (security_invoker = true);

-- =========================================================
-- NEARBY VENDORS RPC
-- The core query behind "tap category -> see nearest vendors".
-- Returns distance + a placeholder confidence (real-time trust score
-- is computed by the backend API, which calls this and enriches it).
-- =========================================================
create or replace function public.nearby_vendors(
  p_category_id int,
  p_lat double precision,
  p_lng double precision,
  p_radius_m int default 3000,
  p_limit int default 20
)
returns table (
  vendor_id uuid,
  name text,
  address text,
  distance_m double precision,
  verification_level int,
  claim_status text,
  source text,
  sourced_note text,
  latitude double precision,
  longitude double precision,
  latest_status text,
  latest_status_at timestamptz
)
language sql stable as $$
  select
    v.id,
    v.name,
    v.address,
    ST_Distance(v.location, ST_MakePoint(p_lng, p_lat)::geography) as distance_m,
    v.verification_level,
    v.claim_status,
    v.source,
    v.sourced_note,
    ST_Y(v.location::geometry) as latitude,
    ST_X(v.location::geometry) as longitude,
    ls.status,
    ls.created_at
  from public.vendors v
  left join lateral (
    select status, created_at
    from public.status_reports sr
    where sr.vendor_id = v.id
    order by created_at desc
    limit 1
  ) ls on true
  where v.category_id = p_category_id
    and v.is_active = true
    and ST_DWithin(v.location, ST_MakePoint(p_lng, p_lat)::geography, p_radius_m)
  order by distance_m asc
  limit p_limit;
$$;

-- =========================================================
-- AGENT WORKLIST
-- Unclaimed/pending vendors ranked by how much recent user activity
-- they've gotten — this is the "users have reviewed it, go sign them up"
-- signal that promotes a Google-sourced listing into the agent queue.
-- =========================================================
create view public.agent_worklist as
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

-- Only agents can read the worklist or update claim status.
create policy "vendors: agent read all" on public.vendors
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_agent = true)
  );
create policy "vendors: agent update claim" on public.vendors
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_agent = true)
  );

-- =========================================================
-- VERIFICATION REQUESTS (see docs/VERIFICATION_FLOW.md)
-- Created when a user reports open/closed on a claimed vendor; the owner
-- confirms/denies in-app. Responses filed near the shop get a presence
-- bonus in the trust score.
-- =========================================================
create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  triggering_report_id uuid references public.status_reports(id) on delete set null,
  reported_status text not null check (reported_status in ('open', 'closed')),
  status text not null default 'pending' check (status in ('pending', 'responded', 'expired')),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index verification_requests_vendor_idx
  on public.verification_requests (vendor_id, status, created_at desc);

alter table public.verification_requests enable row level security;
create policy "verification: owner read" on public.verification_requests
  for select using (
    exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid())
  );

alter table public.status_reports
  add column reporter_was_present boolean;

-- Distance in meters from a point to a vendor — used by the verification
-- presence check (backend/src/routes/vendors.js).
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

-- =========================================================
-- FRAUD DETECTION (see docs/FRAUD_DETECTION.md)
-- Rule-based flags, not silent auto-correction — flagged reports get
-- heavily discounted in the trust score, but a human agent reviews
-- vendor-level bursts rather than the system unilaterally acting.
-- =========================================================
alter table public.status_reports
  add column flagged_suspicious boolean not null default false;

create table public.fraud_flags (
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

create index fraud_flags_unreviewed_idx
  on public.fraud_flags (created_at desc) where reviewed_at is null;

alter table public.fraud_flags enable row level security;
create policy "fraud_flags: agent read" on public.fraud_flags
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_agent = true)
  );
create policy "fraud_flags: agent update" on public.fraud_flags
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_agent = true)
  );

-- =========================================================
-- PUSH NOTIFICATIONS
-- =========================================================
alter table public.profiles
  add column expo_push_token text;
