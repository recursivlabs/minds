import * as React from 'react';
import { View, ScrollView, Pressable, Platform, TextInput, Alert, Modal, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
const getImagePicker = () => Platform.OS !== 'web' ? require('expo-image-picker') : null;
import { Text, Avatar, Button, Divider, PostCard, Skeleton } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { useMyProfile, usePosts, useCommunities, useAgents } from '../../lib/hooks';
import { colors, spacing, radius, typography } from '../../constants/theme';

function ProfileSection({ title, children, onSeeAll, onCreate, createLabel }: {
  title: string;
  children: React.ReactNode;
  onSeeAll?: () => void;
  onCreate?: () => void;
  createLabel?: string;
}) {
  return (
    <View style={{ paddingHorizontal: spacing.xl, marginTop: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text variant="bodyMedium" color={colors.textSecondary}>{title}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {onSeeAll && (
            <Pressable onPress={onSeeAll} hitSlop={8}>
              <Text variant="caption" color={colors.accent}>See all</Text>
            </Pressable>
          )}
          {onCreate && (
            <Pressable onPress={onCreate} hitSlop={8}>
              <Text variant="caption" color={colors.accent}>{createLabel || 'Create'}</Text>
            </Pressable>
          )}
        </View>
      </View>
      {children}
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { sdk, user, signOut } = useAuth();
  const { profile, loading: profileLoading, refresh: refreshProfile } = useMyProfile();
  const { posts, loading: postsLoading } = usePosts('latest', 50);
  const { communities, loading: commLoading } = useCommunities(50);
  const { agents, loading: agentsLoading } = useAgents(50);

  const [showEditProfile, setShowEditProfile] = React.useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editUsername, setEditUsername] = React.useState('');
  const [editBio, setEditBio] = React.useState('');
  const [editSaving, setEditSaving] = React.useState(false);
  const [editAvatarUri, setEditAvatarUri] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<'posts' | 'communities' | 'agents' | 'apps'>('posts');

  const handlePickEditAvatar = async () => {
    try {
      const picker = getImagePicker();
      if (picker) {
        const result = await picker.launchImageLibraryAsync({
          mediaTypes: picker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) setEditAvatarUri(result.assets[0].uri);
      } else if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) setEditAvatarUri(URL.createObjectURL(file));
        };
        input.click();
      }
    } catch {}
  };

  const displayProfile = profile || user;
  const myPosts = posts.filter(
    (p: any) => (p.author?.id || p.userId || p.user_id) === user?.id
  );

  const followerCount = profile?.followerCount || profile?.follower_count || 0;
  const followingCount = profile?.followingCount || profile?.following_count || 0;

  const TABS = [
    { key: 'posts' as const, label: 'Posts' },
    { key: 'communities' as const, label: 'Communities' },
    { key: 'agents' as const, label: 'Agents' },
    { key: 'apps' as const, label: 'Apps' },
  ];

  // Don't flash blank profile — use user from auth as fallback while profile loads
  // but never show a blank "User" with yellow ? avatar

  return (
    <Container safeTop padded={false}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile info */}
        <View style={{ paddingTop: spacing['3xl'], paddingHorizontal: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Avatar
              uri={displayProfile?.image}
              name={displayProfile?.name}
              size="xl"
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                onPress={() => {
                  setEditName(displayProfile?.name || '');
                  setEditUsername(displayProfile?.username || user?.username || '');
                  setEditBio(displayProfile?.bio || profile?.bio || '');
                  setEditAvatarUri(null);
                  setShowEditProfile(true);
                }}
                variant="secondary"
                size="sm"
              >
                Edit Profile
              </Button>
              <Pressable
                onPress={() => setShowSettingsMenu(!showSettingsMenu)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  borderWidth: 0.5,
                  borderColor: colors.glassBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                hitSlop={8}
              >
                <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Settings dropdown */}
          {showSettingsMenu && (
            <View
              style={{
                position: 'absolute',
                right: spacing.xl,
                top: spacing['3xl'] + 44,
                backgroundColor: colors.surfaceRaised,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.xs,
                zIndex: 9999,
                elevation: 999,
                minWidth: 160,
                ...(Platform.OS === 'web' ? { boxShadow: '0 4px 24px rgba(0,0,0,0.5)' } as any : {}),
              }}
            >
              <Pressable onPress={() => { setShowSettingsMenu(false); router.push('/(tabs)/settings'); }} style={{ padding: spacing.md }}>
                <Text variant="body">Settings</Text>
              </Pressable>
              <Pressable onPress={() => { setShowSettingsMenu(false); router.push('/(tabs)/billing'); }} style={{ padding: spacing.md }}>
                <Text variant="body">Billing</Text>
              </Pressable>
              <Pressable onPress={() => { setShowSettingsMenu(false); router.push('/(tabs)/invites'); }} style={{ padding: spacing.md }}>
                <Text variant="body">Invites</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  setShowSettingsMenu(false);
                  await signOut();
                  router.replace('/');
                }}
                style={{ padding: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }}
              >
                <Text variant="body" color={colors.error}>Sign Out</Text>
              </Pressable>
            </View>
          )}

          <Text variant="h2" style={{ marginTop: spacing.lg }}>
            {displayProfile?.name || 'User'}
          </Text>
          <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
            @{displayProfile?.username || displayProfile?.email?.split('@')[0] || 'user'}
          </Text>

          {(displayProfile?.bio || profile?.bio) && (
            <Text
              variant="body"
              color={colors.textSecondary}
              style={{ marginTop: spacing.md, lineHeight: 22 }}
            >
              {displayProfile?.bio || profile?.bio}
            </Text>
          )}

          {/* Stats — clickable */}
          <View style={{ flexDirection: 'row', gap: spacing['2xl'], marginTop: spacing.xl }}>
            <Pressable onPress={() => { if (user?.id) router.push({ pathname: '/(tabs)/discover', params: { tab: 'people', mode: 'following', userId: user.id } } as any); }} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{followingCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Following</Text>
            </Pressable>
            <Pressable onPress={() => { if (user?.id) router.push({ pathname: '/(tabs)/discover', params: { tab: 'people', mode: 'followers', userId: user.id } } as any); }} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{followerCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Followers</Text>
            </Pressable>
          </View>
        </View>

        {/* Content tabs */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: spacing.xl,
            marginTop: spacing.xl,
            gap: spacing.lg,
            borderBottomWidth: 0.5,
            borderBottomColor: 'rgba(255,255,255,0.06)',
          }}
        >
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                paddingBottom: spacing.md,
                borderBottomWidth: 2,
                borderBottomColor: activeTab === tab.key ? colors.accent : 'transparent',
              }}
            >
              <Text
                variant="caption"
                color={activeTab === tab.key ? colors.accent : colors.textMuted}
                style={{ fontWeight: activeTab === tab.key ? '500' : '300' }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'posts' && (
          <>
            {postsLoading ? (
              <View style={{ padding: spacing.xl, gap: spacing.lg }}>
                {[1, 2, 3].map(i => (
                  <View key={i} style={{ gap: spacing.sm }}>
                    <Skeleton height={14} width={160} />
                    <Skeleton height={50} />
                  </View>
                ))}
              </View>
            ) : myPosts.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
                <Ionicons name="newspaper-outline" size={40} color={colors.accent} />
                <Text variant="h2" color={colors.text} align="center">Posts</Text>
                <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>Share your thoughts with the network.</Text>
                <Button onPress={() => router.push('/(tabs)/create')} size="sm" style={{ marginTop: spacing.md }}>Create a post</Button>
              </View>
            ) : (
              myPosts.map((post: any) => (
                <PostCard key={post.id} post={post} compact />
              ))
            )}
          </>
        )}

        {activeTab === 'communities' && (
          <>
            {commLoading ? (
              <View style={{ padding: spacing.xl, gap: spacing.md }}>
                {[1, 2, 3].map(i => <Skeleton key={i} height={50} />)}
              </View>
            ) : communities.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
                <Ionicons name="people-outline" size={40} color={colors.accent} />
                <Text variant="h2" color={colors.text} align="center">Communities</Text>
                <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>Join a community to connect with like-minded people.</Text>
                <Button onPress={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'communities' } })} size="sm" style={{ marginTop: spacing.md }}>Explore</Button>
              </View>
            ) : (
              <View style={{ padding: spacing.xl, gap: spacing.md }}>
                {communities.slice(0, 10).map((c: any) => (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push(`/(tabs)/community/${c.slug || c.id}` as any)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      padding: spacing.md,
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      borderWidth: 0.5,
                      borderColor: colors.glassBorder,
                    }}
                  >
                    <Avatar uri={c.image || c.avatar} name={c.name} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" numberOfLines={1}>{c.name}</Text>
                      {c.description && <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{c.description}</Text>}
                    </View>
                  </Pressable>
                ))}
                <Button onPress={() => router.push('/(tabs)/create')} variant="secondary" size="sm">Create Community</Button>
              </View>
            )}
          </>
        )}

        {activeTab === 'agents' && (
          <>
            {agentsLoading ? (
              <View style={{ padding: spacing.xl, gap: spacing.md }}>
                {[1, 2, 3].map(i => <Skeleton key={i} height={50} />)}
              </View>
            ) : agents.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
                <Ionicons name="hardware-chip-outline" size={40} color={colors.accent} />
                <Text variant="h2" color={colors.text} align="center">Agents</Text>
                <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>Create an AI agent to automate tasks or engage with your audience.</Text>
                <Button onPress={() => router.push('/(tabs)/create')} size="sm" style={{ marginTop: spacing.md }}>Create</Button>
              </View>
            ) : (
              <View style={{ padding: spacing.xl, gap: spacing.md }}>
                {agents.slice(0, 10).map((a: any) => (
                  <Pressable
                    key={a.id}
                    onPress={() => router.push(`/(tabs)/user/${a.username || a.id}` as any)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      padding: spacing.md,
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      borderWidth: 0.5,
                      borderColor: colors.glassBorder,
                    }}
                  >
                    <Avatar uri={a.image || a.avatar} name={a.name} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" numberOfLines={1}>{a.name}</Text>
                      {(a.bio || a.description) && <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{a.bio || a.description}</Text>}
                    </View>
                  </Pressable>
                ))}
                <Button onPress={() => router.push('/(tabs)/create')} variant="secondary" size="sm">Create Agent</Button>
              </View>
            )}
          </>
        )}

        {activeTab === 'apps' && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
            <Ionicons name="cube-outline" size={40} color={colors.accent} />
            <Text variant="h2" color={colors.text} align="center">Apps</Text>
            <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>Build and deploy apps powered by the Minds network.</Text>
            <Button onPress={() => router.push('/(tabs)/create')} size="sm" style={{ marginTop: spacing.md }}>Create</Button>
          </View>
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
              backgroundColor: colors.bg,
              borderRadius: radius.xl,
              padding: spacing['2xl'],
              width: '100%',
              maxWidth: 400,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text variant="h3" style={{ marginBottom: spacing.xl }}>Edit Profile</Text>

            <Pressable
              onPress={handlePickEditAvatar}
              style={{ alignSelf: 'center', marginBottom: spacing.xl, position: 'relative' }}
            >
              {editAvatarUri ? (
                <Image
                  source={{ uri: editAvatarUri }}
                  style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceHover }}
                />
              ) : (
                <Avatar uri={displayProfile?.image} name={displayProfile?.name} size="xl" />
              )}
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: colors.bg,
                }}
              >
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </Pressable>

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

            <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>Username</Text>
            <TextInput
              value={editUsername}
              onChangeText={(t) => setEditUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="username"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
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
                      // Upload avatar
                      if (editAvatarUri) {
                        try {
                          // Get the blob first to know its size and type
                          const blobRes = await fetch(editAvatarUri);
                          const blob = await blobRes.blob();
                          const contentType = blob.type || 'image/jpeg';

                          const uploads = (sdk as any).uploads;
                          const uploadRes = await uploads.getAvatarUploadUrl({
                            content_type: contentType,
                            content_length: blob.size,
                          });
                          console.log('[Avatar] Upload URL response:', JSON.stringify(uploadRes.data));

                          const uploadUrl = uploadRes.data?.upload_url || uploadRes.data?.url;
                          const key = uploadRes.data?.key;

                          if (uploadUrl) {
                            const putRes = await fetch(uploadUrl, {
                              method: 'PUT',
                              body: blob,
                              headers: { 'Content-Type': contentType },
                            });
                            console.log('[Avatar] PUT status:', putRes.status);

                            if (key) {
                              const confirmRes = await uploads.confirmAvatarUpload(key);
                              console.log('[Avatar] Confirm response:', JSON.stringify(confirmRes.data));
                            }
                          } else {
                            console.error('[Avatar] No upload URL returned');
                            Alert.alert('Error', 'Could not get upload URL');
                          }
                        } catch (err: any) {
                          console.error('[Avatar] Upload failed:', err?.message || err);
                          Alert.alert('Avatar Error', err?.message || 'Upload failed');
                        }
                      }
                      await sdk.profiles.update({
                        name: editName.trim(),
                        username: editUsername.trim() || undefined,
                        bio: editBio.trim(),
                      });
                      await refreshProfile();
                      setShowEditProfile(false);
                    } catch {
                      Alert.alert('Error', 'Failed to update profile.');
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
    </Container>
  );
}
