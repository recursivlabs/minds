import * as React from 'react';
import { View, Platform, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { Text, Button } from '../components';
import { colors, spacing } from '../constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function Star({ delay, duration, size, x, y, color }: {
  delay: number; duration: number; size: number; x: number; y: number; color: string;
}) {
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: duration * 0.4, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.1, duration: duration * 0.6, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
      }}
    />
  );
}

function Starfield() {
  const stars = React.useMemo(() => {
    const result = [];
    for (let i = 0; i < 60; i++) {
      result.push({
        id: i,
        x: Math.random() * (SCREEN_W || 1200),
        y: Math.random() * (SCREEN_H || 900),
        size: Math.random() * 2 + 0.5,
        delay: Math.random() * 4000,
        duration: 3000 + Math.random() * 5000,
        color: Math.random() > 0.5 ? 'rgba(212,168,68,0.6)' : 'rgba(255,255,255,0.4)',
      });
    }
    return result;
  }, []);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {stars.map((s) => (
        <Star key={s.id} {...s} />
      ))}
    </View>
  );
}

function ShootingStar({ delay, duration, startX, startY, angle }: {
  delay: number; duration: number; startX: number; startY: number; angle: number;
}) {
  const progress = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  const distance = 300;
  const endX = startX + Math.cos(angle) * distance;
  const endY = startY + Math.sin(angle) * distance;

  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(progress, { toValue: 1, duration, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 1, duration: duration * 0.2, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: duration * 0.8, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [startY, endY] });
  const rotate = `${angle}rad`;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        opacity,
        transform: [{ translateX }, { translateY }, { rotate }],
      }}
    >
      {/* Bright head */}
      <View style={{
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: 'rgba(255,255,255,0.9)',
      }} />
      {/* Fading tail */}
      <View style={{
        position: 'absolute',
        right: 3,
        top: 0.5,
        width: 40,
        height: 2,
        borderRadius: 1,
        backgroundColor: 'rgba(255,255,255,0.15)',
        ...(Platform.OS === 'web' ? {
          background: 'linear-gradient(to left, rgba(255,255,255,0.3), transparent)',
        } as any : {}),
      }} />
    </Animated.View>
  );
}

function ShootingStarField() {
  const w = SCREEN_W || 1200;
  const h = SCREEN_H || 900;

  const shooters = React.useMemo(() => [
    { id: 0, delay: 5000, duration: 1200, startX: w * 0.7, startY: h * 0.1, angle: 2.5 },
    { id: 1, delay: 15000, duration: 900, startX: w * 0.3, startY: h * 0.15, angle: 2.3 },
    { id: 2, delay: 28000, duration: 1400, startX: w * 0.85, startY: h * 0.3, angle: 2.8 },
    { id: 3, delay: 40000, duration: 1000, startX: w * 0.5, startY: h * 0.05, angle: 2.4 },
  ], []);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {shooters.map((s) => (
        <ShootingStar key={s.id} {...s} />
      ))}
    </View>
  );
}

function Ufo({ delay, duration, startX, startY, endX, endY }: {
  delay: number; duration: number; startX: number; startY: number; endX: number; endY: number;
}) {
  const progress = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.7, duration: 600, useNativeDriver: true }),
          Animated.timing(progress, { toValue: 1, duration, useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [startY, endY] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        opacity,
        transform: [{ translateX }, { translateY }],
      }}
    >
      {/* UFO body — small elongated oval */}
      <View style={{
        width: 12,
        height: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(212,168,68,0.5)',
        ...(Platform.OS === 'web' ? { boxShadow: '0 0 8px rgba(212,168,68,0.3)' } as any : {}),
      }} />
      {/* Tiny dome on top */}
      <View style={{
        position: 'absolute',
        top: -2,
        left: 4,
        width: 4,
        height: 3,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
      }} />
    </Animated.View>
  );
}

function UfoField() {
  const ufos = React.useMemo(() => {
    const w = SCREEN_W || 1200;
    const h = SCREEN_H || 900;
    return [
      { id: 0, delay: 3000, duration: 8000, startX: -20, startY: h * 0.3, endX: w + 20, endY: h * 0.25 },
      { id: 1, delay: 12000, duration: 6000, startX: w + 20, startY: h * 0.7, endX: -20, endY: h * 0.6 },
      { id: 2, delay: 20000, duration: 10000, startX: w * 0.2, startY: -10, endX: w * 0.8, endY: h + 10 },
    ];
  }, []);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {ufos.map((u) => (
        <Ufo key={u.id} {...u} />
      ))}
    </View>
  );
}

function GlowOrb() {
  const scale = React.useRef(new Animated.Value(1)).current;
  const opacity = React.useRef(new Animated.Value(0.03)).current;

  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.3, duration: 4000, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 4000, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.06, duration: 4000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.03, duration: 4000, useNativeDriver: true }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 500,
        height: 500,
        borderRadius: 250,
        backgroundColor: colors.accent,
        opacity,
        transform: [{ scale }],
        ...(Platform.OS === 'web' ? { filter: 'blur(120px)' } as any : {}),
      }}
    />
  );
}

export default function LandingScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  if (isAuthenticated && !isLoading) {
    router.replace('/(tabs)');
    return null;
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing['2xl'],
      }}
    >
      <Starfield />
      <ShootingStarField />
      <UfoField />
      <GlowOrb />

      {/* Hero block — centered as a group */}
      <View style={{ alignItems: 'center', marginBottom: spacing['6xl'] }}>
        <Text
          variant="hero"
          color={colors.accent}
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
          color={colors.text}
          align="center"
          style={{
            fontSize: 18,
            letterSpacing: 8,
            fontWeight: '200',
            textTransform: 'lowercase',
            opacity: 0.5,
            marginTop: spacing.md,
          }}
        >
          think freely
        </Text>
      </View>

      {/* Buttons */}
      <View style={{ width: '100%', maxWidth: 280, gap: spacing.md }}>
        <Button
          onPress={() => router.push('/(auth)/sign-up')}
          size="lg"
          fullWidth
        >
          Request early access
        </Button>

        <Button
          onPress={() => router.push('/(auth)/sign-in')}
          variant="ghost"
          size="lg"
          fullWidth
        >
          Log in
        </Button>
      </View>
    </View>
  );
}
