import { memo } from "react";
import { TableDataDisplay } from "@/features/tables/TableDataDisplay";
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
    <TableDataDisplay
      tableData={tableData || null}
      queryResults={queryResults}
      isQueryRunning={isQueryRunning}
    />
  );
}

export const ResultsTable = memo(ResultsTableComponent);
