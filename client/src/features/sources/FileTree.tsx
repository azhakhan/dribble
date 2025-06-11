import React, { useState, useMemo, useEffect } from "react";
import { useTreeStore, useSourceStore } from "@/shared/store";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  File,
  Database,
  Table,
  Loader2,
  MoreVertical,
  AlertCircle
} from "lucide-react";
import { PostgresIcon, MySQLIcon, SQLiteIcon } from "../icons";
import { getColumnTypeIcon } from "./ColumnTypeIcons";
import type { FileNode } from "@/shared/lib/fileTreeUtils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { EditSource } from "./dialogs/EditSource";
import { RenameSource } from "./dialogs/RenameSource";
import { DeleteSource } from "./dialogs/DeleteSource";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useConnectSourceMutation,
  useDisconnectSourceMutation
} from "@/shared/hooks/useConnectSourceMutation";
import { useSourceStatusQuery } from "@/shared/hooks/useSourceStatusQuery";
import {
  useStoreConnectedSources,
  useStoreConnectedSourcesSchemas
} from "@/shared/hooks/useStoreQueries";
import type { ConnectedSource } from "@/shared/lib/api";

interface FileTreeProps {
  data: FileNode[];
  onSourceSelect?: (source: { id: string; name: string; dbtype: string }) => void;
  onTableDoubleClick?: (sourceId: string, tableName: string, nodeType: "table" | "view") => void;
}

interface FileTreeItemProps {
  node: FileNode;
  level?: number;
  onSourceSelect?: (source: { id: string; name: string; dbtype: string }) => void;
  onTableDoubleClick?: (sourceId: string, tableName: string, nodeType: "table" | "view") => void;
  connectedSourceIds: Set<string>;
  parentContext?: { sourceId?: string; schemaName?: string };
}

// Helper function to generate a unique node ID for tree state management
const generateNodeId = (
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
    // For actual tables/views, use their full ID with type prefix
    return `${node.type}-${node.id}`;
  }
  if (node.type === "folder" && node.sourceId) {
    // Handle organizational folders like "Tables" and "Views"
    if (parentContext?.sourceId && parentContext?.schemaName) {
      return `${node.name.toLowerCase()}-folder-${parentContext.sourceId}-${
        parentContext.schemaName
      }`;
    }
    // Fallback for regular folders
    return `folder-${node.sourceId}-${node.name}`;
  }
  if (node.type === "column" && parentContext) {
    return `column-${parentContext.sourceId}-${parentContext.schemaName}-${node.name}`;
  }
  // Fallback for other types
  return `${node.type}-${level}-${node.name}`;
};

