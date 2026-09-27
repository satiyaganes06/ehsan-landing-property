'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/rich-text-editor';

type Card = { id: string; value: string; title: string; unit?: string; subtitle?: string };
const titleName = (title: string) => title.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const normalize = (card: Card): Card => ({ id: card.id, value: `${card.value}${card.unit ? ` ${card.unit}` : ''}`, title: `${card.title}${card.subtitle ? ` ${card.subtitle}` : ''}` });

export function StatisticCardsEditor({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (value: string) => void }) {
  let cards: Card[] = [];
  try { const parsed: unknown = JSON.parse(value); if (Array.isArray(parsed)) cards = parsed.map(normalize); } catch { /* Recover with an empty card list. */ }
  const update = (id: string, patch: Partial<Card>) => onChange(JSON.stringify(cards.map(card => card.id === id ? { ...card, ...patch } : card)));
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">One card per statistic. Add or remove cards and the website automatically fits them into a responsive grid.</p>
    {cards.map((card, index) => <details key={card.id} open={index === 0} className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">{titleName(card.title) || 'New statistic'}</summary>
      <div className="mt-3 space-y-3">
        <label className="block space-y-1 text-xs">Value<Input aria-label={`Statistic ${index + 1} value`} type="text" maxLength={100} placeholder="e.g. 1.307 RM BIL or 17+ years" disabled={disabled} value={card.value} onChange={event => update(card.id, { value: event.target.value })} /></label>
        <div><p className="mb-1 text-xs">Title</p><RichTextEditor id={`stat-${card.id}-title`} label={`Statistic ${index + 1} title`} value={card.title} html disabled={disabled} onChange={title => update(card.id, { title })} /></div>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => onChange(JSON.stringify(cards.filter(item => item.id !== card.id)))}>Remove statistic {index + 1}</Button>
      </div>
    </details>)}
    {cards.length === 0 && <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">No statistic cards. This row is hidden on the website.</p>}
    <Button type="button" variant="outline" size="sm" disabled={disabled || cards.length >= 30} onClick={() => onChange(JSON.stringify([...cards, { id: crypto.randomUUID(), value: '', title: '' }]))}>Add statistic</Button>
  </div>;
}
