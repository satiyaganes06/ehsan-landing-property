/**
 * Turns a Media row's storageKey into a URL the browser can request.
 *
 *   legacy:img/proj-x.jpg   -> /live-site/assets/img/proj-x.jpg
 *   upload:2026/09/a.webp   -> /media/uploads/2026/09/a.webp
 *   blob:https://…/a.webp   -> https://…/a.webp
 *
 * The legacy branch drops a leading `img/` deliberately. The seed wrote keys
 * as `legacy:img/…` while the files sit directly under assets/img, so the old
 * mapping produced /media/legacy/img/… and 404'd for every imported photo.
 */
export function mediaUrl(storageKey: string): string {
  if (storageKey.startsWith('blob:')) {
    return storageKey.slice('blob:'.length);
  }
  if (storageKey.startsWith('legacy:')) {
    const rest = storageKey.slice('legacy:'.length).replace(/^img\//, '');
    return `/live-site/assets/img/${rest}`;
  }
  if (storageKey.startsWith('upload:')) {
    return `/media/uploads/${storageKey.slice('upload:'.length)}`;
  }
  return `/media/uploads/${storageKey}`;
}
