'use client';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/rich-text-editor';

type Heading = { label: string; title: string; introduction: string };
export function SectionHeadingEditor({ id, value, disabled, onChange }: { id: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  let heading: Heading = { label: '', title: '', introduction: '' };
  try { heading = { ...heading, ...JSON.parse(value) }; } catch { /* Keep editable empty heading. */ }
  const update = (key: keyof Heading, text: string) => onChange(JSON.stringify({ ...heading, [key]: text }));
  const labels: Record<keyof Heading, string> = { label: 'Section label', title: 'Title', introduction: 'Introduction' };
  return <div className="space-y-4">
    <p className="text-xs text-muted-foreground">One heading group. Keep the parts you need; empty parts are not shown on the website.</p>
    {(Object.keys(labels) as (keyof Heading)[]).map(key => <div key={key} className="space-y-2">
      <div className="flex items-center justify-between"><p className="text-xs font-medium">{labels[key]}</p>{heading[key] && <Button size="sm" variant="ghost" disabled={disabled} onClick={() => update(key, '')}>Remove {labels[key].toLowerCase()}</Button>}</div>
      {heading[key] ? <RichTextEditor id={`${id}-${key}`} label={labels[key]} value={heading[key]} html disabled={disabled} onChange={text => update(key, text)} /> : <Button size="sm" variant="outline" disabled={disabled} onClick={() => update(key, `New ${labels[key].toLowerCase()}`)}>Add {labels[key].toLowerCase()}</Button>}
    </div>)}
  </div>;
}
