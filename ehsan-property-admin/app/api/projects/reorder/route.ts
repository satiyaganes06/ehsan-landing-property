import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { route, json, clientIp, forbiddenOwnership } from '@/lib/server/route';
import { canActOnOwnRecord } from '@/lib/server/ownership';
import { recordAudit } from '@/lib/server/audit';
import { moveProject } from '@/lib/project-order';

export const runtime = 'nodejs';
const bodySchema = z.object({ id: z.string().min(1), targetId: z.string().min(1) });

export const PATCH = route({ resource: 'project', action: 'update' }, async ({ request, user }) => {
  const { id, targetId } = bodySchema.parse(await request.json());
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await prisma.$transaction(async tx => {
        const current = await tx.project.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true, sortOrder: true, createdById: true } });
        if (!current.some(p => p.id === id) || !current.some(p => p.id === targetId)) return 'not_found';
        const next = moveProject(current, id, targetId);
        const changed = next.filter((p, index) => p.sortOrder !== index + 1);
        if (changed.some(p => !canActOnOwnRecord(user, p.createdById))) return 'ownership';
        for (const [index, project] of next.entries()) {
          if (project.sortOrder !== index + 1) await tx.project.update({ where: { id: project.id }, data: { sortOrder: index + 1 } });
        }
        return 'saved';
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (result === 'ownership') return forbiddenOwnership();
      if (result === 'not_found') return json({ error: 'not_found', message: 'A project was removed. Refresh the list and try again.' }, 404);
      recordAudit({ actorId: user.id, action: 'project.reordered', entityType: 'project', entityId: id, diff: { targetId }, ip: clientIp(request) });
      return json({ saved: true });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
      throw error;
    }
  }
  return json({ error: 'conflict', message: 'Another order update occurred. Please try again.' }, 409);
});
