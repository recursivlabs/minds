import { Platform } from 'react-native';

// Lazy imports — expo-notifications/device/constants crash on web
const getNotifications = () => {
  if (Platform.OS === 'web') return null;
  try { return require('expo-notifications'); } catch { return null; }
};
const getDevice = () => {
  if (Platform.OS === 'web') return null;
  try { return require('expo-device'); } catch { return null; }
};
const getConstants = () => {
  try { return require('expo-constants').default; } catch { return null; }
};

// Configure notification handler (native only)
if (Platform.OS !== 'web') {
  try {
    const Notifications = getNotifications();
    if (Notifications) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }
  } catch {}
}

/**
 * Register for push notifications and return the Expo push token.
 * Returns null on web or if registration fails.
 */
export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const Device = getDevice();
  const Notifications = getNotifications();
  const Constants = getConstants();

  if (!Device?.isDevice || !Notifications) return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    return token.data;
  } catch {
    return null;
  }
}

/**
 * Register push token with the Recursiv server.
 */
export async function registerTokenWithServer(sdk: any, token: string): Promise<void> {
  try {
    await sdk.notifications.registerToken({
      token,
      platform: Platform.OS as 'ios' | 'android' | 'web',
    });
  } catch {}
}

/**
 * Set up notification listeners. Returns cleanup function.
 * No-op on web.
 */
export function setupNotificationListeners(
  onNotification?: (notification: any) => void,
  onResponse?: (response: any) => void,
): () => void {
  if (Platform.OS === 'web') return () => {};

  const Notifications = getNotifications();
  if (!Notifications) return () => {};

  const notifSub = Notifications.addNotificationReceivedListener((notification: any) => {
    onNotification?.(notification);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response: any) => {
    onResponse?.(response);
  });

  return () => {
    notifSub.remove();
    responseSub.remove();
  };
}
