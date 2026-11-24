'use client';

import { PageHeader } from '@/components/page-header';
import { PasswordForm } from '@/components/password-form';
import { useSession } from '@/lib/session';

export default function AccountPassword() {
  const { me } = useSession();
  return <div className="mx-auto w-full max-w-lg space-y-6">
    <PageHeader title="Change password" description={me?.email} />
    {me && <div className="bg-card rounded-lg border p-5"><PasswordForm userId={me.id} self /></div>}
  </div>;
}
