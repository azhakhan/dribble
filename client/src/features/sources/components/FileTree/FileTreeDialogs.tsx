import React from "react";
import { EditSource } from "../../dialogs/EditSource";
import { RenameSource } from "../../dialogs/RenameSource";
import { DeleteSource } from "../../dialogs/DeleteSource";

interface FileTreeDialogsProps {
  isSource: boolean;
  nodeId?: string;
  nodeName: string;
  editDialogOpen: boolean;
  setEditDialogOpen: (open: boolean) => void;
  renameDialogOpen: boolean;
  setRenameDialogOpen: (open: boolean) => void;
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
}

export const FileTreeDialogs: React.FC<FileTreeDialogsProps> = ({
  isSource,
  nodeId,
  nodeName,
  editDialogOpen,
  setEditDialogOpen,
  renameDialogOpen,
  setRenameDialogOpen,
  deleteDialogOpen,
  setDeleteDialogOpen
}) => {
  if (!isSource || !nodeId) {
    return null;
  }

  return (
    <>
      <EditSource open={editDialogOpen} onOpenChange={setEditDialogOpen} sourceId={nodeId} />
      <RenameSource
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        sourceId={nodeId}
        sourceName={nodeName}
      />
      <DeleteSource
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        sourceId={nodeId}
        sourceName={nodeName}
      />
    </>
  );
};
