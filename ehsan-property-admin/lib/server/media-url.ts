/**
 * Two storage origins share one Media table, distinguished by a prefix on
 * storageKey rather than a schema column:
 *
 *   legacy:img/proj-kota-warisan.jpg   -- imported from the site's own
 *                                          assets/ at seed time; read-only,
 *                                          served straight from the repo
 *   upload:2026/08/xyz.webp            -- uploaded through the panel; served
 *                                          from admin/uploads
 *
 * mediaUrl() is the one place that distinction turns into an actual URL, so
 * nothing else in the codebase needs to know the convention exists.
 */
export function mediaUrl(storageKey: string): string {
  if (storageKey.startsWith('legacy:')) {
    return `/media/legacy/${storageKey.slice('legacy:'.length)}`;
  }
  if (storageKey.startsWith('upload:')) {
    return `/media/uploads/${storageKey.slice('upload:'.length)}`;
  }
  return `/media/uploads/${storageKey}`;
}
