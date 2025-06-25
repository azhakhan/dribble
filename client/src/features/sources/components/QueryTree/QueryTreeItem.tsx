import React, { useState, useRef } from "react";
import { FileText, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import type { Query } from "@/shared/lib/api";
import { RenameQuery } from "../../../query/dialogs/RenameQuery";
import { DeleteQuery } from "../../../query/dialogs/DeleteQuery";

interface QueryTreeItemProps {
  query: Query;
  onQuerySelect?: (query: Query) => void;
  onQueryDoubleClick?: (query: Query) => void;
  isSelected?: boolean;
}

export const QueryTreeItem: React.FC<QueryTreeItemProps> = ({
  query,
  onQuerySelect,
  onQueryDoubleClick,
  isSelected
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleQueryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQuerySelect) {
      onQuerySelect(query);
    }
  };

  const handleQueryDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQueryDoubleClick) {
      onQueryDoubleClick(query);
    }
  };

  const handleRename = () => {
    setRenameDialogOpen(true);
    setDropdownOpen(false);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    setDropdownOpen(false);
  };

  return (
    <>
      <div
        className={`flex items-center py-1 px-2 text-sm cursor-pointer hover:bg-accent/50 ${
          isSelected ? "bg-accent text-accent-foreground" : ""
        }`}
        style={{ paddingLeft: "24px" }}
        onClick={handleQueryClick}
        onDoubleClick={handleQueryDoubleClick}
      >
        {/* Icon for query */}
        <div className="mr-1.5 flex items-center">
          <FileText className="h-4 w-4" strokeWidth={1} />
        </div>

        {/* Query name */}
        <span className="flex-grow truncate">{query.name || `Query ${query.id.slice(0, 8)}`}</span>

        {/* Actions dropdown */}
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              ref={triggerRef}
              variant="ghost"
              size="icon"
              className="h-4 w-4 ml-1 hover:bg-accent cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-2 w-2" strokeWidth={1} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={handleRename} className="text-xs cursor-pointer">
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive text-xs cursor-pointer"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialogs */}
      <RenameQuery query={query} open={renameDialogOpen} onOpenChange={setRenameDialogOpen} />
      <DeleteQuery
        query={query}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        triggerRef={triggerRef}
      />
    </>
  );
};
