'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Loader2, Pencil, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { cn } from '@/lib/utils';

interface AltTextFieldProps {
  mediaId: string;
  /** Current description; empty or null when none has been written. */
  value?: string | null;
  /** Query keys to refresh once the description is saved. */
  invalidate?: unknown[][];
  /**
   * Called with the saved text. Use this instead of `invalidate` when the
   * description is shown inside an edit form -- refetching the record there
   * would reseed the form and throw away unsaved changes.
   */
  onSaved?: (value: string) => void;
}

const MAX = 200;

/**
 * Click-to-edit description for one image, saved on its own.
 *
 * Descriptions are usually filled in as a batch — the dashboard lists every
 * image missing one — so this edits in place rather than opening a dialog per
 * image. Enter saves, Escape reverts, and the field is one click from
 * wherever the image is already shown.
 */
export function AltTextField({ mediaId, value, invalidate = [], onSaved }: AltTextFieldProps) {
  const queryClient = useQueryClient();
  const { can } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => setDraft(value ?? ''), [value]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = useMutation({
    mutationFn: () => api.patch(`/api/media/${mediaId}/alt`, { altText: draft.trim() }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['media'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] }),
        ...invalidate.map((key) => queryClient.invalidateQueries({ queryKey: key })),
      ]);
      onSaved?.(draft.trim());
      toast.success(draft.trim() ? 'Description saved.' : 'Description cleared.');
      setEditing(false);
    },
    onError: (err) =>
      toast.error('Could not save the description', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  function cancel() {
    setDraft(value ?? '');
    setEditing(false);
  }

  if (!can('media', 'update')) {
    return (
      <p className={cn('truncate text-xs', value ? 'text-muted-foreground' : 'text-sand')}>
        {value || 'No description'}
      </p>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={value || 'Add a description'}
        className={cn(
          'group/alt flex w-full items-center gap-1 text-left text-xs',
          value ? 'text-muted-foreground' : 'text-sand',
        )}
      >
        <span className="truncate underline decoration-dotted underline-offset-2">
          {value || 'Add a description'}
        </span>
        <Pencil className="size-2.5 shrink-0 opacity-0 transition-opacity group-hover/alt:opacity-100" />
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={draft}
          maxLength={MAX}
          disabled={save.isPending}
          aria-label="Image description"
          placeholder="What is in this image?"
          className="h-7 text-xs"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save.mutate();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label="Save description"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label="Cancel"
          disabled={save.isPending}
          onClick={cancel}
        >
          <X className="size-3" />
        </Button>
      </div>
      <p className={cn('text-[0.6875rem]', draft.length > MAX - 20 ? 'text-sand' : 'text-muted-foreground')}>
        {draft.length}/{MAX} · Enter to save, Esc to cancel
      </p>
    </div>
  );
}
