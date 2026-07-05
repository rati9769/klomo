-- Migration 005: fix the report cooldown trigger blocking a vendor's own
-- verification response.
--
-- Bug: the cooldown checked only (vendor_id, reporter_id) within 5
-- minutes, regardless of report SOURCE. If the same person both files a
-- customer-style report on a shop they own (source='user') and then
-- responds to the resulting verification prompt (source='vendor'), both
-- inserts share the same reporter_id + vendor_id — so the second insert
-- (their own verification response) got blocked as if it were spam.
--
-- Fix: only cooldown repeats of the SAME source. A 'vendor' response is
-- already naturally rate-limited by the verification_requests lifecycle
-- (one pending request at a time, consumed on response) — it doesn't need
-- this trigger's protection at all, and letting it through fixes the bug
-- with no new abuse vector.

create or replace function public.enforce_report_cooldown()
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
