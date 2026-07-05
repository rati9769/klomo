import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import VendorCard from '../components/VendorCard';
import CategoryIcon from '../components/CategoryIcon';
import AvailabilityGraph from '../components/AvailabilityGraph';
import { colors, spacing, radius, shadow, type } from '../constants/theme';
import { categoryStyle } from '../constants/categories';
import { api } from '../services/api';
import { getCurrentLocation } from '../services/location';

export default function CategoryResultsScreen({ route, navigation }) {
  const rawCategory = route.params.category;
  const category = { ...categoryStyle(rawCategory.slug), ...rawCategory, ...categoryStyle(rawCategory.slug) };
  const { width } = useWindowDimensions();
  const [state, setState] = useState({ loading: true, error: null, vendors: [] });
  const [graph, setGraph] = useState({ loading: true, data: null });
  const hasLoadedOnce = useRef(false);

  // Refetches every time this screen regains focus — not just on first
  // mount. Without this, going into a vendor, filing a report, and coming
  // back would show the stale confidence/status until the whole screen was
  // unmounted and remounted (e.g. going back further and re-entering).
  // First load shows the spinner; return visits update in place, silently.
  const loadData = useCallback(async () => {
    const silent = hasLoadedOnce.current;
    if (!silent) {
      setState((s) => ({ ...s, loading: true, error: null }));
      setGraph({ loading: true, data: null });
    }
    try {
      const loc = await getCurrentLocation();
      const [nearbyRes, graphRes] = await Promise.allSettled([
        api.nearby({ category: category.slug, lat: loc.lat, lng: loc.lng, radius: 3000 }),
        api.availabilityGraph({ category: category.slug, lat: loc.lat, lng: loc.lng, radius: 3000, hours: 24 }),
      ]);

      if (nearbyRes.status === 'fulfilled') {
        setState({ loading: false, error: null, vendors: nearbyRes.value.vendors });
      } else {
        setState({ loading: false, error: nearbyRes.reason.message, vendors: [] });
      }
      setGraph({ loading: false, data: graphRes.status === 'fulfilled' ? graphRes.value : null });
    } catch (e) {
      setState({ loading: false, error: e.message, vendors: [] });
      setGraph({ loading: false, data: null });
    } finally {
      hasLoadedOnce.current = true;
    }
  }, [category.slug]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const Header = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="chevron-back" size={20} color={colors.ink} />
      </TouchableOpacity>
      <CategoryIcon category={category} size={42} />
      <View>
        <Text style={styles.title}>{category.label}</Text>
        <Text style={styles.subtitle}>
          {state.loading ? 'Finding nearby...' : `${state.vendors.length} found nearby`}
        </Text>
      </View>
    </View>
  );

  const GraphCard = () => {
    if (graph.loading) {
      return (
        <View style={[styles.graphCard, styles.graphLoading]}>
          <ActivityIndicator color={colors.brand} />
        </View>
      );
    }
    if (!graph.data || graph.data.totalVendors === 0) return null;

    const current = graph.data.current;
    const pct = current?.openPercentage;

    return (
      <View style={styles.graphCard}>
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <Text style={styles.liveTagText}>LIVE, LAST 24H</Text>
        </View>
        <Text style={styles.graphBigNumber}>
          {pct != null ? `${pct}%` : '—'}
          <Text style={styles.graphBigNumberSuffix}>  open now</Text>
        </Text>
        <AvailabilityGraph
          series={graph.data.series}
          color={category.solid || colors.brand}
          width={width - spacing.md * 2 - spacing.md * 2}
        />
        <Text style={styles.graphFootnote}>
          Based on {graph.data.totalVendors} vendor{graph.data.totalVendors === 1 ? '' : 's'} nearby
        </Text>
      </View>
    );
  };

  if (state.loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header />
        <ActivityIndicator style={{ marginTop: 60 }} color={colors.brand} />
      </SafeAreaView>
    );
  }

  if (state.error) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header />
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{state.error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Header />
      <FlatList
        data={state.vendors}
        keyExtractor={(v) => v.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<GraphCard />}
        ListEmptyComponent={
          <View style={styles.centerBox}>
            <Text style={styles.emptyText}>
              No {category.label.toLowerCase()} found nearby yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <VendorCard
            vendor={item}
            onPress={() => navigation.navigate('VendorDetail', { vendor: item, category })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  title: { ...type.title, fontSize: 19 },
  subtitle: { ...type.meta, marginTop: 1 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  graphCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  graphLoading: { minHeight: 140, alignItems: 'center', justifyContent: 'center' },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.open },
  liveTagText: { ...type.overline, fontSize: 9.5 },
  graphBigNumber: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.5, marginBottom: spacing.sm },
  graphBigNumberSuffix: { fontSize: 13.5, fontWeight: '600', color: colors.inkFaint, letterSpacing: 0 },
  graphFootnote: { ...type.meta, fontSize: 10.5, marginTop: spacing.sm },
  centerBox: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  errorText: { color: colors.closed, textAlign: 'center', fontWeight: '600' },
  emptyText: { ...type.body, textAlign: 'center' },
});
