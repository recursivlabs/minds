import * as React from 'react';
import { View, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { Text, Button } from '../components';
import { colors, spacing } from '../constants/theme';

function StarfieldBackground() {
  if (Platform.OS !== 'web') return null;

  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes drift {
        from { transform: translateY(0px) translateX(0px); }
        to { transform: translateY(-2000px) translateX(-500px); }
      }
      @keyframes pulse-glow {
        0%, 100% { opacity: 0.03; transform: scale(1); }
        50% { opacity: 0.07; transform: scale(1.2); }
      }
      .starfield {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        overflow: hidden;
        z-index: 0;
        pointer-events: none;
      }
      .starfield-layer {
        position: absolute;
        top: 0; left: 0;
        width: 200%; height: 200%;
        background-image:
          radial-gradient(1px 1px at 10% 20%, rgba(212,168,68,0.4) 0%, transparent 100%),
          radial-gradient(1px 1px at 30% 60%, rgba(255,255,255,0.3) 0%, transparent 100%),
          radial-gradient(1px 1px at 50% 10%, rgba(212,168,68,0.3) 0%, transparent 100%),
          radial-gradient(1.5px 1.5px at 70% 80%, rgba(255,255,255,0.4) 0%, transparent 100%),
          radial-gradient(1px 1px at 90% 40%, rgba(212,168,68,0.2) 0%, transparent 100%),
          radial-gradient(1px 1px at 15% 85%, rgba(255,255,255,0.25) 0%, transparent 100%),
          radial-gradient(1px 1px at 45% 45%, rgba(212,168,68,0.35) 0%, transparent 100%),
          radial-gradient(1.5px 1.5px at 80% 15%, rgba(255,255,255,0.3) 0%, transparent 100%),
          radial-gradient(1px 1px at 25% 35%, rgba(212,168,68,0.2) 0%, transparent 100%),
          radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.2) 0%, transparent 100%),
          radial-gradient(1px 1px at 5% 55%, rgba(212,168,68,0.3) 0%, transparent 100%),
          radial-gradient(1px 1px at 85% 50%, rgba(255,255,255,0.35) 0%, transparent 100%),
          radial-gradient(1px 1px at 35% 90%, rgba(212,168,68,0.25) 0%, transparent 100%),
          radial-gradient(1.5px 1.5px at 65% 25%, rgba(255,255,255,0.3) 0%, transparent 100%),
          radial-gradient(1px 1px at 95% 75%, rgba(212,168,68,0.2) 0%, transparent 100%);
        animation: drift 120s linear infinite;
      }
      .starfield-layer-2 {
        position: absolute;
        top: 0; left: 0;
        width: 200%; height: 200%;
        background-image:
          radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.2) 0%, transparent 100%),
          radial-gradient(1px 1px at 40% 70%, rgba(212,168,68,0.15) 0%, transparent 100%),
          radial-gradient(1px 1px at 60% 20%, rgba(255,255,255,0.25) 0%, transparent 100%),
          radial-gradient(1px 1px at 80% 60%, rgba(212,168,68,0.2) 0%, transparent 100%),
          radial-gradient(1px 1px at 10% 50%, rgba(255,255,255,0.15) 0%, transparent 100%),
          radial-gradient(1px 1px at 55% 85%, rgba(212,168,68,0.2) 0%, transparent 100%),
          radial-gradient(1px 1px at 75% 35%, rgba(255,255,255,0.2) 0%, transparent 100%),
          radial-gradient(1px 1px at 35% 15%, rgba(212,168,68,0.15) 0%, transparent 100%);
        animation: drift 80s linear infinite;
        animation-delay: -20s;
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  return (
    <div className="starfield">
      <div className="starfield-layer" />
      <div className="starfield-layer-2" />
    </div>
  ) as any;
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
      <StarfieldBackground />

      {/* Glow behind wordmark */}
      {Platform.OS === 'web' ? (
        <View
          style={{
            position: 'absolute',
            width: 600,
            height: 600,
            borderRadius: 9999,
            backgroundColor: colors.accent,
            opacity: 0.03,
            ...(Platform.OS === 'web' ? {
              filter: 'blur(150px)',
              animation: 'pulse-glow 8s ease-in-out infinite',
            } as any : {}),
          }}
        />
      ) : null}

      {/* Wordmark */}
      <Text
        variant="hero"
        color={colors.accent}
        align="center"
        style={{
          fontSize: 96,
          letterSpacing: 12,
          fontWeight: '300',
          textTransform: 'lowercase',
          marginBottom: spacing['5xl'],
          ...(Platform.OS === 'web' ? { zIndex: 1 } : {}),
        }}
      >
        minds
      </Text>

      {/* Buttons */}
      <View style={{
        width: '100%',
        maxWidth: 280,
        gap: spacing.md,
        ...(Platform.OS === 'web' ? { zIndex: 1 } : {}),
      }}>
        <Button
          onPress={() => router.push('/(auth)/sign-up')}
          size="lg"
          fullWidth
        >
          Sign up
        </Button>

        <Button
          onPress={() => router.push('/(auth)/sign-in')}
          variant="ghost"
          size="lg"
          fullWidth
        >
          Sign in
        </Button>
      </View>
    </View>
  );
}
