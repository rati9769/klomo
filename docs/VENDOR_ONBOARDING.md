# Onboarding path A — manual outreach

The other half of vendor supply, alongside the Google Places import
(`scripts/importFromGooglePlaces.js`, path B).

## Flow

1. An agent (or you, early on) visits or calls a shop directly.
2. They sign in on the KLOMO app with their own phone/email (not a password —
   see `mobile/src/screens/SignInScreen.js`), which upgrades their session
   from anonymous to identified.
3. They fill out `VendorOnboardingScreen` in the app themselves, or the agent
   does it on their behalf on-site.
4. Because this row is created by an authenticated (non-anonymous) owner
   through `POST /vendors`, it's inserted with `source = 'owner_self'` and
   `claim_status = 'claimed'` from the start — no warning banner, full trust
   from day one, since a real person vouched for it in person.

## Where this differs from the Google import

| | Path A: manual outreach | Path B: Google import |
|---|---|---|
| `source` | `manual_outreach` / `owner_self` | `google_places_import` |
| `claim_status` at creation | `claimed` | `unclaimed` |
| Shown to users | No warning | "Sourced from Google, please verify" banner |
| Category/items | Vendor states them | Generic guess from place type |

## When to prioritize path A

Path B is for blanketing a city fast with *something* to show. Path A is
where the actual trust in the app comes from. Use the `agent_worklist` view
(`GET /admin/worklist`) to prioritize path A visits toward whichever
unclaimed vendors are already getting real user traffic — that's the
signal that it's worth an agent's time.
