import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { EventListItem } from '../../api/types';
import { SeoBadge, PublishBadge } from '../../components/SeoBadge';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';

export function EventList() {
  const { can } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get<{ items: EventListItem[] }>('/api/events?perPage=100'),
  });

  const create = useMutation({
    mutationFn: (body: { reference: string; startsAt: string; title: string; category: string; location: string }) =>
      api.post<{ id: string }>('/api/events', body),
    onSuccess: (row) => { qc.invalidateQueries({ queryKey: ['events'] }); nav(`/events/${row.id}`); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Could not create event.'),
  });

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    create.mutate({
      reference: String(f.get('reference')), startsAt: String(f.get('startsAt')),
      title: String(f.get('title')), category: String(f.get('category')), location: String(f.get('location')),
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Events</h1>
        {can('event', 'create') && (
          <button className="btn btn--primary" onClick={() => setCreating((c) => !c)}>{creating ? 'Cancel' : '+ New event'}</button>
        )}
      </div>

      {creating && (
        <form onSubmit={onCreate} className="card card-pad field-row" style={{ alignItems: 'end' }}>
          <div className="field"><label>Reference</label><input name="reference" required placeholder="event-7" /></div>
          <div className="field"><label>Starts at</label><input name="startsAt" type="datetime-local" required /></div>
          <div className="field"><label>Title</label><input name="title" required /></div>
          <div className="field"><label>Category</label><input name="category" required placeholder="Open House" /></div>
          <div className="field"><label>Location</label><input name="location" required /></div>
          <button className="btn btn--primary" type="submit" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create'}</button>
        </form>
      )}

      {isLoading ? <p className="dim">Loading…</p> : (
        <table className="table">
          <thead><tr><th>Title</th><th>Category</th><th>Date</th><th>Registered</th><th>SEO</th><th>State</th></tr></thead>
          <tbody>
            {data?.items.map((e) => (
              <tr key={e.id} onClick={() => nav(`/events/${e.id}`)}>
                <td>{e.title}</td>
                <td className="dim">{e.category}</td>
                <td className="dim mono">{new Date(e.startsAt).toLocaleDateString()}</td>
                <td className="dim">{e.registered}/{e.capacity ?? '—'}</td>
                <td><SeoBadge score={e.seoScore} band={e.seoBand} /></td>
                <td><PublishBadge state={e.publishState} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
