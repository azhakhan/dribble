import { useState, useEffect } from "react";
import { getQueryRunsByQueryId, type QueryRun } from "@/shared/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon } from "lucide-react";

interface QueryRunsProps {
  queryId: string;
  onBack: () => void;
}

export function QueryRuns({ queryId, onBack }: QueryRunsProps) {
  const [runs, setRuns] = useState<QueryRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRuns = async () => {
      setLoading(true);
      try {
        const queryRuns = await getQueryRunsByQueryId(queryId);
        setRuns(queryRuns);
      } catch (error) {
        console.error("Failed to load runs:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRuns();
  }, [queryId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading runs...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-2 p-3 border-b">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-xs">
          <ArrowLeftIcon size={14} />
          Back to Editor
        </Button>
        <span className="text-sm font-medium">Query Runs ({runs.length})</span>
      </div>

      {/* Runs Table */}
      <div className="flex-1 overflow-auto p-3">
        <div className="border rounded-md">
          <div className="grid grid-cols-6 gap-4 p-3 font-medium border-b bg-muted/50 text-sm">
            <div>Run ID</div>
            <div>Result Message</div>
            <div>Error Message</div>
            <div>Row Count</div>
            <div>Execution Time (ms)</div>
            <div>Created At</div>
          </div>
          {runs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No runs found for this query
            </div>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="grid grid-cols-6 gap-4 p-3 border-b text-sm">
                <div className="font-mono text-xs truncate">{run.id}</div>
                <div className="truncate">{run.result_message || "-"}</div>
                <div className="truncate text-red-600">{run.error_message || "-"}</div>
                <div>{run.row_count ?? "-"}</div>
                <div>{run.execution_time_ms ?? "-"}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(run.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
