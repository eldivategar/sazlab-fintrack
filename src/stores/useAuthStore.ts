import { create } from 'zustand';
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as SecureStore from '../utils/secureStore';

const SECURE_STORE_KEY = 'fintrack_access_token';
const USER_INFO_KEY = 'fintrack_user_info';

export interface User {
  name: string;
  email: string;
  picture: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (token: string, user: User) => {
    try {
      await SecureStore.setItemAsync(SECURE_STORE_KEY, token);
      await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
      set({ token, user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      console.error('Failed to save auth state to secure store:', error);
    }
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
      await SecureStore.deleteItemAsync(USER_INFO_KEY);
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    } catch (error) {
      console.error('Failed to clear auth state from secure store:', error);
    }
  },

  initialize: async () => {
    try {
      const storedToken = await SecureStore.getItemAsync(SECURE_STORE_KEY);
      const storedUserStr = await SecureStore.getItemAsync(USER_INFO_KEY);
      
      if (storedToken) {
        try {
          const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          
          if (response.ok) {
            const userData = await response.json();
            const parsedStoredUser = storedUserStr ? JSON.parse(storedUserStr) : null;
            const user: User = {
              name: userData.name || parsedStoredUser?.name || '',
              email: userData.email || parsedStoredUser?.email || '',
              picture: userData.picture || parsedStoredUser?.picture || '',
            };
            await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
            set({ token: storedToken, user, isAuthenticated: true, isLoading: false });
            return;
          } else {
            console.warn('Token validation failed (status not ok), attempting silent refresh...');
            const newToken = await get().refreshToken();
            if (newToken) {
              const retryRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${newToken}` },
              });
              if (retryRes.ok) {
                const userData = await retryRes.json();
                const parsedStoredUser = storedUserStr ? JSON.parse(storedUserStr) : null;
                const user: User = {
                  name: userData.name || parsedStoredUser?.name || '',
                  email: userData.email || parsedStoredUser?.email || '',
                  picture: userData.picture || parsedStoredUser?.picture || '',
                };
                await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
                set({ token: newToken, user, isAuthenticated: true, isLoading: false });
                return;
              }
            }
            console.warn('Refresh failed during init, logging out.');
          }
        } catch (fetchError) {
          console.warn('Failed to validate token with Google API, using cached data if available:', fetchError);
          if (storedUserStr) {
            const user = JSON.parse(storedUserStr);
            set({ token: storedToken, user, isAuthenticated: true, isLoading: false });
            return;
          }
        }
      }
      
      // Clear storage just in case if invalid token
      await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
      await SecureStore.deleteItemAsync(USER_INFO_KEY);
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    } catch (error) {
      console.error('Error initializing auth store:', error);
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  },

  refreshToken: async () => {
    try {
      if (Platform.OS === 'web') return null;
      
      // Attempt silent sign in to refresh token natively
      await GoogleSignin.signInSilently();
      const tokens = await GoogleSignin.getTokens();
      
      if (tokens && tokens.accessToken) {
        const newToken = tokens.accessToken;
        await SecureStore.setItemAsync(SECURE_STORE_KEY, newToken);
        set({ token: newToken });
        return newToken;
      }
    } catch (error) {
      console.warn('Failed to refresh token silently:', error);
    }
    
    return null;
  },
}));
