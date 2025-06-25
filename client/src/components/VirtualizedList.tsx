import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, memo } from "react";

function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(" ");
}

export interface VirtualizedListItem {
  id: string | number;
  [key: string]: unknown;
}

interface VirtualizedListProps<T extends VirtualizedListItem> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  overscanCount?: number;
  className?: string;
  isLoading?: boolean;
  emptyMessage?: string;
  onItemClick?: (item: T) => void;
}

const VirtualizedListComponent = <T extends VirtualizedListItem>({
  items,
  renderItem,
  itemHeight = 35,
  overscanCount = 5,
  className,
  isLoading = false,
  emptyMessage = "No items available",
  onItemClick
}: VirtualizedListProps<T>) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: overscanCount
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div ref={parentRef} className={cn("h-full w-full overflow-auto", className)}>
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative"
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              className={cn("absolute top-0 left-0 w-full", onItemClick && "cursor-pointer")}
              style={{
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start}px)`
              }}
              onClick={() => onItemClick?.(item)}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const VirtualizedList = memo(VirtualizedListComponent) as <T extends VirtualizedListItem>(
  props: VirtualizedListProps<T>
) => React.ReactElement;
