import * as React from 'react';
import { View, Platform } from 'react-native';
import { Text } from './Text';
import { parseMarkdownSegments, renderMarkdownToHtml } from '../lib/markdown';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';

interface Props {
  message: any;
  isOwn: boolean;
  // When true and this is the agent's message, render Claude-style: full-width
  // plain text, no bubble. User messages stay in a bubble. For human DMs leave
  // this false and both sides render as iMessage bubbles.
  agentChat?: boolean;
}

export const ChatBubble = React.memo(function ChatBubble({ message, isOwn, agentChat }: Props) {
  const colors = useColors();
  const content = message.content || message.text || message.body || '';
  const timestamp = message.createdAt || message.created_at || '';
  const hasMarkdown = /[*`#\[\]]/.test(content);
  // Streaming bubbles show a caret + skip the trailing timestamp so the
  // bubble doesn't bounce-resize as new chunks land. Once `streaming`
  // goes false the timestamp + final layout render normally.
  const isStreaming = message.streaming === true;
  // Claude-style document layout for the agent's side of an agent chat.
  const isDocument = agentChat === true && !isOwn;

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const textColor = isDocument ? colors.text : isOwn ? colors.textOnAccent : colors.text;
  const linkColor = isDocument ? colors.accent : isOwn ? colors.textOnAccent : colors.accent;

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

  // Claude-style: the agent's reply is full-width plain text (no bubble), with
  // a blinking caret while streaming. Reads like a document, not a chat bubble.
  if (isDocument) {
    const awaitingFirstToken = isStreaming && !content.trim();
    return (
      <View style={{ alignSelf: 'stretch', width: '100%', marginBottom: spacing.lg }}>
        {awaitingFirstToken ? (
          // Before the first token lands, the response slot shows a typing
          // indicator in place — which then becomes the streamed text. One
          // indicator, in the right spot, exactly like Claude/OpenAI.
          <TypingDots color={colors.textMuted} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <View style={{ flexShrink: 1 }}>{renderContent()}</View>
            {isStreaming ? <StreamingCaret color={textColor} /> : null}
          </View>
        )}
      </View>
    );
  }

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

// Three-dot typing indicator shown in the response slot before the first
// token. Staggered pulse on web; a single shared Animated loop on native.
function TypingDots({ color }: { color: string }) {
  if (Platform.OS === 'web') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs }}>
        <style>{`@keyframes mindsTypingBounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.35; } 40% { transform: translateY(-3px); opacity: 1; } }`}</style>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: color,
              animationName: 'mindsTypingBounce',
              animationDuration: '1100ms',
              animationIterationCount: 'infinite',
              animationDelay: `${i * 160}ms`,
            } as any}
          />
        ))}
      </View>
    );
  }
  return <NativeTypingDots color={color} />;
}

function NativeTypingDots({ color }: { color: string }) {
  const { Animated } = require('react-native');
  const dots = [React.useRef(new Animated.Value(0.35)).current, React.useRef(new Animated.Value(0.35)).current, React.useRef(new Animated.Value(0.35)).current];
  React.useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.35, duration: 350, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs }}>
      {dots.map((v, i) => (
        <Animated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: v }} />
      ))}
    </View>
  );
}

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
