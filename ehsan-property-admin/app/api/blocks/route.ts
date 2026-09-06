import { prisma } from '@/lib/server/prisma';
import { json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

/** Grouped by page section so the panel can render one screen per part of the
    landing page rather than a flat list of unrelated fields. */
export const GET = route({ resource: 'block', action: 'read' }, async ({ request }) => {
  const locale = (request.nextUrl.searchParams.get('locale') as 'EN' | 'MS') ?? 'EN';
  const blocks = await prisma.textBlock.findMany({
    orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }],
    include: { translations: { where: { locale } } },
  });
  return json(
    blocks.map((b) => ({
      id: b.id, key: b.key, label: b.label, kind: b.kind, group: b.group,
      value: b.translations[0]?.value ?? null,
      hasTranslation: b.translations.length > 0,
    })),
  );
});
