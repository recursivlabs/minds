/**
 * Article rendering — X-style long-form. Two modes from one component:
 *  - feed (default): a compact card — cover + title + excerpt + "N min read".
 *    Distinct from a text post so migrated blogs read as articles, not walls of text.
 *  - full: the reader — cover hero, large title, byline meta, rendered markdown body.
 *
 * An "article" is just a post with a title + markdown body (see isArticlePost);
 * the ~2.4M legacy blogs import as exactly that, so they light up here for free.
 */
import * as React from 'react';
import { View, Image, Pressable, Platform } from 'react-native';
import { Text } from './Text';
import { useColors } from '../lib/theme';
import { spacing, radius, typography } from '../constants/theme';
import { renderMarkdownToHtml, parseMarkdownSegments } from '../lib/markdown';
import { postTitle, articleExcerpt, coverImageUrl, readingTimeMinutes } from '../lib/models';

/** Renders a markdown body — rich HTML on web, inline-formatted paragraphs on native. */
function MarkdownBody({ content }: { content: string }) {
  const colors = useColors();
  if (Platform.OS === 'web') {
    const WebDiv = 'div' as any;
    return (
      <WebDiv
        // biome-ignore lint/security/noDangerouslySetInnerHtml: renderMarkdownToHtml escapes all user input before formatting.
        dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(content) }}
        style={{
          color: colors.text,
          fontSize: 17,
          lineHeight: '28px',
          wordBreak: 'break-word',
        }}
      />
    );
  }
  // Native: render each paragraph with inline (bold/italic/code/link) formatting.
  const paragraphs = content.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <View style={{ gap: spacing.md }}>
      {paragraphs.map((para, pi) => {
        const pKey = `p${pi}`;
        return (
          <Text key={pKey} variant="body" style={{ fontSize: 17, lineHeight: 28 }}>
            {parseMarkdownSegments(para).map((seg, i) => {
              const k = `${pKey}s${i}`;
              if (seg.type === 'bold') return <Text key={k} style={{ fontFamily: 'Roboto-Medium' }}>{seg.text}</Text>;
              if (seg.type === 'italic') return <Text key={k} style={{ fontStyle: 'italic' }}>{seg.text}</Text>;
              if (seg.type === 'code') return <Text key={k} variant="mono" color={colors.textSecondary}>{seg.text}</Text>;
              if (seg.type === 'link') return <Text key={k} color={colors.accent}>{seg.text}</Text>;
              if (seg.type === 'break') return <Text key={k}>{'\n'}</Text>;
              return <Text key={k}>{seg.text}</Text>;
            })}
          </Text>
        );
      })}
    </View>
  );
}

export function ArticleCard({ post, full = false, onPress }: { post: any; full?: boolean; onPress?: () => void }) {
  const colors = useColors();
  const title = postTitle(post);
  const cover = coverImageUrl(post);
  const readMin = readingTimeMinutes(post);

  if (full) {
    return (
      <View style={{ marginTop: spacing.md }}>
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg, marginBottom: spacing.lg }}
            resizeMode="cover"
          />
        ) : null}
        <Text style={{ ...typography.h1, color: colors.text }}>{title}</Text>
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
          {readMin} min read
        </Text>
        <MarkdownBody content={(post?.content ?? '').toString()} />
      </View>
    );
  }

  // Compact feed card.
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          marginTop: spacing.md,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        },
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null,
      ]}
    >
      {cover ? (
        <Image source={{ uri: cover }} style={{ width: '100%', aspectRatio: 16 / 9 }} resizeMode="cover" />
      ) : null}
      <View style={{ padding: spacing.md, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text variant="label" color={colors.accent}>
            ARTICLE
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            · {readMin} min read
          </Text>
        </View>
        <Text variant="h3" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="body" color={colors.textSecondary} numberOfLines={2}>
          {articleExcerpt(post)}
        </Text>
      </View>
    </Pressable>
  );
}
