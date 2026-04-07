import * as React from 'react';
import { View, ScrollView, Pressable, Platform, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card, Skeleton, Divider } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius, typography } from '../../constants/theme';

type Tab = 'dashboard' | 'users' | 'content' | 'invites' | 'network';

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.sm,
        backgroundColor: active ? colors.accentMuted : 'transparent',
      }}
    >
      <Text variant="caption" color={active ? colors.accent : colors.textMuted}>{label}</Text>
    </Pressable>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card style={{ flex: 1, minWidth: 100 }}>
      <Text variant="h2" color={colors.accent}>{value}</Text>
      <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>{label}</Text>
    </Card>
  );
}

/* ─── Dashboard ─── */
function DashboardTab({ sdk }: { sdk: any }) {
  const [stats, setStats] = React.useState<any>(null);
  const [signups, setSignups] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const [s, su] = await Promise.all([
          sdk.admin.stats().catch(() => null),
          sdk.admin.signupsByDay({ days: 14 }).catch(() => []),
        ]);
        setStats(s);
        setSignups(Array.isArray(su) ? su : su?.days || []);
      } catch {}
      setLoading(false);
    })();
  }, [sdk]);

  if (loading) return <View style={{ gap: spacing.xl }}><Skeleton height={80} /><Skeleton height={120} /></View>;

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
        <StatCard label="Users" value={stats?.users ?? stats?.totalUsers ?? 0} />
        <StatCard label="Posts" value={stats?.posts ?? stats?.totalPosts ?? 0} />
        <StatCard label="Communities" value={stats?.communities ?? stats?.totalCommunities ?? 0} />
      </View>
      <Card>
        <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Signups (14 days)</Text>
        {signups.length === 0 ? (
          <Text variant="caption" color={colors.textMuted}>No signup data.</Text>
        ) : (
          <View style={{ gap: spacing.xs }}>
            {signups.map((d: any, i: number) => {
              const count = d.count ?? d.signups ?? 0;
              const maxCount = Math.max(...signups.map((x: any) => x.count ?? x.signups ?? 0), 1);
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text variant="caption" color={colors.textMuted} style={{ width: 60, fontSize: 10 }}>
                    {d.date ? new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `Day ${i + 1}`}
                  </Text>
                  <View style={{ flex: 1, height: 14, backgroundColor: colors.glass, borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ height: 14, width: `${(count / maxCount) * 100}%` as any, backgroundColor: colors.accent, borderRadius: 3 }} />
                  </View>
                  <Text variant="caption" color={colors.accent} style={{ width: 28, textAlign: 'right', fontSize: 11 }}>{count}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>
    </View>
  );
}

/* ─── Users ─── */
function UsersTab({ sdk }: { sdk: any }) {
  const [users, setUsers] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [actionId, setActionId] = React.useState('');

  const msg = (m: string) => { Platform.OS === 'web' ? alert(m) : Alert.alert('', m); };

  const load = React.useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const res = await sdk.admin.listUsers({ search: q || undefined, limit: 50 });
      setUsers(Array.isArray(res) ? res : res?.users || []);
    } catch { setUsers([]); }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const doSearch = () => load(search);

  const banUser = async (id: string) => {
    setActionId(id);
    try { await sdk.admin.banUser(id, { reason: 'Admin action' }); await load(search); } catch { msg('Failed.'); }
    setActionId('');
  };

  const unbanUser = async (id: string) => {
    setActionId(id);
    try { await sdk.admin.unbanUser(id); await load(search); } catch { msg('Failed.'); }
    setActionId('');
  };

  const setRole = async (id: string, role: string) => {
    setActionId(id);
    try { await sdk.admin.setUserRole(id, role); await load(search); } catch { msg('Failed.'); }
    setActionId('');
  };

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Input value={search} onChangeText={setSearch} placeholder="Search users..." />
        </View>
        <Button onPress={doSearch} size="sm">Search</Button>
      </View>
      {loading ? <Skeleton height={200} /> : users.length === 0 ? (
        <Text variant="caption" color={colors.textMuted} align="center">No users found.</Text>
      ) : users.map((u: any) => (
        <Card key={u.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">{u.name || u.username || 'User'}</Text>
              <Text variant="caption" color={colors.textMuted}>{u.email} {u.role ? `- ${u.role}` : ''}</Text>
              {u.banned && <Text variant="caption" color={colors.error}>Banned</Text>}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {u.banned ? (
                <Button onPress={() => unbanUser(u.id)} variant="ghost" size="sm" loading={actionId === u.id}>Unban</Button>
              ) : (
                <Button onPress={() => banUser(u.id)} variant="ghost" size="sm" accentColor={colors.error} loading={actionId === u.id}>Ban</Button>
              )}
              {u.role !== 'admin' && (
                <Button onPress={() => setRole(u.id, 'admin')} variant="ghost" size="sm" loading={actionId === u.id}>Make Admin</Button>
              )}
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

/* ─── Content ─── */
function ContentTab({ sdk }: { sdk: any }) {
  const [posts, setPosts] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [deletingId, setDeletingId] = React.useState('');

  const msg = (m: string) => { Platform.OS === 'web' ? alert(m) : Alert.alert('', m); };

  const load = React.useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const res = await sdk.admin.listPosts({ search: q || undefined, limit: 50 });
      setPosts(Array.isArray(res) ? res : res?.posts || []);
    } catch { setPosts([]); }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const deletePost = async (id: string) => {
    setDeletingId(id);
    try { await sdk.admin.deletePost(id); setPosts(p => p.filter(x => x.id !== id)); } catch { msg('Failed.'); }
    setDeletingId('');
  };

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Input value={search} onChangeText={setSearch} placeholder="Search posts..." />
        </View>
        <Button onPress={() => load(search)} size="sm">Search</Button>
      </View>
      {loading ? <Skeleton height={200} /> : posts.length === 0 ? (
        <Text variant="caption" color={colors.textMuted} align="center">No posts found.</Text>
      ) : posts.map((p: any) => (
        <Card key={p.id}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" numberOfLines={2}>{p.title || p.content?.slice(0, 100) || 'Untitled'}</Text>
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
                {p.author?.name || 'Unknown'} {p.created_at ? `- ${new Date(p.created_at).toLocaleDateString()}` : ''}
              </Text>
            </View>
            <Pressable onPress={() => deletePost(p.id)} disabled={deletingId === p.id} hitSlop={8} style={{ opacity: deletingId === p.id ? 0.5 : 1, padding: spacing.sm }}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </Pressable>
          </View>
        </Card>
      ))}
    </View>
  );
}

/* ─── Invites ─── */
function InvitesTab({ sdk }: { sdk: any }) {
  const [codes, setCodes] = React.useState<any[]>([]);
  const [waitlist, setWaitlist] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionId, setActionId] = React.useState('');

  const msg = (m: string) => { Platform.OS === 'web' ? alert(m) : Alert.alert('', m); };

  React.useEffect(() => {
    (async () => {
      try {
        const [c, w] = await Promise.all([
          sdk.admin.listInviteCodes({ status: 'all' }).catch(() => []),
          sdk.admin.listWaitlist({ status: 'pending' }).catch(() => []),
        ]);
        setCodes(Array.isArray(c) ? c : c?.codes || []);
        setWaitlist(Array.isArray(w) ? w : w?.entries || []);
      } catch {}
      setLoading(false);
    })();
  }, [sdk]);

  const revoke = async (id: string) => {
    setActionId(id);
    try { await sdk.admin.revokeInviteCode(id); setCodes(c => c.map(x => x.id === id ? { ...x, status: 'revoked' } : x)); } catch { msg('Failed.'); }
    setActionId('');
  };

  const grant = async (id: string) => {
    setActionId(id);
    try { await sdk.admin.grantWaitlistAccess(id); setWaitlist(w => w.filter(x => x.id !== id)); } catch { msg('Failed.'); }
    setActionId('');
  };

  if (loading) return <Skeleton height={200} />;

  return (
    <View style={{ gap: spacing.xl }}>
      <Card>
        <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Invite Codes</Text>
        {codes.length === 0 ? (
          <Text variant="caption" color={colors.textMuted}>No invite codes.</Text>
        ) : codes.slice(0, 30).map((c: any) => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }}>
            <View style={{ flex: 1 }}>
              <Text variant="mono" numberOfLines={1}>{c.code || c.id}</Text>
              <Text variant="caption" color={colors.textMuted}>{c.status || (c.used ? 'used' : 'active')}</Text>
            </View>
            {(!c.used && c.status !== 'revoked') && (
              <Button onPress={() => revoke(c.id)} variant="ghost" size="sm" accentColor={colors.error} loading={actionId === c.id}>Revoke</Button>
            )}
          </View>
        ))}
      </Card>
      <Card>
        <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Waitlist</Text>
        {waitlist.length === 0 ? (
          <Text variant="caption" color={colors.textMuted}>No pending waitlist entries.</Text>
        ) : waitlist.map((w: any) => (
          <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">{w.email || w.name || 'User'}</Text>
              {w.created_at && <Text variant="caption" color={colors.textMuted}>{new Date(w.created_at).toLocaleDateString()}</Text>}
            </View>
            <Button onPress={() => grant(w.id)} size="sm" loading={actionId === w.id}>Grant Access</Button>
          </View>
        ))}
      </Card>
    </View>
  );
}

/* ─── Network ─── */
function NetworkTab({ sdk }: { sdk: any }) {
  const [settings, setSettings] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const msg = (m: string) => { Platform.OS === 'web' ? alert(m) : Alert.alert('', m); };

  React.useEffect(() => {
    (async () => {
      try {
        const s = await sdk.admin.getNetworkSettings();
        setSettings(s);
      } catch {}
      setLoading(false);
    })();
  }, [sdk]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try { await sdk.admin.updateNetworkSettings(settings); msg('Settings saved.'); } catch { msg('Failed.'); }
    setSaving(false);
  };

  if (loading) return <Skeleton height={200} />;
  if (!settings) return <Text variant="caption" color={colors.textMuted} align="center">Could not load network settings.</Text>;

  return (
    <View style={{ gap: spacing.xl }}>
      <Card>
        <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Network Configuration</Text>
        <Input label="Network name" value={settings.name || ''} onChangeText={t => setSettings((s: any) => ({ ...s, name: t }))} placeholder="Minds" />
        <Input label="Description" value={settings.description || ''} onChangeText={t => setSettings((s: any) => ({ ...s, description: t }))} placeholder="A free speech social network" multiline />
        <Input label="Logo URL" value={settings.logo_url || settings.logo || ''} onChangeText={t => setSettings((s: any) => ({ ...s, logo_url: t }))} placeholder="https://..." autoCapitalize="none" />
        <Input label="Primary color" value={settings.primary_color || settings.accent_color || ''} onChangeText={t => setSettings((s: any) => ({ ...s, primary_color: t }))} placeholder="#d4a844" autoCapitalize="none" />
        <Button onPress={save} loading={saving} size="sm">Save Network Settings</Button>
      </Card>
    </View>
  );
}

/* ─── Main ─── */
export default function AdminScreen() {
  const router = useRouter();
  const { sdk } = useAuth();
  const [tab, setTab] = React.useState<Tab>('dashboard');

  if (!sdk) {
    return (
      <Container safeTop centered>
        <Text variant="body" color={colors.textMuted}>Sign in to access admin.</Text>
      </Container>
    );
  }

  return (
    <Container safeTop padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h3" style={{ flex: 1 }}>Admin</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm }}>
        {(['dashboard', 'users', 'content', 'invites', 'network'] as Tab[]).map(t => (
          <TabButton key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} active={tab === t} onPress={() => setTab(t)} />
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {tab === 'dashboard' && <DashboardTab sdk={sdk} />}
        {tab === 'users' && <UsersTab sdk={sdk} />}
        {tab === 'content' && <ContentTab sdk={sdk} />}
        {tab === 'invites' && <InvitesTab sdk={sdk} />}
        {tab === 'network' && <NetworkTab sdk={sdk} />}
      </ScrollView>
    </Container>
  );
}
