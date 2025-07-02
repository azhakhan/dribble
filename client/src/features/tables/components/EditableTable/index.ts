// Main component
export { EditableTable } from "./EditableTable";

// Hooks
export { useTableData } from "./hooks/useTableData";
export { useTableSelection } from "./hooks/useTableSelection";
export { useTableEditing } from "./hooks/useTableEditing";

// Re-export types for convenience
export type { ColumnDefinition, TableData } from "@/shared/types/api";
