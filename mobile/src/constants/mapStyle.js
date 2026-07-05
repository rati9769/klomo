// A custom warm-dark, low-noise map skin — tied to the app's earthy accent
// family rather than a generic blue-gray dark map, so it still feels like
// KLOMO rather than a bare embedded Google Maps widget. Applies via
// `customMapStyle` on Android (Google Maps). On iOS, Apple Maps dark mode
// is applied separately via `userInterfaceStyle` in VendorMapScreen —
// Apple Maps doesn't take a JSON style array.
export const DUSK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1E1A16' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1E1A16' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#A79E8C' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#332C24' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2C2620' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#221D18' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3A322A' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#8A8070' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#28352F' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5A7A6C' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#24201A' }] },
];
