import { EditableTable } from "@/features/tables/EditableTable";
import { TableFilterBar } from "@/features/tables/TableFilterBar";
import { Capybara } from "@/components/Capybara";
import type { TableData } from "@/shared/types/api";

interface TableDataDisplayProps {
  tableData: {
    sourceId: string;
    tableName: string;
  } | null;
  queryResults?: TableData | null;
  isQueryRunning?: boolean;
}

export const TableDataDisplay = ({
  tableData,
  queryResults,
  isQueryRunning = false
}: TableDataDisplayProps) => {
  // Determine what data to display and loading state
  const displayData = queryResults;
  const isLoading = isQueryRunning;

  return (
    <div className="h-full flex flex-col">
      {tableData || queryResults ? (
        <>
          {/* Filter bar with title */}
          <TableFilterBar data={displayData || null} isLoading={isLoading} />

          {/* Scrollable content */}
          <div className="flex-1 min-h-0">
            <EditableTable data={displayData || undefined} isLoading={isLoading} />
          </div>
        </>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-gray-400">
          <Capybara />
        </div>
      )}
    </div>
  );
};
