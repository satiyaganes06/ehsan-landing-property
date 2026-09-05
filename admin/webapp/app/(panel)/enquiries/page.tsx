'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Download, Inbox, Mail, Phone, Trash2 } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState } from '@/components/states';
import { EnquiryPill } from '@/components/state-pills';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PaginationBar, usePagination } from '@/components/pagination-bar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { Enquiry, EnquiryStatus, Paginated } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUSES: EnquiryStatus[] = ['NEW', 'READ', 'REPLIED', 'ARCHIVED', 'SPAM'];

export default function EnquiriesPage() {
  const queryClient = useQueryClient();
  const { can } = useSession();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Enquiry | null>(null);

  const query = useQuery({
    queryKey: ['enquiries'],
    queryFn: () => api.get<Paginated<Enquiry>>('/api/enquiries?perPage=100'),
  });

  const items = query.data?.items ?? [];
  const selected = useMemo(
    () => items.find((e) => e.id === selectedId) ?? null,
    [items, selectedId],
  );

  const { page: enquiryPage, bindings: enquiryBindings } = usePagination(items);

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EnquiryStatus }) =>
      api.patch(`/api/enquiries/${id}`, { status }),
    // Marking something read should feel instant; roll back if the server disagrees.
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['enquiries'] });
      const previous = queryClient.getQueryData<Paginated<Enquiry>>(['enquiries']);
      queryClient.setQueryData<Paginated<Enquiry>>(['enquiries'], (old) =>
        old
          ? { ...old, items: old.items.map((e) => (e.id === id ? { ...e, status } : e)) }
          : old,
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['enquiries'], context.previous);
      toast.error('Could not update', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/enquiries/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['enquiries'] });
      toast.success('Enquiry deleted.');
      setPendingDelete(null);
      setSelectedId(null);
    },
    onError: (err) =>
      toast.error('Could not delete', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Enquiries"
        description="Messages sent through the contact form on the site."
        actions={
          <Button variant="outline" asChild>
            <a href="/api/enquiries/export.csv" download>
              <Download className="size-3.5" />
              Export CSV
            </a>
          </Button>
        }
      />

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No enquiries yet"
          description="Messages from the site's contact form will appear here. The form on the live site still needs to be pointed at this panel."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-3">
          <ul className="bg-card divide-border max-h-[70vh] divide-y overflow-y-auto rounded-lg border">
            {enquiryPage.map((enquiry) => (
              <li key={enquiry.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(enquiry.id);
                    if (enquiry.status === 'NEW') {
                      setStatus.mutate({ id: enquiry.id, status: 'READ' });
                    }
                  }}
                  className={cn(
                    'hover:bg-muted/50 w-full px-4 py-3 text-left transition-colors',
                    selectedId === enquiry.id && 'bg-muted/70 rail',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        'truncate text-sm',
                        enquiry.status === 'NEW' ? 'font-semibold' : 'font-medium',
                      )}
                    >
                      {enquiry.name}
                    </span>
                    <span className="text-muted-foreground shrink-0 font-mono text-[0.6875rem]">
                      {formatDistanceToNow(new Date(enquiry.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                    {enquiry.message}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <PaginationBar {...enquiryBindings} label="enquiries" />
          </div>

          <div className="bg-card rounded-lg border">
            {selected ? (
              <article className="flex h-full flex-col">
                <header className="space-y-3 border-b p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-xl leading-tight font-semibold tracking-tight">{selected.name}</h2>
                      <p className="text-muted-foreground text-xs">
                        {new Date(selected.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <EnquiryPill status={selected.status} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={`mailto:${selected.email}`}>
                        <Mail className="size-3.5" />
                        {selected.email}
                      </a>
                    </Button>
                    {selected.phone ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`tel:${selected.phone}`}>
                          <Phone className="size-3.5" />
                          {selected.phone}
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </header>

                <div className="flex-1 space-y-4 p-5">
                  {selected.interest ? (
                    <div>
                      <p className="text-muted-foreground text-xs font-medium">Interested in</p>
                      <p className="text-sm">{selected.interest}</p>
                    </div>
                  ) : null}

                  <div>
                    <p className="text-muted-foreground text-xs font-medium">Message</p>
                    <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                      {selected.message}
                    </p>
                  </div>

                  {selected.consentAt ? (
                    <p className="text-muted-foreground border-t pt-3 text-xs">
                      Consented to being contacted on{' '}
                      {new Date(selected.consentAt).toLocaleDateString()}.
                    </p>
                  ) : null}
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-2 border-t p-4">
                  <div className="flex flex-wrap gap-1">
                    {STATUSES.map((status) => (
                      <Button
                        key={status}
                        variant={selected.status === status ? 'secondary' : 'ghost'}
                        size="xs"
                        disabled={!can('enquiry', 'update')}
                        onClick={() => setStatus.mutate({ id: selected.id, status })}
                        className="capitalize"
                      >
                        {status.toLowerCase()}
                      </Button>
                    ))}
                  </div>

                  {can('enquiry', 'delete') ? (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setPendingDelete(selected)}
                    >
                      <Trash2 className="size-3" />
                      Delete
                    </Button>
                  ) : null}
                </footer>
              </article>
            ) : (
              <EmptyState
                title="Nothing selected"
                description="Choose an enquiry to read it."
                className="border-0"
              />
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => (next ? null : setPendingDelete(null))}
        title={`Delete the enquiry from ${pendingDelete?.name}?`}
        description="This permanently removes the message and their contact details."
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />
    </div>
  );
}
