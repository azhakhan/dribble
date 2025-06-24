import { useState, useCallback, useMemo } from "react";
import { useQueryStore } from "@/shared/store";

export function useQueryExecution(queryId: string | undefined) {
  const [showRuns, setShowRuns] = useState(false);

  const { queryRuns, loadingRuns, loadQueryRuns } = useQueryStore();

  // Get runs for this query from the store
  const runs = useMemo(() => (queryId ? queryRuns[queryId] || [] : []), [queryId, queryRuns]);

  const isLoadingRuns = queryId ? loadingRuns.has(queryId) : false;

  // Get the latest run for status display
  const latestRun = useMemo(() => {
    if (!runs || !Array.isArray(runs) || runs.length === 0) return null;
    const latest = runs.reduce((latest, current) =>
      new Date(current.created_at) > new Date(latest.created_at) ? current : latest
    );
    return latest;
  }, [runs]);

  // Handle showing runs
  const handleShowRuns = useCallback(() => {
    setShowRuns(!showRuns);
  }, [showRuns]);

  // Load query runs
  const loadRuns = useCallback(
    (force?: boolean) => {
      if (queryId) {
        loadQueryRuns(queryId, force);
      }
    },
    [queryId, loadQueryRuns]
  );

  return {
    showRuns,
    setShowRuns,
    runs,
    latestRun,
    isLoadingRuns,
    handleShowRuns,
    loadRuns
  };
}
