import { useRef, useState } from "react";
import MonacoEditor from "@monaco-editor/react";
import type { Source } from "@/lib/api";

interface EditorProps {
  selectedSource: Source | null;
  schemasLoading: boolean;
  schemasError?: unknown;
}

export function Editor({
  selectedSource,
  schemasLoading,
  schemasError,
}: EditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [sqlContent, setSqlContent] = useState<string>(
    "-- Write your SQL query here\n",
  );

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setSqlContent(value);
    }
  };

  const isEditorActive = selectedSource && !schemasLoading && !schemasError;

  return (
    <div ref={editorContainerRef} className="h-full relative">
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
  );
}
