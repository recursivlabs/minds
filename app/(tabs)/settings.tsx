import * as React from 'react';
import { View, ScrollView, Pressable, Switch, Platform, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card, Skeleton, Divider } from '../../components';
import { Container } from '../../components/Container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { getPreference, setPreference } from '../../lib/preferences';
import { colors, spacing, radius } from '../../constants/theme';
import { useTheme } from '../../lib/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="h3">{title}</Text>
      <Card>{children}</Card>
    </View>
  );
}

function TwoFactorSetup() {
  const { sdk } = useAuth();
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
    } catch { Alert.alert('Error', 'Could not enable 2FA'); }
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
        Alert.alert('Success', '2FA is now enabled');
      } else {
        Alert.alert('Error', 'Invalid code. Try again.');
      }
    } catch { Alert.alert('Error', 'Verification failed'); }
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
          maxLength={6}
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
  const { mode: themeMode, toggle: toggleTheme } = useTheme();

  const [loading, setLoading] = React.useState(true);
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [loginHistory, setLoginHistory] = React.useState<any[]>([]);
  const [privacy, setPrivacy] = React.useState({ profilePublic: true, showEmail: false });
  const [pw, setPw] = React.useState({ current: '', next: '' });
  const [newEmail, setNewEmail] = React.useState('');
  const [emailPw, setEmailPw] = React.useState('');
  const [saving, setSaving] = React.useState('');
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [deletePw, setDeletePw] = React.useState('');

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
      Alert.alert('Error', msg);
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
      <Container safeTop>
        <View style={{ paddingTop: spacing['3xl'], gap: spacing.xl }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} height={80} />)}
        </View>
      </Container>
    );
  }

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title="Settings" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {statusMsg && (
          <View style={{ backgroundColor: colors.successMuted, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' }}>
            <Text variant="body" color={colors.success}>{statusMsg}</Text>
          </View>
        )}
        <Section title="Account">
          <View style={{ paddingVertical: spacing.sm, marginBottom: spacing.md }}>
            <Text variant="caption" color={colors.textMuted}>Email</Text>
            <Text variant="body" style={{ marginTop: spacing.xs }}>{user?.email || 'Not set'}</Text>
          </View>
          <Divider marginVertical={spacing.sm} />
          <Input label="Current password" secureTextEntry value={pw.current} onChangeText={t => setPw(p => ({ ...p, current: t }))} placeholder="Current password" />
          <Input label="New password" secureTextEntry value={pw.next} onChangeText={t => setPw(p => ({ ...p, next: t }))} placeholder="New password" />
          <Button onPress={changePassword} loading={saving === 'pw'} size="sm" disabled={!pw.current || !pw.next}>Change Password</Button>
          <Divider marginVertical={spacing.lg} />
          <Input label="New email" value={newEmail} onChangeText={setNewEmail} placeholder="new@email.com" keyboardType="email-address" autoCapitalize="none" />
          <Input label="Confirm with password" secureTextEntry value={emailPw} onChangeText={setEmailPw} placeholder="Your password" />
          <Button onPress={changeEmail} loading={saving === 'email'} size="sm" disabled={!newEmail || !emailPw}>Change Email</Button>
        </Section>

        <Section title="Security">
          <TwoFactorSetup />
          <Divider marginVertical={spacing.lg} />
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>Active Sessions</Text>
          {sessions.length === 0 ? (
            <Text variant="caption" color={colors.textMuted}>No active sessions</Text>
          ) : sessions.map((s: any) => (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{s.device || s.userAgent || 'Unknown device'}</Text>
                <Text variant="caption" color={colors.textMuted}>{s.ip || ''} {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ''}</Text>
              </View>
              <Button onPress={() => revokeSession(s.id)} variant="ghost" size="sm">Revoke</Button>
            </View>
          ))}
          <Divider marginVertical={spacing.lg} />
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>Login History</Text>
          {loginHistory.length === 0 ? (
            <Text variant="caption" color={colors.textMuted}>No login history</Text>
          ) : loginHistory.map((e: any, i: number) => (
            <View key={i} style={{ paddingVertical: spacing.xs }}>
              <Text variant="body">{e.device || e.userAgent || 'Unknown'}</Text>
              <Text variant="caption" color={colors.textMuted}>{e.ip || ''} {e.createdAt ? new Date(e.createdAt).toLocaleDateString() : ''}</Text>
            </View>
          ))}
        </Section>

        <Section title="Privacy">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text variant="body">Public profile</Text>
            <Switch value={privacy.profilePublic} onValueChange={v => togglePrivacy('profilePublic', v)} trackColor={{ true: colors.accent, false: colors.glass }} thumbColor={colors.text} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text variant="body">Show email on profile</Text>
            <Switch value={privacy.showEmail} onValueChange={v => togglePrivacy('showEmail', v)} trackColor={{ true: colors.accent, false: colors.glass }} thumbColor={colors.text} />
          </View>
        </Section>

        <Section title="Appearance">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text variant="body">Dark mode</Text>
            <Switch
              value={themeMode === 'dark'}
              onValueChange={toggleTheme}
              trackColor={{ true: colors.accent, false: colors.glass }}
              thumbColor={colors.text}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text variant="body">Language</Text>
            <Text variant="body" color={colors.textMuted}>English</Text>
          </View>
        </Section>

        <Section title="Content">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text variant="body">Show NSFW content</Text>
            <Switch
              value={getPreference('showNsfw')}
              onValueChange={v => { setPreference('showNsfw', v); }}
              trackColor={{ true: colors.accent, false: colors.glass }}
              thumbColor={colors.text}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text variant="body">Autoplay videos</Text>
            <Switch
              value={getPreference('autoplayVideo')}
              onValueChange={v => { setPreference('autoplayVideo', v); }}
              trackColor={{ true: colors.accent, false: colors.glass }}
              thumbColor={colors.text}
            />
          </View>
        </Section>

        <Section title="AI">
          <View style={{ paddingVertical: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: spacing.lg }}>
                <Text variant="body">Use my personal AI agent</Text>
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2, lineHeight: 18 }}>
                  Off: clean Minds with no AI mediation. For You falls back to chronological. Agent hidden from chat. You can still post, follow, comment, and DM.
                </Text>
              </View>
              <Switch
                value={getPreference('aiEnabled')}
                onValueChange={v => { setPreference('aiEnabled', v); }}
                trackColor={{ true: colors.accent, false: colors.glass }}
                thumbColor={colors.text}
              />
            </View>
          </View>
        </Section>

        <Section title="Notifications">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text variant="body">Replies to my posts</Text>
            <Switch value={true} trackColor={{ true: colors.accent, false: colors.glass }} thumbColor={colors.text} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text variant="body">New followers</Text>
            <Switch value={true} trackColor={{ true: colors.accent, false: colors.glass }} thumbColor={colors.text} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text variant="body">Upvotes on my posts</Text>
            <Switch value={true} trackColor={{ true: colors.accent, false: colors.glass }} thumbColor={colors.text} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text variant="body">Community activity</Text>
            <Switch value={true} trackColor={{ true: colors.accent, false: colors.glass }} thumbColor={colors.text} />
          </View>
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

        <Section title="Legal">
          <Pressable onPress={() => Linking.openURL('https://minds.com/p/terms')} style={{ paddingVertical: spacing.sm }}>
            <Text variant="body" color={colors.accent}>Terms of Service</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('https://minds.com/p/privacy')} style={{ paddingVertical: spacing.sm }}>
            <Text variant="body" color={colors.accent}>Privacy Policy</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('https://minds.com/p/community-guidelines')} style={{ paddingVertical: spacing.sm }}>
            <Text variant="body" color={colors.accent}>Community Guidelines</Text>
          </Pressable>
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
      </ScrollView>
    </Container>
  );
}
