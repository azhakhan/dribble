import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getQueryRunsByQueryId,
  getQueryRunsByVersionId,
  getQueryRunById,
  deleteQueryRun,
  type QueryRun
} from "@/shared/lib/api";

export function useQueryRunsByQueryIdQuery(queryId: string) {
  return useQuery<QueryRun[], Error>({
    queryKey: ["queryRunsByQuery", queryId],
    queryFn: () => getQueryRunsByQueryId(queryId),
    enabled: !!queryId
  });
}

export function useQueryRunsByVersionIdQuery(versionId: string) {
  return useQuery<QueryRun[], Error>({
    queryKey: ["queryRunsByVersion", versionId],
    queryFn: () => getQueryRunsByVersionId(versionId),
    enabled: !!versionId
  });
}

export function useQueryRunByIdQuery(runId: string) {
  return useQuery<QueryRun, Error>({
    queryKey: ["queryRun", runId],
    queryFn: () => getQueryRunById(runId),
    enabled: !!runId
  });
}

export function useDeleteQueryRunMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { runId: string; versionId?: string; queryId?: string }>({
    mutationFn: ({ runId }) => deleteQueryRun(runId),
    onSuccess: (_data, variables) => {
      if (variables?.versionId) {
        queryClient.invalidateQueries({ queryKey: ["queryRunsByVersion", variables.versionId] });
      }
      if (variables?.queryId) {
        queryClient.invalidateQueries({ queryKey: ["queryRunsByQuery", variables.queryId] });
      }
    }
  });
}
