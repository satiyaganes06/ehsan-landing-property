'use client';

import { ModernSelect } from "@/components/modern-select";
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BarChart3, RefreshCw, Users, Eye, CalendarDays, Inbox } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/states';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

type Ranking = { label: string; count: number }[];
type Analytics = { days: number; pageViews: number; visitors: number; todayVisitors: number; enquiries: number; previousViews: number; change: number | null; trackingSince: string | null; daily: { date: string; views: number; visitors: number }[]; pages: Ranking; sources: Ranking; devices: Ranking };
const number = (value: number) => value.toLocaleString('en-MY');

export function AnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const query = useQuery({ queryKey: ['analytics', days], queryFn: () => api.get<Analytics>(`/api/analytics?days=${days}`), refetchInterval: 60_000 });
  const data = query.data;
  const max = Math.max(1, ...(data?.daily.map(day => day.views) || []));
  const points = data?.daily.map((day, index) => `${index * 1000 / Math.max(1, data.daily.length - 1)},${180 - day.views / max * 150}`).join(' ') || '';
  const stats = data ? [
    { label: 'Visitors', value: data.visitors, description: 'Unique anonymous browser sessions', icon: Users },
    { label: 'Page views', value: data.pageViews, description: data.change === null ? 'No previous period to compare' : `${data.change > 0 ? '+' : ''}${data.change}% vs previous period`, icon: Eye },
    { label: 'Visitors today', value: data.todayVisitors, description: 'Today in Malaysia time', icon: CalendarDays },
    { label: 'Enquiries', value: data.enquiries, description: 'Contact form messages this period', icon: Inbox },
  ] : [];

  return <div className="mx-auto max-w-7xl space-y-6">
    <PageHeader title="Website analytics" description="See how people find and explore your website." actions={<><ModernSelect aria-label="Analytics date range" className="rounded-md border bg-background px-3 py-2 text-sm" value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></ModernSelect><Button variant="outline" size="icon" aria-label="Refresh analytics" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className="size-4" /></Button></>} />
    {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
    {query.isPending && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map(key => <Skeleton key={key} className="h-32 rounded-xl" />)}</div>}
    {data && <>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map(stat => <div key={stat.label} className="rounded-xl border bg-card p-5"><div className="flex items-center justify-between text-muted-foreground"><p className="text-sm">{stat.label}</p><stat.icon className="size-4" /></div><p className="mt-3 text-3xl font-semibold tabular-nums">{number(stat.value)}</p><p className="mt-2 text-xs text-muted-foreground">{stat.description}</p></div>)}</section>
      <section className="rounded-xl border bg-card p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-medium">Traffic over time</h2><p className="mt-1 text-sm text-muted-foreground">Daily page views, Malaysia time</p></div><span className="text-xs text-muted-foreground">{data.trackingSince ? `Tracking since ${new Date(data.trackingSince).toLocaleDateString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}` : 'Tracking starts with the first website visit'}</span></div>
        {data.pageViews === 0 ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><BarChart3 className="mb-3 size-8 text-muted-foreground" /><h3 className="text-sm font-medium">No visits recorded yet</h3><p className="mt-2 max-w-md text-sm text-muted-foreground">Visit the public website to start collecting traffic. Editor previews are excluded. No historical visitor data has been imported.</p><Button asChild variant="outline" className="mt-4" size="sm"><a href={process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:8899'} target="_blank" rel="noreferrer">Open website<ArrowUpRight className="size-3" /></a></Button></div>
          : <div className="mt-8"><svg viewBox="0 0 1000 200" role="img" aria-label={`Daily page views across ${days} days. ${number(data.pageViews)} total.`} className="h-52 w-full" preserveAspectRatio="none"><path d="M0 180 H1000 M0 105 H1000 M0 30 H1000" stroke="currentColor" opacity=".08" fill="none" /><polygon points={`0,180 ${points} 1000,180`} fill="currentColor" opacity=".08" /><polyline points={points} stroke="currentColor" strokeWidth="3" fill="none" vectorEffect="non-scaling-stroke" /></svg><div className="flex justify-between text-xs text-muted-foreground"><span>{data.daily[0]?.date}</span><span>{data.daily.at(-1)?.date}</span></div><details className="mt-4"><summary className="cursor-pointer text-xs text-muted-foreground">View daily numbers</summary><div className="mt-3 max-h-48 overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th className="py-2">Date</th><th>Visitors</th><th>Views</th></tr></thead><tbody>{data.daily.map(day => <tr key={day.date} className="border-t"><td className="py-2">{day.date}</td><td>{day.visitors}</td><td>{day.views}</td></tr>)}</tbody></table></div></details></div>}
      </section>
      <div className="grid gap-4 lg:grid-cols-3"><RankingCard title="Popular pages" rows={data.pages} empty="Page visits will appear here." /><RankingCard title="Traffic sources" rows={data.sources} empty="Referring websites will appear here." /><RankingCard title="Devices" rows={data.devices} empty="Device categories will appear here." /></div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-5 py-4"><p className="text-sm text-muted-foreground">Need to manage content or review publishing tasks?</p><Button asChild variant="outline" size="sm"><Link href="/operations">Content overview<ArrowUpRight className="size-3" /></Link></Button></div>
      <p className="text-xs leading-relaxed text-muted-foreground">First party analytics, without tracking cookies. Visitors are browser sessions, not identified people. Localhost visits are included while testing locally. Do Not Track and privacy opt outs are respected. Previews and recognised bots are excluded. Counts are indicative, not an audited analytics service.</p>
    </>}
  </div>;
}

function RankingCard({ title, rows, empty }: { title: string; rows: Ranking; empty: string }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return <section className="rounded-xl border bg-card p-5"><h2 className="mb-4 text-sm font-medium">{title}</h2>{rows.length ? <div className="space-y-4">{rows.map(row => <div key={row.label}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="truncate" title={row.label}>{row.label}</span><span className="tabular-nums text-muted-foreground">{number(row.count)}</span></div><div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/45" style={{ width: `${row.count / total * 100}%` }} /></div></div>)}</div> : <p className="py-5 text-sm text-muted-foreground">{empty}</p>}</section>;
}
