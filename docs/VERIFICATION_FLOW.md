# Vendor status verification & presence weighting

## The flow

1. A user reports a claimed shop as open/closed.
2. The backend creates a `verification_request` for that shop's owner
   (one pending request per shop at a time — no stacking).
3. The owner sees "A customer reported your shop as closed — is that
   right?" in their Account tab and answers with one tap.
4. When they respond, the app captures their current location (with
   permission) and sends it along. The backend computes the distance to
   the shop with PostGIS:
   - Within **150m** → the response is filed as a **presence-verified
     vendor report** (trust-score base weight 85 — the strongest single
     signal in the system).
   - Farther away, or no location available → filed as a **remote vendor
     report** (base weight 55 — weaker than the old flat vendor weight,
     because an owner at home saying "open" is really a guess about their
     staff).
5. Regular user reports keep their reputation-based weight (55–70).

## Why remote vendor < old vendor weight

Before presence existed, every vendor report got weight 70. Splitting it
into 85 (present) / 55 (remote) makes the score honest about what the
vendor actually knows: physically-at-the-shop confirmation beats
crowd reports; a remote claim doesn't.

## Honest limitations (read before "fixing" these)

- **Push notifications exist now** (see `docs/PUSH_NOTIFICATIONS.md`), but
  the in-app Account tab card is still the actual source of truth, not the
  push — push is unavailable in Expo Go on Android entirely, so the
  verification prompt has to work fully without it.
- **No background location.** "The app automatically detects the vendor's
  location if they don't respond" is not possible from Expo Go — true
  background location needs a development build, invasive permissions, and
  is a serious privacy commitment. What's implemented instead: location is
  captured **at response time, in the foreground, with permission** —
  which covers the actual trust question ("was the owner at the shop when
  they answered?") without silent tracking. If unanswered requests should
  decay a shop's confidence over time, that's a scoring-policy change to
  discuss, not a tracking feature.

## A bug worth knowing about (fixed in migration 005)

Early versions of this feature had a real bug: the report cooldown trigger
checked only `(vendor_id, reporter_id)` within 5 minutes, regardless of
report *source*. If the same person reported their own claimed shop as a
"customer" (`source='user'`) and then tried to respond to the resulting
verification prompt (`source='vendor'`), the second insert shared the same
reporter and vendor as the first — so the trigger blocked the owner's own
verification response with "please wait a few minutes," even though
nothing about it was actually spam. Fixed by scoping the cooldown to only
block repeats of the *same* source — see `migrations/005_fix_cooldown_source_check.sql`.
If you're still seeing this exact error when responding to a verification
request, confirm migration 005 has been run.

## Endpoints

- `GET /vendors/verifications/pending` — owner's open requests (Account tab).
- `POST /vendors/verifications/:id/respond` `{ status, lat?, lng? }` —
  files the vendor report with the server-side presence check.
