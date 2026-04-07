import * as React from 'react';
import { View, ScrollView, Pressable, Platform, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card, Skeleton } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius } from '../../constants/theme';

type Protocol = { id: string; name: string; enabled: boolean; type?: string };

export default function ProtocolsScreen() {
  const router = useRouter();
  const { sdk } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [protocols, setProtocols] = React.useState<Protocol[]>([]);
  const [settings, setSettings] = React.useState<any>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [tab, setTab] = React.useState<'protocols' | 'search' | 'settings'>('protocols');
  const [saving, setSaving] = React.useState(false);

  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);
  const showSuccess = (m: string) => { setStatusMsg(m); setTimeout(() => setStatusMsg(null), 2000); };
  const showError = (m: string) => { Alert.alert('Error', m); };

  const load = React.useCallback(async () => {
    if (!sdk) return;
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        (sdk as any).protocols.list().catch(() => []),
        (sdk as any).protocols.getSettings().catch(() => null),
      ]);
      setProtocols(Array.isArray(p) ? p : p?.protocols || []);
      setSettings(s);
    } catch {}
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const search = async () => {
    if (!sdk || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await (sdk as any).protocols.search({ query: searchQuery });
      setSearchResults(Array.isArray(res) ? res : res?.results || []);
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  const saveSettings = async () => {
    if (!sdk || !settings) return;
    setSaving(true);
    try {
      await (sdk as any).protocols.updateSettings(settings);
      showSuccess('Settings saved.');
    } catch { showError('Failed to save settings.'); }
    setSaving(false);
  };

  const tabs = ['protocols', 'search', 'settings'] as const;

  if (loading) {
    return (
      <Container safeTop>
        <View style={{ paddingTop: spacing['3xl'], gap: spacing.xl, paddingHorizontal: spacing.xl }}>
          <Skeleton height={60} /><Skeleton height={60} /><Skeleton height={60} />
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
        <Text variant="h3" style={{ flex: 1 }}>Federation</Text>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md }}>
        {tabs.map(t => (
          <Pressable key={t} onPress={() => setTab(t)} style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: tab === t ? colors.accentMuted : 'transparent' }}>
            <Text variant="caption" color={tab === t ? colors.accent : colors.textMuted} style={{ textTransform: 'capitalize' }}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {tab === 'protocols' && (
          <>
            {protocols.length === 0 ? (
              <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
                <Ionicons name="globe-outline" size={40} color={colors.textMuted} />
                <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>No protocols configured</Text>
              </View>
            ) : protocols.map(p => (
              <Card key={p.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{p.name}</Text>
                    {p.type && <Text variant="caption" color={colors.textMuted}>{p.type}</Text>}
                  </View>
                  <View style={{ backgroundColor: p.enabled ? colors.successMuted : colors.glass, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
                    <Text variant="caption" color={p.enabled ? colors.success : colors.textMuted} style={{ fontSize: 11 }}>{p.enabled ? 'On' : 'Off'}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}

        {tab === 'search' && (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Input value={searchQuery} onChangeText={setSearchQuery} placeholder="Search federated content..." />
              </View>
              <Button onPress={search} loading={searching} size="sm">Search</Button>
            </View>
            {searchResults.length === 0 ? (
              <Text variant="caption" color={colors.textMuted} align="center">
                {searching ? 'Searching...' : 'Search ActivityPub, RSS, and Nostr content'}
              </Text>
            ) : searchResults.map((r: any, i: number) => (
              <Card key={r.id || i}>
                <Text variant="bodyMedium" numberOfLines={2}>{r.title || r.content?.slice(0, 100) || 'Untitled'}</Text>
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>{r.author || r.source || 'Unknown source'}</Text>
                {r.protocol && <Text variant="caption" color={colors.accent} style={{ marginTop: spacing.xs }}>{r.protocol}</Text>}
              </Card>
            ))}
          </>
        )}

        {tab === 'settings' && settings && (
          <Card>
            <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Protocol Settings</Text>
            {Object.entries(settings).filter(([k]) => typeof settings[k] === 'boolean').map(([key, val]) => (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
                <Text variant="body" style={{ flex: 1 }}>{key.replace(/_/g, ' ')}</Text>
                <Switch
                  value={val as boolean}
                  onValueChange={v => setSettings((s: any) => ({ ...s, [key]: v }))}
                  trackColor={{ true: colors.accent, false: colors.glass }}
                  thumbColor={colors.text}
                />
              </View>
            ))}
            <View style={{ marginTop: spacing.lg }}>
              <Button onPress={saveSettings} loading={saving} size="sm">Save Settings</Button>
            </View>
          </Card>
        )}
      </ScrollView>
    </Container>
  );
}
