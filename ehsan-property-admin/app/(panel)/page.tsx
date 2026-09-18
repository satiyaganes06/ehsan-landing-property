'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUpRight, CalendarDays, CheckCircle2, ImageOff, Inbox } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState } from '@/components/states';
import { SeoPill } from '@/components/state-pills';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { DashboardSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { me } = useSession();
  const query = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get<DashboardSummary>('/api/dashboard/summary'),
  });

  const firstName = me?.name?.split(' ')[0];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        title={firstName ? `Good to see you, ${firstName}` : 'Dashboard'}
        description="What needs attention before the next publish."
      />

      {query.isPending ? <DashboardSkeleton /> : null}

      {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : null}

      {query.data ? <DashboardContent data={query.data} /> : null}
    </div>
  );
}

function DashboardContent({ data }: { data: DashboardSummary }) {
  const { publishState, enquiries, needsAttention, upcomingEvents, activity } = data;

  const stats = [
    { label: 'Unread enquiries', value: enquiries.unread, href: '/enquiries', accent: enquiries.unread > 0 },
    { label: 'Draft projects', value: publishState.draftProjects, href: '/projects' },
    { label: 'Draft events', value: publishState.draftEvents, href: '/events' },
    { label: 'Scheduled', value: publishState.scheduledCount, href: '/events' },
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={cn(
              'group bg-card hover:border-brass-line/60 relative overflow-hidden rounded-lg border p-4 transition-colors',
              stat.accent && 'rail',
            )}
          >
            <p className="text-muted-foreground text-xs">{stat.label}</p>
            <p className="font-display mt-2 text-3xl leading-none font-semibold tracking-tight tabular-nums">{stat.value}</p>
            <ArrowUpRight className="text-muted-foreground/0 group-hover:text-muted-foreground absolute top-4 right-4 size-4 transition-colors" />
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-medium">Needs attention</h2>
          {publishState.lastBuildAt ? (
            <p className="text-muted-foreground text-xs">
              Last published {formatDistanceToNow(new Date(publishState.lastBuildAt), { addSuffix: true })}
            </p>
          ) : null}
        </div>

        <div className="bg-card divide-border divide-y overflow-hidden rounded-lg border">
          {needsAttention.lowScoring.length === 0 && needsAttention.mediaMissingAlt === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing needs fixing"
              description="Every record scores well and all images have alt text."
              className="border-0"
            />
          ) : (
            <>
              {needsAttention.lowScoring.map((item) => (
                <Link
                  key={`${item.entityType}-${item.entityId}`}
                  href={`/${item.entityType}s/${item.entityId}?tab=seo`}
                  className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-muted-foreground text-xs capitalize">
                      {item.entityType} · search listing needs work
                    </p>
                  </div>
                  <SeoPill band={item.band} score={item.score} />
                </Link>
              ))}

              {needsAttention.mediaMissingAlt > 0 ? (
                <Link
                  href="/media?filter=missing-alt"
                  className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
                >
                  <span className="bg-sand-soft text-sand flex size-8 shrink-0 items-center justify-center rounded-md">
                    <ImageOff className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {needsAttention.mediaMissingAlt} image
                      {needsAttention.mediaMissingAlt === 1 ? '' : 's'} without alt text
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Screen readers and search engines can’t describe these.
                    </p>
                  </div>
                </Link>
              ) : null}
            </>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Upcoming events</h2>
          <div className="bg-card divide-border divide-y overflow-hidden rounded-lg border">
            {upcomingEvents.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No upcoming events"
                description="Published events with a future date appear here."
                className="border-0"
              />
            ) : (
              upcomingEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{event.title}</p>
                    <p className="text-muted-foreground font-mono text-xs">
                      {new Date(event.startsAt).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  {typeof event.capacity === 'number' ? (
                    <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                      {event.registered ?? 0}/{event.capacity}
                    </span>
                  ) : null}
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Recent activity</h2>
          <div className="bg-card overflow-hidden rounded-lg border">
            {activity.length === 0 ? (
              <EmptyState icon={Inbox} title="Nothing yet" className="border-0" />
            ) : (
              <ul className="divide-border divide-y">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex items-baseline gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-medium">{entry.actor}</span>{' '}
                      <span className="text-muted-foreground">{describeAction(entry.action)}</span>
                    </span>
                    <span className="text-muted-foreground shrink-0 font-mono text-[0.6875rem]">
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Audit actions are stored as `entity.verb`; people read sentences. */
function describeAction(action: string) {
  const [entity, verb] = action.split('.');
  if (!verb) return action.replace(/[._]/g, ' ');
  const noun = entity === 'block' ? 'page text' : entity;
  const past: Record<string, string> = {
    created: 'created a',
    updated: 'updated a',
    deleted: 'deleted a',
    published: 'published a',
    unpublished: 'unpublished a',
    login: 'signed in',
    failed: 'failed to sign in',
  };
  if (entity === 'login' || verb === 'failed') return past[verb] ?? action;
  return `${past[verb] ?? verb} ${noun}`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card space-y-3 rounded-lg border p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="bg-card divide-border divide-y rounded-lg border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
