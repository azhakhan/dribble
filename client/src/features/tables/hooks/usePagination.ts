import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { useTabExecutionStore } from "@/shared/store/useTabExecutionStore";
import { useTableFilterStore } from "@/shared/store/useTableFilterStore";
import type { TableData } from "@/shared/types/api";

interface PaginationState {
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  displayedDataSize: number;
  totalDataSize: number;
  isDataComplete: boolean;
  startIndex: number;
  endIndex: number;
}

interface PaginationActions {
  handleNextPage: () => Promise<void>;
  handlePrevPage: () => Promise<void>;
  handlePageSizeChange: (newPageSize: number) => Promise<void>;
}

interface UsePaginationProps {
  data: TableData | null;
  isLoading: boolean;
}

export const usePagination = ({
  data,
  isLoading
}: UsePaginationProps): {
  state: PaginationState;
  actions: PaginationActions;
  pageSize: number;
} => {
  const { activeTabId } = useTabManagerStore();
  const { executeQuery } = useTabExecutionStore();
  const { getTabFilterState, setTableFilterOffset, setTableFilterPageSize } = useTableFilterStore();

  const tabId = activeTabId || "default";
  const { currentOffset, pageSize, displaySize } = getTabFilterState(tabId);

  // Calculate pagination state using DataGrip logic
  const dataLength = data?.length || 0;

  // DataGrip style: if we got exactly pageSize records, there might be more
  const hasNextPage = dataLength === pageSize;
  const hasPrevPage = currentOffset > 0;

  // Calculate current page (1-based)
  const currentPage = Math.floor(currentOffset / displaySize) + 1;

  // For display, we show at most displaySize records (not the extra one)
  const displayedDataSize = Math.min(dataLength, displaySize);
  const totalDataSize = dataLength;

  // Whether all available data fits in current page
  const isDataComplete = dataLength < pageSize;

  // Calculate data range indices
  const startIndex = displayedDataSize > 0 ? currentOffset : 0;
  const endIndex = displayedDataSize > 0 ? currentOffset + displayedDataSize - 1 : 0;

  const executeQueryIfTabExists = async () => {
    if (activeTabId) {
      try {
        await executeQuery(activeTabId);
      } catch (error) {
        console.error("Failed to execute query for pagination:", error);
      }
    }
  };

  const handleNextPage = async () => {
    if (!hasNextPage || isLoading) return;

    const newOffset = currentOffset + displaySize;
    setTableFilterOffset(newOffset);
    await executeQueryIfTabExists();
  };

  const handlePrevPage = async () => {
    if (!hasPrevPage || isLoading) return;

    const newOffset = Math.max(0, currentOffset - displaySize);
    setTableFilterOffset(newOffset);
    await executeQueryIfTabExists();
  };

  const handlePageSizeChange = async (newPageSize: number) => {
    if (isLoading) return;

    // DataGrip style: set pageSize to newPageSize + 1 for "has next" detection
    setTableFilterPageSize(newPageSize);
    await executeQueryIfTabExists();
  };

  return {
    state: {
      currentPage,
      hasNextPage,
      hasPrevPage,
      displayedDataSize,
      totalDataSize,
      isDataComplete,
      startIndex,
      endIndex
    },
    actions: {
      handleNextPage,
      handlePrevPage,
      handlePageSizeChange
    },
    pageSize: displaySize
  };
};
