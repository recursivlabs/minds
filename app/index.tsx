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
            fontSize: 14,
            letterSpacing: 8,
            fontWeight: '200',
            textTransform: 'lowercase',
            opacity: 0.5,
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
