import React, { useState, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTreeStore, useQueryStore } from "@/shared/store";
import type { Source, Query } from "@/shared/lib/api";
import { TreeChevron } from "../shared/TreeChevron";
import { SourceIcon } from "../shared/TreeIcons";
import { QueryTreeItem } from "./QueryTreeItem";
import { CreateQuery } from "../../../query/dialogs/CreateQuery";

interface QueryTreeSourceProps {
  source: Source;
  queries: Query[];
  onQuerySelect?: (query: Query) => void;
  onQueryDoubleClick?: (query: Query) => void;
  selectedQueryId?: string;
}

export const QueryTreeSource: React.FC<QueryTreeSourceProps> = ({
  source,
  queries,
  onQuerySelect,
  onQueryDoubleClick,
  selectedQueryId
}) => {
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

  return (
    <div>
      <div
        className="flex items-center py-1 px-2 text-sm cursor-pointer hover:bg-accent/50"
        onClick={handleClick}
        onDoubleClick={handleClick}
      >
        {/* Chevron for expandable items */}
        <TreeChevron isExpanded={isOpen} hasChildren={queries.length > 0} onClick={handleClick} />

        {/* Source icon */}
        <div className="mr-1.5 flex items-center">
          <SourceIcon dbtype={source.dbtype} size={4} />
        </div>

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
