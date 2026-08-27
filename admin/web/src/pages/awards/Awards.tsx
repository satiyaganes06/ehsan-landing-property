import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../api/client';
import type { AwardDetail, AwardListItem } from '../../api/types';
import { PublishBadge } from '../../components/SeoBadge';
import { useToast } from '../../lib/toast';

export function Awards() {
  const toast = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: list } = useQuery({ queryKey: ['awards'], queryFn: () => api.get<AwardListItem[]>('/api/awards') });
  const { data: award } = useQuery({
    queryKey: ['awards', selected], queryFn: () => api.get<AwardDetail>(`/api/awards/${selected}`), enabled: Boolean(selected),
  });

  const [form, setForm] = useState({ name: '', issuer: '', description: '', year: '' });
  useEffect(() => {
    if (!award) return;
    const t = award.translations.find((x) => x.locale === 'EN');
    setForm({ name: t?.name ?? '', issuer: t?.issuer ?? '', description: t?.description ?? '', year: String(award.year) });
  }, [award]);

  const save = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/awards/${selected}`, { year: Number(form.year) });
      await api.put(`/api/awards/${selected}/translations/EN`, { name: form.name, issuer: form.issuer || null, description: form.description });
    },
    onSuccess: () => { toast.push('success', 'Award saved.'); qc.invalidateQueries({ queryKey: ['awards'] }); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Save failed.'),
  });

  const publish = useMutation({
    mutationFn: () => api.post(`/api/awards/${selected}/publish`),
    onSuccess: () => { toast.push('success', 'Published.'); qc.invalidateQueries({ queryKey: ['awards'] }); },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1>Awards</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '20rem 1fr', gap: '1.5rem', alignItems: 'start' }}>
        <div className="card" style={{ maxHeight: '70vh', overflow: 'auto' }}>
          {list?.map((a) => (
            <div key={a.id} onClick={() => setSelected(a.id)}
              style={{ display: 'flex', gap: '.75rem', alignItems: 'center', padding: '.6rem .8rem', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: selected === a.id ? 'var(--panel)' : 'transparent' }}>
              {a.mediaUrl && <img src={a.mediaUrl} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '.8125rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</p>
                <p className="dimmer" style={{ fontSize: '.6875rem' }}>{a.year}</p>
              </div>
              <PublishBadge state={a.publishState} />
            </div>
          ))}
        </div>

        {award ? (
          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '32rem' }}>
            <div className="field-row">
              <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="field"><label>Year</label><input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} /></div>
            </div>
            <div className="field"><label>Issuer</label><input value={form.issuer} onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))} /></div>
            <div className="field"><label>Description</label><textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div style={{ display: 'flex', gap: '.6rem' }}>
              <button className="btn btn--primary" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
              {award.publishState !== 'PUBLISHED' && <button className="btn" onClick={() => publish.mutate()}>Publish</button>}
            </div>
          </div>
        ) : <p className="dim">Select an award to edit.</p>}
      </div>
    </div>
  );
}
