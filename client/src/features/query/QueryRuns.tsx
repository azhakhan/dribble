"use client";

import { useEffect, useState } from "react";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
  ArrowLeftIcon,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useAppStore } from "@/shared/store/useAppStore";
import { type QueryRun } from "@/shared/lib/api";

interface QueryRunsProps {
  queryId: string;
  onBack: () => void;
  sourceName: string;
  queryName: string;
}

// Status badge component
function StatusBadge({ run }: { run: QueryRun }) {
  if (run.error_message) {
    return (
      <div className="flex items-center gap-1 text-red-500">
        <XCircle size={14} />
        <span className="text-xs font-medium">Failed</span>
      </div>
    );
  } else if (run.result_message) {
    return (
      <div className="flex items-center gap-1 text-green-600">
        <CheckCircle size={14} />
        <span className="text-xs font-medium">Success</span>
      </div>
    );
  } else {
    return (
      <div className="flex items-center gap-1 text-yellow-600">
        <Clock size={14} />
        <span className="text-xs font-medium">Running</span>
      </div>
    );
  }
}

// Column definitions
const columns: ColumnDef<QueryRun>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => (
      <div className="font-mono text-xs max-w-[90px] truncate" title={row.getValue("id")}>
        {row.getValue("id")}
      </div>
    )
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge run={row.original} />
  },
  {
    id: "message",
    header: "Message",
    cell: ({ row }) => {
      const run = row.original;
      const message = run.error_message || run.result_message || "-";

      return <div className={`whitespace-normal text-md`}>{message}</div>;
    }
  },
  {
    accessorKey: "row_count",
    header: "Rows",
    cell: ({ row }) => {
      const count = row.getValue("row_count") as number;
      return <div className="text-right">{count?.toLocaleString() ?? "-"}</div>;
    }
  },
  {
    accessorKey: "execution_time_ms",
    header: "Duration",

    cell: ({ row }) => {
      const timeMs = row.getValue("execution_time_ms") as number;
      if (timeMs == null) return <div className="text-right">-</div>;
      const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
      };
      return <div className="text-right font-mono text-xs">{formatDuration(timeMs)}</div>;
    }
  },
  {
    accessorKey: "created_at",
    header: "Run Time ",
    cell: ({ row }) => {
      const date = new Date(row.getValue("created_at"));
      return (
        <div className="text-xs text-muted-foreground">
          {date.toLocaleDateString()}{" "}
          {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      );
    }
  }
];

export function QueryRuns({ queryId, onBack, sourceName, queryName }: QueryRunsProps) {
  const { queryRuns, queryRunsPagination, loadingRuns, loadQueryRunsPaginated } = useAppStore();
  const [rowSelection, setRowSelection] = useState({});
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 25
  });

  const runs = queryRuns[queryId] || [];
  const paginationInfo = queryRunsPagination[queryId];
  const isLoading = loadingRuns.has(queryId);

  // Load data when component mounts or pagination changes
  useEffect(() => {
    loadQueryRunsPaginated(queryId, pagination.pageIndex + 1, pagination.pageSize);
  }, [queryId, pagination.pageIndex, pagination.pageSize, loadQueryRunsPaginated]);

  const table = useReactTable({
    data: runs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true, // Enable manual pagination
    pageCount: paginationInfo?.total_pages ?? 1,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    state: {
      rowSelection,
      pagination
    }
  });

  if (isLoading && runs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading runs...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between gap-2 p-2 border-b">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-xs">
            <ArrowLeftIcon size={14} />
            Back to Editor
          </Button>

          <div className="flex items-center gap-1">
            <span className="truncate text-sm text-muted-foreground">
              {sourceName || "No source selected"}
            </span>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="truncate text-sm relative group" style={{ minWidth: 0 }}>
              {queryName || "Untitled query"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs">
            Query Runs ({paginationInfo?.total ?? runs.length})
            {isLoading && <span className="text-xs text-muted-foreground ml-2">(Loading...)</span>}
          </span>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-auto p-3">
        <div className="w-full space-y-4">
          {/* Table */}
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    {isLoading ? "Loading..." : "No runs found for this query."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between space-x-2 py-4 px-2">
            <div className="text-xs text-muted-foreground">
              {paginationInfo ? (
                <>
                  Showing {(paginationInfo.page - 1) * paginationInfo.page_size + 1} to{" "}
                  {Math.min(paginationInfo.page * paginationInfo.page_size, paginationInfo.total)}{" "}
                  of {paginationInfo.total} entries
                </>
              ) : (
                `Showing ${runs.length} entries`
              )}
            </div>

            <div className="flex items-center space-x-6">
              {/* Rows per page selector */}
              <div className="flex items-center space-x-2">
                <p className="text-xs font-medium">Rows per page</p>
                <select
                  value={table.getState().pagination.pageSize}
                  onChange={(e) => {
                    table.setPageSize(Number(e.target.value));
                  }}
                  className="h-7 w-[70px] rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {[10, 20, 25, 30, 50, 100].map((pageSize) => (
                    <option key={pageSize} value={pageSize}>
                      {pageSize}
                    </option>
                  ))}
                </select>
              </div>

              {/* Page navigation */}
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                  className="text-xs cursor-pointer"
                >
                  <ChevronsLeft size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="text-xs cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </Button>

                {/* Page numbers */}
                <div className="flex items-center space-x-1">
                  {(() => {
                    const currentPage = table.getState().pagination.pageIndex + 1;
                    const totalPages = table.getPageCount();
                    const pages = [];

                    // Show first page
                    if (currentPage > 3) {
                      pages.push(
                        <Button
                          key={1}
                          variant={1 === currentPage ? "default" : "ghost"}
                          size="xs"
                          onClick={() => table.setPageIndex(0)}
                          className="h-6 w-6 p-0 text-xs"
                        >
                          1
                        </Button>
                      );
                      if (currentPage > 4) {
                        pages.push(
                          <span key="ellipsis1" className="text-xs">
                            ...
                          </span>
                        );
                      }
                    }

                    // Show pages around current page
                    for (
                      let i = Math.max(1, currentPage - 2);
                      i <= Math.min(totalPages, currentPage + 2);
                      i++
                    ) {
                      pages.push(
                        <Button
                          key={i}
                          variant={i === currentPage ? "default" : "ghost"}
                          size="xs"
                          onClick={() => table.setPageIndex(i - 1)}
                          className="h-6 w-6 p-0 text-xs cursor-pointer"
                        >
                          {i}
                        </Button>
                      );
                    }

                    // Show last page
                    if (currentPage < totalPages - 2) {
                      if (currentPage < totalPages - 3) {
                        pages.push(
                          <span key="ellipsis2" className="text-xs">
                            ...
                          </span>
                        );
                      }
                      pages.push(
                        <Button
                          key={totalPages}
                          variant={totalPages === currentPage ? "default" : "ghost"}
                          size="xs"
                          onClick={() => table.setPageIndex(totalPages - 1)}
                          className="h-6 w-6 p-0 text-xs font-thin cursor-pointer"
                        >
                          {totalPages}
                        </Button>
                      );
                    }

                    return pages;
                  })()}
                </div>

                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="text-xs cursor-pointer"
                >
                  <ChevronRight size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                  className="text-xs cursor-pointer"
                >
                  <ChevronsRight size={14} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
