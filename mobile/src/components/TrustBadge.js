import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../constants/theme';

const STYLE_BY_STATUS = {
  Open: { bg: colors.openBg, fg: colors.open, label: 'Open', icon: 'check-circle' },
  Closed: { bg: colors.closedBg, fg: colors.closed, label: 'Closed', icon: 'close-circle' },
  Uncertain: { bg: colors.uncertainBg, fg: colors.uncertain, label: 'Uncertain', icon: 'help-circle' },
};

export default function TrustBadge({ status, confidence, size = 'md' }) {
  const style = STYLE_BY_STATUS[status] || STYLE_BY_STATUS.Uncertain;
  const compact = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: style.bg }, compact && styles.badgeCompact]}>
      <MaterialCommunityIcons name={style.icon} size={compact ? 13 : 15} color={style.fg} />
      <Text style={[styles.label, { color: style.fg }, compact && styles.labelCompact]}>
        {style.label}
      </Text>
      <View style={[styles.divider, { backgroundColor: style.fg }]} />
      <Text style={[styles.confidence, { color: style.fg }, compact && styles.labelCompact]}>
        {confidence}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    gap: 5,
  },
  badgeCompact: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  label: { fontWeight: '800', fontSize: 12.5 },
  labelCompact: { fontSize: 11 },
  divider: { width: 1, height: 11, opacity: 0.3 },
  confidence: { fontSize: 11.5, fontWeight: '700', opacity: 0.85 },
});
