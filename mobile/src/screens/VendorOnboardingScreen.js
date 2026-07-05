import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CategoryIcon from '../components/CategoryIcon';
import LocationPicker from '../components/LocationPicker';
import { colors, spacing, radius, shadow, type } from '../constants/theme';
import { FALLBACK_CATEGORIES } from '../constants/categories';
import { api } from '../services/api';
import { supabase } from '../services/supabase';

export default function VendorOnboardingScreen({ navigation }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [categorySlug, setCategorySlug] = useState(FALLBACK_CATEGORIES[0].slug);
  const [pin, setPin] = useState(null); // { lat, lng } from LocationPicker
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert('Shop name required');
      return;
    }
    if (!pin) {
      Alert.alert('Set the shop location', 'Drag the pin to where your shop actually is.');
      return;
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session || data.session.user.is_anonymous) {
      Alert.alert(
        'Please sign in first',
        'Listing a shop requires a verified phone/email so you can manage it later.',
        [{ text: 'Sign in', onPress: () => navigation.navigate('SignIn') }, { text: 'Cancel' }]
      );
      return;
    }

    setSubmitting(true);
    try {
      await api.registerVendor({
        categorySlug,
        name,
        address,
        phone,
        lat: pin.lat,
        lng: pin.lng,
      });
      Alert.alert('Listed!', 'Your shop is now discoverable on KLOMO.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Could not list shop', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={colors.ink} />
        </TouchableOpacity>

        <Text style={styles.overline}>FOR SHOP OWNERS</Text>
        <Text style={styles.title}>List your shop</Text>
        <Text style={styles.subtitle}>
          Pin your shop's real location on the map — you can register from anywhere, including
          home. Once listed, you'll update Open/Closed in one tap.
        </Text>

        <Text style={styles.label}>Category</Text>
        <View style={styles.categoryRow}>
          {FALLBACK_CATEGORIES.map((c) => {
            const active = categorySlug === c.slug;
            return (
              <TouchableOpacity
                key={c.slug}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setCategorySlug(c.slug)}
              >
                <CategoryIcon category={c} size={24} mode={active ? 'solid' : 'soft'} />
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Shop location</Text>
        <LocationPicker value={pin} onChange={setPin} />

        <Text style={styles.label}>Shop name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Sharma General Store"
          placeholderTextColor={colors.inkFaint}
        />

        <Text style={styles.label}>Address (optional)</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="Street, landmark"
          placeholderTextColor={colors.inkFaint}
        />

        <Text style={styles.label}>Phone (optional)</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="For customers to call"
          placeholderTextColor={colors.inkFaint}
        />

        <TouchableOpacity style={styles.button} disabled={submitting} onPress={submit}>
          <Text style={styles.buttonText}>{submitting ? 'Listing...' : 'List my shop'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.md, paddingBottom: spacing.xxl },
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
  overline: { ...type.overline, marginBottom: 4 },
  title: { ...type.display, fontSize: 28 },
  subtitle: { ...type.body, fontSize: 13, marginTop: spacing.sm, marginBottom: spacing.lg },
  label: { ...type.label, marginBottom: spacing.sm, marginTop: spacing.md + 4 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: spacing.sm + 4,
    paddingLeft: 5,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.sm,
  },
  categoryChipActive: { backgroundColor: colors.brandSoft },
  categoryChipText: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  categoryChipTextActive: { color: colors.brandDeep, fontWeight: '800' },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.ink,
    fontWeight: '600',
    ...shadow.sm,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    padding: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...shadow.md,
  },
  buttonText: { color: colors.white, fontWeight: '800', fontSize: 15.5 },
});
