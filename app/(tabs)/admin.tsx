import * as React from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Switch,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Button, Input, Avatar, Divider } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { BASE_ORIGIN, ORG_ID } from '../../lib/recursiv';
import { getItem } from '../../lib/storage';
import { colors, spacing, radius, typography } from '../../constants/theme';

type AdminTab = 'dashboard' | 'boosts' | 'reports' | 'users' | 'settings';
type TimePeriod = 'today' | '7days' | '28days';

const ADMIN_TABS: { key: AdminTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline' },
  { key: 'boosts', label: 'Boosts', icon: 'rocket-outline' },
  { key: 'reports', label: 'Reports', icon: 'flag-outline' },
  { key: 'users', label: 'Users', icon: 'people-outline' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline' },
];

// ─── KPI Card ────────────────────────────────────────────────
function KPICard({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <Text variant="caption" color={colors.textMuted}>{label}</Text>
      <Text
        variant="h1"
        color={accent ? colors.accent : colors.text}
        style={{ marginTop: spacing.xs }}
      >
        {value}
      </Text>
    </Card>
  );
}

// ─── Dashboard Tab ───────────────────────────────────────────
function DashboardTab() {
  const { sdk } = useAuth();
  const [period, setPeriod] = React.useState<TimePeriod>('7days');
  const [stats, setStats] = React.useState<any>({
    totalUsers: 0,
    totalAgents: 0,
    totalApps: 0,
    revenue: '$0',
    activeUsers: 0,
    newSignups: 0,
  });

  React.useEffect(() => {
    (async () => {
      try {
        const apiKey = await getItem('minds:api_key');
        const res = await fetch(`${BASE_ORIGIN}/api/v1/orgs/${ORG_ID}/admin/stats`, {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          const d = data.data || data;
          setStats({
            totalUsers: d.total_users || d.totalUsers || 0,
            totalAgents: d.total_agents || d.totalAgents || 0,
            totalApps: d.total_apps || d.totalApps || 0,
            revenue: d.revenue || '$0',
            activeUsers: d.active_users || d.activeUsers || 0,
            newSignups: d.new_signups || d.newSignups || 0,
          });
        }
      } catch {
        // Admin stats endpoint may not exist yet — show 0s gracefully
      }
    })();
  }, [sdk]);

  const periodLabel: Record<TimePeriod, string> = {
    today: 'Today',
    '7days': '7 days',
    '28days': '28 days',
  };

  return (
    <View style={{ gap: spacing.xl }}>
      {/* KPI grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <KPICard label="Total Users" value={stats.totalUsers} accent />
        <KPICard label="Total Agents" value={stats.totalAgents} accent />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <KPICard label="Total Apps" value={stats.totalApps} />
        <KPICard label="Revenue" value={stats.revenue} />
      </View>

      {/* Activity section */}
      <View>
        <Text variant="h3" style={{ marginBottom: spacing.lg }}>Activity</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
          {(['today', '7days', '28days'] as TimePeriod[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                borderRadius: radius.full,
                backgroundColor: period === p ? colors.accent : colors.surface,
                borderWidth: period === p ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <Text
                variant="label"
                color={period === p ? '#fff' : colors.textSecondary}
                style={{ fontSize: 13 }}
              >
                {periodLabel[p]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: spacing.md }}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="body" color={colors.textSecondary}>Active Users</Text>
              <Text variant="h3" color={colors.accent}>{stats.activeUsers}</Text>
            </View>
          </Card>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="body" color={colors.textSecondary}>New Signups</Text>
              <Text variant="h3" color={colors.accent}>{stats.newSignups}</Text>
            </View>
          </Card>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="body" color={colors.textSecondary}>Revenue</Text>
              <Text variant="h3" color={colors.accent}>{stats.revenue}</Text>
            </View>
          </Card>
        </View>
      </View>
    </View>
  );
}

// ─── Boost Queue Tab ─────────────────────────────────────────
function BoostQueueTab() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing['5xl'] }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.successMuted,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
        }}
      >
        <Ionicons name="checkmark-circle" size={36} color={colors.success} />
      </View>
      <Text variant="h3" style={{ marginBottom: spacing.sm }}>No pending boosts</Text>
      <Text variant="body" color={colors.textMuted} align="center">
        Boost requests that need review will appear here.
      </Text>
    </View>
  );
}

