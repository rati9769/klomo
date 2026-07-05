import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, gradients } from '../constants/theme';
import { ensureSession } from '../services/supabase';

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    (async () => {
      try {
        await ensureSession();
      } catch (e) {
        console.warn('Session bootstrap failed:', e.message);
      }
      const timer = setTimeout(() => navigation.replace('Main'), 900);
      return () => clearTimeout(timer);
    })();
  }, []);

  return (
    <LinearGradient
      colors={gradients.hero}
      style={styles.container}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.mark}>
        <MaterialCommunityIcons name="storefront-outline" size={30} color="#3D2405" />
      </View>
      <Text style={styles.logo}>KLOMO</Text>
      <Text style={styles.tagline}>Nearest. Open. Now.</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mark: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  logo: { fontSize: 34, fontWeight: '800', color: '#3D2405', letterSpacing: 4 },
  tagline: { fontSize: 13.5, color: 'rgba(61,36,5,0.65)', marginTop: 6, fontWeight: '700' },
});
