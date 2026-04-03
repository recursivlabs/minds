import * as React from 'react';
import { View, Modal, Pressable, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Button } from './Button';
import { Input } from './Input';
import { Avatar } from './Avatar';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  recipientName: string;
  recipientAvatar?: string | null;
  onSend: (amount: number, message: string) => Promise<void>;
}

const PRESET_AMOUNTS = [1, 5, 10, 25];

export function TipModal({ visible, onClose, recipientName, recipientAvatar, onSend }: Props) {
  const [amount, setAmount] = React.useState('1');
  const [message, setMessage] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const handleSend = async () => {
    const msg = 'Tipping coming soon — this feature will use MINDS tokens';
    if (Platform.OS === 'web') {
      alert(msg);
    } else {
      Alert.alert('Coming Soon', msg);
    }
    setAmount('1');
    setMessage('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.xl,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: spacing['2xl'],
            width: '100%',
            maxWidth: 380,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
            <Avatar uri={recipientAvatar} name={recipientName} size="lg" />
            <Text variant="h3" style={{ marginTop: spacing.md }}>
              Tip {recipientName}
            </Text>
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
              Send MINDS tokens as a tip
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              gap: spacing.sm,
              marginBottom: spacing.lg,
              justifyContent: 'center',
            }}
          >
            {PRESET_AMOUNTS.map((preset) => (
              <Pressable
                key={preset}
                onPress={() => setAmount(String(preset))}
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: amount === String(preset) ? colors.accent : colors.surfaceHover,
                  borderWidth: 1,
                  borderColor: amount === String(preset) ? colors.accent : colors.border,
                }}
              >
                <Text
                  variant="bodyMedium"
                  color={amount === String(preset) ? '#fff' : colors.text}
                >
                  {preset}
                </Text>
              </Pressable>
            ))}
          </View>

          <Input
            label="Amount"
            placeholder="Enter amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

          <Input
            label="Message (optional)"
            placeholder="Add a note..."
            value={message}
            onChangeText={setMessage}
          />

          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button onPress={onClose} variant="secondary" fullWidth>
                Cancel
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                onPress={handleSend}
                loading={sending}
                disabled={!amount || parseFloat(amount) <= 0}
                fullWidth
              >
                Send Tip
              </Button>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
