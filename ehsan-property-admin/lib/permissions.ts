/**
 * Client-side mirror of the API's permission vocabulary
 * (admin/src/lib/permissions.ts). This exists for UX only -- deciding what to
 * show, what to disable, and what to explain. The server re-checks every call
 * regardless, so a stale mirror is a cosmetic bug, never a security hole.
 */

export const RESOURCES = [
  'project', 'event', 'award', 'testimonial', 'block',
  'media', 'enquiry', 'user', 'setting', 'ai', 'audit',
] as const;
export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ['read', 'create', 'update', 'delete', 'publish', 'use'] as const;
export type Action = (typeof ACTIONS)[number];

export const ROLES = [
  { key: 'owner', label: 'Owner', blurb: 'Full control, including users and settings.' },
  { key: 'admin', label: 'Admin', blurb: 'Everything except changing AI configuration.' },
  { key: 'editor', label: 'Editor', blurb: 'Create and edit content. Cannot publish or delete.' },
  { key: 'contributor', label: 'Contributor', blurb: 'Create and edit their own projects and events only.' },
  { key: 'viewer', label: 'Viewer', blurb: 'Read-only across the panel.' },
] as const;

export type RoleKey = (typeof ROLES)[number]['key'];

export function roleLabel(key: string) {
  return ROLES.find((r) => r.key === key)?.label ?? key;
}

/** The highest-ranking role a user holds, for display in one chip. */
export function primaryRole(roles: string[]): string | undefined {
  return ROLES.find((r) => roles.includes(r.key))?.key;
}

export function hasPermission(permissions: string[] | undefined, resource: Resource, action: Action) {
  return Boolean(permissions?.includes(`${resource}:${action}`));
}

/**
 * Why an action is unavailable, phrased for the person looking at it. Used as
 * the tooltip on a disabled control -- a disabled button with no explanation
 * reads as a broken button.
 */
export function permissionHint(resource: Resource, action: Action) {
  const verb: Record<Action, string> = {
    read: 'view',
    create: 'create',
    update: 'edit',
    delete: 'delete',
    publish: 'publish',
    use: 'use',
  };
  return `Your role can't ${verb[action]} ${resource === 'block' ? 'page text' : `${resource}s`}. Ask an owner to change it.`;
}
