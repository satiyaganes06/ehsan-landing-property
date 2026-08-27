import type { FastifyRequest } from 'fastify';

/** Zod validation failures all look the same from a route handler's
    perspective -- this is the one place that shape is decided. */
export function badRequest(message: string, issues?: unknown) {
  return { statusCode: 400, error: 'bad_request', message, issues };
}

export function notFound(what: string) {
  return { statusCode: 404, error: 'not_found', message: `${what} not found.` };
}

export function clientIp(req: FastifyRequest): string | undefined {
  return (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;
}
