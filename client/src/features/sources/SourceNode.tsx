import React, { useState } from "react";
import { Database, Loader2, Power, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TreeItem } from "./TreeItem";
import { type NodeProps } from "./FileTreeTypes";
import { PostgresIcon, MySQLIcon, SQLiteIcon } from "../icons";
import { useAppStore } from "@/shared/store/useAppStore";
import { useConnectSourceMutation } from "@/shared/hooks/useConnectSourceMutation";
import { useSourceStatusQuery } from "@/shared/hooks/useSourceStatusQuery";
import { useSourceSchemasQuery } from "@/shared/hooks/useSourceSchemasQuery";
import { useQueryClient } from "@tanstack/react-query";
import { SourceDropdown } from "./FileTreeControls";
import { EditSource } from "./dialogs/EditSource";
import { RenameSource } from "./dialogs/RenameSource";
import { DeleteSource } from "./dialogs/DeleteSource";
import { SchemaNode } from "./SchemaNode";

export const SourceNode: React.FC<NodeProps> = ({
  node,
  level = 0,
  onSourceSelect,
  onTableDoubleClick
}) => {
  const {
    selectedNodeId,
    setSelectedNodeId,
    loadingSourceId,
    sourceSchemaErrors: sourceErrors,
    sourceStatuses,
    connectedSources,
    addConnectedSource
  } = useAppStore();

  const [isOpen, setIsOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const hasChildren = Boolean(node.children?.length);
  const isLoading = loadingSourceId === node.id;
  const isSelected = selectedNodeId === node.id;
  const hasError = node.id && sourceErrors && sourceErrors[node.id];

  // React Query hooks
  const connectMutation = useConnectSourceMutation();
  const queryClient = useQueryClient();

  // Get source status if this is a source node AND it's connected
  const isConnected = node.id && connectedSources?.has(node.id);
  const { data: sourceStatus } = useSourceStatusQuery(isConnected ? node.id : undefined);

  // Get source schemas to check if they're loaded - only if the source is connected
  const { data: sourceSchemas, isSuccess: schemasLoaded } = useSourceSchemasQuery(
    isConnected ? node.id : undefined
  );

  // Get status from props or from query
  const currentStatus = node.id
    ? (sourceStatuses && sourceStatuses[node.id]) || sourceStatus
    : undefined;

  // Handle connect button click
  const handleConnectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.id) {
      connectMutation.mutate(node.id, {
        onSuccess: () => {
          // Add to connected sources in the store
          if (node.id) {
            addConnectedSource(node.id);
          }

          // After successful connection, fetch the source status
          queryClient.invalidateQueries({ queryKey: ["sourceStatus", node.id] });

          // If status becomes healthy and schemas are not loaded, load them
          setTimeout(() => {
            // Check if schemas need to be loaded
            if (!schemasLoaded || !sourceSchemas || Object.keys(sourceSchemas).length === 0) {
              queryClient.invalidateQueries({ queryKey: ["sourceSchemas", node.id] });
            }
          }, 500);
        }
      });
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
    if (onSourceSelect && node.id) {
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
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
  };

  const renderIcon = () => {
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
  };

  const renderChildren = () => (
    <div>
      {node.children &&
        node.children.map((child, index) => {
          if (child.type === "schema") {
            return (
              <SchemaNode
                key={index}
                node={child}
                level={level + 1}
                onSourceSelect={onSourceSelect}
                onTableDoubleClick={onTableDoubleClick}
              />
            );
          }
          return null;
        })}
      {(!node.children || node.children.length === 0) && !isLoading && (
        <div
          className="flex items-center gap-1 px-2 py-1 text-muted-foreground select-none"
          style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
        >
          <span className="text-sm font-light">No schemas found</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      <TreeItem
        node={node}
        level={level}
        isOpen={isOpen}
        isSelected={isSelected}
        hasChildren={hasChildren}
        hasError={Boolean(hasError)}
        handleItemClick={handleItemClick}
        handleDoubleClick={handleDoubleClick}
        handleChevronClick={handleChevronClick}
        renderChildren={renderChildren}
      >
        {renderIcon()}
        <span className={`text-sm font-light ${hasError ? "text-red-500" : ""}`}>{node.name}</span>

        <div
          className="ml-auto text-muted-foreground scale-75 flex items-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Connect button for sources */}
          {node.id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center mr-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                      onClick={handleConnectClick}
                      disabled={connectMutation.isPending}
                    >
                      <Power className="h-3 w-3" />
                      <span className="sr-only">Connect source</span>
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Connect to source</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Status indicator */}
          {currentStatus && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center mr-1">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        currentStatus === "healthy"
                          ? "bg-green-500"
                          : currentStatus === "unhealthy"
                            ? "bg-red-500"
                            : "bg-yellow-500 animate-pulse"
                      }`}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Status: {String(currentStatus)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Error indicator */}
          {hasError && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center mr-1">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{sourceErrors?.[node.id!]}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <SourceDropdown
            dropdownOpen={dropdownOpen}
            setDropdownOpen={setDropdownOpen}
            onEdit={() => setEditDialogOpen(true)}
            onRename={() => setRenameDialogOpen(true)}
            onDelete={() => setDeleteDialogOpen(true)}
          />
        </div>
      </TreeItem>

      {/* Dialogs */}
      {node.id && (
        <>
          <EditSource
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
            }}
            sourceId={node.id}
          />

          <RenameSource
            open={renameDialogOpen}
            onOpenChange={(open) => {
              setRenameDialogOpen(open);
            }}
            sourceId={node.id}
            sourceName={node.name}
          />

          <DeleteSource
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
            }}
            sourceId={node.id}
            sourceName={node.name}
          />
        </>
      )}
    </>
  );
};
