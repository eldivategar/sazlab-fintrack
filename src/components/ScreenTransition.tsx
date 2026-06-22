/**
 * ScreenTransition
 * ─────────────────────────────────────────────────────────────────────────────
 * A lightweight Reanimated wrapper that gives every tab-screen the same
 * premium "fade + subtle lift" entrance.
 *
 * Usage:
 *   <ScreenTransition>
 *     {/* your screen content *\/}
 *   </ScreenTransition>
 *
 * Re-triggers whenever `triggerKey` changes (e.g. pass `isFocused` cast to
 * string so the animation replays each time the tab is re-focused).
 */
import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

interface ScreenTransitionProps {
  children: React.ReactNode;
  /** Pass `String(isFocused)` to replay animation when the tab gains focus. */
  triggerKey?: string;
  style?: StyleProp<ViewStyle>;
}

const DURATION = 220; // ms — fast enough to feel snappy, slow enough to feel polished
const LIFT = 8;       // px — subtle upward travel, not a full slide

const easing = Easing.out(Easing.cubic);

export default function ScreenTransition({
  children,
  triggerKey,
  style,
}: ScreenTransitionProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(LIFT);

  const play = () => {
    opacity.value = 0;
    translateY.value = LIFT;
    opacity.value = withTiming(1, { duration: DURATION, easing });
    translateY.value = withTiming(0, { duration: DURATION, easing });
  };

  useEffect(() => {
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, animStyle, style]}>
      {children}
    </Animated.View>
  );
}
