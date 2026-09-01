'use client';

import { ErrorState } from '@/components/states';

export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl py-10">
      <ErrorState error={error} onRetry={reset} />
    </div>
  );
}
