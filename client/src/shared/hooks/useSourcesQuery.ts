import { useQuery } from "@tanstack/react-query";
import { getSources } from "@/shared/lib/api";
import type { Source } from "@/shared/lib/api";

export function useSourcesQuery() {
  return useQuery<Source[], Error>({
    queryKey: ["sources"],
    queryFn: getSources
  });
}
