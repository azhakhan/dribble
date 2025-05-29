import { useQuery } from "@tanstack/react-query";
import { getSourceSchemas } from "@/shared/lib/api";

export function useSourceSchemasQuery(sourceId: string | undefined) {
  return useQuery({
    queryKey: ["sourceSchemas", sourceId],
    queryFn: () => (sourceId ? getSourceSchemas(sourceId) : Promise.resolve(null)),
    enabled: !!sourceId // Only run the query if sourceId is provided
  });
}
