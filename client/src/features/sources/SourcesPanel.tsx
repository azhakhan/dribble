import { FileTree } from "./FileTree";
import { AddSource } from "./dialogs/AddSource";
import type { FileNode } from "@/shared/lib/fileTreeUtils";

interface SourcesPanelProps {
  data: FileNode[];
  onSourceSelect?: (source: { id: string; name: string; dbtype: string }) => void;
  onTableDoubleClick?: (
    sourceId: string,
    tableName: string,
    nodeType: "table" | "view",
    schemaName?: string
  ) => void;
}

export const SourcesPanel = ({ data, onSourceSelect, onTableDoubleClick }: SourcesPanelProps) => {
  return (
    <div className="h-full flex flex-col">
      {/* Tree content */}
      <div className="flex-1 overflow-hidden">
        <FileTree
          data={data}
          onSourceSelect={onSourceSelect}
          onTableDoubleClick={onTableDoubleClick}
        />
      </div>
      <div className="flex-shrink-0 p-2 font-semibold text-sm border-b flex items-center justify-center">
        <AddSource />
      </div>
    </div>
  );
};
