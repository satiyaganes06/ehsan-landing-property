import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { EventDetail } from '../../api/types';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PublishBadge } from '../../components/SeoBadge';
import { SeoPanel } from '../../components/SeoPanel';
import { PreviewPane } from '../../components/PreviewPane';

type Tab = 'content' | 'agenda' | 'seo' | 'preview' | 'history';

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventEdit() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('content');

  const { data: event, isLoading } = useQuery({
    queryKey: ['events', id],
    queryFn: () => api.get<EventDetail>(`/api/events/${id}`),
    enabled: Boolean(id),
  });

  const [form, setForm] = useState({ title: '', category: '', location: '', description: '' });
  const [base, setBase] = useState({ startsAt: '', capacity: '', registered: '0', isFree: true, priceText: '' });
  const [agendaText, setAgendaText] = useState('');
  const [highlightsText, setHighlightsText] = useState('');

  useEffect(() => {
    if (!event) return;
    const t = event.translations.find((x) => x.locale === 'EN');
    setForm({ title: t?.title ?? '', category: t?.category ?? '', location: t?.location ?? '', description: t?.description ?? '' });
    setBase({
      startsAt: toLocalInput(event.startsAt), capacity: event.capacity?.toString() ?? '', registered: String(event.registered),
      isFree: event.isFree, priceText: event.priceText ?? '',
    });
    setAgendaText((t?.agenda ?? []).map((a) => `${a.time} | ${a.title} | ${a.description}`).join('\n'));
    setHighlightsText((t?.highlights ?? []).join('\n'));
  }, [event]);

  const saveContent = useMutation({
    mutationFn: () => {
      const agenda = agendaText.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
        const [time, title, description] = line.split('|').map((s) => s.trim());
        return { time: time ?? '', title: title ?? '', description: description ?? '' };
      });
      const highlights = highlightsText.split('\n').map((l) => l.trim()).filter(Boolean);
      return api.put(`/api/events/${id}/translations/EN`, {
        title: form.title, category: form.category, location: form.location, description: form.description,
        agenda, highlights, speakers: event?.translations.find((x) => x.locale === 'EN')?.speakers ?? [],
      });
    },
    onSuccess: () => { toast.push('success', 'Content saved.'); qc.invalidateQueries({ queryKey: ['events', id] }); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Save failed.'),
  });

  const saveBase = useMutation({
    mutationFn: () => api.patch(`/api/events/${id}`, {
      startsAt: new Date(base.startsAt).toISOString(),
      capacity: base.capacity ? Number(base.capacity) : null,
      registered: Number(base.registered) || 0,
      isFree: base.isFree, priceText: base.isFree ? null : base.priceText || null,
    }),
    onSuccess: () => { toast.push('success', 'Details saved.'); qc.invalidateQueries({ queryKey: ['events', id] }); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Save failed.'),
  });

  const publish = useMutation({
    mutationFn: (publishing: boolean) => api.post(`/api/events/${id}/${publishing ? 'publish' : 'unpublish'}`),
    onSuccess: (_r, publishing) => {
      toast.push('success', publishing ? 'Published — data/events.json rebuilt.' : 'Unpublished.');
      qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Action failed.'),
  });

  if (isLoading || !event) return <p className="dim">Loading…</p>;
  const seoEn = event.seoMeta.find((s) => s.locale === 'EN');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button className="btn btn--sm btn--ghost" onClick={() => nav('/events')}>← Events</button>
          <h1 style={{ marginTop: '.5rem' }}>{form.title || event.reference}</h1>
          <p className="dim mono" style={{ fontSize: '.75rem' }}>{event.reference}</p>
        </div>
        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}>
          <PublishBadge state={event.publishState} />
          {can('event', 'publish') && (
            event.publishState === 'PUBLISHED'
              ? <button className="btn" onClick={() => publish.mutate(false)} disabled={publish.isPending}>Unpublish</button>
              : <button className="btn btn--primary" onClick={() => publish.mutate(true)} disabled={publish.isPending}>Publish</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '.25rem', borderBottom: '1px solid var(--line)' }}>
        {(['content', 'agenda', 'seo', 'preview', 'history'] as Tab[]).map((t) => (
          <button key={t} className="btn btn--ghost" style={{ borderRadius: 0, borderBottom: tab === t ? '2px solid var(--brass-ink)' : '2px solid transparent', textTransform: 'capitalize' }} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'content' && (
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '42rem' }}>
          <div className="field-row">
            <div className="field"><label>Starts at</label><input type="datetime-local" value={base.startsAt} onChange={(e) => setBase((b) => ({ ...b, startsAt: e.target.value }))} /></div>
            <div className="field"><label>Capacity</label><input type="number" value={base.capacity} onChange={(e) => setBase((b) => ({ ...b, capacity: e.target.value }))} /></div>
            <div className="field"><label>Registered</label><input type="number" value={base.registered} onChange={(e) => setBase((b) => ({ ...b, registered: e.target.value }))} /></div>
          </div>
          <div className="field"><label>Title</label><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
          <div className="field-row">
            <div className="field"><label>Category</label><input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} /></div>
            <div className="field"><label>Location</label><input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} /></div>
          </div>
          <div className="field"><label>Description</label><textarea rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div className="field">
            <label>Price</label>
            <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', gap: '.35rem', alignItems: 'center', fontFamily: 'var(--sans)', textTransform: 'none', letterSpacing: 0 }}>
                <input type="checkbox" checked={base.isFree} onChange={(e) => setBase((b) => ({ ...b, isFree: e.target.checked }))} /> Free
              </label>
              {!base.isFree && <input value={base.priceText} onChange={(e) => setBase((b) => ({ ...b, priceText: e.target.value }))} placeholder="RM 50" />}
            </div>
          </div>
          <button className="btn btn--primary" style={{ width: 'fit-content' }} onClick={() => { saveContent.mutate(); saveBase.mutate(); }} disabled={saveContent.isPending || saveBase.isPending}>
            {saveContent.isPending || saveBase.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}

      {tab === 'agenda' && (
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '42rem' }}>
          <div className="field">
            <label>Agenda — one item per line, as <span className="mono">time | title | description</span></label>
            <textarea rows={8} className="mono" value={agendaText} onChange={(e) => setAgendaText(e.target.value)} placeholder="2:00 PM | Welcome & Arrival | Registration and networking" />
          </div>
          <div className="field">
            <label>Highlights — one per line</label>
            <textarea rows={6} value={highlightsText} onChange={(e) => setHighlightsText(e.target.value)} />
          </div>
          <button className="btn btn--primary" style={{ width: 'fit-content' }} onClick={() => saveContent.mutate()} disabled={saveContent.isPending}>
            {saveContent.isPending ? 'Saving…' : 'Save agenda'}
          </button>
        </div>
      )}

      {tab === 'seo' && (
        <SeoPanel entityType="event" entityId={event.id} locale="EN" seoMeta={seoEn}
          siteUrl={`ehsanproperty.com/html/event-detail.html?event=${event.reference}`}
          queryKeyToInvalidate={['events', id]} />
      )}

      {tab === 'preview' && <PreviewPane src={`/api/preview/event/${event.id}?locale=EN`} />}

      {tab === 'history' && <EventHistory eventId={event.id} />}
    </div>
  );
}

function EventHistory({ eventId }: { eventId: string }) {
  const { data } = useQuery({
    queryKey: ['events', eventId, 'revisions'],
    queryFn: () => api.get<Array<{ id: string; entityType: string; createdAt: string }>>(`/api/events/${eventId}/revisions`),
  });
  if (!data || data.length === 0) return <p className="dim">No revisions yet — changes are snapshotted on every save.</p>;
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
      {data.map((r) => (
        <div key={r.id} style={{ fontSize: '.8125rem', display: 'flex', justifyContent: 'space-between' }}>
          <span className="dim">{r.entityType}</span>
          <span className="dimmer mono">{new Date(r.createdAt).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
