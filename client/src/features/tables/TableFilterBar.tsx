import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useAppStore } from "@/shared/store/useAppStore";
import { useState, useEffect } from "react";
import { MiniMonacoSQL } from "@/components/ui/mini-monaco-sql";
import { usePagination } from "./hooks/usePagination";
import { PageSizeSelector } from "./components/PageSizeSelector";

interface TableFilterBarProps {
  data: object[] | null;
  isLoading: boolean;
  columns?: Array<{ name: string; type: string }>;
}

export const TableFilterBar = ({ data, isLoading, columns }: TableFilterBarProps) => {
  const {
    activeTabId,
    getTabFilterState,
    setTableFilterWhere,
    setTableFilterOrderBy,
    clearTableFilters,
    executeQuery
  } = useAppStore();

  const tabId = activeTabId || "default";
  const { whereInput, orderByInput } = getTabFilterState(tabId);

  // Use the new pagination hook
  const {
    state: paginationState,
    actions: paginationActions,
    pageSize: displaySize
  } = usePagination({ data, isLoading });

  // Local state for input fields to improve typing performance
  const [localWhereInput, setLocalWhereInput] = useState(whereInput);
  const [localOrderByInput, setLocalOrderByInput] = useState(orderByInput);

  // Sync local state with store state when it changes externally
  useEffect(() => {
    setLocalWhereInput(whereInput);
  }, [whereInput]);

  useEffect(() => {
    setLocalOrderByInput(orderByInput);
  }, [orderByInput]);

  // Debounced update for WHERE input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localWhereInput !== whereInput) {
        setTableFilterWhere(localWhereInput);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localWhereInput, whereInput, setTableFilterWhere]);

  // Debounced update for ORDER BY input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localOrderByInput !== orderByInput) {
        setTableFilterOrderBy(localOrderByInput);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localOrderByInput, orderByInput, setTableFilterOrderBy]);

  // Check if any filters are active (use store values for this check)
  const hasActiveFilters = whereInput.trim() || orderByInput.trim();

  const handleWhereSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Immediately sync local state to store state
    if (localWhereInput !== whereInput) {
      setTableFilterWhere(localWhereInput);
    }

    // Execute query with updated filters
    if (activeTabId) {
      try {
        await executeQuery(activeTabId);
      } catch (error) {
        console.error("Failed to execute query for WHERE filter:", error);
      }
    }
  };

  const handleOrderBySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Immediately sync local state to store state
    if (localOrderByInput !== orderByInput) {
      setTableFilterOrderBy(localOrderByInput);
    }

    // Execute query with updated filters
    if (activeTabId) {
      try {
        await executeQuery(activeTabId);
      } catch (error) {
        console.error("Failed to execute query for ORDER BY filter:", error);
      }
    }
  };

  const handleClearFilters = async () => {
    clearTableFilters();

    // Also clear local state
    setLocalWhereInput("");
    setLocalOrderByInput("");

    // Execute query with cleared filters
    if (activeTabId) {
      try {
        await executeQuery(activeTabId);
      } catch (error) {
        console.error("Failed to execute query after clearing filters:", error);
      }
    }
  };

  return (
    <div className="flex-shrink-0 p-2 border-b space-y-2">
      {/* Filter inputs and pagination */}
      <div className="flex items-center gap-2 text-xs">
        {/* Where clause input */}
        <form onSubmit={handleWhereSubmit} className="flex items-center gap-1">
          <span className="text-muted-foreground">WHERE:</span>
          <MiniMonacoSQL
            value={localWhereInput}
            onChange={(value: string) => setLocalWhereInput(value)}
            className="h-6 text-xs w-32"
            disabled={isLoading}
            mode="where"
            columns={columns}
            onEnterPress={async () => {
              // Immediately sync local state to store state
              if (localWhereInput !== whereInput) {
                setTableFilterWhere(localWhereInput);
              }
              // Execute query with updated filters
              if (activeTabId) {
                try {
                  await executeQuery(activeTabId);
                } catch (error) {
                  console.error("Failed to execute query for WHERE filter:", error);
                }
              }
            }}
          />
        </form>

        {/* Order by input */}
        <form onSubmit={handleOrderBySubmit} className="flex items-center gap-1">
          <span className="text-muted-foreground">ORDER BY:</span>
          <MiniMonacoSQL
            value={localOrderByInput}
            onChange={(value: string) => setLocalOrderByInput(value)}
            className="h-6 text-xs w-32"
            disabled={isLoading}
            mode="orderby"
            columns={columns}
            onEnterPress={async () => {
              // Immediately sync local state to store state
              if (localOrderByInput !== orderByInput) {
                setTableFilterOrderBy(localOrderByInput);
              }
              // Execute query with updated filters
              if (activeTabId) {
                try {
                  await executeQuery(activeTabId);
                } catch (error) {
                  console.error("Failed to execute query for ORDER BY filter:", error);
                }
              }
            }}
          />
        </form>

        {/* Clear filters button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            disabled={isLoading}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            title="Clear filters"
          >
            <X className="h-3 w-3" />
          </Button>
        )}

        {/* Pagination controls */}
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={paginationActions.handlePrevPage}
            disabled={!paginationState.hasPrevPage || isLoading}
            className="h-6 w-6 p-0 cursor-pointer"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>

          {/* Page size selector showing data range */}
          <PageSizeSelector
            currentPageSize={displaySize}
            onPageSizeChange={paginationActions.handlePageSizeChange}
            startIndex={paginationState.startIndex}
            endIndex={paginationState.endIndex}
            disabled={isLoading}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={paginationActions.handleNextPage}
            disabled={!paginationState.hasNextPage || isLoading}
            className="h-6 w-6 p-0 cursor-pointer"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};
