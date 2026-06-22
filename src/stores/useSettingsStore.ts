import { create } from 'zustand';
import * as SecureStore from '../utils/secureStore';
import * as Notifications from 'expo-notifications';

const SETTINGS_KEY = 'fintrack_notification_settings';

interface SettingsState {
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  loadSettings: () => Promise<void>;
  updateReminder: (enabled: boolean, hour: number, minute: number) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  reminderEnabled: false,
  reminderHour: 20, // Default 8 PM
  reminderMinute: 0,

  loadSettings: async () => {
    try {
      const stored = await SecureStore.getItemAsync(SETTINGS_KEY);
      if (stored) {
        const { enabled, hour, minute } = JSON.parse(stored);
        set({ reminderEnabled: enabled, reminderHour: hour, reminderMinute: minute });
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  },

  updateReminder: async (enabled: boolean, hour: number, minute: number) => {
    try {
      set({ reminderEnabled: enabled, reminderHour: hour, reminderMinute: minute });
      await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify({ enabled, hour, minute }));

      // Handle Expo Notification scheduling
      if (enabled) {
        // Request Permissions
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          // Cancel any existing reminders to avoid duplicates
          await Notifications.cancelAllScheduledNotificationsAsync();
          
          // Schedule new daily reminder
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Pengingat Harian FinTrack 💰',
              body: 'Apakah Anda sudah mencatat transaksi hari ini? Mari jaga keuangan Anda tetap rapi!',
              sound: true,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour,
              minute,
            },
          });
          console.log(`Notification scheduled daily at ${hour}:${minute}`);
        } else {
          console.warn('Notification permission not granted.');
          // Reset toggle
          set({ reminderEnabled: false });
        }
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
        console.log('All scheduled notifications cancelled.');
      }
    } catch (error) {
      console.error('Failed to update notification settings:', error);
    }
  },
}));
