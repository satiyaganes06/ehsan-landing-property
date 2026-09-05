import { cn } from '@/lib/utils';
import type { EnquiryStatus, PublishState, SeoBand } from '@/lib/types';

/* ---------------------------------------------------------------------------
   State reads at a glance or it doesn't read at all.

   The semantic ramp is the brand's own, not a generic green/amber/red: brass
   is what the site uses for emphasis, so brass means good; sand is the site's
   secondary warm accent, so sand means "needs a look"; rust is the one red in
   the site's palette. A published record and a passing SEO score therefore
   look like the same idea, because they are.
--------------------------------------------------------------------------- */

const base =
  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap';

const PUBLISH: Record<PublishState, { label: string; className: string; dot: string }> = {
  PUBLISHED: {
    label: 'Live',
    className: 'bg-brass-soft text-brass-ink',
    dot: 'bg-brass-line',
  },
  DRAFT: {
    label: 'Draft',
    className: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground/50',
  },
  SCHEDULED: {
    label: 'Scheduled',
    className: 'bg-sand-soft text-sand',
    dot: 'bg-sand',
  },
  ARCHIVED: {
    label: 'Archived',
    className: 'bg-muted text-muted-foreground line-through decoration-1',
    dot: 'bg-muted-foreground/40',
  },
};

export function PublishPill({ state, className }: { state: PublishState; className?: string }) {
  const style = PUBLISH[state] ?? PUBLISH.DRAFT;
  return (
    <span className={cn(base, style.className, className)}>
      <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden />
      {style.label}
    </span>
  );
}

const BAND: Record<SeoBand, { label: string; className: string }> = {
  GOOD: { label: 'Good', className: 'bg-brass-soft text-brass-ink' },
  NEUTRAL: { label: 'Fair', className: 'bg-sand-soft text-sand' },
  BAD: { label: 'Poor', className: 'bg-rust-soft text-rust' },
};

export function SeoPill({
  band,
  score,
  className,
}: {
  band?: SeoBand | null;
  score?: number | null;
  className?: string;
}) {
  if (!band) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const style = BAND[band];
  return (
    <span className={cn(base, style.className, className)}>
      {style.label}
      {typeof score === 'number' ? (
        <span className="font-mono tabular-nums opacity-70">{score}</span>
      ) : null}
    </span>
  );
}

const ENQUIRY: Record<EnquiryStatus, { label: string; className: string }> = {
  NEW: { label: 'New', className: 'bg-brass-soft text-brass-ink' },
  READ: { label: 'Read', className: 'bg-muted text-muted-foreground' },
  REPLIED: { label: 'Replied', className: 'bg-accent text-accent-foreground' },
  ARCHIVED: { label: 'Archived', className: 'bg-muted text-muted-foreground' },
  SPAM: { label: 'Spam', className: 'bg-rust-soft text-rust' },
};

export function EnquiryPill({ status, className }: { status: EnquiryStatus; className?: string }) {
  const style = ENQUIRY[status] ?? ENQUIRY.READ;
  return <span className={cn(base, style.className, className)}>{style.label}</span>;
}
