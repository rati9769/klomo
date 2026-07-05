-- Migration 002: expose vendor lat/lng from nearby_vendors, for the new
-- map + directions feature. Safe to run on an existing database that
-- already has the original schema.sql applied — this only replaces one
-- function, it doesn't touch any tables or data.
--
-- Run this in Supabase SQL Editor if you set up KLOMO before this feature
-- was added. If you're setting up a fresh database, you don't need this —
-- the current backend/supabase/schema.sql already includes it.

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
