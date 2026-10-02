'use client';
import { ModernSelect } from "@/components/modern-select";
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

type PageSettings = { enabled: boolean; interest: string; sections: Record<string, boolean> };
type Settings = PageSettings & { options: string[]; sectionOptions: { id: string; label: string }[] };
export function ProjectEnquirySettings({ id, readOnly }: { id: string; readOnly: boolean }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['project-enquiry', id], queryFn: () => api.get<Settings>(`/api/projects/${id}/enquiry`) });
  const [draft, setDraft] = useState<PageSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const value = draft ?? query.data;
  async function save() {
    if (!value) return;
    setBusy(true);
    try { await api.put(`/api/projects/${id}/enquiry`, { enabled: value.enabled, interest: value.interest, sections: value.sections }); await Promise.all([client.invalidateQueries({ queryKey: ['project-enquiry', id] }), client.invalidateQueries({ queryKey: ['projects', id] })]); setDraft(null); toast.success('Project page settings saved.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save settings.'); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 space-y-4 rounded-xl border p-5"><h2 className="font-medium">Project page sections & enquiry</h2><p className="text-sm text-muted-foreground">Choose the sections shown on this project&apos;s mobile-first page. Empty sections are automatically hidden. Existing content is kept when a section is switched off.</p>
    {query.isError ? <Button onClick={() => query.refetch()}>Retry loading settings</Button> : !value ? <p>Loading settings…</p> : <>
      <fieldset className="space-y-3 rounded-lg border p-4"><legend className="px-2 text-sm font-medium">Visible sections</legend><div className="grid gap-3 sm:grid-cols-2">{query.data?.sectionOptions.map(section => <label key={section.id} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={value.sections[section.id] !== false} disabled={readOnly || busy} onChange={event => setDraft({ ...value, sections: { ...value.sections, [section.id]: event.target.checked } })} />{section.label}</label>)}</div></fieldset>
      <h3 className="text-sm font-medium">Lead enquiry form</h3><p className="text-xs text-muted-foreground">Off by default. Enable it and choose the development visitors will enquire about.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value.enabled} disabled={readOnly || busy} onChange={event => setDraft({ ...value, enabled: event.target.checked })} />Show enquiry form on this project page</label>
      <label className="block space-y-2 text-sm">Default “Interested in”<ModernSelect className="bg-background w-full rounded-md border p-2" value={value.interest} disabled={readOnly || busy} onChange={event => setDraft({ ...value, interest: event.target.value })}><option value="">Choose a development</option>{[...new Set([...(query.data?.options ?? []), ...(value.interest ? [value.interest] : [])])].map(option => <option key={option} value={option}>{option}</option>)}</ModernSelect></label>
      <p className="text-xs text-muted-foreground">Saved separately from project content. Visitors cannot choose a different interest.</p>
      <Button disabled={readOnly || busy || !draft || (value.enabled && !value.interest)} onClick={save}>{busy ? 'Saving…' : 'Save page settings'}</Button>
    </>}
  </section>;
}
