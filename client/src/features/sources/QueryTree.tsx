import { useState, useMemo, useEffect } from "react";
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
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState(query.name || `Query ${query.id.slice(0, 8)}`);

  // Get the centralized updateQueryName function from the store
  const { updateQueryName } = useQueryStore();

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

  const handleEdit = () => {
    setIsEditing(true);
    setDropdownOpen(false);
  };

  const handleNameSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (editingName.trim() !== query.name) {
        try {
          await updateQueryName(query.id, editingName.trim());
        } catch (error) {
          console.error("Failed to update query name:", error);
        }
      }
      setIsEditing(false);
    } else if (e.key === "Escape") {
      setEditingName(query.name || `Query ${query.id.slice(0, 8)}`);
      setIsEditing(false);
    }
  };

  const handleNameBlur = async () => {
    if (editingName.trim() !== query.name) {
      try {
        await updateQueryName(query.id, editingName.trim());
      } catch (error) {
        console.error("Failed to update query name:", error);
      }
    }
    setIsEditing(false);
  };

  return (
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
      {isEditing ? (
        <input
          type="text"
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onKeyDown={handleNameSubmit}
          onBlur={handleNameBlur}
          className="flex-grow bg-transparent border-none outline-none focus:ring-0 text-sm"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-grow truncate">{query.name || `Query ${query.id.slice(0, 8)}`}</span>
      )}

      {/* Actions dropdown */}
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 ml-1 hover:bg-accent cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-2 w-2" strokeWidth={1} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={handleEdit}>Rename</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
  const { createNewQuery } = useQueryStore();
  const isOpen = isQuerySourceExpanded(source.id);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setQuerySourceExpanded(source.id, !isOpen);
  };

  const handleCreateQuery = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newQuery = await createNewQuery({ sourceId: source.id });

      // Open the newly created query in tabs (double-click behavior)
      if (newQuery && onQueryDoubleClick) {
        onQueryDoubleClick(newQuery);
      }
    } catch (error) {
      console.error("Failed to create query:", error);
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
          variant="ghost"
          size="icon"
          className="h-4 w-4 hover:bg-accent"
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
    </div>
  );
};

export const QueryTree = ({
  onQuerySelect,
  onQueryDoubleClick,
  selectedQueryId
}: QueryTreeProps) => {
  // Get queries and sources from the centralized stores
  const { queries, setQuery } = useQueryStore();

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
      Object.entries(queriesData).forEach(([, sourceQueries]) => {
        (sourceQueries as Query[]).forEach((query: Query) => {
          // Don't overwrite if we already have a more recent version in store
          if (!queries[query.id]) {
            setQuery(query.id, query);
          }
        });
      });
    }
  }, [queriesData, queries, setQuery]);

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
