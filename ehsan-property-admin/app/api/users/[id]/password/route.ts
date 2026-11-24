import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { readSessionToken } from '@/lib/server/auth';
import { hashPassword, verifyPassword } from '@/lib/server/password';
import { readBoundedJson } from '@/lib/server/bounded-json';
import { clientIp, json, route } from '@/lib/server/route';

const fields = z.object({
  newPassword: z.string().min(8).max(1024),
  currentPassword: z.string().optional(),
});

export const POST = route<{ id: string }>({ auth: true }, async ({ request, params, user }) => {
  const self = params.id === user.id;
  if (!self && !user.permissions.has('user:update')) return json({ message: 'Access denied.' }, 403);

  const body = await readBoundedJson(request, 64 * 1024);
  if (!body.ok) return json({ message: 'Invalid password request.' }, body.status);
  const { newPassword, currentPassword } = fields.parse(body.value);
  const target = await prisma.user.findUnique({
    where: { id: params.id }, select: { passwordHash: true },
  });
  if (!target) return json({ message: 'Account unavailable.' }, 404);
  if (self && (!currentPassword || !await verifyPassword(target.passwordHash, currentPassword))) {
    return json({ message: 'Current password is incorrect.' }, 400);
  }
  if (self && currentPassword === newPassword) return json({ message: 'Choose a different password.' }, 400);

  const token = await readSessionToken();
  if (!token) return json({ message: 'Sign in again.' }, 401);
  const currentId = createHash('sha256').update(token).digest('hex');
  const passwordHash = await hashPassword(newPassword);
  return prisma.$transaction(async tx => {
    const updated = await tx.user.updateMany({
      where: {
        id: params.id, passwordHash: target.passwordHash,
        ...(!self && !user.roleKeys.includes('owner') && { roles: { none: { role: { key: 'owner' } } } }),
      },
      data: { passwordHash },
    });
    if (!updated.count) return json({ message: 'Password could not be updated. Check your access and try again.' }, 403);
    await tx.session.deleteMany({ where: { userId: params.id, ...(self && { id: { not: currentId } }) } });
    await tx.auditEntry.create({ data: {
      actorId: user.id, entityType: 'user', entityId: params.id,
      action: self ? 'password.changed' : 'password.reset', ip: clientIp(request),
    } });
    return json({ ok: true });
  });
});
