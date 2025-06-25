import { ChatHeader } from "./ChatHeader";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { ChatFooter } from "./ChatFooter";
import { ChatContextIndicator } from "./ChatContextIndicator";
import { useChatHandlers } from "./hooks/useChatHandlers";

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
