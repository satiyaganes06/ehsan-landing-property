import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { DashboardSummary } from '../api/types';
import { SeoBadge } from '../components/SeoBadge';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card card-pad">
      <p className="mono dimmer" style={{ fontSize: '.625rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ fontFamily: 'var(--serif)', fontSize: '2rem', marginTop: '.35rem' }}>{value}</p>
      {sub && <p className="dim" style={{ fontSize: '.75rem', marginTop: '.15rem' }}>{sub}</p>}
    </div>
  );
}

function Sparkline({ points }: { points: Array<[string, number]> }) {
  if (points.length === 0) return <p className="dim" style={{ fontSize: '.8125rem' }}>No enquiries in the last 30 days.</p>;
  const max = Math.max(...points.map((p) => p[1]), 1);
  const w = 260, h = 48, step = points.length > 1 ? w / (points.length - 1) : 0;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (p[1] / max) * h}`).join(' ');
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <path d={path} fill="none" stroke="var(--brass-ink)" strokeWidth={2} />
      {points.map((p, i) => (
        <circle key={i} cx={i * step} cy={h - (p[1] / max) * h} r={p[1] > 0 ? 2.5 : 0} fill="var(--brass-ink)" />
      ))}
    </svg>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardSummary>('/api/dashboard/summary') });

  if (isLoading || !data) return <p className="dim">Loading…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <h1>Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '1rem' }}>
        <StatCard label="Unread enquiries" value={data.enquiries.unread} />
        <StatCard label="Draft projects" value={data.publishState.draftProjects} />
        <StatCard label="Draft events" value={data.publishState.draftEvents} />
        <StatCard label="Missing alt text" value={data.needsAttention.mediaMissingAlt} sub="images across the media library" />
        <StatCard label="Last published"
          value={data.publishState.lastBuildAt ? timeAgo(data.publishState.lastBuildAt) : '—'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        <div className="card card-pad">
          <h3 style={{ marginBottom: '1rem' }}>Needs attention</h3>
          {data.needsAttention.lowScoring.length === 0 ? (
            <p className="dim" style={{ fontSize: '.8125rem' }}>Nothing scoring below 50 right now.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
              {data.needsAttention.lowScoring.map((item) => (
                <Link key={`${item.entityType}-${item.entityId}`} to={`/${item.entityType}s/${item.entityId}`}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.5rem .6rem', borderRadius: 3 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--panel)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: '.8125rem' }}>{item.title} <span className="dimmer">· {item.entityType}</span></span>
                  <SeoBadge score={item.score} band={item.band} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card card-pad">
          <h3 style={{ marginBottom: '1rem' }}>Enquiries, last 30 days</h3>
          <Sparkline points={data.enquiries.trend} />
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            {data.enquiries.recent.slice(0, 3).map((e) => (
              <div key={e.id} style={{ fontSize: '.8125rem' }}>
                <strong style={{ fontWeight: 500 }}>{e.name}</strong> <span className="dim">— {e.interest || 'General enquiry'}</span>
              </div>
            ))}
          </div>
          <Link to="/enquiries" className="btn btn--sm" style={{ marginTop: '1rem' }}>Open inbox</Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card card-pad">
          <h3 style={{ marginBottom: '1rem' }}>Upcoming events</h3>
          {data.upcomingEvents.length === 0 ? <p className="dim" style={{ fontSize: '.8125rem' }}>None scheduled.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
              {data.upcomingEvents.map((e) => (
                <Link key={e.id} to={`/events/${e.id}`} style={{ fontSize: '.8125rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{e.title}</span>
                  <span className="dimmer">{e.registered}/{e.capacity ?? '—'}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card card-pad">
          <h3 style={{ marginBottom: '1rem' }}>Recent activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            {data.activity.map((a) => (
              <div key={a.id} style={{ fontSize: '.8125rem', display: 'flex', justifyContent: 'space-between' }}>
                <span className="dim">{a.actor} · {a.action}</span>
                <span className="dimmer">{timeAgo(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
