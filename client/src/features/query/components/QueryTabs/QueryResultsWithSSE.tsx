import { memo, useEffect } from "react";
import { QueryResults } from "../QueryResults";
import { useQueryStream } from "@/shared/hooks/useQueryStreamHook";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { convertToTableData } from "@/shared/utils/typeUtils";
import { errorToTableData } from "@/shared/utils/errorUtils";
import type { TableData } from "@/shared/types/api";

interface QueryResultsWithSSEProps {
  tabId: string;
  queryId: string | null;
  queryResults: TableData | null;
  isQueryRunning: boolean;
}

const QueryResultsWithSSEComponent = ({
  tabId,
  queryId,
  queryResults,
  isQueryRunning
}: QueryResultsWithSSEProps) => {
  const { updateTabContent } = useTabManagerStore();

  // Use SSE hook to get real-time updates
  const { result, isRunning } = useQueryStream(queryId || "", {
    enabled: !!queryId && isQueryRunning,
    onStatusChange: (status) => {
      if (status === "running") {
        updateTabContent(tabId, { queryRunning: true });
      }
    },
    onSuccess: (data) => {
      updateTabContent(tabId, {
        queryRunning: false,
        queryRunId: null,
        queryResults: convertToTableData(data)
      });
    },
    onError: (error) => {
      updateTabContent(tabId, {
        queryRunning: false,
        queryRunId: null,
        queryResults: errorToTableData(error)
      });
    }
  });

  // Sync SSE result with tab state when status changes
  useEffect(() => {
    if (result && queryId) {
      if (result.status === "cancelled") {
        updateTabContent(tabId, {
          queryRunning: false,
          queryRunId: null,
          queryResults: errorToTableData(result.error || "Query execution was cancelled")
        });
      }
    }
  }, [result, queryId, tabId, updateTabContent]);

  // Use SSE-derived running state if we have an active query
  const actualIsRunning = queryId ? isRunning : isQueryRunning;

  return (
    <QueryResults tableData={null} queryResults={queryResults} isQueryRunning={actualIsRunning} />
  );
};

export const QueryResultsWithSSE = memo(QueryResultsWithSSEComponent);
