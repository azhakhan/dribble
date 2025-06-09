import { useEffect, useMemo } from "react";
import { useAppStore } from "@/shared/store/useAppStore";

/**
 * Custom hook that provides sources data from the store
 * with React Query-like interface
 */
export function useStoreSources() {
  const { allSources, loadingSources, loadSources } = useAppStore();

  useEffect(() => {
    // Load sources on mount if not already loaded and not loading
    if (allSources.length === 0 && !loadingSources) {
      loadSources();
    }
  }, [allSources.length, loadingSources, loadSources]);

  return {
    data: allSources,
    isLoading: loadingSources,
    error: null // Could add error state to store if needed
  };
}

/**
 * Custom hook that provides connected sources data from the store
 */
export function useStoreConnectedSources() {
  const { connectedSourcesData, loadingConnectedSources, loadConnectedSources } = useAppStore();

  useEffect(() => {
    // Load connected sources on mount if not already loaded and not loading
    if (connectedSourcesData.length === 0 && !loadingConnectedSources) {
      loadConnectedSources();
    }
  }, [connectedSourcesData.length, loadingConnectedSources, loadConnectedSources]);

  return {
    data: connectedSourcesData,
    isLoading: loadingConnectedSources,
    error: null // Could add error state to store if needed
  };
}

/**
 * Custom hook for accessing a specific query from the store
 */
export function useStoreQuery(queryId: string | null) {
  const { queries, loadingQueries, loadQuery } = useAppStore();

  useEffect(() => {
    if (queryId && !queries[queryId] && !loadingQueries.has(queryId)) {
      loadQuery(queryId);
    }
  }, [queryId, queries, loadingQueries, loadQuery]);

  return {
    data: queryId ? queries[queryId] || null : null,
    isLoading: queryId ? loadingQueries.has(queryId) : false,
    error: null // Could add error state to store if needed
  };
}

/**
 * Custom hook for accessing query versions from the store
 */
export function useStoreQueryVersions(queryId: string | null) {
  const { queryVersions, loadingVersions, loadQueryVersions } = useAppStore();

  useEffect(() => {
    if (queryId && !queryVersions[queryId] && !loadingVersions.has(queryId)) {
      loadQueryVersions(queryId);
    }
  }, [queryId, queryVersions, loadingVersions, loadQueryVersions]);

  return {
    data: queryId ? queryVersions[queryId] || [] : [],
    isLoading: queryId ? loadingVersions.has(queryId) : false,
    error: null // Could add error state to store if needed
  };
}

/**
 * Custom hook for query mutations that uses store actions
 */
export function useStoreQueryMutations() {
  const { createNewQuery, saveQueryVersion } = useAppStore();

  const createQuery = useMemo(
    () => ({
      mutateAsync: async (sourceId: string) => {
        const queryId = await createNewQuery(sourceId);
        return { id: queryId }; // Return in a format similar to the original API response
      }
    }),
    [createNewQuery]
  );

  const createVersion = useMemo(
    () => ({
      mutateAsync: async ({
        queryId,
        sql,
        saveTrigger
      }: {
        queryId: string;
        sql: string;
        saveTrigger: "run" | "ai";
      }) => {
        await saveQueryVersion(queryId, sql, saveTrigger);
      }
    }),
    [saveQueryVersion]
  );

  return {
    createQuery,
    createVersion
  };
}
