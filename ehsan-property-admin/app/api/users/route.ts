import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { hashPassword } from '@/lib/server/password';
import { recordAudit } from '@/lib/server/audit';
import { clientIp, json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const CreateUserBody = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  roleKeys: z.array(z.string()).min(1),
});

export const GET = route({ resource: 'user', action: 'read' }, async () => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, email: true, name: true, isActive: true, lastSeenAt: true, createdAt: true,
      roles: { select: { role: { select: { key: true } } } },
    },
  });
  return json(
    users.map((u) => ({
      id: u.id, email: u.email, name: u.name, isActive: u.isActive,
      lastSeenAt: u.lastSeenAt, createdAt: u.createdAt,
      roles: u.roles.map((r) => r.role.key),
    })),
  );
});

export const POST = route({ resource: 'user', action: 'create' }, async ({ request, user }) => {
  const { email, name, password, roleKeys } = CreateUserBody.parse(await request.json());

  if (roleKeys.includes('owner') && !user.roleKeys.includes('owner')) {
    return json({ error: 'forbidden', message: 'Only an owner can assign the owner role.' }, 403);
  }

  if (await prisma.user.findUnique({ where: { email } })) {
    return json({ error: 'conflict', message: 'That email is already registered.' }, 409);
  }

  const roles = await prisma.role.findMany({ where: { key: { in: roleKeys } } });
  if (roles.length !== new Set(roleKeys).size) {
    return json({ error: 'bad_request', message: 'One or more roles are invalid.' }, 400);
  }

  const created = await prisma.user.create({
    data: {
      email, name,
      passwordHash: await hashPassword(password),
      roles: { create: roles.map((r) => ({ roleId: r.id })) },
    },
  });
  recordAudit({
    actorId: user.id, action: 'user.created', entityType: 'user',
    entityId: created.id, ip: clientIp(request),
  });
  return json({ id: created.id, email: created.email, name: created.name }, 201);
});
