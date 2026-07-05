# KLOMO — hyperlocal "open now" discovery app

Tap a category, see the nearest verified-open vendors in seconds. No search bar,
no forced login. Built entirely on free tiers.

> **Using an AI coding assistant on this repo?** Read `AGENTS.md` first —
> it's written so you don't need KLOMO re-explained every session.

## Why this exists

Google Maps shows you a shop's *usual* hours. It rarely knows the shop is
actually open right now. KLOMO fixes that with a trust/confidence score built
from vendor self-reports and crowd (user) confirmations, each weighted by
recency and reporter reliability, so "Open" on KLOMO means "someone confirmed
this recently," not "the listing hasn't been touched in two years."

That same confidence score, replayed hour by hour, is also KLOMO's headline
feature: the **Local Availability Graph** — a live, visible trend of what
percentage of nearby vendors are actually open right now, not a buried stat.
See `docs/AVAILABILITY_GRAPH.md`.

## Repo layout

```
klomo/
  AGENTS.md    Read this before writing any code — project context for AI agents
  backend/     Node.js trust-score + business-logic API (deploys free on Render)
  mobile/      React Native (Expo) app — iOS + Android from one codebase
  docs/        Architecture, DB schema notes, trust-score math, deployment guide
```

Supabase (Postgres + PostGIS + Auth) is the database and identity layer — see
`backend/supabase/schema.sql`. It's free up to 500MB DB / 50k monthly active
users, and it means **you never write your own password storage code**:
Supabase Auth hashes and stores credentials for you, off your servers entirely.

## Core product rules encoded in this build

1. **Zero login required to use the app.** First launch creates a Supabase
   anonymous session (a UUID, no PII) so search, browse, and even status
   reporting work instantly. Signing in later just *attaches* an email/phone
   to that same UUID — nothing is lost, nothing is forced.
2. **We never store raw credentials.** Supabase Auth owns that; our tables
   only ever reference `auth.users.id`, never a password or token.
3. **Confidence over "Open/Closed" as a binary.** Every vendor has a
   `confidence_score` (0–100) computed from source, recency, and corroboration
   — see `docs/TRUST_SCORE.md`.
4. **Intention-first UI.** Home screen is a grid of tappable categories
   (Cigarette, Chemist, Petrol, Water, Chai...), not a search bar. Two toggled
   feeds: "Most sought after" (aggregated, anonymous, city-wide) and "You
   looked for" (personal history, local-only if not signed in).
5. **Two vendor onboarding paths.** Path A: an agent manually signs a shop
   up — it starts fully "claimed" and trusted. Path B: bulk-imported from
   Google Places to avoid an empty map on day one — these start "unclaimed"
   with a visible warning, and get queued for an agent visit once real users
   start interacting with them. See `docs/VENDOR_ONBOARDING.md`.
6. **The Local Availability Graph is visible, not buried.** It has its own
   permanent bottom tab ("Pulse") with a rounded pill-bar chart comparing
   every category's live open percentage, plus a teaser card on Home and a
   24-hour trend graph on every category's results page. See
   `docs/AVAILABILITY_GRAPH.md`.
7. **Vendor status verification with presence weighting.** When a user
   reports a claimed shop, the owner is asked in-app to confirm; a
   response filed within 150m of the shop is the strongest signal in the
   trust score, while remote claims rank below good user reports. See
   `docs/VERIFICATION_FLOW.md`.
8. **Directions hand off to the phone's own Maps app.** The in-app map shows
   the vendor and a straight-line path, then a button opens Apple/Google
   Maps for actual turn-by-turn navigation — deliberately free, not a
   corner cut. See `docs/DEPLOYMENT.md` Part 9.
9. **Rule-based fraud detection that escalates rather than auto-punishes.**
   Reporters filing an abnormal number of reports get heavily discounted
   in the trust score; a burst of reports on one shop from many distinct
   people queues that vendor for a human agent to check — never an
   automatic suppression, since genuine fast consensus looks identical to
   a coordinated attack from timing alone. See `docs/FRAUD_DETECTION.md`.
10. **Push notifications for vendor alerts, with an always-visible in-app
    fallback.** A vendor gets pushed when a customer reports their shop;
    tapping it opens straight to the verification card. A badge dot on the
    Account tab means the alert is never *only* visible via push — push
    notifications are unavailable in Expo Go on Android entirely as of
    Expo SDK 53+, so the in-app path has to carry its own weight. See
    `docs/PUSH_NOTIFICATIONS.md`.

## Visual identity

Warm and friendly rather than corporate: a cream/beige base, muted earthy
accent colors (golden amber, brick maroon, olive, dusty taupe), bold
headings, and heavy rounding throughout. Navigation is a 3-tab bottom bar
(Home / Pulse / Account) — no floating add button; vendor listing is a
deliberately quiet link inside the Account tab, not a prominent CTA. See
`AGENTS.md`'s design system section before changing colors or navigation.

## Quick start

See `docs/DEPLOYMENT.md` for the full free-tier setup (Supabase project,
Render deploy, Expo/EAS build, maps). tl;dr:

```bash
# 1. Database
#    - create a free Supabase project
#    - run backend/supabase/schema.sql in the SQL editor
#    - (upgrading an older KLOMO install? run backend/supabase/migrations/*.sql instead, in order)

# 2. Backend
cd backend
cp .env.example .env   # fill in your Supabase URL + service role key
npm install
npm run dev             # http://localhost:4000

# 3. Mobile app
cd ../mobile
cp .env.example .env    # fill in Supabase URL + anon key + API URL
npm install
npx expo start           # scan QR with Expo Go
```
