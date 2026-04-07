import * as React from 'react';
import { View, ScrollView, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Card, Skeleton } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { colors, spacing } from '../../constants/theme';

export default function InvitesScreen() {
  const router = useRouter();
  const { sdk } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [codes, setCodes] = React.useState<any[]>([]);
  const [leaderboard, setLeaderboard] = React.useState<any[]>([]);
  const [generating, setGenerating] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!sdk) return;
    setLoading(true);
    try {
      const [myCodes, lb] = await Promise.all([
        sdk.inviteCodes.myCodes().catch(() => []),
        sdk.inviteCodes.leaderboard(10).catch(() => []),
      ]);
      setCodes(Array.isArray(myCodes) ? myCodes : myCodes?.codes || []);
      setLeaderboard(Array.isArray(lb) ? lb : lb?.entries || []);
    } catch {}
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (!sdk) return;
    setGenerating(true);
    try {
      await sdk.inviteCodes.generate(1);
      await load();
    } catch {
      import('react-native').then(rn => rn.Alert.alert('Error', 'Failed to generate invite code.'));
    }
    setGenerating(false);
  };

  const copyCode = async (code: string) => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(code);
      } else {
        const Clipboard = await import('expo-clipboard').then(m => m.default || m);
        await Clipboard.setStringAsync(code);
      }
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  if (loading) {
    return (
      <Container safeTop>
        <View style={{ paddingTop: spacing['3xl'], gap: spacing.xl, paddingHorizontal: spacing.xl }}>
          <Skeleton height={100} />
          <Skeleton height={60} />
          <Skeleton height={60} />
        </View>
      </Container>
    );
  }

  return (
    <Container safeTop padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h3" style={{ flex: 1 }}>Invites</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['5xl'] }}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text variant="label" color={colors.textMuted}>Your Invite Codes</Text>
            <Button onPress={generate} loading={generating} variant="secondary" size="sm">Generate Code</Button>
          </View>
          {codes.length === 0 ? (
            <Text variant="caption" color={colors.textMuted}>No invite codes yet. Generate one to invite friends.</Text>
          ) : codes.map((c: any, i: number) => {
            const code = c.code || c.id || c;
            const used = c.used ?? c.redeemed ?? false;
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: i > 0 ? 0.5 : 0, borderTopColor: colors.borderSubtle }}>
                <View style={{ flex: 1 }}>
                  <Text variant="mono" color={used ? colors.textMuted : colors.text}>{typeof code === 'string' ? code : JSON.stringify(code)}</Text>
                  {used && <Text variant="caption" color={colors.textMuted}>Used</Text>}
                </View>
                {!used && (
                  <Pressable onPress={() => copyCode(typeof code === 'string' ? code : '')} hitSlop={8}>
                    <Ionicons name={copied === code ? 'checkmark' : 'copy-outline'} size={18} color={copied === code ? colors.success : colors.textSecondary} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </Card>

        <Card>
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Invite Leaderboard</Text>
          {leaderboard.length === 0 ? (
            <Text variant="caption" color={colors.textMuted}>No leaderboard data yet.</Text>
          ) : leaderboard.map((entry: any, i: number) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: i > 0 ? 0.5 : 0, borderTopColor: colors.borderSubtle }}>
              <Text variant="bodyMedium" color={i < 3 ? colors.accent : colors.textMuted} style={{ width: 28 }}>#{i + 1}</Text>
              <Text variant="body" style={{ flex: 1 }}>{entry.name || entry.username || entry.user?.name || 'User'}</Text>
              <Text variant="bodyMedium" color={colors.accent}>{entry.count ?? entry.invites ?? 0}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </Container>
  );
}
