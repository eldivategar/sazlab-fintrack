import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Text, Portal } from "react-native-paper";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useUIStore, ToastType } from "../stores/useUIStore";

const TOAST_THEMES: Record<
  ToastType,
  {
    accentColor: string;
    outerCircleBg: string;
    innerCircleBg: string;
    iconColor: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  info: {
    accentColor: "#4B89FF",
    outerCircleBg: "#F0F5FF",
    innerCircleBg: "#D8E5FF",
    iconColor: "#2563EB",
    icon: "information-sharp",
  },
  success: {
    accentColor: "#10B981",
    outerCircleBg: "#ECFDF5",
    innerCircleBg: "#D1FAE5",
    iconColor: "#059669",
    icon: "checkmark-sharp",
  },
  error: {
    accentColor: "#EF4444",
    outerCircleBg: "#FEF2F2",
    innerCircleBg: "#FEE2E2",
    iconColor: "#DC2626",
    icon: "close-sharp",
  },
  warning: {
    accentColor: "#F59E0B",
    outerCircleBg: "#FFFBEB",
    innerCircleBg: "#FEF3C7",
    iconColor: "#D97706",
    icon: "warning-sharp",
  },
};

export default function ToastNotification() {
  const insets = useSafeAreaInsets();
  const { toast, hideToast } = useUIStore();

  const translateY = useSharedValue(-50);
  const scale = useSharedValue(0.94);
  const opacity = useSharedValue(0);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (toast) {
      if (timerRef.current) clearTimeout(timerRef.current);

      opacity.value = withTiming(1, { duration: 220 });
      scale.value = withTiming(1, {
        duration: 250,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });
      translateY.value = withTiming(0, {
        duration: 250,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      });

      const duration = toast.duration || 3500;

      // Auto dismiss after duration
      timerRef.current = setTimeout(() => {
        dismiss();
      }, duration);
    } else {
      translateY.value = withTiming(-40, { duration: 180 });
      scale.value = withTiming(0.95, { duration: 180 });
      opacity.value = withTiming(0, { duration: 180 });
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast]);

  const dismiss = () => {
    translateY.value = withTiming(
      -40,
      { duration: 180, easing: Easing.in(Easing.ease) },
      (finished) => {
        if (finished) {
          runOnJS(hideToast)();
        }
      }
    );
    scale.value = withTiming(0.95, { duration: 180 });
    opacity.value = withTiming(0, { duration: 180 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!toast) return null;

  const theme = TOAST_THEMES[toast.type] || TOAST_THEMES.info;
  const topOffset = Math.max(insets.top + 8, 16);

  return (
    <Portal>
      <View style={styles.portalWrapper} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.container,
            { top: topOffset, borderLeftColor: theme.accentColor },
            animatedStyle,
          ]}
        >
          <View style={styles.contentRow}>
            {/* Double Circle Icon Badge */}
            <View
              style={[
                styles.outerCircle,
                { backgroundColor: theme.outerCircleBg },
              ]}
            >
              <View
                style={[
                  styles.innerCircle,
                  { backgroundColor: theme.innerCircleBg },
                ]}
              >
                <Ionicons
                  name={theme.icon}
                  size={18}
                  color={theme.iconColor}
                />
              </View>
            </View>

            {/* Text Area */}
            <View style={styles.textContainer}>
              {toast.title ? (
                <Text style={styles.titleText}>{toast.title}</Text>
              ) : null}
              <Text style={styles.messageText}>{toast.message}</Text>
            </View>

            {/* Close Button */}
            <Pressable onPress={dismiss} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={18} color="#94A3B8" />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  portalWrapper: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    alignItems: "center",
  },
  container: {
    position: "absolute",
    width: "92%",
    maxWidth: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    borderLeftWidth: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
    overflow: "hidden",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 40,
    paddingVertical: 14,
    gap: 14,
  },
  outerCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  innerCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
  },
  titleText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
    color: "#1E293B",
    marginBottom: 2,
  },
  messageText: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    padding: 4,
  },
});
