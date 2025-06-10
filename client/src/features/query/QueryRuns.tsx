"use client";

import { useEffect, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { ArrowLeftIcon, CheckCircle, XCircle, Clock } from "lucide-react";

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

      return <div className={`whitespace-normal break-words`}>{message}</div>;
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

export function QueryRuns({ queryId, onBack }: QueryRunsProps) {
  const { queryRuns, loadingRuns, loadQueryRuns } = useAppStore();
  const [rowSelection, setRowSelection] = useState({});

  const runs = queryRuns[queryId] || [];
  const isLoading = loadingRuns.has(queryId);

  useEffect(() => {
    loadQueryRuns(queryId);
  }, [queryId, loadQueryRuns]);

  const table = useReactTable({
    data: runs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection
    },
    initialState: {
      pagination: {
        pageSize: 25
      }
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
      <div className="flex-shrink-0 flex items-center gap-2 p-3 border-b">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-xs">
          <ArrowLeftIcon size={14} />
          Back to Editor
        </Button>
        <span className="text-sm font-medium">
          Query Runs ({runs.length})
          {isLoading && <span className="text-xs text-muted-foreground ml-2">(Loading...)</span>}
        </span>
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
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="text-sm text-muted-foreground">
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Rows per page</p>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value));
                }}
                className="h-8 w-[70px] rounded border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {[10, 20, 25, 30, 50].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
              <div className="flex items-center justify-center text-sm font-medium">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
