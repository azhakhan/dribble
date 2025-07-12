import { create } from "zustand";
import type { Source, SourceStatus, ConnectedSource } from "@/shared/lib/api";
import type { SourceSchemaMap, SchemaObject } from "./types";
import type { FileNode } from "@/shared/lib/fileTreeUtils";
import { getSources, getConnectedSources, getSourceSchemas } from "@/shared/lib/api";

interface SourceState {
  // Source data
  sources: Record<string, Source>;
  allSources: Source[];
  connectedSources: Set<string>;
  connectedSourcesData: ConnectedSource[];
  selectedSource: Source | null;

  // Schema data
  sourceSchemaMap: SourceSchemaMap;
  sourceGeneratedChildren: Record<string, FileNode[]>;

  // Loading states
  loadingSources: boolean;
  loadingConnectedSources: boolean;
  loadingSchemas: Set<string>;

  // Error tracking
  sourceSchemaErrors: Record<string, string>;
  sourceStatuses: Record<string, SourceStatus>;

  // Background status polling
  statusPollingEnabled: boolean;
  statusPollingInterval: NodeJS.Timeout | null;
  loadingStatuses: Set<string>;

  // Actions
  loadSources: () => Promise<void>;
  loadConnectedSources: () => Promise<void>;
  loadSourceSchema: (sourceId: string) => Promise<void>;
  loadConnectedSourcesSchemas: (connectedSources: ConnectedSource[]) => Promise<void>;

  setSources: (sources: Source[]) => void;
  setSelectedSource: (source: Source | null) => void;
  setConnectedSourcesData: (connectedSources: ConnectedSource[]) => void;
  setSourceSchema: (sourceId: string, schema: Record<string, SchemaObject>) => void;
  setSourceGeneratedChildren: (sourceId: string, children: FileNode[]) => void;

  setSourceSchemaError: (sourceId: string, error: string | null) => void;
  setSourceStatus: (sourceId: string, status: SourceStatus) => void;
  removeSourceStatus: (sourceId: string) => void;
  removeSource: (sourceId: string) => void;

  // Background status polling actions
  startStatusPolling: () => void;
  stopStatusPolling: () => void;
  loadAllSourceStatuses: () => Promise<void>;
  getSourceStatus: (sourceId: string) => SourceStatus | undefined;

  cleanupDisconnectedSources: (connectedSourceIds: string[]) => void;
}

