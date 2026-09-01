'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Loader2, Plus, X } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { TextBlock } from '@/lib/types';

/* The order the sections actually appear in as you scroll the landing page.
   The site's scroll choreography depends on this order, so it is presented as
   a fact about the page rather than something to rearrange here. */
const GROUP_ORDER = ['hero', 'prelude', 'doctrine', 'commitment', 'contact'] as const;

const GROUP_LABEL: Record<string, string> = {
  hero: 'Hero',
  prelude: 'Prelude',
  doctrine: 'Doctrine',
  commitment: 'Commitments',
  contact: 'Contact',
};

const GROUP_BLURB: Record<string, string> = {
  hero: 'The first screen, before anyone scrolls.',
  prelude: 'The short introduction under the hero.',
  doctrine: 'The dark section explaining how the company works.',
  commitment: 'The five promises listed on the page.',
  contact: 'Address and contact details in the footer.',
};

export default function ContentPage() {
  const { can } = useSession();
  const editable = can('block', 'update');

  const query = useQuery({
    queryKey: ['blocks'],
    queryFn: () => api.get<TextBlock[]>('/api/blocks'),
  });

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    blocks: (query.data ?? []).filter((b) => b.group === group),
  })).filter((section) => section.blocks.length > 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Page text"
        description="The fixed wording on the landing page, in the order it appears."
      />

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isPending ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ group, blocks }) => (
            <section key={group} className="space-y-3">
              <div className="space-y-0.5">
                <h2 className="text-sm font-medium">{GROUP_LABEL[group] ?? group}</h2>
                <p className="text-muted-foreground text-xs">{GROUP_BLURB[group]}</p>
              </div>

              <div className="space-y-3">
                {blocks.map((block) => (
                  <BlockCard key={block.key} block={block} editable={editable} />
                ))}
              </div>
            </section>
          ))}

          <p className="text-muted-foreground border-t pt-4 text-xs">
            Section order is fixed. The page’s scroll animation depends on it, so it isn’t
            editable here.
          </p>
        </div>
      )}
    </div>
  );
}

function BlockCard({ block, editable }: { block: TextBlock; editable: boolean }) {
  const queryClient = useQueryClient();
  const isList = block.kind === 'list';

  const initial = isList
    ? (Array.isArray(block.value) ? block.value : []).join('\n')
    : typeof block.value === 'string'
      ? block.value
      : '';

  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);

  const dirty = value !== initial;

  const save = useMutation({
    mutationFn: () =>
      api.put(`/api/blocks/${block.key}/translations/EN`, {
        value: isList
          ? value.split('\n').map((line) => line.trim()).filter(Boolean)
          : value,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['blocks'] });
      toast.success('Saved.', { description: block.label });
    },
    onError: (err) =>
      toast.error('Could not save', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  const long = isList || block.kind === 'paragraph';

  return (
    <div className="bg-card space-y-2.5 rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={block.key} className="text-sm font-medium">
          {block.label}
        </label>
        <span className="text-muted-foreground font-mono text-[0.6875rem]">{block.key}</span>
      </div>

      {long ? (
        <Textarea
          id={block.key}
          rows={isList ? Math.max(3, value.split('\n').length) : 3}
          value={value}
          disabled={!editable}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : (
        <Input
          id={block.key}
          value={value}
          disabled={!editable}
          onChange={(e) => setValue(e.target.value)}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {isList ? 'One item per line.' : `${value.length} characters`}
        </p>

        {editable ? (
          <div className="flex items-center gap-1.5">
            {dirty ? (
              <Button variant="ghost" size="xs" onClick={() => setValue(initial)}>
                <X className="size-3" />
                Undo
              </Button>
            ) : null}
            <Button size="xs" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : dirty ? (
                <Plus className="size-3 rotate-45" />
              ) : (
                <Check className="size-3" />
              )}
              {save.isPending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
