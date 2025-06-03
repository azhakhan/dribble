import { useRef, useState, useEffect } from "react";
import type { Source } from "@/shared/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { useQueryQuery } from "@/shared/hooks/useQueryQuery";
import { useAppStore } from "@/shared/store/useAppStore";
import { LanguageIdEnum, getAvailableSQLDialects } from "@/shared/lib/monaco-setup";
import { MonacoSQLEditor } from "./MonacoSQLEditor";

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
  const [selectedDialect, setSelectedDialect] = useState<string>(LanguageIdEnum.MYSQL);

  // Get available SQL dialects
  const availableDialects = getAvailableSQLDialects();

  // Get editor content from appStore
  const { editorContent, setEditorContent } = useAppStore();

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

  const handleEditorChange = (value: string) => {
    setEditorContent(value);
  };

  const handleDialectChange = (value: string) => {
    setSelectedDialect(value);
  };

  const isEditorActive = selectedSource && !schemasLoading && !schemasError;

  const handleRunQuery = () => {
    if (!selectedSource || !editorContent.trim()) return;

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
      sql: editorContent
    });
  };

  return (
    <div ref={editorContainerRef} className="h-full flex flex-col">
      {/* Fixed header with dialect selector and run button */}
      <div className="flex-shrink-0 flex justify-between items-center gap-2 p-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">SQL Dialect:</span>
          <Select value={selectedDialect} onValueChange={handleDialectChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableDialects.map((dialect) => (
                <SelectItem key={dialect.value} value={dialect.value}>
                  {dialect.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleRunQuery} disabled={!isEditorActive || isRunning} className="gap-1">
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
        <MonacoSQLEditor
          value={editorContent}
          onChange={handleEditorChange}
          language={selectedDialect}
          readOnly={!isEditorActive}
        />
      </div>
    </div>
  );
}
