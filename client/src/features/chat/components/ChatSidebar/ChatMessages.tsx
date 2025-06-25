import { useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { SQLCodeBlock } from "../../SQLCodeBlock";
import { MessageContext } from "./MessageContext";
import { extractSQLBlocks } from "./utils";
import type { ChatMessage } from "./types";
import type { LLM } from "@/shared/lib/api";

interface ChatMessagesProps {
  messages: ChatMessage[];
  chatLoading: boolean;
  selectedLLM: LLM | null;
}

export function ChatMessages({ messages, chatLoading, selectedLLM }: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
      {messages.length === 0 && (
        <div className="text-center text-muted-foreground text-xs py-8">
          {!selectedLLM
            ? "Select an LLM to start chatting"
            : "Start a conversation with your AI assistant"}
        </div>
      )}
      {messages.map((message, index) => {
        const sqlBlocks = extractSQLBlocks(message.content);
        const hasSqlQuery = message.sql_query && message.sql_query.trim().length > 0;

        // Render message content
        const messageContentElement = (
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">
            {message.content}
          </pre>
        );

        // If message has sql_query field, show it as a code block
        if (hasSqlQuery && sqlBlocks.length === 0) {
          return (
            <div
              key={index}
              className={`p-2 rounded-md ${message.role === "user" ? "bg-muted/50" : ""} w-full ${
                message.role === "user" ? "ml-auto max-w-[85%]" : "mr-auto"
              } flex flex-col`}
            >
              <MessageContext context={message.context} />
              {messageContentElement}
              <div className="w-full overflow-hidden mt-2 mb-2">
                <SQLCodeBlock code={message.sql_query!} />
              </div>
            </div>
          );
        }

        if (sqlBlocks.length === 0 && !hasSqlQuery) {
          // No SQL blocks or sql_query, render the message as is
          return (
            <div
              key={index}
              className={`p-2 rounded-md ${message.role === "user" ? "bg-muted/50" : ""} ${
                message.role === "user" ? "ml-auto max-w-[85%]" : "mr-auto w-full"
              } text-xs`}
            >
              <MessageContext context={message.context} />
              {messageContentElement}
            </div>
          );
        }

        // We have SQL blocks in content to render (legacy format)
        let lastIndex = 0;
        const contentParts: ReactNode[] = [];

        sqlBlocks.forEach((block, blockIndex) => {
          // Add text content before SQL block
          if (block.index > lastIndex) {
            const textContent = message.content.substring(lastIndex, block.index);
            contentParts.push(
              <pre key={`text-${blockIndex}`} className="whitespace-pre-wrap font-sans text-sm">
                {textContent}
              </pre>
            );
          }

          // Add SQL block with Monaco editor
          const sqlPattern = "```sql\n" + block.sql + "```";
          contentParts.push(
            <div key={`sql-${blockIndex}`} className="w-full overflow-hidden mt-2 mb-2">
              <SQLCodeBlock code={block.sql} />
            </div>
          );

          lastIndex = block.index + sqlPattern.length;
        });

        // Add any remaining text after the last SQL block
        if (lastIndex < message.content.length) {
          const textContent = message.content.substring(lastIndex);
          contentParts.push(
            <pre key="text-end" className="whitespace-pre-wrap font-sans text-sm">
              {textContent}
            </pre>
          );
        }

        return (
          <div
            key={index}
            className={`p-2 rounded-md ${message.role === "user" ? "bg-muted/50" : ""} w-full ${
              message.role === "user" ? "ml-auto max-w-[85%]" : "mr-auto"
            } flex flex-col`}
          >
            <MessageContext context={message.context} />
            {contentParts}
          </div>
        );
      })}
      {chatLoading && (
        <div className="bg-muted/30 p-2 rounded-md w-full mr-auto">
          <div className="flex items-center space-x-2">
            <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full"></div>
            <span className="text-xs text-muted-foreground">AI is thinking...</span>
          </div>
        </div>
      )}
      {/* Invisible div to mark the end of messages for auto-scrolling */}
      <div ref={messagesEndRef} />
    </div>
  );
}
