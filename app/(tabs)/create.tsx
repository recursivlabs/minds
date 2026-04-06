import * as React from 'react';
import {
  View,
  TextInput,
  ScrollView,
  Pressable,
  Switch,
  Image,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
const getImagePicker = () => Platform.OS !== 'web' ? require('expo-image-picker') : null;
import { Text, Button, Input, Card } from '../../components';
import { Container } from '../../components/Container';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../lib/auth';
import { useCommunities } from '../../lib/hooks';
import { ORG_ID } from '../../lib/recursiv';
import { colors, spacing, radius, typography } from '../../constants/theme';

const MINDS_AI_AGENT_ID = 'b20fc63e-7c12-4a31-8f3a-ef282b568dbf';

const AGENT_MODELS = [
  'gemini-3.1-pro-preview',
  'claude-sonnet-4-20250514',
  'gpt-4o',
  'gemini-2.5-flash-preview-05-20',
];

type CreationMode = 'landing' | 'post' | 'agent' | 'app' | 'community' | 'boost';

function generateUsername(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
  const suffix = Math.random().toString(36).substring(2, 6);
  return base ? `${base}_${suffix}` : `user_${suffix}`;
}

// ─── Landing Page ────────────────────────────────────────────────────────────

interface CreationOptionProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}

function CreationOption({ icon, title, description, onPress }: CreationOptionProps) {
  return (
    <Pressable onPress={onPress} style={{ width: '48%' as any }}>
      <Card variant="raised" padding="lg">
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.lg,
              backgroundColor: colors.accentMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={icon} size={24} color={colors.accent} />
          </View>
          <Text variant="bodyMedium" align="center">{title}</Text>
          <Text variant="caption" color={colors.textMuted} align="center" numberOfLines={2}>
            {description}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

function LandingView({ onSelect }: { onSelect: (mode: CreationMode) => void }) {
  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.xl,
        paddingTop: spacing['3xl'],
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text variant="h1" align="center" style={{ marginBottom: spacing['3xl'] }}>
        What do you want to create?
      </Text>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.md,
          justifyContent: 'center',
        }}
      >
        <CreationOption
          icon="create-outline"
          title="Post"
          description="Share your thoughts"
          onPress={() => onSelect('post')}
        />
        <CreationOption
          icon="sparkles-outline"
          title="Agent"
          description="Build an AI agent"
          onPress={() => onSelect('agent')}
        />
        <CreationOption
          icon="phone-portrait-outline"
          title="App"
          description="Build an app with AI"
          onPress={() => onSelect('app')}
        />
        <CreationOption
          icon="people-outline"
          title="Community"
          description="Start a community"
          onPress={() => onSelect('community')}
        />
        <CreationOption
          icon="rocket-outline"
          title="Boost"
          description="Amplify your content"
          onPress={() => onSelect('boost')}
        />
      </View>
    </ScrollView>
  );
}

// ─── Post Creation Flow ──────────────────────────────────────────────────────

