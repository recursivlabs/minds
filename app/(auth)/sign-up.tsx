import * as React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { Text, Input, Button } from '../../components';
import { colors, spacing } from '../../constants/theme';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSignUp = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
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
      await signUp(fullName.trim(), email.trim().toLowerCase(), password);
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
        style={{ marginBottom: spacing['3xl'], letterSpacing: -1, fontWeight: '700' }}
      >
        minds
      </Text>

      <Text variant="h1" style={{ marginBottom: spacing.xs }}>
        Join Minds
      </Text>
      <Text variant="body" color={colors.textMuted} style={{ marginBottom: spacing['3xl'] }}>
        Create your account and start sharing
      </Text>

      <Input
        label="Name"
        placeholder="Your name"
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        autoComplete="name"
      />
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
        placeholder="Create a password (8+ characters)"
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
        Create account
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
