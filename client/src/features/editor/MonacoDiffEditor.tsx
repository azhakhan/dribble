import { useRef, useEffect } from "react";
import * as monaco from "monaco-editor";

interface MonacoDiffEditorProps {
  originalContent: string;
  proposedContent: string;
  language: string;
  readOnly?: boolean;
}

export function MonacoDiffEditor({
  originalContent,
  proposedContent,
  language,
  readOnly = true
}: MonacoDiffEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | undefined>(undefined);

  // Initialize diff editor
  useEffect(() => {
    if (hostRef.current && !diffEditorRef.current) {
      // Create models for original and modified content
      const originalModel = monaco.editor.createModel(
        originalContent,
        language,
        monaco.Uri.parse("inmemory://original.sql")
      );
      const modifiedModel = monaco.editor.createModel(
        proposedContent,
        language,
        monaco.Uri.parse("inmemory://modified.sql")
      );

      diffEditorRef.current = monaco.editor.createDiffEditor(hostRef.current, {
        theme: "vs-dark",
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: "on",
        automaticLayout: true,
        scrollBeyondLastLine: false,
        readOnly: readOnly,
        renderSideBySide: false,
        ignoreTrimWhitespace: false,
        renderWhitespace: "boundary",
        diffCodeLens: true,
        diffWordWrap: "on",
        originalEditable: false
      });

      diffEditorRef.current.setModel({
        original: originalModel,
        modified: modifiedModel
      });
    }

    return () => {
      if (diffEditorRef.current) {
        const model = diffEditorRef.current.getModel();
        if (model) {
          model.original?.dispose();
          model.modified?.dispose();
        }
        diffEditorRef.current.dispose();
        diffEditorRef.current = undefined;
      }
    };
  }, []);

  // Update models when content changes
  useEffect(() => {
    if (diffEditorRef.current) {
      const model = diffEditorRef.current.getModel();
      if (model) {
        // Update original model
        if (model.original && model.original.getValue() !== originalContent) {
          model.original.setValue(originalContent);
        }
        // Update modified model
        if (model.modified && model.modified.getValue() !== proposedContent) {
          model.modified.setValue(proposedContent);
        }
      }
    }
  }, [originalContent, proposedContent]);

  // Handle language changes
  useEffect(() => {
    if (diffEditorRef.current) {
      const model = diffEditorRef.current.getModel();
      if (model) {
        if (model.original && model.original.getLanguageId() !== language) {
          monaco.editor.setModelLanguage(model.original, language);
        }
        if (model.modified && model.modified.getLanguageId() !== language) {
          monaco.editor.setModelLanguage(model.modified, language);
        }
      }
    }
  }, [language]);

  // Handle readOnly changes
  useEffect(() => {
    if (diffEditorRef.current) {
      diffEditorRef.current.updateOptions({
        readOnly: readOnly
      });
    }
  }, [readOnly]);

  return <div ref={hostRef} style={{ height: "100%", width: "100%" }} />;
}
