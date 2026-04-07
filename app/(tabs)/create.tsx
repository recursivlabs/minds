import * as React from 'react';
import {
  View,
  TextInput,
  Pressable,
  Image,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
const getImagePicker = () => Platform.OS !== 'web' ? require('expo-image-picker') : null;
import { Text } from '../../components';
import { Container } from '../../components/Container';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { colors, spacing, radius, typography } from '../../constants/theme';

export default function CreateScreen() {
  const router = useRouter();
  const { sdk, user } = useAuth();

  const [content, setContent] = React.useState('');
  const [isNsfw, setIsNsfw] = React.useState(false);
  const [showTags, setShowTags] = React.useState(false);
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [mediaUri, setMediaUri] = React.useState<string | null>(null);
  const [posting, setPosting] = React.useState(false);

  const charCount = content.length;

  const handlePickImage = async () => {
    try {
      const picker = getImagePicker();
      if (picker) {
        const result = await picker.launchImageLibraryAsync({
          mediaTypes: picker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
          setMediaUri(result.assets[0].uri);
        }
      } else if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) setMediaUri(URL.createObjectURL(file));
        };
        input.click();
      }
    } catch {}
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags((prev) => [...prev, tag]);
    }
    setTagInput('');
    setShowTags(false);
  };

  const handlePost = async () => {
    if (!content.trim() && !mediaUri) {
      if (Platform.OS === 'web') alert('Write something to share');
      else Alert.alert('', 'Write something to share');
      return;
    }
    if (!sdk) return;
    setPosting(true);
    try {
      let mediaUrls: string[] | undefined;
      if (mediaUri) {
        try {
          const uploadRes = await (sdk as any).uploads.getMediaUploadUrl({
            content_type: 'image/jpeg',
            content_length: 0,
          });
          const uploadUrl = uploadRes.data?.upload_url || uploadRes.data?.url;
          if (uploadUrl) {
            const response = await fetch(mediaUri);
            const blob = await response.blob();
            await fetch(uploadUrl, {
              method: 'PUT',
              body: blob,
              headers: { 'Content-Type': 'image/jpeg' },
            });
            const publicUrl = uploadRes.data?.public_url || uploadUrl.split('?')[0];
            mediaUrls = [publicUrl];
          }
        } catch (e) {
          console.warn('Media upload failed:', e);
        }
      }

      await sdk.posts.create({
        content: content.trim() || ' ',
        organization_id: ORG_ID || undefined,
        media_urls: mediaUrls,
      } as any);

      router.back();
    } catch (err: any) {
      const msg = err?.message || 'Failed to create post';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setPosting(false);
    }
  };

  const canPost = content.trim().length > 0 || !!mediaUri;

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
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="body" color={colors.textSecondary}>Cancel</Text>
        </Pressable>

        <Pressable
          onPress={handlePost}
          disabled={!canPost || posting}
          style={{
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.sm,
            borderRadius: radius.full,
            backgroundColor: canPost ? colors.accent : colors.surfaceHover,
            opacity: posting ? 0.6 : 1,
          }}
        >
          {posting ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text
              variant="bodyMedium"
              color={canPost ? colors.textInverse : colors.textMuted}
            >
              Post
            </Text>
          )}
        </Pressable>
      </View>

      {/* Composer */}
      <View style={{ flex: 1, padding: spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, flex: 1 }}>
          <Avatar uri={user?.image} name={user?.name} size="md" />
          <View style={{ flex: 1 }}>
            <TextInput
              placeholder="What's on your mind?"
              placeholderTextColor={colors.textMuted}
              value={content}
              onChangeText={setContent}
              multiline
              autoFocus
              style={{
                color: colors.text,
                ...typography.body,
                fontSize: 17,
                lineHeight: 24,
                padding: 0,
                flex: 1,
                textAlignVertical: 'top',
                ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
              }}
            />
          </View>
        </View>

        {/* Media preview */}
        {mediaUri && (
          <View style={{ marginTop: spacing.lg, position: 'relative' }}>
            <Image
              source={{ uri: mediaUri }}
              style={{
                width: '100%',
                aspectRatio: 16 / 9,
                maxHeight: 300,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceHover,
              }}
              resizeMode="contain"
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

        {/* Tags display */}
        {tags.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
            {tags.map((tag) => (
              <Pressable
                key={tag}
                onPress={() => setTags((prev) => prev.filter((t) => t !== tag))}
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

        {/* Tag input */}
        {showTags && (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <TextInput
              placeholder="Add a tag..."
              placeholderTextColor={colors.textMuted}
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={handleAddTag}
              autoFocus
              returnKeyType="done"
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderWidth: 0.5,
                borderColor: colors.glassBorder,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: 10,
                color: colors.text,
                ...typography.body,
                ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
              }}
            />
          </View>
        )}
      </View>

      {/* Bottom toolbar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xl,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <Pressable onPress={handlePickImage} hitSlop={8}>
          <Ionicons name="image-outline" size={22} color={mediaUri ? colors.accent : colors.textMuted} />
        </Pressable>
        <Pressable onPress={() => setShowTags(!showTags)} hitSlop={8}>
          <Ionicons name="pricetag-outline" size={22} color={tags.length > 0 ? colors.accent : colors.textMuted} />
        </Pressable>
        <Pressable onPress={() => setIsNsfw(!isNsfw)} hitSlop={8}>
          <Ionicons
            name={isNsfw ? 'warning' : 'warning-outline'}
            size={22}
            color={isNsfw ? colors.accent : colors.textMuted}
          />
        </Pressable>

        <View style={{ flex: 1 }} />

        <Text variant="caption" color={colors.textMuted}>
          {charCount}
        </Text>
      </View>
    </Container>
  );
}
