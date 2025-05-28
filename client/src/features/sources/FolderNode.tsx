import React, { useState } from "react";
import { Folder } from "lucide-react";
import { TreeItem } from "./TreeItem";
import { type NodeProps } from "./FileTreeTypes";
import { useAppStore } from "@/shared/store/useAppStore";

// Import components
import { SourceNode } from "./SourceNode";
import { SchemaNode } from "./SchemaNode";
import { TableNode } from "./TableNode";

export const FolderNode: React.FC<NodeProps> = ({
  node,
  level = 0,
  onSourceSelect,
  onTableDoubleClick
}) => {
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
      setIsOpen(!isOpen);
    }
  };

  const renderChildren = () => (
    <div>
      {node.children &&
        node.children.map((child, index) => {
          if (child.type === "source") {
            return (
              <SourceNode
                key={index}
                node={child}
                level={level + 1}
                onSourceSelect={onSourceSelect}
                onTableDoubleClick={onTableDoubleClick}
              />
            );
          } else if (child.type === "schema") {
            return (
              <SchemaNode
                key={index}
                node={child}
                level={level + 1}
                onSourceSelect={onSourceSelect}
                onTableDoubleClick={onTableDoubleClick}
              />
            );
          } else if (child.type === "table") {
            return (
              <TableNode
                key={index}
                node={child}
                level={level + 1}
                onSourceSelect={onSourceSelect}
                onTableDoubleClick={onTableDoubleClick}
              />
            );
          } else if (child.type === "folder") {
            return (
              <FolderNode
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
      <Folder className="h-4 w-4" strokeWidth={1} />
      <span className="text-sm font-light">{node.name}</span>
    </TreeItem>
  );
};
