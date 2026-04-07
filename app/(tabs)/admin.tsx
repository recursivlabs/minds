import * as React from 'react';
import { View, ScrollView, Pressable, Platform, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card, Skeleton, Divider } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { colors, spacing, radius, typography } from '../../constants/theme';

type Tab = 'ai' | 'dashboard' | 'users' | 'content' | 'invites' | 'network';

const BUSINESS_AI_AGENT_ID = '411ac3a9-dfbc-4463-8963-2e26a645211e';

/* --- AI Chat --- */
function AITab({ sdk }: { sdk: any }) {
  const [messages, setMessages] = React.useState<{ role: 'user' | 'agent'; text: string }[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setSending(true);
    try {
      const res = await (sdk as any).agents.chat(BUSINESS_AI_AGENT_ID, { message: msg });
      const data = res?.data || res;
      const reply = data?.content || data?.message || data?.response || (typeof data === 'string' ? data : 'No response');
      setMessages(prev => [...prev, { role: 'agent', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'agent', text: 'Failed to get response from AI.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, gap: spacing.md }}>
      <View style={{ flex: 1, gap: spacing.sm }}>
        {messages.length === 0 && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
            <Ionicons name="sparkles" size={32} color={colors.textMuted} />
            <Text variant="body" color={colors.textSecondary} align="center">Minds Business AI</Text>
            <Text variant="caption" color={colors.textMuted} align="center" style={{ maxWidth: 280 }}>
              Ask anything about your network, analytics, or strategy.
            </Text>
          </View>
        )}
        {messages.map((m, i) => (
          <View
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              backgroundColor: m.role === 'user' ? colors.accent : colors.surface,
              borderRadius: radius.md,
              padding: spacing.md,
              maxWidth: '80%' as any,
              borderWidth: m.role === 'agent' ? 0.5 : 0,
              borderColor: colors.glassBorder,
            }}
          >
            <Text variant="body" color={m.role === 'user' ? colors.textInverse : colors.text}>
              {m.text}
            </Text>
          </View>
        ))}
        {sending && (
          <View style={{ alignSelf: 'flex-start', padding: spacing.md }}>
            <Text variant="caption" color={colors.textMuted}>Thinking...</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <TextInput
          placeholder="Ask the AI..."
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            color: colors.text,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
          }}
        />
        <Pressable
          onPress={handleSend}
          disabled={!input.trim() || sending}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: input.trim() ? colors.accent : colors.surfaceHover,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="send" size={16} color={input.trim() ? '#fff' : colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

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

/* --- Dashboard --- */
function DashboardTab({ sdk }: { sdk: any }) {
  const [stats, setStats] = React.useState<any>(null);
  const [signups, setSignups] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        // Try org-scoped admin stats first
        let s: any = null;
        try {
          s = await sdk.admin.stats({ organization_id: ORG_ID || undefined });
        } catch {
          try { s = await sdk.admin.stats(); } catch {}
        }
        // Try org members count as fallback for user count
        if (!s && ORG_ID) {
          try {
            const membersRes = await sdk.organizations.members(ORG_ID, { limit: 1 });
            const postsRes = await sdk.posts.list({ limit: 1, organization_id: ORG_ID });
            const commRes = await sdk.communities.list({ limit: 1, organization_id: ORG_ID });
            s = {
              users: membersRes.meta?.total ?? membersRes.data?.length ?? 0,
              posts: postsRes.meta?.total ?? postsRes.data?.length ?? 0,
              communities: commRes.meta?.total ?? commRes.data?.length ?? 0,
            };
          } catch {}
        }
        setStats(s);

        let su: any = [];
        try {
          su = await sdk.admin.signupsByDay({ days: 14, organization_id: ORG_ID || undefined });
        } catch {
          try { su = await sdk.admin.signupsByDay({ days: 14 }); } catch {}
        }
        setSignups(Array.isArray(su) ? su : su?.days || []);
      } catch {
        setError('Could not load dashboard data.');
      }
      setLoading(false);
    })();
  }, [sdk]);

  if (loading) return <View style={{ gap: spacing.xl }}><Skeleton height={80} /><Skeleton height={120} /></View>;
  if (error) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
      <Ionicons name="bar-chart-outline" size={32} color={colors.textMuted} />
      <Text variant="body" color={colors.textSecondary} align="center">{error}</Text>
      <Text variant="caption" color={colors.textMuted} align="center" style={{ maxWidth: 280 }}>Check your admin permissions or try again later.</Text>
    </View>
  );

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
        <StatCard label="Users" value={stats?.users ?? stats?.totalUsers ?? '---'} />
        <StatCard label="Posts" value={stats?.posts ?? stats?.totalPosts ?? '---'} />
        <StatCard label="Communities" value={stats?.communities ?? stats?.totalCommunities ?? '---'} />
      </View>
      {signups.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Signups (14 days)</Text>
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
        </Card>
      )}
    </View>
  );
}

