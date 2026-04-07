import * as React from 'react';
import { View, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Skeleton } from '../../components';
import { useAuth } from '../../lib/auth';
import { BASE_ORIGIN } from '../../lib/recursiv';
import { getItem } from '../../lib/storage';
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
      try {
        const apiKey = await getItem('minds:api_key');
        if (!apiKey) return;
        const res = await fetch(`${BASE_ORIGIN}/api/v1/notifications?limit=30`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.data || []);
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, [sdk]);

  const handlePress = (notif: any) => {
    const url = notif.actionUrl || notif.action_url;
    if (url) {
      // Parse action URL to navigate within the app
      if (url.includes('/post/')) {
        const postId = url.split('/post/').pop();
        if (postId) router.push(`/(tabs)/post/${postId}` as any);
      } else if (url.includes('/user/') || url.includes('/profile/')) {
        const username = url.split('/').pop();
        if (username) router.push(`/(tabs)/user/${username}` as any);
      }
    }
  };

  const getIcon = (type: string): string => {
    if (type?.includes('reply') || type?.includes('comment')) return 'chatbubble';
    if (type?.includes('follow')) return 'person-add';
    if (type?.includes('reaction') || type?.includes('vote')) return 'heart';
    if (type?.includes('mention')) return 'at';
    return 'notifications';
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
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
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text variant="bodyMedium">Notifications</Text>
      </View>

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
      ) : (
        <FlatList
          data={notifications}
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
                  : item.status === 'unread' ? 'rgba(212,168,68,0.03)' : 'transparent',
                borderBottomWidth: 0.5,
                borderBottomColor: 'rgba(255,255,255,0.04)',
              })}
            >
              {item.imageUrl || item.image_url ? (
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
                  {item.title || item.body || 'New notification'}
                </Text>
                {item.body && item.title && (
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
          ListEmptyComponent={
            <View style={{ alignItems: 'center', padding: spacing['5xl'], gap: spacing.lg }}>
              <Ionicons name="notifications-outline" size={36} color={colors.textMuted} />
              <Text variant="body" color={colors.textMuted} align="center">
                No notifications yet
              </Text>
              <Text variant="caption" color={colors.textMuted} align="center" style={{ maxWidth: 240 }}>
                When people interact with your posts, you'll see it here
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
