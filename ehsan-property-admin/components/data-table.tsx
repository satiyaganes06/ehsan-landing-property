'use client';

import { useRef, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, GripVertical, Search } from 'lucide-react';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, NoResultsState } from '@/components/states';
import { DEFAULT_PAGE_SIZE, PaginationBar } from '@/components/pagination-bar';
import { cn } from '@/lib/utils';

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[] | undefined;
  isPending?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Rendered when the dataset itself is empty (as opposed to filtered to nothing). */
  emptyState?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  searchPlaceholder?: string;
  /** Extra controls rendered beside the search box. */
  toolbar?: React.ReactNode;
  pageSize?: number;
  /** Plural noun for the pagination count line, e.g. "projects". */
  label?: string;
  reorder?: { getId: (row: TData) => string; getLabel: (row: TData) => string; onMove: (id: string, targetId: string) => void; disabled?: boolean };
}

export function DataTable<TData>({
  columns,
  data,
  isPending,
  isError,
  error,
  onRetry,
  emptyState,
  onRowClick,
  searchPlaceholder = 'Search…',
  toolbar,
  pageSize = DEFAULT_PAGE_SIZE,
  label = 'records',
  reorder,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const pointerStart = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const canReorder = Boolean(reorder && !reorder.disabled && !globalFilter && !sorting.length);

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    enableSorting: !reorder,
    getRowId: reorder ? reorder.getId : undefined,
  });

  if (isError) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  const rows = table.getRowModel().rows;
  const showEmpty = !isPending && (data?.length ?? 0) === 0;
  const showNoResults = !isPending && !showEmpty && rows.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-9 pl-8"
          />
        </div>
        {toolbar}
      </div>
      {reorder ? <p className="text-muted-foreground text-xs" role="status">{reorder.disabled ? 'Select All to reorder, or wait for the current save to finish.' : globalFilter ? 'Clear the search to reorder projects.' : 'Drag the handle to reorder. You can also focus it and use ↑ / ↓. Changes save automatically.'}</p> : null}

      <div className="bg-card overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {reorder ? <TableHead className="w-10"><span className="sr-only">Order</span></TableHead> : null}
                  {group.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();

                    return (
                      <TableHead key={header.id} className="h-9 text-xs whitespace-nowrap">
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="hover:text-foreground -mx-1 flex items-center gap-1 rounded px-1 py-0.5 transition-colors"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sorted === 'asc' ? (
                              <ArrowUp className="size-3" />
                            ) : sorted === 'desc' ? (
                              <ArrowDown className="size-3" />
                            ) : (
                              <ChevronsUpDown className="size-3 opacity-40" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {isPending
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      {reorder ? <TableCell><Skeleton className="size-4" /></TableCell> : null}
                      {columns.map((_col, j) => (
                        <TableCell key={j}>
                          <Skeleton className={cn('h-4', j === 0 ? 'w-48' : 'w-20')} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-reorder-id={reorder ? row.id : undefined}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                      className={cn(onRowClick && 'cursor-pointer', draggedId === row.id && 'opacity-40', dropId === row.id && draggedId !== row.id && 'bg-accent ring-primary ring-1 ring-inset')}
                    >
                      {reorder ? <TableCell className="w-10 py-2.5">
                        <Button variant="ghost" size="icon" className="size-8 touch-none cursor-grab active:cursor-grabbing" disabled={!canReorder}
                          aria-label={`Reorder ${reorder.getLabel(row.original)}`} title="Drag to reorder; use arrow keys to move up or down"
                          onPointerDown={event => {
                            if (!canReorder || event.button !== 0) return;
                            event.stopPropagation();
                            event.currentTarget.setPointerCapture(event.pointerId);
                            pointerStart.current = { x: event.clientX, y: event.clientY, moved: false };
                          }}
                          onPointerMove={event => {
                            const start = pointerStart.current;
                            if (!start) return;
                            if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5 && !start.moved) return;
                            start.moved = true;
                            setDraggedId(row.id);
                            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('tr')?.getAttribute('data-reorder-id');
                            setDropId(target ?? null);
                          }}
                          onPointerUp={event => {
                            const moved = pointerStart.current?.moved;
                            pointerStart.current = null;
                            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('tr')?.getAttribute('data-reorder-id');
                            if (canReorder && moved && target && target !== row.id) reorder.onMove(row.id, target);
                            setDraggedId(null); setDropId(null);
                          }}
                          onPointerCancel={() => { pointerStart.current = null; setDraggedId(null); setDropId(null); }}
                          onClick={event => event.stopPropagation()}
                          onKeyDown={event => {
                            event.stopPropagation();
                            if (!canReorder || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
                            event.preventDefault();
                            const index = (data ?? []).findIndex(item => reorder.getId(item) === row.id);
                            const target = data?.[index + (event.key === 'ArrowUp' ? -1 : 1)];
                            if (target) reorder.onMove(row.id, reorder.getId(target));
                          }}
                        ><GripVertical className="size-4" /></Button>
                      </TableCell> : null}
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-2.5">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>

        {showEmpty ? <div className="p-2">{emptyState}</div> : null}
        {showNoResults ? (
          <div className="p-2">
            <NoResultsState onClear={() => setGlobalFilter('')} />
          </div>
        ) : null}
      </div>

      {table.getFilteredRowModel().rows.length > 0 ? (
        <PaginationBar
          pageIndex={table.getState().pagination.pageIndex}
          pageCount={table.getPageCount()}
          pageSize={table.getState().pagination.pageSize}
          total={table.getFilteredRowModel().rows.length}
          onPageChange={(index: number) => table.setPageIndex(index)}
          onPageSizeChange={(size: number) => table.setPageSize(size)}
          label={label}
        />
      ) : null}

    </div>
  );
}
