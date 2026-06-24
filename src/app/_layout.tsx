import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { 
  useFonts, 
  Poppins_400Regular, 
  Poppins_500Medium, 
  Poppins_600SemiBold, 
  Poppins_700Bold 
} from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { useAuthStore } from '../stores/useAuthStore';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useUIStore } from '../stores/useUIStore';
import VoiceInputSheet from '../components/VoiceInputSheet';
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (e: any) {
  console.warn('expo-notifications could not be loaded:', e.message);
}

// Configure Notifications to show alerts in foreground
if (Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    console.warn('expo-notifications not available on this platform/build:', e);
  }
}

// Keep splash screen visible while loading resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const { token, isLoading, initialize, isAuthenticated } = useAuthStore();
  const { isVoiceSheetVisible, setVoiceSheetVisible } = useUIStore();
  const segments = useSegments();
  const router = useRouter();

  // Initialize Auth Store
  useEffect(() => {
    initialize();
  }, []);

  // Handle routing based on Auth State
  useEffect(() => {
    if (isLoading || !fontsLoaded) return;

    // Check if user is in the auth group
    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated and not already in auth pages
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to dashboard if authenticated and trying to access auth pages
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, fontsLoaded, segments]);

  // Hide Splash Screen once fonts are loaded and auth is initialized
  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  if (!fontsLoaded || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#FF90BB" />
      </View>
    );
  }

  // Theme configuration for React Native Paper matching our design system
  const theme = {
    ...MD3LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      primary: '#FF90BB', // Bubblegum Pink
      secondary: '#8ACCD5', // Sky Teal
      background: '#FFFFFF', // White
      surface: '#FFFFFF',
      onSurface: '#1E293B', // Dark Slate for accessibility
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <Stack screenOptions={{ 
          headerShown: false,
          animation: 'slide_from_right',
        }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
        <VoiceInputSheet visible={isVoiceSheetVisible} onDismiss={() => setVoiceSheetVisible(false)} />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
