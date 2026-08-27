import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, uploadFile } from '../../api/client';
import type { MediaItem } from '../../api/types';
import { useToast } from '../../lib/toast';

function AltEditor({ item, onSave }: { item: MediaItem; onSave: (alt: string) => void }) {
  const [value, setValue] = useState(item.altText ?? '');
  return (
    <div style={{ display: 'flex', gap: '.4rem' }}>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Alt text…" style={{ flex: 1, fontSize: '.75rem', padding: '.35rem .5rem' }} />
      <button className="btn btn--sm" onClick={() => onSave(value)}>Save</button>
    </div>
  );
}

export function MediaLibrary() {
  const toast = useToast();
  const qc = useQueryClient();
  const [missingOnly, setMissingOnly] = useState(false);
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['media', missingOnly, q],
    queryFn: () => api.get<MediaItem[]>(`/api/media?${missingOnly ? 'missingAlt=true&' : ''}${q ? `q=${encodeURIComponent(q)}` : ''}`),
  });

  const upload = useMutation({
    mutationFn: (file: File) => uploadFile('/api/media/upload', file),
    onSuccess: () => { toast.push('success', 'Uploaded.'); qc.invalidateQueries({ queryKey: ['media'] }); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Upload failed.'),
  });

  const saveAlt = useMutation({
    mutationFn: ({ id, altText }: { id: string; altText: string }) => api.patch(`/api/media/${id}/alt`, { altText }),
    onSuccess: () => { toast.push('success', 'Alt text saved.'); qc.invalidateQueries({ queryKey: ['media'] }); },
  });

  const suggestAlt = useMutation({
    mutationFn: async (item: MediaItem) => {
      const r = await api.post<{ altText: string }>('/api/ai/alt', { mediaId: item.id, context: item.filename, locale: 'EN' });
      await api.patch(`/api/media/${item.id}/alt`, { altText: r.altText });
    },
    onSuccess: () => { toast.push('success', 'Alt text generated.'); qc.invalidateQueries({ queryKey: ['media'] }); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'AI request failed.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/media/${id}`),
    onSuccess: () => { toast.push('success', 'Deleted.'); qc.invalidateQueries({ queryKey: ['media'] }); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Could not delete — still in use.'),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Media library</h1>
        <label className="btn btn--primary">
          {upload.isPending ? 'Uploading…' : '+ Upload'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
        <input placeholder="Search filename…" value={q} onChange={(e) => setQ(e.target.value)} style={{ padding: '.5rem .7rem', border: '1px solid var(--line-hi)', borderRadius: 3, width: '16rem' }} />
        <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center', fontSize: '.8125rem' }}>
          <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} /> Missing alt text only
        </label>
      </div>

      {isLoading ? <p className="dim">Loading…</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(13rem, 1fr))', gap: '1rem' }}>
          {data?.map((m) => (
            <div key={m.id} className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <img src={m.url} alt={m.altText ?? ''} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} />
              <div style={{ padding: '.65rem', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                <p className="dimmer mono" style={{ fontSize: '.625rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.filename}</p>
                <AltEditor item={m} onSave={(alt) => saveAlt.mutate({ id: m.id, altText: alt })} />
                <div style={{ display: 'flex', gap: '.4rem' }}>
                  <button className="btn btn--sm" style={{ flex: 1 }} onClick={() => suggestAlt.mutate(m)} disabled={suggestAlt.isPending}>✨ AI alt</button>
                  <button className="btn btn--sm btn--danger" onClick={() => remove.mutate(m.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
