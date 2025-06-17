import { create } from "zustand";
import type { Query, QueryVersion, QueryRun } from "@/shared/lib/api";
import type { PaginationInfo } from "./types";
import {
  getQueryById,
  getQueryVersions,
  getLatestQueryVersion,
  createQuery,
  createQueryVersion,
  updateQuery,
  deleteQuery,
  getQueryRunsByQueryId,
  getQueryRunsByQueryIdPaginated,
  getOrCreateEphemeralQuery,
  convertEphemeralToRegular
} from "@/shared/lib/api";

interface QueryState {
  // Cached data
  queries: Record<string, Query>;
  queryVersions: Record<string, QueryVersion[]>;
  queryRuns: Record<string, QueryRun[]>;
  queryRunsPagination: Record<string, PaginationInfo>;

  // Loading states
  loadingQueries: Set<string>;
  loadingVersions: Set<string>;
  loadingRuns: Set<string>;

  // Actions for query management
  loadQuery: (queryId: string) => Promise<void>;
  loadQueryVersions: (queryId: string) => Promise<void>;
  loadQueryRuns: (queryId: string, forceRefresh?: boolean) => Promise<void>;
  loadQueryRunsPaginated: (
    queryId: string,
    page: number,
    pageSize: number,
    forceRefresh?: boolean
  ) => Promise<void>;
  loadLatestQueryVersion: (queryId: string) => Promise<QueryVersion | null>;

  setQuery: (queryId: string, query: Query) => void;
  setQueryVersions: (queryId: string, versions: QueryVersion[]) => void;
  setQueryRuns: (queryId: string, runs: QueryRun[]) => void;
  setQueryRunsPaginated: (queryId: string, runs: QueryRun[], pagination: PaginationInfo) => void;
  removeQuery: (queryId: string) => void;

  // Query creation and management
  createNewQuery: ({ sourceId, name }: { sourceId: string; name?: string }) => Promise<Query>;
  saveQueryVersion: (queryId: string, sql: string, saveTrigger: "run" | "ai") => Promise<void>;
  updateQueryName: (queryId: string, newName: string) => Promise<Query>;
  deleteQuery: (queryId: string) => Promise<void>;

  // Ephemeral query management
  getOrCreateEphemeralQuery: (
    sourceId: string,
    schema: string,
    table: string,
    nodeType: "table" | "view"
  ) => Promise<Query>;
  convertEphemeralToRegular: (queryId: string, name: string) => Promise<Query>;

  // Legacy state (to be deprecated)
  queriesBySource: Record<string, Query[]>;
  versionsByQuery: Record<string, QueryVersion[]>;
  runsByVersion: Record<string, QueryRun[]>;

  // Legacy actions
  setQueriesBySource: (sourceId: string, queries: Query[]) => void;
  setVersionsByQuery: (queryId: string, versions: QueryVersion[]) => void;
  setRunsByVersion: (versionId: string, runs: QueryRun[]) => void;
  clearQueriesBySource: (sourceId: string) => void;
  clearVersionsByQuery: (queryId: string) => void;
  clearRunsByVersion: (versionId: string) => void;
}

