import type { ChatContext } from "@/shared/lib/api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sql_query?: string;
  context?: ChatContext[];
}

export interface SQLBlock {
  sql: string;
  index: number;
}