// ─── Reports Tab ─────────────────────────────────────────────
function ReportsTab() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing['5xl'] }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.successMuted,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.lg,
        }}
      >
        <Ionicons name="shield-checkmark" size={36} color={colors.success} />
      </View>
      <Text variant="h3" style={{ marginBottom: spacing.sm }}>No pending reports</Text>
      <Text variant="body" color={colors.textMuted} align="center">
        Content reports and moderation actions will appear here.
      </Text>
    </View>
  );
}

// ─── Users Tab ───────────────────────────────────────────────
function UsersTab() {
  const { sdk } = useAuth();
  const [search, setSearch] = React.useState('');
  const [expandedUser, setExpandedUser] = React.useState<string | null>(null);
  const [users, setUsers] = React.useState<any[]>([]);
  const [usersLoading, setUsersLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const apiKey = await getItem('minds:api_key');
        // Try admin members endpoint first
        const res = await fetch(`${BASE_ORIGIN}/api/v1/orgs/${ORG_ID}/admin/members`, {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setUsers((data.data || []).map((m: any) => m.user || m));
        } else if (sdk) {
          // Fall back to org members via SDK
          if (ORG_ID) {
            const membersRes = await sdk.organizations.members(ORG_ID, { limit: 100 } as any);
            setUsers((membersRes.data || []).map((m: any) => m.user || m));
          }
        }
      } catch {
        // Admin endpoint may not exist — keep empty gracefully
      } finally {
        setUsersLoading(false);
      }
    })();
  }, [sdk]);

  const filteredUsers = search.trim()
    ? users.filter((u: any) =>
        (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(search.toLowerCase())
      )
    : users;

  return (
    <View style={{ gap: spacing.lg }}>
      {/* Search bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.lg,
        }}
      >
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search users..."
          placeholderTextColor={colors.textMuted}
          style={[
            typography.body,
            {
              flex: 1,
              color: colors.text,
              paddingVertical: 13,
              paddingHorizontal: spacing.sm,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            },
          ]}
        />
      </View>

      {usersLoading ? (
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          {[1, 2, 3].map(i => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceHover }} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <View style={{ width: 140, height: 14, backgroundColor: colors.surfaceHover, borderRadius: radius.sm }} />
                <View style={{ width: 100, height: 12, backgroundColor: colors.surfaceHover, borderRadius: radius.sm }} />
              </View>
            </View>
          ))}
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing['4xl'] }}>
          <Ionicons name="people-outline" size={32} color={colors.textMuted} />
          <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
            {search ? 'No users found' : 'No users loaded'}
          </Text>
        </View>
      ) : (
        filteredUsers.map((u: any) => (
          <Pressable
            key={u.id}
            onPress={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
          >
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Avatar uri={u.image} name={u.name} size="md" />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text variant="bodyMedium">{u.name}</Text>
                    {u.role && (
                      <View
                        style={{
                          paddingHorizontal: spacing.sm,
                          paddingVertical: 2,
                          borderRadius: radius.sm,
                          backgroundColor: colors.accentMuted,
                        }}
                      >
                        <Text variant="caption" color={colors.accent} style={{ fontSize: 11 }}>
                          {u.role}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text variant="caption" color={colors.textMuted}>
                    @{u.username} {u.email ? `- ${u.email}` : ''}
                  </Text>
                </View>
                <Ionicons
                  name={expandedUser === u.id ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </View>

              {expandedUser === u.id && (
                <View style={{ marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                  <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
                    Posts: 0  |  Last active: --
                  </Text>
                  <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.lg }}>
                    Strike history: None
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                    <Button onPress={() => { const m = 'Strike system coming soon'; Platform.OS === 'web' ? alert(m) : Alert.alert('Coming Soon', m); }} variant="secondary" size="sm">Give Strike</Button>
                    <Button onPress={() => { const m = 'Suspension system coming soon'; Platform.OS === 'web' ? alert(m) : Alert.alert('Coming Soon', m); }} variant="secondary" size="sm">Suspend</Button>
                    <Button onPress={() => { const m = 'Ban system coming soon'; Platform.OS === 'web' ? alert(m) : Alert.alert('Coming Soon', m); }} size="sm" accentColor={colors.error}>Ban</Button>
                  </View>
                </View>
              )}
            </Card>
          </Pressable>
        ))
      )}
    </View>
  );
}

// ─── Settings Tab ────────────────────────────────────────────
function SettingsTab() {
  const [orgName, setOrgName] = React.useState('Minds');
  const [orgDescription, setOrgDescription] = React.useState('');
  const [enableBoost, setEnableBoost] = React.useState(true);
  const [enableTokens, setEnableTokens] = React.useState(true);
  const [enableNSFW, setEnableNSFW] = React.useState(false);
  const [requireInvite, setRequireInvite] = React.useState(false);

  const toggleRow = (label: string, value: boolean, onToggle: (v: boolean) => void) => (
    <View
      key={label}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
      }}
    >
      <Text variant="body">{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.surfaceHover, true: colors.accentMuted }}
        thumbColor={value ? colors.accent : colors.textMuted}
      />
    </View>
  );

  return (
    <View style={{ gap: spacing.xl }}>
      <Card>
        <Text variant="h3" style={{ marginBottom: spacing.lg }}>Organization</Text>
        <Input
          label="Name"
          value={orgName}
          onChangeText={setOrgName}
          placeholder="Organization name"
        />
        <Input
          label="Description"
          value={orgDescription}
          onChangeText={setOrgDescription}
          placeholder="Describe your organization..."
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
      </Card>

      <Card>
        <Text variant="h3" style={{ marginBottom: spacing.md }}>Feature Toggles</Text>
        {toggleRow('Enable Boost system', enableBoost, setEnableBoost)}
        <Divider />
        {toggleRow('Enable Token rewards', enableTokens, setEnableTokens)}
        <Divider />
        {toggleRow('Enable NSFW tagging', enableNSFW, setEnableNSFW)}
        <Divider />
        {toggleRow('Require invite codes', requireInvite, setRequireInvite)}
      </Card>

      <Button onPress={() => { const m = 'Settings saved (coming soon — settings persistence not yet wired)'; Platform.OS === 'web' ? alert(m) : Alert.alert('Saved', m); }} variant="primary">Save Settings</Button>
    </View>
  );
}

// ─── Main Admin Screen ───────────────────────────────────────
export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = React.useState<AdminTab>('dashboard');

  // Simple admin check — in production, check role from org membership
  const isAdmin = true;

  if (!isAdmin) {
    return (
      <Container safeTop centered>
        <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
        <Text variant="h3" color={colors.textMuted} style={{ marginTop: spacing.lg }}>
          Access Denied
        </Text>
        <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
          You need admin privileges to view this page.
        </Text>
      </Container>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab />;
      case 'boosts': return <BoostQueueTab />;
      case 'reports': return <ReportsTab />;
      case 'users': return <UsersTab />;
      case 'settings': return <SettingsTab />;
    }
  };

  return (
    <Container safeTop padded={false}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h2" style={{ flex: 1 }}>Admin</Text>
        <View
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            borderRadius: radius.sm,
            backgroundColor: colors.accentMuted,
          }}
        >
          <Text variant="caption" color={colors.accent} style={{ fontSize: 11 }}>
            {user?.name || 'Admin'}
          </Text>
        </View>
      </View>

      {/* Tab bar (top) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(255,255,255,0.06)',
          flexGrow: 0,
        }}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          gap: spacing.xs,
        }}
      >
        {ADMIN_TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setActiveTab(key)}
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderBottomWidth: 2,
                borderBottomColor: isActive ? colors.accent : 'transparent',
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              }}
            >
              <Text
                variant="bodyMedium"
                color={isActive ? colors.accent : colors.textMuted}
                style={{ fontSize: 14 }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Tab content */}
      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: spacing['6xl'],
        }}
        showsVerticalScrollIndicator={false}
      >
        {renderTab()}
      </ScrollView>
    </Container>
  );
}
