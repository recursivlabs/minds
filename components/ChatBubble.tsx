import * as React from 'react';
import { View, Platform } from 'react-native';
import { Text } from './Text';
import { parseMarkdownSegments, renderMarkdownToHtml } from '../lib/markdown';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';

interface Props {
  message: any;
  isOwn: boolean;
}

export const ChatBubble = React.memo(function ChatBubble({ message, isOwn }: Props) {
  const colors = useColors();
  const content = message.content || message.text || message.body || '';
  const timestamp = message.createdAt || message.created_at || '';
  const hasMarkdown = /[*`#\[\]]/.test(content);
  // Streaming bubbles show a caret + skip the trailing timestamp so the
  // bubble doesn't bounce-resize as new chunks land. Once `streaming`
  // goes false the timestamp + final layout render normally.
  const isStreaming = message.streaming === true;

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const textColor = isOwn ? colors.textOnAccent : colors.text;
  const linkColor = isOwn ? colors.textOnAccent : colors.accent;

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
          style={{ color: textColor, fontSize: 15, lineHeight: '22px', fontFamily: 'Roboto-Regular', wordBreak: 'break-word' as any }}
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
          if (seg.type === 'code') return <Text key={i} variant="mono" color={colors.textSecondary} style={{ backgroundColor: colors.surfaceRaised, paddingHorizontal: 4, borderRadius: radius.sm }}>{seg.text}</Text>;
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
          flexDirection: 'row',
          alignItems: 'flex-end',
        }}
      >
        <View style={{ flexShrink: 1 }}>{renderContent()}</View>
        {isStreaming ? <StreamingCaret color={textColor} /> : null}
      </View>
      {!isStreaming && formattedTime ? (
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

// Blinking block caret rendered at the end of a streaming bubble.
// Plain CSS @keyframes on web; alpha fade via Animated on native.
function StreamingCaret({ color }: { color: string }) {
  if (Platform.OS === 'web') {
    return (
      <>
        <style>{`@keyframes mindsCaretBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }`}</style>
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 16,
            marginLeft: 4,
            marginBottom: 2,
            backgroundColor: color,
            animationName: 'mindsCaretBlink',
            animationDuration: '900ms',
            animationIterationCount: 'infinite',
            verticalAlign: 'middle',
          } as any}
        />
      </>
    );
  }
  return <NativeBlinkCaret color={color} />;
}

function NativeBlinkCaret({ color }: { color: string }) {
  const { Animated } = require('react-native');
  const opacity = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: 450, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={{
        width: 7,
        height: 16,
        marginLeft: 4,
        marginBottom: 2,
        backgroundColor: color,
        opacity,
      }}
    />
  );
}
