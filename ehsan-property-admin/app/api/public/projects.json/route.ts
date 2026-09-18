import { NextResponse } from 'next/server';
import { buildProjectsPayload } from '@/lib/server/bridge';
import { publicRoute } from '@/lib/server/route';

export const runtime = 'nodejs';
// Rebuilt at most once a minute; publishing is rare and the landing site is
// the hot path, so it should not hit Postgres on every visitor.
export const revalidate = 60;

/**
 * What the landing site reads instead of the checked-in data/projects.json.
 * Same shape, built from the database, so js/project-detail.js needs only a
 * changed URL. CORS is open because this is published content served to a
 * site on another origin.
 */
export const GET = publicRoute(async () =>
  NextResponse.json(await buildProjectsPayload(), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  }),
);
