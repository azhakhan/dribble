import { useQuery } from "@tanstack/react-query";
import { getSourceSchemas } from "@/shared/lib/api";

export function useSourceSchemasQuery(sourceId: string | undefined) {
  return useQuery({
    queryKey: ["sourceSchemas", sourceId],
    queryFn: () => (sourceId ? getSourceSchemas(sourceId) : Promise.resolve(null)),
    enabled: !!sourceId, // Only run the query if sourceId is provided
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
}
