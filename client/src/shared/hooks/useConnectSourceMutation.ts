import { useMutation, useQueryClient } from "@tanstack/react-query";
import { connectSource, disconnectSource, getSourceStatus } from "@/shared/lib/api";
import { useAppStore } from "@/shared/store/useAppStore";

export function useConnectSourceMutation() {
  const queryClient = useQueryClient();
  const {
    addLoadingSourceId,
    removeLoadingSourceId,
    setSourceStatus,
    loadConnectedSources,
    loadSourceSchema
  } = useAppStore();

  return useMutation({
    mutationFn: (sourceId: string) => {
      console.log("🔌 Connecting to source:", sourceId);
      // Set loading state when connection starts
      addLoadingSourceId(sourceId);
      return connectSource(sourceId);
    },
    onSuccess: async (_, sourceId) => {
      console.log("✅ Connection successful for source:", sourceId);
      try {
        // Immediately invalidate and refetch connected sources to update UI
        await queryClient.invalidateQueries({ queryKey: ["connectedSources"] });

        // Update the store's connected sources immediately
        await loadConnectedSources();
        console.log("🔄 Updated connected sources in store");

        // Wait a moment for the UI to update
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Set initial status to "starting"
        setSourceStatus(sourceId, "starting");
        queryClient.setQueryData(["sourceStatus", sourceId], "starting");
        console.log("⏳ Set status to 'starting' for source:", sourceId);

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
            console.log(`📊 Status check ${attempts + 1} for source ${sourceId}:`, status);

            // Update the status in both the cache and app store
            queryClient.setQueryData(["sourceStatus", sourceId], status);
            setSourceStatus(sourceId, status);

            // If the source is healthy, stop polling and load schemas
            if (status === "running") {
              isHealthy = true;
              console.log("🎉 Source is healthy, loading schemas:", sourceId);

              try {
                // Use the store's integrated schema loading
                await loadSourceSchema(sourceId);
                console.log("📊 Schemas loaded successfully for source:", sourceId);
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
        console.log("🏁 Cleared loading state for source:", sourceId);
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
    setSourceSchema,
    setSourceSchemaError,
    removeSourceStatus,
    loadConnectedSources
  } = useAppStore();

  return useMutation({
    mutationFn: (sourceId: string) => {
      console.log("🔌 Disconnecting from source:", sourceId);
      return disconnectSource(sourceId);
    },
    onSuccess: async (_, sourceId) => {
      console.log("✅ Disconnection successful for source:", sourceId);

      // Cancel any in-flight queries for this source to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ["sourceSchemas", sourceId] });

      // Cancel any in-flight connectedSourcesSchemas queries that might include this source
      await queryClient.cancelQueries({ queryKey: ["connectedSourcesSchemas"] });

      // Invalidate connected sources query to update UI
      await queryClient.invalidateQueries({ queryKey: ["connectedSources"] });

      // Update the store's connected sources immediately
      await loadConnectedSources();
      console.log("🔄 Updated connected sources in store after disconnect");

      // Remove the old connectedSourcesSchemas query completely before invalidating
      queryClient.removeQueries({ queryKey: ["connectedSourcesSchemas"] });

      // Clear source status from cache and app store
      queryClient.removeQueries({ queryKey: ["sourceStatus", sourceId] });
      removeSourceStatus(sourceId);
      console.log("🗑️ Removed source status for:", sourceId);

      // Clear schema data from cache and app store
      queryClient.removeQueries({ queryKey: ["sourceSchemas", sourceId] });
      setSourceSchema(sourceId, {});

      // Clear generated children and error state
      setSourceGeneratedChildren(sourceId, []);
      setSourceSchemaError(sourceId, null);
      console.log("🧹 Cleaned up source data for:", sourceId);
    },
    onError: (error, sourceId) => {
      console.error("❌ Disconnection failed for source:", sourceId, error);
    }
  });
}
