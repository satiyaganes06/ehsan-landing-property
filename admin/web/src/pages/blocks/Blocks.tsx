import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../api/client';
import type { TextBlockItem } from '../../api/types';
import { useToast } from '../../lib/toast';

function ValueEditor({ block, onSave }: { block: TextBlockItem; onSave: (value: unknown) => void }) {
  const [local, setLocal] = useState<string>('');
  useEffect(() => {
    setLocal(Array.isArray(block.value) ? (block.value as string[]).join('\n') : String(block.value ?? ''));
  }, [block]);

  const isList = block.kind === 'list';
  const isHeading = block.kind === 'heading';

  return (
    <div className="field" style={{ flex: 1 }}>
      <label>{block.label} <span className="dimmer">({block.key})</span></label>
      {isList ? (
        <textarea rows={4} value={local} onChange={(e) => setLocal(e.target.value)} />
      ) : isHeading ? (
        <input value={local} onChange={(e) => setLocal(e.target.value)} />
      ) : (
        <textarea rows={3} value={local} onChange={(e) => setLocal(e.target.value)} />
      )}
      <button className="btn btn--sm" style={{ width: 'fit-content' }}
        onClick={() => onSave(isList ? local.split('\n').map((l) => l.trim()).filter(Boolean) : local)}>
        Save
      </button>
    </div>
  );
}

export function Blocks() {
  const toast = useToast();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['blocks'], queryFn: () => api.get<TextBlockItem[]>('/api/blocks?locale=EN') });

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => api.put(`/api/blocks/${key}/translations/EN`, { value }),
    onSuccess: () => { toast.push('success', 'Saved.'); qc.invalidateQueries({ queryKey: ['blocks'] }); },
    onError: (err) => toast.push('error', err instanceof ApiError ? err.message : 'Save failed.'),
  });

  const groups = new Map<string, TextBlockItem[]>();
  for (const b of data ?? []) {
    if (!groups.has(b.group)) groups.set(b.group, []);
    groups.get(b.group)!.push(b);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1>Page text</h1>
      <p className="dim" style={{ maxWidth: '42rem', fontSize: '.8125rem' }}>
        The copy around the projects, events and everything else on the landing page — hero, prelude, doctrine,
        commitments, contact details. Typed fields, not a page builder: the scroll layout depends on this
        structure, so editing here changes the words without being able to break the page.
      </p>
      {[...groups.entries()].map(([group, blocks]) => (
        <div key={group} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '42rem' }}>
          <h3 style={{ textTransform: 'capitalize' }}>{group}</h3>
          {blocks.map((b) => (
            <ValueEditor key={b.key} block={b} onSave={(value) => save.mutate({ key: b.key, value })} />
          ))}
        </div>
      ))}
    </div>
  );
}
