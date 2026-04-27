import * as React from 'react';
import { View, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Skeleton } from '../../components';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { loadLastCuratedAt } from '../../lib/onboarding';
import { getPreference } from '../../lib/preferences';
import { colors, spacing } from '../../constants/theme';

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk } = useAuth();
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      if (!sdk) { setLoading(false); return; }
      try {
        const res = await sdk.notifications.list({ limit: 30, organization_id: ORG_ID || undefined });
        let items = res.data || [];

        // Agent-sourced alerts: synthesise an "agent activity" entry
        // whenever the local last-curated timestamp is fresh enough to
        // be worth surfacing (≤ 7 days). This is purely client-side
        // for now — when the platform ships agent-emitted notifications
        // server-side, swap this out for a real subscription. Skipped
        // entirely when the user has flipped off AI in Settings.
        if (getPreference('aiEnabled')) {
          const lastCurated = await loadLastCuratedAt();
          if (lastCurated && Date.now() - lastCurated < 7 * 86_400_000) {
            items = [
              ({
                id: `agent-curated-${lastCurated}`,
                _agentSourced: true,
                title: 'Your agent updated your feed',
                body: 'Pull to refresh your For You for the latest takes.',
                targetType: 'agent',
                target_type: 'agent',
                actionUrl: '/(tabs)',
                action_url: '/(tabs)',
                createdAt: new Date(lastCurated).toISOString(),
                created_at: new Date(lastCurated).toISOString(),
                status: 'unread',
              } as any),
              ...items,
            ];
          }
        }

        setNotifications(items);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [sdk]);

  // Group similar notifications targeting the same post / user within
  // the last 24h so the list reads "Sarah and 2 others reacted" instead
  // of three separate rows. Reduces visual noise and matches what good
  // notification surfaces (Instagram, X) ship.
  const groupedNotifications = React.useMemo(() => {
    const buckets = new Map<string, any[]>();
    const result: any[] = [];
    const DAY = 24 * 3600 * 1000;
    for (const n of notifications) {
      const key = `${n.targetType || n.target_type}-${n.targetId || n.target_id}`;
      const ts = new Date(n.createdAt || n.created_at || 0).getTime();
      if (Date.now() - ts < DAY && (n.targetType || n.target_type) && (n.targetId || n.target_id)) {
        const arr = buckets.get(key) || [];
        arr.push(n);
        buckets.set(key, arr);
      } else {
        result.push(n);
      }
    }
    for (const [, arr] of buckets) {
      if (arr.length === 1) {
        result.push(arr[0]);
      } else {
        const newest = arr[0];
        result.push({
          ...newest,
          _groupedCount: arr.length,
          _groupedTitle: newest.title ? `${newest.title} and ${arr.length - 1} other${arr.length - 1 !== 1 ? 's' : ''}` : `${arr.length} new ${arr.length === 1 ? 'notification' : 'notifications'}`,
        });
      }
    }
    // Sort newest first
    result.sort((a, b) => new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime());
    return result;
  }, [notifications]);

  const handlePress = (notif: any) => {
    // Mark as read
    if (notif.id && notif.status === 'unread' && sdk) {
      sdk.notifications.markAsRead(notif.id).catch(() => {});
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, status: 'read' } : n));
    }

    // Navigate based on URL or target
    const url = notif.actionUrl || notif.action_url || '';
    const targetType = notif.targetType || notif.target_type || '';
    const targetId = notif.targetId || notif.target_id || '';

    if (url.includes('/post/') || targetType === 'post') {
      const postId = url.includes('/post/') ? url.split('/post/').pop() : targetId;
      if (postId) router.push(`/(tabs)/post/${postId}` as any);
    } else if (url.includes('/user/') || url.includes('/profile/') || targetType === 'user' || targetType === 'follow') {
      const username = url.includes('/') ? url.split('/').pop() : targetId;
      if (username) router.push(`/(tabs)/user/${username}` as any);
    } else if (url.includes('/community/') || targetType === 'community') {
      const commId = url.includes('/community/') ? url.split('/community/').pop() : targetId;
      if (commId) router.push(`/(tabs)/community/${commId}` as any);
    } else if (url.includes('/chat') || targetType === 'message' || targetType === 'chat') {
      const chatId = targetId;
      if (chatId) router.push({ pathname: '/(tabs)/chat', params: { id: chatId } } as any);
      else router.push('/(tabs)/chat');
    }
  };

  const markAllRead = async () => {
    if (!sdk) return;
    try {
      await sdk.notifications.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
    } catch {}
  };

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  const getIcon = (type: string): string => {
    const t = (type || '').toLowerCase();
    if (t.includes('mention')) return 'at';
    if (t.includes('reply') || t.includes('comment')) return 'chatbubble';
    if (t.includes('follow')) return 'person-add';
    if (t.includes('repost') || t.includes('reshare')) return 'repeat';
    if (t.includes('like') || t.includes('reaction') || t.includes('vote')) return 'heart';
    if (t.includes('community')) return 'people';
    if (t.includes('message') || t.includes('chat') || t.includes('dm')) return 'mail';
    if (t.includes('agent') || t.includes('curator')) return 'sparkles';
    return 'notifications';
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScreenHeader
        title="Notifications"
        right={unreadCount > 0 ? (
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text variant="caption" color={colors.accent}>Mark all read</Text>
          </Pressable>
        ) : undefined}
      />

      {loading ? (
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <Skeleton width={36} height={36} borderRadius={18} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Skeleton width="80%" height={14} />
                <Skeleton width="40%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : notifications.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing['2xl'] }}>
          <Ionicons name="notifications-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text} align="center">
            Notifications
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 300, lineHeight: 24 }}>
            When people interact with your posts, you'll see it here.
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            Likes, replies, follows, and mentions
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupedNotifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handlePress(item)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.xl,
                paddingVertical: spacing.lg,
                backgroundColor: pressed ? colors.surfaceHover
                  : item._agentSourced ? 'rgba(212,168,68,0.06)'
                  : item.status === 'unread' ? 'rgba(212,168,68,0.03)' : 'transparent',
                borderBottomWidth: 0.5,
                borderBottomColor: colors.borderSubtle,
              })}
            >
              {item._agentSourced ? (
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="sparkles" size={16} color="#fff" />
                </View>
              ) : item.imageUrl || item.image_url ? (
                <Avatar uri={item.imageUrl || item.image_url} name={item.title} size="md" />
              ) : (
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: colors.accentSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={getIcon(item.targetType || item.target_type) as any}
                    size={16}
                    color={colors.accent}
                  />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text variant="body" numberOfLines={2} style={{ fontSize: 14 }}>
                  {item._groupedTitle || item.title || item.body || 'New notification'}
                </Text>
                {item.body && (item._groupedTitle || item.title) && (
                  <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ marginTop: 2 }}>
                    {item.body}
                  </Text>
                )}
              </View>
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>
                {timeAgo(item.createdAt || item.created_at || new Date().toISOString())}
              </Text>
              {item.status === 'unread' && (
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
              )}
            </Pressable>
          )}
          ListEmptyComponent={null}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
