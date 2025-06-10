import { EditableTable } from "@/features/tables/EditableTable";
import { TableFilterBar } from "@/features/tables/TableFilterBar";

interface TableDataDisplayProps {
  tableData: {
    sourceId: string;
    tableName: string;
  } | null;
  queryResults?: object[] | null;
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
          <TableFilterBar data={displayData as object[]} isLoading={isLoading} />

          {/* Scrollable content */}
          <div className="flex-1 min-h-0">
            <EditableTable data={displayData as Record<string, unknown>[]} isLoading={isLoading} />
          </div>
        </>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-400">
          Double-click on a table in the file tree to view data or run a SQL query
        </div>
      )}
    </div>
  );
};
