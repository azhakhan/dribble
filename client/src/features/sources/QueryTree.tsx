import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronRight, ChevronDown, Database, FileText, Plus, MoreVertical } from "lucide-react";
import { PostgresIcon, MySQLIcon, SQLiteIcon } from "../icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { getQueries } from "@/shared/lib/api";
import { useQueryStore, useTreeStore, useSourceStore } from "@/shared/store";
import type { Query, Source } from "@/shared/lib/api";
import { RenameQuery } from "../query/dialogs/RenameQuery";
import { DeleteQuery } from "../query/dialogs/DeleteQuery";
import { CreateQuery } from "../query/dialogs/CreateQuery";

interface QueryTreeProps {
  onQuerySelect?: (query: Query) => void;
  onQueryDoubleClick?: (query: Query) => void;
  selectedQueryId?: string;
}

interface QueryTreeSourceProps {
  source: Source;
  queries: Query[];
  onQuerySelect?: (query: Query) => void;
  onQueryDoubleClick?: (query: Query) => void;
  selectedQueryId?: string;
}

interface QueryTreeItemProps {
  query: Query;
  onQuerySelect?: (query: Query) => void;
  onQueryDoubleClick?: (query: Query) => void;
  isSelected?: boolean;
}

const QueryTreeItem = ({
  query,
  onQuerySelect,
  onQueryDoubleClick,
  isSelected
}: QueryTreeItemProps) => {
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
      <RenameQuery
        query={query}
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        triggerRef={triggerRef}
      />
      <DeleteQuery
        query={query}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        triggerRef={triggerRef}
      />
    </>
  );
};

