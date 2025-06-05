import { EditableTable } from "@/features/tables/EditableTable";
import { useQueryQuery } from "@/shared/hooks/useQueryQuery";

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
  // Fetch table data when a table is selected (and no query results are available)
  // Only use the hook if we don't have direct query results
  const { data: tableQueryResults, isLoading: isTableLoading } = useQueryQuery(
    tableData?.sourceId || "",
    tableData && !queryResults ? `SELECT * FROM ${tableData.tableName} LIMIT 101` : "",
    { enabled: !!tableData && !queryResults && !isQueryRunning }
  );

  // Determine what data to display and loading state
  const displayData = queryResults || tableQueryResults;
  const isLoading = isQueryRunning || isTableLoading;

  // Determine the title to show
  const title = tableData ? tableData.tableName : queryResults ? "Query Results" : "";

  return (
    <div className="h-full flex flex-col">
      {tableData || queryResults ? (
        <>
          {/* Fixed header */}
          <div className="flex-shrink-0 p-2 font-semibold text-sm border-b flex items-center justify-between">
            <span>{title}</span>
          </div>

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
