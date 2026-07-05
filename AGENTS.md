# AGENTS.md

Read this whole file before touching any code in this repo. It exists so
you (an AI coding agent) don't need KLOMO re-explained every session. If
something you're about to do contradicts this file, stop and flag it rather
than silently deviating.

## What KLOMO is, in one paragraph

A hyperlocal mobile app: tap a category (Cigarette, Chemist, Petrol...), see
the nearest vendors ranked by a trust/confidence score that reflects whether
they're *actually* open right now — not Google's static "usual hours." No
login required to use it. Built entirely on free-tier infrastructure.

## The one idea everything else serves

Google Maps' open/closed status is stale and vendors update it rarely. KLOMO's
entire reason to exist is a better answer to "is it open right now," built
from decayed, reputation-weighted, crowd + vendor reports. If a proposed
change doesn't make that answer more accurate, faster, or more visible, it's
probably not core to the product — it might still be worth doing, but treat
it as secondary.

## Stack

- **Mobile**: React Native via Expo (managed workflow), `mobile/`
- **Backend**: Node/Express, `backend/`, deploys free on Render
- **Database + Auth**: Supabase (Postgres + PostGIS + Auth), free tier
- **Maps**: `react-native-maps` (Apple Maps on iOS / Google Maps on Android)
- **Charts**: `react-native-svg`, hand-rolled — no charting library dependency

Everything is free-tier by design. Before adding a paid dependency or
service, check `docs/DEPLOYMENT.md` for the existing free-tier equivalent —
there usually is one, and introducing a paid one is a product decision, not
just a technical one.

## Repo map

```
backend/
  src/
    server.js              Express entrypoint, mounts all routers
    db.js                  Supabase client using the SERVICE ROLE key
                            (backend-only — never import this pattern client-side)
    routes/
      nearby.js             GET /nearby — the core discovery query
      status.js             POST /status/report — open/closed reports,
                              triggers verification requests + push + fraud checks
      categories.js          category list, trending, recent-search feeds
      vendors.js            vendor self-onboarding (path A) + verification
                              response endpoints
      admin.js              agent worklist + vendor claiming + fraud flag review
      availability.js        Local Availability Graph endpoints (see below)
      notifications.js       push token registration
    services/
      trustScore.js          the confidence-score algorithm — see docs/TRUST_SCORE.md
                              before touching this file, the math is deliberate
      fraudDetection.js       rule-based velocity/burst checks — see
                              docs/FRAUD_DETECTION.md before changing thresholds
      pushNotifications.js    sends via Expo's push API (plain fetch, no SDK dep)
    middleware/
      auth.js                verifies Supabase JWT (works for anon + signed-in)
      requireAgent.js         gates admin routes to profiles.is_agent = true
  scripts/
    importFromGooglePlaces.js  onboarding path B — bulk vendor seeding
  supabase/
    schema.sql              THE SOURCE OF TRUTH for a FRESH database — always
                             includes every feature. Run this for new installs.
    migrations/              numbered, sequential SQL files for upgrading an
                             EXISTING database that predates a feature — run
                             every migration newer than your last one, in
                             order. Adding a new schema change? Update BOTH
                             schema.sql (so fresh installs get it) AND add a
                             new numbered migration (so existing installs can
                             catch up) — this project has been bitten before
                             by only doing one of the two.

mobile/
  App.js                    entry, wraps AppNavigator
  src/
    navigation/AppNavigator.js   RootStack (Splash, Main, full-screen flows) +
                                  MainTabs (HomeTab, Pulse, Account) + the
                                  notification-tap-to-Account-tab listener —
                                  see the navigation architecture note below
    screens/                     one file per screen, see below
    components/                  shared UI pieces (cards, badges, graphs,
                                  the custom AppTabBar, VerificationCard)
    context/
      VerificationContext.js  shared pending-verification count — feeds the
                              Account tab's badge dot without a second fetch
    services/
      supabase.js            client + ensureSession() (anonymous auth bootstrap)
      api.js                 typed wrapper around every backend route
      location.js            expo-location + geohash helper
      directions.js          hands off to the phone's own Maps app — see
                              docs/DEPLOYMENT.md Part 9 for why this is
                              deliberate, not a shortcut
      notifications.js        push permission + token registration + tap
                              listener — see docs/PUSH_NOTIFICATIONS.md,
                              ESPECIALLY the Expo Go Android limitation
                              before assuming a bug when push doesn't arrive
    constants/
      theme.js                colors/spacing/radius/shadow — ALWAYS use these
                              tokens, never inline a hex code in a screen
      categories.js           category list + per-category color identity
      mapStyle.js             custom dark map skin for VendorMapScreen

docs/
  TRUST_SCORE.md             the confidence algorithm, worked through with numbers
  VENDOR_ONBOARDING.md        path A (manual) vs path B (Google import)
  DEPLOYMENT.md               full free-tier deployment walkthrough
  AVAILABILITY_GRAPH.md       what the Local Availability Graph is and how it's computed
  VERIFICATION_FLOW.md        vendor status verification + presence weighting
  FRAUD_DETECTION.md          the rule-based fraud checks and why they only
                              escalate to a human rather than auto-acting
  PUSH_NOTIFICATIONS.md       setup + the Expo Go Android platform gap
```

