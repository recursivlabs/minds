import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProjectProvider } from '../lib/project';
import { AuthProvider } from '../lib/auth';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ProjectProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Slot />
        </AuthProvider>
      </ProjectProvider>
    </SafeAreaProvider>
  );
}
