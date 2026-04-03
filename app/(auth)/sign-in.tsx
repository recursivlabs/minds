import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { Text, Input, Button } from '../../components';
import { colors, spacing } from '../../constants/theme';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Sign in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ width: '100%' }}>
      <Text
        variant="h2"
        color={colors.accent}
        style={{ marginBottom: spacing['3xl'], letterSpacing: -1, fontWeight: '700' }}
      >
        minds
      </Text>

      <Text variant="h1" style={{ marginBottom: spacing.xs }}>
        Welcome back
      </Text>
      <Text variant="body" color={colors.textMuted} style={{ marginBottom: spacing['3xl'] }}>
        Sign in to your Minds account
      </Text>

      <Input
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Input
        label="Password"
        placeholder="Your password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        error={error}
      />

      <View style={{ height: spacing.sm }} />

      <Button
        onPress={handleSignIn}
        loading={loading}
        size="lg"
        fullWidth
      >
        Sign in
      </Button>

      <View style={{ height: spacing.xl }} />

      <Button
        onPress={() => router.push('/(auth)/sign-up')}
        variant="ghost"
        size="sm"
      >
        Don't have an account? Sign up
      </Button>
    </View>
  );
}
