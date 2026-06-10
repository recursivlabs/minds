import type * as React from 'react';
import { useCallback, useEffect } from 'react';
import { View, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slot, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Roboto_300Light,
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
} from '@expo-google-fonts/roboto';
import * as SplashScreen from 'expo-splash-screen';
import { ProjectProvider } from '../lib/project';
import { AuthProvider, useAuth } from '../lib/auth';
import { ThemeProvider, useTheme } from '../lib/theme';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToastProvider } from '../components/Toast';
import { NetworkBanner } from '../components/NetworkBanner';
import { CommandPalette } from '../components/CommandPalette';
import { ActiveConvoProvider } from '../lib/activeConvo';
import { initMonitoring } from '../lib/monitoring';
import { injectWebStyles } from '../lib/webStyles';
import { initKeyboardShortcuts } from '../lib/keyboard';
import { setupNotificationListeners } from '../lib/notifications';

initMonitoring();
injectWebStyles();
initKeyboardShortcuts();

SplashScreen.preventAutoHideAsync();

/**
 * Subscribes to theme so the entire tree re-renders on toggle.
 * Owns StatusBar style + the rendered background color so platform
 * chrome stays consistent with the active palette.
 */
function ThemedRoot({ children }: { children: React.ReactNode }) {
  const { isDark, colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {children}
    </View>
  );
}

/** Wire push notification listeners — must be inside AuthProvider + Router. */
function NotificationWiring() {
  const router = useRouter();
  useEffect(() => {
    return setupNotificationListeners(
      // Foreground notification — no-op, system shows it via setNotificationHandler
      undefined,
      // User tapped notification — navigate to target
      (response: any) => {
        const data = response?.notification?.request?.content?.data;
        if (data?.targetType === 'post' && data?.targetId) {
          router.push(`/(tabs)/post/${data.targetId}` as any);
        } else if (data?.targetType === 'message' && data?.targetId) {
          router.push(`/(tabs)/chat?id=${data.targetId}` as any);
        } else if (data?.targetType === 'user' && data?.targetId) {
          router.push(`/(tabs)/user/${data.targetId}` as any);
        } else if (data?.actionUrl) {
          router.push(data.actionUrl as any);
        } else {
          router.push('/(tabs)/notifications' as any);
        }
      },
    );
  }, [router]);
  return null;
}

export default function RootLayout() {
  // Roboto (matches legacy Minds + reads cleanly on web). Custom keys keep the
  // theme's typography references stable. Roboto has no SemiBold in our scale —
  // headings/labels use Medium (the X/Bluesky-correct UI weight).
  const [fontsLoaded] = useFonts({
    'Roboto-Light': Roboto_300Light,
    'Roboto-Regular': Roboto_400Regular,
    'Roboto-Medium': Roboto_500Medium,
    'Roboto-Bold': Roboto_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Gate on fonts only where a splash screen covers the wait. Web has no
  // splash — returning null left users staring at a blank white page while
  // ~640KB of TTFs downloaded (serially, after the JS bundle). Render with
  // the system font stack and let Roboto swap in.
  if (!fontsLoaded && Platform.OS !== 'web') return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
          <ErrorBoundary>
            <ThemeProvider>
              <ThemedRoot>
                <ProjectProvider>
                  <AuthProvider>
                    <ActiveConvoProvider>
                      <ToastProvider>
                        <NotificationWiring />
                        <NetworkBanner />
                        <Slot />
                        {/* Cmd+K palette stays mounted at root so it
                           can open from any screen. Web-only for now;
                           the component returns null on native. */}
                        <CommandPalette />
                      </ToastProvider>
                    </ActiveConvoProvider>
                  </AuthProvider>
                </ProjectProvider>
              </ThemedRoot>
            </ThemeProvider>
          </ErrorBoundary>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
