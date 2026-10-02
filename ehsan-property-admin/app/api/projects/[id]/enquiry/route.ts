import { prisma } from '@/lib/server/prisma';
import { route, json, forbiddenOwnership } from '@/lib/server/route';
import { canActOnOwnRecord } from '@/lib/server/ownership';
import { recordAudit, recordRevision } from '@/lib/server/audit';
import { projectEnquiryKey, projectEnquirySchema, projectSections, readProjectEnquiry } from '@/lib/server/project-enquiry';

export const GET = route<{ id: string }>({ resource: 'project', action: 'read' }, async ({ params }) => {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return json({ message: 'Project not found.' }, 404);
  const [settings, translations, landing] = await Promise.all([
    readProjectEnquiry(project.reference),
    prisma.projectTranslation.findMany({ where: { locale: 'EN' }, select: { name: true }, orderBy: { name: 'asc' } }),
    prisma.textBlock.findUnique({ where: { key: 'landing.customization' }, include: { translations: { where: { locale: 'EN' } } } }),
  ]);
  const values = (landing?.translations[0]?.value as { values?: Record<string, string> } | undefined)?.values;
  let formOptions: string[] = [];
  try { const form = JSON.parse(values?.['contact:form'] ?? '{}'); formOptions = form.fields?.find((field: { id: string }) => field.id === 'interest')?.options ?? []; } catch { /* Project names remain available. */ }
  const sectionOptions = projectSections.filter(section => project.reference === 'proj-15' ? !['certificate', 'gallery'].includes(section.id) : true).map(section => project.reference === 'proj-15' ? section : { ...section, label: section.label.replace(' (Widuri)', '') });
  return json({ ...settings, sectionOptions, options: [...new Set([...formOptions, ...translations.map(t => t.name)])] });
});
export const PUT = route<{ id: string }>({ resource: 'project', action: 'update' }, async ({ params, request, user }) => {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return json({ message: 'Project not found.' }, 404);
  if (!canActOnOwnRecord(user, project.createdById)) return forbiddenOwnership();
  const value = projectEnquirySchema.parse(await request.json());
  const block = await prisma.textBlock.upsert({ where: { key: projectEnquiryKey(project.reference) }, create: { key: projectEnquiryKey(project.reference), label: 'Project enquiry form', kind: 'configuration', group: 'project' }, update: {} });
  const old = await prisma.textBlockTranslation.findUnique({ where: { textBlockId_locale: { textBlockId: block.id, locale: 'EN' } } });
  if (old) recordRevision('text_block_translation', old.id, old, user.id);
  await prisma.textBlockTranslation.upsert({ where: { textBlockId_locale: { textBlockId: block.id, locale: 'EN' } }, create: { textBlockId: block.id, locale: 'EN', value }, update: { value } });
  recordAudit({ actorId: user.id, action: 'project.enquiry.updated', entityType: 'project', entityId: project.id, diff: value });
  return json(value);
});
