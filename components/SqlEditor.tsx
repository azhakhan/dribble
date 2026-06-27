"use client";

import Editor, { type Monaco } from "@monaco-editor/react";
import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  height?: number;
}

function setupTheme(monaco: Monaco) {
  monaco.editor.defineTheme("dbide-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword.sql", foreground: "e8a14c", fontStyle: "bold" },
      { token: "string.sql", foreground: "7fb069" },
      { token: "number.sql", foreground: "58b8aa" },
      { token: "comment.sql", foreground: "5d6678", fontStyle: "italic" },
      { token: "operator.sql", foreground: "9aa3b5" },
    ],
    colors: {
      "editor.background": "#15181e",
      "editor.foreground": "#d7dbe4",
      "editor.lineHighlightBackground": "#1b1f27",
      "editorLineNumber.foreground": "#3a4254",
      "editorLineNumber.activeForeground": "#9aa3b5",
      "editorCursor.foreground": "#e8a14c",
      "editor.selectionBackground": "#2c3342",
      "editorWidget.background": "#1b1f27",
      "editorSuggestWidget.background": "#1b1f27",
    },
  });
}

export default function SqlEditor({ value, onChange, onRun, height = 80 }: Props) {
  const onRunRef = useRef(onRun);

  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  return (
    <Editor
      height={height}
      language="sql"
      theme="dbide-dark"
      value={value}
      beforeMount={setupTheme}
      onMount={(editor, monaco) => {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current?.());
      }}
      onChange={(v) => onChange(v ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "JetBrains Mono, ui-monospace, monospace",
        lineNumbers: "on",
        lineNumbersMinChars: 3,
        scrollBeyondLastLine: false,
        scrollbar: { vertical: "auto", horizontal: "auto", verticalScrollbarSize: 9 },
        renderLineHighlight: "none",
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        folding: false,
        wordWrap: "on",
        padding: { top: 8, bottom: 8 },
        automaticLayout: true,
        fixedOverflowWidgets: true,
      }}
    />
  );
}
