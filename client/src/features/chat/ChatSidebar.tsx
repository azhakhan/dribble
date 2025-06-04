import { useState } from "react";
import type { KeyboardEvent, ChangeEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useAppStore } from "@/shared/store/useAppStore";
import { useChatLLMQuery } from "@/shared/hooks/useChatLLMQuery";
import { useLLMsQuery, useLLMQuery } from "@/shared/hooks/useLLMsQuery";
import { toast } from "sonner";
import { SQLCodeBlock } from "./SQLCodeBlock";

// Utility function to extract SQL code blocks from a message
const extractSQLBlocks = (content: string): { sql: string; index: number }[] => {
  const regex = /```sql\n([\s\S]*?)```/g;
  const blocks: { sql: string; index: number }[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      sql: match[1],
      index: match.index
    });
  }

  return blocks;
};

export function ChatSidebar() {
  const [input, setInput] = useState("");

  const {
    selectedSource,
    selectedLLM: selectedLLMId,
    setSelectedLLM,
    messages,
    addMessage,
    chatLoading,
    setChatLoading,
    editorContent,
    setEditorContent
  } = useAppStore();

  const { data: llms = [] } = useLLMsQuery();
  const { data: selectedLLM } = useLLMQuery(selectedLLMId || undefined);
  const chatMutation = useChatLLMQuery();

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!selectedSource) {
      toast.error("Please select a source first");
      return;
    }
    if (!selectedLLM) {
      toast.error("Please select an LLM first");
      return;
    }

    // Add user message to chat
    const userMessage = { role: "user" as const, content: input };
    addMessage(userMessage);
    setInput("");
    setChatLoading(true);

    try {
      // Send chat request with editor content as query if not empty
      const response = await chatMutation.mutateAsync({
        source_id: selectedSource.id,
        llm_id: selectedLLM.id,
        message: input,
        query:
          editorContent.trim() !== "-- Write your SQL query here\n" && editorContent.trim()
            ? editorContent
            : undefined
      });

      // Handle response based on action type
      if (response.action === "update_editor" && response.sql_query) {
        // Update the SQL editor with the generated query
        setEditorContent(response.sql_query);

        // Also add a message to chat indicating SQL was generated
        const aiMessage = {
          role: "assistant" as const,
          content: `✅ Generated SQL query and updated the editor:\n\n\`\`\`sql\n${response.sql_query}\n\`\`\``
        };
        addMessage(aiMessage);
      } else {
        // Show the response as a regular chat message
        const aiMessage = { role: "assistant" as const, content: response.content };
        addMessage(aiMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send message";
      toast.error(errorMessage);
      const errorResponse = { role: "assistant" as const, content: `Error: ${errorMessage}` };
      addMessage(errorResponse);
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col border-l">
      {/* LLM Selection */}
      <div className="flex-shrink-0 p-4 border-b">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select LLM:</label>
          <Select
            value={selectedLLMId || ""}
            onValueChange={(value) => {
              setSelectedLLM(value || null);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose an LLM..." />
            </SelectTrigger>
            <SelectContent>
              {llms.map((llm) => (
                <SelectItem key={llm.id} value={llm.id}>
                  {llm.name} - {llm.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Scrollable messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            {!selectedSource
              ? "Select a source to start chatting"
              : !selectedLLM
                ? "Select an LLM to start chatting"
                : "Start a conversation with your AI assistant"}
          </div>
        )}
        {messages.map((message, index) => {
          const sqlBlocks = extractSQLBlocks(message.content);

          if (sqlBlocks.length === 0) {
            // No SQL blocks, render the message as is
            return (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted"
                } max-w-[80%] ${message.role === "user" ? "ml-auto" : "mr-auto"} text-sm`}
              >
                <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
              </div>
            );
          }

          // We have SQL blocks to render
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
            contentParts.push(<SQLCodeBlock key={`sql-${blockIndex}`} code={block.sql} />);

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
              className={`p-3 rounded-sm ${
                message.role === "user" ? "bg-primary text-primary-foreground ml-auto" : "bg-muted"
              } max-w-[80%] ${message.role === "user" ? "ml-auto" : "mr-auto"}`}
            >
              {contentParts}
            </div>
          );
        })}
        {chatLoading && (
          <div className="bg-muted p-3 rounded-lg max-w-[80%] mr-auto">
            <div className="flex items-center space-x-2">
              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
              <span>AI is thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Fixed input area */}
      <div className="flex-shrink-0 p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedSource && selectedLLM
                ? "Type your message..."
                : "Select a source and LLM to start chatting"
            }
            className="min-h-[80px] resize-none"
            disabled={!selectedSource || !selectedLLM || chatLoading}
          />
          <Button
            onClick={handleSend}
            className="self-end"
            disabled={!selectedSource || !selectedLLM || chatLoading || !input.trim()}
          >
            Send
          </Button>
        </div>
        {editorContent.trim() && editorContent.trim() !== "-- Write your SQL query here\n" && (
          <div className="mt-2 text-xs text-muted-foreground">
            💡 Editor content will be included as context
          </div>
        )}
      </div>
    </div>
  );
}
