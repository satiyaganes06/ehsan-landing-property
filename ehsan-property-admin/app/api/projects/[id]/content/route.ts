import { prisma } from '@/lib/server/prisma';
import { route, json, forbiddenOwnership } from '@/lib/server/route';
import { canActOnOwnRecord } from '@/lib/server/ownership';
import { recordAudit, recordRevision } from '@/lib/server/audit';
import { projectContentKey, projectContentSchema, readProjectContent } from '@/lib/server/project-content';

export const GET = route<{ id: string }>({ resource: 'project', action: 'read' }, async ({ params }) => {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return json({ message: 'Project not found.' }, 404);
  return json(await readProjectContent(project.reference) ?? projectContentSchema.parse({}));
});
export const PUT = route<{ id: string }>({ resource: 'project', action: 'update' }, async ({ params, request, user }) => {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return json({ message: 'Project not found.' }, 404);
  if (project.reference === 'proj-15') return json({ message: 'Widuri uses its existing section content.' }, 409);
  if (!canActOnOwnRecord(user, project.createdById)) return forbiddenOwnership();
  const value = projectContentSchema.parse(await request.json());
  const block = await prisma.textBlock.upsert({ where: { key: projectContentKey(project.reference) }, create: { key: projectContentKey(project.reference), label: 'Project section content', kind: 'configuration', group: 'project' }, update: {} });
  const old = await prisma.textBlockTranslation.findUnique({ where: { textBlockId_locale: { textBlockId: block.id, locale: 'EN' } } });
  if (old) recordRevision('text_block_translation', old.id, old, user.id);
  await prisma.textBlockTranslation.upsert({ where: { textBlockId_locale: { textBlockId: block.id, locale: 'EN' } }, create: { textBlockId: block.id, locale: 'EN', value }, update: { value } });
  recordAudit({ actorId: user.id, action: 'project.content.updated', entityType: 'project', entityId: project.id });
  return json(value);
});
