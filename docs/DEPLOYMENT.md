# Deployment manual for beginners

Written assuming you've never deployed an app before. Follow it top to
bottom, in order — later steps need accounts/keys from earlier ones. Total
cost: $0, except an optional $99/year if you want to publish on Apple's App
Store (Android publishing is free).

Skip nothing marked **required**. Steps marked **optional** are for later
(Google-sourced vendor import, publishing to app stores).

---

## Already had KLOMO running before this update? Read this first.

**If you hit "Project is incompatible with this version of Expo Go" or
"Unable to resolve asset './assets/icon.png'"**, both are fixed in this
version:

```
cd mobile
rm -rf node_modules package-lock.json
npm install
npx expo install --fix
npx expo start -c
```

The Expo SDK is now pinned to **54**, not the newest release (57) — the
newest SDK's Expo Go build is very often still stuck in Apple's App Store
review queue for weeks after release, so "just update Expo Go" doesn't
actually help; SDK 54 has stable, confirmed App Store availability instead.
See the troubleshooting section near the bottom of this doc for the full
explanation, and `AGENTS.md` for why this project deliberately doesn't
chase the latest SDK. Real `icon.png`/`splash.png`/`adaptive-icon.png`
files are now included in `mobile/assets/` too — that resolves the asset
error on its own once you pull this version.

This rebuild also changed three other things that need action if you're
upgrading an even older setup:

1. **Database schema changed** (vendor onboarding fields, map coordinates,
   vendor verification + presence weighting, fraud detection + push
   tokens, and a fix to the report cooldown trigger). If your Supabase
   project already has an older schema, run every file in
   `backend/supabase/migrations/` newer than your last one, in order —
   currently `001` through `005` — in the Supabase SQL Editor, same way
   you ran the original `schema.sql`. Redeploy the backend on Render after
   (it picks up the new
   code automatically if you push to GitHub: `git add . && git commit -m
   "verification flow" && git push`).
   If you're setting up Supabase for the first time, skip this — the main
   `schema.sql` already includes everything.
2. **New dependencies**: `react-native-maps`, `react-native-svg`,
   `expo-linear-gradient`, `@react-navigation/bottom-tabs`,
   `expo-notifications`, `expo-device`. Covered by the `npm install` +
   `npx expo install --fix` above, nothing extra to do — but push
   notifications need one extra manual step (a real EAS project ID), see
   Part 11 further down.
3. **Navigation structure changed.** The app has a bottom tab bar (Home /
   Pulse / Account) with **no floating add button** — vendor onboarding is
   a quiet link inside the Account tab. If you had custom
   code calling `navigation.navigate('Home')` or `navigation.navigate('LocalPulse')`
   anywhere outside this repo, update it — those routes are now `'HomeTab'`
   and `'Pulse'` respectively, nested inside a `'Main'` tab screen. See
   `AGENTS.md`'s navigation architecture section.

Everyone else, continue from Part 0 below as normal.

---

## Part 0 — what you're setting up, in plain terms

Four separate free services, each doing one job:

| Service | Job | Free limit |
|---|---|---|
| **Supabase** | Your database + login system | 500MB storage, 50k monthly users |
| **Render** | Runs your backend code 24/7 | Sleeps after 15 min idle, wakes in ~30s |
| **Expo** | Turns your code into a phone app | Unlimited dev, limited monthly builds |
| **Google Cloud** | (Optional) imports shop data | $200/month free credit |

You'll create an account on each, copy a few keys/passwords from each into
two files (`.env` files), and then run some commands. That's the whole job.

---

## Part 1 — install tools on your computer (required, one-time)

You need three programs. If you already have them, skip to Part 2.

### 1a. Node.js
This runs JavaScript outside a browser — both the backend and the mobile
app's build tools need it.
1. Go to **nodejs.org**
2. Download the button that says **LTS** (not "Current")
3. Run the installer, click Next through everything (defaults are fine)
4. Check it worked: open a terminal (Mac: Terminal app; Windows: press the
   Windows key, type `cmd`, press Enter) and type:
   ```
   node --version
   ```
   You should see something like `v20.x.x`. If you see "command not found",
   restart your computer and try again.

