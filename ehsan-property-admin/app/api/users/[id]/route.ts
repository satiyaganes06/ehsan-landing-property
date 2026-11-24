import { isProtectedAccount } from '@/lib/account-protection';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { clientIp, json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const UpdateUserBody = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  roleKeys: z.array(z.string()).min(1).optional(),
});

export const PATCH = route<{ id: string }>(
  { resource: 'user', action: 'update' },
  async ({ request, params, user }) => {
    const body = UpdateUserBody.parse(await request.json());

    // Locking yourself out with one click is too easy to allow.
    if (params.id === user.id && body.isActive === false) {
      return json({ error: 'bad_request', message: 'You cannot deactivate your own account.' }, 400);
    }

    try {
      return await prisma.$transaction(async tx => {
        const target = await tx.user.findUnique({
          where: { id: params.id },
          select: { isActive: true, roles: { select: { role: { select: { key: true } } } } },
        });
        if (!target) return json({ error: 'not_found', message: 'User not found.' }, 404);
        const targetIsOwner = target.roles.some(({ role }) => role.key === 'owner');
        if ((targetIsOwner || body.roleKeys?.includes('owner')) && !user.roleKeys.includes('owner')) {
          return json({ error: 'forbidden', message: 'Only an owner can manage owner accounts.' }, 403);
        }
        if (targetIsOwner && target.isActive &&
            (body.isActive === false || (body.roleKeys && !body.roleKeys.includes('owner')))) {
          const others = await tx.user.count({
            where: { id: { not: params.id }, isActive: true, roles: { some: { role: { key: 'owner' } } } },
          });
          if (!others) return json({ error: 'conflict', message: 'Keep at least one active owner.' }, 409);
        }
        const data: Prisma.UserUpdateInput = { name: body.name, isActive: body.isActive };
        if (body.roleKeys) {
          const roles = await tx.role.findMany({ where: { key: { in: body.roleKeys } }, select: { id: true } });
          if (roles.length !== new Set(body.roleKeys).size) {
            return json({ error: 'bad_request', message: 'One or more roles are invalid.' }, 400);
          }
          data.roles = { deleteMany: {}, create: roles.map(role => ({ roleId: role.id })) };
        }
        if (body.isActive === false) await tx.session.deleteMany({ where: { userId: params.id } });
        const updated = await tx.user.update({
          where: { id: params.id }, data, select: { id: true, email: true, isActive: true },
        });
        await tx.auditEntry.create({ data: {
          actorId: user.id, action: 'user.updated', entityType: 'user',
          entityId: updated.id, diff: body, ip: clientIp(request),
        } });
        return json(updated);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return json({ error: 'conflict', message: 'Another account change occurred. Refresh and try again.' }, 409);
      }
      throw error;
    }
  },
);

export const DELETE = route<{ id: string }>(
  { resource: 'user', action: 'delete' },
  async ({ request, params, user }) => {
    if (params.id === user.id) return json({ message: 'You cannot delete your own account.' }, 403);
    try {
      return await prisma.$transaction(async tx => {
        const target = await tx.user.findUnique({
          where: { id: params.id },
          select: { email: true, roles: { select: { role: { select: { key: true } } } } },
        });
        if (!target) return json({ message: 'Person no longer exists.' }, 404);
        if (isProtectedAccount(target.email, target.roles.map(({ role }) => role.key))) {
          return json({ message: 'This administrator account is protected.' }, 403);
        }
        await tx.user.delete({ where: { id: params.id } });
        await tx.auditEntry.create({ data: {
          actorId: user.id, action: 'user.deleted', entityType: 'user', entityId: params.id,
          diff: { email: target.email }, ip: clientIp(request),
        } });
        return json({ ok: true });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return json({ message: 'This account changed. Refresh and try again.' }, 409);
      }
      throw error;
    }
  },
);
