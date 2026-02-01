"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TableColumn<T> {
  key?: string;
  header: React.ReactNode;
  accessor?: string | ((item: T, index: number) => React.ReactNode);
  className?: string;
  align?: "left" | "center" | "right";
  render?: (item: T, index: number) => React.ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  loading = false,
  emptyMessage = "No data found",
  className,
}: TableProps<T>) {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <div
      className={cn(
        "bg-white dark:bg-background-dark rounded-xl border border-border-light dark:border-gray-800 shadow-sm overflow-hidden",
        className,
      )}
    >
      <div className="overflow-x-auto scroll-smooth">
        <table className="w-full text-left border-collapse min-w-max">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-border-light dark:border-gray-800">
              {columns.map((column, colIndex) => (
                <th
                  key={column.key || `col-${colIndex}`}
                  className={cn(
                    "px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400",
                    alignClasses[column.align || "left"],
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-500">
                    <span className="material-symbols-outlined animate-spin">
                      progress_activity
                    </span>
                    <span>Loading...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={keyExtractor(item)}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {columns.map((column, colIndex) => {
                    // Determine cell content: render > accessor (function) > accessor (string) > key
                    let cellContent: React.ReactNode;
                    if (column.render) {
                      cellContent = column.render(item, index);
                    } else if (typeof column.accessor === "function") {
                      cellContent = column.accessor(item, index);
                    } else if (typeof column.accessor === "string") {
                      cellContent = (item as any)[column.accessor];
                    } else if (column.key) {
                      cellContent = (item as any)[column.key];
                    }

                    return (
                      <td
                        key={column.key || `cell-${colIndex}`}
                        className={cn(
                          "px-6 py-5",
                          alignClasses[column.align || "left"],
                          column.className,
                        )}
                      >
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Pagination Component
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  className,
}: PaginationProps) {
  const startItem = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    pages.push(1);

    if (currentPage > 3) {
      pages.push("ellipsis");
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("ellipsis");
    }

    pages.push(totalPages);

    return pages;
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between p-6 bg-white dark:bg-background-dark border-x border-b border-border-light dark:border-gray-800 rounded-b-xl",
        className,
      )}
    >
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Showing{" "}
        <span className="font-bold text-gray-900 dark:text-white">
          {startItem} to {endItem}
        </span>{" "}
        of{" "}
        <span className="font-bold text-gray-900 dark:text-white">
          {totalItems.toLocaleString()}
        </span>{" "}
        results
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex size-10 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-lg">
            chevron_left
          </span>
        </button>

        {getPageNumbers().map((page, index) =>
          page === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="text-sm font-medium flex size-10 items-center justify-center text-gray-500"
            >
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={cn(
                "text-sm font-medium flex size-10 items-center justify-center rounded-lg transition-colors",
                currentPage === page
                  ? "bg-primary text-white font-bold"
                  : "text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
            >
              {page}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex size-10 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-lg">
            chevron_right
          </span>
        </button>
      </div>
    </div>
  );
}
