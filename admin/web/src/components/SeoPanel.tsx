import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { Locale, SeoMeta } from '../api/types';
import { useToast } from '../lib/toast';
import { SeoBadge } from './SeoBadge';
import { ScoreChecklist } from './ScoreChecklist';
import { SerpPreview } from './SerpPreview';

interface Props {
  entityType: 'project' | 'event';
  entityId: string;
  locale: Locale;
  seoMeta: SeoMeta | undefined;
  siteUrl: string; // shown in the SERP preview, e.g. ehsanproperty.com/html/project-detail.html?project=proj-14
  queryKeyToInvalidate: unknown[];
}

type FormState = Pick<SeoMeta, 'focusKeyword' | 'metaTitle' | 'metaDescription' | 'canonicalUrl' | 'robotsIndex' | 'robotsFollow' | 'ogTitle' | 'ogDescription'>;

const EMPTY: FormState = {
  focusKeyword: null, metaTitle: null, metaDescription: null, canonicalUrl: null,
  robotsIndex: true, robotsFollow: true, ogTitle: null, ogDescription: null,
};

export function SeoPanel({ entityType, entityId, locale, seoMeta, siteUrl, queryKeyToInvalidate }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [metaVariants, setMetaVariants] = useState<Array<{ title: string; description: string; rationale: string }> | null>(null);
  const [keywordVariants, setKeywordVariants] = useState<Array<{ keyword: string; intent: string; rationale: string }> | null>(null);
  const toast = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    setForm(seoMeta ? {
      focusKeyword: seoMeta.focusKeyword, metaTitle: seoMeta.metaTitle, metaDescription: seoMeta.metaDescription,
      canonicalUrl: seoMeta.canonicalUrl, robotsIndex: seoMeta.robotsIndex, robotsFollow: seoMeta.robotsFollow,
      ogTitle: seoMeta.ogTitle, ogDescription: seoMeta.ogDescription,
    } : EMPTY);
    setMetaVariants(null);
    setKeywordVariants(null);
  }, [seoMeta, entityId, locale]);

  const save = useMutation({
    mutationFn: () => api.put<SeoMeta>(`/api/seo/${entityType}/${entityId}/${locale}`, form),
    onSuccess: () => {
      toast.push('success', 'SEO metadata saved.');
      qc.invalidateQueries({ queryKey: queryKeyToInvalidate });
    },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Save failed.'),
  });

  async function runAi(task: 'meta' | 'keywords' | 'rewrite' | 'links') {
    setAiBusy(task);
    try {
      if (task === 'meta') {
        const r = await api.post<{ variants: typeof metaVariants }>('/api/ai/meta', { entityType, entityId, locale });
        setMetaVariants(r.variants ?? null);
      } else if (task === 'keywords') {
        const r = await api.post<{ keywords: typeof keywordVariants }>('/api/ai/keywords', { entityType, entityId, locale });
        setKeywordVariants(r.keywords ?? null);
      } else if (task === 'rewrite') {
        const r = await api.post<{ title: string; description: string; changes: string[] }>('/api/ai/rewrite', { entityType, entityId, locale });
        setForm((f) => ({ ...f, metaTitle: r.title, metaDescription: r.description }));
        toast.push('info', `Rewritten: ${r.changes.join('; ')}`);
      } else if (task === 'links') {
        const r = await api.post<{ links: Array<{ targetReference: string; anchorText: string; reason: string }> }>('/api/ai/links', { entityType, entityId, locale });
        toast.push('info', r.links.length ? `Suggested links: ${r.links.map((l) => l.targetReference).join(', ')}` : 'No strong link candidates found.');
      }
    } catch (err) {
      toast.push('error', err instanceof ApiError ? err.message : 'AI request failed.');
    } finally {
      setAiBusy(null);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 20rem', gap: '2rem', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <h3>SEO</h3>
          {seoMeta && <SeoBadge score={seoMeta.score} band={seoMeta.band} />}
        </div>

        <div className="field">
          <label>Focus keyword</label>
          <input value={form.focusKeyword ?? ''} onChange={(e) => setForm((f) => ({ ...f, focusKeyword: e.target.value || null }))} placeholder="e.g. serviced apartment johor bahru" />
        </div>

        <div className="field">
          <label>Meta title <span className="dimmer">({(form.metaTitle ?? '').length} chars)</span></label>
          <input value={form.metaTitle ?? ''} onChange={(e) => setForm((f) => ({ ...f, metaTitle: e.target.value || null }))} />
        </div>

        <div className="field">
          <label>Meta description <span className="dimmer">({(form.metaDescription ?? '').length} chars)</span></label>
          <textarea rows={3} value={form.metaDescription ?? ''} onChange={(e) => setForm((f) => ({ ...f, metaDescription: e.target.value || null }))} />
        </div>

        <div className="field-row">
          <div className="field">
            <label>Canonical URL</label>
            <input value={form.canonicalUrl ?? ''} onChange={(e) => setForm((f) => ({ ...f, canonicalUrl: e.target.value || null }))} placeholder="(defaults to the page's own URL)" />
          </div>
          <div className="field">
            <label>Robots</label>
            <div style={{ display: 'flex', gap: '1rem', paddingTop: '.4rem', fontSize: '.8125rem' }}>
              <label style={{ display: 'flex', gap: '.35rem', alignItems: 'center', textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--sans)' }}>
                <input type="checkbox" checked={form.robotsIndex} onChange={(e) => setForm((f) => ({ ...f, robotsIndex: e.target.checked }))} /> Index
              </label>
              <label style={{ display: 'flex', gap: '.35rem', alignItems: 'center', textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--sans)' }}>
                <input type="checkbox" checked={form.robotsFollow} onChange={(e) => setForm((f) => ({ ...f, robotsFollow: e.target.checked }))} /> Follow
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <button className="btn btn--primary" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save SEO'}
          </button>
          <button className="btn" onClick={() => runAi('meta')} disabled={aiBusy !== null}>
            {aiBusy === 'meta' ? 'Thinking…' : '✨ Suggest title & description'}
          </button>
          <button className="btn" onClick={() => runAi('keywords')} disabled={aiBusy !== null}>
            {aiBusy === 'keywords' ? 'Thinking…' : '✨ Suggest keywords'}
          </button>
          <button className="btn" onClick={() => runAi('rewrite')} disabled={aiBusy !== null || !seoMeta || seoMeta.band === 'GOOD'}>
            {aiBusy === 'rewrite' ? 'Thinking…' : '✨ Fix failing rules'}
          </button>
          <button className="btn" onClick={() => runAi('links')} disabled={aiBusy !== null}>
            {aiBusy === 'links' ? 'Thinking…' : '✨ Suggest internal links'}
          </button>
        </div>

        {metaVariants && (
          <div className="card card-pad" style={{ background: 'var(--panel)' }}>
            <p className="mono dimmer" style={{ fontSize: '.6875rem', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.75rem' }}>AI suggestions — click to apply</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
              {metaVariants.map((v, i) => (
                <button key={i} className="btn" style={{ textAlign: 'left', display: 'block', height: 'auto', padding: '.6rem .8rem' }}
                  onClick={() => { setForm((f) => ({ ...f, metaTitle: v.title, metaDescription: v.description })); setMetaVariants(null); }}>
                  <div style={{ fontWeight: 500 }}>{v.title}</div>
                  <div className="dim" style={{ fontSize: '.75rem', margin: '.2rem 0' }}>{v.description}</div>
                  <div className="dimmer" style={{ fontSize: '.6875rem', fontStyle: 'italic' }}>{v.rationale}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {keywordVariants && (
          <div className="card card-pad" style={{ background: 'var(--panel)' }}>
            <p className="mono dimmer" style={{ fontSize: '.6875rem', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.75rem' }}>Keyword suggestions — click to apply</p>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {keywordVariants.map((k, i) => (
                <button key={i} className="btn btn--sm" title={k.rationale} onClick={() => { setForm((f) => ({ ...f, focusKeyword: k.keyword })); setKeywordVariants(null); }}>
                  {k.keyword} <span className="dimmer">· {k.intent}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mono dimmer" style={{ fontSize: '.6875rem', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.6rem' }}>Score checklist</p>
          <ScoreChecklist rules={seoMeta?.scoreDetail ?? []} />
        </div>
      </div>

      <div style={{ position: 'sticky', top: '1.5rem' }}>
        <p className="mono dimmer" style={{ fontSize: '.6875rem', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '.6rem' }}>Search result preview</p>
        <SerpPreview title={form.metaTitle ?? ''} description={form.metaDescription ?? ''} url={siteUrl} />
      </div>
    </div>
  );
}
