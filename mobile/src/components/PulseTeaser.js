import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CategoryIcon from './CategoryIcon';
import { colors, radius, spacing, shadow, type } from '../constants/theme';
import { categoryStyle } from '../constants/categories';
import { api } from '../services/api';
import { getCurrentLocation } from '../services/location';

// Home-screen entry to the Local Availability Graph — a deep-charcoal
// "night mode" card that contrasts the warm page (the glassy-dark note
// from the map references). Full breakdown lives on the Pulse tab.
export default function PulseTeaser({ onPress }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const hasLoadedOnce = useRef(false);

  // HomeTab stays mounted when you switch tabs — refetch on every focus
  // (silent after the first load) so this reflects reports filed while
  // you were elsewhere, not just whatever was true when the app opened.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const silent = hasLoadedOnce.current;
        if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
        try {
          const loc = await getCurrentLocation();
          const r = await api.availabilityPulse({ lat: loc.lat, lng: loc.lng, radius: 3000 });
          setState({ loading: false, error: null, data: r });
        } catch (e) {
          setState({ loading: false, error: e.message, data: null });
        } finally {
          hasLoadedOnce.current = true;
        }
      })();
    }, [])
  );

  if (state.loading) {
    return (
      <View style={[styles.card, styles.centered]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (state.error || state.data?.overallPercentage == null) return null;

  const topCategories = [...state.data.categories]
    .filter((c) => c.openPercentage != null)
    .sort((a, b) => b.openPercentage - a.openPercentage)
    .slice(0, 4);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.92} onPress={onPress}>
      <View style={styles.headerRow}>
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LOCAL PULSE</Text>
        </View>
        <MaterialCommunityIcons name="arrow-top-right" size={18} color="rgba(255,255,255,0.85)" />
      </View>

      <View style={styles.statRow}>
        <Text style={styles.bigNumber}>{state.data.overallPercentage}%</Text>
        <Text style={styles.bigNumberLabel}>of nearby places{'\n'}open right now</Text>
      </View>

      {topCategories.length > 0 && (
        <View style={styles.miniRow}>
          {topCategories.map((c) => {
            const style = categoryStyle(c.slug);
            return (
              <View key={c.slug} style={styles.miniItem}>
                <CategoryIcon category={{ ...style, ...c }} size={28} mode="solid" />
                <Text style={styles.miniPct}>{c.openPercentage}%</Text>
              </View>
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.night,
    borderRadius: radius.xl,
    padding: spacing.md + 4,
    marginTop: spacing.lg,
    ...shadow.md,
  },
  centered: { alignItems: 'center', justifyContent: 'center', minHeight: 110 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#8BC46A' },
  liveText: { ...type.overline, color: 'rgba(255,255,255,0.55)' },
  statRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.sm + 2 },
  bigNumber: { fontSize: 44, fontWeight: '800', color: colors.white, letterSpacing: -1, marginRight: spacing.sm + 2 },
  bigNumberLabel: { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.68)', lineHeight: 17, marginBottom: 8 },
  miniRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  miniItem: { alignItems: 'center', gap: 4 },
  miniPct: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)' },
});
