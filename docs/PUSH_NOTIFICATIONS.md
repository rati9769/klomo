# Push notifications

Vendor-only, for one reason right now: the only thing KLOMO pushes about
is "a customer reported your shop, please confirm" — that only makes
sense for a signed-in vendor account, so registration deliberately never
happens for anonymous sessions.

## The platform gap — read this before testing

**Push notifications do not work in Expo Go on Android, at all, as of
Expo SDK 53 and later** (this project is on SDK 54). This is a real,
permanent platform change on Expo's side, not a bug in this code or
something fixable from JavaScript:

| Platform | Expo Go | Development build |
|---|---|---|
| iOS | **Works** — Expo auto-provisions APNs credentials | Works |
| Android | **Does not work at all** | Works |

If you're testing on Android and a push never arrives, this is why —
check `expo-notifications` isn't silently failing before assuming the
backend is broken. The in-app verification card and tab badge dot both
still work regardless of push delivery (see "What still works without
push" below), so the feature degrades gracefully rather than breaking.

### To test push on Android
You need a development build, not Expo Go:
```bash
cd mobile
npx expo install expo-dev-client
npx expo prebuild
npx expo run:android
```
This requires Android Studio / an Android SDK set up locally, or use `eas
build --profile development --platform android` to build one in the cloud
instead (still free on EAS's free tier, just slower than a local build).

## How it works

1. On successful sign-in (`SignInScreen.js`), the app requests notification
   permission and, if granted, generates an Expo push token
   (`services/notifications.js`) and sends it to
   `POST /notifications/register-token`, which stores it on
   `profiles.expo_push_token`.
2. When a user reports a **claimed** vendor's status
   (`POST /status/report`), the backend creates a `verification_request`
   (see `docs/VERIFICATION_FLOW.md`) and, if the owner has a registered
   token, sends a push via `services/pushNotifications.js` — a plain
   `fetch()` to Expo's push API (`https://exp.host/--/api/v2/push/send`),
   no extra backend dependency.
3. Tapping the notification opens the app straight to the Account tab
   (`AppNavigator.js`'s notification-tap listener), where the actual
   verification card is.

## What still works without push

Even if push never arrives — permission denied, Android + Expo Go,
notification silently dropped — the same information is always visible
in-app:
- A red badge dot on the Account tab icon (`AppTabBar.js`, driven by
  `VerificationContext`) shows there's something pending, refreshed every
  time any screen using the context reloads.
- The Account tab's verification card list (`VerificationCard.js`) is the
  actual source of truth — push is a convenience notification about
  something that's already there, never the only way to see it.

## Setting up your own EAS project ID

`Notifications.getExpoPushTokenAsync()` needs a real `projectId` in
`app.json`'s `extra.eas.projectId` (currently a placeholder in this repo).
Get one free:
```bash
cd mobile
npx eas init
```
This writes the real project ID into `app.json` for you. Until this is a
real ID, `registerForPushNotifications()` logs a warning and returns
`null` — sign-in and everything else still works, you just won't get a
token registered.

## Honest limitations

- **One token per profile.** Signing in on a second device overwrites the
  first device's token. A stale token just fails silently on send — no
  crash, no error surfaced to the vendor, the notification simply doesn't
  arrive. Acceptable for now; multi-device support would need a
  `push_tokens` table keyed by device, not a single column on `profiles`.
- **No delivery confirmation.** Expo returns a "ticket" immediately, and a
  real delivery "receipt" only becomes available ~15+ minutes later via a
  separate API call this project doesn't check yet. If push silently stops
  working in production, this is the first thing to add — see Expo's own
  push notification FAQ for the receipt-checking pattern.
- **This app's code requires a physical device**, even though Expo's own
  infrastructure separately supports push on iOS Simulators (Xcode 14+,
  macOS 13+, iOS 16+) and some Android emulator images with Google Play
  Services. `notifications.js` checks `Device.isDevice` and skips
  registration entirely otherwise — a deliberate simplification, since
  most Android emulator images don't actually have Play Services and
  supporting the partial simulator matrix isn't worth the complexity yet.
  If you need simulator testing, that check is the one line to loosen.
