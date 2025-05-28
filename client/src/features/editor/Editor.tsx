import { useRef, useState, useEffect } from "react";
import MonacoEditor from "@monaco-editor/react";
import type { Source } from "@/shared/lib/api";
import { Button } from "@/components/ui/button";
import { PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { useQueryQuery } from "@/shared/hooks/useQueryQuery";

interface EditorProps {
  selectedSource: Source | null;
  schemasLoading: boolean;
  schemasError?: unknown;
  onQueryExecution?: (results: object[]) => void;
  onQueryStatusChange?: (isRunning: boolean) => void;
}

export function Editor({
  selectedSource,
  schemasLoading,
  schemasError,
  onQueryExecution,
  onQueryStatusChange
}: EditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [sqlContent, setSqlContent] = useState<string>("-- Write your SQL query here\n");
  const [isRunning, setIsRunning] = useState(false);
  const [activeQuery, setActiveQuery] = useState<{ sourceId: string; sql: string } | null>(null);

  // Use the query hook with enabled set to false by default
  // We'll enable it manually when the user clicks the Run button
  const {
    data: queryResults,
    isLoading,
    error: queryError
  } = useQueryQuery(
    activeQuery?.sourceId || "",
    activeQuery?.sql || "",
    {
      enabled: !!activeQuery
    },
    "manual"
  );

  // Reset active query when query completes or errors
  useEffect(() => {
    if (activeQuery && (queryResults || queryError)) {
      setIsRunning(false);
      if (onQueryStatusChange) {
        onQueryStatusChange(false);
      }
      setActiveQuery(null);
    }
  }, [activeQuery, queryResults, queryError, onQueryStatusChange]);

  // Update isRunning state based on loading status
  useEffect(() => {
    if (activeQuery) {
      setIsRunning(isLoading);
      if (onQueryStatusChange) {
        onQueryStatusChange(isLoading);
      }
    }
  }, [isLoading, activeQuery, onQueryStatusChange]);

  // Handle query results when they arrive
  useEffect(() => {
    if (queryResults && onQueryExecution) {
      if (Array.isArray(queryResults) && queryResults.length > 0) {
        onQueryExecution(queryResults);
        toast.success("Query executed successfully");
      } else {
        onQueryExecution([{ message: "Query returned no data" }]);
        toast.info("Query executed but returned no data");
      }
    } else if (queryError && onQueryExecution) {
      onQueryExecution([{ error: "Error executing query" }]);
      toast.error("Failed to retrieve query results");
    }
  }, [queryResults, queryError, onQueryExecution]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setSqlContent(value);
    }
  };

  const isEditorActive = selectedSource && !schemasLoading && !schemasError;

  const handleRunQuery = () => {
    if (!selectedSource || !sqlContent.trim()) return;

    setIsRunning(true);
    if (onQueryStatusChange) {
      onQueryStatusChange(true);
    }

    // Provide initial empty results to indicate query is running
    if (onQueryExecution) {
      onQueryExecution([{ status: "Query running..." }]);
    }

    // Set the active query which will trigger the useQueryQuery hook
    setActiveQuery({
      sourceId: selectedSource.id,
      sql: sqlContent
    });
  };

  return (
    <div ref={editorContainerRef} className="h-full relative flex flex-col">
      {!isEditorActive && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <p className="text-muted-foreground text-sm">
            {!selectedSource
              ? "Select a source to write SQL queries"
              : schemasLoading
                ? "Loading schema..."
                : schemasError
                  ? "Error loading schema"
                  : ""}
          </p>
        </div>
      )}
      <div className="flex justify-end gap-2 p-2 border-b">
        <Button onClick={handleRunQuery} disabled={!isEditorActive || isRunning} className="gap-1">
          <PlayIcon size={16} />
          Run SQL
        </Button>
      </div>
      <div className="flex-grow">
        <MonacoEditor
          height="100%"
          defaultLanguage="sql"
          theme="vs-dark"
          value={sqlContent}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: "on",
            automaticLayout: true,
            scrollBeyondLastLine: false,
            readOnly: !isEditorActive
          }}
        />
      </div>
    </div>
  );
}
