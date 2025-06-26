import "@glideapps/glide-data-grid/dist/index.css";

import { DataEditor } from "@glideapps/glide-data-grid";
import { memo } from "react";
import type { ColumnDefinition, TableData } from "@/shared/types/api";
import { useTableData } from "./hooks/useTableData";
import { useTableSelection } from "./hooks/useTableSelection";
import { useTableEditing } from "./hooks/useTableEditing";

interface EditableTableProps {
  data?: TableData;
  columns?: ColumnDefinition[];
  isLoading?: boolean;
  tableId?: string; // Unique identifier for this table
  source?: string; // Optional source identifier
  schema?: string; // Optional schema identifier
}

const EditableTableComponent = ({
  data: queryData,
  columns: providedColumns,
  isLoading,
  tableId = "default",
  source,
  schema
}: EditableTableProps) => {
  // Hook for managing column sizes
  const { columnSizes, handleColumnResize } = useTableSelection({
    tableId,
    source,
    schema,
    data: queryData || []
  });

  // Hook for data processing and column definitions
  const { processedData, columns, dataIndexes } = useTableData({
    data: queryData,
    columns: providedColumns,
    columnSizes
  });

  // Hook for editing and theming
  const { customHeaderIcons, getGlideTheme, getCellContent } = useTableEditing({
    data: processedData,
    dataIndexes
  });

  if (isLoading) {
    return <div className="h-full w-full flex items-center justify-center">Loading data...</div>;
  }

  return (
    <DataEditor
      columns={columns}
      headerIcons={customHeaderIcons}
      getCellContent={getCellContent}
      rows={processedData.length}
      theme={getGlideTheme}
      width="100%"
      height="100%"
      smoothScrollX
      smoothScrollY
      rowHeight={30}
      onColumnResize={handleColumnResize}
      rowMarkers="number"
    />
  );
};

// Export memoized component
export const EditableTable = memo(EditableTableComponent);
