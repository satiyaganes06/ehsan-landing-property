/**
 * The permission matrix, as data rather than scattered `if (role === ...)`
 * checks. This is the single source of truth: the seed script inserts
 * exactly these rows, and every `requirePermission()` call in the route
 * files checks against what ends up in the database from this list -- so a
 * change here is a change everywhere, not a change to hunt for.
 */

export const RESOURCES = [
  'project', 'event', 'award', 'testimonial', 'block',
  'media', 'enquiry', 'user', 'setting', 'ai', 'audit',
] as const;
export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ['read', 'create', 'update', 'delete', 'publish', 'use'] as const;
export type Action = (typeof ACTIONS)[number];

export const ROLES = [
  { key: 'owner', label: 'Owner', rank: 0 },
  { key: 'admin', label: 'Admin', rank: 1 },
  { key: 'editor', label: 'Editor', rank: 2 },
  { key: 'contributor', label: 'Contributor', rank: 3 },
  { key: 'viewer', label: 'Viewer', rank: 4 },
] as const;

const CONTENT: Resource[] = ['project', 'event', 'award', 'testimonial'];

function pairs(resources: Resource[], actions: Action[]): Array<[Resource, Action]> {
  return resources.flatMap((r) => actions.map((a): [Resource, Action] => [r, a]));
}

/** role key -> [resource, action][] */
export const ROLE_PERMISSIONS: Record<string, Array<[Resource, Action]>> = {
  owner: [
    ...pairs(CONTENT, ['read', 'create', 'update', 'delete', 'publish']),
    ...pairs(['block'], ['read', 'update']),
    ...pairs(['media'], ['read', 'create', 'update', 'delete']),
    ...pairs(['enquiry'], ['read', 'update', 'delete']),
    ...pairs(['user'], ['read', 'create', 'update', 'delete']),
    ...pairs(['setting'], ['read', 'update']),
    ...pairs(['ai'], ['use']),
    ...pairs(['audit'], ['read']),
  ],
  admin: [
    ...pairs(CONTENT, ['read', 'create', 'update', 'delete', 'publish']),
    ...pairs(['block'], ['read', 'update']),
    ...pairs(['media'], ['read', 'create', 'update', 'delete']),
    ...pairs(['enquiry'], ['read', 'update', 'delete']),
    ...pairs(['user'], ['read', 'create', 'update', 'delete']),
    ...pairs(['setting'], ['read']), // can see AI provider/config, cannot change it
    ...pairs(['ai'], ['use']),
    ...pairs(['audit'], ['read']),
  ],
  editor: [
    ...pairs(CONTENT, ['read', 'create', 'update']), // no delete, no publish
    ...pairs(['block'], ['read', 'update']),
    ...pairs(['media'], ['read', 'create', 'update']),
    ...pairs(['enquiry'], ['read']),
    ...pairs(['ai'], ['use']),
  ],
  contributor: [
    // "Own only" on project/event is enforced at the route level (createdBy
    // check), not expressible as a flat resource:action pair -- the matrix
    // grants the verb, the handler decides whose rows it applies to.
    ...pairs(['project', 'event'], ['read', 'create', 'update']),
    ...pairs(['award', 'testimonial', 'block'], ['read']),
    ...pairs(['media'], ['read', 'create']),
    ...pairs(['ai'], ['use']),
  ],
  viewer: [
    ...pairs([...CONTENT, 'block'], ['read']),
    ...pairs(['media', 'enquiry'], ['read']),
  ],
};

/** Every (resource, action) pair actually granted to at least one role --
    what the seed script inserts into the permissions table. */
export function allGrantedPermissions(): Array<[Resource, Action]> {
  const seen = new Map<string, [Resource, Action]>();
  for (const list of Object.values(ROLE_PERMISSIONS)) {
    for (const [r, a] of list) seen.set(`${r}:${a}`, [r, a]);
  }
  return [...seen.values()];
}
