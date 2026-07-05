import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Path, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, radius, spacing } from '../constants/theme';

const CHART_HEIGHT = 90;

function buildPaths(values, width, height) {
  if (values.length < 2) return { line: '', area: '' };

  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - (v / 100) * height;
    return [x, y];
  });

  let line = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const midX = (x0 + x1) / 2;
    line += ` C ${midX},${y0} ${midX},${y1} ${x1},${y1}`;
  }

  const area = `${line} L ${points[points.length - 1][0]},${height} L 0,${height} Z`;
  return { line, area, lastPoint: points[points.length - 1] };
}

function LivePulse({ x, y, color }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={[styles.pulseWrap, { left: x - 16, top: y - 16 }]} pointerEvents="none">
      <Animated.View
        style={[styles.pulseRing, { backgroundColor: color, opacity, transform: [{ scale }] }]}
      />
      <View style={[styles.pulseDot, { backgroundColor: color }]} />
    </View>
  );
}

export default function AvailabilityGraph({ series, color = colors.brand, width = 300 }) {
  const values = useMemo(
    () => series.map((p) => (p.openPercentage != null ? p.openPercentage : p.avgConfidence)),
    [series]
  );

  const { line, area, lastPoint } = useMemo(
    () => buildPaths(values, width, CHART_HEIGHT),
    [values, width]
  );

  if (values.length < 2) {
    return (
      <View style={[styles.empty, { width }]}>
        <Text style={styles.emptyText}>Not enough data yet to chart a trend</Text>
      </View>
    );
  }

  const gradientId = `grad-${color.replace('#', '')}`;

  return (
    <View style={{ width, height: CHART_HEIGHT }}>
      <Svg width={width} height={CHART_HEIGHT}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        <Line x1="0" y1={CHART_HEIGHT / 2} x2={width} y2={CHART_HEIGHT / 2} stroke={colors.border} strokeWidth={1} strokeDasharray="4,4" />
        <Path d={area} fill={`url(#${gradientId})`} />
        <Path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      {lastPoint && <LivePulse x={lastPoint[0]} y={lastPoint[1]} color={color} />}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 12, color: colors.inkFaint, fontWeight: '500' },
  pulseWrap: {
    position: 'absolute',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  pulseDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
