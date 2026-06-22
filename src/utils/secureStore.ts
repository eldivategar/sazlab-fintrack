import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

/**
 * Gets item from localStorage on web, or expo-secure-store on native platforms.
 */
export async function getItemAsync(key: string): Promise<string | null> {
  if (isWeb) {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(key);
    }
    return null;
  }
  return SecureStore.getItemAsync(key);
}

/**
 * Sets item to localStorage on web, or expo-secure-store on native platforms.
 */
export async function setItemAsync(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
    return;
  }
  return SecureStore.setItemAsync(key, value);
}

/**
 * Deletes item from localStorage on web, or expo-secure-store on native platforms.
 */
export async function deleteItemAsync(key: string): Promise<void> {
  if (isWeb) {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
    return;
  }
  return SecureStore.deleteItemAsync(key);
}
