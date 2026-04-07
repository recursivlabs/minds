import * as React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { colors, spacing } from '../constants/theme';

interface Props {
  score: number;
  userVote: 'upvote' | 'downvote' | null;
  onUpvote: () => void;
  onDownvote: () => void;
  compact?: boolean;
}

export const VoteButtons = React.memo(function VoteButtons({ score, userVote, onUpvote, onDownvote, compact = false }: Props) {
  const iconSize = compact ? 18 : 22;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: compact ? spacing.xs : spacing.sm,
      }}
    >
      <Pressable
        onPress={onUpvote}
        hitSlop={8}
        style={({ pressed }) => ({
          opacity: pressed ? 0.6 : 1,
          padding: 2,
        })}
      >
        <Ionicons
          name={userVote === 'upvote' ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
          size={iconSize}
          color={userVote === 'upvote' ? colors.accent : colors.textMuted}
        />
      </Pressable>

      <Text
        variant="bodyMedium"
        color={
          userVote === 'upvote'
            ? colors.accent
            : userVote === 'downvote'
              ? colors.error
              : colors.textSecondary
        }
        style={{ fontSize: compact ? 13 : 15, minWidth: 20, textAlign: 'center' }}
      >
        {score}
      </Text>

      <Pressable
        onPress={onDownvote}
        hitSlop={8}
        style={({ pressed }) => ({
          opacity: pressed ? 0.6 : 1,
          padding: 2,
        })}
      >
        <Ionicons
          name={userVote === 'downvote' ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
          size={iconSize}
          color={userVote === 'downvote' ? colors.error : colors.textMuted}
        />
      </Pressable>
    </View>
  );
});
