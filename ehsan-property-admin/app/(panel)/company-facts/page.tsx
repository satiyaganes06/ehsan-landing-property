'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ErrorState } from '@/components/states';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { companyFactsSchema, type CompanyFacts } from '@/lib/company-facts';

export default function CompanyFactsPage() {
  const cache = useQueryClient();
  const editable = useSession().can('block', 'update');
  const query = useQuery({ queryKey: ['company-facts'], queryFn: () => api.get<CompanyFacts>('/api/company-facts') });
  const [draft, setDraft] = useState<CompanyFacts | null>(null);
  const data = draft ?? query.data;
  const save = useMutation({
    mutationFn: (value: CompanyFacts) => api.put<CompanyFacts>('/api/company-facts', value),
    onSuccess(value) { cache.setQueryData(['company-facts'], value); setDraft(null); toast.success('Company facts published'); },
    onError(error) { toast.error(error.message); },
  });

  function change(edit: (value: CompanyFacts) => void) {
    if (!data || !editable || save.isPending) return;
    const next = structuredClone(data);
    edit(next);
    setDraft(next);
  }
  return <main className="mx-auto w-full max-w-4xl space-y-6">
    <PageHeader title="Company Facts" description="Edit the public company profile and buyer questions. Project descriptions, locations and statuses come from published Projects." />
    {query.isError ? <ErrorState error={query.error} onRetry={() => query.refetch()} /> : !data ? <p>Loading company facts…</p> :
    <form className="space-y-5" onSubmit={event => {
      event.preventDefault();
      if (!draft || !editable || save.isPending) return;
      const result = companyFactsSchema.safeParse(draft);
      if (!result.success) { toast.error(result.error.issues[0].message); return; }
      save.mutate(result.data);
    }}>
      <fieldset disabled={!editable || save.isPending} className="space-y-5">
        <label className="block">Page title<Input required maxLength={120} value={data.title} onChange={e => change(n => { n.title = e.target.value; })} /></label>
        <label className="block">Introduction<Textarea required maxLength={700} value={data.introduction} onChange={e => change(n => { n.introduction = e.target.value; })} /></label>
        <label className="block">Company profile review date<Input required type="date" value={data.reviewed} onChange={e => change(n => { n.reviewed = e.target.value; })} /></label>
        {(['facts', 'questions'] as const).map(group => <section key={group} className="space-y-3">
          <h2 className="text-xl font-medium">{group === 'facts' ? 'Company profile' : 'Buyer questions'}</h2>
          {data[group].map((row, i) => <div key={i} className="space-y-3 rounded-xl border bg-card p-4">
            <label className="block">{group === 'facts' ? 'Fact label' : 'Question'}<Input required maxLength={180} value={row.label} onChange={e => change(n => { n[group][i].label = e.target.value; })} /></label>
            <label className="block">{group === 'facts' ? 'Value' : 'Answer'}<Textarea required maxLength={1200} value={row.value} onChange={e => change(n => { n[group][i].value = e.target.value; })} /></label>
            <Button type="button" variant="ghost" disabled={group === 'facts' && data.facts.length === 1} onClick={() => change(n => { n[group].splice(i, 1); })}>Remove {group === 'facts' ? 'fact' : 'question'}</Button>
          </div>)}
          <Button type="button" variant="outline" disabled={data[group].length >= (group === 'facts' ? 24 : 20)} onClick={() => change(n => { n[group].push({ label: '', value: '' }); })}>Add {group === 'facts' ? 'fact' : 'question'}</Button>
        </section>)}
        <Button type="submit" disabled={!draft}>{save.isPending ? 'Publishing…' : 'Publish changes'}</Button>
        {draft && <Button type="button" variant="ghost" onClick={() => setDraft(null)}>Discard edits</Button>}
      </fieldset>
    </form>}
    <a className="underline" href={`${process.env.NEXT_PUBLIC_LANDING_URL || (process.env.NODE_ENV === 'production' ? 'https://ehsanproperty.com' : 'http://localhost:8899')}/ai-instructions/`} target="_blank" rel="noopener">View public page</a>
  </main>;
}
