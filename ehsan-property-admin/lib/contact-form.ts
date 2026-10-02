import { z } from 'zod';
export const contactFormSchema = z.object({
  title: z.string().max(4000), subtitle: z.string().max(8000), button: z.string().min(1).max(100),
  fields: z.array(z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), label: z.string().min(1).max(2000),
    type: z.enum(['text', 'email', 'tel', 'textarea', 'select']),
    placeholder: z.string().max(300), help: z.string().max(2000), required: z.boolean(), wide: z.boolean(),
    options: z.array(z.string().min(1).max(200)).max(40),
  })).max(20)
    .refine(items => new Set(items.map(item => item.id)).size === items.length, 'Field IDs must be unique.')
    .refine(items => items.every(item => !['consent', 'website', 'renderedAt', 'projectReference'].includes(item.id)), 'This field ID is reserved.')
    .refine(items => [['name', 'text'], ['email', 'email'], ['message', 'textarea']].every(([id, type]) => items.some(item => item.id === id && item.type === type && item.required)), 'Keep required name, email and message fields with their original types.'),
});
export type ContactForm = z.infer<typeof contactFormSchema>;
