import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastPayload {
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface UIState {
  isVoiceSheetVisible: boolean;
  setVoiceSheetVisible: (visible: boolean) => void;
  isAiAssistantVisible: boolean;
  setAiAssistantVisible: (visible: boolean) => void;
  toast: ToastPayload | null;
  showToast: (payload: ToastPayload) => void;
  hideToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isVoiceSheetVisible: false,
  setVoiceSheetVisible: (visible) => set({ isVoiceSheetVisible: visible }),
  isAiAssistantVisible: false,
  setAiAssistantVisible: (visible) => set({ isAiAssistantVisible: visible }),
  toast: null,
  showToast: (payload) => set({ toast: { duration: 3500, ...payload } }),
  hideToast: () => set({ toast: null }),
}));

export function showToast(payload: ToastPayload) {
  useUIStore.getState().showToast(payload);
}
