import { useRef, useEffect, useMemo } from "react";
import * as monaco from "monaco-editor";
import { LanguageIdEnum } from "monaco-sql-languages";
import { useSourceStore } from "@/shared/store";
import { useTheme } from "@/components/theme-provider";

interface MonacoSQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  readOnly?: boolean;
  onRunQuery?: () => void;
}

export function MonacoSQLEditor({
  value,
  onChange,
  language,
  readOnly = false,
  onRunQuery
}: MonacoSQLEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined);

  // Get schema data from the store
  const { selectedSource, sourceSchemaMap } = useSourceStore();

  // Get theme from context
  const { resolvedTheme } = useTheme();

  // Helper to determine Monaco theme based on app theme
  const getMonacoTheme = (): string => {
    return resolvedTheme === "dark" ? "vs-dark" : "vs";
  };

  // Memoize schema completions to prevent recalculation
  const schemaCompletions = useMemo(() => {
    if (!selectedSource || !sourceSchemaMap[selectedSource.id]) {
      return [];
    }

    const schemas = sourceSchemaMap[selectedSource.id];
    const completions: Omit<monaco.languages.CompletionItem, "range">[] = [];

    // Add table completions
    Object.entries(schemas).forEach(([schemaName, schemaObject]) => {
      Object.keys(schemaObject.tables).forEach((tableName) => {
        completions.push({
          label: tableName,
          kind: monaco.languages.CompletionItemKind.Class,
          detail: `table (${schemaName})`,
          insertText: tableName,
          sortText: `1_${tableName}`
        });
      });

      // Add view completions
      Object.keys(schemaObject.views).forEach((viewName) => {
        completions.push({
          label: viewName,
          kind: monaco.languages.CompletionItemKind.Interface,
          detail: `view (${schemaName})`,
          insertText: viewName,
          sortText: `1_${viewName}`
        });
      });
    });

    // Add popular column completions (limit to prevent performance issues)
    const columnSet = new Set<string>();
    Object.values(schemas).forEach((schemaObject) => {
      Object.values(schemaObject.tables).forEach((tableData) => {
        tableData.columns.slice(0, 5).forEach((column) => {
          // Only first 5 columns per table
          if (!columnSet.has(column.name)) {
            columnSet.add(column.name);
            completions.push({
              label: column.name,
              kind: monaco.languages.CompletionItemKind.Field,
              detail: `column (${column.type})`,
              insertText: column.name,
              sortText: `2_${column.name}`
            });
          }
        });
      });
    });

    return completions.slice(0, 30); // Limit total completions
  }, [selectedSource, sourceSchemaMap]);

  // Register completion provider only for SQL languages
  useEffect(() => {
    if (!editorRef.current || schemaCompletions.length === 0) return;
    if (language !== LanguageIdEnum.PG && language !== LanguageIdEnum.MYSQL) return;

    const disposable = monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        return {
          suggestions: schemaCompletions.map((completion) => ({
            ...completion,
            range
          }))
        };
      }
    });

    return () => disposable.dispose();
  }, [language, schemaCompletions]);

  // Store onRunQuery in a ref to avoid stale closure
  const onRunQueryRef = useRef(onRunQuery);
  useEffect(() => {
    onRunQueryRef.current = onRunQuery;
  }, [onRunQuery]);

  // Initialize editor once
  useEffect(() => {
    if (hostRef.current && !editorRef.current) {
      editorRef.current = monaco.editor.create(hostRef.current, {
        language: language,
        theme: getMonacoTheme(),
        value: value,
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: "on",
        automaticLayout: true,
        scrollBeyondLastLine: false,
        readOnly: readOnly,
        // Basic autocomplete options
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
          showSnippets: true,
          showFunctions: true,
          localityBonus: true
        }
      });

      // Add keyboard shortcut handler for Cmd+Enter (or Ctrl+Enter)
      editorRef.current.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        if (onRunQueryRef.current) {
          onRunQueryRef.current();
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
  }, [resolvedTheme]);

  // Handle language changes
  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (model && model.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(model, language);
    }
  }, [language]);

  // Handle value changes from outside
  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  // Handle readOnly changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly });
    }
  }, [readOnly]);

  return <div ref={hostRef} style={{ height: "100%", width: "100%" }} />;
}
