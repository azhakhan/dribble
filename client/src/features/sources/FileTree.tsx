import { useState, useMemo } from "react";
import { useAppStore } from "@/shared/store/useAppStore";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  File,
  Database,
  Table,
  Loader2,
  MoreVertical,
  AlertCircle,
  Power
} from "lucide-react";
import { PostgresIcon, MySQLIcon, SQLiteIcon } from "../icons";
import { getColumnTypeIcon } from "./ColumnTypeIcons";
import type { FileNode } from "@/shared/lib/fileTreeUtils";
import { AddSource } from "@/features/sources/dialogs/AddSource";
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
import { useConnectedSourcesQuery } from "@/shared/hooks/useConnectedSourcesQuery";
import { useConnectedSourcesSchemas } from "@/shared/hooks/useConnectedSourcesSchemas";
import type { ConnectedSource } from "@/shared/lib/api";

interface FileTreeProps {
  data: FileNode[];
  onSourceSelect?: (source: { id: string; name: string; dbtype: string }) => void;
  onTableDoubleClick?: (sourceId: string, tableName: string) => void;
}

interface FileTreeItemProps {
  node: FileNode;
  level?: number;
  onSourceSelect?: (source: { id: string; name: string; dbtype: string }) => void;
  onTableDoubleClick?: (sourceId: string, tableName: string) => void;
  connectedSourceIds: Set<string>;
}

const FileTreeItem = ({
  node,
  level = 0,
  onSourceSelect,
  onTableDoubleClick,
  connectedSourceIds
}: FileTreeItemProps) => {
  // Get state and actions from Zustand store
  const {
    selectedNodeId,
    setSelectedNodeId,
    loadingSourceId,
    sourceSchemaErrors: sourceErrors,
    sourceStatuses,
    sourceGeneratedChildren,
    sourceHasChildren: sourceHasChildrenMap
  } = useAppStore();

  const [isOpen, setIsOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isFolder = node.type === "folder";
  const isSource = node.type === "source";
  const isSchema = node.type === "schema";
  const isTable = node.type === "table";
  const isColumn = node.type === "column";

  // React Query hooks
  const connectMutation = useConnectSourceMutation();
  const disconnectMutation = useDisconnectSourceMutation();

  // Get source status if this is a source node AND it's connected
  const isConnected = isSource && node.id && connectedSourceIds.has(node.id);
  const { data: sourceStatus } = useSourceStatusQuery(isConnected ? node.id : undefined);

  // Get generated children from app store if available
  const generatedChildren = isSource && node.id ? sourceGeneratedChildren[node.id] : undefined;

  // Determine if node has children using app store state for sources
  const hasChildren =
    isSource && node.id && sourceHasChildrenMap[node.id] !== undefined
      ? sourceHasChildrenMap[node.id] // Use app store value for sources
      : Boolean(node.children?.length); // Fall back to original check for non-sources

  // Combine original children with generated schema children
  const effectiveChildren = generatedChildren || node.children || [];

  const isLoading = isSource && loadingSourceId === node.id;
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

    // Set this node as selected
    if (node.id) {
      setSelectedNodeId(node.id);
    }

    // For all database objects, just select them
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
    setIsOpen(!isOpen);
  };

  // Handle double-click behavior
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isSource) {
      // If source is not connected, connect to it first
      if (!isConnected && node.id) {
        handleConnectClick(e);
      } else if (hasChildren) {
        // If source is already connected, open its children
        setIsOpen(!isOpen);
      }
    } else if ((isSchema || isFolder) && hasChildren) {
      // For schemas and folders, show children on double-click
      setIsOpen(!isOpen);
    } else if (isTable && onTableDoubleClick && node.id) {
      // For tables and views, query them (both are "table" type)
      if (node.sourceId) {
        onTableDoubleClick(node.sourceId, node.name);
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
    } else if (isTable) {
      // Both tables and views are "table" type
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
        style={{ paddingLeft: `${level * 12}px` }}
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
                        currentStatus === "healthy"
                          ? "bg-green-500"
                          : currentStatus === "unhealthy"
                            ? "bg-red-500"
                            : "bg-yellow-500"
                      }`}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {currentStatus === "healthy"
                        ? "Connected"
                        : currentStatus === "unhealthy"
                          ? "Connection error"
                          : "Connecting..."}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Connect button for sources that aren't connected */}
            {isSource && !isConnected && !isLoading && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-3 w-3 ml-1 hover:bg-accent cursor-pointer"
                      onClick={handleConnectClick}
                    >
                      <Power style={{ width: "12px", height: "12px" }} strokeWidth={1} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Connect to source</p>
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
                  className="h-4 w-4 ml-1 hover:bg-accent"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-2 w-2" strokeWidth={1} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {isConnected && node.id && (
                  <>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => disconnectSource(node.id as string)}
                    >
                      Disconnect
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRenameDialogOpen(true)}>
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
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
          {effectiveChildren.map((childNode: FileNode, index: number) => (
            <FileTreeItem
              key={`${childNode.id || childNode.name}-${index}`}
              node={childNode}
              level={level + 1}
              onSourceSelect={onSourceSelect}
              onTableDoubleClick={onTableDoubleClick}
              connectedSourceIds={connectedSourceIds}
            />
          ))}
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
  const { data: connectedSourcesData } = useConnectedSourcesQuery();

  // Create a set of connected source IDs for easy lookup
  const connectedSourceIds = useMemo(() => {
    if (!connectedSourcesData) return new Set<string>();
    const ids = new Set(connectedSourcesData.map((source: ConnectedSource) => source.id));
    return ids;
  }, [connectedSourcesData]);

  // Fetch schemas for all connected sources and update AppState
  useConnectedSourcesSchemas(connectedSourcesData);

  return (
    <div className="h-full overflow-auto border-r select-none">
      <div className="p-2 font-semibold border-b flex items-center justify-between">
        <span>Sources</span>
        <AddSource className="hover:text-foreground text-muted-foreground" />
      </div>
      <div>
        {data.map((node, index) => (
          <FileTreeItem
            key={index}
            node={node}
            onSourceSelect={onSourceSelect}
            onTableDoubleClick={onTableDoubleClick}
            connectedSourceIds={connectedSourceIds}
          />
        ))}
      </div>
    </div>
  );
};
