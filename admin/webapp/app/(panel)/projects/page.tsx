'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Building2, Plus } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { EmptyState } from '@/components/states';
import { PublishPill, SeoPill } from '@/components/state-pills';
import { Button } from '@/components/ui/button';
import { PermissionButton } from '@/components/permission-button';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { Paginated, ProjectListItem, ProjectStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<ProjectStatus, string> = {
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  FUTURE: 'Planned',
};

type StatusFilter = 'all' | ProjectStatus;

export default function ProjectsPage() {
  const router = useRouter();
  const { can } = useSession();
  const [status, setStatus] = useState<StatusFilter>('all');

  const query = useQuery({
    queryKey: ['projects'],
    // 100 is the API's ceiling; the site has 16 projects and sorting happens
    // client-side, so one page is the whole list.
    queryFn: () => api.get<Paginated<ProjectListItem>>('/api/projects?perPage=100'),
  });

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    return status === 'all' ? items : items.filter((item) => item.status === status);
  }, [query.data, status]);

  const columns = useMemo<ColumnDef<ProjectListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Project',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.name}</p>
            {row.original.location ? (
              <p className="text-muted-foreground truncate text-xs">{row.original.location}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Stage',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{STATUS_LABEL[row.original.status]}</span>
        ),
      },
      {
        id: 'years',
        header: 'Years',
        accessorFn: (row) => [row.yearStart, row.yearEnd].filter(Boolean).join(' – '),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground font-mono text-xs">{(getValue() as string) || '—'}</span>
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
        title="Projects"
        description="Every development shown on the site, in the order they appear."
        actions={
          <PermissionButton resource="project" action="create" onClick={() => router.push('/projects/new')}>
            <Plus className="size-3.5" />
            New project
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
        onRowClick={(row) => router.push(`/projects/${row.id}`)}
        searchPlaceholder="Search projects by name or place…"
        toolbar={
          <div className="flex flex-wrap gap-1">
            {(['all', 'ONGOING', 'COMPLETED', 'FUTURE'] as const).map((value) => (
              <Button
                key={value}
                variant={status === value ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatus(value)}
                className={cn('h-9', status === value && 'font-medium')}
              >
                {value === 'all' ? 'All' : STATUS_LABEL[value]}
              </Button>
            ))}
          </div>
        }
        emptyState={
          <EmptyState
            icon={Building2}
            title="No projects yet"
            description="Add the first development and it will appear on the site once published."
            className="border-0"
            action={
              can('project', 'create') ? (
                <Button size="sm" onClick={() => router.push('/projects/new')}>
                  <Plus className="size-3.5" />
                  New project
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
