import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { LLMListItem } from "@/shared/lib/api";

interface ChatFooterProps {
  llms: LLMListItem[];
  selectedLLMId: string | null;
  onLLMSelect: (llmId: string | null) => void;
}

export function ChatFooter({ llms, selectedLLMId, onLLMSelect }: ChatFooterProps) {
  return (
    <div className="flex-shrink-0 px-3 py-2 border-t border-border/50">
      <div className="flex items-center">
        {/* LLM selection - no border, no background */}
        <div className="flex-shrink-0">
          <Select
            value={selectedLLMId || ""}
            onValueChange={(value) => {
              onLLMSelect(value || null);
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
      </div>
    </div>
  );
}
