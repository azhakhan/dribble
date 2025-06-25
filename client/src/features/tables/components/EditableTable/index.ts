// Main component
export { EditableTable } from "./EditableTable";

// Sub-components (currently placeholders but ready for future extension)
export { TableHeader, createHeaderIcon } from "./TableHeader";
export { TableBody, validateRow, transformRowData, filterData } from "./TableBody";
export { TableCell, formatCellValue, getCellType } from "./TableCell";
export { TableContextMenu, copyToClipboard, pasteFromClipboard } from "./TableContextMenu";

// Hooks
export { useTableData } from "./hooks/useTableData";
export { useTableSelection } from "./hooks/useTableSelection";
export { useTableEditing } from "./hooks/useTableEditing";

// Re-export types for convenience
export type { ColumnDefinition, TableData } from "@/shared/types/api";
