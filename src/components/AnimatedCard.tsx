/**
 * AnimatedCard
 * ─────────────────────────────────────────────────────────────────────────────
 * A lightweight stagger wrapper that fades + lifts a single item into view.
 *
 * Usage:
 *   <AnimatedCard index={0}>   ← delay = 0 ms
 *   <AnimatedCard index={1}>   ← delay = 50 ms
 *   <AnimatedCard index={2}>   ← delay = 100 ms
 *
 * Caps stagger at 200 ms so long lists don't feel sluggish.
 */
import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface AnimatedCardProps {
  children: React.ReactNode;
  index?: number;
  /** Override stagger step (default 50ms). */
  stepMs?: number;
  /** Override lift distance in px (default 6). */
  lift?: number;
  style?: StyleProp<ViewStyle>;
  /** Pass a value that changes to replay the animation. */
  triggerKey?: string;
}

const DURATION = 240;
const MAX_DELAY = 200;
const easing = Easing.out(Easing.cubic);

export default function AnimatedCard({
  children,
  index = 0,
  stepMs = 50,
  lift = 6,
  style,
  triggerKey,
}: AnimatedCardProps) {
  const delay = Math.min(index * stepMs, MAX_DELAY);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(lift);

  const play = () => {
    opacity.value = 0;
    translateY.value = lift;
    opacity.value = withDelay(delay, withTiming(1, { duration: DURATION, easing }));
    translateY.value = withDelay(delay, withTiming(0, { duration: DURATION, easing }));
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
    <Animated.View style={[animStyle, style]}>
      {children}
    </Animated.View>
  );
}
