import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { hashPassword } from '../../lib/password.js';
import { requirePermission } from '../../lib/rbac.js';
import { recordAudit } from '../../lib/audit.js';
import { clientIp } from '../../lib/http.js';
import { IdParamSchema } from '../../lib/validation.js';

const CreateUserBody = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  roleKeys: z.array(z.string()).min(1),
});
const UpdateUserBody = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  roleKeys: z.array(z.string()).min(1).optional(),
});

export async function userRoutes(app: FastifyInstance) {
  app.get('/api/users', { preHandler: requirePermission('user', 'read') }, async () => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: { roles: { include: { role: true } } },
    });
    return users.map((u) => ({
      id: u.id, email: u.email, name: u.name, isActive: u.isActive,
      lastSeenAt: u.lastSeenAt, createdAt: u.createdAt,
      roles: u.roles.map((r) => r.role.key),
    }));
  });

  app.post('/api/users', { preHandler: requirePermission('user', 'create') }, async (req, reply) => {
    const parsed = CreateUserBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_request', message: parsed.error.message });
    const { email, name, password, roleKeys } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(409).send({ error: 'conflict', message: 'That email is already registered.' });

    const roles = await prisma.role.findMany({ where: { key: { in: roleKeys } } });
    if (roles.length === 0) return reply.code(400).send({ error: 'bad_request', message: 'No valid roles given.' });

    const user = await prisma.user.create({
      data: {
        email, name, passwordHash: await hashPassword(password),
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
      },
    });
    recordAudit({ actorId: req.user!.id, action: 'user.created', entityType: 'user', entityId: user.id, ip: clientIp(req) });
    return reply.code(201).send({ id: user.id, email: user.email, name: user.name });
  });

  app.patch('/api/users/:id', { preHandler: requirePermission('user', 'update') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    const body = UpdateUserBody.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request' });

    // A user cannot demote or deactivate themselves out of the only owner
    // seat -- an easy way to lock everyone out with one accidental click.
    if (params.data.id === req.user!.id && body.data.isActive === false) {
      return reply.code(400).send({ error: 'bad_request', message: 'You cannot deactivate your own account.' });
    }

    const data: Record<string, unknown> = {};
    if (body.data.name !== undefined) data.name = body.data.name;
    if (body.data.isActive !== undefined) data.isActive = body.data.isActive;

    if (body.data.roleKeys) {
      const roles = await prisma.role.findMany({ where: { key: { in: body.data.roleKeys } } });
      await prisma.userRole.deleteMany({ where: { userId: params.data.id } });
      data.roles = { create: roles.map((r) => ({ roleId: r.id })) };
    }

    const user = await prisma.user.update({ where: { id: params.data.id }, data });
    recordAudit({ actorId: req.user!.id, action: 'user.updated', entityType: 'user', entityId: user.id, diff: body.data, ip: clientIp(req) });
    return reply.send({ id: user.id, email: user.email, isActive: user.isActive });
  });

  app.get('/api/roles', { preHandler: requirePermission('user', 'read') }, async () => {
    const roles = await prisma.role.findMany({
      orderBy: { rank: 'asc' },
      include: { permissions: { include: { permission: true } } },
    });
    return roles.map((r) => ({
      key: r.key, label: r.label,
      permissions: r.permissions.map((p) => `${p.permission.resource}:${p.permission.action}`),
    }));
  });

  app.get('/api/audit-log', { preHandler: requirePermission('audit', 'read') }, async (req) => {
    const q = req.query as { entityType?: string; entityId?: string; limit?: string };
    const entries = await prisma.auditEntry.findMany({
      where: { entityType: q.entityType, entityId: q.entityId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(q.limit ?? '50', 10) || 50, 200),
      include: { actor: { select: { name: true, email: true } } },
    });
    return entries;
  });
}
