import { memo } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface TabButtonProps {
  tab: { id: string; title: string; isDirty: boolean };
  isActive: boolean;
  onTabClick: (tabId: string) => Promise<void>;
  onCloseTab: (tabId: string, e: React.MouseEvent) => Promise<void>;
  onRightClick: (tabId: string, e: React.MouseEvent) => void;
  tabRef?: React.RefObject<HTMLDivElement | null>;
}

function TabButtonComponent({
  tab,
  isActive,
  onTabClick,
  onCloseTab,
  onRightClick,
  tabRef
}: TabButtonProps) {
  return (
    <div
      ref={tabRef}
      className={cn(
        "flex items-center px-2 py-1.5 border-r cursor-pointer group flex-shrink-0",
        "min-w-[120px] max-w-[200px]", // Set minimum and maximum width
        isActive ? "bg-background" : "border-b bg-muted/20 hover:bg-accent"
      )}
      onClick={() => onTabClick(tab.id)}
      onContextMenu={(e) => onRightClick(tab.id, e)}
    >
      <span className="text-sm truncate mx-2 flex-1 min-w-0" title={tab.title}>
        {tab.title}
        {tab.isDirty && <span className="ml-1">•</span>}
      </span>
      <button
        className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 transition-opacity flex-shrink-0"
        onClick={(e) => onCloseTab(tab.id, e)}
        aria-label="Close tab"
      >
        <X className="h-3 w-3 cursor-pointer hover:bg-primary/40 rounded-xs" />
      </button>
    </div>
  );
}

export const TabButton = memo(TabButtonComponent);