/* --- Users --- */
function UsersTab({ sdk }: { sdk: any }) {
  const [users, setUsers] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [actionId, setActionId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Try admin endpoint first
      const res = await sdk.admin.listUsers({ search: q || undefined, limit: 50, organization_id: ORG_ID || undefined });
      setUsers(Array.isArray(res) ? res : res?.users || []);
    } catch {
      // Fallback to org members
      if (ORG_ID) {
        try {
          const res = await sdk.organizations.members(ORG_ID, { limit: 50 } as any);
          const members = (res.data || []).map((m: any) => m.user || m);
          setUsers(members);
        } catch {
          setError('Requires admin access to view users.');
          setUsers([]);
        }
      } else {
        setError('Requires admin access to view users.');
        setUsers([]);
      }
    }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const doSearch = () => load(search);

  const banUser = async (id: string) => {
    setActionId(id);
    try { await sdk.admin.banUser(id, { reason: 'Admin action' }); await load(search); } catch { Alert.alert('Error', 'Failed to ban user.'); }
    setActionId('');
  };

  const unbanUser = async (id: string) => {
    setActionId(id);
    try { await sdk.admin.unbanUser(id); await load(search); } catch { Alert.alert('Error', 'Failed to unban user.'); }
    setActionId('');
  };

  const setRole = async (id: string, role: string) => {
    setActionId(id);
    try { await sdk.admin.setUserRole(id, role); await load(search); } catch { Alert.alert('Error', 'Failed to set role.'); }
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
      {loading ? <Skeleton height={200} /> : error ? (
        <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.md }}>
          <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
          <Text variant="body" color={colors.textMuted} align="center">{error}</Text>
        </View>
      ) : users.length === 0 ? (
        <Text variant="caption" color={colors.textMuted} align="center">No users found.</Text>
      ) : users.map((u: any) => (
        <Card key={u.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">{u.name || u.username || 'User'}</Text>
              <Text variant="caption" color={colors.textMuted}>{u.email || u.username || ''} {u.role ? `- ${u.role}` : ''}</Text>
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

/* --- Content --- */
function ContentTab({ sdk }: { sdk: any }) {
  const [posts, setPosts] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [deletingId, setDeletingId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Try admin endpoint with org scope
      const res = await sdk.admin.listPosts({ search: q || undefined, limit: 50, organization_id: ORG_ID || undefined });
      setPosts(Array.isArray(res) ? res : res?.posts || []);
    } catch {
      // Fallback to org posts
      try {
        const res = await sdk.posts.list({ limit: 50, organization_id: ORG_ID || undefined });
        setPosts(res.data || []);
      } catch {
        setError('Requires admin access to view content.');
        setPosts([]);
      }
    }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const deletePost = async (id: string) => {
    setDeletingId(id);
    try { await sdk.admin.deletePost(id); setPosts(p => p.filter(x => x.id !== id)); } catch { Alert.alert('Error', 'Failed to delete post.'); }
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
      {loading ? <Skeleton height={200} /> : error ? (
        <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.md }}>
          <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
          <Text variant="body" color={colors.textMuted} align="center">{error}</Text>
        </View>
      ) : posts.length === 0 ? (
        <Text variant="caption" color={colors.textMuted} align="center">No posts found.</Text>
      ) : posts.map((p: any) => (
        <Card key={p.id}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" numberOfLines={2}>{p.title || p.content?.slice(0, 100) || 'Untitled'}</Text>
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
                {p.author?.name || 'Unknown'} {(p.created_at || p.createdAt) ? `- ${new Date(p.created_at || p.createdAt).toLocaleDateString()}` : ''}
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

/* --- Invites --- */
function InvitesTab({ sdk }: { sdk: any }) {
  const [codes, setCodes] = React.useState<any[]>([]);
  const [waitlist, setWaitlist] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionId, setActionId] = React.useState('');

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
    try { await sdk.admin.revokeInviteCode(id); setCodes(c => c.map(x => x.id === id ? { ...x, status: 'revoked' } : x)); } catch { Alert.alert('Error', 'Failed to revoke code.'); }
    setActionId('');
  };

  const grant = async (id: string) => {
    setActionId(id);
    try { await sdk.admin.grantWaitlistAccess(id); setWaitlist(w => w.filter(x => x.id !== id)); } catch { Alert.alert('Error', 'Failed to grant access.'); }
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

/* --- Network --- */
function NetworkTab({ sdk }: { sdk: any }) {
  const [settings, setSettings] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const s = await sdk.admin.getNetworkSettings();
        setSettings(s);
      } catch {
        setError('Requires network admin access to view settings.');
      }
      setLoading(false);
    })();
  }, [sdk]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try { await sdk.admin.updateNetworkSettings(settings); } catch { Alert.alert('Error', 'Failed to save settings.'); }
    setSaving(false);
  };

  if (loading) return <Skeleton height={200} />;
  if (error || !settings) {
    return (
      <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.md }}>
        <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
        <Text variant="body" color={colors.textMuted} align="center">{error || 'Could not load network settings.'}</Text>
        <Text variant="caption" color={colors.textMuted} align="center">This requires network-level admin privileges.</Text>
      </View>
    );
  }

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

/* --- Main --- */
export default function AdminScreen() {
  const router = useRouter();
  const { sdk } = useAuth();
  const [tab, setTab] = React.useState<Tab>('ai');

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
        {(['ai', 'dashboard', 'users', 'content', 'invites', 'network'] as Tab[]).map(t => (
          <TabButton key={t} label={t === 'ai' ? 'AI' : t.charAt(0).toUpperCase() + t.slice(1)} active={tab === t} onPress={() => setTab(t)} />
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing['5xl'], flex: tab === 'ai' ? 1 : undefined }}>
        {tab === 'ai' && <AITab sdk={sdk} />}
        {tab === 'dashboard' && <DashboardTab sdk={sdk} />}
        {tab === 'users' && <UsersTab sdk={sdk} />}
        {tab === 'content' && <ContentTab sdk={sdk} />}
        {tab === 'invites' && <InvitesTab sdk={sdk} />}
        {tab === 'network' && <NetworkTab sdk={sdk} />}
      </ScrollView>
    </Container>
  );
}
