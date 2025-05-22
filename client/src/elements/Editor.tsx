import { useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import type { Source } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PlayIcon } from "lucide-react";
import { executeQuery } from "@/lib/api";
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
  onQueryStatusChange,
}: EditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [sqlContent, setSqlContent] = useState<string>(
    "-- Write your SQL query here\n",
  );
  const [isRunning, setIsRunning] = useState(false);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setSqlContent(value);
    }
  };

  const isEditorActive = selectedSource && !schemasLoading && !schemasError;

  const handleRunQuery = async () => {
    if (!selectedSource || !sqlContent.trim()) return;

    setIsRunning(true);
    if (onQueryStatusChange) {
      onQueryStatusChange(true);
    }

    try {
      const results = await executeQuery(selectedSource.id, sqlContent);

      // Send results to parent component
      if (onQueryExecution) {
        onQueryExecution(results);
      }

      toast.success("Query executed successfully");
    } catch (error) {
      console.error("Query execution failed:", error);
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
        <Button
          onClick={handleRunQuery}
          disabled={!isEditorActive || isRunning}
          className="gap-1"
        >
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
            readOnly: !isEditorActive,
          }}
        />
      </div>
    </div>
  );
}
