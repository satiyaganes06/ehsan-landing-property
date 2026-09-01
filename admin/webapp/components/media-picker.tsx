'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ImageOff, Loader2, Search, Upload } from 'lucide-react';

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/animate-ui/components/radix/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/states';
import { api, ApiError, uploadFile } from '@/lib/api';
import { mediaSrc } from '@/lib/media';
import { useSession } from '@/lib/session';
import type { MediaItem } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen image; the dialog closes itself afterwards. */
  onSelect: (media: MediaItem) => void;
  /** Highlighted as already chosen. */
  selectedId?: string | null;
}

/**
 * Choose an existing image, or upload one and choose it in the same step.
 * A freshly uploaded file is selected immediately -- uploading then hunting
 * for your own file in the grid is a step nobody wants to take.
 */
export function MediaPicker({ open, onOpenChange, onSelect, selectedId }: MediaPickerProps) {
  const queryClient = useQueryClient();
  const { can } = useSession();
  const fileInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['media'],
    queryFn: () => api.get<MediaItem[]>('/api/media'),
    enabled: open,
  });

  const items = useMemo(() => {
    const list = query.data ?? [];
    if (!search.trim()) return list;
    const needle = search.toLowerCase();
    return list.filter(
      (m) =>
        m.filename.toLowerCase().includes(needle) ||
        (m.altText ?? '').toLowerCase().includes(needle),
    );
  }, [query.data, search]);

  const upload = useMutation({
    mutationFn: (file: File) => uploadFile<MediaItem>('/api/media/upload', file),
    onSuccess: async (media) => {
      await queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success('Uploaded.');
      onSelect(media);
      onOpenChange(false);
    },
    onError: (err) =>
      toast.error('Upload failed', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose an image</DialogTitle>
          <DialogDescription>
            Pick one from the library, or upload a new file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 px-4">
          <div className="relative min-w-48 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search images…"
              aria-label="Search images"
              className="h-9 pl-8"
            />
          </div>

          {can('media', 'create') ? (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate(file);
                  e.target.value = '';
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                disabled={upload.isPending}
                onClick={() => fileInput.current?.click()}
              >
                {upload.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                {upload.isPending ? 'Uploading…' : 'Upload'}
              </Button>
            </>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : query.isPending ? (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {search.trim() ? `No images match “${search}”.` : 'No images in the library yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {items.map((media) => (
                <button
                  key={media.id}
                  type="button"
                  onClick={() => {
                    onSelect(media);
                    onOpenChange(false);
                  }}
                  className={cn(
                    'group overflow-hidden rounded-lg border text-left transition-colors',
                    media.id === selectedId
                      ? 'border-brass-line ring-brass-line/40 ring-2'
                      : 'hover:border-brass-line/60',
                  )}
                >
                  <div className="bg-muted aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mediaSrc(media.storageKey, media.url)}
                      alt={media.altText || `${media.filename} — no description added yet`}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="space-y-0.5 p-2">
                    <p className="truncate text-xs font-medium">{media.filename}</p>
                    {!media.altText ? (
                      <p className="text-sand flex items-center gap-1 text-[0.6875rem]">
                        <ImageOff className="size-3" />
                        No description
                      </p>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
