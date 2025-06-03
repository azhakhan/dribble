import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getSourceSchemas } from "@/shared/lib/api";
import { useAppStore, type SchemaObject } from "@/shared/store/useAppStore";
import { schemaToFileTreeNodes } from "@/shared/lib/fileTreeUtils";
import type { ConnectedSource } from "@/shared/lib/api";

interface SchemaResult {
  success: boolean;
  data?: Record<string, SchemaObject>;
  error?: string;
}

export function useConnectedSourcesSchemas(connectedSources: ConnectedSource[] | undefined) {
  const {
    setSourceSchema,
    setSourceGeneratedChildren,
    setSourceSchemaError,
    cleanupDisconnectedSources
  } = useAppStore();

  // Create queries for each connected source
  const sourceQueries = useQuery({
    queryKey: ["connectedSourcesSchemas", connectedSources?.map((s) => s.id).sort()],
    queryFn: async () => {
      if (!connectedSources || connectedSources.length === 0) {
        return {};
      }

      const results: Record<string, SchemaResult> = {};

      // Fetch schemas for all connected sources in parallel
      await Promise.allSettled(
        connectedSources.map(async (source) => {
          try {
            const schemas = await getSourceSchemas(source.id);
            results[source.id] = { success: true, data: schemas };
          } catch (error) {
            results[source.id] = {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error"
            };
          }
        })
      );

      return results;
    },
    enabled: Boolean(connectedSources && connectedSources.length > 0),
    retry: (failureCount, error) => {
      // Retry up to 3 times, with exponential backoff for connection errors
      if (failureCount < 3) {
        // Check if it's a connection-related error that might resolve with time
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("connection attempts failed") ||
          errorMessage.includes("500") ||
          errorMessage.includes("timeout")
        ) {
          return true;
        }
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff: 1s, 2s, 4s, max 30s
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 60000, // Keep in cache for 1 minute
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: true // Refetch when reconnecting to internet
  });

  // Update AppState when schemas are loaded and clean up disconnected sources
  useEffect(() => {
    // Clean up data for disconnected sources using the store action
    const connectedSourceIds = connectedSources?.map((s) => s.id) || [];
    cleanupDisconnectedSources(connectedSourceIds);

    // Update AppState for currently connected sources
    if (sourceQueries.data && connectedSources) {
      connectedSources.forEach((source) => {
        const result = sourceQueries.data[source.id];

        if (result?.success && result.data) {
          // Update the app store with schema data
          setSourceSchema(source.id, result.data);

          // Generate children nodes from schema data
          const generatedChildren = schemaToFileTreeNodes(result.data, source.id);

          // Update the app store with generated children
          setSourceGeneratedChildren(source.id, generatedChildren);

          // Clear any existing error
          setSourceSchemaError(source.id, null);
        } else if (result?.error) {
          // Set error in app store
          setSourceSchemaError(source.id, result.error);

          // Clear children for errored sources
          setSourceGeneratedChildren(source.id, []);
        }
      });
    }
  }, [
    sourceQueries.data,
    connectedSources,
    setSourceSchema,
    setSourceGeneratedChildren,
    setSourceSchemaError,
    cleanupDisconnectedSources
  ]);

  // Clear errors when query is retrying
  useEffect(() => {
    if (sourceQueries.isLoading && connectedSources) {
      connectedSources.forEach((source) => {
        // Clear error state when retrying to avoid showing stale error icons
        setSourceSchemaError(source.id, null);
      });
    }
  }, [sourceQueries.isLoading, connectedSources, setSourceSchemaError]);

  return {
    isLoading: sourceQueries.isLoading,
    error: sourceQueries.error,
    refetch: sourceQueries.refetch
  };
}
