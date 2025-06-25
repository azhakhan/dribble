import React, { useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueries } from "@/shared/lib/api";
import { useQueryStore, useSourceStore } from "@/shared/store";
import type { Query } from "@/shared/lib/api";
import { QueryTreeSource } from "./QueryTreeSource";

interface QueryTreeProps {
  onQuerySelect?: (query: Query) => void;
  onQueryDoubleClick?: (query: Query) => void;
  selectedQueryId?: string;
}

export const QueryTree: React.FC<QueryTreeProps> = ({
  onQuerySelect,
  onQueryDoubleClick,
  selectedQueryId
}) => {
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
          removeQuery(queryId);
        }
      });
    }
  }, [queriesData, queries, setQuery, removeQuery]);

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
