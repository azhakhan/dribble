import { useEffect, useMemo, useRef } from "react";
import { useSourceStore, useQueryStore } from "@/shared/store";
import type { ConnectedSource } from "@/shared/lib/api";

/**
 * Custom hook that provides sources data from the store
 * with React Query-like interface
 */
export function useStoreSources() {
  const { allSources, loadingSources, loadSources } = useSourceStore();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Load sources only once on mount if not already loaded and not loading
    if (!hasLoadedRef.current && allSources.length === 0 && !loadingSources) {
      hasLoadedRef.current = true;
      loadSources();
    }
  }, [allSources.length, loadingSources]);

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
  const { connectedSourcesData, loadingConnectedSources, loadConnectedSources } = useSourceStore();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Load connected sources only once on mount if not already loaded and not loading
    if (!hasLoadedRef.current && connectedSourcesData.length === 0 && !loadingConnectedSources) {
      hasLoadedRef.current = true;
      loadConnectedSources();
    }
  }, [connectedSourcesData.length, loadingConnectedSources]);

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
  const { queries, loadingQueries, loadQuery } = useQueryStore();

  useEffect(() => {
    if (queryId && !queries[queryId] && !loadingQueries.has(queryId)) {
      loadQuery(queryId);
    }
  }, [queryId, queries, loadingQueries]);

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
  const { queryVersions, loadingVersions, loadQueryVersions } = useQueryStore();

  useEffect(() => {
    if (queryId && !queryVersions[queryId] && !loadingVersions.has(queryId)) {
      loadQueryVersions(queryId);
    }
  }, [queryId, queryVersions, loadingVersions]);

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
  const { createNewQuery, saveQueryVersion } = useQueryStore();

  const createQuery = useMemo(
    () => ({
      mutateAsync: async (sourceId: string) => {
        const newQuery = await createNewQuery({ sourceId });
        return { id: newQuery.id }; // Return in a format similar to the original API response
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

/**
 * Custom hook that provides source schema data from the store
 * with automatic loading and React Query-like interface
 */
export function useStoreSourceSchema(sourceId: string | undefined) {
  const { sourceSchemaMap, loadingSchemas, sourceSchemaErrors, loadSourceSchema } =
    useSourceStore();

  useEffect(() => {
    if (sourceId && !sourceSchemaMap[sourceId] && !loadingSchemas.has(sourceId)) {
      loadSourceSchema(sourceId);
    }
  }, [sourceId, sourceSchemaMap, loadingSchemas]);

  return {
    data: sourceId ? sourceSchemaMap[sourceId] || null : null,
    isLoading: sourceId ? loadingSchemas.has(sourceId) : false,
    error: sourceId && sourceSchemaErrors[sourceId] ? new Error(sourceSchemaErrors[sourceId]) : null
  };
}

/**
 * Custom hook that loads schemas for all connected sources and integrates with store
 */
export function useStoreConnectedSourcesSchemas(connectedSources: ConnectedSource[] | undefined) {
  const { loadingSchemas, sourceSchemaErrors, loadConnectedSourcesSchemas } = useSourceStore();

  useEffect(() => {
    if (connectedSources && connectedSources.length > 0) {
      loadConnectedSourcesSchemas(connectedSources);
    }
  }, [connectedSources]);

  // Calculate loading state - true if any connected source is loading
  const isLoading = useMemo(() => {
    if (!connectedSources) return false;
    return connectedSources.some((source) => loadingSchemas.has(source.id));
  }, [connectedSources, loadingSchemas]);

  // Calculate error state - if any connected source has an error
  const error = useMemo(() => {
    if (!connectedSources) return null;
    const firstError = connectedSources.find((source) => sourceSchemaErrors[source.id]);
    return firstError ? new Error(sourceSchemaErrors[firstError.id]) : null;
  }, [connectedSources, sourceSchemaErrors]);

  return {
    isLoading,
    error,
    refetch: () => {
      if (connectedSources) {
        loadConnectedSourcesSchemas(connectedSources);
      }
    }
  };
}
