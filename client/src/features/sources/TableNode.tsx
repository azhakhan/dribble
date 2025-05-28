import React, { useState } from "react";
import { Table } from "lucide-react";
import { TreeItem } from "./TreeItem";
import { type NodeProps } from "./FileTreeTypes";
import { useAppStore } from "@/shared/store/useAppStore";
import { ColumnNode } from "./ColumnNode";

export const TableNode: React.FC<NodeProps> = ({ node, level = 0, onTableDoubleClick }) => {
  const { selectedNodeId, setSelectedNodeId } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);

  const hasChildren = Boolean(node.children?.length);
  const isSelected = selectedNodeId === node.id;

  // Handle item selection (single click)
  const handleItemClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.id) {
      setSelectedNodeId(node.id);
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
      // For tables with children, toggle visibility
      setIsOpen(!isOpen);
    } else if (onTableDoubleClick && node.sourceId) {
      // For tables without children, query them
      onTableDoubleClick(node.sourceId, node.name);
    }
  };

  const renderChildren = () => (
    <div>
      {node.children &&
        node.children.map((child, index) => {
          if (child.type === "column") {
            return <ColumnNode key={index} node={child} level={level + 1} />;
          }
          return null;
        })}
    </div>
  );

  return (
    <TreeItem
      node={node}
      level={level}
      isOpen={isOpen}
      isSelected={isSelected}
      hasChildren={hasChildren}
      handleItemClick={handleItemClick}
      handleDoubleClick={handleDoubleClick}
      handleChevronClick={handleChevronClick}
      renderChildren={renderChildren}
    >
      <Table className="h-4 w-4" strokeWidth={1} />
      <span className="text-sm font-light">{node.name}</span>
    </TreeItem>
  );
};