### 1b. Git
This downloads/manages code.
1. Go to **git-scm.com/downloads**, download for your OS, install with
   default options.
2. Check it worked: `git --version` in the terminal.

### 1c. A code editor
Download **VS Code** from **code.visualstudio.com** — install with defaults.
You don't strictly need this (Notepad technically works) but every
instruction below assumes you have somewhere sane to open and edit files.

### 1d. On your phone: Expo Go
Install the **Expo Go** app from the App Store (iPhone) or Play Store
(Android). This is how you'll preview your app on your actual phone in
Part 6, without needing a $99 developer account first.

---

## Part 2 — get the KLOMO code onto your computer

1. Unzip the `klomo.zip` file you were given, somewhere easy to find, e.g.
   your Desktop. You should end up with a `klomo` folder containing
   `backend`, `mobile`, `docs`, `README.md`.
2. Open a terminal, navigate into it:
   ```
   cd Desktop/klomo
   ```
   (adjust the path if you put it somewhere else)

### Put it on GitHub (needed later for Render to deploy it)
1. Go to **github.com**, click **Sign up**, make a free account.
2. On github.com, click the **+** icon top-right → **New repository**.
   Name it `klomo`, leave everything else default, click **Create repository**.
3. Back in your terminal, inside the `klomo` folder:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/klomo.git
   git push -u origin main
   ```
   Replace `YOUR_USERNAME` with your actual GitHub username. It'll ask you
   to log in — follow the prompts (it may open a browser window).

**This project includes a `.gitignore`** that keeps `node_modules/` and
your real `.env` files (which contain secret keys) out of GitHub — only
`.env.example` (no real values) gets committed. If you'd set up KLOMO
*before* this `.gitignore` existed and already pushed a real `.env` to
GitHub, treat those keys as compromised: rotate them (Supabase: Project
Settings → API → regenerate; Google: Cloud Console → Credentials → delete
and recreate the key) rather than just deleting the file from a future
commit — old commits keep the file in Git's history.

You now have the code both on your computer and on GitHub.

---

## Part 3 — create your Supabase project (database + login system)

1. Go to **supabase.com**, click **Start your project**, sign up (you can
   use your GitHub account to sign up — one click, recommended).
2. Click **New project**.
   - **Name**: `klomo` (or anything)
   - **Database password**: click "Generate a password", then **copy it
     somewhere safe** (a notes app) — you likely won't need it again, but
     keep it just in case.
   - **Region**: pick whichever is closest to your users (e.g. Mumbai if
     you're targeting India).
   - Click **Create new project**. Wait ~2 minutes while it sets up.
3. Once it's ready, on the left sidebar click the **SQL Editor** icon
   (looks like `</>`).
4. Click **New query**.
5. On your computer, open `klomo/backend/supabase/schema.sql` in VS Code,
   select all the text (Ctrl+A / Cmd+A), copy it.
6. Paste it into the Supabase SQL editor box, then click **Run** (bottom
   right, or Ctrl+Enter).
7. You should see "Success. No rows returned." at the bottom. If you see a
   red error instead, check you copied the *entire* file, then try again —
   partial pastes are the most common cause of errors here.

### Turn on anonymous + OTP sign-in
This is what lets people use KLOMO without creating a password.
1. Left sidebar → **Authentication** → **Providers**.
2. Find **Anonymous Sign-Ins**, toggle it **on**.
3. **Email** provider is usually on by default — leave it on.
4. (Optional, for phone-number sign-in) Find **Phone**, toggle on — this
   needs a Twilio account for SMS, which has its own free trial; skip this
   for now and use email-based sign-in to start.

**Critical extra step, easy to miss:** Supabase's email sign-in defaults to
sending a clickable **magic link**, not a 6-digit code — even though the
method is confusingly called `signInWithOtp`. KLOMO's sign-in screen expects
the numeric code, so without this step people will get a link that doesn't
even work (it tries to redirect into a web page this app doesn't have).
1. Left sidebar → **Authentication** → **Email Templates** → **Magic Link**.
2. Replace the template body with one that shows the code instead of a link:
   ```html
   <h2>Your KLOMO verification code</h2>
   <p>Enter this code in the app to sign in:</p>
   <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">{{ .Token }}</p>
   <p>This code expires in 1 hour.</p>
   ```
3. Save. Only sign-in attempts *after* this change will get a code — an
   email already sent under the old template stays a link.

### Copy your keys
1. Left sidebar → **Project Settings** (gear icon) → **API**.
2. You'll see three values you need:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a long string starting with `eyJ...`
   - **service_role** key — another long string starting with `eyJ...`
     (this one is secret — never put it in the mobile app, only the backend)
3. Copy all three into a notes file for now — you'll paste them in Part 4
   and Part 5.

---

## Part 4 — run the backend on your computer (to test it works)

1. In your terminal:
   ```
   cd Desktop/klomo/backend
   npm install
   ```
   This downloads all the code libraries the backend needs — takes a
   minute or two.
2. Make your own settings file from the example:
   - Mac/Linux: `cp .env.example .env`
   - Windows: `copy .env.example .env`
3. Open the new `.env` file in VS Code and fill it in with the values from
   Part 3:
   ```
   SUPABASE_URL=https://abcdefgh.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...your service role key...
   PORT=4000
   CORS_ORIGINS=http://localhost:8081,http://localhost:19006
   ```
4. Start it:
   ```
   npm run dev
   ```
5. You should see `KLOMO backend listening on :4000`. Leave this terminal
   window open and running.
6. Test it: open a browser and go to `http://localhost:4000/health` — you
   should see `{"ok":true}`. Then try
   `http://localhost:4000/categories` — you should see the ten seed
   categories (Cigarette, Chemist, etc.) come back as JSON. If both work,
   your backend and database are correctly connected.

