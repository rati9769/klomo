import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import TrustBadge from '../components/TrustBadge';
import { colors, spacing, radius, shadow, type } from '../constants/theme';
import { api } from '../services/api';

export default function VendorDetailScreen({ route, navigation }) {
  const { vendor, category } = route.params;
  const [status, setStatus] = useState(vendor.status);
  const [confidence, setConfidence] = useState(vendor.confidence);
  const [submitting, setSubmitting] = useState(false);

  const submitReport = async (value) => {
    setSubmitting(true);
    try {
      await api.reportStatus(vendor.id, value, 'user');
      setStatus(value === 'open' ? 'Open' : 'Closed');
      setConfidence((c) => Math.min(100, c + 15));
      Alert.alert('Thanks!', 'Your report helps everyone nearby right now.');
    } catch (e) {
      Alert.alert('Could not submit', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.name}>{vendor.name}</Text>
          <Text style={styles.address}>
            {vendor.address || `${vendor.distanceMeters} m away`}
          </Text>

          {(vendor.claimStatus === 'unclaimed' || vendor.claimStatus === 'pending_agent_visit') && (
            <View style={styles.warningBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={15} color={colors.uncertain} />
              <Text style={styles.warningBody}>
                {vendor.sourcedNote ||
                  'Sourced from Google, not confirmed by the owner yet. Please verify before relying on this.'}
              </Text>
            </View>
          )}

          <TrustBadge status={status} confidence={confidence} />

          {vendor.latitude != null && vendor.longitude != null && (
            <TouchableOpacity
              style={styles.mapBtn}
              onPress={() => navigation.navigate('VendorMap', { vendor, category })}
            >
              <MaterialCommunityIcons name="map-outline" size={17} color={colors.ink} />
              <Text style={styles.mapBtnText}>View map & get directions</Text>
              <Ionicons name="arrow-forward" size={15} color={colors.brandDeep} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.reportCard}>
          <Text style={styles.sectionTitle}>Is this still accurate?</Text>
          <Text style={styles.sectionSubtitle}>
            Your report is weighted by recency and your track record. If this shop is claimed,
            the owner gets asked to confirm too.
          </Text>

          <View style={styles.reportRow}>
            <TouchableOpacity
              style={[styles.reportBtn, styles.openBtn]}
              disabled={submitting}
              onPress={() => submitReport('open')}
            >
              <MaterialCommunityIcons name="check-circle-outline" size={17} color={colors.open} />
              <Text style={styles.reportBtnTextOpen}>Yes, open</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.reportBtn, styles.closedBtn]}
              disabled={submitting}
              onPress={() => submitReport('closed')}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={17} color={colors.closed} />
              <Text style={styles.reportBtnTextClosed}>No, closed</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.md },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  name: { ...type.title, fontSize: 21 },
  address: { ...type.body, fontSize: 13, marginTop: 3, marginBottom: spacing.md },
  warningBox: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
    backgroundColor: colors.uncertainBg,
    borderRadius: radius.sm,
    padding: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  warningBody: { fontSize: 12, lineHeight: 17, fontWeight: '600', color: colors.uncertain, flex: 1 },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceSunk,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  mapBtnText: { ...type.label, fontSize: 13.5, flex: 1 },
  reportCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadow.sm,
  },
  sectionTitle: { ...type.heading, fontSize: 15.5 },
  sectionSubtitle: { ...type.body, fontSize: 12.5, marginTop: 4, marginBottom: spacing.md },
  reportRow: { flexDirection: 'row', gap: spacing.sm },
  reportBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBtn: { backgroundColor: colors.openBg },
  closedBtn: { backgroundColor: colors.closedBg },
  reportBtnTextOpen: { color: colors.open, fontWeight: '800', fontSize: 13.5 },
  reportBtnTextClosed: { color: colors.closed, fontWeight: '800', fontSize: 13.5 },
});
