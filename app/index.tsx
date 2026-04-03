import * as React from 'react';
import { View, Platform, Animated, Dimensions, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth';
import { Text, Button } from '../components';
import { colors, spacing } from '../constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const W = SCREEN_W || 1200;
const H = SCREEN_H || 900;

// ─── DARK MODE ELEMENTS ──────────────────────────────────────

function Star({ delay, duration, size, x, y, color }: {
  delay: number; duration: number; size: number; x: number; y: number; color: string;
}) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(opacity, { toValue: 1, duration: duration * 0.4, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.1, duration: duration * 0.6, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: x, top: y, width: size, height: size,
      borderRadius: size / 2, backgroundColor: color, opacity,
    }} />
  );
}

function Starfield() {
  const stars = React.useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    id: i, x: Math.random() * W, y: Math.random() * H,
    size: Math.random() * 2 + 0.5, delay: Math.random() * 4000,
    duration: 3000 + Math.random() * 5000,
    color: Math.random() > 0.5 ? 'rgba(212,168,68,0.6)' : 'rgba(255,255,255,0.4)',
  })), []);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {stars.map((s) => <Star key={s.id} {...s} />)}
    </View>
  );
}

function ShootingStar({ delay, duration, startX, startY, angle }: {
  delay: number; duration: number; startX: number; startY: number; angle: number;
}) {
  const progress = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const endX = startX + Math.cos(angle) * 300;
  const endY = startY + Math.sin(angle) * 300;
  React.useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(progress, { toValue: 1, duration, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: duration * 0.2, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: duration * 0.8, useNativeDriver: true }),
        ]),
      ]),
      Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [startY, endY] });
  return (
    <Animated.View style={{
      position: 'absolute', left: 0, top: 0, opacity,
      transform: [{ translateX }, { translateY }, { rotate: `${angle}rad` }],
    }}>
      <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.9)' }} />
      <View style={{
        position: 'absolute', right: 3, top: 0.5, width: 40, height: 2, borderRadius: 1,
        ...(Platform.OS === 'web' ? { background: 'linear-gradient(to left, rgba(255,255,255,0.3), transparent)' } as any : { backgroundColor: 'rgba(255,255,255,0.15)' }),
      }} />
    </Animated.View>
  );
}

function ShootingStarField() {
  const shooters = React.useMemo(() => [
    { id: 0, delay: 12000, duration: 1800, startX: W * 0.7, startY: H * 0.1, angle: 2.5 },
    { id: 1, delay: 35000, duration: 1400, startX: W * 0.3, startY: H * 0.15, angle: 2.3 },
    { id: 2, delay: 60000, duration: 2000, startX: W * 0.85, startY: H * 0.3, angle: 2.8 },
  ], []);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {shooters.map((s) => <ShootingStar key={s.id} {...s} />)}
    </View>
  );
}

function Ufo({ delay, duration, startX, startY, endX, endY }: {
  delay: number; duration: number; startX: number; startY: number; endX: number; endY: number;
}) {
  const progress = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0.7, duration: 600, useNativeDriver: true }),
        Animated.timing(progress, { toValue: 1, duration, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [startY, endY] });
  return (
    <Animated.View style={{ position: 'absolute', left: 0, top: 0, opacity, transform: [{ translateX }, { translateY }] }}>
      <View style={{
        width: 12, height: 4, borderRadius: 6, backgroundColor: 'rgba(212,168,68,0.5)',
        ...(Platform.OS === 'web' ? { boxShadow: '0 0 8px rgba(212,168,68,0.3)' } as any : {}),
      }} />
      <View style={{
        position: 'absolute', top: -2, left: 4, width: 4, height: 3,
        borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)',
      }} />
    </Animated.View>
  );
}

function UfoField() {
  const ufos = React.useMemo(() => [
    { id: 0, delay: 8000, duration: 14000, startX: -20, startY: H * 0.3, endX: W + 20, endY: H * 0.25 },
    { id: 1, delay: 45000, duration: 12000, startX: W + 20, startY: H * 0.7, endX: -20, endY: H * 0.6 },
  ], []);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {ufos.map((u) => <Ufo key={u.id} {...u} />)}
    </View>
  );
}

function DarkGlow() {
  const scale = React.useRef(new Animated.Value(1)).current;
  const opacity = React.useRef(new Animated.Value(0.03)).current;
  React.useEffect(() => {
    const anim = Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.3, duration: 4000, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 4000, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.06, duration: 4000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.03, duration: 4000, useNativeDriver: true }),
      ]),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', width: 500, height: 500, borderRadius: 250,
      backgroundColor: colors.accent, opacity, transform: [{ scale }],
      ...(Platform.OS === 'web' ? { filter: 'blur(120px)' } as any : {}),
    }} />
  );
}

