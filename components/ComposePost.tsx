import * as React from 'react';
import { View, TextInput, Pressable, Switch, ScrollView, Image, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// expo-image-picker imported lazily to avoid web crash
const getImagePicker = () => Platform.OS !== 'web' ? require('expo-image-picker') : null;
import { Text } from './Text';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { colors, spacing, radius, typography } from '../constants/theme';

interface Props {
  onPost: (data: { content: string; title?: string; tags: string[]; media?: string }) => Promise<void>;
  placeholder?: string;
  showTitle?: boolean;
  communityId?: string;
}

export function ComposePost({ onPost, placeholder = "What's on your mind?", showTitle = true, communityId }: Props) {
  const { user } = useAuth();
  const [content, setContent] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [isNsfw, setIsNsfw] = React.useState(false);
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [mediaUri, setMediaUri] = React.useState<string | null>(null);
  const [posting, setPosting] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const isBlogMode = title.trim().length > 0;

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
    if (tag && !tags.includes(tag)) {
      setTags(prev => [...prev, tag]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  const handlePost = async () => {
    if (!content.trim()) return;
    setPosting(true);
    try {
      const allTags = isNsfw ? [...tags, 'nsfw'] : tags;
      await onPost({
        content: content.trim(),
        title: title.trim() || undefined,
        tags: allTags,
        media: mediaUri || undefined,
      });
      setContent('');
      setTitle('');
      setTags([]);
      setMediaUri(null);
      setIsNsfw(false);
      setExpanded(false);
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

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
        padding: spacing.xl,
      }}
    >
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Avatar uri={user?.image} name={user?.name} size="sm" />
        <View style={{ flex: 1 }}>
          {showTitle && expanded && (
            <TextInput
              placeholder="Title (optional, makes it a blog)"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={setTitle}
              style={{
                color: colors.text,
                ...typography.h3,
                marginBottom: spacing.sm,
                padding: 0,
                ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
              }}
            />
          )}
          <TextInput
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            value={content}
            onChangeText={setContent}
            onFocus={() => setExpanded(true)}
            multiline
            style={{
              color: colors.text,
              ...typography.body,
              minHeight: expanded ? 80 : 40,
              padding: 0,
              textAlignVertical: 'top',
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />

          {/* Media preview */}
          {mediaUri && (
            <View style={{ marginTop: spacing.md, position: 'relative' }}>
              <Image
                source={{ uri: mediaUri }}
                style={{
                  width: '100%',
                  height: 160,
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
                  padding: spacing.xs,
                }}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </Pressable>
            </View>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md }}>
              {tags.map(tag => (
                <Pressable
                  key={tag}
                  onPress={() => handleRemoveTag(tag)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs,
                    backgroundColor: colors.surfaceHover,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 3,
                    borderRadius: radius.full,
                  }}
                >
                  <Text variant="caption" color={colors.accent}>#{tag}</Text>
                  <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Toolbar */}
          {expanded && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: spacing.lg,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
                <Pressable onPress={handlePickImage} hitSlop={8}>
                  <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    const tag = tagInput.trim() ? undefined : undefined;
                    // Toggle tag input area
                    setTagInput(tagInput ? '' : ' ');
                    setTimeout(() => setTagInput(''), 0);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="pricetag-outline" size={20} color={colors.textMuted} />
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text variant="caption" color={colors.textMuted}>NSFW</Text>
                  <Switch
                    value={isNsfw}
                    onValueChange={setIsNsfw}
                    trackColor={{ false: colors.surfaceHover, true: colors.error + '40' }}
                    thumbColor={isNsfw ? colors.error : colors.textMuted}
                    style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
                  />
                </View>
              </View>

              <Button
                onPress={handlePost}
                loading={posting}
                disabled={!content.trim()}
                size="sm"
              >
                {isBlogMode ? 'Publish' : 'Post'}
              </Button>
            </View>
          )}
        </View>
      </View>

      {isBlogMode && expanded && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            marginTop: spacing.sm,
            marginLeft: 52,
          }}
        >
          <Ionicons name="document-text-outline" size={14} color={colors.accent} />
          <Text variant="caption" color={colors.accent}>Blog mode</Text>
        </View>
      )}
    </View>
  );
}
