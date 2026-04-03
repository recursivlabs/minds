import * as React from 'react';
import { View, TextInput, ScrollView, Pressable, Switch, Image, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Button, Input, Card } from '../../components';
import { useAuth } from '../../lib/auth';
import { useCommunities } from '../../lib/hooks';
import { colors, spacing, radius, typography } from '../../constants/theme';

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk } = useAuth();
  const { communities } = useCommunities(50);

  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [isNsfw, setIsNsfw] = React.useState(false);
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [mediaUri, setMediaUri] = React.useState<string | null>(null);
  const [selectedCommunity, setSelectedCommunity] = React.useState<string | null>(null);
  const [showCommunityPicker, setShowCommunityPicker] = React.useState(false);
  const [posting, setPosting] = React.useState(false);

  const isBlogMode = title.trim().length > 0;

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setMediaUri(result.assets[0].uri);
      }
    } catch {}
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags(prev => [...prev, tag]);
    }
    setTagInput('');
  };

  const handlePost = async () => {
    if (!content.trim() || !sdk) return;
    setPosting(true);
    try {
      const allTags = isNsfw ? [...tags, 'nsfw'] : tags;

      let mediaUrl: string | undefined;
      if (mediaUri) {
        try {
          const uploadRes = await sdk.storage.getUploadUrl({
            bucket: 'posts',
            filename: `post-${Date.now()}.jpg`,
            contentType: 'image/jpeg',
          });
          if (uploadRes.data?.url) {
            const response = await fetch(mediaUri);
            const blob = await response.blob();
            await fetch(uploadRes.data.url, {
              method: 'PUT',
              body: blob,
              headers: { 'Content-Type': 'image/jpeg' },
            });
            mediaUrl = uploadRes.data.downloadUrl || uploadRes.data.url.split('?')[0];
          }
        } catch {
          // Continue without media if upload fails
        }
      }

      await sdk.posts.create({
        content: content.trim(),
        title: title.trim() || undefined,
        tags: allTags,
        communityId: selectedCommunity || undefined,
      });

      const msg = isBlogMode ? 'Blog published!' : 'Post created!';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('Success', msg);
      }

      setTitle('');
      setContent('');
      setTags([]);
      setMediaUri(null);
      setIsNsfw(false);
      setSelectedCommunity(null);

      router.push('/(tabs)');
    } catch (err: any) {
      const msg = err?.message || 'Failed to create post';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setPosting(false);
    }
  };

  const selectedCommunityObj = communities.find((c: any) => c.id === selectedCommunity);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.borderSubtle,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="body" color={colors.textSecondary}>Cancel</Text>
        </Pressable>
        <Text variant="h3">{isBlogMode ? 'Write Blog' : 'New Post'}</Text>
        <Button
          onPress={handlePost}
          loading={posting}
          disabled={!content.trim()}
          size="sm"
        >
          {isBlogMode ? 'Publish' : 'Post'}
        </Button>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.xl }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        {/* Title (blog mode) */}
        <TextInput
          placeholder="Title (optional - adds blog mode)"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
          style={{
            color: colors.text,
            ...typography.h2,
            padding: 0,
            marginBottom: spacing.lg,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
          }}
        />

        {/* Content */}
        <TextInput
          placeholder="What's on your mind? Write in markdown..."
          placeholderTextColor={colors.textMuted}
          value={content}
          onChangeText={setContent}
          multiline
          style={{
            color: colors.text,
            ...typography.body,
            minHeight: 200,
            padding: 0,
            textAlignVertical: 'top',
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
          }}
        />

        {/* Media preview */}
        {mediaUri && (
          <View style={{ marginTop: spacing.xl, position: 'relative' }}>
            <Image
              source={{ uri: mediaUri }}
              style={{
                width: '100%',
                height: 200,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceHover,
              }}
              resizeMode="cover"
            />
            <Pressable
              onPress={() => setMediaUri(null)}
              style={{
                position: 'absolute',
                top: spacing.sm,
                right: spacing.sm,
                backgroundColor: 'rgba(0,0,0,0.6)',
                borderRadius: radius.full,
                padding: spacing.sm,
              }}
            >
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        )}

        {/* Community selector */}
        <Pressable
          onPress={() => setShowCommunityPicker(!showCommunityPicker)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            marginTop: spacing.xl,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name="people-outline" size={18} color={colors.textMuted} />
          <Text variant="body" color={selectedCommunity ? colors.text : colors.textMuted} style={{ flex: 1 }}>
            {selectedCommunityObj?.name || 'Select community (optional)'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </Pressable>

        {showCommunityPicker && communities.length > 0 && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              marginTop: spacing.xs,
              maxHeight: 200,
            }}
          >
            <Pressable
              onPress={() => { setSelectedCommunity(null); setShowCommunityPicker(false); }}
              style={{ padding: spacing.md }}
            >
              <Text variant="body" color={colors.textMuted}>None (public)</Text>
            </Pressable>
            {communities.map((c: any) => (
              <Pressable
                key={c.id}
                onPress={() => { setSelectedCommunity(c.id); setShowCommunityPicker(false); }}
                style={{
                  padding: spacing.md,
                  backgroundColor: selectedCommunity === c.id ? colors.surfaceHover : 'transparent',
                }}
              >
                <Text variant="body">{c.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Tags */}
        <View style={{ marginTop: spacing.xl }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextInput
                placeholder="Add tags..."
                placeholderTextColor={colors.textMuted}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: 10,
                  color: colors.text,
                  ...typography.body,
                  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
                }}
              />
            </View>
            <Pressable
              onPress={handleAddTag}
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.lg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {tags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
              {tags.map(tag => (
                <Pressable
                  key={tag}
                  onPress={() => setTags(prev => prev.filter(t => t !== tag))}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs,
                    backgroundColor: colors.surfaceHover,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.full,
                  }}
                >
                  <Text variant="caption" color={colors.accent}>#{tag}</Text>
                  <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* NSFW toggle */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.xl,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: isNsfw ? colors.error + '40' : colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="warning-outline" size={18} color={isNsfw ? colors.error : colors.textMuted} />
            <View>
              <Text variant="bodyMedium" color={isNsfw ? colors.error : colors.text}>
                NSFW Content
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                Mark if this contains adult content
              </Text>
            </View>
          </View>
          <Switch
            value={isNsfw}
            onValueChange={setIsNsfw}
            trackColor={{ false: colors.surfaceHover, true: colors.error + '40' }}
            thumbColor={isNsfw ? colors.error : colors.textMuted}
          />
        </View>

        {/* Blog mode indicator */}
        {isBlogMode && (
          <Card variant="raised" style={{ marginTop: spacing.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Ionicons name="document-text" size={20} color={colors.accent} />
              <View>
                <Text variant="bodyMedium" color={colors.accent}>Blog Mode Active</Text>
                <Text variant="caption" color={colors.textMuted}>
                  Your post will be formatted as a long-form blog
                </Text>
              </View>
            </View>
          </Card>
        )}

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>

      {/* Toolbar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderTopWidth: 0.5,
          borderTopColor: colors.borderSubtle,
          backgroundColor: colors.bg,
        }}
      >
        <Pressable onPress={handlePickImage} hitSlop={8}>
          <Ionicons name="image-outline" size={22} color={colors.textMuted} />
        </Pressable>
        <Pressable hitSlop={8}>
          <Ionicons name="code-slash-outline" size={22} color={colors.textMuted} />
        </Pressable>
        <Pressable hitSlop={8}>
          <Ionicons name="link-outline" size={22} color={colors.textMuted} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Text variant="caption" color={colors.textMuted}>
          {content.length} chars
        </Text>
      </View>
    </View>
  );
}
