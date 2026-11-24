'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Monitor, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

type Session = {
  id: string;
  email: string;
  current: boolean;
  canRevoke: boolean;
  createdAt: string;
  expiresAt: string;
  ip: string | null;
  userAgent: string | null;
};

function deviceLabel(agent: string | null) {
  const ua = agent ?? '';
  const browser = [
    [/Edg(?:e|A|iOS)?\//i, 'Edge'], [/OPR\//, 'Opera'], [/SamsungBrowser\//, 'Samsung Internet'],
    [/Firefox|FxiOS/, 'Firefox'], [/Chrome|CriOS/, 'Chrome'], [/Safari/, 'Safari'],
  ] as const;
  const systems = [
    [/iPad/, 'iPad'], [/iPhone/, 'iPhone'], [/Android/, 'Android'], [/CrOS/, 'ChromeOS'],
    [/Windows/, 'Windows'], [/Macintosh|Mac OS X/, 'macOS'], [/Linux/, 'Linux'],
  ] as const;
  const name = browser.find(([pattern]) => pattern.test(ua))?.[1];
  const system = systems.find(([pattern]) => pattern.test(ua))?.[1];
  return [name, system].filter(Boolean).join(' on ') || 'Unrecognized device';
}

export function ActiveSessions() {
  const client = useQueryClient();
  const { can, signOut } = useSession();
  const [selected, setSelected] = useState<Session | null>(null);
  const sessions = useQuery({
    queryKey: ['active-sessions'],
    queryFn: () => api.get<Session[]>('/api/users/sessions'),
    refetchInterval: 30000,
  });
  const terminate = useMutation({
    mutationFn: async (session: Session) => {
      if (session.current) return signOut();
      await api.post('/api/users/sessions', { id: session.id });
      toast.success('Device session ended.');
    },
    onSettled: (_, __, session) => {
      if (!session.current) void client.invalidateQueries({ queryKey: ['active-sessions'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section aria-labelledby="session-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="session-heading" className="text-lg font-semibold">Active sessions</h2>
        {can('audit', 'read') && <a href="/audit" className="inline-flex items-center gap-1 text-sm underline">Activity log <ArrowUpRight className="size-3.5" /></a>}
      </div>
      <div className="bg-card divide-y rounded-lg border">
        {sessions.isError ? <div className="p-4 text-sm">Couldn’t load sessions. <button className="underline" onClick={() => sessions.refetch()}>Retry</button></div>
          : sessions.isPending ? <p className="p-4 text-sm">Loading sessions…</p>
          : !sessions.data.length ? <p className="p-4 text-sm">No active sessions.</p>
          : sessions.data.map(session => {
            const Icon = /Android|iPhone|iPad/i.test(session.userAgent ?? '') ? Smartphone : Monitor;
            return (
              <div key={session.id} className="flex flex-wrap items-center gap-3 p-4">
                <Icon aria-hidden className="text-muted-foreground size-5 shrink-0" />
                <div className="min-w-0 grow basis-52">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm">{deviceLabel(session.userAgent)}</strong>
                    {session.current && <span className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs">This device</span>}
                  </div>
                  <p className="break-all text-sm">{session.email}</p>
                  <p className="text-muted-foreground mt-1 text-xs">Signed in {new Date(session.createdAt).toLocaleString()} · IP {session.ip || 'unavailable'}</p>
                  <p className="text-muted-foreground text-xs">Expires {new Date(session.expiresAt).toLocaleDateString()}</p>
                </div>
                {(session.current || session.canRevoke) && (
                  <Button size="sm" variant="outline" disabled={terminate.isPending} onClick={() => setSelected(session)}>
                    {session.current ? 'Sign out' : 'End session'}
                  </Button>
                )}
              </div>
            );
          })}
      </div>
      <ConfirmDialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}
        title={selected?.current ? 'Sign out of this device?' : 'End this device session?'}
        description={selected ? `${selected.email} will be signed out of ${deviceLabel(selected.userAgent)} for the session started ${new Date(selected.createdAt).toLocaleString()}. Other sessions stay signed in.` : ''}
        confirmLabel={selected?.current ? 'Sign out' : 'End session'}
        onConfirm={() => { if (selected) terminate.mutate(selected); }} />
    </section>
  );
}