## Navigation architecture (read before adding/moving screens)

`AppNavigator.js` has two layers:

- **RootStack** (native stack): `Splash`, `Main`, plus every full-screen
  flow that shouldn't show the bottom tab bar — `CategoryResults`,
  `VendorDetail`, `VendorMap`, `SignIn` (modal), `VendorOnboarding`.
- **MainTabs** (bottom tabs, rendered as the `Main` screen in RootStack):
  `HomeTab`, `Pulse`, `Account`. Custom-rendered via `AppTabBar.js`.
  **There is no floating "+" or add button** — vendor onboarding is
  deliberately not surfaced on the tab bar or Home screen at all; its only
  entry point is a quiet text link at the bottom of the Account tab. Don't
  reintroduce a prominent vendor CTA without checking product rule #6 below.

Screens nested inside MainTabs can call `navigation.navigate('CategoryResults', ...)`
directly without `getParent()` — React Navigation bubbles an unmatched route
name up through parent navigators automatically. Only reach for
`getParent()` when you specifically want to escape a nested navigator from
a *non-screen* component (like `AppTabBar`, which receives the tab
navigator's `navigation` object, not a screen's).

If you add a new screen: decide up front whether it needs the tab bar
visible (→ add it as a `Tab.Screen` inside `MainTabs`) or should be a
full-screen flow (→ add it as a sibling of `Main` in `RootStack`). Mixing
this up is the most likely navigation bug in this codebase.

## Non-negotiable product rules

These came from explicit product decisions. Don't relax them for
convenience without flagging it first.

1. **No login required to use the app.** First launch creates a Supabase
   anonymous session. Every feature (search, browsing, even filing a status
   report) must work before anyone signs in.
2. **Never store raw credentials.** Auth is entirely Supabase's job
   (anonymous sessions + OTP). If you're about to write code that stores or
   compares a password, you've misunderstood the auth model — stop.
3. **Two vendor onboarding paths, clearly labeled.** Path A (manual
   outreach / owner self-onboarding) starts `claim_status = 'claimed'`.
   Path B (Google Places import) starts `'unclaimed'` and MUST show a
   warning to users until an agent verifies it in person. Never silently
   promote an unclaimed vendor to claimed without going through
   `PATCH /admin/vendors/:id/claim`.
4. **Confidence, not a binary.** Never collapse the trust score back down
   to a plain "Open/Closed" boolean anywhere in the UI — the honest
   "Uncertain" middle state (40–60 confidence) is the whole point. See
   `docs/TRUST_SCORE.md`.
5. **The Local Availability Graph is a headline feature, not a decoration.**
   It has its own permanent bottom-tab (`Pulse`), not just a home-screen
   card — don't demote it back to a buried stat. See `docs/AVAILABILITY_GRAPH.md`.
6. **Vendor onboarding is NOT surfaced to general users.** No FAB, no home
   screen card — the only entry is a quiet link at the bottom of the
   Account tab. KLOMO's home screen is for people who need something now;
   don't re-add prominent vendor CTAs there.
7. **Vendor registration must let the owner PIN the shop location on a
   map** (LocationPicker component) — never silently use their current
   position as the shop position; owners often register from home.
