# Fraud detection

Rule-based, deliberately simple, and designed around one principle: **a
false positive here should cost almost nothing, and the system should
never unilaterally punish anyone** — it discounts and escalates, it
doesn't delete, block, or auto-demote.

## The two checks

### 1. Reporter velocity
If the same signed-in identity files **8 or more reports across any
vendors within a 60-minute window**, every report from them past that
point is marked `flagged_suspicious = true`. This catches scripted/bot
report-flooding — a real person reporting more than one or two shops an
hour is already unusual.

### 2. Vendor burst
If a vendor receives reports from **4 or more distinct reporters within a
20-minute window**, a `fraud_flags` row is created (`vendor_burst`,
severity `high`) for an agent to look at via `GET /admin/fraud-flags`.
**Nothing about the vendor or its score changes automatically** — this is
a review queue, not an enforcement action.

## Why the vendor-burst check doesn't touch the score

This is the important design decision, worth reading before "improving"
it: a sudden burst of distinct reporters looks *identical* whether it's a
coordinated attack (a rival paying people to report "closed" repeatedly)
or genuine fast consensus (several real passers-by noticing the same thing
within minutes of each other — the exact scenario the whole trust score
exists to reward). Auto-suppressing burst reports would make the system
*less* accurate on real signal to guard against a fraud pattern that isn't
even confirmed yet. So this check only escalates to a human — the
`agent_worklist` pattern already established for vendor onboarding review
is reused here for the same reason: some judgment calls shouldn't be made
by a formula.

## How the discount actually works (`trustScore.js`)

A flagged report isn't zeroed out — it's multiplied by **0.15** on top of
its normal weight (`FRAUD_DISCOUNT_MULTIPLIER` in `trustScore.js`). Fully
zeroing it would mean a false positive (an honest user having a
coincidentally busy hour) loses their report entirely; a steep discount
means it can barely move the score alone, but still counts for something
if it happens to agree with everything else. Verified in
`docs/TRUST_SCORE.md`'s spirit: two opposing reports that would normally
cancel into honest "Uncertain" instead resolve decisively toward whichever
one *isn't* flagged.

## Honest limitations

- **No device fingerprinting, no IP analysis.** Detection is entirely
  based on `reporter_id` (a Supabase auth UUID) and timing. Someone
  willing to create multiple anonymous sessions can spread reports across
  identities to stay under the velocity threshold — this system raises the
  cost of manipulation, it doesn't make it impossible.
- **No cross-report pattern learning.** Each check is a simple count over
  a fixed window, not a model that adapts thresholds based on a vendor's
  or category's normal traffic. A vendor that's genuinely high-traffic
  (lots of real, independent reports) will hit the burst threshold more
  often than a quiet one — agents reviewing the queue need to account for
  that, the system doesn't yet.
- **Reputation-based collusion (two accounts alternately confirming each
  other) isn't detected at all.** Deferred — would need tracking report
  pairs over time, not just volume.

These are reasonable v1 gaps, not oversights to silently "fix" by making
the thresholds more aggressive — tightening them trades away real user
reports to catch fraud that's already only weakly incentivized (KLOMO
doesn't have money or rankings-for-sale riding on the score yet, which is
exactly when this kind of manipulation is most likely to actually happen —
revisit this doc if/when that changes).

## Endpoints

- `GET /admin/fraud-flags` (agent-only) — unresolved flags, most recent first.
- `PATCH /admin/fraud-flags/:id/resolve` (agent-only) — mark reviewed.
