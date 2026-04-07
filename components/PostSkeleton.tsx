import * as React from 'react';
import { View } from 'react-native';
import { Skeleton } from './Skeleton';
import { spacing } from '../constants/theme';

export const PostSkeleton = React.memo(function PostSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.lg }}>
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginBottom: spacing.md }}>
        <Skeleton width={32} height={32} borderRadius={16} />
        <Skeleton width={100} height={13} />
        <Skeleton width={30} height={11} />
      </View>
      <Skeleton width="95%" height={14} style={{ marginBottom: spacing.xs }} />
      <Skeleton width="80%" height={14} style={{ marginBottom: spacing.xs }} />
      <Skeleton width="60%" height={14} style={{ marginBottom: spacing.md }} />
      <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.sm }}>
        <Skeleton width={50} height={12} />
        <Skeleton width={40} height={12} />
      </View>
    </View>
  );
});

export function FeedSkeletons({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <PostSkeleton key={i} />
      ))}
    </View>
  );
}
