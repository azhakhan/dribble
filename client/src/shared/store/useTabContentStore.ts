import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TabContentState {
  // Global editor state (legacy, for backward compatibility)
  editorContent: string;

  // Content management actions
  setEditorContent: (content: string) => void;
}

export const useTabContentStore = create<TabContentState>()(
  persist(
    (set) => ({
      // Initial state
      editorContent: "",

      // Set editor content
      setEditorContent: (content) => set({ editorContent: content })
    }),
    {
      name: "dribble-tabs-content-storage",
      // Only persist certain values
      partialize: (state) => ({
        editorContent: state.editorContent
      })
    }
  )
);