8. **Vendor status responses are presence-weighted.** A verification
   response filed within 150m of the shop outweighs everything; a remote
   response is weaker than a good user report. No emoji as icons anywhere —
   @expo/vector-icons only (bundled with Expo, zero extra dependency).
   See docs/VERIFICATION_FLOW.md before touching trustScore.js weights.
9. **Fraud detection escalates to a human, it never auto-punishes.** The
   vendor-burst check creates a review flag for an agent; it must never
   auto-suppress reports, auto-change claim status, or block a reporter.
   Coordinated attacks and genuine fast consensus look identical from
   report timing alone — only a human should make that call. See
   `docs/FRAUD_DETECTION.md`.
10. **Push notifications are additive, never load-bearing.** Every push
    the app sends must have an equivalent always-visible in-app surface
    (the Account tab badge dot + verification card) that works whether or
    not the push arrives — remember push is completely unavailable on
    Android in Expo Go (SDK 53+), so treating it as the only way to see
    something would silently break for a large chunk of testers. See
    `docs/PUSH_NOTIFICATIONS.md`.

## Design system rules

- All colors, spacing, radii, and shadows come from `mobile/src/constants/theme.js`.
  If a value you need isn't there, add it to theme.js — don't inline a hex
  code or a magic number in a screen file.
