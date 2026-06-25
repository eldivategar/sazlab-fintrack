import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  LayoutChangeEvent,
  useWindowDimensions,
  Platform,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path, Circle } from "react-native-svg";
import { useUIStore } from "../stores/useUIStore";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

// The 4 actual tab routes (index matches state.routes order)
const TAB_CONFIG = [
  {
    name: "index",
    label: "Beranda",
    activeIcon: "home",
    inactiveIcon: "home-outline",
  },
  {
    name: "history",
    label: "Riwayat",
    activeIcon: "time",
    inactiveIcon: "time-outline",
  },
  {
    name: "reports",
    label: "Laporan",
    activeIcon: "pie-chart",
    inactiveIcon: "pie-chart-outline",
  },
  {
    name: "settings",
    label: "Pengaturan",
    activeIcon: "settings",
    inactiveIcon: "settings-outline",
  },
] as const;

const INDICATOR_SPRING = {
  damping: 18,
  stiffness: 180,
  mass: 0.8,
};

const ICON_SPRING = {
  damping: 18,
  stiffness: 220,
  mass: 0.7,
};

const INDICATOR_VERTICAL_PADDING = 8;
const INDICATOR_HORIZONTAL_PADDING = 0;

const CustomTabIcon = ({ name, isFocused }: { name: string; isFocused: boolean }) => {
  const activeColor = "#FF7096";
  const inactiveStroke = "#8ACCD5";
  const inactiveFill = "#4FD1C5"; // Bright teal/cyan combination color

  if (name === "home") {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M9 22v-9a1 1 0 011-1h4a1 1 0 011 1v9"
          fill={isFocused ? "none" : inactiveFill}
          stroke={isFocused ? activeColor : inactiveStroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
          stroke={isFocused ? activeColor : inactiveStroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  if (name === "time") {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Circle
          cx="12"
          cy="12"
          r="9"
          stroke={isFocused ? activeColor : inactiveStroke}
          strokeWidth="2"
        />
        <Path
          d="M12 7v5l3 3"
          stroke={isFocused ? activeColor : inactiveFill}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  if (name === "pie-chart") {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
          d="M22 9h-7V2a8 8 0 017 7z"
          fill={isFocused ? "none" : inactiveFill}
          stroke={isFocused ? activeColor : "none"}
          strokeWidth={isFocused ? "2" : "0"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M20 13A9 9 0 1111 4v9h9z"
          stroke={isFocused ? activeColor : inactiveStroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  if (name === "settings") {
    return (
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Circle
          cx="12"
          cy="12"
          r="3"
          fill={isFocused ? "none" : inactiveFill}
          stroke={isFocused ? activeColor : "none"}
          strokeWidth={isFocused ? "2" : "0"}
        />
        <Path
          d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.6.89 1 1.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
          stroke={isFocused ? activeColor : inactiveStroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  return null;
};

interface TabButtonProps {
  config: (typeof TAB_CONFIG)[number];
  route: any;
  isFocused: boolean;
  navigation: any;
  onLayout: (event: LayoutChangeEvent) => void;
}

function TabButton({
  config,
  route,
  isFocused,
  navigation,
  onLayout,
}: TabButtonProps) {
  const iconScale = useSharedValue(1);
  const { width } = useWindowDimensions();

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const onPress = () => {
    // Spring scale feedback: dip then snap back
    iconScale.value = withSpring(0.92, ICON_SPRING, () => {
      iconScale.value = withSpring(1.0, ICON_SPRING);
    });

    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  return (
    <Pressable onPress={onPress} onLayout={onLayout} style={styles.tabButton}>
      <Animated.View
        style={[{ alignItems: "center", width: "100%" }, iconAnimStyle]}
      >
        <View style={{ marginBottom: 4 }}>
          <CustomTabIcon name={config.activeIcon} isFocused={isFocused} />
        </View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={[
            styles.tabLabel,
            {
              color: isFocused ? "#FF7096" : "#64748B",
              fontFamily: isFocused
                ? "Poppins_600SemiBold"
                : "Poppins_500Medium",
              fontSize: width < 375 ? 9 : 11,
              paddingHorizontal: width < 375 ? 2 : 4,
              includeFontPadding: false,
            },
          ]}
        >
          {config.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function TabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { setVoiceSheetVisible } = useUIStore();
  const { width } = useWindowDimensions();

  // Track measured width for each of the 4 tabs
  const [tabWidths, setTabWidths] = useState<number[]>([0, 0, 0, 0]);
  const [tabXPositions, setTabXPositions] = useState<number[]>([0, 0, 0, 0]);

  // The translateX of the sliding pill indicator
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  // Map state.index to our TAB_CONFIG index (state.routes may not exactly match)
  const getConfigIndex = (routeName: string) =>
    TAB_CONFIG.findIndex((t) => t.name === routeName);

  const activeConfigIndex = getConfigIndex(
    state.routes[state.index]?.name ?? "",
  );

  const handleTabLayout = useCallback(
    (configIndex: number, event: LayoutChangeEvent) => {
      const { width: w, x } = event.nativeEvent.layout;

      setTabWidths((prev) => {
        const next = [...prev];
        next[configIndex] = w;
        return next;
      });
      setTabXPositions((prev) => {
        const next = [...prev];
        next[configIndex] = x;
        return next;
      });
    },
    [],
  );

  // Whenever active tab changes, animate the pill
  React.useEffect(() => {
    if (activeConfigIndex < 0 || tabWidths[activeConfigIndex] === 0) return;

    const targetX =
      tabXPositions[activeConfigIndex] + INDICATOR_HORIZONTAL_PADDING;
    const targetW =
      tabWidths[activeConfigIndex] - INDICATOR_HORIZONTAL_PADDING * 2;

    indicatorX.value = withSpring(targetX, INDICATOR_SPRING);
    indicatorWidth.value = withSpring(targetW, INDICATOR_SPRING);
  }, [activeConfigIndex, tabWidths, tabXPositions]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  const renderTabButton = (configIndex: number) => {
    const config = TAB_CONFIG[configIndex];
    const route = state.routes.find((r: any) => r.name === config.name);
    if (!route) return null;

    const stateIndex = state.routes.indexOf(route);
    const isFocused = state.index === stateIndex;

    return (
      <TabButton
        key={route.key}
        config={config}
        route={route}
        isFocused={isFocused}
        navigation={navigation}
        onLayout={(e) => handleTabLayout(configIndex, e)}
      />
    );
  };

  return (
    <View
      style={[
        styles.outerContainer,
        {
          bottom:
            Platform.OS === "ios"
              ? Math.max(insets.bottom, 16)
              : Math.max(insets.bottom + 8, 20),
          left: width < 375 ? 10 : 16,
          right: width < 375 ? 10 : 16,
          height: 76,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.slidingIndicator,
          {
            top: 0,
            height: 76,
          },
          indicatorStyle,
        ]}
      >
        <View style={styles.activeTopLine} />
        {/* <View style={[styles.slidingPillBackground, { top: INDICATOR_VERTICAL_PADDING, bottom: INDICATOR_VERTICAL_PADDING }]} /> */}
      </Animated.View>

      <View style={styles.content}>
        {renderTabButton(0)}
        {renderTabButton(1)}
        <View style={[styles.spacer, { width: 72 }]} />
        {renderTabButton(2)}
        {renderTabButton(3)}
      </View>

      {/* Floating Center Mic Button */}
      <View style={styles.micOuterGlow} pointerEvents="none" />
      <Pressable
        onPress={() => setVoiceSheetVisible(true)}
        style={({ pressed }) => [
          styles.plusButton,
          { transform: [{ scale: pressed ? 0.93 : 1 }] },
        ]}
      >
        <Ionicons name="mic" size={30} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 28, // more rounded
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 20,
    zIndex: 20,
  },
  slidingIndicator: {
    position: "absolute",
    left: 0,
    zIndex: 0,
    alignItems: "center",
  },
  slidingPillBackground: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: 22,
    backgroundColor: "#FFF0F5",
    zIndex: -1,
  },
  activeTopLine: {
    position: "absolute",
    top: 6,
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FF7096",
  },
  centerWaveContainer: {
    position: "absolute",
    top: -20,
    height: 64, // Same as mic button height
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  sideWave: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  waveDot: {
    width: 3,
    borderRadius: 1.5,
  },
  micOuterGlow: {
    position: "absolute",
    top: -26,
    alignSelf: "center",
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#FFF0F5",
    borderWidth: 1,
    borderColor: "rgba(255, 112, 150, 0.1)",
    zIndex: 1,
  },
  content: {
    flexDirection: "row",
    height: 76,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    zIndex: 2,
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    height: "100%",
    zIndex: 2,
  },
  tabLabel: {
    fontSize: 10,
  },
  spacer: {
    width: 72,
  },
  plusButton: {
    position: "absolute",
    top: -20,
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FF7096",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF7096",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 3,
  },
});
