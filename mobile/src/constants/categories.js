// Mirrors backend/supabase/schema.sql seed data (instant-render fallback).
// `mci` is a MaterialCommunityIcons name from @expo/vector-icons — bundled
// with Expo, no extra dependency. Never render emoji as icons; if a
// category arrives from the API without a known slug, categoryStyle()
// provides a neutral fallback including a generic icon.
export const FALLBACK_CATEGORIES = [
  { slug: 'cigarette', label: 'Cigarette', mci: 'smoking', tint: '#F4DFC7', ink: '#7A4A22', solid: '#C1702E', onSolid: '#FFF6EC' },
  { slug: 'chemist', label: 'Chemist', mci: 'pill', tint: '#DEE8CC', ink: '#3F5A22', solid: '#7C8A4A', onSolid: '#F3F7EA' },
  { slug: 'water', label: 'Water', mci: 'water', tint: '#D6E5E8', ink: '#2E5560', solid: '#4E7C87', onSolid: '#EAF4F5' },
  { slug: 'petrol', label: 'Petrol', mci: 'gas-station', tint: '#ECD3CE', ink: '#7A2E29', solid: '#A3453A', onSolid: '#FBEDEA' },
  { slug: 'chai', label: 'Chai', mci: 'tea', tint: '#EBD6B8', ink: '#6B4A1E', solid: '#A9782E', onSolid: '#FBF3E4' },
  { slug: 'atm', label: 'ATM', mci: 'credit-card-outline', tint: '#DED7EA', ink: '#4A3A6B', solid: '#7A6AA3', onSolid: '#F4F1FA' },
  { slug: 'grocery', label: 'Grocery', mci: 'cart', tint: '#D9E6C3', ink: '#3E5622', solid: '#6E8A3E', onSolid: '#F1F6E9' },
  { slug: 'medical_emergency', label: 'Emergency', mci: 'medical-bag', tint: '#ECD6D9', ink: '#7A2E3D', solid: '#A64B5C', onSolid: '#FBECEF' },
  { slug: 'mechanic', label: 'Mechanic', mci: 'wrench', tint: '#DCD7CF', ink: '#4A4238', solid: '#7D7263', onSolid: '#F5F3EF' },
  { slug: 'food', label: 'Late Night Food', mci: 'noodles', tint: '#F1DCC0', ink: '#7A4A1E', solid: '#C08A3E', onSolid: '#FBF2E2' },
];

export function categoryStyle(slug) {
  const match = FALLBACK_CATEGORIES.find((c) => c.slug === slug);
  return (
    match || {
      mci: 'storefront-outline',
      tint: '#EAE4D6',
      ink: '#57534A',
      solid: '#8C8474',
      onSolid: '#F5F3EF',
    }
  );
}
