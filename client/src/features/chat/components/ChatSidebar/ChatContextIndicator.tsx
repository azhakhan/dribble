import { FileText } from "lucide-react";

interface Tab {
  id: string;
  title?: string;
  queryId?: string | null;
}

interface ChatContextIndicatorProps {
  activeTab: Tab | null;
}

export function ChatContextIndicator({ activeTab }: ChatContextIndicatorProps) {
  if (!activeTab || !activeTab.queryId) {
    return null;
  }

  return (
    <div className="px-3 py-2 border-t border-border/50 bg-muted/20">
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <FileText className="h-3 w-3" strokeWidth={1} />
        <span className="text-foreground font-medium">
          {activeTab.title || `Query ${activeTab.queryId.slice(0, 8)}`}
        </span>
      </div>
    </div>
  );
}
