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
    onSuccess: () => {
      queryClient.clear();
      const next = params.get('next');
      let destination = '/';
      if (next?.startsWith('/') && !next.startsWith('//') && !/[\\\s]/.test(next)) {
        const url = new URL(next, window.location.origin);
        if (url.origin === window.location.origin && !url.pathname.startsWith('//')) {
          destination = url.pathname + url.search + url.hash;
        }
      }
      router.replace(destination);
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
      <h1 className="font-display text-3xl font-semibold tracking-tight">Sign in</h1>

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
      <aside className="relative hidden overflow-hidden bg-[#192124] text-white lg:block" style={{ backgroundImage: "linear-gradient(180deg, rgba(13,20,22,.8), transparent 50%, rgba(13,20,22,.88)), url('/login-skyline.webp')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-x-0 top-0 p-12">
          <p className="eyebrow text-white">Ehsan Plant &amp; Property</p>
        </div>
      </aside>

      <div className="flex items-center justify-center px-6 py-16">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
