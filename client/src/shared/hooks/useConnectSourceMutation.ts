import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  connectSource,
  disconnectSource,
  getSourceStatus,
  getSourceSchemas
} from "@/shared/lib/api";
import { useAppStore } from "@/shared/store/useAppStore";
import { schemaToFileTreeNodes } from "@/shared/lib/fileTreeUtils";

export function useConnectSourceMutation() {
  const queryClient = useQueryClient();
  const { setLoadingSourceId, setSourceSchema, setSourceGeneratedChildren, setSourceStatus } =
    useAppStore();

  return useMutation({
    mutationFn: (sourceId: string) => {
      // Set loading state when connection starts
      setLoadingSourceId(sourceId);
      return connectSource(sourceId);
    },
    onSuccess: async (_, sourceId) => {
      try {
        // Immediately invalidate and refetch connected sources to update UI
        await queryClient.invalidateQueries({ queryKey: ["connectedSources"] });

        // Wait a moment for the UI to update
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Set initial status to "starting"
        setSourceStatus(sourceId, "starting");
        queryClient.setQueryData(["sourceStatus", sourceId], "starting");

        // Start polling for source status
        let isHealthy = false;
        let attempts = 0;
        const maxAttempts = 30; // Prevent infinite polling

        while (!isHealthy && attempts < maxAttempts) {
          try {
            // Wait a bit before checking status
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Check source status
            const status = await getSourceStatus(sourceId);

            // Update the status in both the cache and app store
            queryClient.setQueryData(["sourceStatus", sourceId], status);
            setSourceStatus(sourceId, status);

            // If the source is healthy, stop polling and load schemas
            if (status === "healthy") {
              isHealthy = true;

              try {
                // Explicitly fetch schemas when the source is healthy
                const schemas = await getSourceSchemas(sourceId);

                // Update the cache with the fetched schemas
                queryClient.setQueryData(["sourceSchemas", sourceId], schemas);

                // Also invalidate the query to ensure any components using useSourceSchemasQuery are updated
                queryClient.invalidateQueries({ queryKey: ["sourceSchemas", sourceId] });

                // Update the app store with schema data
                setSourceSchema(sourceId, schemas);

                // Generate children nodes from schema data
                const generatedChildren = schemaToFileTreeNodes(schemas, sourceId);

                // Update the app store with generated children
                setSourceGeneratedChildren(sourceId, generatedChildren);
              } catch (error) {
                console.error("Error fetching source schemas:", error);
              }
            }

            attempts++;
          } catch (error) {
            console.error("Error checking source status:", error);
            attempts++;
          }
        }
      } finally {
        // Clear loading state when done, regardless of outcome
        setLoadingSourceId(undefined);
      }
    },
    onError: (_, sourceId) => {
      // Clear loading state on error
      setLoadingSourceId(undefined);
      // Set status to unhealthy on error
      setSourceStatus(sourceId, "unhealthy");
    }
  });
}

export function useDisconnectSourceMutation() {
  const queryClient = useQueryClient();
  const { setSourceGeneratedChildren, setSourceSchema, setSourceSchemaError, removeSourceStatus } =
    useAppStore();

  return useMutation({
    mutationFn: (sourceId: string) => {
      return disconnectSource(sourceId);
    },
    onSuccess: async (_, sourceId) => {
      // Cancel any in-flight queries for this source to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ["sourceSchemas", sourceId] });

      // Cancel any in-flight connectedSourcesSchemas queries that might include this source
      await queryClient.cancelQueries({ queryKey: ["connectedSourcesSchemas"] });

      // Invalidate connected sources query to update UI
      await queryClient.invalidateQueries({ queryKey: ["connectedSources"] });

      // Remove the old connectedSourcesSchemas query completely before invalidating
      queryClient.removeQueries({ queryKey: ["connectedSourcesSchemas"] });

      // Clear source status from cache and app store
      queryClient.removeQueries({ queryKey: ["sourceStatus", sourceId] });
      removeSourceStatus(sourceId);

      // Clear schema data from cache and app store
      queryClient.removeQueries({ queryKey: ["sourceSchemas", sourceId] });
      setSourceSchema(sourceId, {});

      // Clear generated children and error state
      setSourceGeneratedChildren(sourceId, []);
      setSourceSchemaError(sourceId, null);
    },
    onError: () => {
      console.error("Error disconnecting source");
    }
  });
}
