import * as React from 'react';
import { View, Platform, Animated, Dimensions, Pressable, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth';
import { BASE_URL, BASE_ORIGIN } from '../lib/recursiv';
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
      {/* Beam of light underneath */}
      <View style={{
        position: 'absolute', top: 8, left: 6, width: 0, height: 0,
        borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 14,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        borderTopColor: 'rgba(212,168,68,0.08)',
      }} />
      {/* Saucer body — wide flat oval */}
      <View style={{
        width: 28, height: 6, borderRadius: 14, backgroundColor: 'rgba(180,180,190,0.5)',
        ...(Platform.OS === 'web' ? { boxShadow: '0 0 12px rgba(212,168,68,0.25)' } as any : {}),
      }} />
      {/* Dome on top — half circle */}
      <View style={{
        position: 'absolute', top: -5, left: 8, width: 12, height: 7,
        borderTopLeftRadius: 8, borderTopRightRadius: 8,
        backgroundColor: 'rgba(212,168,68,0.4)',
      }} />
      {/* Tiny lights on the saucer rim */}
      <View style={{ position: 'absolute', top: 2, left: 4, width: 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(212,168,68,0.7)' }} />
      <View style={{ position: 'absolute', top: 2, left: 13, width: 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.6)' }} />
      <View style={{ position: 'absolute', top: 2, left: 22, width: 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(212,168,68,0.7)' }} />
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

function Cloud({ delay, y, width, speed, opacity: baseOpacity }: {
  delay: number; y: number; width: number; speed: number; opacity: number;
}) {
  const translateX = React.useRef(new Animated.Value(-width - 50)).current;
  React.useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(translateX, { toValue: W + 50, duration: speed, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: -width - 50, duration: 0, useNativeDriver: true }),
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
    { id: 0, delay: 0, y: H * 0.10, width: 180, speed: 70000, opacity: 0.6 },
    { id: 1, delay: 15000, y: H * 0.28, width: 130, speed: 90000, opacity: 0.45 },
    { id: 2, delay: 35000, y: H * 0.15, width: 150, speed: 80000, opacity: 0.5 },
    { id: 3, delay: 55000, y: H * 0.38, width: 100, speed: 100000, opacity: 0.35 },
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

type ScreenMode = 'home' | 'earlyAccess' | 'login' | 'signUp' | 'submitted' | 'otp' | 'otpVerify';

export default function LandingScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading, signIn, signUp, sendOtp, verifyOtp } = useAuth();
  const [isDark, setIsDark] = React.useState(true);
  const darkOpacity = React.useRef(new Animated.Value(1)).current;
  const lightOpacity = React.useRef(new Animated.Value(0)).current;

  const [screen, setScreen] = React.useState<ScreenMode>('home');
  const [email, setEmail] = React.useState('');
  const [loginId, setLoginId] = React.useState('');
  const [loginPw, setLoginPw] = React.useState('');
  const [signUpName, setSignUpName] = React.useState('');
  const [signUpEmail, setSignUpEmail] = React.useState('');
  const [signUpPw, setSignUpPw] = React.useState('');
  const [otpEmail, setOtpEmail] = React.useState('');
  const [otpCode, setOtpCode] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [resetSent, setResetSent] = React.useState(false);

  // Show nothing while restoring session (prevents landing page flash)
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#06060a', alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="h2" color="#d4a844" style={{ letterSpacing: 4, fontWeight: '300' }}>
          minds
        </Text>
      </View>
    );
  }

  if (isAuthenticated) {
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

  const handleEarlyAccess = () => {
    if (!email.trim() || !email.includes('@')) return;
    // TODO: store email in database via SDK
    setScreen('submitted');
  };

  const handleSignUp = async () => {
    if (!signUpName.trim() || !signUpEmail.trim() || !signUpPw.trim()) {
      setError('All fields are required');
      return;
    }
    if (signUpPw.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signUp(signUpName.trim(), signUpEmail.trim().toLowerCase(), signUpPw);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Sign up failed. Try a different email.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!loginId.trim() || !loginPw.trim()) {
      setError('All fields are required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const loginEmail = loginId.includes('@') ? loginId.trim().toLowerCase() : `${loginId.trim().toLowerCase()}@minds.com`;
      await signIn(loginEmail, loginPw);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Sign in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!otpEmail.trim() || !otpEmail.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendOtp(otpEmail.trim().toLowerCase());
      setScreen('otpVerify');
    } catch (err: any) {
      setError(err?.message || 'Could not send code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.length < 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await verifyOtp(otpEmail.trim().toLowerCase(), otpCode.trim());
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const c = isDark ? {
    wordmark: colors.accent,
    tagline: colors.text,
    taglineOpacity: 0.5,
    buttonBg: colors.accent,
    buttonText: colors.textInverse,
    ghostText: colors.text,
    inputBg: 'rgba(255,255,255,0.06)',
    inputBorder: 'rgba(255,255,255,0.12)',
    inputBorderFocus: colors.accent,
    inputText: '#fafafa',
    inputPlaceholder: 'rgba(255,255,255,0.3)',
    successText: colors.text,
    subtleText: 'rgba(255,255,255,0.4)',
  } : {
    wordmark: lightColors.accent,
    tagline: lightColors.text,
    taglineOpacity: 0.5,
    buttonBg: lightColors.buttonBg,
    buttonText: lightColors.buttonText,
    ghostText: lightColors.ghostText,
    inputBg: 'rgba(255,255,255,0.5)',
    inputBorder: 'rgba(255,255,255,0.6)',
    inputBorderFocus: lightColors.accent,
    inputText: '#1a1a2e',
    inputPlaceholder: 'rgba(26,26,46,0.35)',
    successText: lightColors.text,
    subtleText: 'rgba(26,26,46,0.5)',
  };

  const inputStyle = {
    backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13,
    color: c.inputText, fontSize: 15,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  };

  const primaryButtonStyle = (pressed: boolean) => ({
    paddingVertical: 14, borderRadius: 10,
    backgroundColor: c.buttonBg,
    alignItems: 'center' as const,
    opacity: loading ? 0.5 : pressed ? 0.85 : 1,
    ...(Platform.OS === 'web' ? { cursor: loading ? 'default' : 'pointer' } as any : {}),
  });

  const renderForm = () => {
    if (screen === 'otpVerify') {
      return (
        <View style={{ width: '100%', maxWidth: 280, gap: spacing.md }}>
          <Text variant="h3" color={c.wordmark} align="center">Enter code</Text>
          <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.7, marginBottom: spacing.xs }}>
            We sent a 6-digit code to {otpEmail}
          </Text>
          {error ? <Text variant="caption" color={colors.error} align="center">{error}</Text> : null}
          <TextInput
            placeholder="000000"
            placeholderTextColor={c.subtleText}
            value={otpCode}
            onChangeText={(t) => { setOtpCode(t.replace(/\D/g, '').slice(0, 6)); setError(''); }}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            onSubmitEditing={handleVerifyOtp}
            style={{
              ...inputStyle,
              fontSize: 24, letterSpacing: 8, textAlign: 'center' as const,
              fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
            }}
          />
          <Pressable onPress={handleVerifyOtp} disabled={loading} style={({ pressed }) => primaryButtonStyle(pressed)}>
            <Text variant="bodyMedium" color={c.buttonText} style={{ fontSize: 15 }}>
              {loading ? 'Verifying...' : 'Continue'}
            </Text>
          </Pressable>
          <Pressable onPress={async () => {
            setLoading(true);
            try { await sendOtp(otpEmail.trim().toLowerCase()); } catch {}
            setLoading(false);
          }}>
            <Text variant="caption" color={c.subtleText} align="center" style={{ opacity: 0.6 }}>
              Resend code
            </Text>
          </Pressable>
          <Pressable onPress={() => { setScreen('otp'); setOtpCode(''); setError(''); }}>
            <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.5 }}>Back</Text>
          </Pressable>
        </View>
      );
    }

    if (screen === 'otp') {
      return (
        <View style={{ width: '100%', maxWidth: 280, gap: spacing.md }}>
          <Text variant="h3" color={c.wordmark} align="center">Continue with email</Text>
          <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.7, marginBottom: spacing.xs }}>
            We'll send you a sign-in code
          </Text>
          {error ? <Text variant="caption" color={colors.error} align="center">{error}</Text> : null}
          <TextInput
            placeholder="Email"
            placeholderTextColor={c.subtleText}
            value={otpEmail}
            onChangeText={(t) => { setOtpEmail(t); setError(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoFocus
            onSubmitEditing={handleSendOtp}
            style={inputStyle}
          />
          <Pressable onPress={handleSendOtp} disabled={loading} style={({ pressed }) => primaryButtonStyle(pressed)}>
            <Text variant="bodyMedium" color={c.buttonText} style={{ fontSize: 15 }}>
              {loading ? 'Sending code...' : 'Send code'}
            </Text>
          </Pressable>
          <Pressable onPress={() => { setScreen('login'); setError(''); }}>
            <Text variant="caption" color={c.subtleText} align="center" style={{ opacity: 0.6 }}>
              Log in with password instead
            </Text>
          </Pressable>
          <Pressable onPress={() => { setScreen('home'); setError(''); setOtpEmail(''); }}>
            <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.5 }}>Back</Text>
          </Pressable>
        </View>
      );
    }

    if (screen === 'submitted') {
      return (
        <View style={{ width: '100%', maxWidth: 320, alignItems: 'center', gap: spacing.lg }}>
          <Ionicons name="checkmark-circle" size={48} color={isDark ? colors.success : '#2d8a5e'} />
          <Text variant="h3" color={c.successText} align="center">
            You're on the list
          </Text>
          <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.7 }}>
            We'll notify you at {email} when your access is ready.
          </Text>
          <Pressable
            onPress={() => { setScreen('home'); setEmail(''); }}
            style={{ marginTop: spacing.md }}
          >
            <Text variant="body" color={c.subtleText} style={{ opacity: 0.5 }}>
              Back
            </Text>
          </Pressable>
        </View>
      );
    }

    if (screen === 'earlyAccess') {
      return (
        <View style={{ width: '100%', maxWidth: 320, gap: spacing.lg }}>
          <Text variant="h3" color={c.tagline} align="center">
            Request early access
          </Text>
          <View style={{
            flexDirection: 'row', gap: spacing.sm,
            width: '100%',
          }}>
            <View style={{ flex: 1 }}>
              <TextInput
                placeholder="Your email"
                placeholderTextColor={c.inputPlaceholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                onSubmitEditing={handleEarlyAccess}
                style={{
                  backgroundColor: c.inputBg,
                  borderWidth: 1,
                  borderColor: c.inputBorder,
                  borderRadius: 10,
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  color: c.inputText,
                  fontSize: 15,
                  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
                }}
              />
            </View>
            <Pressable
              onPress={handleEarlyAccess}
              style={({ pressed }) => ({
                paddingHorizontal: 20,
                paddingVertical: 13,
                borderRadius: 10,
                backgroundColor: c.buttonBg,
                justifyContent: 'center' as const,
                opacity: pressed ? 0.85 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Ionicons name="arrow-forward" size={18} color={c.buttonText} />
            </Pressable>
          </View>
          <Pressable onPress={() => { setScreen('home'); setError(''); }}>
            <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.5 }}>
              Back
            </Text>
          </Pressable>
        </View>
      );
    }

    if (screen === 'signUp') {
      return (
        <View style={{ width: '100%', maxWidth: 280, gap: spacing.md }}>
          <Text variant="h3" color={c.wordmark} align="center">Create Account</Text>
          {error ? <Text variant="caption" color={colors.error} align="center">{error}</Text> : null}
          <TextInput
            placeholder="Name"
            placeholderTextColor={c.subtleText}
            value={signUpName}
            onChangeText={setSignUpName}
            autoCapitalize="words"
            style={{
              backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder,
              borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13,
              color: c.inputText, fontSize: 15,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />
          <TextInput
            placeholder="Email"
            placeholderTextColor={c.subtleText}
            value={signUpEmail}
            onChangeText={setSignUpEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{
              backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder,
              borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13,
              color: c.inputText, fontSize: 15,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />
          <TextInput
            placeholder="Password (8+ characters)"
            placeholderTextColor={c.subtleText}
            value={signUpPw}
            onChangeText={setSignUpPw}
            secureTextEntry
            style={{
              backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder,
              borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13,
              color: c.inputText, fontSize: 15,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />
          <Pressable
            onPress={handleSignUp}
            disabled={loading}
            style={({ pressed }) => ({
              paddingVertical: 14, borderRadius: 10,
              backgroundColor: c.buttonBg,
              alignItems: 'center' as const,
              opacity: loading ? 0.5 : pressed ? 0.85 : 1,
              ...(Platform.OS === 'web' ? { cursor: loading ? 'default' : 'pointer' } as any : {}),
            })}
          >
            <Text variant="bodyMedium" color={c.buttonText} style={{ fontSize: 15 }}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </Text>
          </Pressable>
          <Pressable onPress={() => { setScreen('login'); setError(''); }}>
            <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.6 }}>
              Already have an account? Log in
            </Text>
          </Pressable>
          <Pressable onPress={() => { setScreen('home'); setError(''); setSignUpName(''); setSignUpEmail(''); setSignUpPw(''); }}>
            <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.5 }}>
              Back
            </Text>
          </Pressable>
        </View>
      );
    }

    if (screen === 'login') {
      return (
        <View style={{ width: '100%', maxWidth: 320, gap: spacing.md }}>
          <Text variant="h3" color={c.tagline} align="center" style={{ marginBottom: spacing.sm }}>
            Log in
          </Text>
          <TextInput
            placeholder="Email or username"
            placeholderTextColor={c.inputPlaceholder}
            value={loginId}
            onChangeText={(t) => { setLoginId(t); setError(''); }}
            autoCapitalize="none"
            style={{
              backgroundColor: c.inputBg,
              borderWidth: 1,
              borderColor: error ? colors.error : c.inputBorder,
              borderRadius: 10,
              paddingHorizontal: 16,
              paddingVertical: 13,
              color: c.inputText,
              fontSize: 15,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor={c.inputPlaceholder}
            value={loginPw}
            onChangeText={(t) => { setLoginPw(t); setError(''); }}
            secureTextEntry
            onSubmitEditing={handleLogin}
            style={{
              backgroundColor: c.inputBg,
              borderWidth: 1,
              borderColor: error ? colors.error : c.inputBorder,
              borderRadius: 10,
              paddingHorizontal: 16,
              paddingVertical: 13,
              color: c.inputText,
              fontSize: 15,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />
          {error ? (
            <Text variant="caption" color={colors.error} align="center">{error}</Text>
          ) : null}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => ({
              paddingVertical: 14,
              borderRadius: 10,
              backgroundColor: c.buttonBg,
              alignItems: 'center' as const,
              opacity: loading ? 0.5 : pressed ? 0.85 : 1,
              ...(Platform.OS === 'web' ? { cursor: loading ? 'default' : 'pointer' } as any : {}),
            })}
          >
            <Text variant="bodyMedium" color={c.buttonText} style={{ fontSize: 15 }}>
              {loading ? 'Signing in...' : 'Log in'}
            </Text>
          </Pressable>
          <Pressable onPress={async () => {
            if (!loginId.trim()) { setError('Enter your email first'); return; }
            try {
              await fetch(`${BASE_URL.replace('/api/v1', '')}/api/auth/forget-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: loginId.trim(), redirectTo: `${BASE_ORIGIN}/reset-password` }),
              });
              setError('');
              setResetSent(true);
            } catch {
              // Still show success to not leak whether the email exists
              setError('');
              setResetSent(true);
            }
          }}>
            <Text variant="caption" color={c.subtleText} align="center" style={{ opacity: 0.6 }}>
              {resetSent ? 'Resend link' : 'Forgot password?'}
            </Text>
          </Pressable>
          {resetSent && (
            <Text variant="caption" color={c.accent} align="center">
              Check your email for a reset link.
            </Text>
          )}
          <Pressable onPress={() => { setScreen('otp'); setError(''); }}>
            <Text variant="caption" color={c.subtleText} align="center" style={{ opacity: 0.6 }}>
              Use email code instead
            </Text>
          </Pressable>
          <Pressable onPress={() => { setScreen('home'); setError(''); setLoginId(''); setLoginPw(''); }}>
            <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.5 }}>
              Back
            </Text>
          </Pressable>
        </View>
      );
    }

    // Home — email code (primary) + password (secondary)
    return (
      <View style={{ width: '100%', maxWidth: 280, gap: spacing.md }}>
        <Pressable
          onPress={() => setScreen('otp')}
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
            Continue with email
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setScreen('login')}
          style={({ pressed }) => ({
            paddingVertical: 14,
            paddingHorizontal: 24,
            borderRadius: 10,
            alignItems: 'center' as const,
            opacity: pressed ? 0.6 : 1,
            ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'opacity 0.15s ease' } as any : {}),
          })}
        >
          <Text variant="caption" color={c.ghostText} style={{ opacity: 0.5 }}>
            Log in with password
          </Text>
        </Pressable>
      </View>
    );
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

        {renderForm()}
      </View>
    </View>
  );
}
