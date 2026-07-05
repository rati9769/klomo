import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { colors, radius, spacing, shadow, type, gradients } from '../constants/theme';

// The illustrated hero — an abstract warm night-market scene (glowing lamp
// sun, layered hills, tiny shopfront glow) drawn in SVG so it scales crisp
// on every device. This is the emotional anchor of the home screen, in the
// spirit of the reference's "Let's start your day" illustration card.
function Scene() {
  return (
    <Svg width="100%" height="120" viewBox="0 0 340 120" preserveAspectRatio="xMidYMax slice">
      {/* glow halo */}
      <Circle cx="262" cy="38" r="34" fill="#FFFFFF" opacity="0.18" />
      <Circle cx="262" cy="38" r="22" fill="#FFF3DC" opacity="0.9" />
      <Circle cx="262" cy="38" r="14" fill="#FFFFFF" />
      {/* far hill */}
      <Path d="M0 92 Q 70 58 150 84 T 340 78 L 340 120 L 0 120 Z" fill="#B36F1D" opacity="0.55" />
      {/* near hill */}
      <Path d="M0 104 Q 90 76 190 98 T 340 96 L 340 120 L 0 120 Z" fill="#8A5414" opacity="0.75" />
      {/* tiny shopfront */}
      <G opacity="0.95">
        <Path d="M52 96 h34 v16 h-34 Z" fill="#5C370C" />
        <Path d="M48 96 h42 l-5 -10 h-32 Z" fill="#F4D9A8" />
        <Path d="M64 102 h10 v10 h-10 Z" fill="#FFE9BF" />
      </G>
    </Svg>
  );
}

export default function HeroCard({ title, subtitle }) {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.card}
      >
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <Scene />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.xl, ...shadow.md },
  card: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    paddingTop: spacing.lg,
  },
  textBlock: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  title: {
    ...type.title,
    fontSize: 24,
    color: '#3D2405',
    lineHeight: 30,
  },
  subtitle: {
    ...type.body,
    color: '#5C370C',
    marginTop: 6,
  },
});
