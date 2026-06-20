import * as React from 'react';
import { View, ScrollView, Pressable, Platform, Linking, useWindowDimensions } from 'react-native';
import { showToast } from '../../components/Toast';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card, Avatar, Skeleton } from '../../components';
import { Container } from '../../components/Container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { getPreference, setPreference } from '../../lib/preferences';
import { spacing, radius } from '../../constants/theme';
import { useTheme } from '../../lib/theme';
import { useColors } from '../../lib/theme';
import { openSupportConversation } from '../../lib/support';

// A labeled group of settings. The (optional) header is a muted uppercase
// caption sitting just above a Card; the Card uses horizontal-only padding so
// each SettingRow owns its own vertical rhythm and hairlines run edge-to-edge.
function Section({
  title, children, footer,
}: {
  title?: string;
  children: React.ReactNode;
  footer?: string;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: spacing.sm }}>
      {title ? (
        <Text
          variant="caption"
          color={colors.textMuted}
          style={{
            fontSize: 11,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            fontFamily: 'Roboto-Medium',
            marginLeft: spacing.md,
          }}
        >
          {title}
        </Text>
      ) : null}
      <Card padding="lg" style={{ paddingVertical: 0 }}>{children}</Card>
      {footer ? (
        <Text variant="caption" color={colors.textMuted} style={{ marginLeft: spacing.md, marginTop: 2, lineHeight: 17 }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

// Loose content (forms, pickers, session lists) that doesn't fit the strict
// row grammar still needs the section's edge-to-edge padding model. This wraps
// it in a single padded block with a top hairline so it lines up with rows.
function SectionBlock({ children, first }: { children: React.ReactNode; first?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={{
        paddingVertical: spacing.lg,
        borderTopWidth: first ? 0 : 0.5,
        borderTopColor: colors.borderSubtle,
      }}
    >
      {children}
    </View>
  );
}

// One consistent row shape for the whole settings surface: an optional leading
// icon in a tinted square, a label (+ optional sublabel), and on the right
// either a control (Toggle), a value string, and/or a chevron when the row
// navigates. Rows stack inside a Card with hairline separators so everything
// scans the same way (iOS / X settings style).
function SettingRow({
  label, sublabel, icon, iconColor, right, value, onPress, first, destructive,
}: {
  label: string;
  sublabel?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  right?: React.ReactNode;
  value?: string;
  onPress?: () => void;
  first?: boolean;
  destructive?: boolean;
}) {
  const colors = useColors();
  const tint = destructive ? colors.error : (iconColor || colors.accent);
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        minHeight: 52,
        borderTopWidth: first ? 0 : 0.5,
        borderTopColor: colors.borderSubtle,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: radius.sm,
            backgroundColor: destructive ? colors.errorMuted : colors.accentMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={17} color={tint} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="body" color={destructive ? colors.error : colors.text}>{label}</Text>
        {sublabel ? (
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2, lineHeight: 17 }}>{sublabel}</Text>
        ) : null}
      </View>
      {right ?? (value ? <Text variant="body" color={colors.textMuted}>{value}</Text> : null)}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: -spacing.xs }} /> : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          opacity: pressed ? 0.6 : 1,
          ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
        })}
      >
        {body}
      </Pressable>
    );
  }
  return body;
}

// Turn a raw user-agent into a human label ("Chrome on macOS"). The sessions
// list previously read non-existent fields (s.device/s.userAgent) so EVERY row
// fell through to "Unknown device" — the real field is `user_agent`.
function friendlyUA(ua?: string | null): string {
  if (!ua) return 'Unknown device';
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' :
    /Expo|okhttp|Dart|axios|node-fetch|node/i.test(ua) ? 'Minds app' : null;
  const os =
    /iPhone|iPad|iOS/.test(ua) ? 'iOS' :
    /Android/.test(ua) ? 'Android' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Windows/.test(ua) ? 'Windows' :
    /Linux/.test(ua) ? 'Linux' : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser || os || 'Unknown device';
}

