import * as React from 'react';
import { View, ScrollView, Pressable, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card, Skeleton } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius } from '../../constants/theme';

type Campaign = { id: string; name: string; subject: string; status: string; from_email?: string };

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    draft: { bg: colors.glass, text: colors.textMuted },
    sending: { bg: colors.warningMuted, text: colors.warning },
    sent: { bg: colors.successMuted, text: colors.success },
    paused: { bg: colors.errorMuted, text: colors.error },
    active: { bg: colors.successMuted, text: colors.success },
  };
  const s = map[status] || map.draft;
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
      <Text variant="caption" color={s.text} style={{ fontSize: 11 }}>{status}</Text>
    </View>
  );
}

export default function EmailScreen() {
  const router = useRouter();
  const { sdk } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [detail, setDetail] = React.useState<any>(null);
  const [stats, setStats] = React.useState<any>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', subject: '', from_email: '', html_content: '' });
  const [saving, setSaving] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState('');

  const showError = (m: string) => { Alert.alert('Error', m); };

  const load = React.useCallback(async () => {
    if (!sdk) return;
    setLoading(true);
    try {
      const res = await sdk.email.listCampaigns();
      setCampaigns(Array.isArray(res) ? res : res?.campaigns || []);
    } catch { setCampaigns([]); }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!sdk || !form.name || !form.subject) return;
    setSaving(true);
    try {
      await sdk.email.createCampaign(form);
      setShowCreate(false);
      setForm({ name: '', subject: '', from_email: '', html_content: '' });
      await load();
    } catch { showError('Failed to create campaign.'); }
    setSaving(false);
  };

  const openDetail = async (id: string) => {
    if (!sdk) return;
    try {
      const [d, s] = await Promise.all([
        sdk.email.getCampaign(id).catch(() => null),
        sdk.email.getCampaignStats(id).catch(() => null),
      ]);
      setDetail(d);
      setStats(s);
    } catch { showError('Failed to load campaign.'); }
  };

  const campaignAction = async (id: string, action: 'start' | 'pause' | 'resume') => {
    if (!sdk) return;
    setActionLoading(action);
    try {
      await sdk.email[`${action}Campaign`](id);
      await openDetail(id);
      await load();
    } catch { msg(`Failed to ${action} campaign.`); }
    setActionLoading('');
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

  if (detail) {
    return (
      <Container safeTop padded={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle }}>
          <Pressable onPress={() => { setDetail(null); setStats(null); }} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ flex: 1 }} numberOfLines={1}>{detail.name || 'Campaign'}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text variant="label" color={colors.textMuted}>Status</Text>
              <StatusBadge status={detail.status || 'draft'} />
            </View>
            <Text variant="body" color={colors.textSecondary}>Subject: {detail.subject}</Text>
            {detail.from_email && <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>From: {detail.from_email}</Text>}
          </Card>
          {stats && (
            <Card>
              <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Stats</Text>
              {['sent', 'delivered', 'opened', 'clicked', 'bounced'].map(k => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
                  <Text variant="body" style={{ textTransform: 'capitalize' }}>{k}</Text>
                  <Text variant="bodyMedium" color={colors.accent}>{stats[k] ?? 0}</Text>
                </View>
              ))}
            </Card>
          )}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {(detail.status === 'draft' || detail.status === 'paused') && (
              <Button onPress={() => campaignAction(detail.id, detail.status === 'draft' ? 'start' : 'resume')} loading={actionLoading === 'start' || actionLoading === 'resume'} size="sm">
                {detail.status === 'draft' ? 'Start' : 'Resume'}
              </Button>
            )}
            {(detail.status === 'sending' || detail.status === 'active') && (
              <Button onPress={() => campaignAction(detail.id, 'pause')} loading={actionLoading === 'pause'} variant="secondary" size="sm">Pause</Button>
            )}
          </View>
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
        <Text variant="h3" style={{ flex: 1 }}>Email Campaigns</Text>
        <Button onPress={() => setShowCreate(!showCreate)} variant="secondary" size="sm">{showCreate ? 'Cancel' : 'New'}</Button>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {showCreate && (
          <Card>
            <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Create Campaign</Text>
            <Input label="Name" value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} placeholder="Campaign name" />
            <Input label="Subject" value={form.subject} onChangeText={t => setForm(f => ({ ...f, subject: t }))} placeholder="Email subject" />
            <Input label="From email" value={form.from_email} onChangeText={t => setForm(f => ({ ...f, from_email: t }))} placeholder="from@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Input label="HTML content" value={form.html_content} onChangeText={t => setForm(f => ({ ...f, html_content: t }))} placeholder="<h1>Hello</h1>" multiline numberOfLines={3} />
            <Button onPress={create} loading={saving} size="sm" disabled={!form.name || !form.subject}>Create</Button>
          </Card>
        )}
        {campaigns.length === 0 ? (
          <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
            <Ionicons name="mail-outline" size={40} color={colors.textMuted} />
            <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>No campaigns yet</Text>
          </View>
        ) : campaigns.map(c => (
          <Pressable key={c.id} onPress={() => openDetail(c.id)} style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 0.5, borderColor: colors.glassBorder }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>{c.name}</Text>
              <StatusBadge status={c.status || 'draft'} />
            </View>
            <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ marginTop: spacing.xs }}>{c.subject}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Container>
  );
}
