import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next 16 renamed the `middleware` convention to `proxy`. This does exactly
 * one cheap thing: bounce anonymous requests to the login screen so nobody
 * watches a panel skeleton render before finding out they are signed out.
 *
 * It is NOT authorization. The cookie's validity, the user's roles and every
 * permission check live in the Fastify API; presence of a cookie here only
 * decides which screen to paint first.
 */
const SESSION_COOKIE = 'ehsan_session';

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isLogin = pathname === '/login';
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Preserve where they were headed so login can return them to it.
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (hasSession && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|media|live-site|_next/static|_next/image|favicon.ico).*)'],
};
