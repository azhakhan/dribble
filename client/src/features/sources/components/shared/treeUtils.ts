import type { FileNode } from "@/shared/lib/fileTreeUtils";

/**
 * Generate a unique node ID for tree state management
 */
export const generateNodeId = (
  node: FileNode,
  level: number = 0,
  parentContext?: { sourceId?: string; schemaName?: string }
): string => {
  if (node.type === "source" && node.id) {
    return `source-${node.id}`;
  }
  if (node.type === "schema" && node.sourceId) {
    return `schema-${node.sourceId}-${node.name}`;
  }
  if ((node.type === "table" || node.type === "view") && node.sourceId && node.id) {
    return `${node.type}-${node.id}`;
  }
  if (node.type === "folder" && node.sourceId) {
    if (parentContext?.sourceId && parentContext?.schemaName) {
      return `${node.name.toLowerCase()}-folder-${parentContext.sourceId}-${
        parentContext.schemaName
      }`;
    }
    return `folder-${node.sourceId}-${node.name}`;
  }
  if (node.type === "column" && parentContext) {
    return `column-${parentContext.sourceId}-${parentContext.schemaName}-${node.name}`;
  }
  return `${node.type}-${level}-${node.name}`;
};

/**
 * Generate a unique query source node ID for tree state management
 */
export const generateQuerySourceNodeId = (sourceId: string): string => {
  return `query-source-${sourceId}`;
};

/**
 * Determine if a node has children based on its type and data
 */
export const hasChildren = (node: FileNode, generatedChildren?: FileNode[]): boolean => {
  if (node.type === "source" && node.id && generatedChildren !== undefined) {
    return generatedChildren.length > 0;
  }
  return Boolean(node.children?.length);
};

/**
 * Get effective children for a node (generated or original)
 */
export const getEffectiveChildren = (
  node: FileNode,
  generatedChildren?: FileNode[]
): FileNode[] => {
  return generatedChildren || node.children || [];
};

/**
 * Determine parent context for child nodes
 */
export const getChildParentContext = (
  node: FileNode,
  parentContext?: { sourceId?: string; schemaName?: string }
): { sourceId?: string; schemaName?: string } | undefined => {
  if (node.type === "source" && node.id) {
    return { sourceId: node.id };
  } else if (node.type === "schema" && node.sourceId) {
    return { sourceId: node.sourceId, schemaName: node.name };
  } else if (node.type === "folder" && node.sourceId && parentContext?.schemaName) {
    return parentContext;
  }
  return parentContext;
};
