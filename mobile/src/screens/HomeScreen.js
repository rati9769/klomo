import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import HeroCard from '../components/HeroCard';
import CategoryGrid from '../components/CategoryGrid';
import PulseTeaser from '../components/PulseTeaser';
import CategoryIcon from '../components/CategoryIcon';
import { FALLBACK_CATEGORIES, categoryStyle } from '../constants/categories';
import { colors, spacing, radius, shadow, type } from '../constants/theme';
import { api } from '../services/api';
import { getCurrentLocation, coarseGeohash } from '../services/location';

const TABS = { TRENDING: 'trending', RECENT: 'recent' };

function greetingForHour() {
  const h = new Date().getHours();
  if (h < 5) return 'Late night run?';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Late night run?';
}

export default function HomeScreen({ navigation }) {
  const [allCategories, setAllCategories] = useState(FALLBACK_CATEGORIES);
  const [tab, setTab] = useState(TABS.TRENDING);
  const [trending, setTrending] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [toggleWidth, setToggleWidth] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    api.categories().then((r) => {
      if (r.categories?.length) {
        setAllCategories(r.categories.map((c) => ({ ...categoryStyle(c.slug), ...c, ...categoryStyle(c.slug) })));
      }
    }).catch(() => {});
  }, []);

  const switchTab = (nextTab) => {
    setTab(nextTab);
    Animated.spring(slide, {
      toValue: nextTab === TABS.TRENDING ? 0 : 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start();
  };

  const loadFeed = useCallback(async () => {
    setLoadingFeed(true);
    try {
      if (tab === TABS.TRENDING) {
        let geohash;
        try {
          const loc = await getCurrentLocation();
          geohash = coarseGeohash(loc);
        } catch {}
        const r = await api.trending(geohash);
        setTrending(r.trending || []);
      } else {
        const r = await api.recent();
        setRecent(r.recent || []);
      }
    } catch (e) {
      console.warn('Feed load failed:', e.message);
    } finally {
      setLoadingFeed(false);
    }
  }, [tab]);

  // useFocusEffect (not plain useEffect) so this refetches both when the
  // toggle switches AND whenever you return to the Home tab after being
  // away — HomeTab stays mounted when you switch tabs, so a plain
  // mount-once effect would never see a report filed elsewhere.
  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [loadFeed])
  );

  const handleSelectCategory = async (category) => {
    navigation.navigate('CategoryResults', { category });
    try {
      let geohash;
      try {
        const loc = await getCurrentLocation();
        geohash = coarseGeohash(loc);
      } catch {}
      await api.logSearch(category.slug, geohash);
    } catch (e) {
      console.warn('logSearch failed:', e.message);
    }
  };

  const feedItems = tab === TABS.TRENDING ? trending : recent;
  const indicatorX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [4, toggleWidth / 2 + 4],
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.overline}>{greetingForHour().toUpperCase()}</Text>
            <Text style={styles.display}>Find what's{'\n'}open near you</Text>
          </View>
          <TouchableOpacity style={styles.avatarBtn} onPress={() => navigation.navigate('SignIn')}>
            <Ionicons name="person" size={19} color={colors.brandDeep} />
          </TouchableOpacity>
        </View>

        <HeroCard
          title="What do you need, right now?"
          subtitle="Tap a category — nearest open places in seconds."
        />

        <View style={styles.gridBlock}>
          <CategoryGrid categories={allCategories} onSelect={handleSelectCategory} />
        </View>

        <PulseTeaser onPress={() => navigation.navigate('Pulse')} />

        <View
          style={styles.toggleTrack}
          onLayout={(e) => setToggleWidth(e.nativeEvent.layout.width)}
        >
          {toggleWidth > 0 && (
            <Animated.View
              style={[
                styles.toggleThumb,
                { width: toggleWidth / 2 - 4, transform: [{ translateX: indicatorX }] },
              ]}
            />
          )}
          <TouchableOpacity style={styles.toggleTab} onPress={() => switchTab(TABS.TRENDING)}>
            <Text style={[styles.toggleText, tab === TABS.TRENDING && styles.toggleTextActive]}>
              Most sought after
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toggleTab} onPress={() => switchTab(TABS.RECENT)}>
            <Text style={[styles.toggleText, tab === TABS.RECENT && styles.toggleTextActive]}>
              You looked for
            </Text>
          </TouchableOpacity>
        </View>

        {loadingFeed ? (
          <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.brand} />
        ) : feedItems.length === 0 ? (
          <Text style={styles.emptyText}>
            {tab === TABS.TRENDING
              ? 'Not enough activity near you yet — be the first to tap a category.'
              : "You haven't looked for anything yet. Tap a category above."}
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.feedRow}
          >
            {feedItems.map((item, i) => {
              const style = categoryStyle(item.slug);
              const merged = { ...style, ...item, ...style };
              return (
                <TouchableOpacity
                  key={`${item.slug}-${i}`}
                  style={styles.feedCard}
                  activeOpacity={0.88}
                  onPress={() => handleSelectCategory(merged)}
                >
                  <CategoryIcon category={merged} size={40} />
                  <Text style={styles.feedLabel} numberOfLines={2}>
                    {item.label}
                  </Text>
                  {tab === TABS.TRENDING && item.taps != null && (
                    <Text style={styles.feedMeta}>{item.taps} taps nearby</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  overline: { ...type.overline, marginBottom: 6 },
  display: { ...type.display, lineHeight: 37 },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  gridBlock: { marginTop: spacing.lg },
  toggleTrack: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSunk,
    borderRadius: radius.pill,
    padding: 4,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    position: 'relative',
  },
  toggleThumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    ...shadow.sm,
  },
  toggleTab: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center' },
  toggleText: { fontSize: 12.5, color: colors.inkFaint, fontWeight: '700' },
  toggleTextActive: { color: colors.ink },
  feedRow: { gap: spacing.sm, paddingBottom: spacing.sm },
  feedCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.sm,
  },
  feedLabel: { ...type.label, fontSize: 13.5, lineHeight: 17 },
  feedMeta: { ...type.meta, fontSize: 10.5 },
  emptyText: { ...type.body, fontSize: 13, marginTop: spacing.sm },
});
