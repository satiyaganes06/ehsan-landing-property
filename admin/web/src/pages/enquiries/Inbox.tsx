import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../api/client';
import type { Enquiry, EnquiryStatus } from '../../api/types';
import { useToast } from '../../lib/toast';

const STATUSES: EnquiryStatus[] = ['NEW', 'READ', 'REPLIED', 'ARCHIVED', 'SPAM'];

function statusClass(s: EnquiryStatus): string {
  if (s === 'NEW') return 'pill--neutral';
  if (s === 'REPLIED') return 'pill--good';
  if (s === 'SPAM') return 'pill--bad';
  return 'pill--flat';
}

export function EnquiryInbox() {
  const toast = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<EnquiryStatus | ''>('');
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['enquiries', filter],
    queryFn: () => api.get<{ items: Enquiry[] }>(`/api/enquiries?perPage=100${filter ? `&status=${filter}` : ''}`),
  });

  const { data: detail } = useQuery({
    queryKey: ['enquiries', selected],
    queryFn: () => api.get<Enquiry>(`/api/enquiries/${selected}`),
    enabled: Boolean(selected),
  });

  const update = useMutation({
    mutationFn: (body: Partial<Pick<Enquiry, 'status' | 'notes'>>) => api.patch(`/api/enquiries/${selected}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['enquiries'] }); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Update failed.'),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Enquiries</h1>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value as EnquiryStatus | '')}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <a className="btn" href="/api/enquiries/export.csv">Export CSV</a>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '22rem 1fr', gap: '1.5rem', alignItems: 'start' }}>
        <div className="card" style={{ maxHeight: '75vh', overflow: 'auto' }}>
          {isLoading ? <p className="dim" style={{ padding: '1rem' }}>Loading…</p> : data?.items.map((e) => (
            <div key={e.id} onClick={() => setSelected(e.id)}
              style={{ padding: '.7rem .9rem', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: selected === e.id ? 'var(--panel)' : 'transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <p style={{ fontSize: '.8125rem', fontWeight: e.status === 'NEW' ? 600 : 500 }}>{e.name}</p>
                <span className={`pill ${statusClass(e.status)}`}>{e.status}</span>
              </div>
              <p className="dim" style={{ fontSize: '.75rem', marginTop: '.2rem' }}>{e.interest || 'General enquiry'}</p>
              <p className="dimmer mono" style={{ fontSize: '.6875rem', marginTop: '.2rem' }}>{new Date(e.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
          {data?.items.length === 0 && <p className="dim" style={{ padding: '1rem' }}>No enquiries.</p>}
        </div>

        {detail ? (
          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '36rem' }}>
            <div>
              <h3>{detail.name}</h3>
              <p className="dim" style={{ fontSize: '.8125rem' }}>{detail.email} {detail.phone ? `· ${detail.phone}` : ''}</p>
            </div>
            <p style={{ fontSize: '.875rem', whiteSpace: 'pre-wrap' }}>{detail.message}</p>
            {detail.interest && <p className="dim" style={{ fontSize: '.8125rem' }}>Interested in: {detail.interest}</p>}
            <div className="field-row">
              <div className="field">
                <label>Status</label>
                <select value={detail.status} onChange={(e) => update.mutate({ status: e.target.value as EnquiryStatus })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Internal notes</label>
              <textarea rows={3} defaultValue={detail.notes ?? ''} onBlur={(e) => update.mutate({ notes: e.target.value })} />
            </div>
          </div>
        ) : <p className="dim">Select an enquiry.</p>}
      </div>
    </div>
  );
}
