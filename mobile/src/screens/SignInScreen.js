import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadow, type } from '../constants/theme';
import { supabase } from '../services/supabase';
import { registerForPushNotifications } from '../services/notifications';

// Passwordless by design: one-time code via Supabase Auth — we never touch,
// see, or store a password. The anonymous session created at first launch
// upgrades in place; nothing done anonymously is lost.
export default function SignInScreen({ navigation }) {
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState('enter_contact');
  const [loading, setLoading] = useState(false);

  const isEmail = contact.includes('@');

  const sendCode = async () => {
    setLoading(true);
    try {
      const { error } = isEmail
        ? await supabase.auth.signInWithOtp({ email: contact })
        : await supabase.auth.signInWithOtp({ phone: contact });
      if (error) throw error;
      setStage('enter_otp');
    } catch (e) {
      Alert.alert('Could not send code', e.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp(
        isEmail
          ? { email: contact, token: otp, type: 'email' }
          : { phone: contact, token: otp, type: 'sms' }
      );
      if (error) throw error;
      // Best-effort — a person who declines the permission prompt can
      // still use every other feature of the app normally.
      registerForPushNotifications().catch(() => {});
      navigation.goBack();
    } catch (e) {
      Alert.alert('Invalid code', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name="key-outline" size={24} color={colors.brandDeep} />
        </View>
        <Text style={styles.overline}>OPTIONAL</Text>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>
          Keeps your history if you switch phones. No password — we send a one-time code, and
          nothing you did anonymously is lost.
        </Text>

        {stage === 'enter_contact' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email or phone number"
              placeholderTextColor={colors.inkFaint}
              value={contact}
              onChangeText={setContact}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
            />
            <TouchableOpacity style={styles.button} disabled={loading || !contact} onPress={sendCode}>
              <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send code'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              placeholderTextColor={colors.inkFaint}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={styles.button} disabled={loading || !otp} onPress={verifyCode}>
              <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify & sign in'}</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.skip}>
          <Text style={styles.skipText}>Continue without signing in</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, flex: 1, justifyContent: 'center' },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  overline: { ...type.overline, marginBottom: 4 },
  title: { ...type.display, fontSize: 28 },
  subtitle: { ...type.body, fontSize: 13, marginTop: spacing.sm, marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    marginBottom: spacing.md,
    color: colors.ink,
    fontWeight: '600',
    ...shadow.sm,
  },
  button: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    padding: spacing.md + 2,
    alignItems: 'center',
    ...shadow.md,
  },
  buttonText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  skip: { marginTop: spacing.lg, alignItems: 'center' },
  skipText: { ...type.meta, fontSize: 12.5 },
});
