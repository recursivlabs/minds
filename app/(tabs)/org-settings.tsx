import * as React from 'react';
import { View, ScrollView, Pressable, Platform, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input, Card, Skeleton, Divider } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { colors, spacing, radius } from '../../constants/theme';

export default function OrgSettingsScreen() {
  const router = useRouter();
  const { sdk } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [orgSettings, setOrgSettings] = React.useState<any>(null);
  const [security, setSecurity] = React.useState<any>(null);
  const [githubOwner, setGithubOwner] = React.useState('');
  const [templateUrl, setTemplateUrl] = React.useState('');
  const [saving, setSaving] = React.useState('');

  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);
  const showSuccess = (m: string) => { setStatusMsg(m); setTimeout(() => setStatusMsg(null), 2000); };
  const showError = (m: string) => { Alert.alert('Error', m); };

  const load = React.useCallback(async () => {
    if (!sdk) return;
    setLoading(true);
    try {
      const [os, sec] = await Promise.all([
        sdk.organizationSettings.get(ORG_ID).catch(() => null),
        sdk.organizationSecurity.get(ORG_ID).catch(() => null),
      ]);
      setOrgSettings(os);
      setSecurity(sec);
      if ((os as any)?.github_owner) setGithubOwner((os as any).github_owner);
      if ((os as any)?.default_template_url) setTemplateUrl((os as any).default_template_url);
    } catch {}
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const connectGitHub = async () => {
    if (!sdk || !githubOwner.trim()) return;
    setSaving('github');
    try {
      await sdk.organizationSettings.connectGitHub(ORG_ID, { github_owner: githubOwner } as any);
      showSuccess('GitHub connected.');
      await load();
    } catch { showError('Failed to connect GitHub.'); }
    setSaving('');
  };

  const disconnectGitHub = async () => {
    if (!sdk) return;
    setSaving('github-dc');
    try {
      await sdk.organizationSettings.disconnectGitHub(ORG_ID);
      setGithubOwner('');
      showSuccess('GitHub disconnected.');
      await load();
    } catch { showError('Failed to disconnect GitHub.'); }
    setSaving('');
  };

  const setTemplate = async () => {
    if (!sdk || !templateUrl.trim()) return;
    setSaving('template');
    try {
      await sdk.organizationSettings.setDefaultTemplate(ORG_ID, { url: templateUrl } as any);
      showSuccess('Default template updated.');
    } catch { showError('Failed to set template.'); }
    setSaving('');
  };

  const updateSecurity = async (updates: Record<string, any>) => {
    if (!sdk) return;
    const updated = { ...security, ...updates };
    setSecurity(updated);
    setSaving('security');
    try {
      await sdk.organizationSecurity.update(ORG_ID, updated);
    } catch { showError('Failed to update security.'); await load(); }
    setSaving('');
  };

  if (loading) {
    return (
      <Container safeTop>
        <View style={{ paddingTop: spacing['3xl'], gap: spacing.xl, paddingHorizontal: spacing.xl }}>
          <Skeleton height={100} /><Skeleton height={100} /><Skeleton height={100} />
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
        <Text variant="h3" style={{ flex: 1 }}>Organization Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {statusMsg && (
          <View style={{ backgroundColor: colors.successMuted, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' }}>
            <Text variant="body" color={colors.success}>{statusMsg}</Text>
          </View>
        )}
        <Card>
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>GitHub Integration</Text>
          <Input label="GitHub owner/org" value={githubOwner} onChangeText={setGithubOwner} placeholder="my-org" autoCapitalize="none" />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button onPress={connectGitHub} loading={saving === 'github'} size="sm" disabled={!githubOwner.trim()}>Connect</Button>
            {orgSettings?.github_owner && (
              <Button onPress={disconnectGitHub} loading={saving === 'github-dc'} variant="secondary" size="sm" accentColor={colors.error}>Disconnect</Button>
            )}
          </View>
        </Card>

        <Card>
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Default Template</Text>
          <Input label="Template URL" value={templateUrl} onChangeText={setTemplateUrl} placeholder="https://github.com/org/template" autoCapitalize="none" />
          <Button onPress={setTemplate} loading={saving === 'template'} size="sm" disabled={!templateUrl.trim()}>Set Template</Button>
        </Card>

        {security && (
          <Card>
            <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Security Policies</Text>
            {[
              { key: 'require_2fa', label: 'Require 2FA' },
              { key: 'require_invite', label: 'Require invite code' },
              { key: 'allow_public_signup', label: 'Allow public signup' },
              { key: 'enable_audit_log', label: 'Enable audit log' },
            ].map(({ key, label }) => (
              security[key] !== undefined ? (
                <View key={key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
                  <Text variant="body">{label}</Text>
                  <Switch
                    value={!!security[key]}
                    onValueChange={v => updateSecurity({ [key]: v })}
                    trackColor={{ true: colors.accent, false: colors.glass }}
                    thumbColor={colors.text}
                  />
                </View>
              ) : null
            ))}
          </Card>
        )}
      </ScrollView>
    </Container>
  );
}
