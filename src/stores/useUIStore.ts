import { create } from 'zustand';

interface UIState {
  isVoiceSheetVisible: boolean;
  setVoiceSheetVisible: (visible: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isVoiceSheetVisible: false,
  setVoiceSheetVisible: (visible) => set({ isVoiceSheetVisible: visible }),
}));
