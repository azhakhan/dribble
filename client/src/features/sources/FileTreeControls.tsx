import { Button } from "@/components/ui/button";
import { PlusCircle, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { AddSource } from "./dialogs/AddSource";

interface FileTreeHeaderProps {
  title?: string;
}

export const FileTreeHeader = ({ title = "Sources" }: FileTreeHeaderProps) => {
  return (
    <div className="p-2 font-semibold border-b flex items-center justify-between">
      <span>{title}</span>
      <AddSource className="hover:text-foreground text-muted-foreground" />
    </div>
  );
};

interface EmptyStateProps {
  message?: string;
}

export const FileTreeEmptyState = ({ message = "No sources found" }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center text-muted-foreground p-4 text-sm">
      <p className="mb-2">{message}</p>
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-1"
        onClick={() => {
          // This is just a placeholder to open the add source dialog
          const addButton = document.querySelector('[data-testid="add-source-button"]');
          if (addButton) {
            (addButton as HTMLButtonElement).click();
          }
        }}
      >
        <PlusCircle className="h-4 w-4" />
        Add Source
      </Button>
    </div>
  );
};

interface SourceDropdownProps {
  dropdownOpen: boolean;
  setDropdownOpen: (open: boolean) => void;
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export const SourceDropdown = ({
  dropdownOpen,
  setDropdownOpen,
  onEdit,
  onRename,
  onDelete
}: SourceDropdownProps) => {
  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
        >
          <MoreVertical className="h-3 w-3" />
          <span className="sr-only">Source options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDropdownOpen(false);
            setTimeout(() => onEdit(), 100);
          }}
        >
          Edit Credentials
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDropdownOpen(false);
            setTimeout(() => onRename(), 100);
          }}
        >
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDropdownOpen(false);
            setTimeout(() => onDelete(), 100);
          }}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
