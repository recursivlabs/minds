import * as React from 'react';
import { View, Animated, Platform } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius } from '../constants/theme';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

const ToastContext = React.createContext<{
  show: (message: string, type?: ToastType) => void;
}>({ show: () => {} });

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const show = React.useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View
        style={{
          position: 'absolute',
          bottom: Platform.OS === 'web' ? 40 : 100,
          left: 0,
          right: 0,
          alignItems: 'center',
          pointerEvents: 'none',
          zIndex: 99999,
        }}
      >
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(20)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -10, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const bg = toast.type === 'error' ? colors.errorMuted
    : toast.type === 'info' ? colors.infoMuted
    : colors.successMuted;
  const textColor = toast.type === 'error' ? colors.error
    : toast.type === 'info' ? colors.info
    : colors.success;

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
        backgroundColor: bg,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: radius.full,
        marginBottom: spacing.sm,
        borderWidth: 0.5,
        borderColor: textColor + '30',
        ...(Platform.OS === 'web' ? { backdropFilter: 'blur(12px)' } as any : {}),
      }}
    >
      <Text variant="bodyMedium" color={textColor} style={{ fontSize: 14 }}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}
