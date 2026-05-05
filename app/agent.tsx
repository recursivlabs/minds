import * as React from 'react';
import { View, ScrollView, TextInput, Pressable, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text, Button } from '../components';
import { Container } from '../components/Container';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../lib/auth';
import { loadPreferences, savePreferences } from '../lib/onboarding';
import { colors, spacing, radius, typography } from '../constants/theme';

const PERSONAS = [
  { key: 'curious', label: 'Curious', desc: 'Leads with the most surprising or counterintuitive thing.' },
  { key: 'skeptical', label: 'Skeptical', desc: 'Flags what is unproven, contested, or missing.' },
  { key: 'playful', label: 'Playful', desc: 'One sharp observation with a touch of wit.' },
  { key: 'calm', label: 'Calm', desc: 'A short factual phrase. Lets the source speak.' },
] as const;

type PersonaKey = typeof PERSONAS[number]['key'];

const DEFAULT_SYSTEM_PROMPT = [
  'You are a personal AI agent. You are an AI and you always say so when asked.',
  'You work for the user who owns you, no one else. You do not post publicly on their behalf.',
  'You read their network and the open web, and you help them find things worth their attention.',
  'Always cite sources when you make a claim. Flag uncertainty. Never hallucinate facts.',
  'Your conversations with the user are private and never train a shared model.',
].join(' ');

export default function AgentScreen() {
  const router = useRouter();
  const { sdk } = useAuth();

  const [agentId, setAgentId] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [persona, setPersona] = React.useState<PersonaKey>('curious');
  const [systemPrompt, setSystemPrompt] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load the user's personal agent + their saved preferences.
  React.useEffect(() => {
    if (!sdk) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await sdk.agents.list({ limit: 50 });
        const personal = (list.data || []).find((a: any) => a.agent_type === 'personal' || a.agentType === 'personal');
        const stored = await loadPreferences();
        if (cancelled) return;
        if (personal) {
          setAgentId(personal.id);
          setName(personal.name || stored?.agent_name || 'Agent');
          setSystemPrompt((personal as any).ai_system_prompt || (personal as any).aiSystemPrompt || DEFAULT_SYSTEM_PROMPT);
        } else {
          setName(stored?.agent_name || 'Agent');
          setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
        }
        setPersona((stored?.persona as PersonaKey) || 'curious');
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load agent');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk]);

  const handleSave = async () => {
    if (!sdk) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaving(true);
    setError(null);
    try {
      // Persist preferences locally so pull-to-refresh on the home feed
      // continues to use the latest persona / paste sources.
      const stored = await loadPreferences();
      await savePreferences({
        interests: stored?.interests || [],
        free_text_interests: stored?.free_text_interests || '',
        vibes: stored?.vibes || [],
        persona,
        agent_name: name.trim() || undefined,
        paste_sources: stored?.paste_sources || {},
      });

      // Push name + system prompt to the agent row, and persona via
      // ensurePersonal which idempotently updates agent_preferences.
      if (agentId) {
        await (sdk as any).agents.update(agentId, {
          name: name.trim() || undefined,
          system_prompt: systemPrompt.trim() || null,
        });
      }
      await (sdk as any).agents.ensurePersonal({
        preferences: {
          interests: stored?.interests || [],
          free_text_interests: stored?.free_text_interests || '',
          vibes: stored?.vibes || [],
          persona,
        },
        overrides: name.trim() ? { name: name.trim() } : undefined,
      });

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPrompt = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
  };

  return (
    <Container safeTop safeBottom>
      <ScreenHeader title="Your agent" showBack />

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing['4xl'], gap: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Text variant="body" color={colors.textMuted}>Loading…</Text>
        ) : (
          <>
            <View style={{ gap: spacing.sm }}>
              <Text variant="label" color={colors.textMuted}>NAME</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="What should we call your agent?"
                placeholderTextColor={colors.textMuted}
                maxLength={48}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  color: colors.text,
                  fontSize: typography.body.fontSize,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                }}
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text variant="label" color={colors.textMuted}>VOICE</Text>
              <View style={{ gap: spacing.sm }}>
                {PERSONAS.map((p) => {
                  const selected = persona === p.key;
                  return (
                    <Pressable
                      key={p.key}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync();
                        setPersona(p.key);
                      }}
                      style={{
                        padding: spacing.lg,
                        borderRadius: radius.md,
                        borderWidth: 0.5,
                        borderColor: selected ? colors.accent : colors.border,
                        backgroundColor: selected ? colors.surface : 'transparent',
                        gap: spacing.xs,
                      }}
                    >
                      <Text variant="bodyMedium" color={selected ? colors.accent : colors.text}>
                        {p.label}
                      </Text>
                      <Text variant="caption" color={colors.textSecondary} style={{ lineHeight: 18 }}>
                        {p.desc}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="label" color={colors.textMuted}>SYSTEM PROMPT</Text>
                <Pressable onPress={handleResetPrompt} hitSlop={8}>
                  <Text variant="caption" color={colors.accent}>Reset</Text>
                </Pressable>
              </View>
              <Text variant="caption" color={colors.textSecondary} style={{ lineHeight: 18 }}>
                Full control of your agent's behavior. Edit anything you'd put into a custom GPT or Claude project. Persona above only changes the curator voice.
              </Text>
              <TextInput
                value={systemPrompt}
                onChangeText={setSystemPrompt}
                placeholder={DEFAULT_SYSTEM_PROMPT}
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                maxLength={16000}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  color: colors.text,
                  fontSize: typography.body.fontSize,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                  minHeight: 180,
                }}
              />
            </View>

            {error && (
              <Text variant="body" color={colors.error || '#ef4444'}>{error}</Text>
            )}

            <Button onPress={handleSave} fullWidth size="lg" loading={saving} disabled={saving}>
              Save changes
            </Button>
          </>
        )}
      </ScrollView>
    </Container>
  );
}
