'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { Licensing } from '@/lib/licensing';

export default function LicensingPage() {
  const client = useQueryClient();
  const { can } = useSession();
  const editable = can('block', 'update');
  const query = useQuery({ queryKey: ['project-licensing'], queryFn: () => api.get<Licensing>('/api/project-licensing') });
  const [draft, setDraft] = useState<Licensing | null>(null);
  const data = draft ?? query.data;
  const save = useMutation({
    mutationFn: (value: Licensing) => api.put<Licensing>('/api/project-licensing', value),
    onSuccess: value => { client.setQueryData(['project-licensing'], value); setDraft(null); toast.success('Project licensing saved'); },
    onError: (error: Error) => toast.error(error.message),
  });
  function change(edit: (value: Licensing) => void) {
    if (!data || !editable || save.isPending) return;
    const next = structuredClone(data); edit(next); setDraft(next);
  }
  return <div className="mx-auto w-full max-w-5xl space-y-6">
    <PageHeader title="Project Licensing" description="Edit developer licences, advertising permits and development particulars. Saved changes appear on the public page."
      actions={<div className="flex gap-2"><Button variant="outline" asChild><a href={`${process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:8899'}/project-licensing/`} target="_blank" rel="noopener">View page</a></Button><Button disabled={!editable || !draft || save.isPending} onClick={() => data && save.mutate(data)}><Save className="size-4" />{save.isPending ? 'Saving…' : 'Save changes'}</Button></div>} />
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-relaxed">Review the supplied dates before publishing: Mutiara Austin Phase 1 and Universiti Bestari Phase 5 include validity dates earlier than October 2026. Source formatting is preserved, including the Widuri price “RM 386,900.000” and permit punctuation. Confirm corrections against the original documents.</div>
    {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !data ? <p>Loading licensing details…</p> : <>
      <fieldset disabled={!editable || save.isPending} className="space-y-4">
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="space-y-2"><Label htmlFor="licensing-title">Page title</Label><Input id="licensing-title" value={data.title} onChange={event => change(next => { next.title = event.target.value; })} /></div>
          <div className="space-y-2"><Label htmlFor="licensing-intro">Introduction</Label><Textarea id="licensing-intro" value={data.intro} onChange={event => change(next => { next.intro = event.target.value; })} /></div>
        </div>
        {data.records.map((record, index) => <details key={record.id} open={index === 0 ? true : undefined} className="rounded-xl border bg-card">
          <summary className="cursor-pointer p-5 font-medium">{record.project || 'New project'} · {record.phase || 'New phase'}{!record.published ? ' — Hidden' : ''}</summary>
          <div className="space-y-5 border-t p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor={`${record.id}-project`}>Project name</Label><Input id={`${record.id}-project`} value={record.project} onChange={event => change(next => { next.records[index].project = event.target.value; })} /></div>
              <div className="space-y-2"><Label htmlFor={`${record.id}-phase`}>Phase</Label><Input id={`${record.id}-phase`} value={record.phase} onChange={event => change(next => { next.records[index].phase = event.target.value; })} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={record.published} onChange={event => change(next => { next.records[index].published = event.target.checked; })} />Show on public licensing page</label>
            <div className="space-y-2"><Label htmlFor={`${record.id}-notice`}>Advertising approval statement</Label><Textarea id={`${record.id}-notice`} value={record.notice} onChange={event => change(next => { next.records[index].notice = event.target.value; })} /></div>
            {record.fields.map((field, fieldIndex) => <div key={fieldIndex} className="grid items-start gap-3 rounded-lg border p-3 sm:grid-cols-[220px_1fr_32px]">
              <div className="space-y-2"><Label htmlFor={`${record.id}-${fieldIndex}-label`}>Detail label</Label><Input id={`${record.id}-${fieldIndex}-label`} value={field.label} onChange={event => change(next => { next.records[index].fields[fieldIndex].label = event.target.value; })} /></div>
              <div className="space-y-2"><Label htmlFor={`${record.id}-${fieldIndex}-value`}>{field.label || 'Detail value'}</Label><Textarea id={`${record.id}-${fieldIndex}-value`} rows={field.value.length > 300 ? 6 : 2} value={field.value} onChange={event => change(next => { next.records[index].fields[fieldIndex].value = event.target.value; })} /></div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${field.label || 'detail'}`} onClick={() => change(next => { next.records[index].fields.splice(fieldIndex, 1); })}><X className="size-4" /></Button>
            </div>)}
            <Button variant="outline" onClick={() => change(next => { next.records[index].fields.push({ label: 'New detail', value: '' }); })}><Plus className="size-4" />Add detail</Button>
          </div>
        </details>)}
        <Button variant="outline" onClick={() => change(next => { next.records.push({ id: `licensing-${crypto.randomUUID()}`, project: 'New project', phase: '', published: false, notice: '', fields: [] }); })}><Plus className="size-4" />Add project or phase</Button>
      </fieldset>
      {draft ? <Button variant="ghost" disabled={save.isPending} onClick={() => setDraft(null)}>Discard unsaved changes</Button> : null}
    </>}
  </div>;
}
