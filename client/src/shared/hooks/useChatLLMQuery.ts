import { useMutation } from "@tanstack/react-query";
import { chatLLM, type ChatLLMRequest, type ChatLLMResponse } from "@/shared/lib/api";

export function useChatLLMQuery() {
  return useMutation<ChatLLMResponse, Error, ChatLLMRequest>({
    mutationFn: chatLLM
  });
}
