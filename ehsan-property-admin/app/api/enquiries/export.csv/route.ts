import { csvCell } from '@/lib/server/csv-cell';
import { prisma } from '@/lib/server/prisma';
import { route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const GET = route({ resource: 'enquiry', action: 'read' }, async () => {
  const items = await prisma.enquiry.findMany({ orderBy: { createdAt: 'desc' } });

  const header = ['Date', 'Name', 'Email', 'Phone', 'Interest', 'Status', 'Message'];
  const rows = items.map((e) => [
    e.createdAt.toISOString(), e.name, e.email, e.phone ?? '', e.interest ?? '',
    e.status, e.message.replace(/\r?\n/g, ' '),
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="enquiries.csv"',
    },
  });
});
