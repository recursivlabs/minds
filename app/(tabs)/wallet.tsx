import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components';
import { Container } from '../../components/Container';
import { colors, spacing } from '../../constants/theme';

export default function WalletScreen() {
  return (
    <Container safeTop centered>
      <View style={{ alignItems: 'center', gap: spacing['2xl'], padding: spacing['3xl'] }}>
        <Ionicons name="diamond" size={40} color={colors.token} />

        <Text variant="hero" color={colors.token}>
          0 MINDS
        </Text>

        <Text
          variant="body"
          color={colors.textSecondary}
          align="center"
          style={{ maxWidth: 280, lineHeight: 24 }}
        >
          Token system launching soon.{'\n'}
          Earn tokens by creating content and engaging with the community.
        </Text>

        <Text variant="caption" color={colors.textMuted}>
          Learn more at minds.com
        </Text>
      </View>
    </Container>
  );
}
