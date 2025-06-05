import { useState, useEffect, useRef } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { ChevronUp, Database, History, Plus } from "lucide-react";
import { useAppStore } from "@/shared/store/useAppStore";
import { useChatLLMQuery } from "@/shared/hooks/useChatLLMQuery";
import { useLLMsQuery, useLLMQuery } from "@/shared/hooks/useLLMsQuery";
import { useChatSessionsQuery, useChatMessagesQuery } from "@/shared/hooks/useChatQuery";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    selectedSource,
    selectedLLM: selectedLLMId,
    setSelectedLLM,
    messages,
    addMessage,
    chatLoading,
    setChatLoading,
    editorContent,
    setProposedChanges,
    sessionId,
    generateNewSession,
    startNewSession,
    setSessionId,
    loadMessagesFromServer
  } = useAppStore();

  const { data: llms = [] } = useLLMsQuery();
  const { data: selectedLLM } = useLLMQuery(selectedLLMId || undefined);
  const { data: sessionsData } = useChatSessionsQuery();
  const chatMutation = useChatLLMQuery();

  // Check if current session exists on server
  const sessionExistsOnServer = !!(
    sessionId && sessionsData?.sessions?.some((session) => session.id === sessionId)
  );

  // Load messages when session changes - only if session exists on server
  const { data: chatMessagesData } = useChatMessagesQuery(sessionId, sessionExistsOnServer);
  useEffect(() => {
    if (chatMessagesData?.messages) {
      loadMessagesFromServer(
        chatMessagesData.messages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
          sql_query: msg.sql_query
        }))
      );
    }
  }, [chatMessagesData, loadMessagesFromServer]);

  // Auto-select the first LLM if none is selected and LLMs are available
  useEffect(() => {
    if (llms.length > 0 && !selectedLLMId) {
      const defaultLLM = llms.find((llm) => llm.default);
      if (defaultLLM) {
        setSelectedLLM(defaultLLM.id);
      } else {
        setSelectedLLM(llms[0].id);
      }
    }
  }, [llms, selectedLLMId, setSelectedLLM]);

  // Generate a new session ID if one doesn't exist
  useEffect(() => {
    if (!sessionId) {
      generateNewSession();
    }
  }, [sessionId, generateNewSession]);

  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Function to get current session name
  const getCurrentSessionName = () => {
    if (!sessionId || !sessionsData?.sessions) {
      return "New chat";
    }

    const currentSession = sessionsData.sessions.find((session) => session.id === sessionId);
    return currentSession?.name || "New chat";
  };

  // Function to handle session selection
  const handleSessionSelect = (selectedSessionId: string) => {
    setSessionId(selectedSessionId);
  };

  // Function to start a new session
  const handleNewSession = () => {
    startNewSession();
  };

  // Function to format session date
  const formatSessionDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit"
      });
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  };

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
    if (!sessionId) {
      toast.error("Session not initialized");
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
        session_id: sessionId!,
        query: editorContent ? editorContent : undefined
      });

      // Handle response based on sql_query presence
      if (response.sql_query) {
        // Instead of directly updating the editor, set proposed changes for diff view
        setProposedChanges({
          originalContent: editorContent,
          proposedContent: response.sql_query,
          message: response.content || "AI generated SQL query"
        });

        // Add a message to chat with sql_query as separate field
        const aiMessage = {
          role: "assistant" as const,
          content: response.content,
          sql_query: response.sql_query
        };
        addMessage(aiMessage);
      } else {
        // Show the response as a regular chat message
        const aiMessage = {
          role: "assistant" as const,
          content: response.content,
          sql_query: response.sql_query
        };
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

  // Auto-resize textarea function
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    const scrollHeight = Math.min(textarea.scrollHeight, 120); // Max height of 120px
    textarea.style.height = `${Math.max(32, scrollHeight)}px`; // Min height of 32px
  };

  return (
    <div className="h-full flex flex-col">
      {/* Chat Session Header */}
      <div className="flex-shrink-0 p-2 font-semibold text-sm border-b border-border/50 bg-muted/10 flex items-center justify-between">
        <span>{getCurrentSessionName()}</span>

        {/* Actions on the right */}
        <div className="flex items-center gap-1">
          {/* History dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="p-0 h-auto w-auto cursor-pointer  hover:text-foreground text-muted-foreground"
              >
                <History className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {sessionsData?.sessions && sessionsData.sessions.length > 0 ? (
                <>
                  {sessionsData.sessions
                    .sort(
                      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    )
                    .map((session) => (
                      <DropdownMenuItem
                        key={session.id}
                        onClick={() => handleSessionSelect(session.id)}
                        className="flex justify-between items-center"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {session.name || "Unnamed Chat"}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground ml-2">
                          {formatSessionDate(session.created_at)}
                        </div>
                      </DropdownMenuItem>
                    ))}
                </>
              ) : (
                <DropdownMenuItem disabled>
                  <span className="text-muted-foreground">No previous sessions</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* New session button */}
          <Button
            variant="ghost"
            size="icon"
            className="p-0 h-auto w-auto cursor-pointer hover:text-foreground text-muted-foreground"
            onClick={handleNewSession}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-xs py-8">
            {!selectedSource
              ? "Select a source to start chatting"
              : !selectedLLM
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

      {/* Context indicator */}
      {selectedSource && (
        <div className="px-3 py-2 border-t border-border/50 bg-muted/20">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Database className="h-3 w-3" strokeWidth={1} />
            <span className="text-foreground font-medium">{selectedSource.name}</span>
          </div>
        </div>
      )}

      {/* Middle: Full-width textarea input */}
      <div className="flex-shrink-0 px-3 py-2">
        <Textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedSource && selectedLLM
              ? "Type your message..."
              : "Select a source and LLM to start chatting"
          }
          className="min-h-[40px] max-h-[120px] resize-none text-sm border-0 bg-muted/30 hover:bg-muted/50 focus:bg-muted/50 transition-colors px-3 py-2 rounded-xs w-full overflow-hidden"
          disabled={!selectedSource || !selectedLLM || !sessionId || chatLoading}
          style={{ height: "40px" }}
        />
      </div>

      {/* Bottom: LLM selection (left) and Send button (right) */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-border/50">
        <div className="flex items-center justify-between">
          {/* LLM selection on the left - no border, no background */}
          <div className="flex-shrink-0">
            <Select
              value={selectedLLMId || ""}
              onValueChange={(value) => {
                setSelectedLLM(value || null);
              }}
            >
              <SelectTrigger className="h-7 text-xs bg-transparent hover:bg-muted/30 transition-colors min-w-[140px] border-0 focus:ring-0 focus:ring-offset-0 shadow-none">
                <SelectValue placeholder="Choose model..." />
              </SelectTrigger>
              <SelectContent>
                {llms.map((llm) => (
                  <SelectItem key={llm.id} value={llm.id} className="text-xs">
                    {llm.name} - {llm.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Send button on the right */}
          <div className="flex-shrink-0">
            <Button
              onClick={handleSend}
              size="sm"
              className="h-8 w-8 p-0 rounded-md bg-primary/90 hover:bg-primary transition-colors"
              disabled={
                !selectedSource || !selectedLLM || !sessionId || chatLoading || !input.trim()
              }
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
