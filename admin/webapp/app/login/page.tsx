'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const signIn = useMutation({
    mutationFn: () => api.post('/api/auth/login', { email, password }),
    onMutate: () => setError(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      const next = params.get('next');
      router.replace(next && next.startsWith('/') ? next : '/');
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    },
  });

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        signIn.mutate();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Manage the content on the Ehsan Plant &amp; Property site.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            aria-invalid={Boolean(error)}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            aria-invalid={Boolean(error)}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10"
          />
        </div>

        {error ? (
          <p role="alert" className="text-destructive border-destructive/30 bg-destructive/5 rounded-md border px-3 py-2 text-sm">
            {error}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={signIn.isPending}
        className="bg-brass h-11 w-full text-[#12110d] hover:bg-[color-mix(in_srgb,var(--brass),#12110d_8%)]"
      >
        {signIn.isPending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Signing in…
          </>
        ) : (
          <>
            Sign in
            <ArrowRight aria-hidden />
          </>
        )}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Deliberately the panel's dark register: the sign-in screen is the one
          place with no content to compete with, so it carries the brand. */}
      <aside className="relative hidden flex-col justify-between bg-[#1a1f22] p-12 text-[#d8dcd4] lg:flex">
        <div className="bg-brass absolute inset-y-0 left-0 w-0.5" aria-hidden />

        <div>
          <p className="eyebrow text-[#8f9689]">Ehsan Plant &amp; Property</p>
          <p className="font-display mt-2 text-2xl font-semibold tracking-tight text-[#f6f6f0]">
            Admin
          </p>
        </div>

        <div className="max-w-sm">
          <p className="font-display text-3xl leading-tight font-medium tracking-tight text-[#f6f6f0]">
            Projects, events and the words on the page — edited in one place.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-[#8f9689]">
            Changes are saved as drafts and only reach the live site when you publish them.
          </p>
        </div>

        <p className="font-mono text-[0.6875rem] tracking-wide text-[#6a7168]">
          Content management system
        </p>
      </aside>

      <div className="flex items-center justify-center px-6 py-16">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
