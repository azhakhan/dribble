import { memo } from "react";
import { EditableTable } from "@/features/tables/components/EditableTable";
import { VirtualizedTable } from "@/components/VirtualizedTable";
import { TableFilterBar } from "@/features/tables/TableFilterBar";
import { Capybara } from "@/components/Capybara";
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
  // Determine what data to display and loading state
  const displayData = queryResults;
  const isLoading = isQueryRunning;

  // Auto-enable virtualization for large datasets
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
      {/* Filter bar with title */}
      <TableFilterBar data={displayData || null} isLoading={isLoading} />

      {/* Scrollable content */}
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
