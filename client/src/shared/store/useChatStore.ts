import { create } from "zustand";
import type { ChatMessage, ProposedChanges } from "./types";
// Dynamic imports will be used for the tab stores to avoid circular dependencies
import { useQueryStore } from "./useQueryStore";

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
  setProposedChanges: (changes: ProposedChanges | null) => Promise<void>;
  acceptProposedChanges: () => void;
  rejectProposedChanges: () => Promise<void>;
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
  setProposedChanges: async (changes) => {
    if (changes) {
      // When LLM returns proposed changes, automatically save them as the latest version
      const { useTabManagerStore } = await import("./useTabManagerStore");
      const { useTabContentStore } = await import("./useTabContentStore");
      const tabStore = useTabManagerStore.getState();
      const contentStore = useTabContentStore.getState();
      const queryStore = useQueryStore.getState();

      if (tabStore.activeTabId) {
        const activeTab = tabStore.openTabs.find((tab) => tab.id === tabStore.activeTabId);

        if (activeTab?.queryId) {
          try {
            // Save the proposed content as a new version with "ai" trigger
            await queryStore.saveQueryVersion(activeTab.queryId, changes.proposedContent, "ai");

            // Update the tab's editor content and mark as clean (since it's now saved)
            tabStore.updateTabContent(tabStore.activeTabId, {
              editorContent: changes.proposedContent,
              lastSavedContent: changes.proposedContent,
              isDirty: false
            });

            // Also update global editorContent for backward compatibility
            contentStore.setEditorContent(changes.proposedContent);
          } catch (error) {
            console.error("Failed to auto-save LLM proposed changes:", error);
            // If saving fails, we'll still show the proposed changes UI for manual handling
          }
        }
      }
    }

    set({ proposedChanges: changes });
  },

  acceptProposedChanges: () => {
    const state = get();
    if (state.proposedChanges) {
      // Since changes are already saved automatically, just clear the proposed changes UI
      // The editor content has already been updated in setProposedChanges
      set({ proposedChanges: null });
    }
  },

  rejectProposedChanges: async () => {
    const state = get();
    if (state.proposedChanges) {
      // When rejecting, create a new version with the original content
      const { useTabManagerStore } = await import("./useTabManagerStore");
      const { useTabContentStore } = await import("./useTabContentStore");
      const tabStore = useTabManagerStore.getState();
      const contentStore = useTabContentStore.getState();
      const queryStore = useQueryStore.getState();

      if (tabStore.activeTabId) {
        const activeTab = tabStore.openTabs.find((tab) => tab.id === tabStore.activeTabId);

        if (activeTab?.queryId) {
          try {
            // Save the original content as a new version with "ai" trigger (reverting)
            await queryStore.saveQueryVersion(
              activeTab.queryId,
              state.proposedChanges.originalContent,
              "ai"
            );

            // Update the tab's editor content back to original and mark as clean
            tabStore.updateTabContent(tabStore.activeTabId, {
              editorContent: state.proposedChanges.originalContent,
              lastSavedContent: state.proposedChanges.originalContent,
              isDirty: false
            });

            // Also update global editorContent for backward compatibility
            contentStore.setEditorContent(state.proposedChanges.originalContent);
          } catch (error) {
            console.error("Failed to save rejection/revert version:", error);
            // If saving fails, still update the UI to show original content
            tabStore.updateTabContent(tabStore.activeTabId, {
              editorContent: state.proposedChanges.originalContent,
              isDirty: true // Mark as dirty since the save failed
            });
            contentStore.setEditorContent(state.proposedChanges.originalContent);
          }
        } else {
          // No queryId, just update the editor content back to original
          tabStore.updateTabContent(tabStore.activeTabId, {
            editorContent: state.proposedChanges.originalContent,
            isDirty: true
          });
          contentStore.setEditorContent(state.proposedChanges.originalContent);
        }
      }

      set({ proposedChanges: null });
    }
  }
}));
