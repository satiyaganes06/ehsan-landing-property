import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../api/client';
import type { TestimonialDetail, TestimonialListItem } from '../../api/types';
import { PublishBadge } from '../../components/SeoBadge';
import { useToast } from '../../lib/toast';

export function Testimonials() {
  const toast = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: list } = useQuery({ queryKey: ['testimonials'], queryFn: () => api.get<TestimonialListItem[]>('/api/testimonials') });
  const { data: item } = useQuery({
    queryKey: ['testimonials', selected], queryFn: () => api.get<TestimonialDetail>(`/api/testimonials/${selected}`), enabled: Boolean(selected),
  });

  const [form, setForm] = useState({ quote: '', author: '', role: '', groupLabel: '' });
  useEffect(() => {
    if (!item) return;
    const t = item.translations.find((x) => x.locale === 'EN');
    setForm({ quote: t?.quote ?? '', author: t?.author ?? '', role: t?.role ?? '', groupLabel: t?.groupLabel ?? '' });
  }, [item]);

  const save = useMutation({
    mutationFn: async () => {
      await api.put(`/api/testimonials/${selected}/translations/EN`, { quote: form.quote, author: form.author, role: form.role, groupLabel: form.groupLabel || null });
      // Matches the copy above: saving new content is what turns a
      // placeholder into a real quote, so the flag clears here rather than
      // needing a separate manual toggle.
      if (item?.isPlaceholder) await api.patch(`/api/testimonials/${selected}`, { isPlaceholder: false });
    },
    onSuccess: () => { toast.push('success', 'Testimonial saved.'); qc.invalidateQueries({ queryKey: ['testimonials'] }); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Save failed.'),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1>Testimonials</h1>
      <p className="dim" style={{ maxWidth: '42rem', fontSize: '.8125rem' }}>
        All four current testimonials are placeholder copy, disclosed on the live page. Replace with real client
        quotes as they are collected — the <span className="mono">isPlaceholder</span> flag clears automatically
        the next time you save a testimonial with new content.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '18rem 1fr', gap: '1.5rem', alignItems: 'start' }}>
        <div className="card">
          {list?.map((t) => (
            <div key={t.id} onClick={() => setSelected(t.id)}
              style={{ padding: '.6rem .8rem', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: selected === t.id ? 'var(--panel)' : 'transparent' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '.8125rem', fontWeight: 500 }}>{t.author}</p>
                <PublishBadge state={t.publishState} />
              </div>
              <p className="dimmer" style={{ fontSize: '.75rem' }}>{t.isPlaceholder ? 'Placeholder' : 'Real quote'}</p>
            </div>
          ))}
        </div>

        {item ? (
          <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '32rem' }}>
            <div className="field"><label>Quote</label><textarea rows={4} value={form.quote} onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))} /></div>
            <div className="field-row">
              <div className="field"><label>Author</label><input value={form.author} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))} /></div>
              <div className="field"><label>Role</label><input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} /></div>
            </div>
            <div className="field"><label>Group label</label><input value={form.groupLabel} onChange={(e) => setForm((f) => ({ ...f, groupLabel: e.target.value }))} placeholder="First-time buyers" /></div>
            <button className="btn btn--primary" style={{ width: 'fit-content' }} onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
          </div>
        ) : <p className="dim">Select a testimonial to edit.</p>}
      </div>
    </div>
  );
}
