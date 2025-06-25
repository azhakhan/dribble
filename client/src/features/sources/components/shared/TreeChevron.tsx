import React from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

interface TreeChevronProps {
  isExpanded: boolean;
  hasChildren: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export const TreeChevron: React.FC<TreeChevronProps> = ({ isExpanded, hasChildren, onClick }) => {
  return (
    <div className="w-4 h-4 mr-1 flex items-center justify-center" onClick={onClick}>
      {hasChildren &&
        (isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
    </div>
  );
};
