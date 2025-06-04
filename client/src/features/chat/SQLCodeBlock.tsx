import { useEffect, useRef, useCallback } from "react";
import * as monaco from "monaco-editor";
import { LanguageIdEnum } from "@/shared/lib/monaco-setup";
import { useTheme } from "@/components/theme-provider";

interface SQLCodeBlockProps {
  code: string;
}

export function SQLCodeBlock({ code }: SQLCodeBlockProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined);

  // Get theme from context
  const { theme } = useTheme();

  // Helper to determine Monaco theme based on app theme
  const getMonacoTheme = useCallback((): string => {
    const isDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    return isDark ? "vs-dark" : "vs";
  }, [theme]);

  // Helper to get background color based on theme
  const getBackgroundColor = (): string => {
    const isDark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    return isDark ? "#1e1e1e" : "#f8f8f8";
  };

  // Initialize editor once
  useEffect(() => {
    if (hostRef.current && !editorRef.current) {
      editorRef.current = monaco.editor.create(hostRef.current, {
        language: LanguageIdEnum.MYSQL,
        theme: getMonacoTheme(),
        value: code,
        minimap: { enabled: false },
        fontSize: 12,
        wordWrap: "on",
        scrollBeyondLastLine: false,
        readOnly: true,
        lineNumbers: "off",
        folding: false,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
        glyphMargin: false,
        renderLineHighlight: "none",
        contextmenu: false,
        scrollbar: {
          vertical: "auto",
          horizontal: "auto",
          verticalScrollbarSize: 8,
          horizontalScrollbarSize: 8
        },
        padding: {
          top: 12,
          bottom: 12
        },
        automaticLayout: true
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
  }, [theme, getMonacoTheme]);

  // Handle value changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== code) {
      editorRef.current.setValue(code);
    }
  }, [code]);

  // Adjust height based on content
  useEffect(() => {
    if (editorRef.current && hostRef.current) {
      const lineCount = editorRef.current.getModel()?.getLineCount() || 1;
      const lineHeight = editorRef.current.getOption(monaco.editor.EditorOption.lineHeight);
      const height = Math.min(lineCount * lineHeight + 24, 300); // Max height 300px, added more padding
      hostRef.current.style.height = `${height}px`;
      hostRef.current.style.width = "100%";
      editorRef.current.layout();
    }
  }, [code]);

  return (
    <div
      ref={hostRef}
      className="w-full rounded overflow-hidden my-2"
      style={{
        minWidth: "100%",
        backgroundColor: getBackgroundColor(),
        padding: "8px 12px",
        borderRadius: "4px"
      }}
    />
  );
}
