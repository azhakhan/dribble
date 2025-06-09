import { useState, useMemo } from "react";
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
import { getQueries, getSources } from "@/shared/lib/api";
import { useAppStore } from "@/shared/store/useAppStore";
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
  const { updateQueryName } = useAppStore();

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
            className="h-4 w-4 ml-1 hover:bg-accent"
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
  const [isOpen, setIsOpen] = useState(false);

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSourceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Optionally handle source selection
  };

  const handleCreateQuery = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement create query functionality
    console.log("Create query for source:", source.id);
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
        onClick={handleSourceClick}
      >
        {/* Chevron for expandable items */}
        <div className="w-4 h-4 mr-1 flex items-center justify-center" onClick={handleChevronClick}>
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
  // Fetch queries grouped by source
  const {
    data: queriesData,
    isLoading: queriesLoading,
    error: queriesError
  } = useQuery({
    queryKey: ["queries"],
    queryFn: getQueries
  });

  // Fetch sources to get source names and types
  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: getSources
  });

  // Create a map of source ID to source data for easy lookup
  const sourceMap = useMemo(() => {
    if (!sources) return new Map();
    return new Map(sources.map((source) => [source.id, source]));
  }, [sources]);

  // Prepare data for rendering
  const sourceQueriesData = useMemo(() => {
    if (!queriesData || !sources) return [];

    return Object.entries(queriesData)
      .map(([sourceId, queries]) => {
        const source = sourceMap.get(sourceId);
        return {
          source: source || { id: sourceId, name: `Unknown Source`, dbtype: "unknown" },
          queries: queries || []
        };
      })
      .filter((item) => item.source);
  }, [queriesData, sources, sourceMap]);

  if (queriesLoading || sourcesLoading) {
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