// ─── LIGHT MODE ELEMENTS ─────────────────────────────────────

function Cloud({ x, y, width, speed, opacity: baseOpacity }: {
  x: number; y: number; width: number; speed: number; opacity: number;
}) {
  const translateX = React.useRef(new Animated.Value(x)).current;
  React.useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(translateX, { toValue: W + width, duration: speed, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: -width, duration: 0, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  const h = width * 0.35;
  return (
    <Animated.View style={{
      position: 'absolute', top: y, opacity: baseOpacity,
      transform: [{ translateX }],
    }}>
      {/* Cloud made of overlapping rounded rectangles */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <View style={{
          width: width * 0.4, height: h * 0.7, borderRadius: h * 0.35,
          backgroundColor: 'rgba(255,255,255,0.9)', marginRight: -width * 0.08,
        }} />
        <View style={{
          width: width * 0.5, height: h, borderRadius: h * 0.5,
          backgroundColor: 'rgba(255,255,255,0.95)', marginRight: -width * 0.08,
          marginBottom: h * 0.1,
        }} />
        <View style={{
          width: width * 0.45, height: h * 0.65, borderRadius: h * 0.33,
          backgroundColor: 'rgba(255,255,255,0.85)',
        }} />
      </View>
    </Animated.View>
  );
}

function CloudField() {
  const clouds = React.useMemo(() => [
    { id: 0, x: W * 0.1, y: H * 0.12, width: 160, speed: 60000, opacity: 0.7 },
    { id: 1, x: W * 0.5, y: H * 0.25, width: 120, speed: 80000, opacity: 0.5 },
    { id: 2, x: W * 0.8, y: H * 0.08, width: 200, speed: 50000, opacity: 0.6 },
    { id: 3, x: W * 0.3, y: H * 0.35, width: 100, speed: 90000, opacity: 0.4 },
    { id: 4, x: -100, y: H * 0.18, width: 140, speed: 70000, opacity: 0.55 },
    { id: 5, x: W * 0.6, y: H * 0.42, width: 90, speed: 100000, opacity: 0.35 },
  ], []);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {clouds.map((c) => <Cloud key={c.id} {...c} />)}
    </View>
  );
}

function Airplane({ delay, duration, startX, startY, endX, endY, flip }: {
  delay: number; duration: number; startX: number; startY: number;
  endX: number; endY: number; flip?: boolean;
}) {
  const progress = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(progress, { toValue: 1, duration, useNativeDriver: true }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [startY, endY] });
  return (
    <Animated.View style={{
      position: 'absolute', left: 0, top: 0, opacity,
      transform: [{ translateX }, { translateY }, { scaleX: flip ? -1 : 1 }],
    }}>
      {/* Fuselage */}
      <View style={{
        width: 16, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.7)',
      }} />
      {/* Wings */}
      <View style={{
        position: 'absolute', top: -3, left: 5, width: 6, height: 9, borderRadius: 1,
        backgroundColor: 'rgba(255,255,255,0.5)',
      }} />
      {/* Contrail */}
      <View style={{
        position: 'absolute', left: -30, top: 0.5, width: 30, height: 2, borderRadius: 1,
        ...(Platform.OS === 'web' ? {
          background: 'linear-gradient(to left, rgba(255,255,255,0.4), transparent)',
        } as any : { backgroundColor: 'rgba(255,255,255,0.15)' }),
      }} />
    </Animated.View>
  );
}

function AirplaneField() {
  const planes = React.useMemo(() => [
    { id: 0, delay: 4000, duration: 12000, startX: -30, startY: H * 0.2, endX: W + 30, endY: H * 0.15 },
    { id: 1, delay: 18000, duration: 15000, startX: W + 30, startY: H * 0.35, endX: -30, endY: H * 0.3, flip: true },
  ], []);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {planes.map((p) => <Airplane key={p.id} {...p} />)}
    </View>
  );
}

function SunGlow() {
  const scale = React.useRef(new Animated.Value(1)).current;
  const opacity = React.useRef(new Animated.Value(0.15)).current;
  React.useEffect(() => {
    const anim = Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.2, duration: 5000, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 5000, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 5000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.15, duration: 5000, useNativeDriver: true }),
      ]),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', top: -200, right: -100,
      width: 500, height: 500, borderRadius: 250,
      backgroundColor: '#ffe082', opacity, transform: [{ scale }],
      ...(Platform.OS === 'web' ? { filter: 'blur(100px)' } as any : {}),
    }} />
  );
}

// ─── LIGHT THEME COLORS ──────────────────────────────────────

