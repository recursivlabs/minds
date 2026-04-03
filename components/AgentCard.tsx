import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  agent: any;
  onChat?: () => void;
}

export function AgentCard({ agent, onChat }: Props) {
  const name = agent.name || 'AI Agent';
  const description = agent.description || agent.systemPrompt || '';
  const model = agent.model || agent.modelId || 'AI';
  const avatar = agent.image || agent.avatar || null;

  const modelLabel = model.includes('claude') ? 'Claude'
    : model.includes('gpt') ? 'GPT'
    : model.includes('gemini') ? 'Gemini'
    : 'AI';

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar uri={avatar} name={name} size="md" />
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
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

      {onChat && (
        <Pressable
          onPress={onChat}
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
      )}
    </View>
  );
}
