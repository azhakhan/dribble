import { useEffect, useRef } from "react";
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
    setSourceHasChildren,
    setSourceSchemaError
  } = useAppStore();

  // Keep track of previously connected source IDs to detect disconnections
  const previousConnectedSourceIds = useRef<Set<string>>(new Set());

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
    enabled: Boolean(connectedSources && connectedSources.length > 0)
  });

  // Update AppState when schemas are loaded and clean up disconnected sources
  useEffect(() => {
    const currentConnectedSourceIds = new Set(connectedSources?.map((s) => s.id) || []);

    // Find sources that were previously connected but are no longer connected
    const disconnectedSourceIds = Array.from(previousConnectedSourceIds.current).filter(
      (sourceId) => !currentConnectedSourceIds.has(sourceId)
    );

    // Clean up data for disconnected sources
    disconnectedSourceIds.forEach((sourceId) => {
      setSourceSchema(sourceId, {});
      setSourceGeneratedChildren(sourceId, []);
      setSourceHasChildren(sourceId, false);
      setSourceSchemaError(sourceId, null);
    });

    // Update the ref with current connected source IDs
    previousConnectedSourceIds.current = currentConnectedSourceIds;

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

          // Set hasChildren flag based on generated children
          setSourceHasChildren(source.id, generatedChildren.length > 0);

          // Clear any existing error
          setSourceSchemaError(source.id, null);
        } else if (result?.error) {
          // Set error in app store
          setSourceSchemaError(source.id, result.error);

          // Clear children for errored sources
          setSourceGeneratedChildren(source.id, []);
          setSourceHasChildren(source.id, false);
        }
      });
    }
  }, [
    sourceQueries.data,
    connectedSources,
    setSourceSchema,
    setSourceGeneratedChildren,
    setSourceHasChildren,
    setSourceSchemaError
  ]);

  return {
    isLoading: sourceQueries.isLoading,
    error: sourceQueries.error,
    refetch: sourceQueries.refetch
  };
}
