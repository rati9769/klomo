import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, shadow } from '../constants/theme';
import { useVerificationBadge } from '../context/VerificationContext';

const TAB_META = {
  HomeTab: { icon: 'home-outline', iconActive: 'home', label: 'Home' },
  Pulse: { icon: 'pulse-outline', iconActive: 'pulse', label: 'Pulse' },
  Account: { icon: 'person-outline', iconActive: 'person', label: 'Account' },
};

// Three clean tabs, no floating "+" — vendor onboarding is deliberately
// NOT surfaced to general users here; its entry point lives quietly inside
// the Account tab (see AGENTS.md product rules).
export default function AppTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { pendingCount } = useVerificationBadge();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;
        const isFocused = state.index === index;
        const showBadge = route.name === 'Account' && pendingCount > 0;

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate(route.name)}
          >
            <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
              <Ionicons
                name={isFocused ? meta.iconActive : meta.icon}
                size={20}
                color={isFocused ? colors.ink : colors.inkFaint}
              />
              {showBadge && (
                <View style={styles.badgeDot}>
                  <Text style={styles.badgeDotText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{meta.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...shadow.lg,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 2, gap: 2 },
  iconWrap: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  iconWrapActive: { backgroundColor: colors.brandSoft },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 6,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.closed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeDotText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  tabLabel: { fontSize: 10.5, fontWeight: '700', color: colors.inkFaint },
  tabLabelActive: { color: colors.ink, fontWeight: '800' },
});
