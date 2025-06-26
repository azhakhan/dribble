import { memo } from "react";
import { TableDataDisplayOptimized } from "@/features/tables/TableDataDisplayOptimized";
import type { TableData } from "@/shared/types/api";

interface ResultsTableProps {
  tableData?: {
    sourceId: string;
    tableName: string;
  } | null;
  queryResults?: TableData | null;
  isQueryRunning: boolean;
}

function ResultsTableComponent({ tableData, queryResults, isQueryRunning }: ResultsTableProps) {
  return (
    <TableDataDisplayOptimized
      tableData={tableData || null}
      queryResults={queryResults}
      isQueryRunning={isQueryRunning}
      useVirtualization={false}
      virtualizationThreshold={1000}
    />
  );
}

export const ResultsTable = memo(ResultsTableComponent);
