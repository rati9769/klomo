import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, radius, shadow, type } from '../constants/theme';
import { supabase, ensureSession } from '../services/supabase';
import { api } from '../services/api';
import { getCurrentLocation } from '../services/location';
import { registerForPushNotifications } from '../services/notifications';
import { useVerificationBadge } from '../context/VerificationContext';
import VerificationCard from '../components/VerificationCard';

const CLAIM_LABEL = {
  claimed: { text: 'Claimed & verified', color: colors.open },
  unclaimed: { text: 'Unclaimed', color: colors.uncertain },
  pending_agent_visit: { text: 'Pending agent visit', color: colors.uncertain },
};

export default function AccountScreen({ navigation }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myVendors, setMyVendors] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [respondingId, setRespondingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { setPendingCount } = useVerificationBadge();

  const load = useCallback(async (opts = {}) => {
    if (!opts.silent) setLoading(true);
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
    if (data.session && !data.session.user.is_anonymous) {
      try {
        const [vendorsRes, verificationsRes] = await Promise.allSettled([
          api.myVendors(),
          api.pendingVerifications(),
        ]);
        setMyVendors(vendorsRes.status === 'fulfilled' ? vendorsRes.value.vendors || [] : []);
        const requests = verificationsRes.status === 'fulfilled' ? verificationsRes.value.requests || [] : [];
        setVerifications(requests);
        setPendingCount(requests.length);
        // Defensive re-registration — cheap and idempotent, catches cases
        // like a reinstalled app or a token that changed since last time.
        registerForPushNotifications().catch(() => {});
      } catch {
        setMyVendors([]);
        setVerifications([]);
        setPendingCount(0);
      }
    } else {
      setMyVendors([]);
      setVerifications([]);
      setPendingCount(0);
    }
    setLoading(false);
  }, [setPendingCount]);

  // Initial load + whenever auth state changes (sign in/out).
  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub.subscription.unsubscribe();
  }, [load]);

  // React Navigation keeps tab screens mounted when you switch away — a
  // plain useEffect-on-mount only fires once and would never pick up a
  // verification request created while you were on another tab. Refetch
  // (quietly, no full-screen spinner) every time this tab regains focus.
  useFocusEffect(
    useCallback(() => {
      load({ silent: true });
    }, [load])
  );

  const onPullRefresh = async () => {
    setRefreshing(true);
    await load({ silent: true });
    setRefreshing(false);
  };

  const respond = async (request, status) => {
    setRespondingId(request.id);
    try {
      // Capture the owner's location at response time (foreground, with
      // permission) — the backend checks proximity to the shop and weights
      // the report accordingly. See docs/VERIFICATION_FLOW.md.
      let coords = {};
      try {
        const loc = await getCurrentLocation();
        coords = { lat: loc.lat, lng: loc.lng };
      } catch {}
      const result = await api.respondToVerification(request.id, { status, ...coords });
      Alert.alert(
        'Thanks!',
        result.wasPresent
          ? 'Confirmed from your shop — this carries the strongest weight in the score.'
          : 'Recorded. Responding while at the shop makes your confirmation count for more.'
      );
      load();
    } catch (e) {
      Alert.alert('Could not submit', e.message);
    } finally {
      setRespondingId(null);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You can keep using KLOMO anonymously afterwards.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          await ensureSession().catch(() => {});
          load();
        },
      },
    ]);
  };

  const isSignedIn = session && !session.user.is_anonymous;
  const identity = session?.user?.email || session?.user?.phone;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={colors.brand} />
        }
      >
        <Text style={styles.overline}>YOUR SPACE</Text>
        <Text style={styles.title}>Account</Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />
        ) : isSignedIn ? (
          <>
            <View style={styles.identityCard}>
              <View style={styles.avatarLg}>
                <Text style={styles.avatarLgText}>{identity?.[0]?.toUpperCase() || 'K'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.identityLabel}>Signed in as</Text>
                <Text style={styles.identityValue} numberOfLines={1}>{identity}</Text>
              </View>
            </View>

            {verifications.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Verify your shop's status</Text>
                {verifications.map((v) => (
                  <VerificationCard
                    key={v.id}
                    request={v}
                    onRespond={respond}
                    responding={respondingId === v.id}
                  />
                ))}
              </>
            )}

            <Text style={styles.sectionTitle}>My shops</Text>
            {myVendors.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>You haven't listed a shop yet.</Text>
              </View>
            ) : (
              myVendors.map((v) => {
                const claim = CLAIM_LABEL[v.claim_status] || CLAIM_LABEL.unclaimed;
                return (
                  <View key={v.id} style={styles.vendorCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vendorName}>{v.name}</Text>
                      {v.address ? <Text style={styles.vendorAddress}>{v.address}</Text> : null}
                    </View>
                    <View style={[styles.claimBadge, { backgroundColor: claim.color + '22' }]}>
                      <Text style={[styles.claimBadgeText, { color: claim.color }]}>{claim.text}</Text>
                    </View>
                  </View>
                );
              })
            )}

            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.signInCard}>
            <View style={styles.signInIconWrap}>
              <Ionicons name="person-outline" size={26} color={colors.brandDeep} />
            </View>
            <Text style={styles.signInTitle}>You're browsing anonymously</Text>
            <Text style={styles.signInSubtitle}>
              That's completely fine — search, browsing, and reporting all work without an
              account. Sign in only if you want to keep your history across devices.
            </Text>
            <TouchableOpacity style={styles.signInBtn} onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.signInBtnText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quiet vendor entry — deliberately down here, not on Home, so
            general users aren't pushed toward it (product decision). */}
        <TouchableOpacity
          style={styles.vendorEntry}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('VendorOnboarding')}
        >
          <MaterialCommunityIcons name="storefront-outline" size={15} color={colors.inkFaint} />
          <Text style={styles.vendorEntryText}>Own a shop? List it on KLOMO</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.inkFaint} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  overline: { ...type.overline, marginTop: spacing.xs, marginBottom: 4 },
  title: { ...type.display, fontSize: 28, marginBottom: spacing.lg },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  avatarLg: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarLgText: { color: colors.white, fontSize: 19, fontWeight: '800' },
  identityLabel: { ...type.meta },
  identityValue: { ...type.heading, fontSize: 15, marginTop: 1 },
  sectionTitle: { ...type.heading, fontSize: 15, marginBottom: spacing.sm, marginTop: spacing.sm },
  verifyCard: {
    backgroundColor: colors.brandSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm + 4,
  },
  verifyHeader: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  verifyText: { ...type.body, fontSize: 13, flex: 1, color: colors.ink },
  verifyBold: { fontWeight: '800' },
  verifyBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  verifyBtn: { flex: 1, paddingVertical: spacing.sm + 4, borderRadius: radius.pill, alignItems: 'center' },
  verifyOpen: { backgroundColor: colors.open },
  verifyClosed: { backgroundColor: colors.surface },
  verifyOpenText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  verifyClosedText: { color: colors.closed, fontWeight: '800', fontSize: 13 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  emptyText: { ...type.body, fontSize: 13 },
  vendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  vendorName: { ...type.label, fontSize: 14 },
  vendorAddress: { ...type.meta, marginTop: 2 },
  claimBadge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  claimBadgeText: { fontSize: 10.5, fontWeight: '800' },
  signOutBtn: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.sm },
  signOutText: { color: colors.closed, fontWeight: '700', fontSize: 13.5 },
  signInCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadow.sm,
  },
  signInIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  signInTitle: { ...type.heading, textAlign: 'center' },
  signInSubtitle: { ...type.body, fontSize: 12.5, textAlign: 'center', marginTop: spacing.sm },
  signInBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 4,
    marginTop: spacing.lg,
  },
  signInBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  vendorEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
  },
  vendorEntryText: { ...type.meta, fontSize: 12 },
});
