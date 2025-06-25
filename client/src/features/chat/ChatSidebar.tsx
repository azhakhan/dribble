import { ChatHeader } from "./components/ChatSidebar/ChatHeader";
import { ChatMessages } from "./components/ChatSidebar/ChatMessages";
import { ChatInput } from "./components/ChatSidebar/ChatInput";
import { ChatFooter } from "./components/ChatSidebar/ChatFooter";
import { ChatContextIndicator } from "./components/ChatSidebar/ChatContextIndicator";
import { useChatHandlers } from "./components/ChatSidebar/hooks/useChatHandlers";

export function ChatSidebar() {
  const {
    messages,
    chatLoading,
    selectedLLM,
    selectedLLMId,
    sessionId,
    activeTab,
    llms,
    handleSend,
    handleSessionSelect,
    handleNewSession,
    getCurrentSessionName,
    setSelectedLLM
  } = useChatHandlers();

  return (
    <div className="h-full flex flex-col">
      <ChatHeader
        currentSessionName={getCurrentSessionName()}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
      />

      <ChatMessages
        messages={messages}
        chatLoading={chatLoading}
        selectedLLM={selectedLLM || null}
      />

      <ChatContextIndicator activeTab={activeTab || null} />

      <ChatInput
        onSend={handleSend}
        selectedLLM={selectedLLM || null}
        sessionId={sessionId}
        chatLoading={chatLoading}
      />

      <ChatFooter llms={llms} selectedLLMId={selectedLLMId} onLLMSelect={setSelectedLLM} />
    </div>
  );
}
