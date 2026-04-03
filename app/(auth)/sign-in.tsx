import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { Text, Input, Button } from '../../components';
import { colors, spacing } from '../../constants/theme';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSignIn = async () => {
    if (!identifier.trim() || !password.trim()) {
      setError('All fields are required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const email = identifier.includes('@') ? identifier.trim().toLowerCase() : `${identifier.trim().toLowerCase()}@minds.com`;
      await signIn(email, password);
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
        style={{ marginBottom: spacing['3xl'], letterSpacing: 4, fontWeight: '300' }}
      >
        minds
      </Text>

      <Input
        label="Email or username"
        placeholder="you@example.com or username"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
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
