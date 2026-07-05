import { Platform, Linking } from 'react-native';

/**
 * Hands off to the native Maps app for real turn-by-turn navigation.
 * Deliberately NOT building in-app turn-by-turn routing — that needs a
 * paid directions API at scale and duplicates what's already excellent
 * and free on-device. KLOMO's job is to get you to "which vendor, is it
 * open" fast; the last mile is the phone's own Maps app's job.
 */
export function openDirections({ latitude, longitude, label }) {
  const encodedLabel = encodeURIComponent(label || 'Destination');

  const url = Platform.select({
    ios: `maps://app?daddr=${latitude},${longitude}&q=${encodedLabel}`,
    android: `google.navigation:q=${latitude},${longitude}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
  });

  const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  Linking.canOpenURL(url)
    .then((supported) => Linking.openURL(supported ? url : fallbackUrl))
    .catch(() => Linking.openURL(fallbackUrl));
}
