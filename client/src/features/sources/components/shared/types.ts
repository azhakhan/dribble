export interface TreeNodeBase {
  id?: string;
  name: string;
  type: string;
}

export interface TreeItemProps {
  level?: number;
  isSelected?: boolean;
  isExpanded?: boolean;
  hasChildren?: boolean;
  isLoading?: boolean;
}

export interface TreeActions {
  onItemClick?: (e: React.MouseEvent) => void;
  onItemDoubleClick?: (e: React.MouseEvent) => void;
  onChevronClick?: (e: React.MouseEvent) => void;
}

export interface SourceIconProps {
  dbtype?: string;
  isLoading?: boolean;
  size?: number;
}
