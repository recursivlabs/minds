import * as React from 'react';
import { View, FlatList, Pressable, Platform } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Skeleton, RightRailLayout } from '../../components';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { formatTimestamp } from '../../lib/time';
import { invalidate } from '../../lib/cache';
import { spacing } from '../../constants/theme';
import { useColors } from '../../lib/theme';

// Unified app-wide format (see lib/time): <24h relative, older = date only.
const timeAgo = (dateStr: string) => formatTimestamp(dateStr);

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk } = useAuth();
  const colors = useColors();
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [loadedOnce, setLoadedOnce] = React.useState(false);
  const loadNotifications = React.useCallback(async () => {
      if (!sdk) { setLoading(false); return; }
      try {
        const res = await sdk.notifications.list({ limit: 30, organization_id: ORG_ID || undefined });
        setNotifications(res.data || []);
      } catch {}
      finally { setLoading(false); setLoadedOnce(true); }
  }, [sdk]);

  // Initial load.
  React.useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // Live updates: refetch when a notification lands over the socket, so a new
  // reply/follow/vote shows up here without a manual refresh (X parity).
  // Debounced with per-client jitter: fan-out events (a popular post getting
  // 20 likes, an org announcement) hit every online recipient at the same
  // instant, and an immediate refetch per event turns that into a
  // synchronized request spike proportional to audience size.
  React.useEffect(() => {
    if (!sdk) return;
    let cleanup: (() => void) | undefined;
    let pending: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        await sdk.realtime.connect();
        const sock = (sdk as any).realtime?.socket;
        if (!sock) return;
        const onNotif = () => {
          if (pending) return; // burst-coalesce: one refetch per window
          pending = setTimeout(() => {
            pending = null;
            loadNotifications();
          }, 1000 + Math.random() * 2000);
        };
        sock.on('notification', onNotif);
        cleanup = () => sock.off?.('notification', onNotif);
      } catch {}
    })();
    return () => {
      cleanup?.();
      if (pending) clearTimeout(pending);
    };
  }, [sdk, loadNotifications]);

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
      sdk.notifications.markAsRead(notif.id)
        .then(() => invalidate('notifications')) // nudge the tab badge now, not in 60s
        .catch(() => {});
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
    setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
    if (!sdk) return;
    try {
      await sdk.notifications.markAllAsRead();
      invalidate('notifications'); // nudge the tab badge now, not in 60s
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
    return 'notifications';
  };

  // X-style type badge (small colored circle overlaid on the actor avatar):
  // a glanceable indicator of WHAT happened, color-coded like X/Instagram.
  const getTypeVisual = (type: string): { icon: string; color: string } => {
    const t = (type || '').toLowerCase();
    if (t.includes('follow')) return { icon: 'person', color: colors.accent };
    if (t.includes('repost') || t.includes('reshare') || t.includes('remind')) return { icon: 'repeat', color: '#00ba7c' };
    if (t.includes('like') || t.includes('reaction') || t.includes('vote') || t.includes('react')) return { icon: 'heart', color: '#f91880' };
    if (t.includes('reply') || t.includes('comment')) return { icon: 'chatbubble', color: colors.accent };
    if (t.includes('mention')) return { icon: 'at', color: colors.accent };
    if (t.includes('message') || t.includes('chat') || t.includes('dm')) return { icon: 'mail', color: colors.accent };
    return { icon: 'notifications', color: colors.accent };
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <RightRailLayout context="notifications">
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
      ) : loadedOnce && notifications.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="notifications-outline" size={34} color={colors.accent} />
          </View>
          <Text variant="h2" color={colors.text} align="center">
            Nothing here yet
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 320, lineHeight: 24 }}>
            Create a post or reply to others to start receiving notifications. Likes, replies, follows, and mentions all show up here.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
            <Pressable
              onPress={() => router.push('/(tabs)/create')}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
                paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg,
                borderRadius: 999, backgroundColor: colors.accent,
                opacity: pressed ? 0.85 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Ionicons name="create-outline" size={17} color={colors.textOnAccent} />
              <Text variant="bodyMedium" color={colors.textOnAccent}>Create a post</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/discover')}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
                paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg,
                borderRadius: 999, borderWidth: 1, borderColor: colors.borderSubtle,
                opacity: pressed ? 0.7 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Ionicons name="compass-outline" size={17} color={colors.text} />
              <Text variant="bodyMedium" color={colors.text}>Find people</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <FlatList
          data={groupedNotifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const t = (item.targetType || item.target_type || '').toLowerCase();
            // Visual hierarchy: high-signal alerts (mentions, replies,
            // agent-sourced, DMs) get full padding + emphasis; low-signal
            // (likes/reactions) collapse to a slimmer row.
            const highSignal = t.includes('mention') || t.includes('reply') || t.includes('comment') || t.includes('message') || t.includes('dm');

            // Swipe-left → dismiss. Optimistic UI: remove from list
            // immediately, mark-as-read on the server in the background
            // (best-effort).
            const renderRightAction = () => (
              <View style={{
                width: 80,
                backgroundColor: colors.error || '#ef4444',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="close-circle" size={22} color="#fff" />
              </View>
            );
            const handleDismiss = () => {
              setNotifications(prev => prev.filter(n => n.id !== item.id));
              if (sdk && item.id && item.status === 'unread') {
                sdk.notifications.markAsRead(item.id).catch(() => {});
              }
            };

            return (
            <Swipeable
              renderRightActions={renderRightAction}
              onSwipeableRightOpen={handleDismiss}
              overshootRight={false}
            >
            <Pressable
              onPress={() => handlePress(item)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingHorizontal: spacing.xl,
                paddingVertical: highSignal ? spacing.lg : spacing.md,
                backgroundColor: pressed ? colors.surfaceHover
                  : item.status === 'unread' ? colors.accentSubtle : 'transparent',
                borderBottomWidth: 0.5,
                borderBottomColor: colors.borderSubtle,
              })}
            >
              {/* Actor avatar with an X-style type badge overlaid bottom-right. */}
              <View style={{ position: 'relative', width: 40, height: 40 }}>
                {item._agentSourced ? (
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="sparkles" size={18} color="#fff" />
                  </View>
                ) : (item.imageUrl || item.image_url) ? (
                  <Avatar uri={item.imageUrl || item.image_url} name={item.title} size="md" />
                ) : (
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSubtle, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={getIcon(item.targetType || item.target_type) as any} size={18} color={colors.accent} />
                  </View>
                )}
                {(() => {
                  const tv = getTypeVisual(item.targetType || item.target_type);
                  return (
                    <View style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: tv.color, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg }}>
                      <Ionicons name={tv.icon as any} size={9} color="#fff" />
                    </View>
                  );
                })()}
              </View>
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
            </Swipeable>
            );
          }}
          ListEmptyComponent={null}
          showsVerticalScrollIndicator={false}
        />
      )}
      </RightRailLayout>
    </View>
  );
}
