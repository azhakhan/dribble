import { memo } from "react";
import { ResultsTable } from "./ResultsTable";
import { ResultsPagination } from "./ResultsPagination";
import type { TableData } from "@/shared/types/api";

interface QueryResultsProps {
  tableData?: {
    sourceId: string;
    tableName: string;
  } | null;
  queryResults?: TableData | null;
  isQueryRunning: boolean;
}

function QueryResultsComponent({ tableData, queryResults, isQueryRunning }: QueryResultsProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <ResultsTable
          tableData={tableData}
          queryResults={queryResults}
          isQueryRunning={isQueryRunning}
        />
      </div>

      {(queryResults || tableData) && (
        <div className="flex-shrink-0">
          <ResultsPagination />
        </div>
      )}
    </div>
  );
}

export const QueryResults = memo(QueryResultsComponent);
