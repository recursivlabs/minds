import * as React from 'react';
import { View, ScrollView, Pressable, Platform, TextInput, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Card, Button, Divider, PostCard, Skeleton } from '../../components';
import { AgentCard } from '../../components/AgentCard';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { useMyProfile, usePosts, useCommunities, useAgents } from '../../lib/hooks';
import { ORG_ID } from '../../lib/recursiv';
import { colors, spacing, radius, typography } from '../../constants/theme';

type ProfileTab = 'posts' | 'communities' | 'agents';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk, user, signOut } = useAuth();
  const { profile, loading: profileLoading, refresh: refreshProfile } = useMyProfile();
  const { posts, loading: postsLoading } = usePosts('latest', 50);
  const { communities, loading: commLoading } = useCommunities(50);
  const { agents, loading: agentsLoading } = useAgents(50);
  const [activeTab, setActiveTab] = React.useState<ProfileTab>('posts');
  const [showSettings, setShowSettings] = React.useState(false);
  const [showEditProfile, setShowEditProfile] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editBio, setEditBio] = React.useState('');
  const [editSaving, setEditSaving] = React.useState(false);

  const displayProfile = profile || user;
  const myPosts = posts.filter(
    (p: any) => (p.author?.id || p.userId || p.user_id) === user?.id
  );

  const followerCount = profile?.followerCount || profile?.follower_count || 0;
  const followingCount = profile?.followingCount || profile?.following_count || 0;

  const isWeb = Platform.OS === 'web';

  return (
    <Container safeTop padded={false}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <Text variant="bodyMedium" style={{ fontSize: 14 }}>Profile</Text>
        <Pressable onPress={() => setShowSettings(!showSettings)} hitSlop={8}>
          <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile info — left aligned */}
        <View style={{ paddingTop: spacing['2xl'], paddingHorizontal: spacing.xl }}>
          {/* Avatar + Name row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <Avatar
              uri={displayProfile?.image}
              name={displayProfile?.name}
              size="xl"
            />
            <View style={{ flex: 1 }}>
              <Text variant="h2">
                {displayProfile?.name || 'User'}
              </Text>
              <Text variant="body" color={colors.textMuted} style={{ marginTop: 2 }}>
                @{displayProfile?.username || displayProfile?.email?.split('@')[0] || 'user'}
              </Text>
            </View>
          </View>

          {/* Bio */}
          {(displayProfile?.bio || profile?.bio) && (
            <Text
              variant="body"
              color={colors.textSecondary}
              style={{ marginTop: spacing.lg }}
            >
              {displayProfile?.bio || profile?.bio}
            </Text>
          )}

          {/* Stats row */}
          <View
            style={{
              flexDirection: 'row',
              gap: spacing['2xl'],
              marginTop: spacing.xl,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{followerCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Followers</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{followingCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Following</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{myPosts.length}</Text>
              <Text variant="caption" color={colors.textMuted}>Posts</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
            <Button
              onPress={() => {
                setEditName(displayProfile?.name || '');
                setEditBio(displayProfile?.bio || profile?.bio || '');
                setShowEditProfile(true);
              }}
              variant="secondary"
              size={isWeb ? 'sm' : 'md'}
            >
              Edit Profile
            </Button>
            <Button
              onPress={() => setShowSettings(true)}
              variant="secondary"
              size={isWeb ? 'sm' : 'md'}
            >
              Settings
            </Button>
          </View>

          {/* Admin link — visible to admins */}
          <Pressable
            onPress={() => router.push('/(tabs)/admin')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              marginTop: spacing.lg,
            }}
          >
            <Ionicons name="shield-outline" size={16} color={colors.accent} />
            <Text variant="label" color={colors.accent}>Admin</Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={{ marginTop: spacing.xl }}>
          <Divider />
        </View>

        {/* Content tabs */}
        <View
          style={{
            flexDirection: 'row',
            borderBottomWidth: 0.5,
            borderBottomColor: 'rgba(255,255,255,0.06)',
          }}
        >
          {(['posts', 'communities', 'agents'] as ProfileTab[]).map(tab => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                alignItems: 'center',
                borderBottomWidth: 2,
                borderBottomColor: activeTab === tab ? colors.accent : 'transparent',
              }}
            >
              <Text
                variant="bodyMedium"
                color={activeTab === tab ? colors.text : colors.textMuted}
                style={{ fontSize: 14, textTransform: 'capitalize' }}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'posts' && (
          postsLoading ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>
              {[1, 2, 3].map(i => (
                <View key={i} style={{ gap: spacing.sm }}>
                  <Skeleton height={14} width={160} />
                  <Skeleton height={50} />
                </View>
              ))}
            </View>
          ) : myPosts.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.md }}>
              <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
              <Text variant="body" color={colors.textMuted} align="center">
                You haven't posted yet
              </Text>
              <Button onPress={() => router.push('/(tabs)/create')} size="sm">
                Create a post
              </Button>
            </View>
          ) : (
            myPosts.map((post: any) => (
              <PostCard key={post.id} post={post} compact />
            ))
          )
        )}

        {activeTab === 'communities' && (
          commLoading ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>
              {[1, 2, 3].map(i => (
                <Skeleton key={i} height={60} />
              ))}
            </View>
          ) : communities.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
              <Ionicons name="people-outline" size={32} color={colors.textMuted} />
              <Text variant="body" color={colors.textMuted} align="center">
                You haven't joined any communities yet
              </Text>
              <Button onPress={() => router.push('/(tabs)/discover')} size="sm">
                Explore communities
              </Button>
            </View>
          ) : (
            communities.map((c: any) => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/(tabs)/community/${c.id}`)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.lg,
                  backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                  borderBottomWidth: 0.5,
                  borderBottomColor: 'rgba(255,255,255,0.06)',
                })}
              >
                <Avatar uri={c.image || c.avatar} name={c.name} size="md" />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{c.name}</Text>
                  <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                    {c.memberCount || c.member_count || 0} members
                  </Text>
                </View>
              </Pressable>
            ))
          )
        )}

        {activeTab === 'agents' && (
          agentsLoading ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>
              {[1, 2, 3].map(i => (
                <Skeleton key={i} height={100} />
              ))}
            </View>
          ) : agents.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
              <Ionicons name="sparkles-outline" size={32} color={colors.textMuted} />
              <Text variant="body" color={colors.textMuted} align="center">
                Create an AI agent to automate tasks
              </Text>
              <Button onPress={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'agents' } })} size="sm">
                Learn more
              </Button>
            </View>
          ) : (
            <View style={{ padding: spacing.xl, gap: spacing.md }}>
              {agents.map((agent: any) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onChat={() => router.push({ pathname: '/(tabs)/chat', params: { agent: agent.id } })}
                />
              ))}
            </View>
          )
        )}

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} transparent animationType="fade" onRequestClose={() => setShowEditProfile(false)}>
        <Pressable
          onPress={() => setShowEditProfile(false)}
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.xl,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing['2xl'],
              width: '100%',
              maxWidth: 400,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text variant="h3" style={{ marginBottom: spacing.xl }}>Edit Profile</Text>

            <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>Name</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.bg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: 10,
                color: colors.text,
                ...typography.body,
                marginBottom: spacing.lg,
                ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
              }}
            />

            <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>Bio</Text>
            <TextInput
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Tell people about yourself"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: colors.bg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: 10,
                color: colors.text,
                minHeight: 80,
                textAlignVertical: 'top',
                ...typography.body,
                marginBottom: spacing.xl,
                ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
              }}
            />

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Button onPress={() => setShowEditProfile(false)} variant="secondary" fullWidth>
                  Cancel
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  loading={editSaving}
                  onPress={async () => {
                    if (!sdk) return;
                    setEditSaving(true);
                    try {
                      await sdk.profiles.update({ name: editName.trim(), bio: editBio.trim() });
                      await refreshProfile();
                      setShowEditProfile(false);
                    } catch {
                      const msg = 'Failed to update profile. Please try again.';
                      if (Platform.OS === 'web') alert(msg);
                      else Alert.alert('Error', msg);
                    } finally {
                      setEditSaving(false);
                    }
                  }}
                  fullWidth
                >
                  Save
                </Button>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Settings overlay */}
      {showSettings && (
        <Pressable
          onPress={() => setShowSettings(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.overlay,
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing['2xl'],
              paddingBottom: insets.bottom + spacing['2xl'],
              maxWidth: 600,
              alignSelf: 'center',
              width: '100%',
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.surfaceHover,
                alignSelf: 'center',
                marginBottom: spacing.xl,
              }}
            />
            <Text variant="h3" style={{ marginBottom: spacing.xl }}>Settings</Text>

            <Pressable
              onPress={() => {
                setShowSettings(false);
                setEditName(displayProfile?.name || '');
                setEditBio(displayProfile?.bio || profile?.bio || '');
                setShowEditProfile(true);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.lg,
              }}
            >
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
              <Text variant="body">Edit Profile</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(tabs)/wallet')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.lg,
              }}
            >
              <Ionicons name="diamond-outline" size={20} color={colors.textSecondary} />
              <Text variant="body">Wallet</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                const msg = 'Notification settings coming soon';
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Coming Soon', msg);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.lg,
              }}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
              <Text variant="body">Notifications</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                const msg = 'Privacy settings coming soon';
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Coming Soon', msg);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.lg,
              }}
            >
              <Ionicons name="shield-outline" size={20} color={colors.textSecondary} />
              <Text variant="body">Privacy</Text>
            </Pressable>

            <Divider />

            <Pressable
              onPress={async () => {
                await signOut();
                setShowSettings(false);
                router.replace('/');
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.lg,
              }}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text variant="body" color={colors.error}>Sign Out</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}
    </Container>
  );
}
