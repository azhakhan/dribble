import { EditableTable } from "@/elements/EditableTable";
import { useQueryQuery } from "@/hooks/useQueryQuery";

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
  isQueryRunning = false,
}: TableDataDisplayProps) => {
  // Fetch table data when a table is selected (and no query results are available)
  const { data: tableQueryResults, isLoading: isTableLoading } = useQueryQuery(
    tableData?.sourceId || "",
    tableData && !queryResults
      ? `SELECT * FROM ${tableData.tableName} LIMIT 101`
      : "",
    { enabled: !!tableData && !queryResults },
  );

  // Determine what data to display and loading state
  const displayData = queryResults || tableQueryResults;
  const isLoading = isQueryRunning || isTableLoading;

  // Determine the title to show
  const title = tableData
    ? tableData.tableName
    : queryResults
      ? "Query Results"
      : "";

  return (
    <div className="h-full">
      {tableData || queryResults ? (
        <div className="h-full flex flex-col">
          <div className="p-2 font-semibold border-b">{title}</div>
          <div className="flex-1">
            <EditableTable
              data={displayData as Record<string, unknown>[]}
              isLoading={isLoading}
            />
          </div>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-400">
          Double-click on a table in the file tree to view data or run a SQL
          query
        </div>
      )}
    </div>
  );
};
