import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import { LanguageIdEnum } from "@/shared/lib/monaco-setup";

interface SQLCodeBlockProps {
  code: string;
}

export function SQLCodeBlock({ code }: SQLCodeBlockProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined);

  // Initialize editor once
  useEffect(() => {
    if (hostRef.current && !editorRef.current) {
      editorRef.current = monaco.editor.create(hostRef.current, {
        language: LanguageIdEnum.MYSQL,
        theme: "vs-dark",
        value: code,
        minimap: { enabled: false },
        fontSize: 10,
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
        }
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = undefined;
      }
    };
  }, []);

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
      const height = Math.min(lineCount * lineHeight + 12, 300); // Max height 300px
      hostRef.current.style.height = `${height}px`;
      editorRef.current.layout();
    }
  }, [code]);

  return <div ref={hostRef} className="w-full rounded overflow-hidden my-2" />;
}
