import 'server-only';
import defaults from '../../data/company-facts.json';
import { companyFactsSchema } from '../company-facts';
import { prisma } from './prisma';

export const companyFactsKey = 'company.facts';
export async function readCompanyFacts() {
  const row = await prisma.textBlock.findUnique({ where: { key: companyFactsKey }, include: { translations: { where: { locale: 'EN' } } } });
  return companyFactsSchema.parse(row?.translations[0]?.value ?? defaults);
}
