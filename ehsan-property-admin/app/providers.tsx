'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ApiError, SESSION_EXPIRED_EVENT } from '@/lib/api';

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // An expired session or a denied action will not succeed on the
            // second attempt; retrying only delays the message.
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  // One redirect for an expired session, no matter how many queries noticed.
  useEffect(() => {
    let redirected = false;

    function onExpired() {
      if (redirected) return;
      redirected = true;
      queryClient.clear();
      toast.error('Your session has ended.', { description: 'Sign in again to continue.' });
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [queryClient, router]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
