import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// The single source of truth for rendering a category's icon anywhere in
// the app — a colored squircle with the category's vector glyph. Modes:
//   soft (default): pastel tint bg + dark ink glyph (grids, lists)
//   solid: saturated bg + light glyph (markers, emphasis)
export default function CategoryIcon({ category, size = 44, mode = 'soft' }) {
  const bg = mode === 'solid' ? category.solid : category.tint;
  const fg = mode === 'solid' ? category.onSolid : category.ink;

  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, borderRadius: size * 0.32, backgroundColor: bg },
      ]}
    >
      <MaterialCommunityIcons name={category.mci || 'storefront-outline'} size={size * 0.52} color={fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
