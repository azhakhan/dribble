import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  File,
  Database,
  Table,
  Columns,
} from "lucide-react";
import type { Source } from "@/lib/api";

interface FileNode {
  name: string;
  type: "file" | "folder" | "source" | "schema" | "table" | "column";
  id?: string;
  dbtype?: string;
  dataType?: string;
  nullable?: boolean;
  children?: FileNode[];
}

interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
}

interface SchemaTable {
  columns: SchemaColumn[];
}

interface SchemaView {
  columns: SchemaColumn[];
}

interface SchemaObject {
  tables: Record<string, SchemaTable>;
  views: Record<string, SchemaView>;
}

interface FileTreeProps {
  data: FileNode[];
  onFileSelect?: (path: string) => void;
  onSourceSelect?: (source: {
    id: string;
    name: string;
    dbtype: string;
  }) => void;
}

const FileTreeItem = ({
  node,
  level = 0,
  onFileSelect,
  onSourceSelect,
}: {
  node: FileNode;
  level?: number;
  onFileSelect?: (path: string) => void;
  onSourceSelect?: (source: {
    id: string;
    name: string;
    dbtype: string;
  }) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isFolder = node.type === "folder";
  const isSource = node.type === "source";
  const isSchema = node.type === "schema";
  const isTable = node.type === "table";
  const hasChildren = Boolean(node.children?.length);

  const handleClick = () => {
    if (isFolder || isSchema || (isTable && hasChildren)) {
      setIsOpen(!isOpen);
    } else if (isSource && onSourceSelect && node.id) {
      onSourceSelect({
        id: node.id,
        name: node.name,
        dbtype: node.dbtype || "",
      });
    } else if (onFileSelect) {
      onFileSelect(node.name);
    }
  };

  const renderIcon = () => {
    if (isFolder) {
      return <Folder className="h-4 w-4" />;
    } else if (isSource) {
      return <Database className="h-4 w-4" />;
    } else if (isSchema) {
      return <Database className="h-4 w-4" />;
    } else if (isTable) {
      return <Table className="h-4 w-4" />;
    } else if (node.type === "column") {
      return <Columns className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1 hover:bg-accent cursor-pointer"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isFolder || isSchema || (isTable && hasChildren) ? (
          isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )
        ) : null}
        {renderIcon()}
        <span className="text-sm">{node.name}</span>
        {node.type === "column" && node.nullable === false && (
          <span className="text-xs text-red-500 ml-1">*</span>
        )}
      </div>
      {(isFolder || isSchema || isTable) && isOpen && node.children && (
        <div>
          {node.children.map((child, index) => (
            <FileTreeItem
              key={index}
              node={child}
              level={level + 1}
              onFileSelect={onFileSelect}
              onSourceSelect={onSourceSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileTree = ({
  data,
  onFileSelect,
  onSourceSelect,
}: FileTreeProps) => {
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
          />
        ))}
      </div>
    </div>
  );
};

// Helper function to convert sources to file tree nodes
export const sourcesToFileTreeNodes = (sources: Source[]): FileNode[] => {
  // Create a "Data Sources" folder node with sources as children
  return [
    {
      name: "Data Sources",
      type: "folder",
      children: sources.map((source) => ({
        name: source.name,
        type: "source",
        id: source.id,
        dbtype: source.dbtype,
      })),
    },
  ];
};

// Helper function to convert schema data to file tree nodes
export const schemaToFileTreeNodes = (
  schemaData: Record<string, SchemaObject>,
  sourceId: string
): FileNode[] => {
  const result: FileNode[] = [];

  // Process each schema (like "public")
  for (const schemaName in schemaData) {
    const schema = schemaData[schemaName];
    const schemaNode: FileNode = {
      name: schemaName,
      type: "schema",
      id: `${sourceId}_${schemaName}`,
      children: [],
    };

    // Add Tables folder
    if (schema.tables && Object.keys(schema.tables).length > 0) {
      const tablesNode: FileNode = {
        name: "Tables",
        type: "folder",
        children: [],
      };

      // Process each table
      for (const tableName in schema.tables) {
        const table = schema.tables[tableName];
        const tableNode: FileNode = {
          name: tableName,
          type: "table",
          id: `${sourceId}_${schemaName}_${tableName}`,
          children: [],
        };

        // Process columns
        if (table.columns && table.columns.length > 0) {
          table.columns.forEach((column: SchemaColumn) => {
            tableNode.children?.push({
              name: `${column.name} (${column.type})`,
              type: "column",
              dataType: column.type,
              nullable: column.nullable,
            });
          });
        }

        tablesNode.children?.push(tableNode);
      }

      schemaNode.children?.push(tablesNode);
    }

    // Add Views folder
    if (schema.views && Object.keys(schema.views).length > 0) {
      const viewsNode: FileNode = {
        name: "Views",
        type: "folder",
        children: [],
      };

      // Process each view
      for (const viewName in schema.views) {
        const view = schema.views[viewName];
        const viewNode: FileNode = {
          name: viewName,
          type: "table", // Reusing the table type for views
          id: `${sourceId}_${schemaName}_${viewName}`,
          children: [],
        };

        // Process columns if they exist
        if (view.columns && view.columns.length > 0) {
          view.columns.forEach((column: SchemaColumn) => {
            viewNode.children?.push({
              name: `${column.name} (${column.type})`,
              type: "column",
              dataType: column.type,
              nullable: column.nullable,
            });
          });
        }

        viewsNode.children?.push(viewNode);
      }

      schemaNode.children?.push(viewsNode);
    }

    result.push(schemaNode);
  }

  return result;
};
