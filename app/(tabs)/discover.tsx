import * as React from 'react';
import { View, FlatList, TextInput, Platform, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Avatar, Button, Skeleton } from '../../components';
import { Container } from '../../components/Container';
import { useCommunities, useAgents, useProfiles } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius, typography } from '../../constants/theme';

type DiscoverTab = 'communities' | 'agents' | 'people';

const TABS: { key: DiscoverTab; label: string }[] = [
  { key: 'communities', label: 'Communities' },
  { key: 'agents', label: 'Agents' },
  { key: 'people', label: 'People' },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { sdk } = useAuth();
  const [activeTab, setActiveTab] = React.useState<DiscoverTab>(
    (params.tab as DiscoverTab) || 'communities'
  );
  const [searchQuery, setSearchQuery] = React.useState('');

  const { communities, loading: commLoading } = useCommunities(50);
  const { agents, loading: agentsLoading } = useAgents(50);
  const { profiles, loading: profilesLoading } = useProfiles(50);

  const handleFollow = async (userId: string) => {
    if (!sdk) return;
    try { await sdk.profiles.follow(userId); } catch {}
  };

  const filterByQuery = (items: any[], fields: string[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) =>
      fields.some((f) => (item[f] || '').toLowerCase().includes(q))
    );
  };

  const getData = () => {
    switch (activeTab) {
      case 'communities':
        return { items: filterByQuery(communities, ['name', 'description']), loading: commLoading };
      case 'agents':
        return { items: filterByQuery(agents, ['name', 'description']), loading: agentsLoading };
      case 'people':
        return { items: filterByQuery(profiles, ['name', 'username']), loading: profilesLoading };
    }
  };

  const { items, loading } = getData();

  const renderItem = ({ item }: { item: any }) => {
    const name = item.name || 'Unknown';
    const avatar = item.image || item.avatar;
    const subtitle = activeTab === 'communities'
      ? `${item.memberCount || item.member_count || 0} members`
      : activeTab === 'agents'
        ? item.bio?.slice(0, 50) || 'AI Agent'
        : `@${item.username || ''}`;

    const onPress = () => {
      if (activeTab === 'communities') {
        router.push(`/(tabs)/community/${item.slug || item.id}` as any);
      } else if (activeTab === 'people') {
        router.push(`/(tabs)/user/${item.username || item.id}` as any);
      }
    };

    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        })}
      >
        <Avatar uri={avatar} name={name} size="md" />
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium">{name}</Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{subtitle}</Text>
        </View>
        {activeTab === 'people' && (
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); handleFollow(item.id); }}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radius.full,
              backgroundColor: colors.accentMuted,
            }}
          >
            <Text variant="caption" color={colors.accent}>Follow</Text>
          </Pressable>
        )}
        {activeTab === 'communities' && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              router.push(`/(tabs)/community/${item.slug || item.id}` as any);
            }}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radius.full,
              backgroundColor: colors.accentMuted,
            }}
          >
            <Text variant="caption" color={colors.accent}>Join</Text>
          </Pressable>
        )}
      </Pressable>
    );
  };

  return (
    <Container safeTop padded={false}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h3" style={{ flex: 1 }}>
          {TABS.find(t => t.key === activeTab)?.label || 'Discover'}
        </Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
          }}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder={`Search ${activeTab}...`}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1,
              color: colors.text,
              ...typography.body,
              paddingVertical: 10,
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

      {/* Tabs */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: spacing.xl,
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => { setActiveTab(tab.key); setSearchQuery(''); }}
            style={{
              flex: 1,
              paddingVertical: spacing.md,
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.key ? colors.accent : 'transparent',
            }}
          >
            <Text
              variant="label"
              color={activeTab === tab.key ? colors.accent : colors.textMuted}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <Skeleton width={40} height={40} borderRadius={20} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Skeleton width={140} height={14} />
                <Skeleton width={100} height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>
                {searchQuery ? 'No results found' : 'Nothing here yet'}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </Container>
  );
}
