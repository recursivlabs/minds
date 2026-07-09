import * as React from 'react';
import { View, Platform, useWindowDimensions } from 'react-native';
import { FeedSidebar } from './FeedSidebar';
import { spacing } from '../constants/theme';

/**
 * Two-column [center ≤ maxWidth | 340px right rail] layout on desktop web,
 * matching the home feed. On mobile/native (or narrow web) it renders the
 * children full-width with no rail.
 *
 * The rail defaults to the shared FeedSidebar (trending posts / communities /
 * people / agents — all self-fetching). Pass `rail` to swap in a context-
 * specific rail later (e.g. wallet stats, community about) without touching
 * callers. Keeps the center column consistent across Discovery / Search /
 * Communities / Profile / Wallet.
 */
export function RightRailLayout({
  children,
  rail,
  maxWidth = 600,
}: {
  children: React.ReactNode;
  rail?: React.ReactNode;
  maxWidth?: number;
}) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

  if (!isDesktopWeb) return <>{children}</>;

  return (
    <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <View style={{ flex: 1, maxWidth, minWidth: 0 }}>{children}</View>
      <View style={{ width: spacing.xl }} />
      <View style={{ width: 340 }}>{rail ?? <FeedSidebar />}</View>
    </View>
  );
}
