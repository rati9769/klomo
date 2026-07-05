import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing, shadow, type } from '../constants/theme';
import { getCurrentLocation } from '../services/location';

// Map-based location picker for vendor registration. Rationale: an owner
// often registers from home — pinning their CURRENT location would put the
// shop in their living room. Drag the pin (or tap the map) to the shop's
// true spot; "Use my location" is offered as a shortcut, not the default
// truth.
export default function LocationPicker({ value, onChange }) {
  const mapRef = useRef(null);
  const [region, setRegion] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const loc = await getCurrentLocation();
        const initial = { latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
        setRegion(initial);
        if (!value) onChange({ lat: loc.lat, lng: loc.lng });
      } catch {
        // Location denied — start on a wide default; the person can still
        // pan/tap to place the pin manually.
        setRegion({ latitude: 20.5937, longitude: 78.9629, latitudeDelta: 12, longitudeDelta: 12 });
      }
    })();
  }, []);

  const setPin = (lat, lng) => onChange({ lat, lng });

  const recenter = async () => {
    try {
      const loc = await getCurrentLocation();
      setPin(loc.lat, loc.lng);
      mapRef.current?.animateToRegion(
        { latitude: loc.lat, longitude: loc.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
        400
      );
    } catch {}
  };

  if (!region) return <View style={[styles.map, styles.placeholder]} />;

  return (
    <View>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={region}
          onPress={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            setPin(latitude, longitude);
          }}
        >
          {value && (
            <Marker
              coordinate={{ latitude: value.lat, longitude: value.lng }}
              draggable
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setPin(latitude, longitude);
              }}
            />
          )}
        </MapView>
        <TouchableOpacity style={styles.recenterBtn} onPress={recenter}>
          <MaterialCommunityIcons name="crosshairs-gps" size={17} color={colors.ink} />
        </TouchableOpacity>
      </View>
      <View style={styles.hintRow}>
        <MaterialCommunityIcons name="gesture-tap" size={14} color={colors.inkFaint} />
        <Text style={styles.hint}>
          Tap the map or drag the pin to your shop's exact spot — especially if you're not at the
          shop right now.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: { borderRadius: radius.md, overflow: 'hidden', ...shadow.sm },
  map: { width: '100%', height: 220 },
  placeholder: { backgroundColor: colors.surfaceSunk, borderRadius: radius.md },
  recenterBtn: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  hintRow: { flexDirection: 'row', gap: 6, marginTop: spacing.sm, alignItems: 'flex-start' },
  hint: { ...type.meta, flex: 1, lineHeight: 16 },
});
