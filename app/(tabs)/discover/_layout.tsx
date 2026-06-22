import * as React from 'react';
import { View, TextInput, Platform, Pressable } from 'react-native';
import { Slot, useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../../components';
import { Container } from '../../../components/Container';
import { spacing, radius, typography } from '../../../constants/theme';
import { useColors } from '../../../lib/theme';
import { DISCOVER_TABS } from '../../../lib/discover';

// ──────────────────────────────────────────────────────────────────────────
// Discover — X-style master search console. A shared header (back + search box)
// sits on top of a tab bar that switches between 4 entity sub-routes, each its
// own URL:
//   /discover              → redirects to /discover/posts (the default)
//   /discover/posts        → ALL posts, paginated, filterable + search
//   /discover/people       → people directory + search
//   /discover/communities  → community directory + search
//   /discover/agents       → agent directory + search
//
// "For You" lives on the main Feed now — Discover is a pure search/directory
// surface. The search box drives the ACTIVE tab. Typing writes ?q=… on the
// current route; each child reads it and searches its own entity. Keeping the
// query in the URL means deep-links (e.g. a #tag → /discover/posts?q=%23tag)
// just work.
// ──────────────────────────────────────────────────────────────────────────

// Map a pathname to the active sub-route key. The bare `/discover` redirects to
// posts, so it's the default highlight.
function activeKeyFromPath(pathname: string): string {
  const m = pathname.match(/\/discover\/?([a-z]*)/i);
  const seg = m?.[1] || '';
  if (seg === 'people' || seg === 'communities' || seg === 'agents') return seg;
  return 'posts';
}

// Build the href for a tab key.
function hrefForKey(key: string): string {
  return `/(tabs)/discover/${key}`;
}

function DiscoverTabBar({ active, onChange }: { active: string; onChange: (key: string) => void }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingHorizontal: spacing.xl,
        gap: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      {DISCOVER_TABS.map(({ key, label }) => {
        const isActive = key === active;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={({ pressed }) => ({
              paddingVertical: spacing.sm + 2,
              borderBottomWidth: 2,
              borderBottomColor: isActive ? colors.accent : 'transparent',
              opacity: pressed ? 0.8 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'border-color 0.15s ease' } as any : {}),
            })}
          >
            <Text
              variant={isActive ? 'bodyMedium' : 'body'}
              color={isActive ? colors.accent : colors.textMuted}
              style={{ fontSize: 15 }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function DiscoverLayout() {
  const router = useRouter();
  const colors = useColors();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ q?: string }>();
  const activeKey = activeKeyFromPath(pathname);

  // The search box mirrors the URL ?q so back/forward + deep-links stay in
  // sync, but holds local text for snappy typing. When the route or its query
  // changes underneath us (tab switch, deep-link), re-sync.
  const [searchQuery, setSearchQuery] = React.useState(params.q || '');
  React.useEffect(() => {
    setSearchQuery(typeof params.q === 'string' ? params.q : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q, activeKey]);

  // Debounce the URL write so every keystroke doesn't push a new history entry.
  React.useEffect(() => {
    const current = typeof params.q === 'string' ? params.q : '';
    if (searchQuery === current) return;
    const t = setTimeout(() => {
      router.setParams({ q: searchQuery || undefined } as any);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const onChangeTab = (key: string) => {
    // Carry the active query across tabs so a search "switches entity type"
    // rather than resetting — the layout Jack liked.
    const q = searchQuery.trim();
    router.replace({ pathname: hrefForKey(key), params: q ? { q } : {} } as any);
  };

  const placeholder =
    activeKey === 'people' ? 'Search people…'
    : activeKey === 'communities' ? 'Search communities…'
    : activeKey === 'agents' ? 'Search agents…'
    : 'Search posts…';

  return (
    <Container safeTop padded={false}>
      <View style={{ backgroundColor: colors.bg, zIndex: 1 }}>
        {/* Header row */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.md,
            paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
            borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
          }}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ flex: 1 }}>Discover</Text>
        </View>

        {/* Shared search box — drives the active tab */}
        <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
          <View
            style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: colors.surface, borderRadius: radius.full,
              borderWidth: 0.5, borderColor: colors.glassBorder,
              paddingHorizontal: spacing.md, gap: spacing.sm,
            }}
          >
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              placeholder={placeholder}
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                flex: 1, color: colors.text, ...typography.body, paddingVertical: 11,
                ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        <DiscoverTabBar active={activeKey} onChange={onChangeTab} />
      </View>

      <View style={{ flex: 1 }}>
        <Slot />
      </View>
    </Container>
  );
}