export const useSourceStore = create<SourceState>((set, get) => ({
  // Initial state
  sources: {},
  allSources: [],
  connectedSources: new Set(),
  connectedSourcesData: [],
  selectedSource: null,
  sourceSchemaMap: {},
  sourceGeneratedChildren: {},
  loadingSources: false,
  loadingConnectedSources: false,
  loadingSchemas: new Set(),
  sourceSchemaErrors: {},
  sourceStatuses: {},

  // Background status polling state
  statusPollingEnabled: false,
  statusPollingInterval: null,
  loadingStatuses: new Set(),

  // Load sources from API
  loadSources: async () => {
    const currentState = get();
    if (currentState.loadingSources) return;

    set({ loadingSources: true });
    try {
      const sources = await getSources();
      set(() => ({
        allSources: sources,
        sources: sources.reduce((acc, source) => ({ ...acc, [source.id]: source }), {}),
        loadingSources: false
      }));
    } catch (error) {
      console.error("Failed to load sources:", error);
      set({ loadingSources: false });
    }
  },

  // Load connected sources
  loadConnectedSources: async () => {
    const currentState = get();
    if (currentState.loadingConnectedSources) return;

    set({ loadingConnectedSources: true });
    try {
      const connectedSources = await getConnectedSources();
      set(() => ({
        connectedSourcesData: connectedSources,
        connectedSources: new Set(connectedSources.map((s) => s.id)),
        loadingConnectedSources: false
      }));
    } catch (error) {
      console.error("Failed to load connected sources:", error);
      set({ loadingConnectedSources: false });
    }
  },

  // Load schema for a source
  loadSourceSchema: async (sourceId: string) => {
    const currentState = get();

    if (currentState.sourceSchemaMap[sourceId]) {
      return;
    }

    if (currentState.loadingSchemas.has(sourceId)) {
      return;
    }

    set((state) => ({
      loadingSchemas: new Set(state.loadingSchemas).add(sourceId)
    }));

    try {
      const schemas = await getSourceSchemas(sourceId);

      set((state) => ({
        sourceSchemaMap: {
          ...state.sourceSchemaMap,
          [sourceId]: schemas
        },
        loadingSchemas: new Set([...state.loadingSchemas].filter((id) => id !== sourceId))
      }));

      // Clear any existing error for this source
      get().setSourceSchemaError(sourceId, null);

      // Generate and set children nodes from schema data
      const { schemaToFileTreeNodes } = await import("@/shared/lib/fileTreeUtils");
      const generatedChildren = schemaToFileTreeNodes(schemas, sourceId);

      get().setSourceGeneratedChildren(sourceId, generatedChildren);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      set((state) => ({
        loadingSchemas: new Set([...state.loadingSchemas].filter((id) => id !== sourceId))
      }));

      // Set error and clear children
      get().setSourceSchemaError(sourceId, errorMessage);
      get().setSourceGeneratedChildren(sourceId, []);
    }
  },

  // Load schemas for all connected sources
  loadConnectedSourcesSchemas: async (connectedSources: ConnectedSource[]) => {
    if (!connectedSources || connectedSources.length === 0) {
      return;
    }

    // Load schemas for all connected sources in parallel
    await Promise.allSettled(
      connectedSources.map(async (source) => {
        return await get().loadSourceSchema(source.id);
      })
    );
  },

  // Setters
  setSources: (sources) =>
    set({
      allSources: sources,
      sources: sources.reduce((acc, source) => ({ ...acc, [source.id]: source }), {})
    }),

  setSelectedSource: (source) => set({ selectedSource: source }),

  setConnectedSourcesData: (connectedSources) =>
    set({
      connectedSourcesData: connectedSources,
      connectedSources: new Set(connectedSources.map((s) => s.id))
    }),

  setSourceSchema: (sourceId, schema) =>
    set((state) => ({
      sourceSchemaMap: {
        ...state.sourceSchemaMap,
        [sourceId]: schema
      }
    })),

  setSourceGeneratedChildren: (sourceId, children) =>
    set((state) => ({
      sourceGeneratedChildren: {
        ...state.sourceGeneratedChildren,
        [sourceId]: children
      }
    })),

  setSourceSchemaError: (sourceId, error) =>
    set((state) => {
      const newErrors = { ...state.sourceSchemaErrors };
      if (error === null) {
        delete newErrors[sourceId];
      } else {
        newErrors[sourceId] = error;
      }
      return { sourceSchemaErrors: newErrors };
    }),

  setSourceStatus: (sourceId, status) =>
    set((state) => ({
      sourceStatuses: {
        ...state.sourceStatuses,
        [sourceId]: status
      }
    })),

  removeSourceStatus: (sourceId) =>
    set((state) => {
      const newStatuses = { ...state.sourceStatuses };
      delete newStatuses[sourceId];
      return { sourceStatuses: newStatuses };
    }),

  removeSource: (sourceId) =>
    set((state) => {
      const newSources = { ...state.sources };
      delete newSources[sourceId];

      const newAllSources = state.allSources.filter((source) => source.id !== sourceId);

      // Clean up related data
      const newSourceSchemaMap = { ...state.sourceSchemaMap };
      delete newSourceSchemaMap[sourceId];

      const newSourceGeneratedChildren = { ...state.sourceGeneratedChildren };
      delete newSourceGeneratedChildren[sourceId];

      const newSourceSchemaErrors = { ...state.sourceSchemaErrors };
      delete newSourceSchemaErrors[sourceId];

      const newSourceStatuses = { ...state.sourceStatuses };
      delete newSourceStatuses[sourceId];

      return {
        sources: newSources,
        allSources: newAllSources,
        sourceSchemaMap: newSourceSchemaMap,
        sourceGeneratedChildren: newSourceGeneratedChildren,
        sourceSchemaErrors: newSourceSchemaErrors,
        sourceStatuses: newSourceStatuses
      };
    }),

  // Cleanup disconnected sources
  cleanupDisconnectedSources: (connectedSourceIds) =>
    set((state) => {
      const connectedSet = new Set(connectedSourceIds);

      // Clean up schema map
      const newSourceSchemaMap = { ...state.sourceSchemaMap };
      Object.keys(newSourceSchemaMap).forEach((sourceId) => {
        if (!connectedSet.has(sourceId)) {
          delete newSourceSchemaMap[sourceId];
        }
      });

      // Clean up generated children
      const newSourceGeneratedChildren = { ...state.sourceGeneratedChildren };
      Object.keys(newSourceGeneratedChildren).forEach((sourceId) => {
        if (!connectedSet.has(sourceId)) {
          delete newSourceGeneratedChildren[sourceId];
        }
      });

      // Clean up schema errors
      const newSourceSchemaErrors = { ...state.sourceSchemaErrors };
      Object.keys(newSourceSchemaErrors).forEach((sourceId) => {
        if (!connectedSet.has(sourceId)) {
          delete newSourceSchemaErrors[sourceId];
        }
      });

      // Clean up source statuses
      const newSourceStatuses = { ...state.sourceStatuses };
      Object.keys(newSourceStatuses).forEach((sourceId) => {
        if (!connectedSet.has(sourceId)) {
          delete newSourceStatuses[sourceId];
        }
      });

      return {
        sourceSchemaMap: newSourceSchemaMap,
        sourceGeneratedChildren: newSourceGeneratedChildren,
        sourceSchemaErrors: newSourceSchemaErrors,
        sourceStatuses: newSourceStatuses
      };
    }),

  // Background status polling actions
  startStatusPolling: () => {
    const state = get();

    // Don't start if already running
    if (state.statusPollingEnabled || state.statusPollingInterval) {
      return;
    }

    set({ statusPollingEnabled: true });

    // Initial load
    get().loadAllSourceStatuses();

    // Set up polling interval (every 30 seconds)
    const interval = setInterval(() => {
      const currentState = get();
      if (currentState.statusPollingEnabled && currentState.connectedSources.size > 0) {
        currentState.loadAllSourceStatuses();
      }
    }, 30000);

    set({ statusPollingInterval: interval });
  },

  stopStatusPolling: () => {
    const state = get();

    if (state.statusPollingInterval) {
      clearInterval(state.statusPollingInterval);
    }

    set({
      statusPollingEnabled: false,
      statusPollingInterval: null
    });
  },

  loadAllSourceStatuses: async () => {
    const state = get();

    try {
      // Get connected sources from the API
      const connectedSources = await getConnectedSources();
      const connectedSourceIds = new Set(connectedSources.map((s) => s.id));

      // Update source statuses based on connection status
      const newSourceStatuses = { ...state.sourceStatuses };

      // Mark all connected sources as "running"
      connectedSourceIds.forEach((sourceId) => {
        newSourceStatuses[sourceId] = "running";
      });

      // Mark all non-connected sources as "unhealthy" (if they exist in our status map)
      Object.keys(state.sourceStatuses).forEach((sourceId) => {
        if (!connectedSourceIds.has(sourceId)) {
          newSourceStatuses[sourceId] = "unhealthy";
        }
      });

      // Update the store
      set({ sourceStatuses: newSourceStatuses });
    } catch (error) {
      console.error("Failed to load source statuses:", error);
    }
  },

  getSourceStatus: (sourceId: string) => {
    return get().sourceStatuses[sourceId];
  }
}));
