import { create } from "zustand";
import type { ChatMessage, ProposedChanges } from "./types";
import { useTabStore } from "./useTabStore";

interface ChatState {
  // LLM state
  selectedLLM: string | null;

  // Chat state
  messages: ChatMessage[];
  chatLoading: boolean;
  sessionId: string | null;

  // Proposed changes for diff view
  proposedChanges: ProposedChanges | null;

  // Chat actions
  setSelectedLLM: (llmId: string | null) => void;
  addMessage: (message: ChatMessage) => void;
  setChatLoading: (loading: boolean) => void;
  clearMessages: () => void;
  generateNewSession: () => void;
  setSessionId: (sessionId: string | null) => void;
  startNewSession: () => void;
  loadMessagesFromServer: (messages: ChatMessage[]) => void;

  // Proposed changes actions
  setProposedChanges: (changes: ProposedChanges | null) => void;
  acceptProposedChanges: () => void;
  rejectProposedChanges: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  selectedLLM: null,
  messages: [],
  chatLoading: false,
  sessionId: null,
  proposedChanges: null,

  // Chat actions
  setSelectedLLM: (llmId) => set({ selectedLLM: llmId }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message]
    })),

  setChatLoading: (loading) => set({ chatLoading: loading }),

  clearMessages: () => set({ messages: [] }),

  generateNewSession: () => set({ sessionId: crypto.randomUUID() }),

  setSessionId: (sessionId) => set({ sessionId }),

  startNewSession: () => set({ messages: [], sessionId: crypto.randomUUID() }),

  loadMessagesFromServer: (messages) => set({ messages }),

  // Proposed changes actions
  setProposedChanges: (changes) => set({ proposedChanges: changes }),

  acceptProposedChanges: () => {
    const state = get();
    if (state.proposedChanges) {
      // Get the active tab from tab store and update its content
      const tabStore = useTabStore.getState();

      if (tabStore.activeTabId) {
        // Update the active tab's content
        tabStore.updateTabContent(tabStore.activeTabId, {
          editorContent: state.proposedChanges.proposedContent,
          isDirty: true
        });

        // Also update global editorContent for backward compatibility
        tabStore.setEditorContent(state.proposedChanges.proposedContent);
      }

      set({ proposedChanges: null });
    }
  },

  rejectProposedChanges: () => set({ proposedChanges: null })
}));
