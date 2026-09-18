import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { recordAudit } from '@/lib/server/audit';
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

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    if (body.roleKeys) {
      const roles = await prisma.role.findMany({ where: { key: { in: body.roleKeys } } });
      await prisma.userRole.deleteMany({ where: { userId: params.id } });
      data.roles = { create: roles.map((r) => ({ roleId: r.id })) };
    }

    const updated = await prisma.user.update({ where: { id: params.id }, data });
    recordAudit({
      actorId: user.id, action: 'user.updated', entityType: 'user',
      entityId: updated.id, diff: body, ip: clientIp(request),
    });
    return json({ id: updated.id, email: updated.email, isActive: updated.isActive });
  },
);
