'use client';

import { Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SeoPill } from '@/components/state-pills';
import type { SeoMeta } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Google truncates around these lengths; the bar turns before the cut. */
const TITLE_MAX = 60;
const DESC_MAX = 155;

interface SeoPanelProps {
  seo: SeoMeta;
  draft: SeoDraft;
  onChange: (patch: Partial<SeoDraft>) => void;
  /** Public URL the record will live at, for the SERP preview. */
  previewUrl: string;
}

export interface SeoDraft {
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
}

export function SeoPanel({ seo, draft, onChange, previewUrl }: SeoPanelProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        <Field
          label="Search result title"
          hint="Shown as the blue headline on Google."
          value={draft.metaTitle}
          max={TITLE_MAX}
          onChange={(metaTitle) => onChange({ metaTitle })}
        />

        <Field
          label="Search result description"
          hint="The grey summary beneath the headline."
          value={draft.metaDescription}
          max={DESC_MAX}
          multiline
          onChange={(metaDescription) => onChange({ metaDescription })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="focus">Focus keyword</Label>
            <Input
              id="focus"
              value={draft.focusKeyword}
              onChange={(e) => onChange({ focusKeyword: e.target.value })}
              placeholder="e.g. terrace homes Rembau"
            />
            <p className="text-muted-foreground text-xs">
              The phrase this page should rank for. Used to grade the checks.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="canonical">Canonical URL</Label>
            <Input
              id="canonical"
              value={draft.canonicalUrl}
              onChange={(e) => onChange({ canonicalUrl: e.target.value })}
              placeholder="Leave blank to use the page's own URL"
            />
            <p className="text-muted-foreground text-xs">
              Set this only when the same content lives at another address.
            </p>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Search engine visibility</legend>
          <div className="flex flex-wrap gap-4 pt-1">
            <Toggle
              label="Allow indexing"
              checked={draft.robotsIndex}
              onChange={(robotsIndex) => onChange({ robotsIndex })}
            />
            <Toggle
              label="Follow links"
              checked={draft.robotsFollow}
              onChange={(robotsFollow) => onChange({ robotsFollow })}
            />
          </div>
        </fieldset>
      </div>

      <aside className="space-y-5">
        <section className="space-y-2">
          <h3 className="text-sm font-medium">How it will look</h3>
          <div className="bg-card space-y-1 rounded-lg border p-3">
            <p className="text-muted-foreground truncate font-mono text-[0.6875rem]">{previewUrl}</p>
            <p className="line-clamp-2 text-[0.9375rem] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
              {draft.metaTitle || 'Untitled page'}
            </p>
            <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed">
              {draft.metaDescription || 'No description yet. Search engines will pick their own text.'}
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Checks</h3>
            <SeoPill band={seo.band} score={seo.score} />
          </div>

          <ul className="bg-card divide-border divide-y overflow-hidden rounded-lg border">
            {seo.scoreDetail?.map((rule) => (
              <li key={rule.id} className="flex gap-2.5 px-3 py-2">
                <span
                  className={cn(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full',
                    rule.passed ? 'bg-brass text-[#12110d]' : 'bg-rust-soft text-rust',
                  )}
                  aria-hidden
                >
                  {rule.passed ? <Check className="size-2.5" /> : <X className="size-2.5" />}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium">{rule.label}</p>
                  <p className="text-muted-foreground text-xs">{rule.message}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-muted-foreground text-xs">
            The score updates when you save. It is calculated by fixed rules, so it never
            changes on its own.
          </p>
        </section>
      </aside>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  max,
  multiline,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  max: number;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  const used = value.length;
  const ratio = Math.min(used / max, 1);
  const over = used > max;
  const id = label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span
          className={cn(
            'font-mono text-xs tabular-nums',
            over ? 'text-rust' : used > max * 0.9 ? 'text-sand' : 'text-muted-foreground',
          )}
        >
          {used}/{max}
        </span>
      </div>

      {multiline ? (
        <Textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      )}

      {/* Length as a bar, because a number alone doesn't show how close you are. */}
      <div className="bg-muted h-0.5 w-full overflow-hidden rounded-full">
        <div
          className={cn('h-full transition-all', over ? 'bg-rust' : ratio > 0.9 ? 'bg-sand' : 'bg-brass-line')}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      <p className="text-muted-foreground text-xs">
        {over ? `Google will cut this off after about ${max} characters.` : hint}
      </p>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-brass-line size-4"
      />
      {label}
    </label>
  );
}
