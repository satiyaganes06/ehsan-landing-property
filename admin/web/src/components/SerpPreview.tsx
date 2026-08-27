import { truncateToPx } from '../lib/pixel-width';

/* Google's own snippet, approximated -- not a production template like the
   detail-page preview, because no such surface exists on Google's side to
   reuse. Truncation uses the same pixel heuristic the score engine grades
   against, so what an editor sees here matches why a rule passed or failed. */
export function SerpPreview({ title, description, url }: { title: string; description: string; url: string }) {
  const shownTitle = truncateToPx(title || 'Untitled page', 20, 600);
  const shownDesc = truncateToPx(description || 'No description set.', 14, 960);

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: '1rem 1.25rem', maxWidth: 600 }}>
      <div style={{ fontSize: 14, color: '#202124', marginBottom: 2 }}>{url}</div>
      <div style={{ fontSize: 20, color: '#1a0dab', lineHeight: 1.3, marginBottom: 3 }}>{shownTitle}</div>
      <div style={{ fontSize: 14, color: '#4d5156', lineHeight: 1.5 }}>{shownDesc}</div>
    </div>
  );
}
