import React, { forwardRef } from "react";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

interface FileTreeActionsProps {
  isConnected: boolean;
  isLoading: boolean;
  nodeId: string | undefined;
  dropdownOpen: boolean;
  onDropdownOpenChange: (open: boolean) => void;
  onConnect: (e: React.MouseEvent) => void;
  onDisconnect: (sourceId: string) => void;
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export const FileTreeActions = forwardRef<HTMLButtonElement, FileTreeActionsProps>(
  (
    {
      isConnected,
      isLoading,
      nodeId,
      dropdownOpen,
      onDropdownOpenChange,
      onConnect,
      onDisconnect,
      onEdit,
      onRename,
      onDelete
    },
    ref
  ) => {
    return (
      <DropdownMenu open={dropdownOpen} onOpenChange={onDropdownOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={ref}
            variant="ghost"
            size="icon"
            className="h-4 w-4 ml-1 hover:bg-accent cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <MoreVertical className="h-2 w-2" strokeWidth={1} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {!isConnected && !isLoading && nodeId && (
            <>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDropdownOpenChange(false);
                  onConnect(e);
                }}
              >
                Connect
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {isConnected && nodeId && (
            <>
              <DropdownMenuItem
                className="text-destructive text-xs cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onDropdownOpenChange(false);
                  onDisconnect(nodeId);
                }}
              >
                Disconnect
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem
            className="text-xs cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onDropdownOpenChange(false);
              onEdit();
            }}
          >
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onDropdownOpenChange(false);
              onRename();
            }}
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive text-xs cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onDropdownOpenChange(false);
              onDelete();
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);
