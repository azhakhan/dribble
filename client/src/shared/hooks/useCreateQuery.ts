import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQueryStore } from "@/shared/store";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { toast } from "sonner";

export function useCreateQuery() {
  const { createNewQuery, loadQuery } = useQueryStore();
  const { openQueryFromTree } = useTabManagerStore();
  const queryClient = useQueryClient();

  const createQueryAndOpenInTab = useCallback(
    async (sourceId: string, name: string) => {
      try {
        // Step 1: Create the query in the backend
        const newQuery = await createNewQuery({
          sourceId: sourceId,
          name: name.trim()
        });

        // Step 2: Refresh the query tree (like QueryTree does)
        queryClient.invalidateQueries({ queryKey: ["queries"] });

        // Step 3: Load the newly created query to ensure it's in the store (like QueryTree does)
        await loadQuery(newQuery.id);

        // Step 4: Wait a moment for the store to update (like QueryTree does)
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Step 5: Open the query in tabs using the proven flow
        await openQueryFromTree(newQuery.id);

        // Step 6: Show success message
        toast.success(`Query "${name.trim()}" created successfully`);

        return newQuery;
      } catch (error) {
        console.error("Failed to create and open query:", error);
        toast.error("Failed to create query");
        throw error;
      }
    },
    [createNewQuery, queryClient, loadQuery, openQueryFromTree]
  );

  // Alternative function that mimics the QueryTree flow exactly
  const createQueryWithCallback = useCallback(
    async (sourceId: string, name: string, onQueryCreated?: (queryId: string) => void) => {
      try {
        // Step 1: Create the query in the backend
        const newQuery = await createNewQuery({
          sourceId: sourceId,
          name: name.trim()
        });

        // Step 2: Refresh the query tree
        queryClient.invalidateQueries({ queryKey: ["queries"] });

        // Step 3: Show success message
        toast.success(`Query "${name.trim()}" created successfully`);

        // Step 4: Call the callback (like QueryTree does)
        if (onQueryCreated) {
          onQueryCreated(newQuery.id);
        }

        return newQuery;
      } catch (error) {
        console.error("Failed to create query:", error);
        toast.error("Failed to create query");
        throw error;
      }
    },
    [createNewQuery, queryClient]
  );

  return { createQueryAndOpenInTab, createQueryWithCallback };
}
