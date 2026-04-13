import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { ProjectProvider } from '../lib/project';
import { AuthProvider, useAuth } from '../lib/auth';
import { ThemeProvider } from '../lib/theme';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToastProvider } from '../components/Toast';
import { NetworkBanner } from '../components/NetworkBanner';
import { initSentry } from '../lib/sentry';
import { injectWebStyles } from '../lib/webStyles';
import { initKeyboardShortcuts } from '../lib/keyboard';
import { setupNotificationListeners } from '../lib/notifications';

initSentry();
injectWebStyles();
initKeyboardShortcuts();

SplashScreen.preventAutoHideAsync();

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
  const [fontsLoaded] = useFonts({
    'Geist-Light': require('../assets/fonts/Geist-Light.ttf'),
    'Geist-Regular': require('../assets/fonts/Geist-Regular.ttf'),
    'Geist-Medium': require('../assets/fonts/Geist-Medium.ttf'),
    'Geist-SemiBold': require('../assets/fonts/Geist-SemiBold.ttf'),
    'Geist-Bold': require('../assets/fonts/Geist-Bold.ttf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <ErrorBoundary>
          <ThemeProvider>
            <ProjectProvider>
              <AuthProvider>
                <ToastProvider>
                  <NotificationWiring />
                  <NetworkBanner />
                  <StatusBar style="light" />
                  <Slot />
                </ToastProvider>
              </AuthProvider>
            </ProjectProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </View>
    </SafeAreaProvider>
  );
}