export const useQueryStore = create<QueryState>((set, get) => ({
  // Initial state
  queries: {},
  queryVersions: {},
  queryRuns: {},
  queryRunsPagination: {},
  loadingQueries: new Set(),
  loadingVersions: new Set(),
  loadingRuns: new Set(),

  // Legacy state
  queriesBySource: {},
  versionsByQuery: {},
  runsByVersion: {},

  // Load query by ID
  loadQuery: async (queryId) => {
    const state = get();
    if (state.queries[queryId] || state.loadingQueries.has(queryId)) return;

    set((state) => ({
      loadingQueries: new Set(state.loadingQueries).add(queryId)
    }));

    try {
      const query = await getQueryById(queryId);
      set((state) => ({
        queries: { ...state.queries, [queryId]: query },
        loadingQueries: new Set([...state.loadingQueries].filter((id) => id !== queryId))
      }));
    } catch (error) {
      console.error(`Failed to load query ${queryId}:`, error);
      set((state) => ({
        loadingQueries: new Set([...state.loadingQueries].filter((id) => id !== queryId))
      }));
    }
  },

  // Load query versions
  loadQueryVersions: async (queryId) => {
    const state = get();
    if (state.queryVersions[queryId] || state.loadingVersions.has(queryId)) return;

    set((state) => ({
      loadingVersions: new Set(state.loadingVersions).add(queryId)
    }));

    try {
      const versions = await getQueryVersions(queryId);
      set((state) => ({
        queryVersions: { ...state.queryVersions, [queryId]: versions },
        loadingVersions: new Set([...state.loadingVersions].filter((id) => id !== queryId))
      }));
    } catch (error) {
      console.error(`Failed to load versions for query ${queryId}:`, error);
      set((state) => ({
        loadingVersions: new Set([...state.loadingVersions].filter((id) => id !== queryId))
      }));
    }
  },

  // Load latest query version
  loadLatestQueryVersion: async (queryId) => {
    try {
      const latestVersion = await getLatestQueryVersion(queryId);

      // Update the queryVersions cache if we have it
      const state = get();
      if (state.queryVersions[queryId] && latestVersion) {
        const existingVersions = state.queryVersions[queryId];
        const hasVersion = existingVersions.some((v) => v.id === latestVersion.id);

        if (!hasVersion) {
          // Add the new version at the beginning (latest first)
          set((state) => ({
            queryVersions: {
              ...state.queryVersions,
              [queryId]: [latestVersion, ...state.queryVersions[queryId]]
            }
          }));
        }
      }

      return latestVersion;
    } catch (error) {
      console.error(`Failed to load latest version for query ${queryId}:`, error);
      return null;
    }
  },

  // Load query runs
  loadQueryRuns: async (queryId, forceRefresh = false) => {
    const state = get();
    if (!forceRefresh && (state.queryRuns[queryId] || state.loadingRuns.has(queryId))) return;

    set((state) => ({
      loadingRuns: new Set(state.loadingRuns).add(queryId)
    }));

    try {
      const runs = await getQueryRunsByQueryId(queryId);
      set((state) => ({
        queryRuns: { ...state.queryRuns, [queryId]: runs },
        loadingRuns: new Set([...state.loadingRuns].filter((id) => id !== queryId))
      }));
    } catch (error) {
      console.error(`Failed to load runs for query ${queryId}:`, error);
      set((state) => ({
        loadingRuns: new Set([...state.loadingRuns].filter((id) => id !== queryId))
      }));
    }
  },

  // Load query runs with pagination
  loadQueryRunsPaginated: async (queryId, page, pageSize, forceRefresh = false) => {
    const state = get();
    const cacheKey = `${queryId}-${page}-${pageSize}`;

    if (!forceRefresh && state.loadingRuns.has(cacheKey)) return;

    set((state) => ({
      loadingRuns: new Set(state.loadingRuns).add(cacheKey)
    }));

    try {
      const response = await getQueryRunsByQueryIdPaginated(queryId, page, pageSize);
      set((state) => ({
        queryRuns: { ...state.queryRuns, [queryId]: response.items },
        queryRunsPagination: {
          ...state.queryRunsPagination,
          [queryId]: {
            total: response.total,
            page: response.page,
            page_size: response.page_size,
            total_pages: response.total_pages,
            has_next: response.has_next,
            has_prev: response.has_prev
          }
        },
        loadingRuns: new Set([...state.loadingRuns].filter((id) => id !== cacheKey))
      }));
    } catch (error) {
      console.error(`Failed to load runs for query ${queryId} (page ${page}):`, error);
      set((state) => ({
        loadingRuns: new Set([...state.loadingRuns].filter((id) => id !== cacheKey))
      }));
    }
  },

  // Setters
  setQuery: (queryId, query) =>
    set((state) => ({
      queries: { ...state.queries, [queryId]: query }
    })),

  setQueryVersions: (queryId, versions) =>
    set((state) => ({
      queryVersions: { ...state.queryVersions, [queryId]: versions }
    })),

  setQueryRuns: (queryId, runs) =>
    set((state) => ({
      queryRuns: { ...state.queryRuns, [queryId]: runs }
    })),

  setQueryRunsPaginated: (queryId, runs, pagination) =>
    set((state) => ({
      queryRuns: { ...state.queryRuns, [queryId]: runs },
      queryRunsPagination: { ...state.queryRunsPagination, [queryId]: pagination }
    })),

  removeQuery: (queryId) =>
    set((state) => {
      const newQueries = { ...state.queries };
      delete newQueries[queryId];

      const newQueryVersions = { ...state.queryVersions };
      delete newQueryVersions[queryId];

      const newQueryRuns = { ...state.queryRuns };
      delete newQueryRuns[queryId];

      const newQueryRunsPagination = { ...state.queryRunsPagination };
      delete newQueryRunsPagination[queryId];

      return {
        queries: newQueries,
        queryVersions: newQueryVersions,
        queryRuns: newQueryRuns,
        queryRunsPagination: newQueryRunsPagination
      };
    }),

  // Create new query
  createNewQuery: async ({ sourceId, name }: { sourceId: string; name?: string }) => {
    try {
      const newQuery = await createQuery({ source_id: sourceId, name });
      set((state) => ({
        queries: { ...state.queries, [newQuery.id]: newQuery }
      }));
      return newQuery;
    } catch (error) {
      console.error("Failed to create query:", error);
      throw error;
    }
  },

  // Save query version
  saveQueryVersion: async (queryId, sql, saveTrigger) => {
    try {
      await createQueryVersion({
        query_id: queryId,
        sql,
        save_trigger: saveTrigger
      });

      // Reload versions to get the latest
      const currentState = get();
      await currentState.loadQueryVersions(queryId);
    } catch (error) {
      console.error("Failed to save query version:", error);
      throw error;
    }
  },

  // Update query name
  updateQueryName: async (queryId, newName) => {
    try {
      const updatedQuery = await updateQuery(queryId, { name: newName });

      // Update the query in the store
      set((state) => ({
        queries: { ...state.queries, [queryId]: updatedQuery }
      }));

      // Update any open tabs that reference this query
      const { useTabStore } = await import("./useTabStore");
      const tabStore = useTabStore.getState();
      const openTabs = tabStore.openTabs;

      // Find tabs that have this queryId and update their titles
      for (const tab of openTabs) {
        if (tab.queryId === queryId) {
          tabStore.updateTabTitle(tab.id, updatedQuery.name || newName);
        }
      }

      return updatedQuery;
    } catch (error) {
      console.error("Failed to update query name:", error);
      throw error;
    }
  },

  // Delete query
  deleteQuery: async (queryId) => {
    try {
      await deleteQuery(queryId);

      // Close any open tabs for this query
      const { useTabStore } = await import("./useTabStore");
      const { closeTabsByQueryId } = useTabStore.getState();
      closeTabsByQueryId(queryId);

      // Remove the query from the store
      set((state) => {
        const newQueries = { ...state.queries };
        delete newQueries[queryId];

        const newQueryVersions = { ...state.queryVersions };
        delete newQueryVersions[queryId];

        const newQueryRuns = { ...state.queryRuns };
        delete newQueryRuns[queryId];

        const newQueryRunsPagination = { ...state.queryRunsPagination };
        delete newQueryRunsPagination[queryId];

        return {
          queries: newQueries,
          queryVersions: newQueryVersions,
          queryRuns: newQueryRuns,
          queryRunsPagination: newQueryRunsPagination
        };
      });
    } catch (error) {
      console.error("Failed to delete query:", error);
      throw error;
    }
  },

  // Get or create ephemeral query
  getOrCreateEphemeralQuery: async (sourceId, schema, table, nodeType) => {
    try {
      const query = await getOrCreateEphemeralQuery(sourceId, schema, table, nodeType);

      // Update the query in the store
      set((state) => ({
        queries: { ...state.queries, [query.id]: query }
      }));

      return query;
    } catch (error) {
      console.error("Failed to get or create ephemeral query:", error);
      throw error;
    }
  },

  // Convert ephemeral to regular
  convertEphemeralToRegular: async (queryId, name) => {
    try {
      const updatedQuery = await convertEphemeralToRegular(queryId, name);

      // Update the query in the store
      set((state) => ({
        queries: { ...state.queries, [queryId]: updatedQuery }
      }));

      return updatedQuery;
    } catch (error) {
      console.error("Failed to convert ephemeral query to regular:", error);
      throw error;
    }
  },

  // Legacy actions
  setQueriesBySource: (sourceId, queries) =>
    set((state) => ({
      queriesBySource: { ...state.queriesBySource, [sourceId]: queries }
    })),

  setVersionsByQuery: (queryId, versions) =>
    set((state) => ({
      versionsByQuery: { ...state.versionsByQuery, [queryId]: versions }
    })),

  setRunsByVersion: (versionId, runs) =>
    set((state) => ({
      runsByVersion: { ...state.runsByVersion, [versionId]: runs }
    })),

  clearQueriesBySource: (sourceId) =>
    set((state) => {
      const newQueries = { ...state.queriesBySource };
      delete newQueries[sourceId];
      return { queriesBySource: newQueries };
    }),

  clearVersionsByQuery: (queryId) =>
    set((state) => {
      const newVersions = { ...state.versionsByQuery };
      delete newVersions[queryId];
      return { versionsByQuery: newVersions };
    }),

  clearRunsByVersion: (versionId) =>
    set((state) => {
      const newRuns = { ...state.runsByVersion };
      delete newRuns[versionId];
      return { runsByVersion: newRuns };
    })
}));
