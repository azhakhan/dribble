import { useQuery } from "@tanstack/react-query";
import { getSourceStatus, type SourceStatus } from "@/lib/api";

export function useSourceStatusQuery(sourceId: string | undefined) {
  return useQuery<SourceStatus, Error>({
    queryKey: ["sourceStatus", sourceId],
    queryFn: () => (sourceId ? getSourceStatus(sourceId) : Promise.reject("No source ID provided")),
    enabled: !!sourceId,
    // Poll every 2 seconds when in "starting" state
    refetchInterval: (query) => {
      return query.state.data === "starting" ? 2000 : false;
    },
    refetchIntervalInBackground: true
  });
}
