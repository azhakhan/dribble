import { useRef, useEffect, useState } from "react";
import * as monaco from "monaco-editor";

interface MonacoSQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  readOnly?: boolean;
}

export function MonacoSQLEditor({
  value,
  onChange,
  language,
  readOnly = false
}: MonacoSQLEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined);
  const [currentLanguage, setCurrentLanguage] = useState(language);

  // Initialize editor once
  useEffect(() => {
    if (hostRef.current && !editorRef.current) {
      editorRef.current = monaco.editor.create(hostRef.current, {
        language: currentLanguage,
        theme: "vs-dark",
        value: value,
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: "on",
        automaticLayout: true,
        scrollBeyondLastLine: false,
        readOnly: readOnly,
        // Enhanced autocomplete options
        quickSuggestions: {
          other: true,
          comments: false,
          strings: false
        },
        parameterHints: {
          enabled: true
        },
        suggestOnTriggerCharacters: true,
        acceptSuggestionOnCommitCharacter: true,
        acceptSuggestionOnEnter: "on",
        wordBasedSuggestions: "off",
        suggest: {
          showMethods: true,
          showFunctions: true,
          showKeywords: true,
          showSnippets: true,
          showValues: true,
          showOperators: true
        }
      });

      // Listen for content changes
      editorRef.current.onDidChangeModelContent(() => {
        const newValue = editorRef.current?.getValue() || "";
        onChange(newValue);
      });

      if (import.meta.env.DEV) {
        console.log("Direct Monaco editor created with language:", currentLanguage);
      }
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = undefined;
      }
    };
  }, []); // Only run once on mount

  // Handle language changes - matching the working example pattern
  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (model && model.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(model, language);
      setCurrentLanguage(language);
      setTimeout(() => {
        if (import.meta.env.DEV) {
          console.log(
            "Language changed, current is:",
            editorRef.current?.getModel()?.getLanguageId()
          );
        }
      }, 200);
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
