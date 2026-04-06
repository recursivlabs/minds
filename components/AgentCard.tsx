import { View, Pressable, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  agent: any;
  onChat?: () => void;
}

export function AgentCard({ agent, onChat }: Props) {
  const router = useRouter();
  const { sdk } = useAuth();
  const name = agent.name || 'AI Agent';
  const description = agent.description || agent.systemPrompt || '';
  const model = agent.model || agent.modelId || 'AI';
  const avatar = agent.image || agent.avatar || null;

  const modelLabel = model.includes('claude') ? 'Claude'
    : model.includes('gpt') ? 'GPT'
    : model.includes('gemini') ? 'Gemini'
    : 'AI';

  const handleChat = async () => {
    if (onChat) {
      onChat();
      return;
    }
    // Default: create DM with agent and navigate
    if (!sdk) return;
    try {
      const res = await sdk.chat.dm({ user_id: agent.id });
      if (res.data?.id) {
        router.push({ pathname: '/(tabs)/chat', params: { id: res.data.id } } as any);
      }
    } catch {
      const msg = 'Could not start chat with this agent. Please try again.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: radius.md,
        padding: spacing.lg,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.06)',
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar uri={avatar} name={name} size="md" />
        <View style={{ flex: 1 }}>
          <Text variant="body" numberOfLines={1} style={{ fontWeight: '400' }}>{name}</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              marginTop: spacing.xs,
            }}
          >
            <View
              style={{
                backgroundColor: colors.accentHover + '20',
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: radius.full,
              }}
            >
              <Text variant="caption" color={colors.accent} style={{ fontSize: 11 }}>
                {modelLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {description ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={2}>
          {description}
        </Text>
      ) : null}

      <Pressable
        onPress={handleChat}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          backgroundColor: pressed ? colors.accentHover : colors.accent,
          paddingVertical: spacing.sm,
          borderRadius: radius.md,
          marginTop: spacing.xs,
        })}
      >
        <Ionicons name="chatbubble" size={16} color="#fff" />
        <Text variant="bodyMedium" color="#fff" style={{ fontSize: 14 }}>
          Chat
        </Text>
      </Pressable>
    </View>
  );
}
