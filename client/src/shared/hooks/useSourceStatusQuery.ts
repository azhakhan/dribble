import { useQuery } from "@tanstack/react-query";
import { getSourceStatus, type SourceStatus } from "@/shared/lib/api";
import { useAppStore } from "@/shared/store/useAppStore";

export function useSourceStatusQuery(sourceId: string | undefined) {
  const { connectedSources } = useAppStore();

  // Only enable the query if sourceId exists AND the source is connected
  const isSourceConnected = sourceId ? connectedSources.has(sourceId) : false;

  return useQuery<SourceStatus, Error>({
    queryKey: ["sourceStatus", sourceId],
    queryFn: () => {
      if (!sourceId) {
        return Promise.reject(new Error("No source ID provided"));
      }
      if (!isSourceConnected) {
        return Promise.reject(new Error("Source is not connected"));
      }
      return getSourceStatus(sourceId);
    },
    enabled: !!sourceId && isSourceConnected,
    // Poll every 2 seconds when in "starting" state
    refetchInterval: (query) => {
      // Only poll if source is still connected and in starting state
      return isSourceConnected && query.state.data === "starting" ? 2000 : false;
    },
    refetchIntervalInBackground: true,
    // Stop retrying on 404 errors (source disconnected)
    retry: (failureCount, error) => {
      // Don't retry on 404 errors
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        (error as { status: number }).status === 404
      ) {
        return false;
      }
      // Don't retry if source is no longer connected
      if (!isSourceConnected) {
        return false;
      }
      // Default retry logic for other errors
      return failureCount < 3;
    }
  });
}
