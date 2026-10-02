'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { Building2, Plus, Star } from 'lucide-react';
import { toast } from 'sonner';

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
import { moveProject } from '@/lib/project-order';

const STATUS_LABEL: Record<ProjectStatus, string> = {
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  FUTURE: 'Planned',
};

type StatusFilter = 'all' | ProjectStatus;

export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = useSession();
  const [status, setStatus] = useState<StatusFilter>('all');

  const query = useQuery({
    queryKey: ['projects'],
    // Fetch a full admin page; moves are applied to the complete order on the server.
    queryFn: () => api.get<Paginated<ProjectListItem> & { featuredCount: number }>('/api/projects?perPage=100'),
  });
  const feature = useMutation({
    mutationFn: (project: ProjectListItem) => api.patch(`/api/projects/${project.id}/featured`, { featured: !project.featured }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); toast.success('Homepage projects updated'); },
    onError: (error: Error) => toast.error(error.message),
  });
  const featuredCount = query.data?.featuredCount ?? 0;
  const reorder = useMutation({
    mutationFn: (move: { id: string; targetId: string }) => api.patch('/api/projects/reorder', move),
    onMutate: async ({ id, targetId }) => {
      await queryClient.cancelQueries({ queryKey: ['projects'] });
      const previous = queryClient.getQueryData<typeof query.data>(['projects']);
      if (previous) queryClient.setQueryData(['projects'], { ...previous, items: moveProject(previous.items, id, targetId) });
      return { previous };
    },
    onError: (error: Error, _move, context) => {
      if (context?.previous) queryClient.setQueryData(['projects'], context.previous);
      toast.error(error.message);
    },
    onSuccess: () => toast.success('Project order saved'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const rows = useMemo(() => {
    const items = query.data?.items ?? [];
    return status === 'all' ? items : items.filter((item) => item.status === status);
  }, [query.data, status]);

  const columns = useMemo<ColumnDef<ProjectListItem, unknown>[]>(
    () => [
      {
        id: 'featured',
        header: 'Star',
        enableSorting: false,
        cell: ({ row }) => {
          const project = row.original;
          return <Button
            variant="ghost" size="icon" className="size-8"
            aria-label={`${project.featured ? 'Unstar' : 'Star'} ${project.name}`}
            aria-pressed={project.featured}
            title={project.featured ? 'Remove from landing page' : project.publishState !== 'PUBLISHED' ? 'Publish before starring' : featuredCount >= 3 ? 'Unstar another project first (3 maximum)' : 'Show on landing page'}
            disabled={!can('project', 'update') || feature.isPending || (!project.featured && (featuredCount >= 3 || project.publishState !== 'PUBLISHED'))}
            onKeyDown={event => event.stopPropagation()}
            onClick={event => { event.stopPropagation(); feature.mutate(project); }}
          ><Star className={cn('size-4', project.featured ? 'fill-[#f5dd62] text-[#f5dd62]' : 'text-muted-foreground')} /></Button>;
        },
      },
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
    [can, feature, featuredCount],
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Projects"
        description={`Drag to set the website order — top appears first. Star up to three landing-page projects (${featuredCount}/3 selected).`}
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
        reorder={can('project', 'update') ? {
          getId: row => row.id, getLabel: row => row.name,
          onMove: (id, targetId) => reorder.mutate({ id, targetId }),
          disabled: status !== 'all' || reorder.isPending,
        } : undefined}
        isPending={query.isPending}
        isError={query.isError}
        error={query.error}
        onRetry={() => query.refetch()}
        onRowClick={(row) => router.push(`/projects/${row.id}`)}
        label="projects"
        pageSize={100}
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
