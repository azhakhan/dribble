import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useAppStore } from "@/shared/store/useAppStore";

interface TableFilterBarProps {
  data: object[] | null;
  isLoading: boolean;
}

export const TableFilterBar = ({ data, isLoading }: TableFilterBarProps) => {
  const {
    activeTabId,
    getTabFilterState,
    setTableFilterOffset,
    setTableFilterWhere,
    setTableFilterOrderBy,
    clearTableFilters,
    executeQuery
  } = useAppStore();

  const tabId = activeTabId || "default";
  const { currentOffset, whereInput, orderByInput, pageSize, displaySize } =
    getTabFilterState(tabId);

  // Calculate pagination state
  const dataLength = data?.length || 0;
  const hasNextPage = dataLength === pageSize; // If we got 501 records, there might be more
  const hasPrevPage = currentOffset > 0;
  const currentPage = Math.floor(currentOffset / displaySize) + 1;

  // Check if any filters are active
  const hasActiveFilters = whereInput.trim() || orderByInput.trim();

  const handlePrevPage = async () => {
    const newOffset = Math.max(0, currentOffset - displaySize);
    setTableFilterOffset(newOffset);

    // Execute query with new pagination
    if (activeTabId) {
      try {
        await executeQuery(activeTabId);
      } catch (error) {
        console.error("Failed to execute query for pagination:", error);
      }
    }
  };

  const handleNextPage = async () => {
    const newOffset = currentOffset + displaySize;
    setTableFilterOffset(newOffset);

    // Execute query with new pagination
    if (activeTabId) {
      try {
        await executeQuery(activeTabId);
      } catch (error) {
        console.error("Failed to execute query for pagination:", error);
      }
    }
  };

  const handleWhereSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
          <Input
            value={whereInput}
            onChange={(e) => setTableFilterWhere(e.target.value)}
            placeholder="condition"
            className="h-6 text-xs w-32"
            disabled={isLoading}
          />
        </form>

        {/* Order by input */}
        <form onSubmit={handleOrderBySubmit} className="flex items-center gap-1">
          <span className="text-muted-foreground">ORDER BY:</span>
          <Input
            value={orderByInput}
            onChange={(e) => setTableFilterOrderBy(e.target.value)}
            placeholder="column"
            className="h-6 text-xs w-32"
            disabled={isLoading}
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
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={!hasPrevPage || isLoading}
            className="h-6 w-6 p-0"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>

          <span className="text-muted-foreground">Page {currentPage}</span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!hasNextPage || isLoading}
            className="h-6 w-6 p-0"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};
