import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components';
import { Container } from '../../components/Container';
import { colors, spacing } from '../../constants/theme';

export default function WalletScreen() {
  return (
    <Container safeTop centered>
      <View style={{ alignItems: 'center', gap: spacing['2xl'], padding: spacing['3xl'] }}>
        <Ionicons name="flash" size={40} color={colors.accent} />

        <Text variant="h2" color={colors.text} align="center">
          MINDS Tokens
        </Text>

        <Text
          variant="body"
          color={colors.textSecondary}
          align="center"
          style={{ maxWidth: 300, lineHeight: 24 }}
        >
          A new token economy is coming to Minds.{'\n'}
          Earn, spend, and support the creators you believe in.
        </Text>

        <Text variant="caption" color={colors.textMuted}>
          Stay tuned for updates
        </Text>
      </View>
    </Container>
  );
}
