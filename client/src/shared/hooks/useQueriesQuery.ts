import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getQueries,
  getQueryById,
  createQuery,
  updateQuery,
  deleteQuery,
  type Query,
  type CreateQueryRequest,
  type UpdateQueryRequest
} from "@/shared/lib/api";

export function useQueriesQuery() {
  return useQuery<Query[], Error>({
    queryKey: ["queries"],
    queryFn: getQueries
  });
}

export function useQueryByIdQuery(queryId: string) {
  return useQuery<Query, Error>({
    queryKey: ["query", queryId],
    queryFn: () => getQueryById(queryId),
    enabled: !!queryId
  });
}

export function useCreateQueryMutation() {
  const queryClient = useQueryClient();
  return useMutation<Query, Error, CreateQueryRequest>({
    mutationFn: createQuery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queries"] });
    }
  });
}

export function useUpdateQueryMutation() {
  const queryClient = useQueryClient();
  return useMutation<Query, Error, { queryId: string; data: UpdateQueryRequest }>({
    mutationFn: ({ queryId, data }) => updateQuery(queryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queries"] });
    }
  });
}

export function useDeleteQueryMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteQuery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["queries"] });
    }
  });
}
