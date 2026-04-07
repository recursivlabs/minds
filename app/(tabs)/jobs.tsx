import * as React from 'react';
import { View, ScrollView, Pressable, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card, Skeleton } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius } from '../../constants/theme';

type Job = { id: string; name: string; cron: string; status?: string; handler_code?: string };

export default function JobsScreen() {
  const router = useRouter();
  const { sdk } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [showCreate, setShowCreate] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', cron: '', handler_code: '' });
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const msg = (m: string) => { Platform.OS === 'web' ? alert(m) : Alert.alert('', m); };

  const load = React.useCallback(async () => {
    if (!sdk) return;
    setLoading(true);
    try {
      const res = await (sdk as any).jobs.list();
      setJobs(Array.isArray(res) ? res : res?.jobs || []);
    } catch { setJobs([]); }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!sdk || !form.name || !form.cron) return;
    setSaving(true);
    try {
      await (sdk as any).jobs.create(form);
      setShowCreate(false);
      setForm({ name: '', cron: '', handler_code: '' });
      await load();
    } catch { msg('Failed to create job.'); }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!sdk) return;
    setDeleting(id);
    try {
      await (sdk as any).jobs.delete(id);
      setJobs(j => j.filter(x => x.id !== id));
    } catch { msg('Failed to delete job.'); }
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
        <Text variant="h3" style={{ flex: 1 }}>Scheduled Jobs</Text>
        <Button onPress={() => setShowCreate(!showCreate)} variant="secondary" size="sm">{showCreate ? 'Cancel' : 'New Job'}</Button>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {showCreate && (
          <Card>
            <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Create Job</Text>
            <Input label="Name" value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} placeholder="My cron job" />
            <Input label="Cron schedule" value={form.cron} onChangeText={t => setForm(f => ({ ...f, cron: t }))} placeholder="0 * * * *" autoCapitalize="none" />
            <Input label="Handler code" value={form.handler_code} onChangeText={t => setForm(f => ({ ...f, handler_code: t }))} placeholder="console.log('hello')" multiline numberOfLines={3} autoCapitalize="none" />
            <Button onPress={create} loading={saving} size="sm" disabled={!form.name || !form.cron}>Create</Button>
          </Card>
        )}

        {jobs.length === 0 ? (
          <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
            <Ionicons name="timer-outline" size={40} color={colors.textMuted} />
            <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>No scheduled jobs</Text>
          </View>
        ) : jobs.map(j => (
          <Card key={j.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{j.name}</Text>
                <Text variant="mono" color={colors.textMuted} style={{ marginTop: spacing.xs }}>{j.cron}</Text>
                {j.status && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: j.status === 'active' ? colors.success : colors.textMuted }} />
                    <Text variant="caption" color={colors.textMuted}>{j.status}</Text>
                  </View>
                )}
              </View>
              <Pressable onPress={() => remove(j.id)} disabled={deleting === j.id} hitSlop={8} style={{ opacity: deleting === j.id ? 0.5 : 1, padding: spacing.sm }}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Container>
  );
}
