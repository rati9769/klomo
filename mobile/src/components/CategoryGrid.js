import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import CategoryIcon from './CategoryIcon';
import { colors, radius, spacing, shadow, type } from '../constants/theme';

function Tile({ category, onSelect }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();

  return (
    <Animated.View style={[styles.tileWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => onSelect(category)}
        style={styles.tile}
      >
        <CategoryIcon category={category} size={46} />
        <Text style={styles.label} numberOfLines={2}>
          {category.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function CategoryGrid({ categories, onSelect }) {
  return (
    <View style={styles.grid}>
      {categories.map((cat) => (
        <Tile key={cat.slug} category={cat} onSelect={onSelect} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tileWrap: { width: '31%', marginBottom: spacing.sm + 4 },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    ...shadow.sm,
  },
  label: {
    ...type.label,
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 14,
  },
});
