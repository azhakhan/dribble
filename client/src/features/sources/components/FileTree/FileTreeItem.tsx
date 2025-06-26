import React, { useState, useEffect, useRef } from "react";
import { useTreeStore, useSourceStore } from "@/shared/store";
import type { FileNode } from "@/shared/lib/fileTreeUtils";
import { TreeChevron } from "../shared/TreeChevron";
import { FileTreeIcon } from "./FileTreeIcon";
import { FileTreeActions } from "./FileTreeActions";
import { FileTreeStatusIndicator } from "./FileTreeStatusIndicator";
import { FileTreeDialogs } from "./FileTreeDialogs";
import { useFileTreeItem } from "./hooks/useFileTreeItem";
import {
  generateNodeId,
  hasChildren as utilHasChildren,
  getEffectiveChildren,
  getChildParentContext
} from "../shared/treeUtils";

interface FileTreeItemProps {
  node: FileNode;
  level?: number;
  onSourceSelect?: (source: { id: string; name: string; dbtype: string }) => void;
  onTableDoubleClick?: (
    sourceId: string,
    tableName: string,
    nodeType: "table" | "view",
    schemaName?: string
  ) => void;
  connectedSourceIds: Set<string>;
  parentContext?: { sourceId?: string; schemaName?: string };
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  level = 0,
  onSourceSelect,
  onTableDoubleClick,
  connectedSourceIds,
  parentContext
}) => {
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

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Ref for the actions trigger button
  const actionsRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when any dialog opens to prevent conflicts
  useEffect(() => {
    if (editDialogOpen || renameDialogOpen || deleteDialogOpen) {
      setDropdownOpen(false);
    }
  }, [editDialogOpen, renameDialogOpen, deleteDialogOpen]);

  // Node type checks
  const isFolder = node.type === "folder";
  const isSource = node.type === "source";
  const isSchema = node.type === "schema";
  const isTable = node.type === "table";
  const isView = node.type === "view";
  const isColumn = node.type === "column";

  // Get generated children from app store if available
  const generatedChildren = isSource && node.id ? sourceGeneratedChildren[node.id] : undefined;

  // Determine if node has children using app store state for sources
  const hasChildren = utilHasChildren(node, generatedChildren);

  // Combine original children with generated schema children
  const effectiveChildren = getEffectiveChildren(node, generatedChildren);

  const isLoading = Boolean(isSource && node.id && loadingSourceIds.has(node.id));
  const isSelected = selectedNodeId === node.id;
  const hasError = Boolean(isSource && node.id && sourceErrors && sourceErrors[node.id]);

  // Connection status
  const isConnected = Boolean(isSource && node.id && connectedSourceIds.has(node.id));

  // Custom hook for handling item interactions
  const {
    handleItemClick,
    handleDoubleClick,
    handleChevronClick,
    handleConnectClick,
    disconnectSource
  } = useFileTreeItem({
    node,
    nodeId,
    isOpen,
    hasChildren,
    isConnected,
    isColumn,
    isSource,
    isSchema,
    isFolder,
    isTable,
    isView,
    parentContext,
    onSourceSelect,
    onTableDoubleClick,
    setSelectedNodeId,
    setNodeExpanded
  });

  // Auto-collapse source when it gets disconnected (but not during initial load)
  useEffect(() => {
    if (isSource && !isConnected && isOpen && connectedSourceIds.size > 0) {
      setNodeExpanded(nodeId, false);
    }
  }, [isSource, isConnected, isOpen, nodeId, setNodeExpanded, connectedSourceIds.size]);

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
        <TreeChevron isExpanded={isOpen} hasChildren={hasChildren} onClick={handleChevronClick} />

        {/* Icon for the item type */}
        <div className="mr-1.5 flex items-center">
          <FileTreeIcon node={node} isLoading={isLoading} />
        </div>

        {/* Item name */}
        <span className="flex-grow truncate">{node.name}</span>

        {/* Status indicator and actions for sources */}
        {isSource && (
          <>
            <FileTreeStatusIndicator
              hasError={hasError}
              isConnected={isConnected}
              sourceErrors={sourceErrors}
              nodeId={node.id}
              sourceStatuses={sourceStatuses}
            />

            <FileTreeActions
              ref={actionsRef}
              isConnected={isConnected}
              isLoading={isLoading}
              nodeId={node.id}
              dropdownOpen={dropdownOpen}
              onDropdownOpenChange={setDropdownOpen}
              onConnect={handleConnectClick}
              onDisconnect={disconnectSource}
              onEdit={() => setEditDialogOpen(true)}
              onRename={() => setRenameDialogOpen(true)}
              onDelete={() => setDeleteDialogOpen(true)}
            />
          </>
        )}
      </div>

      {/* Dialogs */}
      <FileTreeDialogs
        isSource={isSource}
        nodeId={node.id}
        nodeName={node.name}
        editDialogOpen={editDialogOpen}
        setEditDialogOpen={setEditDialogOpen}
        renameDialogOpen={renameDialogOpen}
        setRenameDialogOpen={setRenameDialogOpen}
        deleteDialogOpen={deleteDialogOpen}
        setDeleteDialogOpen={setDeleteDialogOpen}
        triggerRef={actionsRef}
      />

      {/* Children */}
      {isOpen && hasChildren && (
        <div>
          {effectiveChildren.map((childNode: FileNode, index: number) => {
            const childParentContext = getChildParentContext(node, parentContext);

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
