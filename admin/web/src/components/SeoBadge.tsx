import type { SeoBand } from '../api/types';

export function SeoBadge({ score, band }: { score: number; band: SeoBand }) {
  const cls = band === 'GOOD' ? 'pill--good' : band === 'NEUTRAL' ? 'pill--neutral' : 'pill--bad';
  const label = band === 'GOOD' ? 'Good' : band === 'NEUTRAL' ? 'Neutral' : 'Bad';
  return <span className={`pill ${cls}`}>{label} · {score}</span>;
}

export function PublishBadge({ state }: { state: string }) {
  const cls = state === 'PUBLISHED' ? 'pill--good' : state === 'SCHEDULED' ? 'pill--neutral' : 'pill--flat';
  return <span className={`pill ${cls}`}>{state === 'PUBLISHED' ? 'Published' : state === 'SCHEDULED' ? 'Scheduled' : 'Draft'}</span>;
}
