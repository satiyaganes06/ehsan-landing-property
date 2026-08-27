import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, uploadFile } from '../../api/client';
import type { ProjectDetail } from '../../api/types';
import { useAuth } from '../../lib/auth';
import { useToast } from '../../lib/toast';
import { PublishBadge } from '../../components/SeoBadge';
import { SeoPanel } from '../../components/SeoPanel';
import { PreviewPane } from '../../components/PreviewPane';

type Tab = 'content' | 'media' | 'seo' | 'preview' | 'history';

export function ProjectEdit() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('content');

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<ProjectDetail>(`/api/projects/${id}`),
    enabled: Boolean(id),
  });

  const [form, setForm] = useState({ name: '', location: '', description: '', amenities: '' });
  const [base, setBase] = useState({ status: 'ONGOING', yearStart: '', yearEnd: '', units: '', areaText: '', priceRange: '', occupancy: '', gdvMillions: '', barWeight: '' });

  useEffect(() => {
    if (!project) return;
    const t = project.translations.find((x) => x.locale === 'EN');
    setForm({ name: t?.name ?? '', location: t?.location ?? '', description: t?.description ?? '', amenities: (t?.amenities ?? []).join(', ') });
    setBase({
      status: project.status, yearStart: project.yearStart ?? '', yearEnd: project.yearEnd ?? '',
      units: project.units ?? '', areaText: project.areaText ?? '', priceRange: project.priceRange ?? '',
      occupancy: project.occupancy ?? '', gdvMillions: project.gdvMillions?.toString() ?? '', barWeight: project.barWeight?.toString() ?? '',
    });
  }, [project]);

  const saveContent = useMutation({
    mutationFn: () => api.put(`/api/projects/${id}/translations/EN`, {
      name: form.name, location: form.location, description: form.description,
      amenities: form.amenities.split(',').map((s) => s.trim()).filter(Boolean),
    }),
    onSuccess: () => { toast.push('success', 'Content saved.'); qc.invalidateQueries({ queryKey: ['projects', id] }); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Save failed.'),
  });

  const saveBase = useMutation({
    mutationFn: () => api.patch(`/api/projects/${id}`, {
      status: base.status, yearStart: base.yearStart || null, yearEnd: base.yearEnd || null,
      units: base.units || null, areaText: base.areaText || null, priceRange: base.priceRange || null,
      occupancy: base.occupancy || null,
      gdvMillions: base.gdvMillions ? Number(base.gdvMillions) : null,
      barWeight: base.barWeight ? Number(base.barWeight) : null,
    }),
    onSuccess: () => { toast.push('success', 'Details saved.'); qc.invalidateQueries({ queryKey: ['projects', id] }); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Save failed.'),
  });

  const publish = useMutation({
    mutationFn: (publishing: boolean) => api.post(`/api/projects/${id}/${publishing ? 'publish' : 'unpublish'}`),
    onSuccess: (_r, publishing) => {
      toast.push('success', publishing ? 'Published — data/projects.json rebuilt.' : 'Unpublished.');
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Action failed.'),
  });

  const uploadAltAndAttach = useMutation({
    mutationFn: async (file: File) => {
      const media = await uploadFile('/api/media/upload', file);
      await api.post(`/api/projects/${id}/media`, { mediaId: media.id, role: 'gallery', sortOrder: project?.media.length ?? 0 });
    },
    onSuccess: () => { toast.push('success', 'Image added.'); qc.invalidateQueries({ queryKey: ['projects', id] }); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Upload failed.'),
  });

  const detachMedia = useMutation({
    mutationFn: (linkId: string) => api.delete(`/api/projects/${id}/media/${linkId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', id] }),
  });

  if (isLoading || !project) return <p className="dim">Loading…</p>;
  const seoEn = project.seoMeta.find((s) => s.locale === 'EN');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button className="btn btn--sm btn--ghost" onClick={() => nav('/projects')}>← Projects</button>
          <h1 style={{ marginTop: '.5rem' }}>{form.name || project.reference}</h1>
          <p className="dim mono" style={{ fontSize: '.75rem' }}>{project.reference}</p>
        </div>
        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}>
          <PublishBadge state={project.publishState} />
          {can('project', 'publish') && (
            project.publishState === 'PUBLISHED'
              ? <button className="btn" onClick={() => publish.mutate(false)} disabled={publish.isPending}>Unpublish</button>
              : <button className="btn btn--primary" onClick={() => publish.mutate(true)} disabled={publish.isPending}>Publish</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '.25rem', borderBottom: '1px solid var(--line)' }}>
        {(['content', 'media', 'seo', 'preview', 'history'] as Tab[]).map((t) => (
          <button key={t} className="btn btn--ghost" style={{ borderRadius: 0, borderBottom: tab === t ? '2px solid var(--brass-ink)' : '2px solid transparent', textTransform: 'capitalize' }} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'content' && (
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '42rem' }}>
          <div className="field-row">
            <div className="field"><label>Status</label>
              <select value={base.status} onChange={(e) => setBase((b) => ({ ...b, status: e.target.value }))}>
                <option value="COMPLETED">Completed</option><option value="ONGOING">Ongoing</option><option value="FUTURE">Future</option>
              </select>
            </div>
            <div className="field"><label>Year start</label><input value={base.yearStart} onChange={(e) => setBase((b) => ({ ...b, yearStart: e.target.value }))} /></div>
            <div className="field"><label>Year end</label><input value={base.yearEnd} onChange={(e) => setBase((b) => ({ ...b, yearEnd: e.target.value }))} /></div>
          </div>
          <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
          <div className="field"><label>Location</label><input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} /></div>
          <div className="field"><label>Description</label><textarea rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div className="field"><label>Amenities (comma-separated)</label><input value={form.amenities} onChange={(e) => setForm((f) => ({ ...f, amenities: e.target.value }))} /></div>
          <div className="field-row">
            <div className="field"><label>Units</label><input value={base.units} onChange={(e) => setBase((b) => ({ ...b, units: e.target.value }))} /></div>
            <div className="field"><label>Area</label><input value={base.areaText} onChange={(e) => setBase((b) => ({ ...b, areaText: e.target.value }))} /></div>
            <div className="field"><label>Price range</label><input value={base.priceRange} onChange={(e) => setBase((b) => ({ ...b, priceRange: e.target.value }))} /></div>
          </div>
          <div className="field-row">
            <div className="field"><label>Occupancy / status tag</label><input value={base.occupancy} onChange={(e) => setBase((b) => ({ ...b, occupancy: e.target.value }))} /></div>
            <div className="field"><label>GDV (RM millions)</label><input type="number" step="0.01" value={base.gdvMillions} onChange={(e) => setBase((b) => ({ ...b, gdvMillions: e.target.value }))} /></div>
            <div className="field"><label>Ledger bar weight (0–1)</label><input type="number" step="0.001" min="0" max="1" value={base.barWeight} onChange={(e) => setBase((b) => ({ ...b, barWeight: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: '.6rem' }}>
            <button className="btn btn--primary" onClick={() => { saveContent.mutate(); saveBase.mutate(); }} disabled={saveContent.isPending || saveBase.isPending}>
              {saveContent.isPending || saveBase.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {tab === 'media' && (
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label className="btn" style={{ width: 'fit-content' }}>
            {uploadAltAndAttach.isPending ? 'Uploading…' : '+ Add image'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAltAndAttach.mutate(f); e.target.value = ''; }} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))', gap: '1rem' }}>
            {project.media.map((m) => (
              <div key={m.id} className="card" style={{ overflow: 'hidden' }}>
                <img src={m.media.url} alt={m.media.altText ?? ''} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: '.5rem' }}>
                  <p className="dimmer mono" style={{ fontSize: '.625rem' }}>{m.role}</p>
                  <p style={{ fontSize: '.75rem', color: m.media.altText ? 'var(--dim)' : 'var(--risk)' }}>{m.media.altText || 'No alt text'}</p>
                  <button className="btn btn--sm btn--danger" style={{ marginTop: '.4rem', width: '100%' }} onClick={() => detachMedia.mutate(m.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'seo' && (
        <SeoPanel entityType="project" entityId={project.id} locale="EN" seoMeta={seoEn}
          siteUrl={`ehsanproperty.com/html/project-detail.html?project=${project.reference}`}
          queryKeyToInvalidate={['projects', id]} />
      )}

      {tab === 'preview' && <PreviewPane src={`/api/preview/project/${project.id}?locale=EN`} />}

      {tab === 'history' && <RevisionHistory entityId={project.id} kind="projects" />}
    </div>
  );
}

function RevisionHistory({ entityId, kind }: { entityId: string; kind: 'projects' | 'events' }) {
  const { data } = useQuery({
    queryKey: [kind, entityId, 'revisions'],
    queryFn: () => api.get<Array<{ id: string; entityType: string; createdAt: string }>>(`/api/${kind}/${entityId}/revisions`),
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
