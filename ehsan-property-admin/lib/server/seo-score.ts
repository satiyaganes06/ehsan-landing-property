/**
 * Deterministic SEO scoring. No AI in this file -- a score that varies
 * between runs is one nobody trusts, and AI's role in this system is
 * generating candidate copy, never grading it.
 *
 * Eleven pass/fail rules, weights summing to 100. `evaluate()` is pure: same
 * input always produces the same score, which is what lets the panel show a
 * live-updating bar as an editor types without a round trip.
 */
import { pixelWidth, TITLE_FONT_PX, DESCRIPTION_FONT_PX, TITLE_MAX_PX, DESCRIPTION_MAX_PX } from './pixel-width';

export interface SeoScoreInput {
  title: string;
  description: string;
  slug: string;
  focusKeyword: string | null;
  bodyText: string; // plain-text content the record is about
  imageCount: number;
  imagesWithAlt: number;
  otherPublishedTitles: string[]; // for uniqueness, excluding this record
  internalLinkCount: number;
}

export interface RuleResult {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  message: string;
}

export interface SeoScoreResult {
  score: number;
  band: 'BAD' | 'NEUTRAL' | 'GOOD';
  rules: RuleResult[];
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function rule(
  id: string,
  label: string,
  weight: number,
  passed: boolean,
  passMsg: string,
  failMsg: string,
): RuleResult {
  return { id, label, weight, passed, message: passed ? passMsg : failMsg };
}

export function evaluateSeo(input: SeoScoreInput): SeoScoreResult {
  const title = input.title.trim();
  const description = input.description.trim();
  const kw = input.focusKeyword?.trim().toLowerCase() || '';
  const bodyLower = input.bodyText.toLowerCase();
  const first100 = input.bodyText.trim().split(/\s+/).slice(0, 100).join(' ').toLowerCase();

  const titleLen = title.length;
  const descLen = description.length;
  const titlePx = pixelWidth(title, TITLE_FONT_PX);
  const descPx = pixelWidth(description, DESCRIPTION_FONT_PX);

  const rules: RuleResult[] = [
    rule(
      'title-length', 'Title length (30-60 characters)', 14,
      titleLen >= 30 && titleLen <= 60,
      `Title is ${titleLen} characters.`,
      titleLen === 0
        ? 'No meta title set.'
        : titleLen < 30
          ? `Title is ${titleLen} characters -- aim for 30-60.`
          : `Title is ${titleLen} characters -- Google truncates past ~60.`,
    ),
    rule(
      'title-pixels', 'Title fits the search result (~600px)', 6,
      title.length > 0 && titlePx <= TITLE_MAX_PX,
      `Renders at roughly ${Math.round(titlePx)}px.`,
      title.length === 0
        ? 'No meta title set.'
        : `Renders at roughly ${Math.round(titlePx)}px -- likely to be cut off around ${TITLE_MAX_PX}px.`,
    ),
    rule(
      'description-length', 'Description length (120-158 characters)', 14,
      descLen >= 120 && descLen <= 158,
      `Description is ${descLen} characters.`,
      descLen === 0
        ? 'No meta description set.'
        : descLen < 120
          ? `Description is ${descLen} characters -- aim for 120-158.`
          : `Description is ${descLen} characters -- Google truncates past ~158.`,
    ),
    rule(
      'description-pixels', 'Description fits the search result (~960px)', 6,
      description.length > 0 && descPx <= DESCRIPTION_MAX_PX,
      `Renders at roughly ${Math.round(descPx)}px.`,
      description.length === 0
        ? 'No meta description set.'
        : `Renders at roughly ${Math.round(descPx)}px -- likely to be cut off around ${DESCRIPTION_MAX_PX}px.`,
    ),
    rule(
      'title-unique', 'Title is unique on the site', 12,
      title.length > 0 && !input.otherPublishedTitles.some((t) => t.trim().toLowerCase() === title.toLowerCase()),
      'No other published page shares this title.',
      'Another published page has the exact same title -- Google reads this as duplicate content.',
    ),
    rule(
      'keyword-in-title', 'Focus keyword appears in the title', 10,
      kw.length > 0 && title.toLowerCase().includes(kw),
      `"${input.focusKeyword}" appears in the title.`,
      kw.length === 0 ? 'No focus keyword set.' : `"${input.focusKeyword}" does not appear in the title.`,
    ),
    rule(
      'keyword-early', 'Focus keyword appears early in the content', 8,
      kw.length > 0 && first100.includes(kw),
      'Keyword appears within the first 100 words.',
      kw.length === 0 ? 'No focus keyword set.' : 'Keyword does not appear in the first 100 words.',
    ),
    rule(
      'slug-quality', 'Slug is short, lowercase and hyphenated', 8,
      /^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug) &&
        input.slug.split('-').length <= 6 &&
        (kw.length === 0 || input.slug.includes(kw.replace(/\s+/g, '-'))),
      `Slug "${input.slug}" is clean.`,
      !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug)
        ? `Slug "${input.slug}" should be lowercase, hyphenated, no special characters.`
        : input.slug.split('-').length > 6
          ? `Slug "${input.slug}" is long -- aim for 5 words or fewer.`
          : `Slug "${input.slug}" does not contain the focus keyword.`,
    ),
    rule(
      'alt-coverage', 'Every image has alt text', 12,
      input.imageCount === 0 || input.imagesWithAlt === input.imageCount,
      input.imageCount === 0 ? 'No images on this record.' : `All ${input.imageCount} images have alt text.`,
      `${input.imageCount - input.imagesWithAlt} of ${input.imageCount} images are missing alt text.`,
    ),
    rule(
      'content-depth', 'At least 150 words of content', 6,
      wordCount(input.bodyText) >= 150,
      `${wordCount(input.bodyText)} words.`,
      `Only ${wordCount(input.bodyText)} words -- thin content is a weak signal to search engines.`,
    ),
    rule(
      'internal-links', 'Links to at least one other page', 4,
      input.internalLinkCount >= 1,
      `${input.internalLinkCount} internal link(s).`,
      'No internal links to other projects or events.',
    ),
  ];

  const score = rules.reduce((sum, r) => sum + (r.passed ? r.weight : 0), 0);
  const band: SeoScoreResult['band'] = score >= 80 ? 'GOOD' : score >= 50 ? 'NEUTRAL' : 'BAD';

  return { score, band, rules };
}
