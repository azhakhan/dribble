interface TableContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onDelete?: () => void;
  onInsertRow?: () => void;
  onInsertColumn?: () => void;
}

// This component is a placeholder for future context menu functionality
// Could be extended to provide right-click context menus for table operations
export const TableContextMenu = ({
  isOpen,
  position,
  onClose,
  onCopy,
  onPaste,
  onDelete,
  onInsertRow,
  onInsertColumn
}: TableContextMenuProps) => {
  // For now, this is just a utility component that could be extended
  // in the future for custom context menu functionality

  // Explicitly mark parameters as used for linter
  void isOpen;
  void position;
  void onClose;
  void onCopy;
  void onPaste;
  void onDelete;
  void onInsertRow;
  void onInsertColumn;

  return null;
};

// Utility functions for context menu actions
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
};

export const pasteFromClipboard = async (): Promise<string | null> => {
  try {
    return await navigator.clipboard.readText();
  } catch (error) {
    console.error("Failed to paste from clipboard:", error);
    return null;
  }
};
