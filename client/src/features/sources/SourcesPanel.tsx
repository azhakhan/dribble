import { FileTree } from "./components/FileTree";
import { AddSource } from "./dialogs/AddSource";
import type { FileNode } from "@/shared/lib/fileTreeUtils";
import type { ConnectedSource } from "@/shared/lib/api";

interface SourcesPanelProps {
  data: FileNode[];
  connectedSources: ConnectedSource[];
  onSourceSelect?: (source: { id: string; name: string; dbtype: string }) => void;
  onTableDoubleClick?: (
    sourceId: string,
    tableName: string,
    nodeType: "table" | "view",
    schemaName?: string
  ) => void;
}

export const SourcesPanel = ({
  data,
  connectedSources,
  onSourceSelect,
  onTableDoubleClick
}: SourcesPanelProps) => {
  return (
    <div className="h-full flex flex-col">
      {/* Tree content */}
      <div className="flex-1 overflow-hidden">
        <FileTree
          data={data}
          connectedSources={connectedSources}
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
