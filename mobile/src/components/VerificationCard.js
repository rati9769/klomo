import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing, shadow, type } from '../constants/theme';

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// The vendor-alert card. A colored left accent + icon badge reflect the
// REPORTED status (what the customer claimed) so the owner can tell at a
// glance what they're being asked to confirm, before reading any text.
export default function VerificationCard({ request, onRespond, responding }) {
  const isClosedReport = request.reportedStatus === 'closed';
  const accentColor = isClosedReport ? colors.closed : colors.open;
  const accentBg = isClosedReport ? colors.closedBg : colors.openBg;

  return (
    <View style={[styles.card, { borderLeftColor: accentColor }]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconBadge, { backgroundColor: accentBg }]}>
          <MaterialCommunityIcons
            name={isClosedReport ? 'lock-clock-outline' : 'bell-ring-outline'}
            size={17}
            color={accentColor}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.text}>
            A customer reported <Text style={styles.bold}>{request.vendorName}</Text> as{' '}
            <Text style={[styles.bold, { color: accentColor }]}>{request.reportedStatus}</Text>
          </Text>
          <Text style={styles.meta}>{timeAgo(request.createdAt)} · confirm to help other customers</Text>
        </View>
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.btn, styles.openBtn]}
          disabled={responding}
          onPress={() => onRespond(request, 'open')}
        >
          <MaterialCommunityIcons name="check-circle-outline" size={15} color={colors.white} />
          <Text style={styles.openBtnText}>We're open</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.closedBtn]}
          disabled={responding}
          onPress={() => onRespond(request, 'closed')}
        >
          <MaterialCommunityIcons name="close-circle-outline" size={15} color={colors.closed} />
          <Text style={styles.closedBtnText}>We're closed</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginBottom: spacing.sm + 4,
    ...shadow.sm,
  },
  headerRow: { flexDirection: 'row', gap: spacing.sm + 2, alignItems: 'flex-start' },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { ...type.body, fontSize: 13.5, color: colors.ink, lineHeight: 19 },
  bold: { fontWeight: '800' },
  meta: { ...type.meta, fontSize: 10.5, marginTop: 4 },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  btn: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 3,
    borderRadius: radius.pill,
  },
  openBtn: { backgroundColor: colors.open },
  closedBtn: { backgroundColor: colors.closedBg },
  openBtnText: { color: colors.white, fontWeight: '800', fontSize: 12.5 },
  closedBtnText: { color: colors.closed, fontWeight: '800', fontSize: 12.5 },
});
