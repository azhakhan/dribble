import type { FileNode } from "@/shared/lib/fileTreeUtils";

export interface NodeProps {
  node: FileNode;
  level?: number;
  onSourceSelect?: (source: { id: string; name: string; dbtype: string }) => void;
  onTableDoubleClick?: (sourceId: string, tableName: string) => void;
}

export interface TreeItemProps extends NodeProps {
  isOpen: boolean;
  isSelected: boolean;
  hasChildren: boolean;
  hasError?: boolean;
  handleItemClick: (e: React.MouseEvent) => void;
  handleDoubleClick: (e: React.MouseEvent) => void;
  handleChevronClick: (e: React.MouseEvent) => void;
  renderChildren: () => React.ReactNode;
  children?: React.ReactNode;
}
