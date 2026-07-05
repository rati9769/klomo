// Sends push notifications through Expo's push service. Deliberately a
// plain fetch() rather than the expo-server-sdk-node package — one HTTP
// call, no extra dependency, matches the rest of this project's
// keep-infra-minimal approach. See docs/PUSH_NOTIFICATIONS.md, especially
// the Expo Go platform gap (works out of the box in Expo Go on iOS; needs
// a development build to test on Android from SDK 53 onward).

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * @param {string} expoPushToken - token in the form ExponentPushToken[...]
 * @param {{ title: string, body: string, data?: object }} message
 */
export async function sendPushNotification(expoPushToken, { title, body, data = {} }) {
  if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) {
    // Not a real Expo push token (missing, malformed, or a native FCM/APNs
    // token someone pasted by mistake) — skip rather than let Expo's API
    // reject the whole batch.
    return;
  }

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify({
      to: expoPushToken,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
    }),
  });

  const json = await res.json().catch(() => ({}));

  // Expo returns 200 even for some per-message failures (they're reported
  // inside the ticket, not as an HTTP error) — surface both cases so a
  // silent delivery failure doesn't disappear the way earlier bugs in this
  // project did.
  if (!res.ok) {
    throw new Error(`Expo push API returned ${res.status}: ${JSON.stringify(json)}`);
  }
  const ticket = json?.data;
  if (ticket?.status === 'error') {
    throw new Error(`Expo push ticket error: ${ticket.message} (${ticket.details?.error || 'unknown'})`);
  }
}
