import { prisma } from '@/lib/server/prisma';
import { route } from '@/lib/server/route';

export const runtime = 'nodejs';

/** A value containing a quote, comma or newline has to be quoted and escaped. */
function escape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export const GET = route({ resource: 'enquiry', action: 'read' }, async () => {
  const items = await prisma.enquiry.findMany({ orderBy: { createdAt: 'desc' } });

  const header = ['Date', 'Name', 'Email', 'Phone', 'Interest', 'Status', 'Message'];
  const rows = items.map((e) => [
    e.createdAt.toISOString(), e.name, e.email, e.phone ?? '', e.interest ?? '',
    e.status, e.message.replace(/\r?\n/g, ' '),
  ]);
  const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="enquiries.csv"',
    },
  });
});
