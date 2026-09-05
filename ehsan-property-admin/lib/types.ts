/** Response shapes from the Fastify API, as consumed by the panel. */

export type PublishState = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';
export type SeoBand = 'BAD' | 'NEUTRAL' | 'GOOD';
export type Locale = 'EN' | 'MS';
export type ProjectStatus = 'ONGOING' | 'COMPLETED' | 'FUTURE';

/** List endpoints return an envelope, not a bare array. */
export interface Paginated<T> {
  page: number;
  perPage: number;
  total: number;
  items: T[];
}
export type EnquiryStatus = 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED' | 'SPAM';

export interface Me {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}

export interface Translation {
  locale: Locale;
  slug?: string | null;
  name?: string | null;
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  issuer?: string | null;
  quote?: string | null;
  author?: string | null;
  body?: string | null;
  [key: string]: unknown;
}

export interface ProjectListItem {
  id: string;
  reference: string;
  name: string;
  location?: string | null;
  status: ProjectStatus;
  publishState: PublishState;
  yearStart?: string | null;
  yearEnd?: string | null;
  sortOrder?: number;
  seoScore?: number | null;
  seoBand?: SeoBand | null;
}

export interface ProjectTranslation {
  id?: string;
  locale: Locale;
  slug?: string | null;
  name?: string | null;
  location?: string | null;
  description?: string | null;
  amenities?: string[];
  certificate?: string | null;
}

export interface ProjectDetail {
  id: string;
  reference: string;
  status: ProjectStatus;
  yearStart?: string | null;
  yearEnd?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  units?: string | null;
  areaText?: string | null;
  priceRange?: string | null;
  occupancy?: string | null;
  gdvMillions?: string | null;
  relatedReferences?: string[];
  sortOrder?: number;
  publishState: PublishState;
  publishedAt?: string | null;
  scheduledFor?: string | null;
  createdAt: string;
  updatedAt: string;
  translations: ProjectTranslation[];
  media?: Array<{
    id: string;
    mediaId: string;
    role?: string | null;
    sortOrder: number;
    media: MediaItem;
  }>;
}

export interface EventListItem {
  id: string;
  reference: string;
  title: string;
  category?: string | null;
  startsAt: string;
  publishState: PublishState;
  capacity?: number | null;
  registered?: number | null;
  seoScore?: number | null;
  seoBand?: SeoBand | null;
}

export interface AgendaItem {
  time: string;
  title: string;
  description: string;
}

export interface EventTranslation {
  id?: string;
  locale: Locale;
  slug?: string | null;
  title?: string | null;
  category?: string | null;
  location?: string | null;
  description?: string | null;
  agenda?: AgendaItem[];
  speakers?: Array<{ name: string; title: string; image?: string; bio?: string }>;
}

export interface EventDetail {
  id: string;
  reference: string;
  startsAt: string;
  endsAt?: string | null;
  capacity?: number | null;
  registered?: number | null;
  isFree?: boolean;
  priceText?: string | null;
  heroMediaId?: string | null;
  heroImageUrl?: string | null;
  /** Included by GET /api/events/:id when heroMediaId is set. */
  heroMedia?: MediaItem | null;
  relatedReferences?: string[];
  sortOrder?: number;
  publishState: PublishState;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  translations: EventTranslation[];
}

export interface AwardListItem {
  id: string;
  reference: string;
  name: string;
  year: number;
  sortOrder?: number;
  publishState: PublishState;
  mediaUrl?: string | null;
}

export interface AwardDetail extends AwardListItem {
  translations: Array<{
    locale: Locale;
    name?: string | null;
    issuer?: string | null;
    description?: string | null;
  }>;
}

export interface TestimonialListItem {
  id: string;
  reference: string;
  quote: string;
  author: string;
  sortOrder?: number;
  isPlaceholder?: boolean;
  publishState: PublishState;
}

export interface TestimonialDetail extends TestimonialListItem {
  translations: Array<{
    locale: Locale;
    quote?: string | null;
    author?: string | null;
    role?: string | null;
  }>;
}

/** A single piece of fixed copy on the landing page. `value` is a list for
    `kind: 'list'` blocks and a string otherwise. */
export interface TextBlock {
  id: string;
  key: string;
  label: string;
  kind: string;
  group: string;
  value: string | string[];
  hasTranslation: boolean;
}

export interface MediaItem {
  id: string;
  storageKey?: string;
  url: string;
  filename: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  altText?: string | null;
  focalX?: number | null;
  focalY?: number | null;
  createdAt: string;
}

export interface RoleInfo {
  key: string;
  label: string;
  permissions: string[];
}

export interface Enquiry {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  interest?: string | null;
  message: string;
  status: EnquiryStatus;
  notes?: string | null;
  consentAt?: string | null;
  createdAt: string;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  roles: string[];
  isActive: boolean;
  lastSeenAt?: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  diff?: Record<string, unknown> | null;
  ip?: string | null;
  createdAt: string;
  actor?: { name: string; email: string } | null;
}

export interface SeoRule {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  message: string;
}

/** GET /api/seo/:entityType/:entityId returns one row per locale. */
export interface SeoMeta {
  id: string;
  entityType: string;
  entityId: string;
  locale: Locale;
  focusKeyword?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogMediaId?: string | null;
  score: number;
  band: SeoBand;
  scoreDetail: SeoRule[];
}

/** Mirrors GET /api/dashboard/summary exactly — it returns grouped objects,
    not a flat bag of counts. */
export interface DashboardSummary {
  needsAttention: {
    lowScoring: Array<{
      entityType: string;
      entityId: string;
      title: string;
      score: number;
      band: SeoBand;
    }>;
    mediaMissingAlt: number;
  };
  publishState: {
    draftProjects: number;
    draftEvents: number;
    scheduledCount: number;
    lastBuildAt: string | null;
  };
  enquiries: {
    unread: number;
    recent: Enquiry[];
    /** [isoDate, count] pairs, ascending. */
    trend: Array<[string, number]>;
  };
  upcomingEvents: Array<{
    id: string;
    reference?: string | null;
    startsAt: string;
    title: string;
    capacity?: number | null;
    registered?: number | null;
  }>;
  activity: Array<{
    id: string;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    actor: string;
    createdAt: string;
  }>;
  searchConsole: { enabled: boolean; reason?: string };
}
