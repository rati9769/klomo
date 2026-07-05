import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import PillBar from '../components/PillBar';
import CategoryIcon from '../components/CategoryIcon';
import { colors, spacing, radius, shadow, type } from '../constants/theme';
import { categoryStyle } from '../constants/categories';
import { api } from '../services/api';
import { getCurrentLocation } from '../services/location';

export default function LocalPulseScreen({ navigation, hideBack }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const hasLoadedOnce = useRef(false);

  // This screen is a persistent tab — React Navigation keeps it mounted
  // when you switch away, so a mount-once effect would never see a report
  // filed while you were elsewhere. Refetch on every focus; silent after
  // the first load so the numbers update in place instead of flashing a
  // spinner each time you tap back to this tab.
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

  const sorted = state.data
    ? [...state.data.categories].sort((a, b) => (b.openPercentage ?? -1) - (a.openPercentage ?? -1))
    : [];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {!hideBack && (
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={20} color={colors.ink} />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.overline}>LIVE RIGHT NOW</Text>
            <Text style={styles.title}>Local Pulse</Text>
          </View>
        </View>

        {state.loading ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={colors.brand} />
        ) : state.error ? (
          <Text style={styles.errorText}>{state.error}</Text>
        ) : (
          <>
            {state.data.overallPercentage != null && (
              <View style={styles.overallCard}>
                <Text style={styles.overallNumber}>{state.data.overallPercentage}%</Text>
                <Text style={styles.overallLabel}>
                  of nearby places are open, across every category
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>By category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chartRow}
            >
              {sorted.map((cat) => {
                const style = categoryStyle(cat.slug);
                const merged = { ...style, ...cat, ...style };
                return (
                  <PillBar
                    key={cat.slug}
                    category={merged}
                    percentage={cat.openPercentage}
                    onPress={() =>
                      navigation.navigate('CategoryResults', { category: merged })
                    }
                  />
                );
              })}
            </ScrollView>

            <View style={styles.metaList}>
              {sorted.map((cat) => {
                const style = categoryStyle(cat.slug);
                return (
                  <View key={cat.slug} style={styles.metaRow}>
                    <CategoryIcon category={style} size={30} />
                    <Text style={styles.metaLabel}>{cat.label}</Text>
                    <Text style={styles.metaValue}>
                      {cat.totalVendors === 0
                        ? 'no vendors listed'
                        : `${cat.vendorsReporting || 0} of ${cat.totalVendors} reporting`}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  overline: { ...type.overline, marginBottom: 3 },
  title: { ...type.display, fontSize: 28 },
  overallCard: {
    backgroundColor: colors.night,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  overallNumber: { fontSize: 52, fontWeight: '800', color: colors.white, letterSpacing: -1.5 },
  overallLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.68)',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: { ...type.heading, fontSize: 15, marginBottom: spacing.md },
  chartRow: { gap: spacing.sm, paddingBottom: spacing.sm },
  metaList: { marginTop: spacing.lg },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.xs + 2,
    ...shadow.sm,
  },
  metaLabel: { ...type.label, flex: 1, fontSize: 13 },
  metaValue: { ...type.meta, fontSize: 10.5 },
  errorText: { color: colors.closed, textAlign: 'center', fontWeight: '600', marginTop: 40 },
});
