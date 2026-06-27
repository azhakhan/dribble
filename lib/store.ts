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

/** All persisted layout sizes. Sidebar is global; the rest are keyed by resource. */
export interface Layout {
  /** Global sidebar width in px. */
  sidebarWidth: number;
  /** Per table tab id → { columnId → width }. */
  columnWidths: Record<string, Record<string, number>>;
  /** Per chat id → fraction of the split given to the message log (0–1). */
  chatSplit: Record<string, number>;
  /** Per notebook id → { cellId → result panel height in px }. */
  cellHeights: Record<string, Record<string, number>>;
}

export const DEFAULT_LAYOUT: Layout = {
  sidebarWidth: 280,
  columnWidths: {},
  chatSplit: {},
  cellHeights: {},
};

/** Expanded/collapsed state of the sidebar tree. */
export interface TreeState {
  /** Expanded connection ids. */
  connections: string[];
  /** Expanded schema keys, formatted `${connectionId}:${schema}`. */
  schemas: string[];
}

export const DEFAULT_TREE: TreeState = { connections: [], schemas: [] };

interface IdeState {
  tabs: Tab[];
  activeTabId: string | null;
  layout: Layout;
  tree: TreeState;
  /** True once workspace state has been loaded from the server. */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  openTab: (tab: Tab) => void;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  moveTab: (fromIndex: number, toIndex: number) => void;
  renameTab: (id: string, title: string) => void;
  setSidebarWidth: (width: number) => void;
  setColumnWidths: (tableId: string, widths: Record<string, number>) => void;
  setChatSplit: (chatId: string, messageShare: number) => void;
  setCellHeight: (notebookId: string, cellId: string, height: number) => void;
  setConnectionExpanded: (connectionId: string, open: boolean) => void;
  setSchemaExpanded: (schemaKey: string, open: boolean) => void;
  /** Drop all workspace state tied to a deleted connection. */
  pruneConnection: (connectionId: string) => void;
}

// Debounced write-back of the full workspace snapshot. Only runs after the
// initial hydrate so we never overwrite saved state with the empty default.
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist(get: () => IdeState) {
  if (!get().hydrated) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const { tabs, activeTabId, layout, tree } = get();
    fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabs, activeTabId, layout, tree }),
    }).catch(() => {});
  }, 500);
}

export const useIde = create<IdeState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  layout: DEFAULT_LAYOUT,
  tree: DEFAULT_TREE,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const res = await fetch("/api/workspace");
      if (res.ok) {
        const ws = await res.json();
        set({
          tabs: Array.isArray(ws.tabs) ? ws.tabs : [],
          activeTabId: ws.active_tab_id ?? null,
          layout: { ...DEFAULT_LAYOUT, ...(ws.layout ?? {}) },
          tree: { ...DEFAULT_TREE, ...(ws.tree ?? {}) },
          hydrated: true,
        });
        return;
      }
    } catch {
      // fall through — start with an empty workspace
    }
    set({ hydrated: true });
  },

  openTab: (tab) => {
    const { tabs } = get();
    if (tabs.some((t) => t.id === tab.id)) {
      set({ activeTabId: tab.id });
    } else {
      set({ tabs: [...tabs, tab], activeTabId: tab.id });
    }
    persist(get);
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
    persist(get);
  },

  setActive: (id) => {
    set({ activeTabId: id });
    persist(get);
  },

  moveTab: (fromIndex, toIndex) => {
    const tabs = [...get().tabs];
    const [moved] = tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, moved);
    set({ tabs });
    persist(get);
  },

  renameTab: (id, title) => {
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, title } : t)) });
    persist(get);
  },

  setSidebarWidth: (width) => {
    set((s) => ({ layout: { ...s.layout, sidebarWidth: width } }));
    persist(get);
  },

  setColumnWidths: (tableId, widths) => {
    set((s) => ({
      layout: { ...s.layout, columnWidths: { ...s.layout.columnWidths, [tableId]: widths } },
    }));
    persist(get);
  },

  setChatSplit: (chatId, messageShare) => {
    set((s) => ({
      layout: { ...s.layout, chatSplit: { ...s.layout.chatSplit, [chatId]: messageShare } },
    }));
    persist(get);
  },

  setCellHeight: (notebookId, cellId, height) => {
    set((s) => ({
      layout: {
        ...s.layout,
        cellHeights: {
          ...s.layout.cellHeights,
          [notebookId]: { ...(s.layout.cellHeights[notebookId] ?? {}), [cellId]: height },
        },
      },
    }));
    persist(get);
  },

  setConnectionExpanded: (connectionId, open) => {
    set((s) => {
      const without = s.tree.connections.filter((id) => id !== connectionId);
      return { tree: { ...s.tree, connections: open ? [...without, connectionId] : without } };
    });
    persist(get);
  },

  setSchemaExpanded: (schemaKey, open) => {
    set((s) => {
      const without = s.tree.schemas.filter((k) => k !== schemaKey);
      return { tree: { ...s.tree, schemas: open ? [...without, schemaKey] : without } };
    });
    persist(get);
  },

  pruneConnection: (connectionId) => {
    set((s) => {
      const closing = s.tabs.filter((t) => t.connectionId === connectionId);
      const closingTabIds = new Set(closing.map((t) => t.id));
      const closingResourceIds = new Set(
        closing.map((t) => t.resourceId).filter((x): x is string => !!x),
      );
      const tabs = s.tabs.filter((t) => t.connectionId !== connectionId);
      const columnWidths = { ...s.layout.columnWidths };
      for (const id of closingTabIds) delete columnWidths[id];
      const chatSplit = { ...s.layout.chatSplit };
      const cellHeights = { ...s.layout.cellHeights };
      for (const rid of closingResourceIds) {
        delete chatSplit[rid];
        delete cellHeights[rid];
      }
      return {
        tabs,
        activeTabId: tabs.some((t) => t.id === s.activeTabId)
          ? s.activeTabId
          : tabs[tabs.length - 1]?.id ?? null,
        layout: { ...s.layout, columnWidths, chatSplit, cellHeights },
        tree: {
          connections: s.tree.connections.filter((id) => id !== connectionId),
          schemas: s.tree.schemas.filter((k) => !k.startsWith(`${connectionId}:`)),
        },
      };
    });
    persist(get);
  },
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
