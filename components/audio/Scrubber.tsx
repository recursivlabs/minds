/**
 * Seekable progress bar. Tap (or drag) anywhere on the track to seek. Shared by
 * the inline player, the mini-player, and the fullscreen player so scrub
 * behavior is identical everywhere.
 */
import * as React from 'react';
import { View, PanResponder, type LayoutChangeEvent } from 'react-native';
import { useColors } from '../../lib/theme';

interface Props {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
  /** Bar thickness. */
  height?: number;
  /** Show the draggable knob (off for the thin mini-player line). */
  knob?: boolean;
  color?: string;
}

export function Scrubber({ position, duration, onSeek, height = 4, knob = true, color }: Props) {
  const colors = useColors();
  const widthRef = React.useRef(0);
  const [dragRatio, setDragRatio] = React.useState<number | null>(null);

  const ratio = dragRatio ?? (duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0);

  const seekFromX = React.useCallback(
    (x: number, commit: boolean) => {
      const w = widthRef.current;
      if (w <= 0 || duration <= 0) return;
      const r = Math.min(1, Math.max(0, x / w));
      if (commit) {
        setDragRatio(null);
        onSeek(r * duration);
      } else {
        setDragRatio(r);
      }
    },
    [duration, onSeek],
  );

  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => seekFromX(e.nativeEvent.locationX, false),
        onPanResponderMove: (e) => seekFromX(e.nativeEvent.locationX, false),
        onPanResponderRelease: (e) => seekFromX(e.nativeEvent.locationX, true),
        onPanResponderTerminate: (e) => seekFromX(e.nativeEvent.locationX, true),
      }),
    [seekFromX],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
  };

  const fill = color || colors.accent;
  const knobSize = height * 3;

  return (
    <View
      {...responder.panHandlers}
      onLayout={onLayout}
      // Pad the touch target vertically so a 4px line is easy to grab.
      style={{ paddingVertical: 8, justifyContent: 'center' }}
      hitSlop={{ top: 8, bottom: 8 }}
    >
      <View style={{ height, borderRadius: height, backgroundColor: colors.border, overflow: 'visible' }}>
        <View style={{ width: `${ratio * 100}%`, height, borderRadius: height, backgroundColor: fill }} />
        {knob && (
          <View
            style={{
              position: 'absolute',
              left: `${ratio * 100}%`,
              top: height / 2 - knobSize / 2,
              width: knobSize,
              height: knobSize,
              borderRadius: knobSize / 2,
              marginLeft: -knobSize / 2,
              backgroundColor: fill,
            }}
          />
        )}
      </View>
    </View>
  );
}
