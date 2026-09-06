import { NextResponse } from 'next/server';
import { buildEventsPayload } from '@/lib/server/bridge';
import { publicRoute } from '@/lib/server/route';

export const runtime = 'nodejs';
export const revalidate = 60;

/** Published events, in the shape js/event-detail.js already expects. */
export const GET = publicRoute(async () =>
  NextResponse.json(await buildEventsPayload(), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  }),
);
