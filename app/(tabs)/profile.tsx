import * as React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { Container } from '../../components/Container';
import { colors } from '../../constants/theme';

/**
 * /profile is kept only as a redirect to the unified /user/<username> page.
 * Everything — own-profile editing, settings, tabs, follow lists — now lives
 * there so there's one canonical profile URL per person.
 */
export default function ProfileRedirectScreen() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  React.useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/');
      return;
    }
    const slug = user.username || user.id;
    router.replace(`/(tabs)/user/${slug}` as any);
  }, [user, isLoading, router]);

  return (
    <Container safeTop padded={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    </Container>
  );
}
