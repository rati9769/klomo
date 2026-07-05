import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';

// Push notifications, scoped intentionally to signed-in (non-anonymous)
// users only — right now the only thing we push about is "a customer
// reported your shop, please confirm," which only makes sense for a real
// vendor account. See docs/PUSH_NOTIFICATIONS.md for the full picture,
// especially the Expo Go platform gap: works out of the box in Expo Go on
// iOS; Android needs a development build from Expo SDK 53 onward — there
// is no way around this from JavaScript alone, it's a platform change on
// Expo's side, not a bug in this code.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device (no emulator/simulator support).');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Push notification permission was not granted.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn(
      'No EAS projectId found in app.json (extra.eas.projectId) — cannot generate an Expo push token yet. See docs/PUSH_NOTIFICATIONS.md.'
    );
    return null;
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResponse.data;
    await api.registerPushToken(token);
    return token;
  } catch (e) {
    console.warn('Failed to register push token:', e.message);
    return null;
  }
}

/**
 * Wires a listener for when the person taps a notification (app in
 * background or just-launched from a killed state). Returns an unsubscribe
 * function — call it from a cleanup effect.
 */
export function addNotificationTapListener(onVerificationRequestTapped) {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    if (data?.type === 'verification_request') {
      onVerificationRequestTapped(data);
    }
  });
  return () => subscription.remove();
}
