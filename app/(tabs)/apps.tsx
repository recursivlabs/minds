import * as React from 'react';
import { View, ScrollView, Pressable, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card, Skeleton } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { colors, spacing, radius } from '../../constants/theme';

type Project = { id: string; name: string; description?: string; status?: string; subdomain?: string };

function StatusDot({ status }: { status?: string }) {
  const c = status === 'deployed' ? colors.success : status === 'building' ? colors.warning : colors.textMuted;
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />;
}

export default function AppsScreen() {
  const router = useRouter();
  const { sdk } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [detail, setDetail] = React.useState<any>(null);
  const [deployments, setDeployments] = React.useState<any[]>([]);
  const [showCreate, setShowCreate] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', description: '' });
  const [saving, setSaving] = React.useState(false);
  const [deploying, setDeploying] = React.useState(false);

  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);
  const showSuccess = (m: string) => { setStatusMsg(m); setTimeout(() => setStatusMsg(null), 2000); };
  const showError = (m: string) => { Alert.alert('Error', m); };

  const load = React.useCallback(async () => {
    if (!sdk) return;
    setLoading(true);
    try {
      const res = await (sdk as any).projects.list({ organization_id: ORG_ID });
      setProjects(Array.isArray(res) ? res : res?.projects || []);
    } catch { setProjects([]); }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!sdk || !form.name) return;
    setSaving(true);
    try {
      await (sdk as any).projects.create({ name: form.name, organization_id: ORG_ID });
      setShowCreate(false);
      setForm({ name: '', description: '' });
      await load();
    } catch { showError('Failed to create app.'); }
    setSaving(false);
  };

  const openDetail = async (id: string) => {
    if (!sdk) return;
    try {
      const [p, d] = await Promise.all([
        (sdk as any).projects.get(id).catch(() => null),
        (sdk as any).projects.deployments(id).catch(() => []),
      ]);
      setDetail(p);
      setDeployments(Array.isArray(d) ? d : d?.deployments || []);
    } catch { showError('Failed to load app details.'); }
  };

  const deploy = async (id: string) => {
    if (!sdk) return;
    setDeploying(true);
    try {
      await (sdk as any).projects.deploy(id, { type: 'production' });
      showSuccess('Deployment started.');
      await openDetail(id);
    } catch { showError('Failed to deploy.'); }
    setDeploying(false);
  };

  if (loading) {
    return (
      <Container safeTop>
        <View style={{ paddingTop: spacing['3xl'], gap: spacing.xl, paddingHorizontal: spacing.xl }}>
          <Skeleton height={80} /><Skeleton height={80} /><Skeleton height={80} />
        </View>
      </Container>
    );
  }

  if (detail) {
    return (
      <Container safeTop padded={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle }}>
          <Pressable onPress={() => { setDetail(null); setDeployments([]); }} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ flex: 1 }} numberOfLines={1}>{detail.name}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }} showsVerticalScrollIndicator={false}>
          {statusMsg && (
            <View style={{ backgroundColor: colors.successMuted, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' }}>
              <Text variant="body" color={colors.success}>{statusMsg}</Text>
            </View>
          )}
          <Card>
            <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>App Info</Text>
            <Text variant="body">{detail.name}</Text>
            {detail.subdomain && <Text variant="caption" color={colors.accent} style={{ marginTop: spacing.xs }}>{detail.subdomain}</Text>}
            {detail.description && <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>{detail.description}</Text>}
            <View style={{ marginTop: spacing.lg }}>
              <Button onPress={() => deploy(detail.id)} loading={deploying} size="sm">Deploy to Production</Button>
            </View>
          </Card>
          <Card>
            <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Deployments</Text>
            {deployments.length === 0 ? (
              <Text variant="caption" color={colors.textMuted}>No deployments yet.</Text>
            ) : deployments.map((d: any, i: number) => (
              <View key={d.id || i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: i > 0 ? 0.5 : 0, borderTopColor: colors.borderSubtle }}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">{d.type || d.environment || 'production'}</Text>
                  <Text variant="caption" color={colors.textMuted}>{d.created_at ? new Date(d.created_at).toLocaleDateString() : ''}</Text>
                </View>
                <StatusDot status={d.status} />
              </View>
            ))}
          </Card>
        </ScrollView>
      </Container>
    );
  }

  return (
    <Container safeTop padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h3" style={{ flex: 1 }}>Apps</Text>
        <Button onPress={() => setShowCreate(!showCreate)} variant="secondary" size="sm">{showCreate ? 'Cancel' : 'New App'}</Button>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {showCreate && (
          <Card>
            <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Create App</Text>
            <Input label="App name" value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} placeholder="My app" />
            <Button onPress={create} loading={saving} size="sm" disabled={!form.name}>Create</Button>
          </Card>
        )}
        {projects.length === 0 ? (
          <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
            <Ionicons name="cube-outline" size={40} color={colors.textMuted} />
            <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>No apps yet</Text>
          </View>
        ) : projects.map(p => (
          <Pressable key={p.id} onPress={() => openDetail(p.id)} style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 0.5, borderColor: colors.glassBorder }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <StatusDot status={p.status} />
              <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>{p.name}</Text>
            </View>
            {p.subdomain && <Text variant="caption" color={colors.accent} style={{ marginTop: spacing.xs }}>{p.subdomain}</Text>}
          </Pressable>
        ))}
      </ScrollView>
    </Container>
  );
}
