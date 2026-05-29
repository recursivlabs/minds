import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components';
import { Container } from '../../components/Container';
import { spacing } from '../../constants/theme';
import { useColors } from '../../lib/theme';

export default function BoostScreen() {
  const colors = useColors();
  return (
    <Container safeTop centered>
      <View style={{ alignItems: 'center', gap: spacing['2xl'], padding: spacing['3xl'] }}>
        <Ionicons name="rocket" size={40} color={colors.boost} />

        <Text variant="h2" align="center">
          Boost
        </Text>

        <Text
          variant="body"
          color={colors.textSecondary}
          align="center"
          style={{ maxWidth: 280, lineHeight: 24 }}
        >
          Amplify your content to new audiences.{'\n'}
          Boost system launching soon with MINDS tokens.
        </Text>

        <Text variant="caption" color={colors.textMuted}>
          Learn more at minds.com
        </Text>
      </View>
    </Container>
  );
}
