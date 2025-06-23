import { create } from "zustand";

interface UnsavedChangesState {
  // Unsaved changes dialog state
  unsavedChangesDialog: {
    isOpen: boolean;
    tabId: string | null;
    tabTitle: string;
    action: "close" | "closeOthers" | "closeToRight" | null;
    resolve: ((result: boolean) => void) | null;
  };

  // Dialog management
  showUnsavedChangesDialog: (
    tabId: string,
    action: "close" | "closeOthers" | "closeToRight"
  ) => Promise<boolean>;
  hideUnsavedChangesDialog: () => void;
  handleDialogSave: () => Promise<void>;
  handleDialogDiscard: () => void;

  // Helper functions for unsaved changes
  hasUnsavedChanges: (tabId: string) => boolean;
  discardChanges: (tabId: string) => void;
  saveChanges: (tabId: string) => Promise<void>;
}

export const useUnsavedChangesStore = create<UnsavedChangesState>()((set, get) => ({
  // Initial state
  unsavedChangesDialog: {
    isOpen: false,
    tabId: null,
    tabTitle: "",
    action: null,
    resolve: null
  },

  // Helper functions for unsaved changes
  hasUnsavedChanges: () => {
    // Import tab manager to access tabs - this will be resolved with better store architecture
    try {
      // This is a temporary solution until we have proper store composition
      return false; // Placeholder for now
    } catch {
      return false;
    }
  },

  discardChanges: (tabId) => {
    // Import tab manager to access tabs
    import("./useTabManagerStore").then(({ useTabManagerStore }) => {
      const tabManager = useTabManagerStore.getState();

      const updatedTabs = tabManager.openTabs.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              editorContent: tab.lastSavedContent,
              isDirty: false
            }
          : tab
      );

      // Update tabs in tab manager
      useTabManagerStore.setState({ openTabs: updatedTabs });

      // Update global editorContent if this is the active tab
      if (tabManager.activeTabId === tabId) {
        const tab = tabManager.openTabs.find((t) => t.id === tabId);
        import("./useTabContentStore").then(({ useTabContentStore }) => {
          useTabContentStore.getState().setEditorContent(tab?.lastSavedContent || "");
        });
      }
    });
  },

  saveChanges: async (tabId) => {
    // Import required stores
    const { useTabManagerStore } = await import("./useTabManagerStore");
    const { useQueryStore } = await import("./useQueryStore");

    const tabManager = useTabManagerStore.getState();
    const tab = tabManager.openTabs.find((t) => t.id === tabId);

    if (!tab || !tab.isDirty) {
      return;
    }

    const queryStore = useQueryStore.getState();

    try {
      if (tab.queryId) {
        // Save new version for existing query
        await queryStore.saveQueryVersion(tab.queryId, tab.editorContent, "run");

        // Update tab to mark as clean
        const updatedTabs = tabManager.openTabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                lastSavedContent: t.editorContent, // Use current tab content
                isDirty: false
              }
            : t
        );
        useTabManagerStore.setState({ openTabs: updatedTabs });
      } else {
        // Create new query for tab without queryId
        const newQuery = await queryStore.createNewQuery({ sourceId: tab.sourceId });
        await queryStore.saveQueryVersion(newQuery.id, tab.editorContent, "run");

        // Update tab with new queryId and mark as clean
        const updatedTabs = tabManager.openTabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                queryId: newQuery.id,
                lastSavedContent: t.editorContent, // Use current tab content
                isDirty: false
              }
            : t
        );
        useTabManagerStore.setState({ openTabs: updatedTabs });
      }
    } catch (error) {
      console.error("Failed to save changes:", error);
      throw error;
    }
  },

  // Dialog management functions
  showUnsavedChangesDialog: (tabId, action) => {
    return new Promise((resolve) => {
      // Import tab manager to access tabs
      import("./useTabManagerStore").then(({ useTabManagerStore }) => {
        const tabManager = useTabManagerStore.getState();
        const tab = tabManager.openTabs.find((t) => t.id === tabId);

        if (!tab) {
          resolve(true); // Tab not found, consider it closed
          return;
        }

        // If tab has no unsaved changes, resolve immediately
        if (!tab.isDirty) {
          resolve(true);
          return;
        }

        // Show dialog and store resolver
        set({
          unsavedChangesDialog: {
            isOpen: true,
            tabId,
            tabTitle: tab.title,
            action,
            resolve
          }
        });
      });
    });
  },

  hideUnsavedChangesDialog: () => {
    const state = get();
    if (state.unsavedChangesDialog.resolve) {
      state.unsavedChangesDialog.resolve(false); // User cancelled
    }
    set({
      unsavedChangesDialog: {
        isOpen: false,
        tabId: null,
        tabTitle: "",
        action: null,
        resolve: null
      }
    });
  },

  handleDialogSave: async () => {
    const state = get();
    const { tabId, resolve } = state.unsavedChangesDialog;

    if (!tabId || !resolve) return;

    try {
      await state.saveChanges(tabId);

      // Hide dialog first
      set({
        unsavedChangesDialog: {
          isOpen: false,
          tabId: null,
          tabTitle: "",
          action: null,
          resolve: null
        }
      });

      // Then resolve - this ensures the dialog is hidden before the tab close logic runs
      resolve(true);
    } catch (error) {
      console.error("Failed to save changes:", error);
      // Don't hide dialog on error, let user try again
      resolve(false);
    }
  },

  handleDialogDiscard: () => {
    const state = get();
    const { tabId, resolve } = state.unsavedChangesDialog;

    if (!tabId || !resolve) return;

    // Discard changes and resolve
    state.discardChanges(tabId);
    resolve(true);

    // Hide dialog
    set({
      unsavedChangesDialog: {
        isOpen: false,
        tabId: null,
        tabTitle: "",
        action: null,
        resolve: null
      }
    });
  }
}));
