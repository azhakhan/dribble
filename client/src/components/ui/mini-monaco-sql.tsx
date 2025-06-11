import { useRef, useEffect, useMemo } from "react";
import * as monaco from "monaco-editor";
import { useAppStore } from "@/shared/store/useAppStore";
import { useTheme } from "@/components/theme-provider";

interface MiniMonacoSQLProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  mode?: "where" | "orderby";
  columns?: Array<{ name: string; type: string }>;
  onEnterPress?: () => void;
}

// Simple cn function for className concatenation
const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(" ");
};

export function MiniMonacoSQL({
  value,
  onChange,
  className,
  disabled = false,
  mode = "where",
  columns = [],
  onEnterPress
}: MiniMonacoSQLProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined);

  // Get schema data from the store
  const { selectedSource, sourceSchemaMap } = useAppStore();

  // Get theme from context
  const { theme } = useTheme();

  // Helper to determine Monaco theme based on app theme
  const getMonacoTheme = (): string => {
    const isDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    return isDark ? "vs-dark" : "vs";
  };

  // Memoize completions to prevent recalculation
  const completions = useMemo(() => {
    const completionItems: Omit<monaco.languages.CompletionItem, "range">[] = [];

    // Add provided column completions (highest priority)
    if (columns && columns.length > 0) {
      columns.forEach((column) => {
        completionItems.push({
          label: column.name,
          kind: monaco.languages.CompletionItemKind.Field,
          detail: `column (${column.type})`,
          insertText: column.name,
          sortText: `1_${column.name}`
        });
      });
    } else if (selectedSource && sourceSchemaMap[selectedSource.id]) {
      // Fallback to schema columns if no specific columns provided
      const schemas = sourceSchemaMap[selectedSource.id];

      // Add table completions
      Object.entries(schemas).forEach(([schemaName, schemaObject]) => {
        Object.keys(schemaObject.tables).forEach((tableName) => {
          completionItems.push({
            label: tableName,
            kind: monaco.languages.CompletionItemKind.Class,
            detail: `table (${schemaName})`,
            insertText: tableName,
            sortText: `2_${tableName}`
          });
        });

        // Add view completions
        Object.keys(schemaObject.views).forEach((viewName) => {
          completionItems.push({
            label: viewName,
            kind: monaco.languages.CompletionItemKind.Interface,
            detail: `view (${schemaName})`,
            insertText: viewName,
            sortText: `2_${viewName}`
          });
        });
      });

      // Add column completions from schema (lower priority)
      Object.values(schemas).forEach((schemaObject) => {
        Object.values(schemaObject.tables).forEach((tableData) => {
          tableData.columns.forEach((column) => {
            completionItems.push({
              label: column.name,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: `column (${column.type})`,
              insertText: column.name,
              sortText: `3_${column.name}`
            });
          });
        });
      });
    }

    // Add SQL keywords based on mode
    const whereKeywords = [
      "AND",
      "OR",
      "NOT",
      "IN",
      "EXISTS",
      "LIKE",
      "ILIKE",
      "BETWEEN",
      "IS",
      "NULL",
      "TRUE",
      "FALSE"
    ];
    const orderByKeywords = ["ASC", "DESC", "NULLS", "FIRST", "LAST"];

    const keywords = mode === "where" ? whereKeywords : orderByKeywords;
    keywords.forEach((keyword) => {
      completionItems.push({
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        detail: "SQL keyword",
        insertText: keyword,
        sortText: `0_${keyword}`
      });
    });

    return completionItems;
  }, [columns, selectedSource, sourceSchemaMap, mode]);

  // Register completion provider for basic SQL
  useEffect(() => {
    if (!editorRef.current || completions.length === 0) return;

    const disposable = monaco.languages.registerCompletionItemProvider("sql", {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        return {
          suggestions: completions.map((completion) => ({
            ...completion,
            range
          }))
        };
      }
    });

    return () => disposable.dispose();
  }, [completions]);

  // Initialize editor once
  useEffect(() => {
    if (hostRef.current && !editorRef.current) {
      editorRef.current = monaco.editor.create(hostRef.current, {
        language: "sql", // Use basic SQL language, not monaco-sql-languages
        theme: getMonacoTheme(),
        value: value,
        minimap: { enabled: false },
        fontSize: 12,
        lineHeight: 18, // Slightly smaller to fit in 24px container with padding
        wordWrap: "off",
        automaticLayout: true,
        scrollBeyondLastLine: false,
        readOnly: disabled,
        lineNumbers: "off",
        glyphMargin: false,
        folding: false,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
        contextmenu: false,
        scrollbar: {
          vertical: "hidden",
          horizontal: "hidden",
          verticalScrollbarSize: 0,
          horizontalScrollbarSize: 0
        },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        overviewRulerBorder: false,
        // Fixed positioning and padding
        padding: { top: 3, bottom: 3 },
        fixedOverflowWidgets: true,
        // Disable all validation and error checking
        renderValidationDecorations: "off",
        // Remove borders and outlines
        renderLineHighlight: "none",
        renderWhitespace: "none",
        // Autocomplete options
        quickSuggestions: {
          other: true,
          comments: false,
          strings: false
        },
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnCommitCharacter: true,
        acceptSuggestionOnEnter: "on",
        wordBasedSuggestions: false,
        suggest: {
          showKeywords: true,
          showSnippets: false,
          showFunctions: true,
          localityBonus: true,
          insertMode: "replace"
        }
      });

      // Handle Enter key to execute query instead of new line
      editorRef.current.onKeyDown((e) => {
        if (e.keyCode === monaco.KeyCode.Enter) {
          e.preventDefault();
          e.stopPropagation();

          // Execute the query
          if (onEnterPress) {
            console.log("Enter pressed, calling onEnterPress");
            onEnterPress();
          }
        }
      });

      // Listen for content changes
      editorRef.current.onDidChangeModelContent(() => {
        const newValue = editorRef.current?.getValue() || "";
        onChange(newValue);
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = undefined;
      }
    };
  }, []);

  // Handle theme changes
  useEffect(() => {
    if (editorRef.current) {
      monaco.editor.setTheme(getMonacoTheme());
    }
  }, [theme]);

  // Handle value changes from outside
  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  // Handle readOnly changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: disabled });
    }
  }, [disabled]);

  return (
    <div
      className={cn(
        "relative border-none  overflow-hidden",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      style={{
        height: "24px",
        width: "160px"
      }}
      onClick={() => {
        // Ensure editor gets focus when container is clicked
        if (editorRef.current && !disabled) {
          editorRef.current.focus();
        }
      }}
    >
      {/* Monaco editor container */}
      <div
        ref={hostRef}
        className="absolute inset-0 [&_.monaco-editor]:!border-none [&_.monaco-editor_.monaco-editor-background]:!border-none [&_.monaco-editor_.inputarea]:!border-none [&_.monaco-editor_.inputarea]:!outline-none [&_.monaco-editor_.view-overlays]:!border-none [&_.monaco-editor_.margin]:!border-none"
        style={{
          height: "24px"
        }}
      />
    </div>
  );
}
