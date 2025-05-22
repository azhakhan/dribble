import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  File,
  Database,
  Table,
  Columns,
  Loader,
} from "lucide-react";
import { PostgresIcon, MySQLIcon, SQLiteIcon } from "./icons";
import type { FileNode } from "@/lib/fileTreeUtils";

interface FileTreeProps {
  data: FileNode[];
  onFileSelect?: (path: string) => void;
  onSourceSelect?: (source: {
    id: string;
    name: string;
    dbtype: string;
  }) => void;
  onTableDoubleClick?: (sourceId: string, tableName: string) => void;
}

const FileTreeItem = ({
  node,
  level = 0,
  onFileSelect,
  onSourceSelect,
  onTableDoubleClick,
  loadingSourceId,
}: {
  node: FileNode;
  level?: number;
  onFileSelect?: (path: string) => void;
  onSourceSelect?: (source: {
    id: string;
    name: string;
    dbtype: string;
  }) => void;
  onTableDoubleClick?: (sourceId: string, tableName: string) => void;
  loadingSourceId?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isFolder = node.type === "folder";
  const isSource = node.type === "source";
  const isSchema = node.type === "schema";
  const isTable = node.type === "table";
  const hasChildren = Boolean(node.children?.length);
  const isLoading = isSource && loadingSourceId === node.id;

  const handleClick = () => {
    if (isFolder || isSchema || (isTable && hasChildren)) {
      setIsOpen(!isOpen);
    } else if (isSource) {
      // For source nodes, both toggle open state and trigger source select
      setIsOpen(!isOpen);

      if (onSourceSelect && node.id) {
        onSourceSelect({
          id: node.id,
          name: node.name,
          dbtype: node.dbtype || "",
        });
      }
    } else if (onFileSelect) {
      onFileSelect(node.name);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTable && onTableDoubleClick && node.id) {
      // Extract sourceId from the combined id (format: sourceId_schemaName_tableName)
      const idParts = node.id.split("_");
      if (idParts.length >= 1) {
        const sourceId = idParts[0];
        onTableDoubleClick(sourceId, node.name);
      }
    }
  };

  const renderIcon = () => {
    if (isFolder) {
      return <Folder className="h-4 w-4" strokeWidth={1} />;
    } else if (isSource) {
      // Show loading spinner if this source is being loaded
      if (isLoading) {
        return <Loader className="h-4 w-4 animate-spin" strokeWidth={1} />;
      }

      // Use SVG components with constrained size
      const dbType = node.dbtype?.toLowerCase();
      if (dbType === "postgres") {
        return (
          <div className="h-4 w-4 flex items-center justify-center">
            <PostgresIcon />
          </div>
        );
      } else if (dbType === "mysql") {
        return (
          <div className="h-4 w-4 flex items-center justify-center">
            <MySQLIcon />
          </div>
        );
      } else if (dbType === "sqlite") {
        return (
          <div className="h-4 w-4 flex items-center justify-center">
            <SQLiteIcon />
          </div>
        );
      } else {
        return <Database className="h-4 w-4" strokeWidth={1} />;
      }
    } else if (isSchema) {
      return <Database className="h-4 w-4" strokeWidth={1} />;
    } else if (isTable) {
      return <Table className="h-4 w-4" strokeWidth={1} />;
    } else if (node.type === "column") {
      return <Columns className="h-4 w-4" strokeWidth={1} />;
    }
    return <File className="h-4 w-4" strokeWidth={1} />;
  };

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1 hover:bg-accent cursor-pointer"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {isFolder || isSchema || (isTable && hasChildren) || isSource ? (
          isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )
        ) : null}
        {renderIcon()}
        <span className="text-sm font-light">{node.name}</span>
        {node.type === "column" && node.nullable === false && (
          <span className="text-xs text-red-500 ml-1">*</span>
        )}
      </div>
      {(isFolder || isSchema || isTable || isSource) && isOpen && (
        <div>
          {node.children &&
            node.children.map((child, index) => (
              <FileTreeItem
                key={index}
                node={child}
                level={level + 1}
                onFileSelect={onFileSelect}
                onSourceSelect={onSourceSelect}
                onTableDoubleClick={onTableDoubleClick}
                loadingSourceId={loadingSourceId}
              />
            ))}
          {isSource &&
            (!node.children || node.children.length === 0) &&
            !isLoading && (
              <div
                className="flex items-center gap-1 px-2 py-1 text-muted-foreground"
                style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
              >
                <span className="text-sm font-light">No schemas found</span>
              </div>
            )}
        </div>
      )}
    </div>
  );
};

export const FileTree = ({
  data,
  onFileSelect,
  onSourceSelect,
  onTableDoubleClick,
  loadingSourceId,
}: FileTreeProps & { loadingSourceId?: string }) => {
  return (
    <div className="h-full overflow-auto border-r">
      <div className="p-2 font-semibold border-b">Files</div>
      <div>
        {data.map((node, index) => (
          <FileTreeItem
            key={index}
            node={node}
            onFileSelect={onFileSelect}
            onSourceSelect={onSourceSelect}
            onTableDoubleClick={onTableDoubleClick}
            loadingSourceId={loadingSourceId}
          />
        ))}
      </div>
    </div>
  );
};
