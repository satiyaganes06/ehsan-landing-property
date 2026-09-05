import { json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

export const GET = route({ auth: true }, async ({ user }) =>
  json({
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roleKeys,
    permissions: [...user.permissions],
  }),
);
