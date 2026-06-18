import * as React from 'react';
import { View, ScrollView, Pressable, Platform, TextInput } from 'react-native';
import { showToast } from '../../components/Toast';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card, Skeleton, Divider, Avatar } from '../../components';
import { Container } from '../../components/Container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TabBar } from '../../components/TabBar';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { spacing, radius, typography } from '../../constants/theme';
import { useColors } from '../../lib/theme';

type Tab = 'dashboard' | 'users' | 'content' | 'reports' | 'communities';

const BUSINESS_AI_AGENT_ID = '411ac3a9-dfbc-4463-8963-2e26a645211e';

/* --- AI Chat --- */
function AITab({ sdk }: { sdk: any }) {
  const colors = useColors();
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
      const res = await sdk.agents.chat(BUSINESS_AI_AGENT_ID, { message: msg });
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
  const colors = useColors();
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
  const colors = useColors();
  return (
    <Card style={{ flex: 1, minWidth: 100 }}>
      <Text variant="h2" color={colors.accent}>{value}</Text>
      <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>{label}</Text>
    </Card>
  );
}

function IconStat({ icon, label, value }: { icon: any; label: string; value: number | string }) {
  const colors = useColors();
  return (
    <Card style={{ flexGrow: 1, flexBasis: '46%' as any, minWidth: 130 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
        <Ionicons name={icon} size={15} color={colors.textMuted} />
        <Text variant="caption" color={colors.textMuted}>{label}</Text>
      </View>
      <Text variant="h2" color={colors.text}>{value}</Text>
    </Card>
  );
}

// Compact number formatting for big metrics (1.2k, 3.4M).
function fmt(n: number | string | undefined): string {
  const v = typeof n === 'number' ? n : Number(n);
  if (!isFinite(v)) return String(n ?? '—');
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

/* --- Dashboard --- */
function DashboardTab({ sdk }: { sdk: any }) {
  const colors = useColors();
  const [stats, setStats] = React.useState<any>(null);
  const [signups, setSignups] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        // Real counts from the admin stats endpoint (scoped server-side), plus
        // the signups time series for the chart. The old version counted org
        // *members* (teammates ≈ 1) — wrong surface for an app dashboard.
        const [statsRes, signupsRes, agentsRes] = await Promise.all([
          sdk.admin.getStats().catch(() => null),
          sdk.admin.getSignupsByDay(14).catch(() => null),
          sdk.agents.listDiscoverable({ limit: 100 }).catch(() => ({ data: [] })),
        ]);
        const s = statsRes?.data || statsRes || {};
        setStats({
          users: s.active_users ?? s.total_users ?? 0,
          posts: s.total_posts ?? 0,
          communities: s.total_communities ?? 0,
          agents: (agentsRes.data || []).length,
          messages: s.total_messages ?? 0,
          today: s.today_signups ?? 0,
        });
        setSignups((signupsRes?.data || []).map((d: any) => ({
          date: d.day || d.date,
          count: d.signups ?? d.count ?? 0,
        })));
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

  const weekTotal = signups.slice(-7).reduce((a, d) => a + (d.count || 0), 0);
  const peak = Math.max(1, ...signups.map((d) => d.count || 0));

  return (
    <View style={{ gap: spacing.lg }}>
      {/* Hero — the headline metric, alive */}
      <Card style={{ borderColor: colors.accentMuted }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.lg }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="caption" color={colors.textMuted} style={{ letterSpacing: 1, textTransform: 'uppercase' as any }}>Total users</Text>
            <Text style={{ ...typography.hero, color: colors.accent, marginTop: spacing.xs } as any}>{fmt(stats?.users)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
              <Text variant="caption" color={colors.success || colors.accent}>↑ {stats?.today ?? 0} today</Text>
              <Text variant="caption" color={colors.textMuted}>· {weekTotal} this week</Text>
            </View>
          </View>
          {/* sparkline of recent signups */}
          {signups.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 44 }}>
              {signups.slice(-14).map((d, i) => (
                <View key={i} style={{
                  width: 5,
                  height: Math.max(3, Math.round((d.count / peak) * 44)),
                  backgroundColor: i === signups.slice(-14).length - 1 ? colors.accent : colors.accentMuted,
                  borderRadius: 2,
                }} />
              ))}
            </View>
          )}
        </View>
      </Card>

      {/* Stat grid with icons */}
      <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
        <IconStat icon="document-text-outline" label="Posts" value={fmt(stats?.posts)} />
        <IconStat icon="people-outline" label="Communities" value={fmt(stats?.communities)} />
        <IconStat icon="chatbubbles-outline" label="Messages" value={fmt(stats?.messages)} />
        <IconStat icon="sparkles-outline" label="Agents" value={fmt(stats?.agents)} />
      </View>

      {/* Signups chart */}
      {signups.length > 0 && (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Text variant="label" color={colors.textMuted}>Signups</Text>
            <Text variant="caption" color={colors.textMuted}>last {signups.length} days</Text>
          </View>
          <View style={{ gap: spacing.xs }}>
            {signups.map((d, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="caption" color={colors.textMuted} style={{ width: 52, fontSize: 10 }}>
                  {d.date ? new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `Day ${i + 1}`}
                </Text>
                <View style={{ flex: 1, height: 16, backgroundColor: colors.glass, borderRadius: radius.xs, overflow: 'hidden' }}>
                  <View style={{ height: 16, width: `${Math.round((d.count / peak) * 100)}%` as any, backgroundColor: colors.accent, borderRadius: radius.xs }} />
                </View>
                <Text variant="caption" color={d.count ? colors.accent : colors.textMuted} style={{ width: 26, textAlign: 'right', fontSize: 11 }}>{d.count}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </View>
  );
}

/* --- Users --- */
function UsersTab({ sdk }: { sdk: any }) {
  const colors = useColors();
  const [users, setUsers] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [actionId, setActionId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Admin endpoint returns { data: [...] } — scoped server-side.
      const res = await sdk.admin.listUsers({ search: q || undefined, limit: 50 });
      setUsers(Array.isArray(res) ? res : res?.data || []);
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
    // SDK wants reason as a STRING, not an object — passing { reason } sent a
    // malformed body and the ban silently failed.
    try { await sdk.admin.banUser(id, 'Admin action'); await load(search); } catch { showToast('Failed to ban user.', 'error'); }
    setActionId('');
  };

  const unbanUser = async (id: string) => {
    setActionId(id);
    try { await sdk.admin.unbanUser(id); await load(search); } catch { showToast('Failed to unban user.', 'error'); }
    setActionId('');
  };

  const deleteUser = async (id: string) => {
    setActionId(id);
    try { await sdk.admin.deleteUser(id); setUsers(us => us.filter(u => u.id !== id)); } catch { showToast('Failed to delete user.', 'error'); }
    setActionId('');
  };

  const setRole = async (id: string, role: string) => {
    setActionId(id);
    try { await sdk.admin.setUserRole(id, role); await load(search); } catch { showToast('Failed to set role.', 'error'); }
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
      ) : users.map((u: any) => {
        const banned = !!(u.banned_at || u.banned);
        return (
        <Card key={u.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar uri={u.image} name={u.name || u.username} size="md" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="bodyMedium" numberOfLines={1}>{u.name || u.username || 'User'}</Text>
                {u.role === 'admin' && <Text variant="caption" color={colors.accent}>admin</Text>}
                {banned && <Text variant="caption" color={colors.error}>banned</Text>}
              </View>
              <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                {u.username ? `@${u.username}` : ''}{u.email ? ` · ${u.email}` : ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {banned ? (
                <Button onPress={() => unbanUser(u.id)} variant="ghost" size="sm" loading={actionId === u.id}>Unban</Button>
              ) : (
                <Button onPress={() => banUser(u.id)} variant="ghost" size="sm" accentColor={colors.error} loading={actionId === u.id}>Ban</Button>
              )}
              {u.role !== 'admin' && (
                <Button onPress={() => setRole(u.id, 'admin')} variant="ghost" size="sm" loading={actionId === u.id}>Make admin</Button>
              )}
              <Pressable onPress={() => deleteUser(u.id)} disabled={actionId === u.id} hitSlop={8} style={{ opacity: actionId === u.id ? 0.4 : 1, padding: spacing.xs }}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
          </View>
        </Card>
        );
      })}
    </View>
  );
}

/* --- Content --- */
function ContentTab({ sdk }: { sdk: any }) {
  const colors = useColors();
  const [posts, setPosts] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [deletingId, setDeletingId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Admin endpoint returns { data: [...] } — scoped server-side.
      const res = await sdk.admin.listPosts({ search: q || undefined, limit: 50 });
      setPosts(Array.isArray(res) ? res : res?.data || []);
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
    try {
      // Try SDK posts.delete first (works for own posts and with proper scope)
      try { await sdk.posts.delete(id); } catch {
        // Fallback to admin endpoint
        await sdk.admin.deletePost(id);
      }
      setPosts(p => p.filter(x => x.id !== id));
    } catch { showToast('Failed to delete post. Check your permissions.', 'error'); }
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
/* --- Reports --- */
function ReportsTab({ sdk }: { sdk: any }) {
  const colors = useColors();
  const [reports, setReports] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionId, setActionId] = React.useState('');
  const [showResolved, setShowResolved] = React.useState(false);
  const router = useRouter();

  const load = React.useCallback(async () => {
    try {
      const res = await sdk.admin.listReports({ limit: 100 });
      setReports(Array.isArray(res) ? res : res?.data || []);
    } catch {}
    setLoading(false);
  }, [sdk]);
  React.useEffect(() => { load(); }, [load]);

  const resolve = async (id: string) => {
    setActionId(id);
    try { await sdk.admin.resolveReport(id); setReports(rs => rs.map(r => r.id === id ? { ...r, status: 'resolved' } : r)); }
    catch { showToast('Failed to resolve report.', 'error'); }
    setActionId('');
  };
  const dismiss = async (id: string) => {
    setActionId(id);
    try { await sdk.admin.dismissReport(id); setReports(rs => rs.map(r => r.id === id ? { ...r, status: 'dismissed' } : r)); }
    catch { showToast('Failed to dismiss report.', 'error'); }
    setActionId('');
  };
  const removeContent = async (r: any) => {
    setActionId(r.id);
    try {
      if (r.target_type === 'post') await sdk.admin.deletePost(r.target_id);
      await sdk.admin.resolveReport(r.id);
      setReports(rs => rs.map(x => x.id === r.id ? { ...x, status: 'resolved' } : x));
      showToast('Content removed.', 'success');
    } catch { showToast('Failed to remove content.', 'error'); }
    setActionId('');
  };

  if (loading) return <Skeleton height={200} />;

  const pending = reports.filter(r => (r.status || 'pending') === 'pending');
  const visible = showResolved ? reports : pending;

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="label" color={colors.textMuted}>{pending.length} open · {reports.length} total</Text>
        <Button onPress={() => setShowResolved(s => !s)} variant="ghost" size="sm">
          {showResolved ? 'Hide resolved' : 'Show all'}
        </Button>
      </View>
      {visible.length === 0 ? (
        <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
          <Ionicons name="shield-checkmark-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text}>All clear</Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 300 }}>
            No open reports. When users report content, it appears here for review.
          </Text>
        </View>
      ) : visible.map((r: any) => {
        const resolved = (r.status || 'pending') !== 'pending';
        return (
        <Card key={r.id}>
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodyMedium">{r.reason || 'Reported'}</Text>
                <Text variant="caption" color={resolved ? colors.textMuted : colors.accent}>
                  {r.target_type} · {r.status || 'pending'}{r.created_at ? ` · ${new Date(r.created_at).toLocaleDateString()}` : ''}
                </Text>
                {r.details ? <Text variant="caption" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>{r.details}</Text> : null}
              </View>
              {r.target_type === 'post' && (
                <Button onPress={() => router.push(`/(tabs)/post/${r.target_id}` as any)} variant="ghost" size="sm">View</Button>
              )}
            </View>
            {!resolved && (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
                <Button onPress={() => dismiss(r.id)} variant="ghost" size="sm" loading={actionId === r.id}>Dismiss</Button>
                {r.target_type === 'post' && (
                  <Button onPress={() => removeContent(r)} variant="ghost" size="sm" accentColor={colors.error} loading={actionId === r.id}>Remove</Button>
                )}
                <Button onPress={() => resolve(r.id)} size="sm" loading={actionId === r.id}>Resolve</Button>
              </View>
            )}
          </View>
        </Card>
        );
      })}
    </View>
  );
}

/* --- Communities --- */
function CommunitiesTab({ sdk }: { sdk: any }) {
  const colors = useColors();
  const router = useRouter();
  const [communities, setCommunities] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deletingId, setDeletingId] = React.useState('');

  React.useEffect(() => {
    (async () => {
      try {
        const res = await sdk.communities.list({ limit: 100, organization_id: ORG_ID || undefined });
        setCommunities(res.data || []);
      } catch {}
      setLoading(false);
    })();
  }, [sdk]);

  const deleteCommunity = async (id: string) => {
    setDeletingId(id);
    try {
      await sdk.communities.delete(id);
      setCommunities(c => c.filter(x => x.id !== id));
    } catch { showToast('Failed to delete community.', 'error'); }
    setDeletingId('');
  };

  if (loading) return <Skeleton height={200} />;

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="label" color={colors.textMuted}>{communities.length} communities</Text>
        <Button onPress={() => router.push('/(tabs)/create')} size="sm">Create</Button>
      </View>
      {communities.length === 0 ? (
        <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
          <Ionicons name="people-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text}>No communities</Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 300 }}>
            Create communities for users to post in.
          </Text>
        </View>
      ) : communities.map((c: any) => (
        <Card key={c.id}>
          <Pressable onPress={() => router.push(`/(tabs)/community/${c.slug || c.id}` as any)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Avatar uri={c.image || c.avatar} name={c.name} size="md" />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{c.name}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs }}>
                  <Text variant="caption" color={colors.textMuted}>{c.memberCount || c.member_count || 0} members</Text>
                  <Text variant="caption" color={colors.textMuted}>{c.privacy || 'public'}</Text>
                </View>
                {c.description && <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ marginTop: spacing.xs }}>{c.description}</Text>}
              </View>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md }}>
            <Button onPress={() => router.push(`/(tabs)/community/${c.slug || c.id}` as any)} variant="ghost" size="sm">View</Button>
            <Button onPress={() => deleteCommunity(c.id)} variant="ghost" size="sm" accentColor={colors.error} loading={deletingId === c.id}>Delete</Button>
          </View>
        </Card>
      ))}
    </View>
  );
}


/* --- Main --- */
import { withAdminGuard } from '../../lib/guards';

function AdminScreen() {
  const colors = useColors();
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
      <View style={{ backgroundColor: colors.bg, zIndex: 1 }}>
        <ScreenHeader title="Admin" />
        <TabBar
          tabs={(['dashboard', 'users', 'content', 'reports', 'communities'] as const).map(t => ({ key: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
          active={tab}
          onChange={(k) => setTab(k as Tab)}
          scrollable
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {tab === 'dashboard' && <DashboardTab sdk={sdk} />}
        {tab === 'users' && <UsersTab sdk={sdk} />}
        {tab === 'content' && <ContentTab sdk={sdk} />}
        {tab === 'reports' && <ReportsTab sdk={sdk} />}
        {tab === 'communities' && <CommunitiesTab sdk={sdk} />}
      </ScrollView>
    </Container>
  );
}

export default withAdminGuard(AdminScreen);
