import { prisma } from './prisma.js';

export interface AuditInput {
  actorId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  diff?: unknown;
  ip?: string;
}

/** Fire-and-forget by design: a failed audit write must never fail the
    request it is describing. Errors are logged, not thrown. */
export function recordAudit(input: AuditInput): void {
  prisma.auditEntry
    .create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        diff: input.diff as any,
        ip: input.ip,
      },
    })
    .catch((err) => console.error('audit write failed', err));
}

/** Snapshots the row before it changes. Called BEFORE the update lands, so a
    revision always represents a real past state, never a duplicate of the
    row it sits beside. */
export function recordRevision(entityType: string, entityId: string, snapshot: unknown, createdById: string | null): void {
  prisma.revision
    .create({ data: { entityType, entityId, snapshot: snapshot as any, createdById } })
    .catch((err) => console.error('revision write failed', err));
}
