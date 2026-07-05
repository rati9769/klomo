import * as Location from 'expo-location';
import geohash from 'ngeohash';

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission is required to find nearby shops.');
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}

/**
 * Coarse geohash (5 chars ~ 4.9km x 4.9km cell) used ONLY for the anonymous
 * "trending near you" aggregate — never the precise coordinate. This is what
 * lets us show city-level trends without ever storing anyone's exact
 * location history against their identity.
 */
export function coarseGeohash({ lat, lng }) {
  return geohash.encode(lat, lng, 5);
}
