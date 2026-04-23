import * as React from 'react';
import { View, Pressable, Platform, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { BASE_URL } from '../lib/recursiv';
import { colors, spacing, radius } from '../constants/theme';

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  if (!match) return null;
  // Strip common trailing punctuation that shouldn't be part of the URL.
  let url = match[0];
  const trailers = ['.', ',', ';', ':', '!', '?', ')', ']'];
  while (url.length > 0 && trailers.includes(url[url.length - 1])) {
    url = url.slice(0, -1);
  }
  return url;
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
 * X-style rich link preview.
 *
 * With an OG image: renders a hero card — big image at top (1.91:1 aspect,
 * matching the OG standard), a small domain pill overlaid on the bottom-left
 * of the image, then a clean title/description block below.
 *
 * Without an image: renders a compact horizontal card — a tiny favicon tile
 * on the left, domain + title on the right. No fixed heights, no borders
 * competing with the post itself.
 *
 * Renders nothing on null / 404 previews so a post with a bare URL doesn't
 * get a useless pill at the bottom.
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

  // Still loading — render nothing so the card pops in cleanly once metadata
  // is ready. (Avoids the flash of a loading pill.)
  if (!loaded) return null;

  // Hero card: big image, domain pill overlaid on bottom-left, text beneath.
  if (image) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed, hovered }: any) => ({
          marginTop: spacing.md,
          backgroundColor: pressed ? colors.surfaceHover : colors.surface,
          borderRadius: radius.xl,
          borderWidth: 0.5,
          borderColor: colors.borderSubtle,
          overflow: 'hidden',
          ...(Platform.OS === 'web'
            ? {
                transition: 'border-color 0.15s ease, background-color 0.15s ease',
                borderColor: hovered ? colors.border : colors.borderSubtle,
                cursor: 'pointer',
              } as any
            : {}),
        })}
      >
        <View style={{ position: 'relative', width: '100%' }}>
          <Image
            source={{ uri: image }}
            style={{
              width: '100%',
              aspectRatio: 1.91,
              backgroundColor: colors.surfaceRaised,
            }}
            resizeMode="cover"
          />
          {/* Domain pill overlaid on the image */}
          <View
            style={{
              position: 'absolute',
              left: spacing.md,
              bottom: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
              backgroundColor: 'rgba(0,0,0,0.65)',
              borderRadius: radius.sm,
              ...(Platform.OS === 'web' ? { backdropFilter: 'blur(6px)' } as any : {}),
            }}
          >
            {favicon ? (
              <Image source={{ uri: favicon }} style={{ width: 12, height: 12, borderRadius: 2 }} />
            ) : (
              <Ionicons name="link" size={11} color="#fff" />
            )}
            <Text variant="caption" color="#fff" numberOfLines={1} style={{ fontSize: 11 }}>
              {preview?.siteName || domain}
            </Text>
          </View>
        </View>
        <View style={{ padding: spacing.lg, gap: 2 }}>
          {title ? (
            <Text variant="bodyMedium" color={colors.text} numberOfLines={2} style={{ lineHeight: 21 }}>
              {title}
            </Text>
          ) : null}
          {description ? (
            <Text variant="caption" color={colors.textMuted} numberOfLines={2} style={{ marginTop: 4 }}>
              {description}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  // No image — compact horizontal card. Favicon tile on the left, text on
  // the right. Keeps bare-URL posts looking intentional instead of empty.
  if (title || description) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed, hovered }: any) => ({
          flexDirection: 'row',
          gap: spacing.md,
          marginTop: spacing.md,
          backgroundColor: pressed ? colors.surfaceHover : colors.surface,
          borderRadius: radius.lg,
          borderWidth: 0.5,
          borderColor: colors.borderSubtle,
          overflow: 'hidden',
          ...(Platform.OS === 'web'
            ? {
                transition: 'border-color 0.15s ease',
                borderColor: hovered ? colors.border : colors.borderSubtle,
                cursor: 'pointer',
              } as any
            : {}),
        })}
      >
        <View
          style={{
            width: 72,
            alignSelf: 'stretch',
            backgroundColor: colors.surfaceRaised,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {favicon ? (
            <Image source={{ uri: favicon }} style={{ width: 24, height: 24, borderRadius: 4 }} />
          ) : (
            <Ionicons name="link" size={20} color={colors.textMuted} />
          )}
        </View>
        <View style={{ flex: 1, paddingVertical: spacing.md, paddingRight: spacing.md, gap: 2 }}>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 11 }}>
            {preview?.siteName || domain}
          </Text>
          {title ? (
            <Text variant="bodyMedium" color={colors.text} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {description ? (
            <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
              {description}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  // No OG data at all — server couldn't fetch or page has no metadata.
  // Render nothing; the URL is already clickable inline in the post body.
  return null;
});
