import type { Source } from "@/lib/api";

export interface FileNode {
  name: string;
  type: "file" | "folder" | "source" | "schema" | "table" | "column";
  id?: string;
  sourceId?: string;
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

// Helper function to convert sources to file tree nodes
export const sourcesToFileTreeNodes = (sources: Source[]): FileNode[] => {
  // Return sources directly at the root level
  return sources.map((source) => ({
    name: source.name,
    type: "source",
    id: source.id,
    sourceId: source.id,
    dbtype: source.dbtype,
    children: [], // Initialize empty children array for each source
  }));
};

// Helper function to convert schema data to file tree nodes
export const schemaToFileTreeNodes = (
  schemaData: Record<string, SchemaObject>,
  sourceId: string,
): FileNode[] => {
  const result: FileNode[] = [];

  // Process each schema (like "public")
  for (const schemaName in schemaData) {
    const schema = schemaData[schemaName];
    const schemaNode: FileNode = {
      name: schemaName,
      type: "schema",
      id: `${sourceId}_${schemaName}`,
      sourceId: sourceId,
      children: [],
    };

    // Add Tables folder
    if (schema.tables && Object.keys(schema.tables).length > 0) {
      const tablesNode: FileNode = {
        name: "Tables",
        type: "folder",
        sourceId: sourceId,
        children: [],
      };

      // Process each table
      for (const tableName in schema.tables) {
        const table = schema.tables[tableName];
        const tableNode: FileNode = {
          name: tableName,
          type: "table",
          id: `${sourceId}_${schemaName}_${tableName}`,
          sourceId: sourceId,
          children: [],
        };

        // Process columns
        if (table.columns && table.columns.length > 0) {
          table.columns.forEach((column: SchemaColumn) => {
            tableNode.children?.push({
              name: column.name,
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
        sourceId: sourceId,
        children: [],
      };

      // Process each view
      for (const viewName in schema.views) {
        const view = schema.views[viewName];
        const viewNode: FileNode = {
          name: viewName,
          type: "table", // Reusing the table type for views
          id: `${sourceId}_${schemaName}_${viewName}`,
          sourceId: sourceId,
          children: [],
        };

        // Process columns if they exist
        if (view.columns && view.columns.length > 0) {
          view.columns.forEach((column: SchemaColumn) => {
            viewNode.children?.push({
              name: column.name,
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
