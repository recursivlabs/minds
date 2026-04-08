import * as React from 'react';
import { View, Pressable, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { useAuth } from '../lib/auth';
import { useProfiles, useAgents, useCommunities } from '../lib/hooks';
import { getItem, setItem } from '../lib/storage';
import { colors, spacing, radius } from '../constants/theme';

const ONBOARDING_KEY = 'minds:onboarding:completed';

export function useOnboarding() {
  const [completed, setCompleted] = React.useState(true); // default true to avoid flash
  const { user } = useAuth();

  React.useEffect(() => {
    if (!user) return;
    (async () => {
      const done = await getItem(ONBOARDING_KEY);
      if (!done) setCompleted(false);
      else setCompleted(true);
    })();
  }, [user]);

  const complete = React.useCallback(() => {
    setCompleted(true);
    setItem(ONBOARDING_KEY, 'true');
  }, []);

  return { showOnboarding: !completed, completeOnboarding: complete };
}

interface Props {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: Props) {
  const { user, sdk } = useAuth();
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [followedIds, setFollowedIds] = React.useState<Set<string>>(new Set());
  const [joinedIds, setJoinedIds] = React.useState<Set<string>>(new Set());

  const { profiles } = useProfiles(10);
  const { agents } = useAgents(10);
  const { communities } = useCommunities(10);

  const handleFollow = async (id: string) => {
    if (!sdk) return;
    setFollowedIds(prev => new Set(prev).add(id));
    try { await sdk.profiles.follow(id); } catch {}
  };

  const handleJoin = async (id: string) => {
    if (!sdk) return;
    setJoinedIds(prev => new Set(prev).add(id));
    try { await sdk.communities.join(id); } catch {}
  };

  const steps = [
    // Step 0: Welcome
    () => (
      <View style={{ alignItems: 'center', gap: spacing['2xl'] }}>
        <Text variant="h1" color={colors.accent} align="center" style={{ letterSpacing: 6 }}>
          minds
        </Text>
        <Text variant="h2" color={colors.text} align="center">
          Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 320, lineHeight: 24 }}>
          Minds is an open network where your ideas matter. Follow people, join communities, and discover AI agents.
        </Text>
        <Button onPress={() => setStep(1)}>Get Started</Button>
      </View>
    ),

    // Step 1: Follow people
    () => (
      <View style={{ gap: spacing.xl, width: '100%' }}>
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Text variant="h3" color={colors.text} align="center">Follow people</Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 300 }}>
            Your feed is built from who you follow.
          </Text>
        </View>
        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          {(profiles || []).slice(0, 6).map((p: any) => (
            <Pressable
              key={p.id}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
                borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <Avatar uri={p.image || p.avatar} name={p.name} size="md" />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" numberOfLines={1}>{p.name}</Text>
                {p.username && <Text variant="caption" color={colors.textMuted}>@{p.username}</Text>}
                {(p.bio || p.description) && <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>{p.bio || p.description}</Text>}
              </View>
              <Pressable
                onPress={() => handleFollow(p.id)}
                style={{
                  paddingHorizontal: spacing.lg, paddingVertical: spacing.xs + 2,
                  borderRadius: radius.full,
                  backgroundColor: followedIds.has(p.id) ? colors.surface : colors.accentMuted,
                  borderWidth: followedIds.has(p.id) ? 0.5 : 0, borderColor: colors.glassBorder,
                }}
              >
                <Text variant="caption" color={followedIds.has(p.id) ? colors.textSecondary : colors.accent}>
                  {followedIds.has(p.id) ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
        <Button onPress={() => setStep(2)}>{followedIds.size > 0 ? 'Continue' : 'Skip'}</Button>
      </View>
    ),

    // Step 2: Join communities
    () => (
      <View style={{ gap: spacing.xl, width: '100%' }}>
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Text variant="h3" color={colors.text} align="center">Join communities</Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 300 }}>
            Find your people.
          </Text>
        </View>
        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          {(communities || []).slice(0, 6).map((c: any) => (
            <Pressable
              key={c.id}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
                borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
              }}
            >
              <Avatar uri={c.image || c.avatar} name={c.name} size="md" />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" numberOfLines={1}>{c.name}</Text>
                <Text variant="caption" color={colors.textMuted}>{c.memberCount || c.member_count || 0} members</Text>
                {c.description && <Text variant="caption" color={colors.textSecondary} numberOfLines={1}>{c.description}</Text>}
              </View>
              <Pressable
                onPress={() => handleJoin(c.id)}
                style={{
                  paddingHorizontal: spacing.lg, paddingVertical: spacing.xs + 2,
                  borderRadius: radius.full,
                  backgroundColor: joinedIds.has(c.id) ? colors.surface : colors.accentMuted,
                  borderWidth: joinedIds.has(c.id) ? 0.5 : 0, borderColor: colors.glassBorder,
                }}
              >
                <Text variant="caption" color={joinedIds.has(c.id) ? colors.textSecondary : colors.accent}>
                  {joinedIds.has(c.id) ? 'Joined' : 'Join'}
                </Text>
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
        <Button onPress={() => setStep(3)}>{joinedIds.size > 0 ? 'Continue' : 'Skip'}</Button>
      </View>
    ),

    // Step 3: Done
    () => (
      <View style={{ alignItems: 'center', gap: spacing['2xl'] }}>
        <Ionicons name="checkmark-circle" size={64} color={colors.accent} />
        <Text variant="h2" color={colors.text} align="center">You're all set</Text>
        <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 320, lineHeight: 24 }}>
          {followedIds.size > 0 || joinedIds.size > 0
            ? "Your feed is ready. Scroll, post, vote, and discover."
            : "Start by exploring the feed and following people you find interesting."
          }
        </Text>
        <Button onPress={onComplete}>Enter Minds</Button>
      </View>
    ),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'] }}>
      <View style={{ width: '100%', maxWidth: 420 }}>
        {/* Progress dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing['3xl'] }}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === step ? 24 : 8, height: 8, borderRadius: 4,
                backgroundColor: i === step ? colors.accent : i < step ? colors.accentMuted : colors.surface,
              }}
            />
          ))}
        </View>
        {steps[step]()}
      </View>
    </View>
  );
}
