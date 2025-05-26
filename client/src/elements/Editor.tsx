import { useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import type { Source } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PlayIcon } from "lucide-react";
import { executeQuery, getQueryResults } from "@/lib/api";
import { toast } from "sonner";

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

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setSqlContent(value);
    }
  };

  const isEditorActive = selectedSource && !schemasLoading && !schemasError;

  // Poll for query results
  const pollQueryResults = async (queryId: string, maxAttempts = 50): Promise<object[]> => {
    if (maxAttempts <= 0) {
      throw new Error("Max polling attempts reached");
    }

    const results = await getQueryResults(queryId);

    // Check if results is an array (query completed)
    if (Array.isArray(results)) {
      return results;
    } else {
      // If not an array, we need to keep polling
      // Errors are handled in the getQueryResults function
      await new Promise((resolve) => setTimeout(resolve, 500));
      return pollQueryResults(queryId, maxAttempts - 1);
    }
  };

  const handleRunQuery = async () => {
    if (!selectedSource || !sqlContent.trim()) return;

    setIsRunning(true);
    if (onQueryStatusChange) {
      onQueryStatusChange(true);
    }

    try {
      // Step 1: Execute query and get query ID
      const queryId = await executeQuery(selectedSource.id, sqlContent);

      // Provide initial empty results to indicate query is running
      if (onQueryExecution) {
        // Send an empty array with a placeholder column so the table doesn't break
        onQueryExecution([{ status: "Query running..." }]);
      }

      try {
        // Step 2: Poll for results
        const results = await pollQueryResults(queryId);

        // Step 3: Send results to parent component
        if (onQueryExecution && results && Array.isArray(results) && results.length > 0) {
          onQueryExecution(results);
          toast.success("Query executed successfully");
        } else if (onQueryExecution) {
          // If we got empty results, provide a meaningful empty state
          onQueryExecution([{ message: "Query returned no data" }]);
          toast.info("Query executed but returned no data");
        }
      } catch {
        // Make sure we show something in the table for errors
        if (onQueryExecution) {
          onQueryExecution([{ error: "Error executing query" }]);
        }

        toast.error("Failed to retrieve query results");
      }
    } catch {
      // Show error in table
      if (onQueryExecution) {
        onQueryExecution([{ error: "Failed to start query execution" }]);
      }

      toast.error("Failed to execute query");
    } finally {
      setIsRunning(false);
      if (onQueryStatusChange) {
        onQueryStatusChange(false);
      }
    }
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
