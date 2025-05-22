import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { executeQuery } from "@/lib/api";

export function useQueryQuery(
  database_id: string,
  query: string,
  options?: Omit<UseQueryOptions<object[], Error>, "queryKey" | "queryFn">
) {
  return useQuery<object[], Error>({
    queryKey: ["query", database_id, query],
    queryFn: () => executeQuery(database_id, query),
    enabled: !!database_id && !!query,
    ...options,
  });
}
