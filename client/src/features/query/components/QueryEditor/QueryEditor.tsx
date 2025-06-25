import { memo } from "react";
import { Editor } from "@/features/editor/Editor";
import { EditorToolbar } from "./EditorToolbar";
import { EditorStatusBar } from "./EditorStatusBar";

interface QueryEditorProps {
  tabId: string;
  onQueryExecuted?: () => void;
  showVersions?: boolean;
  showRuns?: boolean;
  onShowRuns?: () => void;
}

function QueryEditorComponent({
  tabId,
  onQueryExecuted,
  showVersions = true,
  showRuns = true,
  onShowRuns
}: QueryEditorProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Toolbar - could be added in the future */}
      <EditorToolbar />

      {/* Main Editor */}
      <div className="flex-1 min-h-0">
        <Editor tabId={tabId} onQueryExecuted={onQueryExecuted} />
      </div>

      {/* Status Bar with versions and runs info */}
      {(showVersions || showRuns) && (
        <EditorStatusBar
          tabId={tabId}
          showVersions={showVersions}
          showRuns={showRuns}
          onShowRuns={onShowRuns}
        />
      )}
    </div>
  );
}

const QueryEditor = memo(QueryEditorComponent);
export default QueryEditor;
