'use client';

import { createContext, use, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { hasPermission, type Action, type Resource } from '@/lib/permissions';
import type { Me } from '@/lib/types';

interface SessionValue {
  me: Me | undefined;
  isLoading: boolean;
  can: (resource: Resource, action: Action) => boolean;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/api/auth/me'),
    // The identity behind every permission check on screen; refetching it
    // mid-session only risks a flicker of the nav.
    staleTime: Infinity,
    retry: false,
  });

  const can = useCallback(
    (resource: Resource, action: Action) => hasPermission(me?.permissions, resource, action),
    [me?.permissions],
  );

  const signOut = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => {
      // Signing out must always land on the login screen, even if the network
      // call fails -- the cookie is cleared server-side or it isn't, but the
      // person asked to leave.
    });
    queryClient.clear();
    router.replace('/login');
  }, [queryClient, router]);

  return (
    <SessionContext value={{ me, isLoading, can, signOut }}>
      {children}
    </SessionContext>
  );
}

export function useSession() {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}
