// ponytail: Zustand store for AI Assistant chat messages state
import { create } from "zustand";

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface AiChatState {
  messages: AiChatMessage[];
  isStreaming: boolean;
  error: string | null;
  addMessage: (role: "user" | "assistant", content: string) => string;
  updateLastAssistantMessage: (chunk: string) => void;
  setStreaming: (isStreaming: boolean) => void;
  setError: (error: string | null) => void;
  clearHistory: () => void;
}

export const useAiChatStore = create<AiChatState>((set) => ({
  messages: [],
  isStreaming: false,
  error: null,

  addMessage: (role, content) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    const newMsg: AiChatMessage = {
      id,
      role,
      content,
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages, newMsg],
      error: null,
    }));
    return id;
  },

  updateLastAssistantMessage: (chunk) => {
    set((state) => {
      const messages = [...state.messages];
      const lastIndex = messages.length - 1;
      if (lastIndex >= 0 && messages[lastIndex].role === "assistant") {
        messages[lastIndex] = {
          ...messages[lastIndex],
          content: messages[lastIndex].content + chunk,
        };
      }
      return { messages };
    });
  },

  setStreaming: (isStreaming) => set({ isStreaming }),
  setError: (error) => set({ error }),
  clearHistory: () => set({ messages: [], error: null, isStreaming: false }),
}));
