import * as React from 'react';
import { View, Platform } from 'react-native';
import { Text } from './Text';
import { parseMarkdownSegments, renderMarkdownToHtml } from '../lib/markdown';
import { colors, spacing, radius } from '../constants/theme';

interface Props {
  message: any;
  isOwn: boolean;
}

export const ChatBubble = React.memo(function ChatBubble({ message, isOwn }: Props) {
  const content = message.content || message.text || message.body || '';
  const timestamp = message.createdAt || message.created_at || '';
  const hasMarkdown = /[*`#\[\]]/.test(content);

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const textColor = isOwn ? '#fff' : colors.text;
  const linkColor = isOwn ? '#ffffffcc' : colors.accent;

  const renderContent = () => {
    if (!hasMarkdown) {
      return <Text variant="body" color={textColor}>{content}</Text>;
    }

    // Web: render as HTML for full markdown support
    if (Platform.OS === 'web') {
      const html = renderMarkdownToHtml(content)
        .replace(/color:#d4a844/g, `color:${linkColor}`)
        .replace(/color:#a0a0a8/g, `color:${isOwn ? '#ffffffaa' : '#a0a0a8'}`);
      return (
        <div
          style={{ color: textColor, fontSize: 15, lineHeight: '22px', fontFamily: 'Geist-Regular', wordBreak: 'break-word' as any }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    // Native: use segment parser
    const segments = parseMarkdownSegments(content);
    return (
      <Text variant="body" color={textColor}>
        {segments.map((seg, i) => {
          if (seg.type === 'bold') return <Text key={i} variant="bodyMedium" color={textColor}>{seg.text}</Text>;
          if (seg.type === 'italic') return <Text key={i} variant="body" color={textColor} style={{ fontStyle: 'italic' }}>{seg.text}</Text>;
          if (seg.type === 'code') return <Text key={i} variant="mono" color={colors.textSecondary} style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 4, borderRadius: 3 }}>{seg.text}</Text>;
          if (seg.type === 'break') return <Text key={i}>{'\n'}</Text>;
          return <Text key={i}>{seg.text}</Text>;
        })}
      </Text>
    );
  };

  return (
    <View
      style={{
        alignSelf: isOwn ? 'flex-end' : 'flex-start',
        maxWidth: '80%',
        marginBottom: spacing.sm,
      }}
    >
      <View
        style={{
          backgroundColor: isOwn ? colors.accent : colors.surfaceRaised,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: radius.lg,
          borderBottomRightRadius: isOwn ? radius.sm : radius.lg,
          borderBottomLeftRadius: isOwn ? radius.lg : radius.sm,
        }}
      >
        {renderContent()}
      </View>
      {formattedTime ? (
        <Text
          variant="caption"
          color={colors.textMuted}
          style={{
            marginTop: spacing.xs,
            alignSelf: isOwn ? 'flex-end' : 'flex-start',
            fontSize: 11,
          }}
        >
          {formattedTime}
        </Text>
      ) : null}
    </View>
  );
});
