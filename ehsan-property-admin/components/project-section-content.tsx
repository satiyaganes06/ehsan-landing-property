'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ProjectContent } from '@/lib/server/project-content';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const simpleFields = [
  ['access', 'Access routes and distances'], ['facilities', 'Facilities / features'],
  ['updates', 'Project updates'], ['shuttle', 'Shuttle connections'], ['fit', 'Buyer profiles'],
] as const;
const lines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);
export function ProjectSectionContent({ id, readOnly }: { id: string; readOnly: boolean }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['project-content', id], queryFn: () => api.get<ProjectContent>(`/api/projects/${id}/content`) });
  const [draft, setDraft] = useState<ProjectContent | null>(null);
  const [busy, setBusy] = useState(false);
  const value = draft ?? query.data;
  async function save() {
    if (!value) return;
    setBusy(true);
    try { await api.put(`/api/projects/${id}/content`, value); await Promise.all([client.invalidateQueries({ queryKey: ['project-content', id] }), client.invalidateQueries({ queryKey: ['projects', id] })]); setDraft(null); toast.success('Section content saved.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save section content.'); }
    finally { setBusy(false); }
  }
  if (query.isError) return <section className="mt-6 rounded-xl border p-5"><Button onClick={() => query.refetch()}>Retry loading section content</Button></section>;
  if (!value) return <p className="mt-6">Loading section content…</p>;
  return <section className="mt-6 space-y-4 rounded-xl border p-5"><h2 className="font-medium">Project section content</h2><p className="text-sm text-muted-foreground">Uses the Widuri section order. Leave unused sections empty; they will not appear. Add images in the Images tab. Save these details separately from the main copy.</p>
    <fieldset disabled={readOnly || busy} className="grid gap-4 lg:grid-cols-2">
      <label className="space-y-2 text-sm">Highlights — one “Label | Value” per line<Textarea defaultValue={value.facts.map(pair => pair.join(' | ')).join('\n')} onChange={event => setDraft({ ...value, facts: lines(event.target.value).map(line => { const [label, ...rest] = line.split('|'); return [label.trim(), rest.join('|').trim()]; }) })} /></label>
      <label className="space-y-2 text-sm">Location description / show house<Textarea value={value.locationText} onChange={event => setDraft({ ...value, locationText: event.target.value })} /></label>
      {simpleFields.map(([key, label]) => <label key={key} className="space-y-2 text-sm">{label} — one item per line<Textarea defaultValue={value[key].join('\n')} onChange={event => setDraft({ ...value, [key]: lines(event.target.value) })} /></label>)}
      <label className="space-y-2 text-sm">Neighbourhood — one “Group | Place | Place” per line<Textarea defaultValue={value.neighbourhood.map(group => [group.title, ...group.items].join(' | ')).join('\n')} onChange={event => setDraft({ ...value, neighbourhood: lines(event.target.value).map(line => { const [title, ...items] = line.split('|').map(item => item.trim()); return { title, items }; }) })} /></label>
      <label className="space-y-2 text-sm">Layouts — one “Type | Detail | Detail” per line<Textarea defaultValue={value.layouts.map(layout => [layout.name, ...layout.details].join(' | ')).join('\n')} onChange={event => setDraft({ ...value, layouts: lines(event.target.value).map(line => { const [name, ...details] = line.split('|').map(item => item.trim()); return { name, details }; }) })} /></label>
    </fieldset><Button disabled={readOnly || busy || !draft} onClick={save}>{busy ? 'Saving…' : 'Save section content'}</Button>
  </section>;
}
