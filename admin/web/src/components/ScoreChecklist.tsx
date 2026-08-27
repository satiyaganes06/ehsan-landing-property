import type { RuleResult } from '../api/types';

export function ScoreChecklist({ rules }: { rules: RuleResult[] }) {
  if (!rules.length) return <p className="dim">Not scored yet — save the SEO fields to see the checklist.</p>;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
      {rules.map((r) => (
        <li key={r.id} style={{ display: 'flex', gap: '.6rem', alignItems: 'flex-start', fontSize: '.8125rem' }}>
          <span style={{ color: r.passed ? 'var(--ok)' : 'var(--risk)', fontWeight: 600, width: '1.1rem', flexShrink: 0 }}>
            {r.passed ? '✓' : '✕'}
          </span>
          <span>
            <strong style={{ fontWeight: 500 }}>{r.label}</strong>
            <span className="dim"> — {r.message}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
