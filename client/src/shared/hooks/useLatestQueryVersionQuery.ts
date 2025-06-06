import { useQuery } from "@tanstack/react-query";
import { getLatestQueryVersion } from "../lib/api";
import type { QueryVersion } from "../lib/api";

export const useLatestQueryVersionQuery = (queryId: string | undefined) => {
  return useQuery<QueryVersion | null>({
    queryKey: ["queryVersion", "latest", queryId],
    queryFn: () => (queryId ? getLatestQueryVersion(queryId) : null),
    enabled: !!queryId,
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5 // 5 minutes
  });
};
