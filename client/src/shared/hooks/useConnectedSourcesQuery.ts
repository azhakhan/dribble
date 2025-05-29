import { useQuery } from "@tanstack/react-query";
import { getConnectedSources, type ConnectedSource } from "@/shared/lib/api";

export function useConnectedSourcesQuery() {
  return useQuery<ConnectedSource[], Error>({
    queryKey: ["connectedSources"],
    queryFn: () => getConnectedSources()
    // We don't need to poll this query as the connection status is handled by the status query
  });
}
