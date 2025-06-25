import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, useMemo, memo } from "react";

function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(" ");
}

export interface VirtualizedTableRow {
  id: string | number;
  [key: string]: unknown;
}

export interface VirtualizedTableColumn {
  key: string;
  title: string;
  width?: number;
  render?: (value: unknown, row: VirtualizedTableRow) => React.ReactNode;
}

interface VirtualizedTableProps {
  data: VirtualizedTableRow[];
  columns: VirtualizedTableColumn[];
  rowHeight?: number;
  overscanCount?: number;
  className?: string;
  onRowClick?: (row: VirtualizedTableRow) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

const VirtualizedTableComponent = ({
  data,
  columns,
  rowHeight = 35,
  overscanCount = 5,
  className,
  onRowClick,
  isLoading = false,
  emptyMessage = "No data available"
}: VirtualizedTableProps) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: overscanCount
  });

  const items = virtualizer.getVirtualItems();

  // Memoize column calculations
  const totalWidth = useMemo(() => {
    return columns.reduce((acc, col) => acc + (col.width || 200), 0);
  }, [columns]);

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("h-full w-full overflow-hidden", className)}>
      {/* Header */}
      <div className="flex border-b bg-muted/50 font-medium text-xs" style={{ width: totalWidth }}>
        {columns.map((column) => (
          <div
            key={column.key}
            className="px-3 py-2 border-r last:border-r-0 text-left truncate"
            style={{ width: column.width || 200 }}
          >
            {column.title}
          </div>
        ))}
      </div>

      {/* Virtualized Body */}
      <div
        ref={parentRef}
        className="h-full w-full overflow-auto"
        style={{
          height: `calc(100% - ${rowHeight}px)` // Account for header height
        }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: totalWidth,
            position: "relative"
          }}
        >
          {items.map((virtualItem) => {
            const row = data[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                className={cn(
                  "absolute top-0 left-0 w-full flex border-b hover:bg-muted/50 text-xs",
                  onRowClick && "cursor-pointer"
                )}
                style={{
                  height: virtualItem.size,
                  transform: `translateY(${virtualItem.start}px)`
                }}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <div
                    key={column.key}
                    className="px-3 py-2 border-r last:border-r-0 flex items-center truncate"
                    style={{ width: column.width || 200 }}
                    title={String(row[column.key] || "")}
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : String(row[column.key] || "")}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const VirtualizedTable = memo(VirtualizedTableComponent);
