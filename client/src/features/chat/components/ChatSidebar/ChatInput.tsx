import { useState } from "react";
import type { KeyboardEvent, ChangeEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { LLM } from "@/shared/lib/api";

interface ChatInputProps {
  onSend: (message: string) => void;
  selectedLLM: LLM | null;
  sessionId: string | null;
  chatLoading: boolean;
}

export function ChatInput({ onSend, selectedLLM, sessionId, chatLoading }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const message = input;
    setInput("");
    onSend(message);
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
    <div className="flex-shrink-0 px-3 py-2">
      <Textarea
        value={input}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={selectedLLM ? "Type your message..." : "Select an LLM to start chatting"}
        className="min-h-[40px] max-h-[120px] resize-none text-sm border-0 bg-muted/30 hover:bg-muted/50 focus:bg-muted/50 transition-colors px-3 py-2 rounded-xs w-full overflow-hidden"
        disabled={!selectedLLM || !sessionId || chatLoading}
        style={{ height: "40px" }}
      />
    </div>
  );
}
