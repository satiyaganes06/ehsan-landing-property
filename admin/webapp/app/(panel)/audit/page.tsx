'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ScrollText } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, NoResultsState } from '@/components/states';
import { PaginationBar, usePagination } from '@/components/pagination-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { AuditEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

const VERBS: Record<string, string> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  published: 'published',
  unpublished: 'unpublished',
};

const NOUNS: Record<string, string> = {
  project: 'a project',
  event: 'an event',
  award: 'an award',
  testimonial: 'a testimonial',
  block: 'page text',
  media: 'an image',
  enquiry: 'an enquiry',
  user: 'a user',
  seo: 'a search listing',
};

/** Audit rows are stored as `entity.verb`; people read sentences. */
function describe(action: string) {
  if (action === 'login') return 'signed in';
  if (action === 'login.failed') return 'failed to sign in';
  const [entity, verb] = action.split('.');
  if (!verb) return action.replace(/[._]/g, ' ');
  return `${VERBS[verb] ?? verb} ${NOUNS[entity] ?? entity}`;
}

type Scope = 'all' | 'content' | 'access';

export default function AuditPage() {
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<Scope>('all');

  const query = useQuery({
    queryKey: ['audit-log'],
    queryFn: () => api.get<AuditEntry[]>('/api/audit-log'),
  });

  const rows = useMemo(() => {
    let list = query.data ?? [];
    if (scope === 'content') {
      list = list.filter((e) => !e.action.startsWith('login') && !e.action.startsWith('user.'));
    } else if (scope === 'access') {
      list = list.filter((e) => e.action.startsWith('login') || e.action.startsWith('user.'));
    }
    if (search.trim()) {
      const needle = search.toLowerCase();
      list = list.filter(
        (e) =>
          (e.actor?.name ?? '').toLowerCase().includes(needle) ||
          e.action.toLowerCase().includes(needle) ||
          (e.entityType ?? '').toLowerCase().includes(needle),
      );
    }
    return list;
  }, [query.data, scope, search]);

  const { page: entryPage, bindings: entryBindings } = usePagination(rows);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="Activity log"
        description="Every change made in this panel, oldest kept indefinitely."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by person or action…"
          aria-label="Search activity"
          className="h-9 max-w-xs"
        />
        {(['all', 'content', 'access'] as const).map((value) => (
          <Button
            key={value}
            variant={scope === value ? 'secondary' : 'ghost'}
            size="sm"
            className="h-9 capitalize"
            onClick={() => setScope(value)}
          >
            {value}
          </Button>
        ))}
      </div>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : (query.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nothing recorded yet"
          description="Changes made in the panel show up here."
        />
      ) : rows.length === 0 ? (
        <NoResultsState
          onClear={() => {
            setSearch('');
            setScope('all');
          }}
        />
      ) : (
        <div className="space-y-4">
        <ol className="bg-card divide-border divide-y overflow-hidden rounded-lg border">
          {entryPage.map((entry) => {
            const failed = entry.action === 'login.failed';
            return (
              <li key={entry.id} className={cn('flex items-baseline gap-3 px-4 py-3', failed && 'rail')}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-medium">{entry.actor?.name ?? 'System'}</span>{' '}
                    <span className={failed ? 'text-rust' : 'text-muted-foreground'}>
                      {describe(entry.action)}
                    </span>
                  </p>
                  {entry.entityType ? (
                    <p className="text-muted-foreground font-mono text-[0.6875rem]">
                      {entry.entityType}
                      {entry.entityId ? ` · ${entry.entityId.slice(-8)}` : ''}
                    </p>
                  ) : null}
                </div>

                <time
                  dateTime={entry.createdAt}
                  title={new Date(entry.createdAt).toLocaleString()}
                  className="text-muted-foreground shrink-0 font-mono text-[0.6875rem]"
                >
                  {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                </time>
              </li>
            );
          })}
        </ol>
        <PaginationBar {...entryBindings} label="entries" />
        </div>
      )}
    </div>
  );
}
