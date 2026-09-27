import { cn } from '@/lib/utils';
import Link from 'next/link';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Primary and secondary actions for this screen. */
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  const sections: Record<string, string> = { Projects: '/projects/section', Events: '/events/section', Awards: '/awards/section', Testimonials: '/testimonials/section' };
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="font-display truncate text-2xl leading-tight font-semibold tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{sections[title] && <Link href={sections[title]} className="rounded-md border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">Homepage section</Link>}{actions}</div>
    </header>
  );
}
