/**
 * Turns the panel's draft state into the exact JSON shape the static site's
 * own scripts read (data/projects.json, data/events.json).
 *
 * The preview renders the real page, so the page gets the real data contract.
 * Anything these mappers get wrong shows up as a visibly wrong preview, which
 * is the point -- a preview that quietly normalises bad input would be worse
 * than no preview.
 */
import { mediaSrc } from '@/lib/media';
import type { AgendaItem, EventDetail, ProjectDetail } from '@/lib/types';

/* ---------------------------------------------------------------------------
   Image paths

   The site builds every image URL as SITE.url(`assets/img/${name}`), which
   resolves to /live-site/assets/img/<name>. So the job here is to turn a
   Media row into a name relative to assets/img.

   Resolution is done from storageKey rather than the API's own mediaUrl(),
   because mediaUrl() maps `legacy:img/x.jpg` to /media/legacy/img/x.jpg while
   the /media/legacy/ mount is already rooted at assets/img -- that path 404s.
   Reading the key directly sidesteps the mismatch instead of inheriting it.

     legacy:img/proj-kota-warisan.jpg  -> proj-kota-warisan.jpg
     legacy:placeholders/avatar1.jpg   -> placeholders/avatar1.jpg
     upload:2026/08/hero.webp          -> ../../../media/uploads/2026/08/hero.webp

   Uploads live on a different mount entirely, so they climb back out of
   assets/img with ../../.. -- the browser normalises the result to
   /media/uploads/... before requesting it. Three levels, because the
   /live-site/ base contributes a segment of its own.
--------------------------------------------------------------------------- */
function toSiteImageName(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  if (/^https?:\/\//i.test(storageKey)) return storageKey;

  if (storageKey.startsWith('legacy:')) {
    return storageKey.slice('legacy:'.length).replace(/^img\//, '');
  }

  const uploadPath = storageKey.startsWith('upload:')
    ? storageKey.slice('upload:'.length)
    : storageKey;
  return `../../../media/uploads/${uploadPath}`;
}

/** COMPLETED -> Completed. The site prints this string as-is. */
function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export interface ProjectPreviewDraft {
  name: string;
  location: string;
  description: string;
  status: string;
  yearStart: string;
  yearEnd: string;
  units: string;
  areaText: string;
  priceRange: string;
  occupancy: string;
  amenities: string[];
  certificate: string | null;
}

/** One record, keyed the way data/projects.json keys them (by reference). */
export function toSiteProject(detail: ProjectDetail, draft: ProjectPreviewDraft) {
  const images: string[] = [];
  const blueprints: string[] = [];

  // The panel's roles are 'gallery' and 'blueprint'; the site's buckets are
  // 'image' and 'blueprint'. Anything not explicitly a blueprint is a gallery
  // image, so a new role can never make an image silently vanish.
  for (const link of [...(detail.media ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const name = toSiteImageName(link.media?.storageKey);
    if (!name) continue;
    (link.role === 'blueprint' ? blueprints : images).push(name);
  }

  return {
    [detail.reference]: {
      name: draft.name,
      location: draft.location,
      coordinates: { lat: detail.latitude ?? 0, lng: detail.longitude ?? 0 },
      year: draft.yearEnd || draft.yearStart,
      status: toTitleCase(draft.status),
      description: draft.description,
      units: draft.units,
      area: draft.areaText,
      priceRange: draft.priceRange,
      occupancy: draft.occupancy,
      amenities: draft.amenities,
      certificate: draft.certificate,
      media: { image: images, blueprint: blueprints },
    },
  };
}

export interface EventPreviewDraft {
  title: string;
  category: string;
  location: string;
  description: string;
  startsAt: string;
  capacity: string;
  registered: string;
  priceText: string;
  agenda: AgendaItem[];
  /** Storage key of the chosen image, or null when only a URL is set. */
  heroStorageKey: string | null;
  heroImageUrl: string;
}

/**
 * The event template assigns data.image straight to the hero's src, so this
 * has to be a URL the browser can request as-is -- unlike project images,
 * which the page prefixes with assets/img itself.
 */
export const toHeroSrc = mediaSrc;

export function toSiteEvent(detail: EventDetail, draft: EventPreviewDraft) {
  const starts = draft.startsAt ? new Date(draft.startsAt) : new Date(detail.startsAt);
  const valid = !Number.isNaN(starts.getTime());

  const date = valid
    ? starts.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  const time = valid
    ? starts.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';
  const short = valid
    ? starts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const translation = detail.translations.find((t) => t.locale === 'EN');
  const registered = Number(draft.registered) || 0;

  return {
    [detail.reference]: {
      id: detail.reference,
      title: draft.title,
      category: draft.category,
      date,
      dateTime: valid ? `${short} · ${time}` : '',
      location: draft.location,
      image: toHeroSrc(draft.heroStorageKey, draft.heroImageUrl),
      price: draft.priceText.trim() || 'FREE',
      attendees: `${registered} Attendees`,
      capacity: Number(draft.capacity) || 0,
      registered,
      description: draft.description,
      agenda: draft.agenda,
      speakers: translation?.speakers ?? [],
    },
  };
}
