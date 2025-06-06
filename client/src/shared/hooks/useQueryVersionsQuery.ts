import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getQueryVersions,
  getQueryVersionById,
  createQueryVersion,
  deleteQueryVersion,
  type QueryVersion,
  type CreateQueryVersionRequest
} from "@/shared/lib/api";

export function useQueryVersionsQuery(queryId: string) {
  return useQuery<QueryVersion[], Error>({
    queryKey: ["queryVersions", queryId],
    queryFn: () => getQueryVersions(queryId),
    enabled: !!queryId
  });
}

export function useQueryVersionByIdQuery(versionId: string) {
  return useQuery<QueryVersion, Error>({
    queryKey: ["queryVersion", versionId],
    queryFn: () => getQueryVersionById(versionId),
    enabled: !!versionId
  });
}

export function useCreateQueryVersionMutation() {
  const queryClient = useQueryClient();
  return useMutation<QueryVersion, Error, CreateQueryVersionRequest>({
    mutationFn: createQueryVersion,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["queryVersions", variables.query_id] });
    }
  });
}

export function useDeleteQueryVersionMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { versionId: string; queryId: string }>({
    mutationFn: ({ versionId }) => deleteQueryVersion(versionId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["queryVersions", variables.queryId] });
    }
  });
}
