import { EditableTable } from "@/elements/EditableTable";
import { useQueryQuery } from "@/hooks/useQueryQuery";

interface TableDataDisplayProps {
  tableData: {
    sourceId: string;
    tableName: string;
  } | null;
}

export const TableDataDisplay = ({ tableData }: TableDataDisplayProps) => {
  // Fetch table data when a table is selected
  const { data: queryResults, isLoading } = useQueryQuery(
    tableData?.sourceId || "",
    tableData ? `SELECT * FROM ${tableData.tableName} LIMIT 101` : "",
    { enabled: !!tableData }
  );

  return (
    <div className="h-full">
      {tableData ? (
        <div className="h-full flex flex-col">
          <div className="p-2 font-semibold border-b">
            {tableData.tableName}
          </div>
          <div className="flex-1">
            <EditableTable
              data={queryResults as Record<string, unknown>[]}
              isLoading={isLoading}
            />
          </div>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-400">
          Double-click on a table in the file tree to view data
        </div>
      )}
    </div>
  );
};
