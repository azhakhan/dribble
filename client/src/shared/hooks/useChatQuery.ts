import { useQuery } from "@tanstack/react-query";
import {
  getChatMessages,
  getChatSessions,
  type ChatMessagesResponse,
  type ChatSessionsResponse
} from "@/shared/lib/api";

export function useChatMessagesQuery(sessionId: string | null, enabled: boolean = true) {
  return useQuery<ChatMessagesResponse, Error>({
    queryKey: ["chatMessages", sessionId],
    queryFn: () => getChatMessages(sessionId!),
    enabled: enabled && !!sessionId
  });
}

export function useChatSessionsQuery() {
  return useQuery<ChatSessionsResponse, Error>({
    queryKey: ["chatSessions"],
    queryFn: getChatSessions
  });
}
