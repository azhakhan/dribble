import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLLMs, getLLM, createLLM, updateLLM, deleteLLM } from "@/shared/lib/api";
import type { LLMListItem, LLM, CreateLLMRequest, UpdateLLMRequest } from "@/shared/lib/api";

export function useLLMsQuery() {
  return useQuery<LLMListItem[], Error>({
    queryKey: ["llms"],
    queryFn: getLLMs
  });
}

export function useLLMQuery(llmId: string | undefined) {
  return useQuery<LLM, Error>({
    queryKey: ["llm", llmId],
    queryFn: () => (llmId ? getLLM(llmId) : Promise.reject("No LLM ID provided")),
    enabled: !!llmId
  });
}

export function useCreateLLMMutation() {
  const queryClient = useQueryClient();

  return useMutation<LLM, Error, CreateLLMRequest>({
    mutationFn: createLLM,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llms"] });
    }
  });
}

export function useUpdateLLMMutation() {
  const queryClient = useQueryClient();

  return useMutation<LLM, Error, { llmId: string; data: UpdateLLMRequest }>({
    mutationFn: ({ llmId, data }) => updateLLM(llmId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["llms"] });
      queryClient.invalidateQueries({ queryKey: ["llm", data.id] });
    }
  });
}

export function useDeleteLLMMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteLLM,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llms"] });
    }
  });
}
