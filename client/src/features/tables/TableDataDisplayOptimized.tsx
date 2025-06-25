import { memo } from "react";
import { EditableTable } from "@/features/tables/components/EditableTable";
import { VirtualizedTable } from "@/components/VirtualizedTable";
import { TableFilterBar } from "@/features/tables/TableFilterBar";
import { Capybara } from "@/components/Capybara";
import { useTableFilterStore } from "@/shared/store/useTableFilterStore";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import type { TableData } from "@/shared/types/api";

interface TableDataDisplayOptimizedProps {
  tableData: {
    sourceId: string;
    tableName: string;
  } | null;
  queryResults?: TableData | null;
  isQueryRunning?: boolean;
  useVirtualization?: boolean; // New prop to control virtualization
  virtualizationThreshold?: number; // Threshold for when to use virtualization
}

const TableDataDisplayOptimizedComponent = ({
  tableData,
  queryResults,
  isQueryRunning = false,
  useVirtualization = false,
  virtualizationThreshold = 1000
}: TableDataDisplayOptimizedProps) => {
  const { activeTabId } = useTabManagerStore();
  const { getTabFilterState } = useTableFilterStore();

  // Get the current tab's filter state to determine display size
  const tabId = activeTabId || "default";
  const { displaySize } = getTabFilterState(tabId);

  // Keep full data for pagination logic, but slice for display
  const fullData = queryResults; // Full data for pagination calculations
  let displayData = queryResults;

  // Limit the displayed data to displaySize if results exceed it
  // This ensures we don't show the extra +1 record to users
  if (displayData && displayData.length > displaySize) {
    displayData = displayData.slice(0, displaySize);
  }

  const isLoading = isQueryRunning;

  // Auto-enable virtualization for large datasets (use display data for this check)
  const shouldUseVirtualization =
    useVirtualization || (displayData && displayData.length > virtualizationThreshold);

  if (!tableData && !queryResults) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400">
        <Capybara />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filter bar with title - pass full data for correct pagination logic */}
      <TableFilterBar data={fullData || null} isLoading={isLoading} />

      {/* Scrollable content - use sliced data for display */}
      <div className="flex-1 min-h-0">
        {shouldUseVirtualization && displayData && displayData.length > 0 ? (
          // Use virtualized table for large datasets
          <VirtualizedTable
            data={displayData.map((row, index) => ({ id: index, ...row }))}
            columns={Object.keys(displayData[0] || {}).map((key) => ({
              key,
              title: key,
              width: 200
            }))}
            rowHeight={30}
            overscanCount={10}
            isLoading={isLoading}
            emptyMessage="No data available"
          />
        ) : (
          // Use optimized regular table for smaller datasets
          <EditableTable
            data={displayData || undefined}
            isLoading={isLoading}
            tableId={tableData?.tableName || "default"}
            source={tableData?.sourceId}
          />
        )}
      </div>
    </div>
  );
};

export const TableDataDisplayOptimized = memo(TableDataDisplayOptimizedComponent);
