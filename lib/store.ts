"use client";

import { create } from "zustand";

export type TabKind = "table" | "notebook" | "chat";

export interface Tab {
  /** Stable identity, e.g. table:<conn>:<schema>.<table> or notebook:<id> */
  id: string;
  kind: TabKind;
  title: string;
  connectionId: string | null;
  schema?: string;
  table?: string;
  /** notebook or chat id */
  resourceId?: string;
}

interface IdeState {
  tabs: Tab[];
  activeTabId: string | null;
  openTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  moveTab: (fromIndex: number, toIndex: number) => void;
  renameTab: (id: string, title: string) => void;
}

export const useIde = create<IdeState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (tab) => {
    const { tabs } = get();
    if (tabs.some((t) => t.id === tab.id)) {
      set({ activeTabId: tab.id });
    } else {
      set({ tabs: [...tabs, tab], activeTabId: tab.id });
    }
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const next = tabs.filter((t) => t.id !== id);
    let active = activeTabId;
    if (activeTabId === id) {
      active = next[Math.min(idx, next.length - 1)]?.id ?? null;
    }
    set({ tabs: next, activeTabId: active });
  },

  setActive: (id) => set({ activeTabId: id }),

  moveTab: (fromIndex, toIndex) => {
    const tabs = [...get().tabs];
    const [moved] = tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, moved);
    set({ tabs });
  },

  renameTab: (id, title) =>
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, title } : t)) }),
}));

export interface ConnectionMeta {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  ssl: boolean;
}

export interface NotebookMeta {
  id: string;
  connection_id: string | null;
  name: string;
}

export interface ChatMeta {
  id: string;
  connection_id: string | null;
  name: string;
}
