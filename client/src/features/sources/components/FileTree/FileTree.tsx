import React, { useMemo } from "react";
import type { FileNode } from "@/shared/lib/fileTreeUtils";
import type { ConnectedSource } from "@/shared/lib/api";
import { FileTreeItem } from "./FileTreeItem";
import {
  useStoreConnectedSources,
  useStoreConnectedSourcesSchemas
} from "@/shared/hooks/useStoreQueries";

interface FileTreeProps {
  data: FileNode[];
  onSourceSelect?: (source: { id: string; name: string; dbtype: string }) => void;
  onTableDoubleClick?: (
    sourceId: string,
    tableName: string,
    nodeType: "table" | "view",
    schemaName?: string
  ) => void;
}

export const FileTree: React.FC<FileTreeProps> = ({ data, onSourceSelect, onTableDoubleClick }) => {
  // Fetch connected sources on component mount
  const { data: connectedSourcesData } = useStoreConnectedSources();

  // Create a set of connected source IDs for easy lookup
  const connectedSourceIds = useMemo(() => {
    if (!connectedSourcesData) return new Set<string>();
    return new Set(connectedSourcesData.map((source: ConnectedSource) => source.id));
  }, [connectedSourcesData]);

  // Fetch schemas for all connected sources and update AppState
  useStoreConnectedSourcesSchemas(connectedSourcesData);

  // Sort sources alphabetically by name
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (a.type === "source" && b.type === "source") {
        return a.name.localeCompare(b.name);
      }
      return 0; // Keep original order for non-source items
    });
  }, [data]);

  return (
    <div className="h-full flex flex-col">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto mt-2">
        {sortedData.map((node, index) => (
          <FileTreeItem
            key={index}
            node={node}
            onSourceSelect={onSourceSelect}
            onTableDoubleClick={onTableDoubleClick}
            connectedSourceIds={connectedSourceIds}
            parentContext={undefined} // Root level has no parent context
          />
        ))}
      </div>
    </div>
  );
};
