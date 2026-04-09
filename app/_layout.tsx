import { useCallback } from 'react';
import { View } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { ProjectProvider } from '../lib/project';
import { AuthProvider } from '../lib/auth';
import { ThemeProvider } from '../lib/theme';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToastProvider } from '../components/Toast';
import { NetworkBanner } from '../components/NetworkBanner';
import { initSentry } from '../lib/sentry';
import { injectWebStyles } from '../lib/webStyles';
import { initKeyboardShortcuts } from '../lib/keyboard';

initSentry();
injectWebStyles();
initKeyboardShortcuts();

SplashScreen.preventAutoHideAsync();

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