If step 6 fails: double-check the `.env` values have no extra spaces or
quote marks, and that you ran the schema.sql successfully in Part 3.

---

## Part 5 — deploy the backend so it's live 24/7 (Render, free)

Running on your own computer (Part 4) only works while your computer is on
and that terminal is open. To make it live permanently, deploy to Render.

1. Go to **render.com**, sign up (again, GitHub sign-up is the easiest).
2. Click **New** → **Web Service**.
3. Click **Connect account** to link your GitHub if you haven't, then find
   and select your `klomo` repository.
4. Fill in:
   - **Name**: `klomo-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
5. Scroll to **Environment Variables**, click **Add Environment Variable**,
   and add each of these one at a time (same values as your local `.env`):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CORS_ORIGINS` — for now set to `*` (allow all) to keep testing simple;
     tighten this once you know your app's real URL
6. Click **Create Web Service**. Wait a few minutes for the first deploy.
7. Once it says **Live**, you'll see a URL like
   `https://klomo-backend.onrender.com`. Test it the same way as Part 4
   step 6, but using this URL instead of `localhost:4000`.

**Important free-tier quirk**: after 15 minutes with no traffic, Render
puts your backend to sleep. The next request wakes it up but takes ~30
seconds. This is fine for testing and early users; if it bothers you later,
Render's cheapest paid tier ($7/mo) removes the sleep.

Save this live URL — you need it in the next part.

---

## Part 6 — run the mobile app on your phone

Before anything else: **install the Expo Go app from the App Store (iPhone)
or Play Store (Android) now, if you haven't already** — check what SDK
version it says it supports (open the app; it shows this on first launch or
in its settings/profile screen). This project is pinned to **Expo SDK 54**
specifically because it's a version with confirmed, stable App Store
availability — not because it's the newest. If your installed Expo Go
reports a different SDK number than 54, see the troubleshooting entry below
before continuing.

1. In your terminal:
   ```
   cd Desktop/klomo/mobile
   npm install
   ```
2. **Run this immediately after, every time** — it self-corrects every
   React Native package to the exact version matrix Expo SDK 54 expects,
   regardless of anything already in `package.json`:
   ```
   npx expo install --fix
   ```
3. Make your settings file:
   - Mac/Linux: `cp .env.example .env`
   - Windows: `copy .env.example .env`
