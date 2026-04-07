import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components';
import { Container } from '../../components/Container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, spacing } from '../../constants/theme';

export default function WalletScreen() {
  return (
    <Container safeTop padded={false}>
      <ScreenHeader title="Wallet" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
        <Ionicons name="wallet-outline" size={40} color={colors.accent} />
        <Text variant="h2" color={colors.text} align="center">Wallet</Text>
        <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 300, lineHeight: 24 }}>
          A new token economy is coming to Minds.{'\n'}
          Earn, spend, and support the creators you believe in.
        </Text>
        <Text variant="caption" color={colors.textMuted}>Stay tuned for updates</Text>
      </View>
    </Container>
  );
}
