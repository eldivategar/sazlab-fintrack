import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack screenOptions={{ 
      headerShown: false,
      animation: 'slide_from_right',
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="add-transaction" 
        options={{ 
          headerShown: false,
          presentation: 'modal',
        }} 
      />
    </Stack>
  );
}
