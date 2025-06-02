import { create } from "zustand";
import type { LLM } from "@/shared/lib/api";

interface LLMState {
  selectedLLM: LLM | null;
  isFormOpen: boolean;
  isEditing: boolean;

  // Actions
  setSelectedLLM: (llm: LLM | null) => void;
  setFormOpen: (open: boolean) => void;
  setEditing: (editing: boolean) => void;
  openCreateForm: () => void;
  openEditForm: (llm: LLM) => void;
  closeForm: () => void;
}

export const useLLMStore = create<LLMState>((set) => ({
  selectedLLM: null,
  isFormOpen: false,
  isEditing: false,

  setSelectedLLM: (llm) => set({ selectedLLM: llm }),
  setFormOpen: (open) => set({ isFormOpen: open }),
  setEditing: (editing) => set({ isEditing: editing }),

  openCreateForm: () =>
    set({
      isFormOpen: true,
      isEditing: false,
      selectedLLM: null
    }),

  openEditForm: (llm) =>
    set({
      isFormOpen: true,
      isEditing: true,
      selectedLLM: llm
    }),

  closeForm: () =>
    set({
      isFormOpen: false,
      isEditing: false,
      selectedLLM: null
    })
}));
