/**
 * Resolves a Media row to a URL the browser can actually request.
 *
 * The API's own mediaUrl() maps `legacy:img/x.jpg` to /media/legacy/img/x.jpg,
 * but the /media/legacy/ mount is already rooted at assets/img -- so that path
 * 404s for every image the seed imported with an `img/` prefix. Until the API
 * is corrected, the panel resolves from storageKey itself:
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
  if (storageKey?.startsWith('legacy:')) {
    const rest = storageKey.slice('legacy:'.length).replace(/^img\//, '');
    return `/live-site/assets/img/${rest}`;
  }
  if (storageKey?.startsWith('upload:')) {
    return `/media/uploads/${storageKey.slice('upload:'.length)}`;
  }
  return fallbackUrl ?? '';
}