- The visual identity is warm and friendly, not corporate: a cream/beige
  base (`colors.paper`), muted earthy accents (golden amber, brick maroon,
  olive, dusty taupe), bold black-ish headings, and heavy rounding
  (`radius.lg`/`xl`/`pill` — this app uses noticeably rounder corners than
  a typical utility app; don't flatten this back to sharp corners).
- Each category has a fixed color identity in `mobile/src/constants/categories.js`:
  `tint`/`ink` (soft pastel fill + dark text — used for grid tiles, badges)
  and `solid`/`onSolid` (saturated fill + light text — used for map
  markers and the `PillBar` chart on the Pulse tab). Keep new categories
  consistent with that pattern and palette family, not another shade of gray.
- The app deliberately avoids looking like a generic settings-list utility
  app. If you're adding a new screen and it would look at home in a plain
  CRUD admin panel, push it further — bolder type, real shadows, a distinct
  color per state — before treating it as done.

## Environment / version gotchas (read this before debugging "weird" errors)

- **Do NOT default to the newest Expo SDK.** This bit us twice: once
  pinning a stale SDK (51) that Expo Go had dropped support for, then
  overcorrecting to the brand-new SDK (57) before the Apple App Store had
  even approved an Expo Go build for it — "Project is incompatible with
  this version of Expo Go, download the latest version" is Expo Go's stock
  message and is misleading here, because Apple's App Store review for new
  Expo Go builds routinely lags the actual SDK release by weeks with no
  fixed timeline (this has happened for SDK 55, 56, and 57 in a row — it's
  a systemic, ongoing thing, not a one-off). The version actually installed
  on someone's phone from the App Store is frequently 1-2 SDKs behind
  "latest."
  **The right anchor point is the SDK your Expo Go app actually reports
  supporting** (visible in the Expo Go app itself), not whatever `npm view
  expo version` returns. This repo is currently pinned to **SDK 54**
  specifically because it's a version confirmed to have long-standing,
  stable App Store availability — not because it's the newest.
- **After any `npm install` in `mobile/`, run `npx expo install --fix`.**
  This is Expo's own tool for correcting every React Native-ecosystem
  package to the exact version matrix for whatever `expo` version is
  pinned — treat it as a mandatory, self-healing step, not an optional
  troubleshooting one. It corrects manually-authored version mismatches in
  `package.json` (including any this repo might still have) authoritatively.
- If you genuinely need a newer SDK, verify first, in this exact order:
  (1) what SDK does the App Store's current Expo Go build actually say it
  supports (check the app itself or its App Store "What's New" section),
  (2) does `npm view react-native@<exact-version>` (or the npm website)
  confirm that exact version string was actually published — a
  fabricated/nonexistent exact patch version (e.g. guessing `0.86.1` when
  only `0.86.0` exists) fails silently as `react-native@undefined` in npm's
  peer resolution, producing a confusing ERESOLVE error that looks like a
  real conflict but isn't.
- **"Missing bearer token" errors on every authenticated action** (listing
  a shop, status reports, search logging) almost always mean Supabase's
  **Anonymous Sign-Ins** provider is disabled, not a code bug — `ensureSession()`
  in `services/supabase.js` is called lazily by `getAccessToken()` on every
  request (self-healing retry), but if `signInAnonymously()` keeps failing
  because the provider is off, there's never a session to retry into. Check
  Supabase dashboard → Authentication → Providers first before debugging
  the request code.
- `SUPABASE_URL` must be the bare project URL
  (`https://xxxx.supabase.co`), never with `/rest/v1` appended — the
  Supabase client library appends that itself.
- Mobile `.env` values are prefixed `EXPO_PUBLIC_` and are picked up at
  build time — after editing `.env`, restart with `npx expo start -c` to
  clear the bundler cache, a plain hot-reload won't see the change.
- `SIGN IN` text inputs that need to accept BOTH email and phone must use
  `keyboardType="default"` — `phone-pad` has no letters, so a field that
  starts in phone-pad mode can never receive an `@` to switch modes. This
  bit us once already; don't reintroduce it.
- **The report cooldown trigger is scoped to `source = 'user'` only, on
  purpose.** It used to check `(vendor_id, reporter_id)` regardless of
  source, which meant an owner reporting their own shop as a "customer"
  and then responding to their own resulting verification prompt got
  wrongly blocked — both inserts shared the same reporter+vendor pair. A
  `'vendor'`-source report is already naturally rate-limited by the
  verification_requests lifecycle (one pending request at a time); it
  doesn't need the cooldown too. Don't widen this back to "any source"
  without re-reading `docs/VERIFICATION_FLOW.md`'s bug writeup first.
- Twilio's plain SMS product requires purchasing a local number, which
  Twilio does not sell for India. Use **Twilio Verify** instead (no number
  needed) or an India-specific provider (TextLocal, MSG91) — see
  `docs/DEPLOYMENT.md`.
- **Push notifications silently do nothing in Expo Go on Android** (SDK
  53+, which includes this project's SDK 54) — this is a permanent Expo
  platform change, not a bug. iOS Expo Go still works. Testing push on
  Android needs a development build (`npx expo install expo-dev-client &&
  npx expo prebuild && npx expo run:android`, or an EAS development build
  in the cloud). See `docs/PUSH_NOTIFICATIONS.md` before spending time
  debugging what looks like a backend delivery failure.

## What's implemented vs. not (keep this section updated)

**Implemented**: anonymous + OTP auth, category grid, nearby search with
live confidence scoring, status reporting with reputation updates, both
vendor onboarding paths (with map-pin location picker at registration),
agent worklist API, Google Places import script, Local Availability Graph
(backend + its own `Pulse` tab with the pill-bar chart), map + directions
handoff, 3-tab bottom navigation (Home/Pulse/Account — deliberately NO
floating add button), Account screen with vendor verification prompts,
vendor status verification with presence weighting (see
docs/VERIFICATION_FLOW.md), rule-based fraud detection (reporter velocity
+ vendor burst, escalates to agent review — see docs/FRAUD_DETECTION.md),
push notifications for verification requests with an in-app badge-dot
fallback (see docs/PUSH_NOTIFICATIONS.md, especially the Android/Expo Go
gap), design system v3 (vector icons via bundled @expo/vector-icons,
editorial type scale, illustrated SVG hero).

**Not implemented / backend-only for now**: an in-app screen for agents to
browse the worklist, claim vendors, and review fraud flags (all three are
currently API-only, meant to be called via a tool like Postman until
there are enough agents to justify a screen); push delivery-receipt
checking (Expo push tickets are sent but never confirmed delivered — see
docs/PUSH_NOTIFICATIONS.md); multi-device push support (one token per
profile, not per device); a vendor-facing dashboard web app; turn-by-turn
in-app navigation (directions currently hand off to the native Maps app,
which is the deliberate free-tier choice — see `docs/DEPLOYMENT.md` for why).

## When you're not sure

If a change would affect the trust score math, the claim-status state
machine, or whether login is required for some flow — these were deliberate
product decisions, not oversights. Ask before changing them rather than
"fixing" what might look like an inconsistency.
