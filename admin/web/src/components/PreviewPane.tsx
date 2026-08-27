import { useState } from 'react';

const WIDTHS = [
  { key: 'mobile', label: 'Mobile', px: 390 },
  { key: 'tablet', label: 'Tablet', px: 768 },
  { key: 'desktop', label: 'Desktop', px: 1440 },
] as const;

/* Renders the PRODUCTION detail page via the backend's preview route (see
   admin/src/modules/preview/routes.ts) -- the real template, real CSS, real
   JS, with only the data fetch intercepted to show unsaved edits. Not a
   reimplementation: what shows here is what publishing will actually produce. */
export function PreviewPane({ src }: { src: string }) {
  const [width, setWidth] = useState<(typeof WIDTHS)[number]['px']>(1440);
  const [nonce, setNonce] = useState(0); // bumping forces the iframe to re-fetch

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', height: '100%' }}>
      <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
        {WIDTHS.map((w) => (
          <button key={w.key} className="btn btn--sm" style={width === w.px ? { borderColor: 'var(--brass-ink)', background: 'var(--panel-2)' } : undefined} onClick={() => setWidth(w.px)}>
            {w.label}
          </button>
        ))}
        <button className="btn btn--sm btn--ghost" onClick={() => setNonce((n) => n + 1)} title="Refresh preview">↻ Refresh</button>
        <span className="dimmer mono" style={{ fontSize: '.6875rem', marginLeft: 'auto' }}>{width}px</span>
      </div>
      <div style={{ flex: 1, minHeight: '32rem', overflow: 'auto', background: 'var(--panel)', border: '1px solid var(--line)', display: 'flex', justifyContent: 'center', padding: '1rem' }}>
        <iframe
          key={nonce}
          src={src}
          title="Live preview"
          style={{ width, maxWidth: '100%', height: '80rem', border: '1px solid var(--line-hi)', background: '#fff' }}
        />
      </div>
    </div>
  );
}
