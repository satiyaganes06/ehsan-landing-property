'use client';

import { AlertTriangle, RotateCw, SearchX, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

/* ---------------------------------------------------------------------------
   The three states a screen can be in besides "showing data". Every list and
   panel in this app uses these rather than rendering nothing -- a blank region
   is indistinguishable from a broken one.
--------------------------------------------------------------------------- */

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'border-border/70 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-full">
          <Icon className="size-4" />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** Shown when a filter or search matched nothing — distinct from having no records at all. */
export function NoResultsState({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      icon={SearchX}
      title="No matches"
      description="Nothing here fits the current filters."
      action={
        onClear ? (
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        ) : undefined
      }
    />
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const forbidden = error instanceof ApiError && error.isForbidden;
  const message =
    error instanceof Error ? error.message : "The server couldn't complete that request.";

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border px-6 py-14 text-center',
        forbidden ? 'border-border bg-muted/40' : 'border-destructive/30 bg-destructive/5',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-9 items-center justify-center rounded-full',
          forbidden ? 'bg-muted text-muted-foreground' : 'bg-destructive/10 text-destructive',
        )}
      >
        {forbidden ? <ShieldOff className="size-4" /> : <AlertTriangle className="size-4" />}
      </span>

      <div className="space-y-1">
        <p className="text-sm font-medium">
          {forbidden ? 'You don’t have access to this' : 'This didn’t load'}
        </p>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">{message}</p>
      </div>

      {!forbidden && onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="size-3.5" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}
