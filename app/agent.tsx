import * as React from 'react';
import { View, ScrollView, TextInput, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text, Button } from '../components';
import { Container } from '../components/Container';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../lib/auth';
import {
  loadPreferences,
  savePreferences,
  markAgentSetUp,
  isAgentSetUp,
  markCuratedNow,
} from '../lib/onboarding';
import { buildCuratorRequest } from '../lib/curator';
import { invalidate } from '../lib/cache';
import { ensureIntroDM, INTRO_DM_TEMPLATE as _IDT, firstName as _FN } from '../lib/agentIntro';
import { spacing, radius, typography } from '../constants/theme';
import { useColors } from '../lib/theme';

// Model options — must match server allowlist in lib/modelAllowlist.ts.
// IDs are dotted (OpenRouter convention), not dashed. Keep list short to
// keep the picker clean; full set is broader.
const MODELS: Array<{ key: string; label: string; sub: string }> = [
  { key: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', sub: 'Sharp, balanced. Default.' },
  { key: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6', sub: 'Most thoughtful, slower.' },
  { key: 'openai/gpt-5.4', label: 'GPT-5.4', sub: 'Versatile, broad context.' },
  { key: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', sub: 'Strong at multi-step tools.' },
];

const DEFAULT_SYSTEM_PROMPT = [
  'You are a personal AI agent. You are an AI and you always say so when asked.',
  'You work for the user who owns you, no one else. You do not post publicly on their behalf.',
  'You read their network and the open web, and you help them find things worth their attention.',
  'Always cite sources when you make a claim. Flag uncertainty. Never hallucinate facts.',
  'Your conversations with the user are private and never train a shared model.',
].join(' ');

// INTRO_DM_TEMPLATE + firstName moved to lib/agentIntro so the chat
// back-fill + SideNav can share the same idempotent helper.
const INTRO_DM_TEMPLATE = _IDT;
const firstName = _FN;

export default function AgentSetupScreen() {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const colors = useColors();

  const [agentId, setAgentId] = React.useState<string | null>(null);
  const [isExistingAgent, setIsExistingAgent] = React.useState(false);
  const [name, setName] = React.useState('');
  const [model, setModel] = React.useState(MODELS[0].key);
  const [systemPrompt, setSystemPrompt] = React.useState(DEFAULT_SYSTEM_PROMPT);
  const [interests, setInterests] = React.useState('');
  // File-upload context is stubbed for v1 — the upload control renders
  // a coming-soon dropzone. When wired, this state will hold uploaded
  // file references that the agent reads as private context.

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [stepMsg, setStepMsg] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  // Fun status cycle while the curator step runs (5-15s typical).
  // Rotates through plausible-sounding work so the button doesn't feel
  // frozen on "Curating your first feed."
  const CURATOR_STATUS_LINES = React.useMemo(
    () => [
      'Searching the open web…',
      'Reading top stories on Minds…',
      'Picking the most interesting threads…',
      'Filtering noise from signal…',
      'Reading what people are sharing…',
      'Almost there…',
    ],
    [],
  );
  const cycleStopRef = React.useRef<null | (() => void)>(null);
  const startStatusCycle = React.useCallback(() => {
    cycleStopRef.current?.();
    let i = 0;
    setStepMsg(CURATOR_STATUS_LINES[0]);
    const id = setInterval(() => {
      i = (i + 1) % CURATOR_STATUS_LINES.length;
      setStepMsg(CURATOR_STATUS_LINES[i]);
    }, 1800);
    cycleStopRef.current = () => clearInterval(id);
  }, [CURATOR_STATUS_LINES]);
  const stopStatusCycle = React.useCallback(() => {
    cycleStopRef.current?.();
    cycleStopRef.current = null;
  }, []);
  React.useEffect(() => stopStatusCycle, [stopStatusCycle]);

  // Detect first-time vs edit. If a personal agent already exists for
  // this user, treat as edit. Otherwise treat as setup. Pre-fill fields
  // from whatever's already there.
  React.useEffect(() => {
    if (!sdk) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await sdk.agents.list({ limit: 50 });
        const personal = (list.data || []).find(
          (a: any) => a.agent_type === 'personal' || a.agentType === 'personal',
        );
        const stored = await loadPreferences();
        if (cancelled) return;
        if (personal) {
          setIsExistingAgent(true);
          setAgentId(personal.id);
          setName(personal.name || 'Agent');
          setModel((personal as any).ai_model || (personal as any).model || MODELS[0].key);
          setSystemPrompt(
            (personal as any).ai_system_prompt || (personal as any).aiSystemPrompt || DEFAULT_SYSTEM_PROMPT,
          );
        } else {
          setName('Agent');
        }
        setInterests((stored?.free_text_interests as string) || '');
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load');
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
      // 1. Persist client-side preferences (used by buildCuratorRequest)
      setStepMsg('Saving your preferences');
      const stored = await loadPreferences();
      await savePreferences({
        interests: stored?.interests || [],
        free_text_interests: interests.trim() || '',
        vibes: stored?.vibes || [],
        persona: 'curious', // default — persona picker removed; system prompt is the full control surface
        agent_name: name.trim() || undefined,
        paste_sources: stored?.paste_sources || {},
      });

      // 2. Ensure personal agent exists + push name/model/prompt
      setStepMsg('Configuring your agent');
      const ensureRes: any = await (sdk as any).agents.ensurePersonal({
        preferences: {
          interests: stored?.interests || [],
          free_text_interests: interests.trim() || '',
          vibes: stored?.vibes || [],
          // context_document removed for v1 — file-upload UI replaces it.
        },
        overrides: {
          name: name.trim() || undefined,
          model,
          system_prompt: systemPrompt.trim() || null,
        },
      });
      const newAgentId: string | undefined = ensureRes?.data?.agent_id || ensureRes?.data?.id || agentId;
      if (newAgentId && !agentId) setAgentId(newAgentId);

      // 3. Trigger an initial curator run so the feed has content waiting
      //    when they land back. Cycle status lines so the user has
      //    something to read while the curator does its 5-15s thing.
      startStatusCycle();
      try {
        // Fold free-text interests into the interests array so the
        // curator picks them up. buildCuratorRequest only consumes the
        // typed shape — no `free_text_interests` field.
        const freeTextChunks = interests
          .split(/[,\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const mergedInterests = Array.from(new Set([
          ...(stored?.interests || []),
          ...freeTextChunks,
        ]));
        const curatorReq = buildCuratorRequest({
          fresh: true,
          interests: mergedInterests,
          vibes: stored?.vibes || [],
          pasteSources: (stored?.paste_sources as any) || {},
        });
        await (sdk as any).curator.run(curatorReq);
        await markCuratedNow();
      } catch {
        // Curator blip — agent still works, feed will populate on refresh
      } finally {
        stopStatusCycle();
      }

      // 4. Open the DM thread and post the intro if missing. The
      //    helper is idempotent: editing /agent later won't re-post.
      if (newAgentId) {
        setStepMsg('Opening agent chat');
        try {
          await ensureIntroDM(sdk, newAgentId, user?.name);
        } catch (dmErr: any) {
          console.warn('[agent setup] intro DM failed', dmErr);
          setError(`Agent saved, but welcome chat didn't post: ${dmErr?.message || 'unknown error'}`);
        }
        invalidate('conversations');
      }

      // 5. Flag setup complete + back to feed
      await markAgentSetUp();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)' as any);
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
      setStepMsg('');
    }
  };

  const inputBase = {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: typography.body.fontSize,
    borderWidth: 0.5,
    borderColor: colors.border,
  };

  const sectionLabel = (label: string, hint?: string) => (
    <View style={{ gap: 2, marginBottom: spacing.xs }}>
      <Text variant="label" color={colors.textMuted}>{label}</Text>
      {hint ? (
        <Text variant="caption" color={colors.textSecondary} style={{ lineHeight: 18 }}>{hint}</Text>
      ) : null}
    </View>
  );

  return (
    <Container safeTop safeBottom maxWidth={720}>
      <ScreenHeader title={isExistingAgent ? 'Your agent' : 'Set up your agent'} showBack />

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing['4xl'], gap: spacing['2xl'] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Text variant="body" color={colors.textMuted}>Loading…</Text>
        ) : (
          <>
            {!isExistingAgent && (
              <View style={{ gap: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle }}>
                <Text variant="h2" color={colors.text}>Build your AI on Minds</Text>
                <Text variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>
                  Your personal agent works for you and only you. Curates your feed, helps you write, answers questions, and remembers what matters. You control every setting and can change it anytime.
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
                  <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
                  <Text variant="caption" color={colors.textMuted}>
                    Private. Never trains a shared model. Read-only on what you grant.
                  </Text>
                </View>
              </View>
            )}

            <View style={{ gap: spacing.sm }}>
              {sectionLabel('NAME', 'What you call this agent. Appears in chat.')}
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Neo, Sage, Mira"
                placeholderTextColor={colors.textMuted}
                maxLength={48}
                style={inputBase}
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              {sectionLabel('MODEL', "Which AI powers this agent. You can change anytime.")}
              <View style={{ gap: spacing.sm }}>
                {MODELS.map((m) => {
                  const selected = model === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); setModel(m.key); }}
                      style={{
                        padding: spacing.lg,
                        borderRadius: radius.md,
                        borderWidth: 0.5,
                        borderColor: selected ? colors.accent : colors.border,
                        backgroundColor: selected ? colors.surface : 'transparent',
                        gap: 4,
                      }}
                    >
                      <Text variant="bodyMedium" color={selected ? colors.accent : colors.text}>{m.label}</Text>
                      <Text variant="caption" color={colors.textSecondary}>{m.sub}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              {sectionLabel('INTERESTS', "Topics, fields, communities — what should your agent be reading for you?")}
              <TextInput
                value={interests}
                onChangeText={setInterests}
                placeholder="AI agents, biotech, design systems, climate, finance…"
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                style={{ ...inputBase, minHeight: 90 }}
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="label" color={colors.textMuted}>CONTEXT FILES</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
                  <Text variant="caption" color={colors.textMuted}>Private</Text>
                </View>
              </View>
              <Text variant="caption" color={colors.textSecondary} style={{ lineHeight: 18 }}>
                Upload PDFs, docs, or notes your agent should know about you — bio, projects, working style, reference material. Stays private. Never shared.
              </Text>
              {/* File-upload stub. Match the connectors styling so the
                 "coming soon" state is obvious. Wires to a real picker +
                 backend ingestion later. */}
              <View style={{
                padding: spacing.lg, borderRadius: radius.md,
                borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
                alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
                opacity: 0.7,
              }}>
                <Ionicons name="cloud-upload-outline" size={28} color={colors.textMuted} />
                <Text variant="bodyMedium" color={colors.textMuted}>Upload context files</Text>
                <Text variant="caption" color={colors.textSecondary} align="center" style={{ maxWidth: 320 }}>
                  PDF, DOCX, MD, TXT. Coming soon — your agent will index uploads as private context.
                </Text>
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="label" color={colors.textMuted}>SYSTEM PROMPT</Text>
                <Pressable onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync(); setSystemPrompt(DEFAULT_SYSTEM_PROMPT); }} hitSlop={8}>
                  <Text variant="caption" color={colors.accent}>Reset</Text>
                </Pressable>
              </View>
              <Text variant="caption" color={colors.textSecondary} style={{ lineHeight: 18 }}>
                Full control of behavior. Edit anything you'd put in a custom GPT or Claude project.
              </Text>
              <TextInput
                value={systemPrompt}
                onChangeText={setSystemPrompt}
                multiline
                textAlignVertical="top"
                maxLength={16000}
                style={{ ...inputBase, minHeight: 160 }}
              />
            </View>

            {/* Connectors — stubbed for v1. Coming-soon badges set expectation. */}
            <View style={{ gap: spacing.sm }}>
              {sectionLabel('CONNECTORS', "Let your agent read from your accounts. Coming soon.")}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {[
                  { name: 'X / Twitter', icon: 'logo-twitter' },
                  { name: 'YouTube', icon: 'logo-youtube' },
                  { name: 'Spotify', icon: 'musical-notes' },
                  { name: 'GitHub', icon: 'logo-github' },
                  { name: 'Reddit', icon: 'logo-reddit' },
                  { name: 'Gmail', icon: 'mail' },
                ].map((c) => (
                  <View key={c.name} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: spacing.md, paddingVertical: 8,
                    borderRadius: radius.full || 999,
                    borderWidth: 0.5, borderColor: colors.border,
                    opacity: 0.5,
                  }}>
                    <Ionicons name={c.icon as any} size={14} color={colors.textMuted} />
                    <Text variant="caption" color={colors.textMuted}>{c.name}</Text>
                  </View>
                ))}
              </View>
            </View>

            {error ? (
              <Text variant="body" color={colors.error || '#ef4444'}>{error}</Text>
            ) : null}

            <Button onPress={handleSave} fullWidth size="lg" loading={saving} disabled={saving}>
              {saving ? (stepMsg || 'Working…') : isExistingAgent ? 'Save changes' : 'Create my agent'}
            </Button>

            {!isExistingAgent && (
              <Text variant="caption" color={colors.textMuted} align="center" style={{ lineHeight: 18 }}>
                You can change everything later. Curate, chat, or just observe — your agent is yours.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </Container>
  );
}
