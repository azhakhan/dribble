import React from "react";
import { Columns } from "lucide-react";
import { TreeItem } from "./TreeItem";
import { type NodeProps } from "./FileTreeTypes";
import { useAppStore } from "@/shared/store/useAppStore";
import { getColumnTypeIcon } from "./ColumnTypeIcons";

export const ColumnNode: React.FC<NodeProps> = ({ node, level = 0 }) => {
  const { selectedNodeId, setSelectedNodeId } = useAppStore();

  const isSelected = selectedNodeId === node.id;

  // Handle item selection (single click)
  const handleItemClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.id) {
      setSelectedNodeId(node.id);
    }
  };

  // Column nodes don't have children, so these are no-ops
  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const renderIcon = () => {
    // If it's a column, use the column type icon instead of the generic Columns icon
    if (node.dataType) {
      return getColumnTypeIcon(node.dataType);
    }
    return <Columns className="h-4 w-4" strokeWidth={1} />;
  };

  // Columns don't have children
  const renderChildren = () => null;

  return (
    <TreeItem
      node={node}
      level={level}
      isOpen={false}
      isSelected={isSelected}
      hasChildren={false}
      handleItemClick={handleItemClick}
      handleDoubleClick={handleDoubleClick}
      handleChevronClick={handleChevronClick}
      renderChildren={renderChildren}
    >
      {renderIcon()}
      <span className="text-sm font-light">{node.name}</span>
      {node.nullable === false && <span className="text-xs text-red-500 ml-1">*</span>}
    </TreeItem>
  );
};
