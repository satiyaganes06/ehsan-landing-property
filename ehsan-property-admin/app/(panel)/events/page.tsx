'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarDays, Plus } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { EmptyState } from '@/components/states';
import { PublishPill, SeoPill } from '@/components/state-pills';
import { Button } from '@/components/ui/button';
import { PermissionButton } from '@/components/permission-button';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { EventListItem, Paginated } from '@/lib/types';

type When = 'upcoming' | 'past' | 'all';

export default function EventsPage() {
  const router = useRouter();
  const { can } = useSession();
  // Upcoming first: the events people are about to attend are the ones that
  // still need editing.
  const [when, setWhen] = useState<When>('upcoming');

  const query = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get<Paginated<EventListItem>>('/api/events?perPage=100'),
  });

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    if (when === 'all') return items;
    const now = Date.now();
    return items.filter((item) =>
      when === 'upcoming'
        ? new Date(item.startsAt).getTime() >= now
        : new Date(item.startsAt).getTime() < now,
    );
  }, [query.data, when]);

  const columns = useMemo<ColumnDef<EventListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Event',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.title}</p>
            {row.original.category ? (
              <p className="text-muted-foreground truncate text-xs">{row.original.category}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'startsAt',
        header: 'Date',
        cell: ({ row }) => (
          <span className="font-mono text-xs whitespace-nowrap">
            {new Date(row.original.startsAt).toLocaleDateString(undefined, {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        ),
      },
      {
        id: 'registered',
        header: 'Registered',
        accessorFn: (row) => row.registered ?? 0,
        cell: ({ row }) =>
          row.original.capacity ? (
            <span className="font-mono text-xs tabular-nums">
              {row.original.registered ?? 0}
              <span className="text-muted-foreground">/{row.original.capacity}</span>
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        accessorKey: 'publishState',
        header: 'State',
        cell: ({ row }) => <PublishPill state={row.original.publishState} />,
      },
      {
        accessorKey: 'seoScore',
        header: 'Search listing',
        cell: ({ row }) => <SeoPill band={row.original.seoBand} score={row.original.seoScore} />,
      },
    ],
    [],
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Events"
        description="Launches, open houses and ceremonies listed on the site."
        actions={
          <PermissionButton resource="event" action="create" onClick={() => router.push('/events/new')}>
            <Plus className="size-3.5" />
            New event
          </PermissionButton>
        }
      />

      <DataTable
        columns={columns}
        data={rows}
        isPending={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => query.refetch()}
        onRowClick={(row) => router.push(`/events/${row.id}`)}
        label="events"
        searchPlaceholder="Search events…"
        toolbar={
          <div className="flex flex-wrap gap-1">
            {(['upcoming', 'past', 'all'] as const).map((value) => (
              <Button
                key={value}
                variant={when === value ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setWhen(value)}
                className="h-9 capitalize"
              >
                {value}
              </Button>
            ))}
          </div>
        }
        emptyState={
          <EmptyState
            icon={CalendarDays}
            title={when === 'upcoming' ? 'Nothing coming up' : 'No events yet'}
            description={
              when === 'upcoming'
                ? 'Past events are still here — switch the filter to see them.'
                : 'Add an event and it will appear on the site once published.'
            }
            className="border-0"
            action={
              can('event', 'create') ? (
                <Button size="sm" onClick={() => router.push('/events/new')}>
                  <Plus className="size-3.5" />
                  New event
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
