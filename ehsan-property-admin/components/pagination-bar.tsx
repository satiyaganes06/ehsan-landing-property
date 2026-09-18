'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Ten is the floor: anything smaller turns browsing into paging. */
export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

interface PaginationBarProps {
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  /** Rows after filtering — what the count line reports. */
  total: number;
  onPageChange: (index: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Plural noun for the count line, e.g. "projects". */
  label?: string;
  /** Singular form, when stripping the plural's suffix would not produce it. */
  labelOne?: string;
}

/** Enough for the regular cases; irregulars pass `labelOne` instead. */
function singularise(word: string) {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/**
 * One pagination control for every list in the panel — the DataTable drives it
 * from TanStack state, the card and list views from `usePagination`, so both
 * read and behave identically.
 *
 * The bar stays visible even on a single page: it doubles as the record count,
 * which is the thing people actually look for after filtering.
 */
export function PaginationBar({
  pageIndex,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  label = 'records',
  labelOne,
}: PaginationBarProps) {
  const first = total === 0 ? 0 : pageIndex * pageSize + 1;
  const last = Math.min((pageIndex + 1) * pageSize, total);
  const multiPage = pageCount > 1;
  const noun = total === 1 ? (labelOne ?? singularise(label)) : label;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-xs tabular-nums">
        {total === 0 ? `No ${label}` : `Showing ${first}–${last} of ${total} ${noun}`}
      </p>

      <div className="flex items-center gap-3">
        <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span>Per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(0);
            }}
            aria-label="Rows per page"
            className="border-input bg-background focus-visible:ring-ring/50 h-7 rounded-md border px-1.5 text-xs tabular-nums focus-visible:ring-3 focus-visible:outline-none"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        {multiPage ? (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs tabular-nums">
              Page {pageIndex + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label="Previous page"
              onClick={() => onPageChange(pageIndex - 1)}
              disabled={pageIndex === 0}
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="Next page"
              onClick={() => onPageChange(pageIndex + 1)}
              disabled={pageIndex >= pageCount - 1}
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Client-side paging for the card and list views, which hold their whole
 * collection in memory already.
 *
 * The page index is clamped rather than stored blind: filtering a 6-page list
 * down to 2 pages while sitting on page 5 must not render an empty screen.
 */
export function usePagination<T>(items: T[], initialSize: number = DEFAULT_PAGE_SIZE) {
  const [pageSize, setPageSize] = useState(initialSize);
  const [requestedIndex, setPageIndex] = useState(0);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const pageIndex = Math.min(requestedIndex, pageCount - 1);

  useEffect(() => {
    if (requestedIndex > pageCount - 1) setPageIndex(0);
  }, [requestedIndex, pageCount]);

  const page = useMemo(
    () => items.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize),
    [items, pageIndex, pageSize],
  );

  return {
    page,
    bindings: {
      pageIndex,
      pageCount,
      pageSize,
      total: items.length,
      onPageChange: setPageIndex,
      onPageSizeChange: setPageSize,
    },
  };
}
