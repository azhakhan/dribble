import { useQuery } from "@tanstack/react-query";
import { getSources } from "@/lib/api";
import type { Source } from "@/lib/api";

export function useSourcesQuery() {
  return useQuery<Source[], Error>({
    queryKey: ["sources"],
    queryFn: getSources,
  });
}
