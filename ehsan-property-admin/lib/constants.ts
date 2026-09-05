/**
 * The event categories offered in the panel.
 *
 * "Property Launch", "Open House" and "Seminar" are the three already in use
 * by the events on the site, so dropping any of them would make an existing
 * category unreachable when creating a new event. "Celebration" is new.
 *
 * Kept as one list so the create and edit screens can never drift apart.
 */
export const EVENT_CATEGORIES = [
  'Property Launch',
  'Celebration',
  'Open House',
  'Seminar',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];
