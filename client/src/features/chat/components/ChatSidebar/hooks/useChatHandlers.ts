import { useEffect } from "react";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { useChatStore, useQueryStore } from "@/shared/store";
import { useChatLLMQuery } from "@/shared/hooks/useChatLLMQuery";
import { useLLMsQuery, useLLMQuery } from "@/shared/hooks/useLLMsQuery";
import { useChatSessionsQuery, useChatMessagesQuery } from "@/shared/hooks/useChatQuery";
import { toast } from "sonner";
import type { ChatContext } from "@/shared/lib/api";

export function useChatHandlers() {
  const { openTabs, activeTabId } = useTabManagerStore();
  const { queryVersions, loadQueryVersions } = useQueryStore();
  const {
    selectedLLM: selectedLLMId,
    setSelectedLLM,
    messages,
    addMessage,
    chatLoading,
    setChatLoading,
    setProposedChanges,
    sessionId,
    generateNewSession,
    startNewSession,
    setSessionId,
    loadMessagesFromServer
  } = useChatStore();

  // Get active tab's content and query info
  const activeTab = activeTabId ? openTabs.find((tab) => tab.id === activeTabId) : null;
  const editorContent = activeTab?.editorContent || "";

  // Load query versions for the active tab if not already loaded
  useEffect(() => {
    if (activeTab?.queryId && !queryVersions[activeTab.queryId]) {
      loadQueryVersions(activeTab.queryId);
    }
  }, [activeTab?.queryId, queryVersions, loadQueryVersions]);

  // Get the current context based on active tab
  const getCurrentContext = (): ChatContext[] => {
    if (!activeTab || !activeTab.queryId) {
      return [];
    }

    // If queryVersionId is not set on the tab, try to get the latest version from the store
    let versionId = activeTab.queryVersionId || undefined;
    if (!versionId) {
      const versions = queryVersions[activeTab.queryId] || [];
      versionId = versions.length > 0 ? versions[0].id : undefined;
    }

    return [
      {
        query_id: activeTab.queryId,
        query_version_id: versionId,
        active: true
      }
    ];
  };

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
          sql_query: msg.sql_query,
          context: msg.context
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

  const handleSend = async (input: string) => {
    if (!input.trim()) return;
    if (!selectedLLM) {
      toast.error("Please select an LLM first");
      return;
    }
    if (!sessionId) {
      toast.error("Session not initialized");
      return;
    }

    // Get current context
    const context = getCurrentContext();

    // Add user message to chat
    const userMessage = {
      role: "user" as const,
      content: input,
      context: context.length > 0 ? context : undefined
    };
    addMessage(userMessage);
    setChatLoading(true);

    try {
      // Send chat request with context
      const response = await chatMutation.mutateAsync({
        llm_id: selectedLLM.id,
        message: input,
        session_id: sessionId!,
        context: context.length > 0 ? context : undefined
      });

      // Handle response based on sql_query presence
      if (response.sql_query) {
        // Instead of directly updating the editor, set proposed changes for diff view
        // This will now automatically save the LLM changes as the latest version
        await setProposedChanges({
          originalContent: editorContent,
          proposedContent: response.sql_query,
          message: response.content || "AI generated SQL query"
        });

        // Add a message to chat with sql_query as separate field
        const aiMessage = {
          role: "assistant" as const,
          content: response.content,
          sql_query: response.sql_query,
          context: context.length > 0 ? context : undefined
        };
        addMessage(aiMessage);
      } else {
        // Show the response as a regular chat message
        const aiMessage = {
          role: "assistant" as const,
          content: response.content,
          sql_query: response.sql_query,
          context: context.length > 0 ? context : undefined
        };
        addMessage(aiMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send message";
      toast.error(errorMessage);
      const errorResponse = {
        role: "assistant" as const,
        content: `Error: ${errorMessage}`,
        context: context.length > 0 ? context : undefined
      };
      addMessage(errorResponse);
    } finally {
      setChatLoading(false);
    }
  };

  return {
    // State
    messages,
    chatLoading,
    selectedLLM,
    selectedLLMId,
    sessionId,
    activeTab,
    llms,

    // Handlers
    handleSend,
    handleSessionSelect,
    handleNewSession,
    getCurrentSessionName,
    setSelectedLLM
  };
}
