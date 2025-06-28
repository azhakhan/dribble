import { useCallback } from "react";
import type { FileNode } from "@/shared/lib/fileTreeUtils";
import { useDisconnectSourceMutation } from "@/shared/hooks/useConnectSourceMutation";
import { useTaskSSE } from "@/shared/lib/taskUtils";
import { useTaskSubmission } from "@/shared/hooks/useTaskSubmission";
import { toast } from "sonner";

interface UseFileTreeItemProps {
  node: FileNode;
  nodeId: string;
  isOpen: boolean;
  hasChildren: boolean;
  isConnected: boolean;
  isColumn: boolean;
  isSource: boolean;
  isSchema: boolean;
  isFolder: boolean;
  isTable: boolean;
  isView: boolean;
  parentContext?: { sourceId?: string; schemaName?: string };
  onSourceSelect?: (source: { id: string; name: string; dbtype: string }) => void;
  onTableDoubleClick?: (
    sourceId: string,
    tableName: string,
    nodeType: "table" | "view",
    schemaName?: string
  ) => void;
  setSelectedNodeId: (nodeId: string | undefined) => void;
  setNodeExpanded: (nodeId: string, expanded: boolean) => void;
}

export const useFileTreeItem = ({
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
}: UseFileTreeItemProps) => {
  const disconnectMutation = useDisconnectSourceMutation();

  // Initialize SSE connection for task updates
  useTaskSSE();

  // Task submission hook for connecting source
  const connectTask = useTaskSubmission<{ status: string }>({
    onSuccess: (result: unknown) => {
      const connectResult = result as { status: string };
      if (connectResult && connectResult.status === "success") {
        toast.success("Source connected successfully");
      } else {
        toast.error("Connection failed");
      }
    },
    onError: (error: string) => {
      toast.error(`Connection failed: ${error}`);
    }
  });

  // Handle connect button click
  const handleConnectClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isSource && node.id) {
        connectTask.submit(`/worker/connect/${node.id}`, {});
      }
    },
    [isSource, node.id, connectTask]
  );

  // Handle item selection (single click)
  const handleItemClick = useCallback(
    (e: React.MouseEvent) => {
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
    },
    [
      node,
      isColumn,
      isTable,
      isView,
      isSource,
      isSchema,
      isFolder,
      isConnected,
      hasChildren,
      nodeId,
      isOpen,
      onSourceSelect,
      setSelectedNodeId,
      setNodeExpanded
    ]
  );

  // Handle chevron click to toggle children visibility
  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setNodeExpanded(nodeId, !isOpen);
    },
    [nodeId, isOpen, setNodeExpanded]
  );

  // Handle double-click behavior
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
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
          onTableDoubleClick(node.sourceId, node.name, nodeType, parentContext?.schemaName);
        }
      }
    },
    [
      isColumn,
      isTable,
      isView,
      node,
      isSource,
      isConnected,
      hasChildren,
      nodeId,
      isOpen,
      isSchema,
      isFolder,
      onTableDoubleClick,
      parentContext,
      handleConnectClick,
      setNodeExpanded
    ]
  );

  const disconnectSource = useCallback(
    async (sourceId: string) => {
      disconnectMutation.mutate(sourceId);
    },
    [disconnectMutation]
  );

  return {
    handleItemClick,
    handleDoubleClick,
    handleChevronClick,
    handleConnectClick,
    disconnectSource
  };
};
