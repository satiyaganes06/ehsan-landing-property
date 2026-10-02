import 'server-only';
import { z } from 'zod';
import { prisma } from './prisma';

export const projectSections = [
  { id: 'hero', label: 'Hero image and introduction' },
  { id: 'overview', label: 'Project overview' },
  { id: 'specifications', label: 'Project highlights / specifications' },
  { id: 'location', label: 'Location and map' },
  { id: 'shuttle', label: 'Shuttle connections (Widuri)' },
  { id: 'amenities', label: 'Amenities / neighbourhood' },
  { id: 'layouts', label: 'Floor plans and layouts' },
  { id: 'facilities', label: 'Facilities / image gallery' },
  { id: 'fit', label: 'Buyer profiles (Widuri)' },
  { id: 'certificate', label: 'Completion certificate' },
  { id: 'cta', label: 'Contact sales section' },
] as const;
export const projectEnquirySchema = z.object({
  enabled: z.boolean().default(false),
  interest: z.string().trim().max(200).default(''),
  sections: z.partialRecord(z.enum(projectSections.map(section => section.id)), z.boolean()).default({}),
}).refine(value => !value.enabled || Boolean(value.interest), 'Choose an interest before enabling the form.');
export const projectEnquiryKey = (reference: string) => `project.enquiry.${reference}`;
export async function readProjectEnquiry(reference: string) {
  const row = await prisma.textBlock.findUnique({ where: { key: projectEnquiryKey(reference) }, include: { translations: { where: { locale: 'EN' } } } });
  return projectEnquirySchema.parse(row?.translations[0]?.value ?? { enabled: false, interest: '' });
}
