import { useSourceStore } from "@/shared/store";
import type { SourceStatus } from "@/shared/lib/api";

/**
 * Hook to get source status from the Zustand store (cached value)
 * This replaces useSourceStatusQuery for better performance by avoiding individual API calls
 */
export function useSourceStatus(sourceId: string | undefined): {
  status: SourceStatus | undefined;
  isLoading: boolean;
} {
  const sourceStatuses = useSourceStore((state) => state.sourceStatuses);
  const loadingStatuses = useSourceStore((state) => state.loadingStatuses);
  const connectedSources = useSourceStore((state) => state.connectedSources);

  // Return undefined if no sourceId provided
  if (!sourceId) {
    return {
      status: undefined,
      isLoading: false
    };
  }

  // Return undefined if source is not connected
  if (!connectedSources.has(sourceId)) {
    return {
      status: undefined,
      isLoading: false
    };
  }

  return {
    status: sourceStatuses[sourceId],
    isLoading: loadingStatuses.has(sourceId)
  };
}
