'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ImageOff, Images, Loader2, Trash2, Upload } from 'lucide-react';

import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/animate-ui/components/radix/sheet';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, NoResultsState } from '@/components/states';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PaginationBar, usePagination } from '@/components/pagination-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError, uploadFile } from '@/lib/api';
import { mediaSrc } from '@/lib/media';
import { useSession } from '@/lib/session';
import type { MediaItem } from '@/lib/types';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'missing-alt';

export default function MediaPage() {
  return (
    <Suspense fallback={null}>
      <MediaLibrary />
    </Suspense>
  );
}

function MediaLibrary() {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const { can } = useSession();
  const fileInput = useRef<HTMLInputElement>(null);

  const [filter, setFilter] = useState<Filter>(
    params.get('filter') === 'missing-alt' ? 'missing-alt' : 'all',
  );
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [alt, setAlt] = useState('');
  const [pendingDelete, setPendingDelete] = useState<MediaItem | null>(null);

  const query = useQuery({
    queryKey: ['media'],
    queryFn: () => api.get<MediaItem[]>('/api/media'),
  });

  useEffect(() => {
    setAlt(selected?.altText ?? '');
  }, [selected]);

  const items = useMemo(() => {
    let list = query.data ?? [];
    if (filter === 'missing-alt') list = list.filter((m) => !m.altText);
    if (search.trim()) {
      const needle = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.filename.toLowerCase().includes(needle) ||
          (m.altText ?? '').toLowerCase().includes(needle),
      );
    }
    return list;
  }, [query.data, filter, search]);

  const missingAlt = (query.data ?? []).filter((m) => !m.altText).length;

  // Paged from the FILTERED list, so search and the missing-description
  // filter reset the range rather than paging through hidden rows.
  const { page: mediaPage, bindings: mediaBindings } = usePagination(items);

  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      for (const file of Array.from(files)) {
        await uploadFile<MediaItem>('/api/media/upload', file);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success('Uploaded.');
    },
    onError: (err) =>
      toast.error('Upload failed', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  const saveAlt = useMutation({
    mutationFn: () => api.patch(`/api/media/${selected!.id}/alt`, { altText: alt }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['media'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      toast.success('Description saved.');
      setSelected(null);
    },
    onError: (err) =>
      toast.error('Could not save', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/media/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success('Image deleted.');
      setPendingDelete(null);
      setSelected(null);
    },
    onError: (err) =>
      toast.error('Could not delete', {
        description:
          err instanceof ApiError
            ? err.message
            : 'It may still be used by a project or event.',
      }),
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Media"
        description="Every image available to projects, events and awards."
        actions={
          can('media', 'create') ? (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files?.length) upload.mutate(e.target.files);
                  e.target.value = '';
                }}
              />
              <Button onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
                {upload.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                {upload.isPending ? 'Uploading…' : 'Upload'}
              </Button>
            </>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by filename or description…"
          aria-label="Search media"
          className="h-9 max-w-xs"
        />
        <Button
          variant={filter === 'all' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-9"
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          variant={filter === 'missing-alt' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-9"
          onClick={() => setFilter('missing-alt')}
        >
          Missing description
          {missingAlt > 0 ? (
            <span className="bg-sand-soft text-sand ml-1 rounded-full px-1.5 text-[0.6875rem] tabular-nums">
              {missingAlt}
            </span>
          ) : null}
        </Button>
      </div>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : (query.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Images}
          title="No images yet"
          description="Upload images here, then attach them to a project or event."
        />
      ) : items.length === 0 ? (
        <NoResultsState
          onClear={() => {
            setSearch('');
            setFilter('all');
          }}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {mediaPage.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className="group bg-card hover:border-brass-line/60 overflow-hidden rounded-lg border text-left transition-colors"
            >
              <div className="bg-muted aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaSrc(item.storageKey, item.url)}
                  alt={item.altText || `${item.filename} — no description added yet`}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </div>
              <div className="space-y-1 p-2">
                <p className="truncate text-xs font-medium">{item.filename}</p>
                {item.altText ? (
                  <p className="text-muted-foreground truncate text-[0.6875rem]">{item.altText}</p>
                ) : (
                  <p className="text-sand flex items-center gap-1 text-[0.6875rem]">
                    <ImageOff className="size-3" />
                    No description
                  </p>
                )}
              </div>
            </button>
          ))}
          </div>
          <PaginationBar {...mediaBindings} label="images" />
        </div>
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(next) => (next ? null : setSelected(null))}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="truncate">{selected?.filename}</SheetTitle>
            <SheetDescription>
              A description helps screen readers and search engines understand the image.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            {selected ? (
              <>
                <div className="bg-muted overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaSrc(selected.storageKey, selected.url)}
                    alt={selected.altText || `${selected.filename} — no description added yet`}
                    className="max-h-72 w-full object-contain"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alt">Description</Label>
                  <Input
                    id="alt"
                    value={alt}
                    maxLength={200}
                    disabled={!can('media', 'update')}
                    onChange={(e) => setAlt(e.target.value)}
                    placeholder="e.g. Aerial view of the completed terrace homes"
                  />
                  <p
                    className={cn(
                      'text-xs',
                      alt.length > 180 ? 'text-sand' : 'text-muted-foreground',
                    )}
                  >
                    {alt.length}/200 characters
                  </p>
                </div>

                <dl className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="font-medium">Type</dt>
                    <dd className="font-mono">{selected.mimeType}</dd>
                  </div>
                  {selected.width && selected.height ? (
                    <div>
                      <dt className="font-medium">Size</dt>
                      <dd className="font-mono">
                        {selected.width}×{selected.height}
                      </dd>
                    </div>
                  ) : null}
                  <div className="col-span-2">
                    <dt className="font-medium">Added</dt>
                    <dd className="font-mono">
                      {new Date(selected.createdAt).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
              </>
            ) : null}
          </div>

          <SheetFooter className="flex-row justify-between gap-2">
            {can('media', 'delete') ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => selected && setPendingDelete(selected)}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Close
              </Button>
              {can('media', 'update') ? (
                <Button
                  size="sm"
                  disabled={alt === (selected?.altText ?? '') || saveAlt.isPending}
                  onClick={() => saveAlt.mutate()}
                >
                  {saveAlt.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Save
                </Button>
              ) : null}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => (next ? null : setPendingDelete(null))}
        title={`Delete ${pendingDelete?.filename}?`}
        description="If a project or event still uses this image, the delete will be refused."
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </div>
  );
}
