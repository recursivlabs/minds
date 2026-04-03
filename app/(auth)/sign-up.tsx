import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { Text, Input, Button } from '../../components';
import { colors, spacing } from '../../constants/theme';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSignUp = async () => {
    if (!username.trim() || !password.trim()) {
      setError('All fields are required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const email = username.includes('@') ? username.trim().toLowerCase() : `${username.trim().toLowerCase()}@minds.com`;
      await signUp(username.trim(), email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Sign up failed. Please try again.');
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
        label="Username"
        placeholder="Choose a username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoComplete="username"
      />
      <Input
        label="Password"
        placeholder="8+ characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        error={error}
      />

      <View style={{ height: spacing.sm }} />

      <Button
        onPress={handleSignUp}
        loading={loading}
        size="lg"
        fullWidth
      >
        Sign up
      </Button>

      <View style={{ height: spacing.xl }} />

      <Button
        onPress={() => router.push('/(auth)/sign-in')}
        variant="ghost"
        size="sm"
      >
        Already have an account? Sign in
      </Button>
    </View>
  );
}
