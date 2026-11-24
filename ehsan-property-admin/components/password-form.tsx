'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function PasswordForm({ userId, self, onDone }: {
  userId: string; self: boolean; onDone?: () => void;
}) {
  const client = useQueryClient();
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: (values: { currentPassword?: string; newPassword: string }) =>
      api.post(`/api/users/${userId}/password`, values),
    gcTime: 0,
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const newPassword = String(values.get('newPassword'));
    if (values.get('confirm') !== newPassword) { setError('New passwords must match.'); return; }
    setError('');
    try {
      await save.mutateAsync({ newPassword, ...(self && { currentPassword: String(values.get('currentPassword')) }) });
      form.reset();
      void client.invalidateQueries({ queryKey: ['active-sessions'] });
      toast.success(self ? 'Password changed.' : 'Password reset.');
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.');
    } finally {
      save.reset();
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {self && <div className="space-y-2"><Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required /></div>}
      <div className="space-y-2"><Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required />
        <p className="text-muted-foreground text-xs">Use at least 8 characters.</p></div>
      <div className="space-y-2"><Label htmlFor="confirm">Confirm new password</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></div>
      <p className="text-muted-foreground text-sm">{self ? 'Your other sessions will be signed out.' : 'This person will be signed out on all devices.'}</p>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : self ? 'Change password' : 'Reset password'}</Button>
    </form>
  );
}
