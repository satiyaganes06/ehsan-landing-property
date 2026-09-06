import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import { loadAuthedUser, type AuthedUser } from './auth';
import type { Action, Resource } from './permissions';

/**
 * The Next equivalent of Fastify's preHandler chain.
 *
 * In the API each route declared `preHandler: requirePermission('project',
 * 'read')` and the framework ran auth, then the guard, then the handler, with
 * one `setErrorHandler` behind all of it. Next has no hook chain, so that
 * sequence lives here instead -- called once per handler, so the handlers stay
 * as short as they were and the policy stays in one file rather than being
 * copy-pasted into 69 route bodies.
 */

export interface Ctx<P = Record<string, never>> {
  request: NextRequest;
  /** Non-null whenever `auth` or `resource` was requested. */
  user: AuthedUser;
  params: P;
}

interface RouteOptions {
  /** Require a signed-in user, without a specific permission. */
  auth?: boolean;
  /** Require `resource:action`. Implies `auth`. */
  resource?: Resource;
  action?: Action;
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

/** Every failure shape the panel already knows how to render. */
function fail(status: number, error: string, message: string) {
  return json({ error, message }, status);
}

function handleError(err: unknown) {
  if (err instanceof ZodError) {
    return json({ error: 'bad_request', message: 'Check the submitted fields.', issues: err.issues }, 400);
  }
  // Mirrors the API's setErrorHandler: log the detail, return a flat message.
  console.error('[api]', err);
  return fail(500, 'internal_error', 'Something went wrong.');
}

type Handler<P> = (ctx: Ctx<P>) => Promise<Response> | Response;
type NextRouteArgs<P> = { params: Promise<P> };

export function route<P = Record<string, never>>(options: RouteOptions, handler: Handler<P>) {
  return async (request: NextRequest, segment?: NextRouteArgs<P>): Promise<Response> => {
    try {
      const needsUser = options.auth || options.resource !== undefined;
      const user = needsUser ? await loadAuthedUser() : null;

      if (needsUser && !user) {
        return fail(401, 'unauthenticated', 'Sign in required.');
      }

      if (options.resource && options.action && user) {
        if (!user.permissions.has(`${options.resource}:${options.action}`)) {
          return fail(
            403,
            'forbidden',
            `Your role cannot ${options.action} ${options.resource}.`,
          );
        }
      }

      // Dynamic segments arrive as a promise in Next 16; awaiting it here means
      // no handler has to remember to.
      const params = ((await segment?.params) ?? {}) as P;

      return await handler({ request, user: user as AuthedUser, params });
    } catch (err) {
      return handleError(err);
    }
  };
}

/**
 * Row-level refusal, matching requirePermission's shape so callers see one
 * error contract no matter which layer rejected them.
 */
export function forbiddenOwnership() {
  return fail(403, 'forbidden', 'You can only edit records you created.');
}

/** For routes that are deliberately public: the enquiry form, health. */
export function publicRoute<P = Record<string, never>>(
  handler: (ctx: Omit<Ctx<P>, 'user'>) => Promise<Response> | Response,
) {
  return async (request: NextRequest, segment?: NextRouteArgs<P>): Promise<Response> => {
    try {
      const params = ((await segment?.params) ?? {}) as P;
      return await handler({ request, params });
    } catch (err) {
      return handleError(err);
    }
  };
}

/** x-forwarded-for first: behind Vercel the socket address is a proxy. */
export function clientIp(request: NextRequest): string | undefined {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined
  );
}
