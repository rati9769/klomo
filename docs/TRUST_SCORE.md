# The confidence/trust score

This is KLOMO's actual product, not a side feature. Everything else is a
delivery mechanism for "how sure are we this shop is open right now."

## Inputs

For a given vendor, we look at every `status_report` row from the last
6 hours (older reports don't count at all — a report from yesterday tells you
nothing about right now).

Each report has:
- `source`: `'vendor'` (shop owner self-report) or `'user'` (passer-by)
- `reporter_reputation_snapshot`: the reporter's reputation *at the time*
  they filed the report (0–100)
- `created_at`: used for recency decay

## Step 1 — base weight per report

```
vendor self-report        base = 70
user report, source=user  base = 40 + (reporter_reputation / 100) * 30
```

A brand-new anonymous user (reputation defaults to 50) contributes a base
weight of 55. A user with a track record of accurate reports (reputation
approaching 100) contributes up to 70 — on par with the vendor themself.
This is deliberate: we don't want a single self-interested vendor claim to
always outrank three independent passer-by confirmations.

## Step 2 — recency decay

```
decay = exp(-λ * minutes_since_report),  λ = ln(2) / 45
```

That halves a report's weight every 45 minutes. A report from 11:50pm is
almost full strength for a "is it open right now" query at 11:52pm; by
1:00am it's faded to near nothing, which is exactly right for something like
a shop's open/closed state.

## Step 3 — direction and corroboration

Every report votes for its status (`open` = +weight, `closed` = -weight,
after decay). Sum all votes for the vendor:

```
net_score = Σ (weight_i * decay_i * (status_i == 'open' ? 1 : -1))
```

Multiple same-direction reports don't just add — each additional
corroborating report beyond the first is worth diminishing returns
(`weight * 0.6^n` for the n-th agreeing report) so five weak pings can't
outscore two strong, independent ones and gaming via multiple fake accounts
returns rapidly diminishing weight.

## Step 4 — confidence score (0–100) and displayed status

```
confidence = clamp(50 + net_score, 0, 100)
status     = confidence >= 60 ? 'Open'
           : confidence <= 40 ? 'Closed'
           : 'Uncertain — reported recently, conflicting signals'
```

The 40–60 band matters: rather than force a guess when reports disagree, the
app says so. That honesty is the whole trust proposition — Google's binary
open/closed can't do this.

## Reputation update (how a reporter's own score moves)

After a status window closes (i.e., a later report or vendor confirmation
either agrees or disagrees with an earlier user report), that earlier
reporter's `reputation_score` nudges:

```
agreed:    reputation = min(100, reputation + 2)
contradicted: reputation = max(0, reputation - 5)
```

Contradiction costs more than agreement earns — this makes the system
resistant to random or careless taps and self-corrects toward reporters who
are actually near the shop and looking at it.

## Why this and not a simpler "last report wins"

"Last report wins" is exactly what makes Google Maps' community-verified
hours feel unreliable — one troll tap and the listing is wrong for hours.
Decayed, reputation-weighted, diminishing-corroboration scoring means a
single bad-faith report has bounded, temporary impact, while genuine
consensus (several people confirming within a short window) converges fast.

See `backend/src/services/trustScore.js` for the implementation of exactly
this math.
