import { useMutation, useQueryClient } from "@tanstack/react-query";
import { connectSource, disconnectSource, getSourceStatus } from "@/shared/lib/api";
import { useTreeStore, useSourceStore } from "@/shared/store";

export function useConnectSourceMutation() {
  const queryClient = useQueryClient();
  const { addLoadingSourceId, removeLoadingSourceId } = useTreeStore();
  const { setSourceStatus, loadConnectedSources, loadSourceSchema } = useSourceStore();

  return useMutation({
    mutationFn: (sourceId: string) => {
      // Set loading state when connection starts
      addLoadingSourceId(sourceId);
      return connectSource(sourceId);
    },
    onSuccess: async (_, sourceId) => {
      try {
        // Immediately invalidate and refetch connected sources to update UI
        await queryClient.invalidateQueries({ queryKey: ["connectedSources"] });

        // Update the store's connected sources immediately
        await loadConnectedSources();

        // Wait a moment for the UI to update
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Set initial status to "starting"
        setSourceStatus(sourceId, "starting");
        queryClient.setQueryData(["sourceStatus", sourceId], "starting");

        // Start polling for source status
        let isHealthy = false;
        let attempts = 0;
        const maxAttempts = 30;

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
            if (status === "running") {
              isHealthy = true;

              try {
                // Use the store's integrated schema loading
                await loadSourceSchema(sourceId);
              } catch (error) {
                console.error("❌ Error fetching source schemas:", error);
              }
            }

            attempts++;
          } catch (error) {
            console.error("❌ Error checking source status:", error);
            attempts++;
          }
        }

        if (!isHealthy) {
          console.warn("⚠️ Source did not become healthy within timeout:", sourceId);
        }
      } finally {
        // Clear loading state when done, regardless of outcome
        removeLoadingSourceId(sourceId);
      }
    },
    onError: (error, sourceId) => {
      console.error("❌ Connection failed for source:", sourceId, error);
      // Clear loading state on error
      removeLoadingSourceId(sourceId);
      // Set status to unhealthy on error
      setSourceStatus(sourceId, "unhealthy");
    }
  });
}

export function useDisconnectSourceMutation() {
  const queryClient = useQueryClient();
  const {
    setSourceGeneratedChildren,
    setSourceSchemaError,
    removeSourceStatus,
    loadConnectedSources
  } = useSourceStore();

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

      // Update the store's connected sources immediately
      await loadConnectedSources();

      // Remove the old connectedSourcesSchemas query completely before invalidating
      queryClient.removeQueries({ queryKey: ["connectedSourcesSchemas"] });

      // Clear source status from cache and app store
      queryClient.removeQueries({ queryKey: ["sourceStatus", sourceId] });
      removeSourceStatus(sourceId);

      // Clear schema data from cache and app store - PROPERLY REMOVE IT
      queryClient.removeQueries({ queryKey: ["sourceSchemas", sourceId] });

      // Remove the sourceId from sourceSchemaMap instead of setting it to empty object
      const currentState = useSourceStore.getState();
      const newSourceSchemaMap = { ...currentState.sourceSchemaMap };
      delete newSourceSchemaMap[sourceId];

      // Also clear any loading state for this source's schemas
      const newLoadingSchemas = new Set(currentState.loadingSchemas);
      newLoadingSchemas.delete(sourceId);

      useSourceStore.setState({
        sourceSchemaMap: newSourceSchemaMap,
        loadingSchemas: newLoadingSchemas
      });
      // Clear generated children and error state
      setSourceGeneratedChildren(sourceId, []);
      setSourceSchemaError(sourceId, null);
    },
    onError: (error, sourceId) => {
      console.error("❌ Disconnection failed for source:", sourceId, error);
    }
  });
}
