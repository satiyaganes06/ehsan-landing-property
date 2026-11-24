import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { readSessionToken } from '@/lib/server/auth';
import { recordAudit } from '@/lib/server/audit';
import { json, route } from '@/lib/server/route';

async function currentId() {
  const token = await readSessionToken();
  return token && createHash('sha256').update(token).digest('hex');
}

export const GET = route({resource:'user', action:'read'}, async ({user}) => {
  const current = await currentId();
  const sessions = await prisma.session.findMany({
    where: {expiresAt: {gt: new Date()}, user: {isActive: true}},
    select: {id:true, createdAt:true, expiresAt:true, userAgent:true, ip:true,
      user:{select:{email:true,roles:{select:{role:{select:{key:true}}}}}}},
    orderBy: {createdAt:'desc'},
  });
  return json(sessions.map(({user:account,...s}) => ({
    ...s, email:account.email, current:s.id === current,
    canRevoke:s.id !== current && user.permissions.has('user:update') &&
      (user.roleKeys.includes('owner') || !account.roles.some(r => r.role.key === 'owner')),
  })));
});

export const POST = route({resource:'user',action:'update'}, async ({user,request}) => {
  const {id} = z.object({id:z.string().max(128)}).parse(await request.json());
  if (id === await currentId()) return json({message:'Use Sign out for this session.'},400);
  const removed = await prisma.session.deleteMany({where:{
    id, ...(user.roleKeys.includes('owner') ? {} : {user:{roles:{none:{role:{key:'owner'}}}}}),
  }});
  if (!removed.count) return json({message:'Session unavailable.'},404);
  recordAudit({actorId:user.id,action:'session.revoked',entityType:'session',entityId:id});
  return json({ok:true});
});
