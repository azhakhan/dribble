import { useRef, useState, useEffect } from "react";
import type { Source } from "@/shared/lib/api";
import { Button } from "@/components/ui/button";
import { PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { useQueryQuery } from "@/shared/hooks/useQueryQuery";
import { useAppStore } from "@/shared/store/useAppStore";
import { LanguageIdEnum } from "@/shared/lib/monaco-setup";
import { MonacoSQLEditor } from "./MonacoSQLEditor";
import { MonacoDiffEditor } from "./MonacoDiffEditor";
import { ProposedChangesBar } from "./ProposedChangesBar";

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
  const [isRunning, setIsRunning] = useState(false);
  const [activeQuery, setActiveQuery] = useState<{ sourceId: string; sql: string } | null>(null);

  // Get editor content and proposed changes from appStore
  const {
    editorContent,
    setEditorContent,
    proposedChanges,
    acceptProposedChanges,
    rejectProposedChanges
  } = useAppStore();

  // Helper to map dbtype to Monaco language
  function getMonacoLanguage(dbtype?: string): string {
    if (!dbtype) return LanguageIdEnum.MYSQL;
    switch (dbtype.toLowerCase()) {
      case "postgres":
        return LanguageIdEnum.PG;
      case "mysql":
        return LanguageIdEnum.MYSQL;
      // Add more mappings if needed
      default:
        return LanguageIdEnum.MYSQL;
    }
  }

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

  const isEditorActive = selectedSource && !schemasLoading && !schemasError;

  const handleRunQuery = (sqlToRun?: string) => {
    if (!selectedSource) return;

    const queryToRun =
      sqlToRun || (proposedChanges ? proposedChanges.proposedContent : editorContent);
    if (!queryToRun.trim()) return;

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
      sql: queryToRun
    });
  };

  return (
    <div ref={editorContainerRef} className="h-full flex flex-col">
      {/* Fixed header with run button only */}
      <div className="flex-shrink-0 flex justify-end items-center gap-2 p-2 border-b">
        <Button
          onClick={() => handleRunQuery()}
          disabled={!isEditorActive || isRunning}
          className="gap-1"
        >
          <PlayIcon size={16} />
          Run SQL
        </Button>
      </div>
      {/* Scrollable editor content */}
      <div className="flex-1 min-h-0 relative">
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

        {/* Show diff editor if there are proposed changes, otherwise show regular editor */}
        {proposedChanges ? (
          <MonacoDiffEditor
            originalContent={proposedChanges.originalContent}
            proposedContent={proposedChanges.proposedContent}
            language={getMonacoLanguage(selectedSource?.dbtype)}
            readOnly={true}
          />
        ) : (
          <MonacoSQLEditor
            value={editorContent}
            onChange={setEditorContent}
            language={getMonacoLanguage(selectedSource?.dbtype)}
            readOnly={!isEditorActive}
          />
        )}
      </div>

      {/* Show accept/reject bar when there are proposed changes */}
      {proposedChanges && (
        <ProposedChangesBar onAccept={acceptProposedChanges} onReject={rejectProposedChanges} />
      )}
    </div>
  );
}