const FileTreeItem = ({
  node,
  level = 0,
  onSourceSelect,
  onTableDoubleClick,
  connectedSourceIds,
  parentContext
}: FileTreeItemProps) => {
  // Get state and actions from Zustand stores
  const { selectedNodeId, setSelectedNodeId, loadingSourceIds, isNodeExpanded, setNodeExpanded } =
    useTreeStore();

  const {
    sourceSchemaErrors: sourceErrors,
    sourceStatuses,
    sourceGeneratedChildren
  } = useSourceStore();

  // Generate unique node ID for this item
  const nodeId = generateNodeId(node, level, parentContext);

  // Get expansion state from centralized store
  const isOpen = isNodeExpanded(nodeId);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isFolder = node.type === "folder";
  const isSource = node.type === "source";
  const isSchema = node.type === "schema";
  const isTable = node.type === "table";
  const isView = node.type === "view";
  const isColumn = node.type === "column";

  // React Query hooks
  const connectMutation = useConnectSourceMutation();
  const disconnectMutation = useDisconnectSourceMutation();

  // Get source status if this is a source node AND it's connected
  const isConnected = isSource && node.id && connectedSourceIds.has(node.id);
  const { data: sourceStatus } = useSourceStatusQuery(isConnected ? node.id : undefined);

  // Auto-collapse source when it gets disconnected (but not during initial load)
  useEffect(() => {
    if (isSource && !isConnected && isOpen && connectedSourceIds.size > 0) {
      setNodeExpanded(nodeId, false);
    }
  }, [isSource, isConnected, isOpen, nodeId, setNodeExpanded, connectedSourceIds.size]);

  // Note: Removed automatic cleanup during initialization to prevent interference with persistence

  // Get generated children from app store if available
  const generatedChildren = isSource && node.id ? sourceGeneratedChildren[node.id] : undefined;

  // Determine if node has children using app store state for sources
  const hasChildren =
    isSource && node.id && sourceGeneratedChildren[node.id] !== undefined
      ? sourceGeneratedChildren[node.id].length > 0 // Use generated children length for sources
      : Boolean(node.children?.length); // Fall back to original check for non-sources

  // Combine original children with generated schema children
  const effectiveChildren = generatedChildren || node.children || [];

  const isLoading = isSource && node.id && loadingSourceIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const hasError = isSource && node.id && sourceErrors && sourceErrors[node.id];

  // Get status from props or from query
  const currentStatus =
    isSource && node.id ? (sourceStatuses && sourceStatuses[node.id]) || sourceStatus : undefined;

  // Handle connect button click
  const handleConnectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSource && node.id) {
      connectMutation.mutate(node.id);
    }
  };

  // Handle item selection (single click)
  const handleItemClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Set this node as selected for all items
    if (node.id) {
      setSelectedNodeId(node.id);
    }

    if (isColumn) {
      // For columns, just select them (no expansion or other actions)
      return;
    }

    // Check if this is an actual table/view (has id) vs organizational folder (no id)
    const isActualTable = (isTable || isView) && node.id;

    if (isActualTable) {
      // For actual tables/views, only select them on single click (no other actions)
      return;
    }

    // For sources, schemas, folders, and organizational table/view groupings: expand/collapse on single click
    if ((isSource && isConnected) || isSchema || isFolder || ((isTable || isView) && !node.id)) {
      if (hasChildren) {
        setNodeExpanded(nodeId, !isOpen);
      }
    }

    // For sources, also call onSourceSelect
    if (isSource && onSourceSelect && node.id) {
      onSourceSelect({
        id: node.id,
        name: node.name,
        dbtype: node.dbtype || ""
      });
    }
  };

  // Handle chevron click to toggle children visibility
  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodeExpanded(nodeId, !isOpen);
  };

  // Handle double-click behavior
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isColumn) {
      // For columns, just select them (no other actions)
      return;
    }

    // Check if this is an actual table/view (has id) vs organizational folder (no id)
    const isActualTable = (isTable || isView) && node.id;

    if (isSource) {
      // If source is not connected, connect to it first
      if (!isConnected && node.id) {
        handleConnectClick(e);
      } else if (hasChildren) {
        // If source is already connected, toggle children
        setNodeExpanded(nodeId, !isOpen);
      }
    } else if (isSchema || isFolder || ((isTable || isView) && !node.id)) {
      // For schemas, folders, and organizational table/view groupings: toggle children visibility
      if (hasChildren) {
        setNodeExpanded(nodeId, !isOpen);
      }
    } else if (isActualTable) {
      // For actual tables/views: only open + run ephemeral query (don't expand children)
      if (onTableDoubleClick && node.sourceId) {
        // Open and run ephemeral query on double click
        const nodeType = node.type === "view" ? "view" : "table";
        onTableDoubleClick(node.sourceId, node.name, nodeType);
      }
    }
  };

  const disconnectSource = async (sourceId: string) => {
    disconnectMutation.mutate(sourceId);
  };

  const renderIcon = () => {
    if (isFolder) {
      return <Folder className="h-4 w-4" strokeWidth={1} />;
    } else if (isSource) {
      // Show loading spinner if this source is being loaded
      if (isLoading) {
        return <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1} />;
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
    } else if (isTable || isView) {
      // Tables and views use table icon
      return <Table className="h-4 w-4" strokeWidth={1} />;
    } else if (isColumn) {
      // If it's a column, use the column type icon instead of the generic Columns icon
      return getColumnTypeIcon(node.dataType || "");
    } else {
      return <File className="h-4 w-4" strokeWidth={1} />;
    }
  };

  return (
    <div>
      <div
        className={`flex items-center py-1 px-2 text-sm cursor-pointer hover:bg-accent/50 ${
          isSelected ? "bg-accent" : ""
        }`}
        style={level > 0 ? { paddingLeft: `${level * 12}px` } : {}}
        onClick={handleItemClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Chevron for expandable items */}
        <div className="w-4 h-4 mr-1 flex items-center justify-center" onClick={handleChevronClick}>
          {hasChildren &&
            (isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
        </div>

        {/* Icon for the item type */}
        <div className="mr-1.5 flex items-center">{renderIcon()}</div>

        {/* Item name */}
        <span className="flex-grow truncate">{node.name}</span>

        {/* Status indicator for sources */}
        {isSource && (
          <div className="flex items-center">
            {/* Show error icon if there's an error */}
            {hasError && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="ml-1">
                      <AlertCircle className="h-3.5 w-3.5 text-destructive" strokeWidth={1.5} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {sourceErrors && node.id ? sourceErrors[node.id] : "Error loading schema"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Show status indicator */}
            {isConnected && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`ml-1 w-2 h-2 rounded-full ${
                        currentStatus === "running"
                          ? "bg-green-500"
                          : currentStatus === "unhealthy"
                            ? "bg-red-500"
                            : "bg-yellow-500"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {currentStatus === "running"
                        ? "Connected"
                        : currentStatus === "unhealthy"
                          ? "Connection error"
                          : "Connecting..."}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Actions dropdown */}
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-1 hover:bg-accent cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-2 w-2" strokeWidth={1} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {!isConnected && !isLoading && node.id && (
                  <>
                    <DropdownMenuItem onClick={handleConnectClick}>Connect</DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {isConnected && node.id && (
                  <>
                    <DropdownMenuItem
                      className="text-destructive text-xs cursor-pointer"
                      onClick={() => disconnectSource(node.id as string)}
                    >
                      Disconnect
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem
                  className="text-xs cursor-pointer"
                  onClick={() => setEditDialogOpen(true)}
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs cursor-pointer"
                  onClick={() => setRenameDialogOpen(true)}
                >
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive text-xs cursor-pointer"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {isSource && node.id && (
        <>
          <EditSource open={editDialogOpen} onOpenChange={setEditDialogOpen} sourceId={node.id} />
          <RenameSource
            open={renameDialogOpen}
            onOpenChange={setRenameDialogOpen}
            sourceId={node.id}
            sourceName={node.name}
          />
          <DeleteSource
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            sourceId={node.id}
            sourceName={node.name}
          />
        </>
      )}

      {/* Children */}
      {isOpen && hasChildren && (
        <div>
          {effectiveChildren.map((childNode: FileNode, index: number) => {
            // Determine parent context for child nodes
            let childParentContext = parentContext;

            if (isSource && node.id) {
              // Source -> Schema: pass sourceId
              childParentContext = { sourceId: node.id };
            } else if (isSchema && node.sourceId) {
              // Schema -> Tables/Views folder: pass sourceId and schemaName
              childParentContext = { sourceId: node.sourceId, schemaName: node.name };
            } else if (isFolder && node.sourceId && parentContext?.schemaName) {
              // Tables/Views folder -> actual tables/views: keep existing context
              childParentContext = parentContext;
            }

            return (
              <FileTreeItem
                key={`${childNode.id || childNode.name}-${index}`}
                node={childNode}
                level={level + 1}
                onSourceSelect={onSourceSelect}
                onTableDoubleClick={onTableDoubleClick}
                connectedSourceIds={connectedSourceIds}
                parentContext={childParentContext}
              />
            );
          })}
        </div>
      )}

      {/* Show message when no schemas are found */}
      {isOpen && isSource && effectiveChildren.length === 0 && (
        <div
          className="py-1 px-2 text-muted-foreground"
          style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
        >
          <span className="text-sm font-light">No schemas found</span>
        </div>
      )}
    </div>
  );
};

export const FileTree = ({ data, onSourceSelect, onTableDoubleClick }: FileTreeProps) => {
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
