import * as React from 'react';
import { View, ScrollView, Pressable, Switch, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card, Skeleton, Divider } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius } from '../../constants/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="h3">{title}</Text>
      <Card>{children}</Card>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { sdk } = useAuth();

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
      if (prefs?.privacy) {
        setPrivacy({
          profilePublic: prefs.privacy.profilePublic ?? true,
          showEmail: prefs.privacy.showEmail ?? false,
        });
      }
      setSessions(Array.isArray(sess) ? sess : sess?.sessions || []);
      setLoginHistory(Array.isArray(history) ? history : history?.entries || []);
    } catch {}
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const showMsg = (msg: string) => {
    if (Platform.OS === 'web') alert(msg);
    else Alert.alert('', msg);
  };

  const changePassword = async () => {
    if (!sdk || !pw.current || !pw.next) return;
    setSaving('pw');
    try {
      await sdk.settings.changePassword({ current_password: pw.current, new_password: pw.next });
      setPw({ current: '', next: '' });
      showMsg('Password changed.');
    } catch { showMsg('Failed to change password.'); }
    setSaving('');
  };

  const changeEmail = async () => {
    if (!sdk || !newEmail || !emailPw) return;
    setSaving('email');
    try {
      await sdk.settings.requestEmailChange({ new_email: newEmail, password: emailPw });
      setNewEmail(''); setEmailPw('');
      showMsg('Check your email to confirm the change.');
    } catch { showMsg('Failed to request email change.'); }
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
      });
    } catch { setPrivacy(privacy); showMsg('Failed to update privacy.'); }
  };

  const revokeSession = async (id: string) => {
    if (!sdk) return;
    try {
      await sdk.settings.revokeSession(id);
      setSessions(s => s.filter(x => x.id !== id));
    } catch { showMsg('Failed to revoke session.'); }
  };

  const deleteAccount = async () => {
    if (!sdk || !deletePw) return;
    setSaving('delete');
    try {
      await sdk.settings.requestDeletion({ password: deletePw, reason: 'User requested' });
      showMsg('Account deletion requested.');
      setDeleteConfirm(false); setDeletePw('');
    } catch { showMsg('Failed to request deletion.'); }
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h3" style={{ flex: 1 }}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['5xl'] }}>
        <Section title="Account">
          <Input label="Current password" secureTextEntry value={pw.current} onChangeText={t => setPw(p => ({ ...p, current: t }))} placeholder="Current password" />
          <Input label="New password" secureTextEntry value={pw.next} onChangeText={t => setPw(p => ({ ...p, next: t }))} placeholder="New password" />
          <Button onPress={changePassword} loading={saving === 'pw'} size="sm" disabled={!pw.current || !pw.next}>Change Password</Button>
          <Divider marginVertical={spacing.lg} />
          <Input label="New email" value={newEmail} onChangeText={setNewEmail} placeholder="new@email.com" keyboardType="email-address" autoCapitalize="none" />
          <Input label="Confirm with password" secureTextEntry value={emailPw} onChangeText={setEmailPw} placeholder="Your password" />
          <Button onPress={changeEmail} loading={saving === 'email'} size="sm" disabled={!newEmail || !emailPw}>Change Email</Button>
        </Section>

        <Section title="Security">
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
      </ScrollView>
    </Container>
  );
}