// Custom toggle instead of the platform <Switch> — React Native Web's Switch
// doesn't reliably honor trackColor.true and falls back to its default green/
// teal track, which clashes with Minds' gold accent. This Pressable version is
// gold-on / neutral-off everywhere with no platform-default color bleed.
function Toggle({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        backgroundColor: value ? colors.accent : colors.glass,
        borderWidth: 0.5,
        borderColor: value ? colors.accent : colors.borderSubtle,
        padding: 2,
        justifyContent: 'center',
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      }}
    >
      <View
        style={{
          width: 21,
          height: 21,
          borderRadius: 11,
          backgroundColor: value ? colors.textOnAccent : colors.text,
          alignSelf: value ? 'flex-end' : 'flex-start',
        }}
      />
    </Pressable>
  );
}

function TwoFactorSetup() {
  const { sdk } = useAuth();
  const colors = useColors();
  const [enabled, setEnabled] = React.useState(false);
  const [setupUri, setSetupUri] = React.useState<string | null>(null);
  const [verifyCode, setVerifyCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [step, setStep] = React.useState<'idle' | 'setup' | 'verify'>('idle');

  const BASE = React.useMemo(() => {
    const url = (sdk as any)?.client?.baseUrl || '';
    return url.replace('/api/v1', '');
  }, [sdk]);

  const apiKey = (sdk as any)?.client?.apiKey;

  const enable2FA = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/two-factor/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      });
      const data = await res.json();
      if (data.totpURI || data.totp_uri) {
        setSetupUri(data.totpURI || data.totp_uri);
        setStep('setup');
      }
    } catch { showToast('Could not enable 2FA', 'error'); }
    setLoading(false);
  };

  const verify2FA = async () => {
    if (verifyCode.length !== 6) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/two-factor/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ code: verifyCode }),
      });
      if (res.ok) {
        setEnabled(true);
        setStep('idle');
        setSetupUri(null);
        showToast('2FA is now enabled', 'success');
      } else {
        showToast('Invalid code. Try again.', 'error');
      }
    } catch { showToast('Verification failed', 'error'); }
    setLoading(false);
  };

  if (step === 'setup' && setupUri) {
    return (
      <View style={{ gap: spacing.md, paddingVertical: spacing.lg }}>
        <Text variant="label" color={colors.textMuted}>Set up authenticator app</Text>
        <Text variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>
          Scan this code with your authenticator app (Google Authenticator, Authy, etc.):
        </Text>
        <View style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.md, alignItems: 'center' }}>
          <Text variant="mono" color={colors.text} style={{ fontSize: 12 }} selectable>{setupUri}</Text>
        </View>
        <Text variant="caption" color={colors.textMuted}>Enter the 6-digit code from your app to verify:</Text>
        <Input
          value={verifyCode}
          onChangeText={t => setVerifyCode(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          selectTextOnFocus
        />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button onPress={() => { setStep('idle'); setSetupUri(null); }} variant="ghost" size="sm">Cancel</Button>
          <Button onPress={verify2FA} loading={loading} size="sm" disabled={verifyCode.length !== 6}>Verify</Button>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 52 }}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: radius.sm,
          backgroundColor: colors.accentMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="shield-checkmark-outline" size={17} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body">Two-factor authentication</Text>
        <Text variant="caption" color={enabled ? colors.success : colors.textMuted} style={{ marginTop: 2 }}>
          {enabled ? 'Enabled' : 'Not enabled'}
        </Text>
      </View>
      <Button onPress={enable2FA} loading={loading} variant="secondary" size="sm">
        {enabled ? 'Reconfigure' : 'Enable'}
      </Button>
    </View>
  );
}

