import * as React from 'react';
import { View, FlatList, TextInput, Platform, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, CommunityCard, AgentCard, Card, Button, Skeleton, UserCard } from '../../components';
import { Container } from '../../components/Container';
import { useCommunities, useAgents, useProfiles } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius, typography } from '../../constants/theme';

type DiscoverTab = 'communities' | 'agents' | 'apps' | 'people';

const TABS: { key: DiscoverTab; label: string; icon: string }[] = [
  { key: 'communities', label: 'Communities', icon: 'people-outline' },
  { key: 'agents', label: 'Agents', icon: 'sparkles-outline' },
  { key: 'apps', label: 'Apps', icon: 'apps-outline' },
  { key: 'people', label: 'People', icon: 'person-outline' },
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
    try {
      await sdk.profiles.follow(userId);
    } catch {}
  };

  const filterByQuery = (items: any[], fields: string[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) =>
      fields.some((f) => (item[f] || '').toLowerCase().includes(q))
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'communities': {
        const filtered = filterByQuery(communities, ['name', 'description']);
        return commLoading ? (
          <View style={{ padding: spacing.xl, gap: spacing.md }}>
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} height={70} borderRadius={14} />
            ))}
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={{ paddingHorizontal: spacing.xl }}>
                <CommunityCard community={item} variant="row" />
              </View>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', padding: spacing['4xl'] }}>
                <Ionicons name="people-outline" size={40} color={colors.textMuted} />
                <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
                  {searchQuery ? 'No communities match your search' : 'No communities yet'}
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        );
      }

      case 'agents': {
        const filtered = filterByQuery(agents, ['name', 'description']);
        return agentsLoading ? (
          <View style={{ padding: spacing.xl, gap: spacing.md }}>
            {[1, 2, 3].map(i => (
              <Skeleton key={i} height={100} borderRadius={14} />
            ))}
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>
                <AgentCard
                  agent={item}
                  onChat={() => console.log('Chat with agent:', item.id)}
                />
              </View>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', padding: spacing['4xl'] }}>
                <Ionicons name="sparkles-outline" size={40} color={colors.textMuted} />
                <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
                  {searchQuery ? 'No agents match your search' : 'No agents available yet'}
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        );
      }

      case 'apps':
        return (
          <View style={{ alignItems: 'center', padding: spacing['4xl'] }}>
            <Ionicons name="apps-outline" size={56} color={colors.textMuted} />
            <Text variant="h3" color={colors.textMuted} style={{ marginTop: spacing.xl }}>
              No apps yet
            </Text>
            <Text
              variant="body"
              color={colors.textMuted}
              align="center"
              style={{ marginTop: spacing.sm, maxWidth: 280 }}
            >
              Build apps on the Minds platform and they will show up here.
            </Text>
            <View style={{ marginTop: spacing.xl }}>
              <Button onPress={() => {}} size="md">
                Build Your First App
              </Button>
            </View>
          </View>
        );

      case 'people': {
        const filtered = filterByQuery(profiles, ['name', 'username', 'bio']);
        return profilesLoading ? (
          <View style={{ padding: spacing.xl, gap: spacing.md }}>
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
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={{ paddingHorizontal: spacing.sm }}>
                <UserCard user={item} onFollow={handleFollow} />
              </View>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', padding: spacing['4xl'] }}>
                <Ionicons name="person-outline" size={40} color={colors.textMuted} />
                <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
                  {searchQuery ? 'No people match your search' : 'No people to discover yet'}
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        );
      }
    }
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
          borderBottomColor: colors.borderSubtle,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h2" style={{ flex: 1 }}>Discover</Text>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.lg,
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
          paddingHorizontal: spacing.lg,
          gap: spacing.xs,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.borderSubtle,
          paddingBottom: spacing.sm,
        }}
      >
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => { setActiveTab(tab.key); setSearchQuery(''); }}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.key ? colors.accent : 'transparent',
            }}
          >
            <Text
              variant="label"
              color={activeTab === tab.key ? colors.accent : colors.textMuted}
              style={{ fontSize: 12 }}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {renderTabContent()}
      </View>
    </Container>
  );
}