const QueryTreeSource = ({
  source,
  queries,
  onQuerySelect,
  onQueryDoubleClick,
  selectedQueryId
}: QueryTreeSourceProps) => {
  // Use centralized tree state for query source expansion
  const { isQuerySourceExpanded, setQuerySourceExpanded } = useTreeStore();
  const { loadQuery } = useQueryStore();
  const isOpen = isQuerySourceExpanded(source.id);

  // State for create query dialog
  const [createQueryDialogOpen, setCreateQueryDialogOpen] = useState(false);
  const createQueryButtonRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuerySourceExpanded(source.id, !isOpen);
  };

  const handleCreateQuery = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCreateQueryDialogOpen(true);
  };

  const handleQueryCreated = async (queryId: string) => {
    try {
      // Load the newly created query to ensure it's in the store
      await loadQuery(queryId);

      // Wait a moment for the store to update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get the query from the store and open it in tabs
      const { queries } = useQueryStore.getState();
      const newQuery = queries[queryId];

      if (newQuery && onQueryDoubleClick) {
        onQueryDoubleClick(newQuery);
      } else {
        console.warn(
          "Created query not found in store:",
          queryId,
          "Available queries:",
          Object.keys(queries)
        );
      }
    } catch (error) {
      console.error("Failed to load created query:", error);
    }
  };

  const renderSourceIcon = () => {
    const dbType = source.dbtype?.toLowerCase();
    if (dbType === "postgres") {
      return (
        <div className="h-4 w-4 flex items-center justify-center">
          <PostgresIcon />
        </div>
      );
    } else if (dbType === "mysql") {
      return (
        <div className="h-4 w-4 flex items-center justify-center">
          <MySQLIcon />
        </div>
      );
    } else if (dbType === "sqlite") {
      return (
        <div className="h-4 w-4 flex items-center justify-center">
          <SQLiteIcon />
        </div>
      );
    } else {
      return <Database className="h-4 w-4" strokeWidth={1} />;
    }
  };

  return (
    <div>
      <div
        className="flex items-center py-1 px-2 text-sm cursor-pointer hover:bg-accent/50"
        onClick={handleClick}
        onDoubleClick={handleClick}
      >
        {/* Chevron for expandable items */}
        <div className="w-4 h-4 mr-1 flex items-center justify-center">
          {queries.length > 0 &&
            (isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
        </div>

        {/* Source icon */}
        <div className="mr-1.5 flex items-center">{renderSourceIcon()}</div>

        {/* Source name */}
        <span className="flex-grow truncate">{source.name}</span>

        {/* Query count */}
        <span className="text-xs text-muted-foreground mr-2">({queries.length})</span>

        {/* Add query button */}
        <Button
          ref={createQueryButtonRef}
          variant="ghost"
          size="icon"
          className="h-4 w-4 hover:bg-accent cursor-pointer"
          onClick={handleCreateQuery}
        >
          <Plus className="h-2 w-2" strokeWidth={1} />
        </Button>
      </div>

      {/* Children (queries) */}
      {isOpen && queries.length > 0 && (
        <div>
          {queries.map((query) => (
            <QueryTreeItem
              key={query.id}
              query={query}
              onQuerySelect={onQuerySelect}
              onQueryDoubleClick={onQueryDoubleClick}
              isSelected={selectedQueryId === query.id}
            />
          ))}
        </div>
      )}

      {/* Show message when no queries are found */}
      {isOpen && queries.length === 0 && (
        <div className="py-1 px-2 text-muted-foreground" style={{ paddingLeft: "32px" }}>
          <span className="text-sm font-light">No queries found</span>
        </div>
      )}

      {/* Create Query Dialog */}
      <CreateQuery
        open={createQueryDialogOpen}
        onOpenChange={setCreateQueryDialogOpen}
        source={source}
        triggerRef={createQueryButtonRef}
        onQueryCreated={handleQueryCreated}
      />
    </div>
  );
};

export const QueryTree = ({
  onQuerySelect,
  onQueryDoubleClick,
  selectedQueryId
}: QueryTreeProps) => {
  // Get queries and sources from the centralized stores
  const { queries, setQuery, removeQuery } = useQueryStore();

  const { sources: storeSourcesMap, loadSources, loadingSources } = useSourceStore();

  // Fetch queries grouped by source (for initial load only)
  const {
    data: queriesData,
    isLoading: queriesLoading,
    error: queriesError
  } = useQuery({
    queryKey: ["queries"],
    queryFn: getQueries
  });

  // Load sources from store if not already loaded
  useEffect(() => {
    if (Object.keys(storeSourcesMap).length === 0 && !loadingSources) {
      loadSources();
    }
  }, [storeSourcesMap, loadingSources, loadSources]);

  // Update store cache when fresh API data arrives
  useEffect(() => {
    if (queriesData) {
      // Get all query IDs from the API response
      const apiQueryIds = new Set<string>();
      Object.entries(queriesData).forEach(([, sourceQueries]) => {
        (sourceQueries as Query[]).forEach((query: Query) => {
          apiQueryIds.add(query.id);
          // Don't overwrite if we already have a more recent version in store
          if (!queries[query.id]) {
            setQuery(query.id, query);
          }
        });
      });

      // Remove queries from store that are no longer in the API response
      // This handles cases where queries were deleted
      const storeQueryIds = Object.keys(queries);
      storeQueryIds.forEach((queryId) => {
        // Don't remove ephemeral queries as they're not returned by the API
        const query = queries[queryId];
        if (!query.is_ephemeral && !apiQueryIds.has(queryId)) {
          // We need to add a removeQuery method to the store
          removeQuery(queryId);
        }
      });
    }
  }, [queriesData, queries, setQuery, removeQuery]);

  // Note: Removed automatic cleanup during initialization to prevent interference with persistence

  // Create sources map from store only
  const sourceMap = useMemo(() => {
    return new Map(Object.values(storeSourcesMap).map((source) => [source.id, source]));
  }, [storeSourcesMap]);

  // Group store queries by source ID, filtering out ephemeral queries for display
  const queriesBySource = useMemo(() => {
    const grouped: Record<string, Query[]> = {};
    Object.values(queries).forEach((query) => {
      // Skip ephemeral queries in the UI - they shouldn't be shown in the query tree
      if (query.is_ephemeral) return;

      if (!grouped[query.source_id]) {
        grouped[query.source_id] = [];
      }
      grouped[query.source_id].push(query);
    });
    return grouped;
  }, [queries]);

  // Prepare data for rendering - prefer store data, fallback to API data
  const sourceQueriesData = useMemo(() => {
    // Use store queries if available, otherwise fall back to API data
    const dataToUse = Object.keys(queries).length > 0 ? queriesBySource : queriesData || {};

    return Object.entries(dataToUse)
      .map(([sourceId, sourceQueries]) => {
        const source = sourceMap.get(sourceId);
        // Filter out ephemeral queries from API data as well
        const filteredQueries = Array.isArray(sourceQueries)
          ? sourceQueries.filter((query: Query) => !query.is_ephemeral)
          : sourceQueries || [];

        return {
          source: source || { id: sourceId, name: `Unknown Source`, dbtype: "unknown" },
          queries: filteredQueries
        };
      })
      .filter((item) => item.source)
      .sort((a, b) => a.source.name.localeCompare(b.source.name)); // Sort sources alphabetically
  }, [queries, queriesBySource, queriesData, sourceMap]);

  if (queriesLoading || loadingSources) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 text-sm text-muted-foreground">Loading queries...</div>
        </div>
      </div>
    );
  }

  if (queriesError) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 text-sm text-red-500">Error loading queries</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {sourceQueriesData.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No queries found</div>
        ) : (
          <div className="mt-2">
            {sourceQueriesData.map(({ source, queries }) => (
              <QueryTreeSource
                key={source.id}
                source={source}
                queries={queries}
                onQuerySelect={onQuerySelect}
                onQueryDoubleClick={onQueryDoubleClick}
                selectedQueryId={selectedQueryId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