// Settings are organized into categories shown as a left rail on desktop and a
// drill-down list on mobile — so the surface uses horizontal space instead of
// one endless 720px column, and every category renders in the same panel grammar.
type CatKey = 'account' | 'security' | 'privacy' | 'notifications' | 'appearance' | 'feed' | 'ai' | 'data' | 'help' | 'about';
const CATS: { key: CatKey; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'account', label: 'Account', icon: 'person-outline' },
  { key: 'security', label: 'Security', icon: 'shield-checkmark-outline' },
  { key: 'privacy', label: 'Privacy', icon: 'lock-closed-outline' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
  { key: 'appearance', label: 'Appearance', icon: 'color-palette-outline' },
  { key: 'feed', label: 'Feed & content', icon: 'newspaper-outline' },
  { key: 'ai', label: 'AI agent', icon: 'sparkles-outline' },
  { key: 'data', label: 'Your data', icon: 'download-outline' },
  { key: 'help', label: 'Help & feedback', icon: 'help-buoy-outline' },
  { key: 'about', label: 'About', icon: 'information-circle-outline' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { sdk, user, signOut } = useAuth();
  const { mode: themeMode, setMode: setThemeMode, colors } = useTheme();

  const [loading, setLoading] = React.useState(true);
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [loginHistory, setLoginHistory] = React.useState<any[]>([]);
  const [privacy, setPrivacy] = React.useState({ profilePublic: true, showEmail: false });
  // Notification toggles. Local UI state for now (was hardcoded-on with no
  // handler); wire to a server notification-preferences API when it lands.
  const [notifPrefs, setNotifPrefs] = React.useState({ replies: true, follows: true, votes: true, community: true });
  const toggleNotif = (key: 'replies' | 'follows' | 'votes' | 'community', v: boolean) =>
    setNotifPrefs(p => ({ ...p, [key]: v }));
  const [pw, setPw] = React.useState({ current: '', next: '' });
  const [newEmail, setNewEmail] = React.useState('');
  const [emailPw, setEmailPw] = React.useState('');
  const [saving, setSaving] = React.useState('');
  // Collapse the credential-change forms by default so Account isn't a wall of
  // inputs; they expand only when the user taps the row.
  const [showPwForm, setShowPwForm] = React.useState(false);
  const [showEmailForm, setShowEmailForm] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [deletePw, setDeletePw] = React.useState('');
  // Forces re-read of getPreference() values when the user toggles a
  // local pref (Switch / pill button). lib/preferences caches in-memory
  // so without this nudge the active-pill style won't update until the
  // next mount.
  const [, setSettingsTick] = React.useState(0);

  // Two-pane navigation. On desktop the left rail + content pane are both
  // always visible; on mobile we drill from the category list into a detail
  // pane (standard iOS settings). `active` is the selected category.
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 880;
  const [active, setActive] = React.useState<CatKey>('account');
  const [showDetail, setShowDetail] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!sdk) return;
    setLoading(true);
    try {
      const [prefs, sess, history] = await Promise.all([
        sdk.settings.getPreferences().catch(() => null),
        sdk.settings.listSessions().catch(() => []),
        sdk.settings.getLoginHistory({ limit: 10 }).catch(() => []),
      ]);
      const privacyData = (prefs as any)?.data?.privacy ?? (prefs as any)?.privacy;
      if (privacyData) {
        setPrivacy({
          profilePublic: privacyData.profilePublic ?? true,
          showEmail: privacyData.showEmail ?? false,
        });
      }
      setSessions((sess as any)?.data || []);
      setLoginHistory((history as any)?.data || []);
    } catch {}
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);

  const showMsg = (msg: string, isError = false) => {
    if (isError) {
      showToast(msg, 'error');
    } else {
      setStatusMsg(msg);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const changePassword = async () => {
    if (!sdk || !pw.current || !pw.next) return;
    setSaving('pw');
    try {
      await sdk.settings.changePassword({ current_password: pw.current, new_password: pw.next });
      setPw({ current: '', next: '' });
      showMsg('Password changed.');
    } catch { showMsg('Failed to change password.', true); }
    setSaving('');
  };

  const changeEmail = async () => {
    if (!sdk || !newEmail || !emailPw) return;
    setSaving('email');
    try {
      await sdk.settings.requestEmailChange({ new_email: newEmail, password: emailPw });
      setNewEmail(''); setEmailPw('');
      showMsg('Check your email to confirm the change.');
    } catch { showMsg('Failed to request email change.', true); }
    setSaving('');
  };

  const togglePrivacy = async (key: 'profilePublic' | 'showEmail', value: boolean) => {
    if (!sdk) return;
    const updated = { ...privacy, [key]: value };
    setPrivacy(updated);
    try {
      await sdk.settings.updatePrivacy({
        profile_public: updated.profilePublic,
        show_email: updated.showEmail,
      } as any);
    } catch { setPrivacy(privacy); showMsg('Failed to update privacy.', true); }
  };

  const revokeSession = async (id: string) => {
    if (!sdk) return;
    try {
      await sdk.settings.revokeSession(id);
      setSessions(s => s.filter(x => x.id !== id));
    } catch { showMsg('Failed to revoke session.', true); }
  };

  const [showAllSessions, setShowAllSessions] = React.useState(false);

  const revokeOtherSessions = async () => {
    if (!sdk) return;
    setSaving('sessions');
    try {
      await sdk.settings.revokeAllSessions();
      // Server keeps the current session alive; mirror that locally.
      setSessions(s => s.filter((x: any) => x.is_current));
      showMsg('Signed out of all other sessions.');
    } catch { showMsg('Failed to revoke sessions.', true); }
    setSaving('');
  };

  const deleteAccount = async () => {
    if (!sdk || !deletePw) return;
    setSaving('delete');
    try {
      await sdk.settings.requestDeletion({ password: deletePw, reason: 'User requested' });
      showMsg('Account deletion requested.');
      setDeleteConfirm(false); setDeletePw('');
    } catch { showMsg('Failed to request deletion.', true); }
    setSaving('');
  };

  const exportData = async () => {
    if (!sdk) return;
    try {
      // First fetch profile, then use its id for following.
      const profileRes = await sdk.profiles.me().catch(() => null);
      const [postsRes, followingRes] = await Promise.all([
        sdk.posts.list({ limit: 200, organization_id: ORG_ID || undefined }).catch(() => ({ data: [] })),
        sdk.profiles.following(profileRes?.data?.id || '', { limit: 500 }).catch(() => ({ data: [] })),
      ]);
      const exportPayload = {
        profile: profileRes?.data,
        posts: postsRes?.data || [],
        following: followingRes?.data || [],
        exported_at: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'minds-export.json';
      a.click();
      URL.revokeObjectURL(url);
      showMsg('Data exported');
    } catch { showMsg('Export failed', true); }
  };

  if (loading) {
    return (
      <Container safeTop maxWidth={1040}>
        <View style={{ paddingTop: spacing['3xl'], gap: spacing.xl }}>
          <Skeleton height={88} />
          {[1, 2, 3].map(i => <Skeleton key={i} height={80} />)}
        </View>
      </Container>
    );
  }

  const statusBanner = statusMsg ? (
    <View style={{ backgroundColor: colors.successMuted, padding: spacing.md, borderRadius: radius.md, alignItems: 'center', borderWidth: 0.5, borderColor: colors.borderSubtle }}>
      <Text variant="body" color={colors.success}>{statusMsg}</Text>
    </View>
  ) : null;

  // The profile header — avatar + name + handle, tappable straight to the
  // profile. Sits atop the left rail on desktop and the list on mobile.
  const profileCard = (
    <Pressable
      onPress={() => router.push({ pathname: '/(tabs)/user/[username]', params: { username: user?.username || user?.id || '' } } as any)}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) })}
    >
      <Card variant="raised" padding="lg" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar uri={user?.image} name={user?.name} size="md" />
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" numberOfLines={1}>{user?.name || user?.username || 'Your profile'}</Text>
          {user?.username ? <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ marginTop: 1 }}>@{user.username}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
    </Pressable>
  );

  // The category rail (desktop) / drill-down list (mobile).
  const navList = (
    <View style={{ gap: spacing.xs }}>
      {CATS.map(c => {
        const isOn = active === c.key;
        const highlight = isWide && isOn;
        return (
          <Pressable
            key={c.key}
            onPress={() => { setActive(c.key); setShowDetail(true); }}
            style={({ pressed, hovered }: any) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.sm + 1,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              backgroundColor: highlight ? colors.accentSubtle : hovered ? colors.glass : 'transparent',
              opacity: pressed ? 0.7 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <View style={{ width: 30, height: 30, borderRadius: radius.sm, backgroundColor: highlight ? colors.accentMuted : colors.glass, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={c.icon} size={17} color={highlight ? colors.accent : colors.textMuted} />
            </View>
            <Text variant="bodyMedium" color={highlight ? colors.accent : colors.text} style={{ flex: 1 }}>{c.label}</Text>
            {!isWide && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
          </Pressable>
        );
      })}
    </View>
  );

  const versionFooter = (
    <View style={{ alignItems: 'center', gap: 2, paddingTop: spacing.xl }}>
      <Text variant="bodyMedium" color={colors.textSecondary}>Minds 2.0</Text>
      <Text variant="caption" color={colors.textMuted}>Built on Recursiv · Powered by open source</Text>
      <Text variant="caption" color={colors.textMuted}>Version 2.0.0</Text>
    </View>
  );

  const renderPanel = () => {
    switch (active) {
      case 'account':
        return (
          <>
            <Section title="Login & email">
              <SettingRow first icon="mail-outline" label="Email" value={user?.email || 'Not set'} />
              <SettingRow icon="key-outline" label="Change password" onPress={() => setShowPwForm(s => !s)} />
              {showPwForm && (
                <SectionBlock>
                  <View style={{ gap: spacing.sm }}>
                    <Input secureTextEntry value={pw.current} onChangeText={t => setPw(p => ({ ...p, current: t }))} placeholder="Current password" />
                    <Input secureTextEntry value={pw.next} onChangeText={t => setPw(p => ({ ...p, next: t }))} placeholder="New password" />
                    <Button onPress={changePassword} loading={saving === 'pw'} size="sm" disabled={!pw.current || !pw.next}>Change Password</Button>
                  </View>
                </SectionBlock>
              )}
              <SettingRow icon="at-outline" label="Change email" onPress={() => setShowEmailForm(s => !s)} />
              {showEmailForm && (
                <SectionBlock>
                  <View style={{ gap: spacing.sm }}>
                    <Input value={newEmail} onChangeText={setNewEmail} placeholder="new@email.com" keyboardType="email-address" autoCapitalize="none" />
                    <Input secureTextEntry value={emailPw} onChangeText={setEmailPw} placeholder="Confirm with your password" />
                    <Button onPress={changeEmail} loading={saving === 'email'} size="sm" disabled={!newEmail || !emailPw}>Change Email</Button>
                  </View>
                </SectionBlock>
              )}
            </Section>
            <Section title="Account actions">
              <SettingRow first icon="log-out-outline" label="Log out" onPress={() => { signOut(); }} />
              <SettingRow icon="trash-outline" label="Delete account" destructive onPress={() => setDeleteConfirm(true)} />
              {deleteConfirm && (
                <SectionBlock>
                  <View style={{ gap: spacing.md }}>
                    <Text variant="body" color={colors.error}>This cannot be undone. Enter your password to confirm.</Text>
                    <Input secureTextEntry value={deletePw} onChangeText={setDeletePw} placeholder="Your password" />
                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                      <Button onPress={() => { setDeleteConfirm(false); setDeletePw(''); }} variant="ghost" size="sm">Cancel</Button>
                      <Button onPress={deleteAccount} loading={saving === 'delete'} size="sm" accentColor={colors.error} disabled={!deletePw}>Confirm Delete</Button>
                    </View>
                  </View>
                </SectionBlock>
              )}
            </Section>
          </>
        );

      case 'security':
        return (
          <Section>
            <TwoFactorSetup />
            <SectionBlock>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text variant="caption" color={colors.textMuted} style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'Roboto-Medium' }}>
                  Active sessions{sessions.length > 0 ? ` · ${sessions.length}` : ''}
                </Text>
                {sessions.filter((s: any) => !s.is_current).length > 0 && (
                  <Button onPress={revokeOtherSessions} loading={saving === 'sessions'} variant="ghost" size="sm" accentColor={colors.error}>
                    Revoke all others
                  </Button>
                )}
              </View>
              {sessions.length === 0 ? (
                <Text variant="caption" color={colors.textMuted}>No active sessions</Text>
              ) : (() => {
                // Current device first, then the rest; collapse the long tail.
                const ordered = [...sessions].sort((a: any, b: any) => (b.is_current ? 1 : 0) - (a.is_current ? 1 : 0));
                const visible = showAllSessions ? ordered : ordered.slice(0, 4);
                return (
                  <>
                    {visible.map((s: any) => (
                      <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                            <Text variant="bodyMedium">{friendlyUA(s.user_agent)}</Text>
                            {s.is_current && <Text variant="caption" color={colors.accent}>This device</Text>}
                          </View>
                          <Text variant="caption" color={colors.textMuted}>
                            {[s.ip_address, s.created_at ? `since ${new Date(s.created_at).toLocaleDateString()}` : ''].filter(Boolean).join('  ·  ')}
                          </Text>
                        </View>
                        {!s.is_current && <Button onPress={() => revokeSession(s.id)} variant="ghost" size="sm">Revoke</Button>}
                      </View>
                    ))}
                    {ordered.length > 4 && (
                      <Pressable onPress={() => setShowAllSessions(v => !v)} style={{ paddingVertical: spacing.sm }}>
                        <Text variant="caption" color={colors.accent}>
                          {showAllSessions ? 'Show fewer' : `Show all ${ordered.length} sessions`}
                        </Text>
                      </Pressable>
                    )}
                  </>
                );
              })()}
            </SectionBlock>
            <SectionBlock>
              <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'Roboto-Medium' }}>
                Login history
              </Text>
              {loginHistory.length === 0 ? (
                <Text variant="caption" color={colors.textMuted}>No login history</Text>
              ) : loginHistory.map((e: any, i: number) => (
                <View key={e.id || i} style={{ paddingVertical: spacing.xs }}>
                  <Text variant="body">
                    {friendlyUA(e.user_agent)}{e.success === false ? '  ·  failed' : ''}
                  </Text>
                  <Text variant="caption" color={colors.textMuted}>
                    {[e.ip_address, e.created_at ? new Date(e.created_at).toLocaleString() : ''].filter(Boolean).join('  ·  ')}
                  </Text>
                </View>
              ))}
            </SectionBlock>
          </Section>
        );

      case 'privacy':
        return (
          <Section>
            <SettingRow first icon="globe-outline" label="Public profile" right={<Toggle value={privacy.profilePublic} onValueChange={v => togglePrivacy('profilePublic', v)} />} />
            <SettingRow icon="mail-unread-outline" label="Show email on profile" right={<Toggle value={privacy.showEmail} onValueChange={v => togglePrivacy('showEmail', v)} />} />
          </Section>
        );

      case 'notifications':
        return (
          <Section>
            <SettingRow first icon="chatbubble-outline" label="Replies to my posts" right={<Toggle value={notifPrefs.replies} onValueChange={v => toggleNotif('replies', v)} />} />
            <SettingRow icon="person-add-outline" label="New followers" right={<Toggle value={notifPrefs.follows} onValueChange={v => toggleNotif('follows', v)} />} />
            <SettingRow icon="arrow-up-circle-outline" label="Upvotes on my posts" right={<Toggle value={notifPrefs.votes} onValueChange={v => toggleNotif('votes', v)} />} />
            <SettingRow icon="people-outline" label="Community activity" right={<Toggle value={notifPrefs.community} onValueChange={v => toggleNotif('community', v)} />} />
          </Section>
        );

      case 'appearance':
        return (
          <Section>
            <SectionBlock first>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
                <View style={{ width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="contrast-outline" size={17} color={colors.accent} />
                </View>
                <Text variant="body" style={{ flex: 1 }}>Theme</Text>
              </View>
              <View style={{ flexDirection: 'row', backgroundColor: colors.glass, borderRadius: radius.md, padding: 2, borderWidth: 0.5, borderColor: colors.borderSubtle }}>
                {(['system', 'light', 'dark'] as const).map(opt => {
                  const isOn = themeMode === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => setThemeMode(opt)}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.sm,
                        backgroundColor: isOn ? colors.surfaceRaised : 'transparent',
                        alignItems: 'center',
                        opacity: pressed ? 0.8 : 1,
                        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                      })}
                    >
                      <Text variant="bodyMedium" color={isOn ? colors.text : colors.textMuted} style={{ textTransform: 'capitalize' }}>{opt}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </SectionBlock>
            <SettingRow icon="language-outline" label="Language" value="English" />
          </Section>
        );

      case 'feed':
        return (
          <>
            <Section title="Default feed" footer="Which feed opens when you launch the app. You can always switch tabs once you're in.">
              <SectionBlock first>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {[
                    { key: 'foryou' as const, label: 'For You' },
                    { key: 'following' as const, label: 'Following' },
                  ].map(opt => {
                    const isOn = (getPreference('defaultFeed') as string) === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => { setPreference('defaultFeed', opt.key); setSettingsTick(t => t + 1); }}
                        style={({ pressed }) => ({
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.lg,
                          borderRadius: radius.full,
                          borderWidth: 1,
                          borderColor: isOn ? colors.accent : colors.borderSubtle,
                          backgroundColor: isOn ? colors.accentMuted : 'transparent',
                          opacity: pressed ? 0.7 : 1,
                          ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                        })}
                      >
                        <Text variant="bodyMedium" color={isOn ? colors.accent : colors.text}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </SectionBlock>
            </Section>
            <Section title="Content">
              <SettingRow
                first
                icon="eye-off-outline"
                label="Show NSFW content"
                right={<Toggle value={getPreference('showNsfw')} onValueChange={v => { setPreference('showNsfw', v); setSettingsTick(t => t + 1); }} />}
              />
              <SettingRow
                icon="play-circle-outline"
                label="Autoplay videos"
                right={<Toggle value={getPreference('autoplayVideo')} onValueChange={v => { setPreference('autoplayVideo', v); setSettingsTick(t => t + 1); }} />}
              />
            </Section>
          </>
        );

      case 'ai':
        return (
          <Section>
            <SettingRow
              first
              icon="sparkles-outline"
              label="Set up your personal AI agent"
              sublabel="Name, model, system prompt, secure context, and curation preferences. Change anything anytime."
              onPress={() => router.push('/agent' as any)}
            />
            <SettingRow
              icon="hardware-chip-outline"
              label="Personal AI agent"
              sublabel="Shows your personal agent as a DM in your inbox. Off: no agent in your inbox. For You and the rest of Minds work the same either way."
              right={<Toggle value={getPreference('aiEnabled')} onValueChange={v => { setPreference('aiEnabled', v); }} />}
            />
          </Section>
        );

      case 'data':
        return (
          <Section>
            <SectionBlock first>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  onPress={() => {
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      window.localStorage.removeItem('minds:cache');
                      showMsg('Cache cleared. Reload to see effect.');
                    }
                  }}
                  variant="secondary"
                  size="sm"
                >
                  Clear cache
                </Button>
                <Button onPress={exportData} variant="secondary" size="sm">Export my data</Button>
              </View>
            </SectionBlock>
          </Section>
        );

      case 'help':
        return (
          <Section>
            <SettingRow
              first
              icon="help-buoy-outline"
              label="Message Minds Support"
              sublabel="Get help from our support assistant, any time"
              onPress={async () => {
                if (!sdk) return;
                showMsg('Opening support…');
                const id = await openSupportConversation(sdk);
                if (id) router.push({ pathname: '/(tabs)/chat', params: { id } } as any);
                else showMsg('Support is unavailable right now', true);
              }}
            />
            <SettingRow icon="bulb-outline" label="Feedback & feature requests" sublabel="Suggest ideas, report problems, and upvote what matters" onPress={() => router.push('/(tabs)/feedback' as any)} />
          </Section>
        );

      case 'about':
        return (
          <>
            <Section>
              <SettingRow first icon="document-text-outline" label="Terms of Service" onPress={() => Linking.openURL('https://minds.com/p/terms')} />
              <SettingRow icon="lock-closed-outline" label="Privacy Policy" onPress={() => Linking.openURL('https://minds.com/p/privacy')} />
              <SettingRow icon="people-circle-outline" label="Community Guidelines" onPress={() => Linking.openURL('https://minds.com/p/community-guidelines')} />
            </Section>
            {versionFooter}
          </>
        );

      default:
        return null;
    }
  };

  const activeCat = CATS.find(c => c.key === active) || CATS[0];

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title="Settings" />

      {isWide ? (
        // Desktop: persistent category rail + content pane, centered.
        <View style={{ flex: 1, width: '100%', maxWidth: 1040, alignSelf: 'center', flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing['3xl'] }}>
          <View style={{ width: 248, paddingTop: spacing.xl }}>
            {profileCard}
            <View style={{ height: spacing.lg }} />
            {navList}
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.xl, paddingBottom: spacing['5xl'] }}>
            <View style={{ width: '100%', maxWidth: 600, gap: spacing.xl }}>
              <Text variant="h2">{activeCat.label}</Text>
              {statusBanner}
              {renderPanel()}
            </View>
          </ScrollView>
        </View>
      ) : (
        // Mobile: category list → drill into a detail pane.
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['5xl'], gap: spacing.lg }}>
          {statusBanner}
          {!showDetail ? (
            <>
              {profileCard}
              {navList}
              {versionFooter}
            </>
          ) : (
            <View style={{ gap: spacing.lg }}>
              <Pressable
                onPress={() => setShowDetail(false)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 2, opacity: pressed ? 0.6 : 1, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) })}
              >
                <Ionicons name="chevron-back" size={20} color={colors.accent} />
                <Text variant="body" color={colors.accent}>Settings</Text>
              </Pressable>
              <Text variant="h2">{activeCat.label}</Text>
              {renderPanel()}
            </View>
          )}
        </ScrollView>
      )}
    </Container>
  );
}