const lightColors = {
  bg: '#5ba3e6',
  text: '#1a1a2e',
  textSoft: 'rgba(26,26,46,0.6)',
  accent: '#1a1a2e',
  buttonBg: '#1a1a2e',
  buttonText: '#ffffff',
  ghostText: 'rgba(26,26,46,0.7)',
};

// ─── MAIN SCREEN ─────────────────────────────────────────────

export default function LandingScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [isDark, setIsDark] = React.useState(true);
  const bgAnim = React.useRef(new Animated.Value(1)).current;
  const darkOpacity = React.useRef(new Animated.Value(1)).current;
  const lightOpacity = React.useRef(new Animated.Value(0)).current;

  if (isAuthenticated && !isLoading) {
    router.replace('/(tabs)');
    return null;
  }

  const toggleTheme = () => {
    const toDark = !isDark;
    setIsDark(toDark);
    Animated.parallel([
      Animated.timing(darkOpacity, { toValue: toDark ? 1 : 0, duration: 800, useNativeDriver: true }),
      Animated.timing(lightOpacity, { toValue: toDark ? 0 : 1, duration: 800, useNativeDriver: true }),
    ]).start();
  };

  const c = isDark ? {
    bg: colors.bg,
    wordmark: colors.accent,
    tagline: colors.text,
    taglineOpacity: 0.5,
    buttonBg: colors.accent,
    buttonText: colors.textInverse,
    ghostText: colors.text,
  } : {
    bg: lightColors.bg,
    wordmark: lightColors.accent,
    tagline: lightColors.text,
    taglineOpacity: 0.5,
    buttonBg: lightColors.buttonBg,
    buttonText: lightColors.buttonText,
    ghostText: lightColors.ghostText,
  };

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      {/* Dark background */}
      <Animated.View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: colors.bg, opacity: darkOpacity,
      }}>
        <Starfield />
        <ShootingStarField />
        <UfoField />
        <DarkGlow />
      </Animated.View>

      {/* Light background */}
      <Animated.View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        opacity: lightOpacity,
      }}>
        {/* Sky gradient */}
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          ...(Platform.OS === 'web' ? {
            background: 'linear-gradient(180deg, #4a90d9 0%, #87ceeb 40%, #b0dff7 70%, #d4ecfb 100%)',
          } as any : { backgroundColor: lightColors.bg }),
        }} />
        <SunGlow />
        <CloudField />
        <AirplaneField />
      </Animated.View>

      {/* Content */}
      <View style={{
        flex: 1, alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: spacing['2xl'],
      }}>
        {/* Theme toggle */}
        <Pressable
          onPress={toggleTheme}
          style={{
            position: 'absolute',
            top: 50,
            right: 24,
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
          hitSlop={12}
        >
          <Ionicons
            name={isDark ? 'sunny-outline' : 'moon-outline'}
            size={22}
            color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,26,46,0.6)'}
          />
        </Pressable>

        {/* Hero */}
        <View style={{ alignItems: 'center', marginBottom: spacing['6xl'] }}>
          <Text
            variant="hero"
            color={c.wordmark}
            align="center"
            style={{
              fontSize: 96,
              letterSpacing: 12,
              fontWeight: '300',
              textTransform: 'lowercase',
              marginBottom: spacing['3xl'],
            }}
          >
            minds
          </Text>

          <Text
            variant="body"
            color={c.tagline}
            align="center"
            style={{
              fontSize: 18,
              letterSpacing: 8,
              fontWeight: '200',
              textTransform: 'lowercase',
              opacity: c.taglineOpacity,
              marginTop: spacing.md,
            }}
          >
            think freely
          </Text>
        </View>

        {/* Buttons */}
        <View style={{ width: '100%', maxWidth: 280, gap: spacing.md }}>
          <Pressable
            onPress={() => router.push('/(auth)/sign-up')}
            style={({ pressed }) => ({
              paddingVertical: 14,
              paddingHorizontal: 24,
              borderRadius: 10,
              backgroundColor: c.buttonBg,
              alignItems: 'center' as const,
              opacity: pressed ? 0.85 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'opacity 0.15s ease' } as any : {}),
            })}
          >
            <Text variant="bodyMedium" color={c.buttonText} style={{ fontSize: 15 }}>
              Request early access
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(auth)/sign-in')}
            style={({ pressed }) => ({
              paddingVertical: 14,
              paddingHorizontal: 24,
              borderRadius: 10,
              alignItems: 'center' as const,
              opacity: pressed ? 0.6 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'opacity 0.15s ease' } as any : {}),
            })}
          >
            <Text variant="bodyMedium" color={c.ghostText} style={{ fontSize: 15, opacity: 0.7 }}>
              Log in
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
