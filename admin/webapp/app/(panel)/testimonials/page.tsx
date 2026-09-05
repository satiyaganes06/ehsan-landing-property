'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Quote, Trash2 } from 'lucide-react';

import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/animate-ui/components/radix/sheet';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState } from '@/components/states';
import { PublishPill } from '@/components/state-pills';
import { PermissionButton } from '@/components/permission-button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PaginationBar, usePagination } from '@/components/pagination-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { TestimonialDetail, TestimonialListItem } from '@/lib/types';

interface Draft {
  quote: string;
  author: string;
  role: string;
  reference: string;
}

const EMPTY: Draft = { quote: '', author: '', role: '', reference: '' };

/** The seed marked the imported quotes as placeholders; say so plainly rather
    than letting the client publish invented testimonials by accident. */
function PlaceholderBadge() {
  return (
    <span className="bg-sand-soft text-sand rounded-full px-2 py-0.5 text-[0.6875rem] font-medium">
      Placeholder text
    </span>
  );
}

export default function TestimonialsPage() {
  const queryClient = useQueryClient();
  const { can } = useSession();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [pendingDelete, setPendingDelete] = useState<TestimonialListItem | null>(null);

  const list = useQuery({
    queryKey: ['testimonials'],
    queryFn: () => api.get<TestimonialListItem[]>('/api/testimonials'),
  });

  const detail = useQuery({
    queryKey: ['testimonials', editingId],
    queryFn: () => api.get<TestimonialDetail>(`/api/testimonials/${editingId}`),
    enabled: Boolean(editingId),
  });

  useEffect(() => {
    const data = detail.data;
    if (!data) return;
    const t = data.translations?.find((x) => x.locale === 'EN');
    setDraft({
      quote: t?.quote ?? '',
      author: t?.author ?? '',
      role: t?.role ?? '',
      reference: data.reference ?? '',
    });
  }, [detail.data]);

  const open = creating || Boolean(editingId);

  function close() {
    setCreating(false);
    setEditingId(null);
    setDraft(EMPTY);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (creating) {
        const created = await api.post<TestimonialDetail>('/api/testimonials', {
          reference: draft.reference || slugify(draft.author),
        });
        await api.put(`/api/testimonials/${created.id}/translations/EN`, {
          quote: draft.quote,
          author: draft.author,
          role: draft.role,
        });
        return;
      }
      await api.put(`/api/testimonials/${editingId}/translations/EN`, {
        quote: draft.quote,
        author: draft.author,
        role: draft.role,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['testimonials'] });
      toast.success(creating ? 'Testimonial added.' : 'Testimonial saved.');
      close();
    },
    onError: (err) =>
      toast.error('Could not save', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/testimonials/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['testimonials'] });
      toast.success('Testimonial deleted.');
      setPendingDelete(null);
      close();
    },
    onError: (err) =>
      toast.error('Could not delete', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  const { page: testimonialPage, bindings: testimonialBindings } = usePagination(
    list.data ?? [],
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="Testimonials"
        description="Resident quotes shown on the site."
        actions={
          <PermissionButton
            resource="testimonial"
            action="create"
            onClick={() => {
              setDraft(EMPTY);
              setCreating(true);
            }}
          >
            <Plus className="size-3.5" />
            Add testimonial
          </PermissionButton>
        }
      />

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : list.data?.length === 0 ? (
        <EmptyState
          icon={Quote}
          title="No testimonials yet"
          description="Add a resident quote and it will appear on the site once published."
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
          {testimonialPage.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setEditingId(item.id)}
              className="bg-card hover:border-brass-line/60 block w-full rounded-lg border p-4 text-left transition-colors"
            >
              <p className="font-display line-clamp-2 text-base leading-snug font-medium">
                <span className="text-brass-line" aria-hidden>
                  “
                </span>
                {decodeEntities(item.quote)}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{decodeEntities(item.author)}</span>
                <PublishPill state={item.publishState} />
                {item.isPlaceholder ? <PlaceholderBadge /> : null}
              </div>
            </button>
          ))}
          </div>
          <PaginationBar {...testimonialBindings} label="testimonials" />
        </div>
      )}

      <Sheet open={open} onOpenChange={(next) => (next ? null : close())}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{creating ? 'Add testimonial' : 'Edit testimonial'}</SheetTitle>
            <SheetDescription>
              Use the resident’s own words. Keep it to a sentence or two.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            {editingId && detail.isPending ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="quote">Quote</Label>
                  <Textarea
                    id="quote"
                    rows={5}
                    value={draft.quote}
                    onChange={(e) => setDraft({ ...draft, quote: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="author">Who said it</Label>
                  <Input
                    id="author"
                    value={draft.author}
                    onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                    placeholder="e.g. Aisyah & Farid"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Context</Label>
                  <Input
                    id="role"
                    value={draft.role}
                    onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                    placeholder="e.g. Homeowner, Taman Sri Ehsan"
                  />
                  <p className="text-muted-foreground text-xs">
                    Shown under the name. Required.
                  </p>
                </div>

                {creating ? (
                  <div className="space-y-2">
                    <Label htmlFor="reference">Reference</Label>
                    <Input
                      id="reference"
                      value={draft.reference || slugify(draft.author)}
                      onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
                      className="font-mono"
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>

          <SheetFooter className="flex-row justify-between gap-2">
            {!creating && can('testimonial', 'delete') ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  const found = list.data?.find((t) => t.id === editingId);
                  if (found) setPendingDelete(found);
                }}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={close}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => save.mutate()}
                disabled={
                  !draft.quote.trim() || !draft.author.trim() || !draft.role.trim() || save.isPending
                }
              >
                {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {save.isPending ? 'Saving…' : creating ? 'Add testimonial' : 'Save'}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => (next ? null : setPendingDelete(null))}
        title={`Delete the quote from ${pendingDelete ? decodeEntities(pendingDelete.author) : ''}?`}
        description="This removes the testimonial from the panel and the site. It can't be undone."
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </div>
  );
}

/** The seeded copy was scraped from the site's HTML, so it still carries
    entities like &amp;. Render them as the characters people wrote. */
function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
