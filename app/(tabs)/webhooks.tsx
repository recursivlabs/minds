import * as React from 'react';
import { View, ScrollView, Pressable, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card, Skeleton } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius } from '../../constants/theme';

type Webhook = { id: string; url: string; event_types?: string[]; events?: string[]; active?: boolean };

export default function WebhooksScreen() {
  const router = useRouter();
  const { sdk } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [webhooks, setWebhooks] = React.useState<Webhook[]>([]);
  const [showCreate, setShowCreate] = React.useState(false);
  const [url, setUrl] = React.useState('');
  const [events, setEvents] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const showError = (m: string) => { Alert.alert('Error', m); };

  const load = React.useCallback(async () => {
    if (!sdk) return;
    setLoading(true);
    try {
      const res = await (sdk as any).webhooks.list();
      setWebhooks(Array.isArray(res) ? res : res?.webhooks || []);
    } catch { setWebhooks([]); }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!sdk || !url.trim()) return;
    setSaving(true);
    try {
      const event_types = events.split(',').map(e => e.trim()).filter(Boolean);
      await (sdk as any).webhooks.register({ url, event_types });
      setShowCreate(false);
      setUrl('');
      setEvents('');
      await load();
    } catch { showError('Failed to register webhook.'); }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!sdk) return;
    setDeleting(id);
    try {
      await (sdk as any).webhooks.delete(id);
      setWebhooks(w => w.filter(x => x.id !== id));
    } catch { showError('Failed to delete webhook.'); }
    setDeleting(null);
  };

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
        <Text variant="h3" style={{ flex: 1 }}>Webhooks</Text>
        <Button onPress={() => setShowCreate(!showCreate)} variant="secondary" size="sm">{showCreate ? 'Cancel' : 'New'}</Button>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {showCreate && (
          <Card>
            <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Register Webhook</Text>
            <Input label="URL" value={url} onChangeText={setUrl} placeholder="https://example.com/webhook" autoCapitalize="none" keyboardType="url" />
            <Input label="Event types (comma separated)" value={events} onChangeText={setEvents} placeholder="post.created, user.signup" autoCapitalize="none" />
            <Button onPress={create} loading={saving} size="sm" disabled={!url.trim()}>Register</Button>
          </Card>
        )}

        {webhooks.length === 0 ? (
          <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
            <Ionicons name="link-outline" size={40} color={colors.textMuted} />
            <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>No webhooks registered</Text>
          </View>
        ) : webhooks.map(w => (
          <Card key={w.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" numberOfLines={1}>{w.url}</Text>
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
                  {(w.event_types || w.events || []).join(', ') || 'All events'}
                </Text>
              </View>
              <Pressable onPress={() => remove(w.id)} disabled={deleting === w.id} hitSlop={8} style={{ opacity: deleting === w.id ? 0.5 : 1, padding: spacing.sm }}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Container>
  );
}
