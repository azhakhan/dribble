import React from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { TreeItemProps } from "./FileTreeTypes";

export const TreeItem: React.FC<TreeItemProps> = ({
  level = 0,
  isOpen,
  isSelected,
  hasChildren,
  handleItemClick,
  handleDoubleClick,
  handleChevronClick,
  children,
  renderChildren
}) => {
  const renderChevron = () => {
    if (hasChildren) {
      return (
        <div onClick={handleChevronClick}>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 cursor-pointer" />
          ) : (
            <ChevronRight className="h-4 w-4 cursor-pointer" />
          )}
        </div>
      );
    }
    // Return empty div with same width to maintain alignment
    return <div className="w-4"></div>;
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 hover:bg-accent cursor-pointer select-none group ${
          isSelected ? "bg-accent" : ""
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleItemClick}
        onDoubleClick={handleDoubleClick}
      >
        {renderChevron()}
        {children}
      </div>

      {isOpen && renderChildren()}
    </div>
  );
};
