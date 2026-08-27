export type Locale = 'EN' | 'MS';
export type PublishState = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED';
export type SeoBand = 'BAD' | 'NEUTRAL' | 'GOOD';

export interface Me {
  id: string; email: string; name: string; roles: string[]; permissions: string[];
}

export interface RuleResult { id: string; label: string; weight: number; passed: boolean; message: string }

export interface SeoMeta {
  id: string; entityType: string; entityId: string; locale: Locale;
  focusKeyword: string | null; metaTitle: string | null; metaDescription: string | null;
  canonicalUrl: string | null; robotsIndex: boolean; robotsFollow: boolean;
  ogTitle: string | null; ogDescription: string | null; ogMediaId: string | null;
  score: number; band: SeoBand; scoreDetail: RuleResult[]; scoredAt: string | null;
}

export interface ProjectListItem {
  id: string; reference: string; status: 'COMPLETED' | 'ONGOING' | 'FUTURE'; publishState: PublishState;
  yearStart: string | null; yearEnd: string | null; sortOrder: number;
  name: string; location: string; seoScore: number; seoBand: SeoBand;
}
export interface ProjectMediaLink { id: string; mediaId: string; role: string; sortOrder: number; media: MediaItem }
export interface ProjectTranslation {
  id: string; locale: Locale; slug: string; name: string; location: string; description: string;
  amenities: string[]; certificate: string | null;
}
export interface ProjectDetail {
  id: string; reference: string; status: string; publishState: PublishState;
  yearStart: string | null; yearEnd: string | null; latitude: number | null; longitude: number | null;
  units: string | null; areaText: string | null; priceRange: string | null; occupancy: string | null;
  gdvMillions: number | null; barWeight: number | null; relatedReferences: string[]; sortOrder: number;
  translations: ProjectTranslation[]; media: ProjectMediaLink[]; seoMeta: SeoMeta[];
}

export interface EventListItem {
  id: string; reference: string; startsAt: string; publishState: PublishState;
  capacity: number | null; registered: number; title: string; category: string;
  seoScore: number; seoBand: SeoBand;
}
export interface EventTranslation {
  id: string; locale: Locale; slug: string; title: string; category: string; location: string;
  description: string; agenda: Array<{ time: string; title: string; description: string }>;
  speakers: Array<{ name: string; title: string; image?: string; bio?: string }>; highlights: string[];
}
export interface EventDetail {
  id: string; reference: string; startsAt: string; endsAt: string | null; publishState: PublishState;
  capacity: number | null; registered: number; isFree: boolean; priceText: string | null;
  heroMediaId: string | null; heroImageUrl: string | null; relatedReferences: string[]; sortOrder: number;
  translations: EventTranslation[]; seoMeta: SeoMeta[];
}

export interface AwardListItem { id: string; reference: string; year: number; sortOrder: number; publishState: PublishState; name: string; mediaUrl: string | null }
export interface AwardDetail {
  id: string; reference: string; year: number; mediaId: string | null; sortOrder: number; publishState: PublishState;
  translations: Array<{ locale: Locale; name: string; issuer: string | null; description: string }>;
}

export interface TestimonialListItem { id: string; reference: string; sortOrder: number; isPlaceholder: boolean; publishState: PublishState; author: string; quote: string }
export interface TestimonialDetail {
  id: string; reference: string; mediaId: string | null; projectId: string | null; sortOrder: number;
  isPlaceholder: boolean; publishState: PublishState;
  translations: Array<{ locale: Locale; quote: string; author: string; role: string; groupLabel: string | null }>;
}

export interface TextBlockItem { id: string; key: string; label: string; kind: string; group: string; value: unknown; hasTranslation: boolean }

export interface MediaItem {
  id: string; storageKey: string; filename: string; mimeType: string; width: number | null; height: number | null;
  bytes: number; altText: string | null; focalX: number; focalY: number; createdAt: string; url: string;
}

export type EnquiryStatus = 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED' | 'SPAM';
export interface Enquiry {
  id: string; name: string; email: string; phone: string | null; interest: string | null; message: string;
  status: EnquiryStatus; assignedTo: string | null; notes: string | null; createdAt: string;
}

export interface DashboardSummary {
  needsAttention: { lowScoring: Array<{ entityType: string; entityId: string; title: string; score: number; band: SeoBand }>; mediaMissingAlt: number };
  publishState: { draftProjects: number; draftEvents: number; scheduledCount: number; lastBuildAt: string | null };
  enquiries: { unread: number; recent: Enquiry[]; trend: Array<[string, number]> };
  upcomingEvents: Array<{ id: string; reference: string; startsAt: string; title: string; capacity: number | null; registered: number }>;
  activity: Array<{ id: string; action: string; entityType: string | null; entityId: string | null; actor: string; createdAt: string }>;
  searchConsole: { enabled: boolean; reason: string };
}

export interface UserItem { id: string; email: string; name: string; isActive: boolean; lastSeenAt: string | null; createdAt: string; roles: string[] }
export interface RoleItem { key: string; label: string; permissions: string[] }