4. Open `mobile/.env` in VS Code and fill in:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...your anon key (NOT service role)...
   EXPO_PUBLIC_API_URL=https://klomo-backend.onrender.com
   ```
   Use the **anon** key here, never the service role key — this file ships
   inside the app, so it must only contain the key that's safe to be public.
5. Start the app:
   ```
   npx expo start
   ```
6. A QR code appears in your terminal (and a browser tab opens too).
   - **iPhone**: open your Camera app, point it at the QR code, tap the
     notification that appears — it opens in Expo Go.
   - **Android**: open the Expo Go app, tap "Scan QR code", scan it.
7. The app should load on your phone within a few seconds. You'll see the
   KLOMO splash screen, then the home screen with the category grid.

**Your phone and computer must be on the same WiFi network** for this to
work. If it won't connect, in the terminal where `expo start` is running,
press `s` to switch to "tunnel" mode, which works across different networks
(a bit slower to load).

Try tapping a category — it'll ask for location permission (allow it),
then show nearby results. Since your database is empty right now, you'll
see "No [category] found nearby yet" — that's expected until you add
vendors (Part 7 or Part 8).

---

## Part 7 — add your first vendor manually (to see the app actually work)

Easiest way to test end-to-end: use the app itself.
1. In the app, tap **Sign in** on the home screen, enter your email, check
   your inbox for the 6-digit code, enter it.
2. Scroll down, tap **Own a shop? List it on KLOMO →**.
3. Fill in a shop name, pick a category, submit — it uses your phone's
   current location as the pin.
4. Go back to the home screen, tap that same category — your shop should
   now appear as the nearest result, fully "claimed" (see
   `docs/VENDOR_ONBOARDING.md` for why manually-added vendors start
   trusted).
5. Tap into it, tap "Yes, it's open" — you'll see the confidence score.

---

## Part 8 — (optional) bulk-import vendors from Google Places

This seeds your map with real nearby shops automatically, marked
"Unclaimed" until someone confirms them — see `docs/VENDOR_ONBOARDING.md`
for the reasoning.

1. Go to **console.cloud.google.com**, sign in with any Google account.
2. Click the project dropdown top-left → **New Project** → name it `klomo`
   → **Create**.
3. Once created, make sure it's selected in that same dropdown.
4. In the search bar at the top, type **Places API**, click it, click
   **Enable**.
5. While you're in the same project, also enable the map itself (needed for
   Part 9 below): search **Maps SDK for Android**, click it, click
   **Enable**. (iOS doesn't need this — it uses Apple's own maps for free,
   no key required.)
6. Left sidebar → **APIs & Services** → **Credentials** → **Create
   Credentials** → **API key**. You can use one key for both Places import
   and the Android map, or create two separate keys and restrict each to
   its own API — one key is simpler to start with.
7. Billing: Google requires a billing account attached even for the free
   tier (they don't charge unless you exceed $200/month of usage, which is
   thousands of requests) — you'll be prompted to add a card during setup.
8. Back in your terminal:
   ```
   cd Desktop/klomo/backend
   ```
   Open `.env` again and add a new line:
   ```
   GOOGLE_PLACES_API_KEY=your-key-here
   ```
9. Find your area's latitude/longitude — easiest way: open Google Maps in
   a browser, right-click your city center, click the coordinates that pop
   up (they get copied), e.g. `18.5204, 73.8567`.
10. Run the import for one category first, to check it works:
    ```
    node scripts/importFromGooglePlaces.js --lat 18.5204 --lng 73.8567 --radius 3000 --category cigarette
    ```
11. You'll see it print how many it found and inserted. Reload the app,
    tap that category — the imported shops appear with an "⚠ Unclaimed"
    warning.
12. Once you're happy with one category, run it without `--category` to
    import all of them:
    ```
    node scripts/importFromGooglePlaces.js --lat 18.5204 --lng 73.8567 --radius 3000
    ```

You can re-run this safely any time (for a new area, or to catch new
listings) — it skips anything it already imported.

### Turning your first agent on

To let a real person work the `agent_worklist` (unclaimed shops getting
user traffic) and mark vendors claimed:
1. Supabase left sidebar → **Table Editor** → `profiles`.
2. Find that person's row (they must have signed in at least once already
   so their profile exists), click into the `is_agent` cell, set it to
   `true`, save.
3. They can now call `GET /admin/worklist` and
   `PATCH /admin/vendors/:id/claim` — see `docs/VENDOR_ONBOARDING.md`. (An
   actual agent-facing screen in the app isn't built yet — for now this is
   backend-only; ask if you want a simple in-app or web screen for it.)

---

## Part 9 — set up the map & directions feature

The map screen (tap a vendor → "View map & get directions") uses
`react-native-maps`. It renders for free with **no API key at all** in Expo
Go and on iOS (Apple Maps) — you can try it immediately with what you
already have from Part 6. A Google Maps API key is only needed for
**Android production builds** (the free installable-app path in Part 10).

### Try it immediately (no setup needed)
1. Make sure you ran `npm install` in `mobile/` after pulling this update
   (it installs `react-native-maps` and `react-native-svg`).
2. In the app, tap any vendor → **View map & get directions**. On iOS or
   in Expo Go generally, this just works — Apple Maps (iOS) or a default
   Google Maps render (Android, Expo Go) needs no key.

### For Android production builds (needed before Part 10 on Android)
1. Complete Part 8 above if you haven't (it walks through enabling **Maps
   SDK for Android** and creating an API key in the same Google Cloud
   project as the Places import).
2. Open `mobile/app.json`, find this section, and paste your key in:
   ```json
   "android": {
     "config": {
       "googleMaps": {
         "apiKey": "REPLACE_WITH_ANDROID_GOOGLE_MAPS_API_KEY"
       }
     }
   }
   ```
3. Restrict the key in Google Cloud Console (Credentials → your key →
   "Application restrictions" → Android apps) to your app's package name
   (`com.klomo.app`) and SHA-1 fingerprint — the map screen itself
   (`docs/DEPLOYMENT.md` links this back to Part 10's build step, where
   you'll get that fingerprint) will tell you exactly where to find it if
   the map shows blank instead of tiles.

### Why directions hand off to the phone's Maps app instead of routing in-app
KLOMO's map screen shows the vendor, your position, and a straight-line
path, then a **Get Directions** button that opens Apple/Google Maps for
actual turn-by-turn navigation. This is deliberate, not a shortcut taken
under time pressure: a real in-app turn-by-turn directions API (Google
Directions API, Mapbox Directions) is a paid, metered service even on its
free tier, and duplicates navigation quality that's already excellent and
free on every phone. Building nearest-and-open discovery is KLOMO's job;
the last-mile walk/drive is the phone's own Maps app's job.

---

## Part 10 — (optional) build an installable app file

Steps 1–8 get you a fully working app via Expo Go, which is enough for
testing with friends. To produce an actual installable file (an APK for
Android, or something for the App Store):

1. Go to **expo.dev**, sign up for a free account.
2. In your terminal:
   ```
   npm install -g eas-cli
   cd Desktop/klomo/mobile
   eas login
   eas build:configure
   ```
   Follow the prompts (defaults are fine).
3. Build an Android test file:
   ```
   eas build --platform android --profile preview
   ```
   This uploads your code to Expo's free build servers and, after a few
   minutes, gives you a download link for an `.apk` file — send that link
   to anyone with an Android phone and they can install it directly (they
   may need to allow "install from unknown sources" once).
4. iOS is the same command with `--platform ios`, but Apple requires a paid
   Developer account ($99/year) before you can install on a real iPhone
   outside Expo Go — this is the one unavoidable cost in the whole stack,
   and only needed once you're ready to publish or test on iPhones outside
   Expo Go.

---

## Part 11 — set up vendor push notifications

Before this, run the new database migration if you already had KLOMO set
up: **migration `004_fraud_and_push.sql`** in the Supabase SQL Editor
(fresh installs already have this via `schema.sql`, skip it).

**Read this first:** push notifications **do not work in Expo Go on
Android at all** — this is a permanent Expo platform change (SDK 53+, and
this project is on SDK 54), not a bug. iOS Expo Go still works fine. See
`docs/PUSH_NOTIFICATIONS.md` for the full picture, including how to test
on Android anyway (a development build, not Expo Go).

1. Get a real EAS project ID (the app ships with a placeholder):
   ```
   cd mobile
   npx eas login
   npx eas init
   ```
   This writes a real ID into `app.json`'s `extra.eas.projectId` for you.
2. Install the new dependencies and let Expo pick the correct versions:
   ```
   npm install
   npx expo install --fix
   ```
3. Restart with a cleared cache: `npx expo start -c`.
4. On an iPhone with Expo Go: sign in with email/phone in the app (Account
   tab) and allow the notification permission prompt when it appears.
5. Test it: using a second identity (see the verification-flow test loop
   in `docs/VERIFICATION_FLOW.md`), report a shop owned by the first
   identity. The owner's phone should receive a push within a few seconds,
   even with the app closed. Tapping it should open straight to the
   Account tab.
6. If no push arrives but the in-app badge dot on the Account tab still
   shows up next time you open the app — that's the fallback working
   correctly, not a failure. Check you're not on Android + Expo Go first
   (see above) before assuming something's broken.

---

## Part 12 — the new fraud review queue (for agents)

No new setup beyond running migration `004`. Field agents (`profiles.is_agent = true`,
same flag used for the vendor-claiming worklist) can now also review
flagged reports:

```
GET  /admin/fraud-flags              — unresolved flags, most recent first
PATCH /admin/fraud-flags/:id/resolve — mark reviewed
```

There's no in-app screen for this yet (same "API-only until there are
enough agents to justify a screen" state as the vendor worklist) — call it
via a tool like Postman, or ask for a simple screen to be built once this
becomes a regular workflow. See `docs/FRAUD_DETECTION.md` for what each
flag type means and why the system never auto-acts on them.

---

## Troubleshooting checklist

- **"command not found" for `node`, `npm`, or `git`** → the install in
  Part 1 didn't finish or your terminal needs restarting. Close and reopen
  the terminal, or restart your computer.
- **Backend `.env` looks right but `/health` won't load** → make sure
  `npm run dev` is actually still running in that terminal window (it must
  stay open).
- **App shows "No categories" or errors on load** → check
  `EXPO_PUBLIC_API_URL` in `mobile/.env` points to a URL that's actually
  responding (test it in a browser first).
- **Location permission errors on Android** → Settings → Apps → Expo Go →
  Permissions → Location → Allow.
- **Render deploy fails** → check the "Logs" tab on your Render service —
  it almost always means a missing/misspelled environment variable.
- **Google Places import returns 0 results** → double check the type
  mapping for that category actually exists near your chosen coordinates,
  and that billing is enabled on your Google Cloud project (Places API
  silently returns errors without it).
- **`Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'X' could
  not be found` or "runtime not ready" on launch** → your project's `expo`
  version is OLDER than what your Expo Go app supports. Run
  `cd mobile && npx expo install --fix`.
- **"Project is incompatible with this version of Expo Go... download the
  latest version" — but you already have the latest App Store version** →
  the opposite problem: your project's `expo` version is NEWER than what
  Apple has approved for the App Store. This is a real, recurring, ongoing
  issue — Apple's app review for new Expo Go builds routinely lags weeks
  behind each Expo SDK release, and Expo Go's own error message doesn't
  explain this. Two real fixes:
  1. Open your installed Expo Go app and check exactly which SDK it
     supports (shown on launch or in its settings). Then in `mobile/`, set
     `"expo"` in `package.json` to match that SDK number and run
     `npx expo install --fix`.
  2. Or just use this project's default — it's pinned to **SDK 54**
     specifically because that version has stable App Store availability.
     If you've changed it, revert `"expo"` to `"~54.0.0"` and rerun
     `npm install && npx expo install --fix`.
- **`ERESOLVE unable to resolve dependency tree` mentioning
  `react-native@undefined`** → a version number somewhere in
  `mobile/package.json` doesn't actually exist on npm (easy to typo an
  exact patch version, e.g. guessing `0.86.1` when only `0.86.0` was ever
  published). Don't reach for `--legacy-peer-deps` to force past this —
  fix the actual bad version number, or just run `npx expo install --fix`
  after a plain `npm install` to let Expo pick correct versions itself.
- **"Missing bearer token" or "Not signed in" when listing a shop,
  reporting status, or searching** → the app never got an anonymous
  session at launch, almost always because **Anonymous Sign-Ins isn't
  enabled** in your Supabase project (Part 3, step "Turn on anonymous +
  OTP sign-in" — easy to skip). Fix: Supabase dashboard → Authentication →
  Providers → toggle on **Anonymous Sign-Ins**, then fully restart the app
  (close and reopen, or reload in Expo Go). Immediate workaround without
  waiting to fix the Supabase setting: sign in with email from the Account
  tab — a real signed-in session works regardless of the anonymous-sign-in
  setting, and unblocks every feature, not just vendor listing.
- **"Unable to resolve asset './assets/icon.png'" (or splash/adaptive-icon)**
  → the `mobile/assets/` folder is missing or incomplete. This repo ships
  with real placeholder assets already; if you deleted or moved them,
  restore `mobile/assets/icon.png`, `adaptive-icon.png`, and `splash.png`
  (any PNG works as a placeholder — replace with real branding whenever
  you're ready).
- **Sign-in sends a clickable link instead of a 6-digit code, and the link
  doesn't work** → Supabase's email sign-in defaults to magic links, not
  codes, regardless of what the method is named. Fix: Supabase dashboard →
  Authentication → Email Templates → Magic Link → edit the template to
  show `{{ .Token }}` instead of `{{ .ConfirmationURL }}` (exact template
  in Part 3 above). Request a fresh code after saving — already-sent emails
  don't retroactively change.
- **No verification request appears for the shop owner after a user
  reports status** → check that migration `003_verification_and_presence.sql`
  has been run (the `verification_requests` table must exist), and that
  the vendor being reported has both `owner_id` set and
  `claim_status = 'claimed'` — unclaimed vendors can't be asked to verify
  themselves. See `docs/VERIFICATION_FLOW.md`.
- **Sign-in screen won't let you type an email, only numbers** → this was
  a real bug in an earlier version (the field started in phone-only
  keyboard mode, which has no `@` key). Fixed in `SignInScreen.js` by
  using `keyboardType="default"` — if you're on an old copy, update that
  one line.
- **Push notification never arrives, but everything else works** →
  check, in order: (1) are you testing on Android in Expo Go? That
  combination cannot receive push at all, full stop — see Part 11 above.
  (2) Does `app.json`'s `extra.eas.projectId` still say
  `REPLACE_WITH_EAS_PROJECT_ID`? Run `npx eas init`. (3) Did the vendor
  actually grant the notification permission prompt at sign-in? (4) Check
  your Render logs right when the report is filed — `pushNotifications.js`
  logs the real Expo API error rather than swallowing it. The in-app badge
  dot on the Account tab works independently of all of this — if that's
  also not appearing, the problem is upstream (see the earlier "no
  verification request appears" entry), not push-specific.
- **"Please wait a few minutes before reporting this vendor again" when
  responding to your OWN verification card** → a real bug, fixed in
  migration `005_fix_cooldown_source_check.sql`. It happened because
  reporting your own claimed shop as a "customer" first, then trying to
  respond to the verification prompt it created, both count as the same
  reporter+vendor pair within the cooldown window — even though they're
  conceptually different actions. Run migration 005 in the Supabase SQL
  Editor if you haven't already; no app code changes needed, this was a
  database trigger fix.
- **A vendor got flagged as a "burst" but it seems like a false alarm** →
  expected sometimes, by design — see `docs/FRAUD_DETECTION.md`'s
  explanation of why genuine fast consensus and a coordinated attack look
  identical from timing alone. This is a review queue
  (`GET /admin/fraud-flags`) for a human to glance at, not an automatic
  penalty — nothing about the vendor's score or listing changes on its own.
- **Android map screen is blank / gray** → almost always a missing or
  unrestricted Google Maps API key. Confirm `mobile/app.json` has your key
  under `android.config.googleMaps.apiKey`, that **Maps SDK for Android**
  is enabled in Google Cloud Console (separate from Places API), and that
  you rebuilt (`npx expo start -c` for Expo Go testing, or a fresh EAS
  build for production) after adding the key — it doesn't hot-reload.

---

## What it costs as you grow

Everything above is $0/month except the optional $99/year Apple account.
The first ceiling you'll hit is Supabase's 500MB free database — at this
app's row sizes that's comfortably past a million status reports, so
you'll have real usage (and probably some revenue or funding) before you
need Supabase's $25/month Pro tier. Render's free sleep-after-15-minutes
becomes annoying before that, at which point $7/month removes it.
