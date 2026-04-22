import * as React from 'react';
import { View, Pressable, Platform, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { BASE_URL } from '../lib/recursiv';
import { colors, spacing, radius } from '../constants/theme';

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

interface Preview {
  url: string;
  domain: string;
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
  siteName: string | null;
}

// In-memory preview cache to avoid refetching the same URL across renders.
const previewCache = new Map<string, Preview | null>();
const inflight = new Map<string, Promise<Preview | null>>();

async function fetchPreview(url: string): Promise<Preview | null> {
  if (previewCache.has(url)) return previewCache.get(url) ?? null;
  const existing = inflight.get(url);
  if (existing) return existing;

  const p = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/link-preview?url=${encodeURIComponent(url)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) {
        previewCache.set(url, null);
        return null;
      }
      const body = await res.json();
      const data = (body?.data ?? null) as Preview | null;
      previewCache.set(url, data);
      return data;
    } catch {
      previewCache.set(url, null);
      return null;
    } finally {
      inflight.delete(url);
    }
  })();
  inflight.set(url, p);
  return p;
}

interface Props {
  /** Either raw post content (we'll extract the first URL) or a specific URL. */
  content?: string;
  url?: string;
}

/**
 * Extracts the first URL from post content (or accepts a url prop directly) and
 * renders a rich preview card with OG image, title, description, favicon, and
 * domain. Falls back to a simple domain pill if OG metadata is unavailable.
 */
export const LinkPreview = React.memo(function LinkPreview({ content, url: urlProp }: Props) {
  const url = urlProp ?? (content ? extractFirstUrl(content) : null);
  const [preview, setPreview] = React.useState<Preview | null>(
    url ? (previewCache.get(url) ?? null) : null,
  );
  const [loaded, setLoaded] = React.useState<boolean>(
    url ? previewCache.has(url) : false,
  );

  React.useEffect(() => {
    if (!url) return;
    let cancelled = false;
    if (previewCache.has(url)) {
      setPreview(previewCache.get(url) ?? null);
      setLoaded(true);
      return;
    }
    fetchPreview(url).then((data) => {
      if (!cancelled) {
        setPreview(data);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, [url]);

  if (!url) return null;

  const handlePress = (e?: any) => {
    e?.stopPropagation?.();
    if (Platform.OS === 'web') {
      (typeof window !== 'undefined' ? window : globalThis as any).open?.(url, '_blank', 'noopener');
    } else {
      Linking.openURL(url);
    }
  };

  const domain = preview?.domain ?? getDomain(url);
  const title = preview?.title;
  const description = preview?.description;
  const image = preview?.image;
  const favicon = preview?.favicon;

  // If we haven't loaded yet, or no OG data, fall back to a slim domain card
  // so the UI doesn't flash between two sizes.
  if (!loaded || (!title && !description && !image)) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          marginTop: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          backgroundColor: pressed ? colors.surfaceHover : colors.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
        })}
      >
        <Ionicons name="link-outline" size={16} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text variant="caption" color={colors.accent} numberOfLines={1}>{domain}</Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 11 }}>{url}</Text>
        </View>
        <Ionicons name="open-outline" size={14} color={colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => ({
        marginTop: spacing.md,
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        overflow: 'hidden',
      })}
    >
      {image ? (
        <Image
          source={{ uri: image }}
          style={{ width: '100%', height: 200, backgroundColor: colors.surfaceRaised }}
          resizeMode="cover"
        />
      ) : null}
      <View style={{ padding: spacing.lg, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {favicon ? (
            <Image source={{ uri: favicon }} style={{ width: 14, height: 14, borderRadius: 3 }} />
          ) : (
            <Ionicons name="link-outline" size={14} color={colors.textMuted} />
          )}
          <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
            {preview?.siteName || domain}
          </Text>
        </View>
        {title ? (
          <Text variant="bodyMedium" color={colors.text} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        {description ? (
          <Text variant="caption" color={colors.textMuted} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});
