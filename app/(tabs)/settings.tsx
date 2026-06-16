import * as React from 'react';
import { View, ScrollView, Pressable, Switch, Platform, Linking } from 'react-native';
import { showToast } from '../../components/Toast';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card, Skeleton, Divider } from '../../components';
import { Container } from '../../components/Container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { getPreference, setPreference } from '../../lib/preferences';
import { spacing, radius } from '../../constants/theme';
import { useTheme } from '../../lib/theme';
import { useColors } from '../../lib/theme';
import { openSupportConversation } from '../../lib/support';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text
        variant="label"
        color={colors.textMuted}
        style={{ fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', marginLeft: spacing.xs }}
      >
        {title}
      </Text>
      <Card>{children}</Card>
    </View>
  );
}

// One consistent row shape for the whole settings surface: label (+ optional
// sublabel) on the left, and on the right either a control (Switch/Toggle), a
// value string, and/or a chevron when the row navigates. Rows stack inside a
// Card with hairline separators, so everything scans the same way (iOS-style).
function SettingRow({
  label, sublabel, right, value, onPress, first, destructive,
}: {
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  value?: string;
  onPress?: () => void;
  first?: boolean;
  destructive?: boolean;
}) {
  const colors = useColors();
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderTopWidth: first ? 0 : 0.5,
        borderTopColor: colors.borderSubtle,
      }}
    >
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
    return <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>{body}</Pressable>;
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
      <View style={{ gap: spacing.md }}>
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
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
      <View>
        <Text variant="body">Two-factor authentication</Text>
        <Text variant="caption" color={enabled ? colors.success : colors.textMuted}>
          {enabled ? 'Enabled' : 'Not enabled'}
        </Text>
      </View>
      <Button onPress={enable2FA} loading={loading} variant="secondary" size="sm">
        {enabled ? 'Reconfigure' : 'Enable'}
      </Button>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { sdk, user } = useAuth();
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

  if (loading) {
    return (
      <Container safeTop maxWidth={720}>
        <View style={{ paddingTop: spacing['3xl'], gap: spacing.xl }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} height={80} />)}
        </View>
      </Container>
    );
  }

  return (
    <Container safeTop padded={false}>
      {/* Header spans full width so the back button lines up with every other
         page; the settings content stays centered at a readable width. */}
      <ScreenHeader title="Settings" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', paddingBottom: spacing['5xl'] }}>
        <View style={{ width: '100%', maxWidth: 720, padding: spacing.xl, gap: spacing.xl }}>
        {statusMsg && (
          <View style={{ backgroundColor: colors.successMuted, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' }}>
            <Text variant="body" color={colors.success}>{statusMsg}</Text>
          </View>
        )}
        <Section title="Account">
          <SettingRow first label="Email" value={user?.email || 'Not set'} />
          <SettingRow label="Change password" onPress={() => setShowPwForm(s => !s)} />
          {showPwForm && (
            <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
              <Input secureTextEntry value={pw.current} onChangeText={t => setPw(p => ({ ...p, current: t }))} placeholder="Current password" />
              <Input secureTextEntry value={pw.next} onChangeText={t => setPw(p => ({ ...p, next: t }))} placeholder="New password" />
              <Button onPress={changePassword} loading={saving === 'pw'} size="sm" disabled={!pw.current || !pw.next}>Change Password</Button>
            </View>
          )}
          <SettingRow label="Change email" onPress={() => setShowEmailForm(s => !s)} />
          {showEmailForm && (
            <View style={{ gap: spacing.sm, paddingBottom: spacing.md }}>
              <Input value={newEmail} onChangeText={setNewEmail} placeholder="new@email.com" keyboardType="email-address" autoCapitalize="none" />
              <Input secureTextEntry value={emailPw} onChangeText={setEmailPw} placeholder="Confirm with your password" />
              <Button onPress={changeEmail} loading={saving === 'email'} size="sm" disabled={!newEmail || !emailPw}>Change Email</Button>
            </View>
          )}
        </Section>

        <Section title="Security">
          <TwoFactorSetup />
          <Divider marginVertical={spacing.lg} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text variant="label" color={colors.textMuted}>
              Active Sessions{sessions.length > 0 ? ` (${sessions.length})` : ''}
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
            // Current device first, then the rest; collapse the long tail so a
            // pile of sessions doesn't swamp the screen.
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
          <Divider marginVertical={spacing.lg} />
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>Login History</Text>
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
        </Section>

        <Section title="Privacy">
          <SettingRow first label="Public profile" right={<Toggle value={privacy.profilePublic} onValueChange={v => togglePrivacy('profilePublic', v)} />} />
          <SettingRow label="Show email on profile" right={<Toggle value={privacy.showEmail} onValueChange={v => togglePrivacy('showEmail', v)} />} />
        </Section>

        <Section title="Appearance">
          <View style={{ paddingVertical: spacing.xs, gap: spacing.sm }}>
            <Text variant="body">Theme</Text>
            <View style={{ flexDirection: 'row', backgroundColor: colors.glass, borderRadius: radius.md, padding: 2, borderWidth: 0.5, borderColor: colors.borderSubtle }}>
              {(['system', 'light', 'dark'] as const).map(opt => {
                const active = themeMode === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setThemeMode(opt)}
                    style={{ flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: active ? colors.surfaceRaised : 'transparent', alignItems: 'center' }}
                  >
                    <Text variant="bodyMedium" color={active ? colors.text : colors.textMuted} style={{ textTransform: 'capitalize' }}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <SettingRow label="Language" value="English" />
        </Section>

        <Section title="Feed">
          <View style={{ paddingVertical: spacing.xs }}>
            <Text variant="body" style={{ marginBottom: spacing.sm }}>Default feed</Text>
            <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.md, lineHeight: 18 }}>
              Which feed opens when you launch the app. You can always switch tabs once you're in.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {[
                { key: 'foryou' as const, label: 'For You' },
                { key: 'following' as const, label: 'Following' },
              ].map(opt => {
                const isActive = (getPreference('defaultFeed') as string) === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => { setPreference('defaultFeed', opt.key); setSettingsTick(t => t + 1); }}
                    style={({ pressed }) => ({
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.lg,
                      borderRadius: radius.full,
                      borderWidth: 1,
                      borderColor: isActive ? colors.accent : colors.borderSubtle,
                      backgroundColor: isActive ? colors.accentMuted : 'transparent',
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text variant="bodyMedium" color={isActive ? colors.accent : colors.text}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Section>

        <Section title="Content">
          <SettingRow
            first
            label="Show NSFW content"
            right={<Toggle value={getPreference('showNsfw')} onValueChange={v => { setPreference('showNsfw', v); setSettingsTick(t => t + 1); }} />}
          />
          <SettingRow
            label="Autoplay videos"
            right={<Toggle value={getPreference('autoplayVideo')} onValueChange={v => { setPreference('autoplayVideo', v); setSettingsTick(t => t + 1); }} />}
          />
        </Section>

        <Section title="AI">
          {/* Entry point back to the agent setup/edit screen so users who
             dismissed the For You CTA can still find the setup flow. */}
          <SettingRow
            first
            label="Set up your personal AI agent"
            sublabel="Name, model, system prompt, secure context, and curation preferences. Change anything anytime."
            onPress={() => router.push('/agent' as any)}
          />
          <SettingRow
            label="Use my personal AI agent"
            sublabel="Off: clean Minds with no AI mediation. For You falls back to chronological; agent hidden from chat. You can still post, follow, comment, and DM."
            right={<Toggle value={getPreference('aiEnabled')} onValueChange={v => { setPreference('aiEnabled', v); }} />}
          />
        </Section>

        <Section title="Notifications">
          <SettingRow first label="Replies to my posts" right={<Toggle value={notifPrefs.replies} onValueChange={v => toggleNotif('replies', v)} />} />
          <SettingRow label="New followers" right={<Toggle value={notifPrefs.follows} onValueChange={v => toggleNotif('follows', v)} />} />
          <SettingRow label="Upvotes on my posts" right={<Toggle value={notifPrefs.votes} onValueChange={v => toggleNotif('votes', v)} />} />
          <SettingRow label="Community activity" right={<Toggle value={notifPrefs.community} onValueChange={v => toggleNotif('community', v)} />} />
        </Section>

        <Section title="Data">
          <Button
            onPress={() => {
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.localStorage.removeItem('minds:cache');
                showMsg('Cache cleared. Reload to see effect.');
              }
            }}
            variant="ghost"
            size="sm"
          >
            Clear Cache
          </Button>
          <Button
            onPress={async () => {
              if (!sdk) return;
              try {
                // First fetch profile, then use its id for following.
                const profileRes = await sdk.profiles.me().catch(() => null);
                const [postsRes, followingRes] = await Promise.all([
                  sdk.posts.list({ limit: 200, organization_id: ORG_ID || undefined }).catch(() => ({ data: [] })),
                  sdk.profiles.following(profileRes?.data?.id || '', { limit: 500 }).catch(() => ({ data: [] })),
                ]);
                const exportData = {
                  profile: profileRes?.data,
                  posts: postsRes?.data || [],
                  following: followingRes?.data || [],
                  exported_at: new Date().toISOString(),
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'minds-export.json';
                a.click();
                URL.revokeObjectURL(url);
                showMsg('Data exported');
              } catch { showMsg('Export failed', true); }
            }}
            variant="secondary"
            size="sm"
          >
            Export My Data
          </Button>
        </Section>

        <Section title="Help & feedback">
          <SettingRow
            first
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
          <SettingRow label="Feedback & feature requests" sublabel="Suggest ideas, report problems, and upvote what matters" onPress={() => router.push('/(tabs)/feedback' as any)} />
        </Section>

        <Section title="Legal">
          <SettingRow first label="Terms of Service" onPress={() => Linking.openURL('https://minds.com/p/terms')} />
          <SettingRow label="Privacy Policy" onPress={() => Linking.openURL('https://minds.com/p/privacy')} />
          <SettingRow label="Community Guidelines" onPress={() => Linking.openURL('https://minds.com/p/community-guidelines')} />
        </Section>

        <Section title="Danger Zone">
          {!deleteConfirm ? (
            <Button onPress={() => setDeleteConfirm(true)} variant="secondary" size="sm" accentColor={colors.error}>Delete Account</Button>
          ) : (
            <View style={{ gap: spacing.md }}>
              <Text variant="body" color={colors.error}>This cannot be undone. Enter your password to confirm.</Text>
              <Input secureTextEntry value={deletePw} onChangeText={setDeletePw} placeholder="Your password" />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <Button onPress={() => { setDeleteConfirm(false); setDeletePw(''); }} variant="ghost" size="sm">Cancel</Button>
                <Button onPress={deleteAccount} loading={saving === 'delete'} size="sm" accentColor={colors.error} disabled={!deletePw}>Confirm Delete</Button>
              </View>
            </View>
          )}
        </Section>

        <Section title="About">
          <Text variant="body" color={colors.textSecondary}>Minds 2.0</Text>
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
            Built on Recursiv · Powered by open source
          </Text>
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
            Version 2.0.0
          </Text>
        </Section>
        </View>
      </ScrollView>
    </Container>
  );
}
