import 'server-only';
import defaults from '../../data/project-licensing.json';
import { licensingSchema } from '../licensing';
import { prisma } from './prisma';

export const licensingKey = 'project.licensing';
export async function readLicensing() {
  const block = await prisma.textBlock.findUnique({ where: { key: licensingKey }, include: { translations: { where: { locale: 'EN' } } } });
  return licensingSchema.parse(block?.translations[0]?.value ?? defaults);
}
