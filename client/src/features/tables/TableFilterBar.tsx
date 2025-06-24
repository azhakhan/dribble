import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTableFilterStore } from "@/shared/store/useTableFilterStore";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { useTabExecutionStore } from "@/shared/store/useTabExecutionStore";
import { MiniMonacoSQL } from "@/components/ui/mini-monaco-sql";
import { usePagination } from "./hooks/usePagination";
import { PageSizeSelector } from "./components/PageSizeSelector";

interface TableFilterBarProps {
  data: object[] | null;
  isLoading: boolean;
  columns?: Array<{ name: string; type: string }>;
}

export const TableFilterBar = ({ data, isLoading, columns }: TableFilterBarProps) => {
  const { activeTabId } = useTabManagerStore();
  const { executeQuery } = useTabExecutionStore();
  const {
    getTabFilterState,
    setTableFilterWhere,
    setTableFilterOrderBy,
    updateFilterAndExecuteQuery,
    clearTableFilters
  } = useTableFilterStore();

  const tabId = activeTabId || "default";
  const { whereInput, orderByInput } = getTabFilterState(tabId);

  // Use the new pagination hook
  const {
    state: paginationState,
    actions: paginationActions,
    pageSize: displaySize
  } = usePagination({ data, isLoading });

  // Check if any filters are active
  const hasActiveFilters = whereInput.trim() || orderByInput.trim();

  const handleWhereChange = (value: string) => {
    // Update store immediately
    setTableFilterWhere(value, tabId);
  };

  const handleOrderByChange = (value: string) => {
    // Update store immediately
    setTableFilterOrderBy(value, tabId);
  };

  const handleWhereSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Get fresh value from store at execution time
    const freshState = getTabFilterState(tabId);
    await updateFilterAndExecuteQuery("where", freshState.whereInput, tabId);
  };

  const handleOrderBySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Get fresh value from store at execution time
    const freshState = getTabFilterState(tabId);
    await updateFilterAndExecuteQuery("orderBy", freshState.orderByInput, tabId);
  };

  const handleWhereEnterPress = async () => {
    // Get fresh value from store at execution time
    const freshState = getTabFilterState(tabId);
    await updateFilterAndExecuteQuery("where", freshState.whereInput, tabId);
  };

  const handleOrderByEnterPress = async () => {
    // Get fresh value from store at execution time
    const freshState = getTabFilterState(tabId);
    await updateFilterAndExecuteQuery("orderBy", freshState.orderByInput, tabId);
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
          <MiniMonacoSQL
            value={whereInput}
            onChange={handleWhereChange}
            className="h-6 text-xs w-32"
            disabled={isLoading}
            mode="where"
            columns={columns}
            onEnterPress={handleWhereEnterPress}
          />
        </form>

        {/* Order by input */}
        <form onSubmit={handleOrderBySubmit} className="flex items-center gap-1">
          <span className="text-muted-foreground">ORDER BY:</span>
          <MiniMonacoSQL
            value={orderByInput}
            onChange={handleOrderByChange}
            className="h-6 text-xs w-32"
            disabled={isLoading}
            mode="orderby"
            columns={columns}
            onEnterPress={handleOrderByEnterPress}
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
