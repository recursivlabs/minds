import * as React from 'react';
import { View, ScrollView, TextInput, Pressable, Platform, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/Text';
import { Container } from '../../components/Container';
import { Button } from '../../components/Button';
import { useOnboarding } from '../../lib/onboarding';
import { colors, spacing, radius, typography } from '../../constants/theme';

const MINDS_PLUS_CONNECTIONS = [
  { key: 'youtube', label: 'YouTube', desc: 'Subscriptions and watch history' },
  { key: 'spotify', label: 'Spotify', desc: 'Top artists and podcasts' },
  { key: 'github', label: 'GitHub', desc: 'Stars and follows' },
  { key: 'reddit', label: 'Reddit', desc: 'Subscribed subreddits and saves' },
  { key: 'pocket', label: 'Pocket', desc: 'Saved articles' },
];

const MINDS_PRO_CONNECTIONS = [
  { key: 'x', label: 'X', desc: 'Via third-party aggregator' },
  { key: 'gmail', label: 'Gmail', desc: 'Newsletter inbox only' },
  { key: 'notion', label: 'Notion', desc: 'Knowledge base' },
];

function LockedConnection({ label, desc, tier, onPress }: { label: string; desc: string; tier: 'Minds+' | 'Pro'; onPress: () => void }) {
  const price = tier === 'Minds+' ? '$7/mo' : '$25/mo';
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: radius.md,
        opacity: 0.7,
      }}
    >
      <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{label}</Text>
        <Text variant="caption" color={colors.textMuted}>{desc}</Text>
      </View>
      <View style={{ paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.accentMuted }}>
        <Text variant="caption" color={colors.accent} style={{ fontSize: 11 }}>
          {tier} · {price}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ConnectScreen() {
  const router = useRouter();
  const { state, updateSources } = useOnboarding();
  const [pasteText, setPasteText] = React.useState('');
  const [bluesky, setBluesky] = React.useState(state.pasteSources.bluesky);
  const [upgradeModal, setUpgradeModal] = React.useState<{ tier: 'Minds+' | 'Pro'; label: string } | null>(null);

  const commitPasteSources = () => {
    // Parse newline-separated URLs into rss/substack/youtube/etc.
    const lines = pasteText.split(/\s+/).filter((l) => l.trim().length > 0);
    const rss: string[] = [];
    const substack: string[] = [];
    const youtube: string[] = [];
    for (const url of lines) {
      const lower = url.toLowerCase();
      if (lower.includes('youtube.com/channel') || lower.includes('youtube.com/c/') || lower.includes('youtube.com/@')) {
        youtube.push(url);
      } else if (lower.includes('substack.com')) {
        substack.push(url);
      } else {
        rss.push(url);
      }
    }
    updateSources({ rss, substack, youtube, bluesky: bluesky.trim() });
  };

  const handleContinue = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    commitPasteSources();
    router.push('/onboarding/building');
  };

  const handleSkip = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    router.push('/onboarding/building');
  };

  const openUpgrade = (tier: 'Minds+' | 'Pro', label: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUpgradeModal({ tier, label });
  };

  return (
    <Container safeTop safeBottom padded>
      <View style={{ paddingTop: spacing['2xl'], paddingBottom: spacing.lg }}>
        <Text variant="h2" align="center" style={{ marginBottom: spacing.md }}>
          Connect where you already live.
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 340, alignSelf: 'center', lineHeight: 22 }}>
          More connected, smarter your agent. Read-only. Revoke anytime.
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: spacing.lg, gap: spacing.xl }} showsVerticalScrollIndicator={false}>
        <View>
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.xs }}>
            PASTE LINKS
          </Text>
          <TextInput
            value={pasteText}
            onChangeText={setPasteText}
            placeholder="RSS feeds, Substack URLs, YouTube channel URLs (one per line)"
            placeholderTextColor={colors.textMuted}
            multiline
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              color: colors.text,
              fontSize: typography.body.fontSize,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              minHeight: 100,
              textAlignVertical: 'top',
              marginBottom: spacing.md,
            }}
          />
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.xs }}>
            BLUESKY HANDLE (optional)
          </Text>
          <TextInput
            value={bluesky}
            onChangeText={setBluesky}
            placeholder="yourhandle.bsky.social"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              color: colors.text,
              fontSize: typography.body.fontSize,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
            }}
          />
        </View>

        <View>
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
            CONNECT YOUR ACCOUNTS · UNLOCK WITH MINDS+
          </Text>
          <View style={{ gap: spacing.sm }}>
            {MINDS_PLUS_CONNECTIONS.map((c) => (
              <LockedConnection key={c.key} label={c.label} desc={c.desc} tier="Minds+" onPress={() => openUpgrade('Minds+', c.label)} />
            ))}
          </View>
        </View>

        <View>
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
            POWER CONNECTIONS · UNLOCK WITH PRO
          </Text>
          <View style={{ gap: spacing.sm }}>
            {MINDS_PRO_CONNECTIONS.map((c) => (
              <LockedConnection key={c.key} label={c.label} desc={c.desc} tier="Pro" onPress={() => openUpgrade('Pro', c.label)} />
            ))}
          </View>
        </View>

        <Text variant="caption" color={colors.textMuted} align="center" style={{ marginTop: spacing.md, lineHeight: 18 }}>
          Read-only. Revoke anytime. Scoped to your agent. Never trains a shared model.
        </Text>
      </ScrollView>

      <View style={{ paddingBottom: spacing.xl, gap: spacing.sm }}>
        <Button onPress={handleContinue} fullWidth size="lg">
          Continue
        </Button>
        <Pressable onPress={handleSkip} style={{ alignSelf: 'center', padding: spacing.sm }}>
          <Text variant="body" color={colors.textMuted}>Skip for now</Text>
        </Pressable>
      </View>

      <Modal visible={!!upgradeModal} transparent animationType="fade" onRequestClose={() => setUpgradeModal(null)}>
        <Pressable
          onPress={() => setUpgradeModal(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.bg,
              borderRadius: radius.xl,
              padding: spacing['2xl'],
              maxWidth: 400,
              width: '100%',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text variant="h3" style={{ marginBottom: spacing.md }}>
              {upgradeModal?.label} is on {upgradeModal?.tier}
            </Text>
            <Text variant="body" color={colors.textSecondary} style={{ marginBottom: spacing.xl, lineHeight: 22 }}>
              {upgradeModal?.tier === 'Minds+'
                ? 'Connect your accounts, watch your agent get 10x smarter. $7/mo.'
                : 'Multiple agents, premium connections, train on your voice, API access. $25/mo.'}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Button onPress={() => setUpgradeModal(null)} variant="secondary" fullWidth>
                  Maybe later
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button onPress={() => setUpgradeModal(null)} fullWidth>
                  Upgrade
                </Button>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Container>
  );
}
