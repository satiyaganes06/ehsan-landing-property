'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, UserPlus } from 'lucide-react';

import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/animate-ui/components/radix/sheet';
import Link from 'next/link';
import { PasswordForm } from '@/components/password-form';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { isProtectedAccount } from '@/lib/account-protection';
import { ActiveSessions } from '@/components/active-sessions';
import { PageHeader } from '@/components/page-header';
import { ErrorState } from '@/components/states';
import { PermissionButton } from '@/components/permission-button';
import { PaginationBar, usePagination } from '@/components/pagination-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { ROLES, roleLabel } from '@/lib/permissions';
import type { UserRow } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { me, can } = useSession();

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [inviting, setInviting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleKeys, setRoleKeys] = useState<string[]>(['editor']);
  const [isActive, setIsActive] = useState(true);

  const query = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<UserRow[]>('/api/users'),
  });

  function editUser(editing: UserRow) {
    setEditing(editing);
    setName(editing.name);
    setEmail(editing.email);
    setRoleKeys(editing.roles);
    setIsActive(editing.isActive);
  }

  const canManageOwners = Boolean(me?.roles.includes('owner'));
  const owners = (query.data ?? []).filter((u) => u.roles.includes('owner') && u.isActive);
  const isLastOwner =
    editing?.isActive && editing.roles.includes('owner') && owners.length <= 1;
  const isSelf = editing?.id === me?.id;

  function close() {
    setConfirmDelete(false);
    setEditing(null);
    setResetting(false);
    setInviting(false);
    setName('');
    setEmail('');
    setPassword('');
    setRoleKeys(['editor']);
    setIsActive(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (inviting) {
        await api.post('/api/users', { email, name, password, roleKeys });
        return;
      }
      await api.patch(`/api/users/${editing!.id}`, { name, isActive, roleKeys });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(inviting ? 'Account created.' : 'Account updated.');
      close();
    },
    onError: (err) =>
      toast.error('Could not save', {
        description: err instanceof ApiError ? err.message : 'Try again in a moment.',
      }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/users/${id}`),
    onSuccess: () => {
      close();
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['active-sessions'] });
      toast.success('Person deleted.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggleRole(key: string) {
    setRoleKeys((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );
  }

  const { page: userPage, bindings: userBindings } = usePagination(query.data ?? []);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="Users & roles"
        description="Manage accounts, roles and signed-in devices."
        actions={
          <PermissionButton resource="user" action="create" onClick={() => setInviting(true)}>
            <UserPlus className="size-3.5" />
            Add person
          </PermissionButton>
        }
      />
      <section aria-labelledby="people-heading" className="space-y-3">
      <h2 id="people-heading" className="text-lg font-semibold">People {query.data && <span className="text-muted-foreground text-sm font-normal">({query.data.length})</span>}</h2>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-card divide-border divide-y overflow-hidden rounded-lg border">
          {userPage.map((user) => (
            <button
              key={user.id}
              type="button"
              disabled={!can('user', 'update') || (user.roles.includes('owner') && !canManageOwners)}
              onClick={() => editUser(user)}
              className="hover:bg-muted/50 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:cursor-default"
            >
              <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                {user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {user.name}
                  {user.id === me?.id ? (
                    <span className="text-muted-foreground font-normal"> · you</span>
                  ) : null}
                </p>
                <p className="text-muted-foreground truncate text-xs">{user.email}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {user.roles.map((role) => (
                  <span
                    key={role}
                    className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-[0.6875rem] font-medium"
                  >
                    {roleLabel(role)}
                  </span>
                ))}
                {!user.isActive ? (
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[0.6875rem]">
                    Disabled
                  </span>
                ) : null}
              </div>

              <span className="text-muted-foreground hidden shrink-0 font-mono text-[0.6875rem] sm:block">
                {user.lastSeenAt
                  ? formatDistanceToNow(new Date(user.lastSeenAt), { addSuffix: true })
                  : 'never'}
              </span>
            </button>
          ))}
          </div>
          <PaginationBar {...userBindings} label="people" labelOne="person" />
        </div>
      )}

      </section>
      {can('user', 'read') && <ActiveSessions />}

      <details className="rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          <ShieldCheck className="text-muted-foreground mr-1 inline size-4" />
          What each role can do
        </summary>
        <dl className="mt-3 divide-y">
          {ROLES.map((role) => (
            <div key={role.key} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3">
              <dt className="w-24 shrink-0 text-sm font-medium">{role.label}</dt>
              <dd className="text-muted-foreground flex-1 text-sm">{role.blurb}</dd>
            </div>
          ))}
        </dl>
      </details>

      <Sheet
        open={inviting || Boolean(editing)}
        onOpenChange={(next) => (next ? null : close())}
      >
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{resetting ? 'Reset password' : inviting ? 'Add person' : 'Edit access'}</SheetTitle>
            <SheetDescription>
              {resetting ? editing?.email : inviting
                ? 'They can sign in as soon as you create the account.'
                : 'Changes take effect the next time they load the panel.'}
            </SheetDescription>
          </SheetHeader>

          {resetting && editing ? <div className="px-4"><PasswordForm userId={editing.id} self={false} onDone={close} /></div> : <>
          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Name</Label>
              <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                disabled={!inviting}
                onChange={(e) => setEmail(e.target.value)}
              />
              {!inviting ? (
                <p className="text-muted-foreground text-xs">Email addresses can’t be changed.</p>
              ) : null}
            </div>

            {inviting ? (
              <div className="space-y-2">
                <Label htmlFor="user-password">Temporary password</Label>
                <Input
                  id="user-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Use at least 8 characters. After signing in, they can open their account menu and choose Change password.
                </p>
              </div>
            ) : null}

            {editing && (isSelf
              ? <Link className="text-sm underline" href="/account/password">Change my password</Link>
              : <Button variant="outline" size="sm" onClick={() => setResetting(true)}>Reset password</Button>)}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Roles</legend>
              <div className="space-y-1.5 pt-1">
                {ROLES.map((role) => {
                  const checked = roleKeys.includes(role.key);
                  const locked = role.key === 'owner' && (isLastOwner || !canManageOwners);
                  return (
                    <label
                      key={role.key}
                      className={cn(
                        'flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 transition-colors',
                        checked ? 'border-brass-line/60 bg-brass-soft/40' : 'hover:bg-muted/50',
                        locked && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={() => toggleRole(role.key)}
                        className="accent-brass-line mt-0.5 size-4"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{role.label}</span>
                        <span className="text-muted-foreground block text-xs">{role.blurb}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {isLastOwner ? (
                <p className="text-sand text-xs">
                  This is the only owner. Add another owner before changing this one.
                </p>
              ) : null}
            </fieldset>

            {!inviting ? (
              <label
                className={cn(
                  'flex items-center gap-2.5 rounded-md border p-2.5',
                  isSelf || isLastOwner ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                )}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  disabled={isSelf || isLastOwner}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="accent-brass-line size-4"
                />
                <span>
                  <span className="block text-sm font-medium">Can sign in</span>
                  <span className="text-muted-foreground block text-xs">
                    {isSelf
                      ? 'You can’t disable your own account.'
                      : 'Turn this off to block access without deleting anything.'}
                  </span>
                </span>
              </label>
            ) : null}
          </div>

          <SheetFooter className="flex-row flex-wrap justify-end gap-2">
            {editing && !isSelf && can('user', 'delete') && !isProtectedAccount(editing.email, editing.roles) && (
              <Button variant="ghost" size="sm" className="text-destructive mr-auto"
                disabled={remove.isPending || save.isPending} onClick={() => setConfirmDelete(true)}>
                Delete person
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => save.mutate()}
              disabled={
                save.isPending || remove.isPending ||
                !name.trim() ||
                roleKeys.length === 0 ||
                (inviting && (!email.trim() || password.length < 8))
              }
            >
              {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {save.isPending ? 'Saving…' : inviting ? 'Create account' : 'Save'}
            </Button>
          </SheetFooter>
          </>}
        </SheetContent>
      </Sheet>
      {editing && <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete}
        title={`Delete ${editing.name}?`}
        description={`This permanently deletes the account for ${editing.email} and ends all their sessions.`}
        confirmLabel="Delete person" onConfirm={() => remove.mutate(editing.id)} />}
    </div>
  );
}