function PostFlow({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const { sdk, user } = useAuth();
  const { communities } = useCommunities(50);

  const [content, setContent] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [showTitle, setShowTitle] = React.useState(false);
  const [isNsfw, setIsNsfw] = React.useState(false);
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [showTags, setShowTags] = React.useState(false);
  const [mediaUri, setMediaUri] = React.useState<string | null>(null);
  const [selectedCommunity, setSelectedCommunity] = React.useState<string | null>(null);
  const [showCommunityPicker, setShowCommunityPicker] = React.useState(false);
  const [posting, setPosting] = React.useState(false);

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
  };

  const handlePost = async () => {
    if ((!content.trim() && !mediaUri) || !sdk) return;
    setPosting(true);
    try {
      const allTags = isNsfw ? [...tags, 'nsfw'] : tags;

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
        community_id: selectedCommunity || undefined,
        organization_id: ORG_ID || undefined,
        media_urls: mediaUrls,
      } as any);

      onSuccess();
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
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing['4xl'] }}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        {/* Avatar + prompt */}
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
          <Avatar uri={user?.image} name={user?.name} size="md" />
          <View style={{ flex: 1 }}>
            {/* Optional title */}
            {showTitle && (
              <TextInput
                placeholder="Title"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
                style={{
                  color: colors.text,
                  ...typography.h3,
                  padding: 0,
                  marginBottom: spacing.md,
                  ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
                }}
              />
            )}

            {/* Content */}
            <TextInput
              placeholder="What's on your mind?"
              placeholderTextColor={colors.textMuted}
              value={content}
              onChangeText={setContent}
              multiline
              style={{
                color: colors.text,
                ...typography.body,
                minHeight: 120,
                padding: 0,
                textAlignVertical: 'top',
                ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
              }}
            />
          </View>
        </View>

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

        {/* Optional extras */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xl }}>
          {!showTitle && (
            <Pressable
              onPress={() => setShowTitle(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                backgroundColor: colors.surface,
                borderRadius: radius.full,
                borderWidth: 0.5,
                borderColor: colors.glassBorder,
              }}
            >
              <Ionicons name="document-text-outline" size={14} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>Add title</Text>
            </Pressable>
          )}

          {!showCommunityPicker && (
            <Pressable
              onPress={() => setShowCommunityPicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                backgroundColor: selectedCommunity ? colors.accentMuted : colors.surface,
                borderRadius: radius.full,
                borderWidth: 0.5,
                borderColor: selectedCommunity ? colors.accent + '40' : colors.glassBorder,
              }}
            >
              <Ionicons name="people-outline" size={14} color={selectedCommunity ? colors.accent : colors.textMuted} />
              <Text variant="caption" color={selectedCommunity ? colors.accent : colors.textMuted}>
                {selectedCommunityObj?.name || 'Community'}
              </Text>
            </Pressable>
          )}

          {!showTags && (
            <Pressable
              onPress={() => setShowTags(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                backgroundColor: colors.surface,
                borderRadius: radius.full,
                borderWidth: 0.5,
                borderColor: colors.glassBorder,
              }}
            >
              <Ionicons name="pricetag-outline" size={14} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>Tags</Text>
            </Pressable>
          )}
        </View>

        {/* Community picker dropdown */}
        {showCommunityPicker && communities.length > 0 && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: 0.5,
              borderColor: colors.glassBorder,
              marginTop: spacing.md,
              maxHeight: 200,
            }}
          >
            <Pressable
              onPress={() => {
                setSelectedCommunity(null);
                setShowCommunityPicker(false);
              }}
              style={{ padding: spacing.md }}
            >
              <Text variant="body" color={colors.textMuted}>None (public)</Text>
            </Pressable>
            {communities.map((c: any) => (
              <Pressable
                key={c.id}
                onPress={() => {
                  setSelectedCommunity(c.id);
                  setShowCommunityPicker(false);
                }}
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

        {/* Tags input */}
        {showTags && (
          <View style={{ marginTop: spacing.md }}>
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
              <Pressable
                onPress={handleAddTag}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 0.5,
                  borderColor: colors.glassBorder,
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
          </View>
        )}
      </ScrollView>

      {/* Bottom toolbar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.lg,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(255,255,255,0.06)',
          backgroundColor: colors.bg,
        }}
      >
        <Pressable onPress={handlePickImage} hitSlop={8}>
          <Ionicons name="image-outline" size={22} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={() => setShowTags(!showTags)} hitSlop={8}>
          <Ionicons name="pricetag-outline" size={22} color={showTags ? colors.accent : colors.textMuted} />
        </Pressable>
        <Pressable onPress={() => setIsNsfw(!isNsfw)} hitSlop={8}>
          <Ionicons
            name={isNsfw ? 'warning' : 'warning-outline'}
            size={22}
            color={isNsfw ? colors.error : colors.textMuted}
          />
        </Pressable>

        <View style={{ flex: 1 }} />

        {/* Send button — gold circle */}
        <Pressable
          onPress={handlePost}
          disabled={!content.trim() || posting}
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.full,
            backgroundColor: content.trim() ? colors.accent : colors.surfaceHover,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: !content.trim() || posting ? 0.5 : 1,
          }}
        >
          {posting ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Ionicons name="arrow-up" size={20} color={content.trim() ? colors.textInverse : colors.textMuted} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── Agent Creation Flow ─────────────────────────────────────────────────────

function AgentFlow({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const { sdk } = useAuth();
  const [name, setName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [usernameEdited, setUsernameEdited] = React.useState(false);
  const [bio, setBio] = React.useState('');
  const [systemPrompt, setSystemPrompt] = React.useState('');
  const [modelIndex, setModelIndex] = React.useState(0);
  const [creating, setCreating] = React.useState(false);

  // Auto-generate username from name
  React.useEffect(() => {
    if (!usernameEdited && name) {
      setUsername(generateUsername(name));
    }
  }, [name, usernameEdited]);

  const handleCreate = async () => {
    if (!name.trim() || !sdk) return;
    setCreating(true);
    try {
      await sdk.agents.create({
        name: name.trim(),
        username: username.trim() || generateUsername(name),
        bio: bio.trim() || undefined,
        system_prompt: systemPrompt.trim() || undefined,
        model: AGENT_MODELS[modelIndex],
        organization_id: ORG_ID || undefined,
        social_mode: 'chat_only',
        tool_mode: 'chat_only',
      } as any);
      onSuccess();
    } catch (err: any) {
      const msg = err?.message || 'Failed to create agent';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="interactive"
    >
      <Text variant="h2" style={{ marginBottom: spacing.md }}>Create an Agent</Text>

      <Input
        label="Name"
        placeholder="My awesome agent"
        value={name}
        onChangeText={setName}
      />

      <Input
        label="Username"
        placeholder="auto-generated from name"
        value={username}
        onChangeText={(t) => {
          setUsername(t);
          setUsernameEdited(true);
        }}
      />

      <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
        <Text variant="label" color={colors.textSecondary}>Bio</Text>
        <TextInput
          placeholder="A short description of your agent"
          placeholderTextColor={colors.textMuted}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={2}
          style={{
            backgroundColor: colors.glass,
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: 11,
            color: colors.text,
            ...typography.body,
            minHeight: 60,
            textAlignVertical: 'top',
            ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', backdropFilter: 'blur(12px)' } as any) : {}),
          }}
        />
      </View>

      <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
        <Text variant="label" color={colors.textSecondary}>System Prompt</Text>
        <TextInput
          placeholder="What should this agent do?"
          placeholderTextColor={colors.textMuted}
          value={systemPrompt}
          onChangeText={setSystemPrompt}
          multiline
          numberOfLines={4}
          style={{
            backgroundColor: colors.glass,
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: 11,
            color: colors.text,
            ...typography.body,
            minHeight: 100,
            textAlignVertical: 'top',
            ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', backdropFilter: 'blur(12px)' } as any) : {}),
          }}
        />
      </View>

      {/* Model selector */}
      <View style={{ gap: spacing.xs, marginBottom: spacing.lg }}>
        <Text variant="label" color={colors.textSecondary}>Model</Text>
        <Pressable
          onPress={() => setModelIndex((prev) => (prev + 1) % AGENT_MODELS.length)}
          style={{
            backgroundColor: colors.glass,
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="body">{AGENT_MODELS[modelIndex]}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <Button
        onPress={handleCreate}
        loading={creating}
        disabled={!name.trim()}
        fullWidth
      >
        Create Agent
      </Button>

      <View style={{ height: spacing['4xl'] }} />
    </ScrollView>
  );
}

// ─── App Creation Flow (Chat) ────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

function AppFlow({ onBack }: { onBack: () => void }) {
  const { sdk } = useAuth();
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const scrollRef = React.useRef<ScrollView>(null);

  const handleSend = async () => {
    if (!input.trim() || !sdk || sending) return;
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await sdk.agents.chat(MINDS_AI_AGENT_ID, {
        message: userMsg.content,
      } as any);
      const reply = (res.data as any)?.message || (res.data as any)?.content || (typeof res.data === 'string' ? res.data : 'I received your message.');
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: reply,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <Text variant="h2" style={{ marginBottom: spacing.sm }}>Build an App</Text>
        <Text variant="body" color={colors.textMuted} style={{ marginBottom: spacing.lg }}>
          Chat with our AI to design and build your app.
        </Text>

        {messages.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: spacing['3xl'], gap: spacing.lg }}>
            <Ionicons name="chatbubbles-outline" size={32} color={colors.textMuted} />
            <Text variant="body" color={colors.textMuted} align="center">
              Describe what you want to build and we will help you get started.
            </Text>
          </View>
        )}

        {messages.map((msg) => (
          <View
            key={msg.id}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%' as any,
              backgroundColor: msg.role === 'user' ? colors.accent : colors.surfaceRaised,
              borderRadius: radius.lg,
              padding: spacing.md,
              borderWidth: msg.role === 'assistant' ? 0.5 : 0,
              borderColor: colors.glassBorder,
            }}
          >
            <Text
              variant="body"
              color={msg.role === 'user' ? colors.textInverse : colors.text}
            >
              {msg.content}
            </Text>
          </View>
        ))}

        {sending && (
          <View style={{ alignSelf: 'flex-start', padding: spacing.md }}>
            <ActivityIndicator color={colors.textMuted} size="small" />
          </View>
        )}
      </ScrollView>

      {/* Input bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(255,255,255,0.06)',
          backgroundColor: colors.bg,
        }}
      >
        <TextInput
          placeholder="Describe what you want to build..."
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            color: colors.text,
            ...typography.body,
            ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
          }}
        />
        <Pressable
          onPress={handleSend}
          disabled={!input.trim() || sending}
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.full,
            backgroundColor: input.trim() ? colors.accent : colors.surfaceHover,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: !input.trim() || sending ? 0.5 : 1,
          }}
        >
          <Ionicons name="arrow-up" size={20} color={input.trim() ? colors.textInverse : colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Community Creation Flow ─────────────────────────────────────────────────

function CommunityFlow({ onBack, onSuccess }: { onBack: () => void; onSuccess: (slug: string) => void }) {
  const { sdk } = useAuth();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

  const handleCreate = async () => {
    if (!name.trim() || !sdk) return;
    setCreating(true);
    try {
      const res = await sdk.communities.create({
        name: name.trim(),
        slug: slug || `community-${Date.now()}`,
        description: description.trim() || undefined,
        privacy: isPrivate ? 'private' : 'public',
        organization_id: ORG_ID || undefined,
      } as any);
      const newSlug = res.data?.slug || slug;
      onSuccess(newSlug);
    } catch (err: any) {
      const msg = err?.message || 'Failed to create community';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.xl, gap: spacing.md }}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="interactive"
    >
      <Text variant="h2" style={{ marginBottom: spacing.md }}>Create a Community</Text>

      <Input
        label="Name"
        placeholder="My community"
        value={name}
        onChangeText={setName}
      />

      <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
        <Text variant="label" color={colors.textSecondary}>Description</Text>
        <TextInput
          placeholder="What is this community about?"
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          style={{
            backgroundColor: colors.glass,
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: 11,
            color: colors.text,
            ...typography.body,
            minHeight: 80,
            textAlignVertical: 'top',
            ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', backdropFilter: 'blur(12px)' } as any) : {}),
          }}
        />
      </View>

      {/* Privacy toggle */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.glass,
          borderRadius: radius.md,
          borderWidth: 0.5,
          borderColor: colors.glassBorder,
          marginBottom: spacing.lg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Ionicons
            name={isPrivate ? 'lock-closed-outline' : 'globe-outline'}
            size={20}
            color={colors.textSecondary}
          />
          <View>
            <Text variant="bodyMedium">{isPrivate ? 'Private' : 'Public'}</Text>
            <Text variant="caption" color={colors.textMuted}>
              {isPrivate ? 'Members must be invited' : 'Anyone can join'}
            </Text>
          </View>
        </View>
        <Switch
          value={isPrivate}
          onValueChange={setIsPrivate}
          trackColor={{ false: colors.surfaceHover, true: colors.accent + '40' }}
          thumbColor={isPrivate ? colors.accent : colors.textMuted}
        />
      </View>

      <Button
        onPress={handleCreate}
        loading={creating}
        disabled={!name.trim()}
        fullWidth
      >
        Create Community
      </Button>

      <View style={{ height: spacing['4xl'] }} />
    </ScrollView>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function CreateScreen() {
  const router = useRouter();
  const [mode, setMode] = React.useState<CreationMode>('landing');
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage(null);
      setMode('landing');
    }, 1500);
  };

  const headerTitle = {
    landing: 'Create',
    post: 'New Post',
    agent: 'New Agent',
    app: 'Build App',
    community: 'New Community',
    boost: 'Boost',
  }[mode];

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
        {mode !== 'landing' ? (
          <Pressable onPress={() => setMode('landing')} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
            <Text variant="body" color={colors.textSecondary}>Back</Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
        <Text variant="h3">{headerTitle}</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Success overlay */}
      {successMessage && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.overlay,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <View style={{ alignItems: 'center', gap: spacing.lg }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radius.full,
                backgroundColor: colors.successMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="checkmark" size={32} color={colors.success} />
            </View>
            <Text variant="h3" color={colors.text}>{successMessage}</Text>
          </View>
        </View>
      )}

      {/* Content */}
      {mode === 'landing' && <LandingView onSelect={setMode} />}

      {mode === 'post' && (
        <PostFlow
          onBack={() => setMode('landing')}
          onSuccess={() => showSuccess('Post created!')}
        />
      )}

      {mode === 'agent' && (
        <AgentFlow
          onBack={() => setMode('landing')}
          onSuccess={() => showSuccess('Agent created!')}
        />
      )}

      {mode === 'app' && <AppFlow onBack={() => setMode('landing')} />}

      {mode === 'community' && (
        <CommunityFlow
          onBack={() => setMode('landing')}
          onSuccess={(slug) => {
            showSuccess('Community created!');
            setTimeout(() => router.push(`/(tabs)/community/${slug}` as any), 1600);
          }}
        />
      )}

      {mode === 'boost' && (
        // Redirect to boost tab
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
          <Ionicons name="rocket-outline" size={32} color={colors.accent} />
          <Text variant="h3">Boost</Text>
          <Text variant="body" color={colors.textMuted} align="center">
            Amplify your content to reach more people.
          </Text>
          <Button onPress={() => setMode('landing')} variant="secondary">
            Coming Soon
          </Button>
        </View>
      )}
    </Container>
  );
}
