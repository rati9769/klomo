// KLOMO design system v3.
// Direction: warm illustrated hero + editorial typography + glassy dark map.
// Rules: no emoji as icons (use @expo/vector-icons), tokens only (no inline
// hex in screens), generous whitespace, heavy-but-consistent rounding.
export const colors = {
  ink: '#1C1A15',
  inkSoft: '#57534A',
  inkFaint: '#8F897B',

  paper: '#F4EFE6',
  surface: '#FFFFFF',
  surfaceSunk: '#EAE4D6',
  border: '#E3DCCB',

  brand: '#E8A13C',        // golden amber
  brandDeep: '#C77F1E',
  brandSoft: '#FBEED6',

  accent: '#D96C3F',       // terracotta
  accentSoft: '#F9E2D6',

  night: '#20241F',        // deep warm charcoal (Pulse card, map chrome)
  nightSoft: '#33382F',

  open: '#4F7A3A',
  openBg: '#E4EEDC',
  closed: '#B04435',
  closedBg: '#F6E2DE',
  uncertain: '#B08023',
  uncertainBg: '#F6ECD4',

  white: '#FFFFFF',

  // legacy aliases
  primary: '#E8A13C',
  primaryLight: '#FBEED6',
  textPrimary: '#1C1A15',
  textSecondary: '#57534A',
  textMuted: '#8F897B',
  bg: '#F4EFE6',
};

// Editorial type scale — sizes are intentional steps, not ad-hoc numbers.
export const type = {
  display: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, color: colors.ink },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, color: colors.ink },
  heading: { fontSize: 17, fontWeight: '800', color: colors.ink },
  body: { fontSize: 14.5, fontWeight: '500', color: colors.inkSoft, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 11.5, fontWeight: '600', color: colors.inkFaint },
  overline: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: colors.inkFaint,
    textTransform: 'uppercase',
  },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 44 };

export const radius = { sm: 14, md: 20, lg: 28, xl: 34, pill: 999 };

export const shadow = {
  sm: {
    shadowColor: '#1C1A15',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  md: {
    shadowColor: '#1C1A15',
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  lg: {
    shadowColor: '#1C1A15',
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
};

export const gradients = {
  hero: ['#F2B95C', '#E8A13C', '#D98A2B'],
  brand: ['#F2B95C', '#D98A2B'],
};
