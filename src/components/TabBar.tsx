import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUIStore } from '../stores/useUIStore';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

// The 4 actual tab routes (index matches state.routes order)
const TAB_CONFIG = [
  { name: 'index',    label: 'Beranda',    activeIcon: 'home',      inactiveIcon: 'home-outline' },
  { name: 'history',  label: 'Riwayat',    activeIcon: 'time',      inactiveIcon: 'time-outline' },
  { name: 'reports',  label: 'Laporan',    activeIcon: 'pie-chart', inactiveIcon: 'pie-chart-outline' },
  { name: 'settings', label: 'Pengaturan', activeIcon: 'settings',  inactiveIcon: 'settings-outline' },
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
const INDICATOR_HORIZONTAL_PADDING = 6;

interface TabButtonProps {
  config: typeof TAB_CONFIG[number];
  route: any;
  isFocused: boolean;
  navigation: any;
  onLayout: (event: LayoutChangeEvent) => void;
}

function TabButton({ config, route, isFocused, navigation, onLayout }: TabButtonProps) {
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
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      style={styles.tabButton}
    >
      <Animated.View style={[{ alignItems: 'center', width: '100%' }, iconAnimStyle]}>
        <Ionicons
          name={isFocused ? config.activeIcon : config.inactiveIcon}
          size={20}
          color={isFocused ? '#FFFFFF' : '#8ACCD5'}
          style={{ marginBottom: 3 }}
        />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={[
            styles.tabLabel,
            {
              color: isFocused ? '#FFFFFF' : '#8ACCD5',
              fontFamily: isFocused ? 'Poppins_600SemiBold' : 'Poppins_400Regular',
              fontSize: width < 375 ? 8.5 : 10,
              paddingHorizontal: width < 375 ? 2 : 4,
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

  const activeConfigIndex = getConfigIndex(state.routes[state.index]?.name ?? '');

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
    []
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
          paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
          left: width < 375 ? 10 : 16,
          right: width < 375 ? 10 : 16,
        },
      ]}
    >
      {/* Sliding pill indicator — sits behind the tab buttons */}
      <Animated.View
        style={[
          styles.slidingIndicator,
          {
            top: INDICATOR_VERTICAL_PADDING,
            height: 72 - INDICATOR_VERTICAL_PADDING * 2,
          },
          indicatorStyle,
        ]}
      />

      {/* Tab buttons row */}
      <View style={styles.content}>
        {renderTabButton(0)}
        {renderTabButton(1)}
        {/* Spacer for the floating mic */}
        <View style={[styles.spacer, { width: width < 375 ? 48 : 64 }]} />
        {renderTabButton(2)}
        {renderTabButton(3)}
      </View>

      {/* Floating Center Mic Button */}
      <Pressable
        onPress={() => setVoiceSheetVisible(true)}
        style={({ pressed }) => [
          styles.plusButton,
          { transform: [{ scale: pressed ? 0.93 : 1 }] },
        ]}
      >
        <Ionicons name="mic" size={26} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 20,
    zIndex: 20,
  },
  slidingIndicator: {
    position: 'absolute',
    left: 0,
    borderRadius: 22,
    backgroundColor: '#FF90BB', // Light pink pill behind active tab
    zIndex: 0,
  },
  content: {
    flexDirection: 'row',
    height: 72,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    zIndex: 1,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 10,
  },
  spacer: {
    width: 64,
  },
  plusButton: {
    position: 'absolute',
    top: -22,
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF90BB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#FF90BB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
});
