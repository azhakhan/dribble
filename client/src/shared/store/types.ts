// Schema types
export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface SchemaForeignKey {
  column: string;
  constraint_name: string;
  references_table: string;
  references_column: string;
}

export interface SchemaRelationshipReference {
  foreign_column: string;
  local_column: string;
  table: string;
  type: string;
}

export interface SchemaRelationship {
  referenced_by: SchemaRelationshipReference[];
  references: SchemaRelationshipReference[];
}

export interface SchemaTable {
  columns: SchemaColumn[];
  primary_keys: string[];
  foreign_keys: SchemaForeignKey[];
  relationships?: SchemaRelationship;
}

export interface SchemaView {
  columns: SchemaColumn[];
}

export interface SchemaObject {
  tables: Record<string, SchemaTable>;
  views: Record<string, SchemaView>;
}

export type SourceSchemaMap = Record<string, Record<string, SchemaObject>>;

// Query tab interface
export interface QueryTab {
  id: string;
  queryId: string | null;
  sourceId: string;
  title: string;
  isDirty: boolean;
  editorContent: string;
  queryResults: object[] | null;
  queryRunning: boolean;
  selectedTableData: { sourceId: string; tableName: string; query: string } | null;
  isLoadingQuery: boolean;
  isLoadingVersions: boolean;
  lastSavedContent: string;
  originalContent: string;
}

// Pagination interface
export interface PaginationInfo {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// Table filter interface
export interface TableFilterState {
  currentOffset: number;
  whereInput: string;
  orderByInput: string;
  pageSize: number;
  displaySize: number;
}

// Tree state interface
export interface SidebarState {
  activeTab: "sources" | "queries";
  expandedNodes: Record<string, boolean>;
  expandedQuerySources: Record<string, boolean>;
}

// Proposed changes interface
export interface ProposedChanges {
  originalContent: string;
  proposedContent: string;
  message: string;
}

// Chat message interface
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sql_query?: string;
}
