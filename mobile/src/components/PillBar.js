import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import CategoryIcon from './CategoryIcon';
import { colors, spacing, type } from '../constants/theme';

const TRACK_HEIGHT = 150;
const TRACK_WIDTH = 42;
const MIN_VISIBLE_PCT = 9;

// Vertical rounded-capsule bar (the reference's mood chart, repurposed as
// the Local Availability Graph's category comparison).
export default function PillBar({ category, percentage, onPress }) {
  const hasData = percentage != null;
  const displayPct = hasData ? Math.max(percentage, MIN_VISIBLE_PCT) : 0;

  return (
    <TouchableOpacity
      style={styles.wrap}
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { height: `${displayPct}%`, backgroundColor: hasData ? category.solid : colors.surfaceSunk },
          ]}
        >
          {hasData && <Text style={styles.fillLabel}>{percentage}%</Text>}
        </View>
      </View>
      <CategoryIcon category={category} size={30} />
      <Text style={styles.label} numberOfLines={2}>
        {category.label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: 72, gap: spacing.sm },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_WIDTH / 2,
    backgroundColor: colors.surfaceSunk,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    borderRadius: TRACK_WIDTH / 2,
    alignItems: 'center',
    paddingTop: 10,
  },
  fillLabel: { color: colors.white, fontWeight: '800', fontSize: 11.5 },
  label: { ...type.meta, fontSize: 10.5, textAlign: 'center', lineHeight: 13 },
});
