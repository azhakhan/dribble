import { memo, useRef, useEffect } from "react";
import { cn } from "@/shared/lib/utils";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCloseOthers: () => Promise<void>;
  onCloseToRight: () => Promise<void>;
  canCloseToRight: boolean;
}

function ContextMenuComponent({
  x,
  y,
  onClose,
  onCloseOthers,
  onCloseToRight,
  canCloseToRight
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-background border rounded-md shadow-lg py-1 min-w-[150px]"
      style={{ left: x, top: y }}
    >
      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors"
        onClick={async () => {
          await onCloseOthers();
          onClose();
        }}
      >
        Close Others
      </button>
      <button
        className={cn(
          "w-full px-3 py-1.5 text-left text-sm transition-colors",
          canCloseToRight ? "hover:bg-accent" : "text-muted-foreground cursor-not-allowed"
        )}
        onClick={async () => {
          if (canCloseToRight) {
            await onCloseToRight();
            onClose();
          }
        }}
        disabled={!canCloseToRight}
      >
        Close Tabs to the Right
      </button>
    </div>
  );
}

export const ContextMenu = memo(ContextMenuComponent);
