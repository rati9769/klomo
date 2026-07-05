import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import TrustBadge from '../components/TrustBadge';
import { colors, spacing, radius, shadow } from '../constants/theme';
import { DUSK_MAP_STYLE } from '../constants/mapStyle';
import { getCurrentLocation } from '../services/location';
import { openDirections } from '../services/directions';

function VendorMarker({ color, mci, onSolid }) {
  return (
    <View style={styles.markerOuter}>
      <View style={[styles.markerRing, { borderColor: color }]}>
        <View style={[styles.markerCore, { backgroundColor: color }]}>
          <MaterialCommunityIcons name={mci || 'storefront-outline'} size={17} color={onSolid || '#FFF'} />
        </View>
      </View>
      <View style={[styles.markerTail, { borderTopColor: color }]} />
    </View>
  );
}

export default function VendorMapScreen({ route, navigation }) {
  const { vendor, category } = route.params;
  const mapRef = useRef(null);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    getCurrentLocation()
      .then(setUserLocation)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.fitToCoordinates(
      [
        { latitude: vendor.latitude, longitude: vendor.longitude },
        { latitude: userLocation.lat, longitude: userLocation.lng },
      ],
      { edgePadding: { top: 120, right: 80, bottom: 220, left: 80 }, animated: true }
    );
  }, [userLocation]);

  const statusColor =
    vendor.status === 'Open' ? colors.open : vendor.status === 'Closed' ? colors.closed : colors.uncertain;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={Platform.OS === 'android' ? DUSK_MAP_STYLE : undefined}
        userInterfaceStyle="dark"
        initialRegion={{
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        <Marker coordinate={{ latitude: vendor.latitude, longitude: vendor.longitude }} anchor={{ x: 0.5, y: 1 }}>
          <VendorMarker color={category?.solid || colors.brand} mci={category?.mci} onSolid={category?.onSolid} />
        </Marker>

        {userLocation && (
          <Polyline
            coordinates={[
              { latitude: userLocation.lat, longitude: userLocation.lng },
              { latitude: vendor.latitude, longitude: vendor.longitude },
            ]}
            strokeColor={colors.accent}
            strokeWidth={2.5}
            lineDashPattern={[8, 8]}
          />
        )}
      </MapView>

      <SafeAreaView style={styles.topOverlay} pointerEvents="box-none">
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.white} />
        </TouchableOpacity>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomOverlay} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.vendorName} numberOfLines={1}>{vendor.name}</Text>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          </View>
          {vendor.address ? <Text style={styles.address} numberOfLines={1}>{vendor.address}</Text> : null}
          <View style={styles.badgeRow}>
            <TrustBadge status={vendor.status} confidence={vendor.confidence} size="sm" />
            <Text style={styles.distance}>
              {vendor.distanceMeters < 1000 ? `${vendor.distanceMeters} m` : `${(vendor.distanceMeters / 1000).toFixed(1)} km`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.directionsBtn}
            onPress={() => openDirections({ latitude: vendor.latitude, longitude: vendor.longitude, label: vendor.name })}
          >
            <Text style={styles.directionsBtnText}>Get Directions</Text>
            <MaterialCommunityIcons name="navigation-variant-outline" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1E1A16' },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.md },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30,26,22,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  backArrow: { fontSize: 24, color: colors.white, marginTop: -2, fontWeight: '700' },
  bottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.lg,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vendorName: { fontSize: 17, fontWeight: '800', color: colors.ink, flex: 1, marginRight: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  address: { fontSize: 12.5, color: colors.inkFaint, marginTop: 2, fontWeight: '500' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  distance: { fontSize: 12.5, color: colors.inkSoft, fontWeight: '700' },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.md,
  },
  directionsBtnText: { color: colors.white, fontWeight: '800', fontSize: 14.5, marginRight: 6 },
  directionsBtnArrow: { color: colors.white, fontWeight: '800', fontSize: 16 },
  markerOuter: { alignItems: 'center' },
  markerRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCore: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerIcon: { fontSize: 16 },
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
});
