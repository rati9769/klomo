import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import TrustBadge from './TrustBadge';
import { colors, radius, spacing, shadow, type } from '../constants/theme';

function formatDistance(m) {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function VendorCard({ vendor, onPress }) {
  const isUnclaimed =
    vendor.claimStatus === 'unclaimed' || vendor.claimStatus === 'pending_agent_visit';

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.88} onPress={onPress}>
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {vendor.name}
        </Text>
        <View style={styles.distancePill}>
          <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.inkSoft} />
          <Text style={styles.distanceText}>{formatDistance(vendor.distanceMeters)}</Text>
        </View>
      </View>

      {vendor.verificationLevel > 0 && (
        <View style={styles.verifiedRow}>
          <MaterialCommunityIcons name="check-decagram" size={13} color={colors.brandDeep} />
          <Text style={styles.verifiedText}>Verified vendor</Text>
        </View>
      )}

      {isUnclaimed && (
        <View style={styles.warnRow}>
          <MaterialCommunityIcons name="alert-circle-outline" size={13} color={colors.uncertain} />
          <Text style={styles.warnText}>Unclaimed — sourced from Google, please verify</Text>
        </View>
      )}

      <View style={styles.footer}>
        <TrustBadge status={vendor.status} confidence={vendor.confidence} />
        <Text style={styles.reportCount}>
          {vendor.reportCount} report{vendor.reportCount === 1 ? '' : 's'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm + 4,
    ...shadow.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { ...type.heading, fontSize: 16.5, flex: 1, marginRight: spacing.sm },
  distancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSunk,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    gap: 3,
  },
  distanceText: { fontSize: 11, fontWeight: '800', color: colors.inkSoft },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  verifiedText: { fontSize: 11.5, fontWeight: '700', color: colors.brandDeep },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  warnText: { fontSize: 11, fontWeight: '600', color: colors.uncertain, flex: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm + 4,
  },
  reportCount: { ...type.meta },
});
