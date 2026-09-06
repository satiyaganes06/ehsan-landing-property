/**
 * Resolves a Media row to a URL the browser can actually request.
 *
 * Mirrors lib/server/media-url.ts so the panel and the API agree. The site's
 * own assets are copied into public/live-site at build time, which is what
 * these paths resolve against:
 *
 *   legacy:img/proj-widuri.jpg   -> /live-site/assets/img/proj-widuri.jpg
 *   legacy:awards/logo-01.png    -> /live-site/assets/img/awards/logo-01.png
 *   upload:2026/08/hero.webp     -> /media/uploads/2026/08/hero.webp
 *
 * Both prefixes are proxied to the API by next.config.ts, so these work the
 * same in the panel and inside a preview iframe.
 */
export function mediaSrc(
  storageKey: string | null | undefined,
  fallbackUrl?: string | null,
): string {
  if (storageKey?.startsWith('blob:')) {
    return storageKey.slice('blob:'.length);
  }
  if (storageKey?.startsWith('legacy:')) {
    const rest = storageKey.slice('legacy:'.length).replace(/^img\//, '');
    return `/live-site/assets/img/${rest}`;
  }
  if (storageKey?.startsWith('upload:')) {
    return `/media/uploads/${storageKey.slice('upload:'.length)}`;
  }
  return fallbackUrl ?? '';
}
