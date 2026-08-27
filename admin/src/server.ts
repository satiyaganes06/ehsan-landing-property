import Fastify, { type FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from './config/env.js';
import { loadAuthedUser } from './lib/auth.js';
import { authRoutes } from './modules/auth/routes.js';
import { userRoutes } from './modules/users/routes.js';
import { projectRoutes } from './modules/projects/routes.js';
import { eventRoutes } from './modules/events/routes.js';
import { awardRoutes } from './modules/awards/routes.js';
import { testimonialRoutes } from './modules/testimonials/routes.js';
import { blockRoutes } from './modules/blocks/routes.js';
import { mediaRoutes } from './modules/media/routes.js';
import { seoRoutes } from './modules/seo/routes.js';
import { aiRoutes } from './modules/ai/routes.js';
import { enquiryRoutes } from './modules/enquiries/routes.js';
import { dashboardRoutes } from './modules/dashboard/routes.js';
import { previewRoutes } from './modules/preview/routes.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..'); // admin/src -> admin -> repo root

export async function buildServer() {
  const app = Fastify({
    logger: env.NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }
      : true,
    trustProxy: true, // clientIp() reads x-forwarded-for; a bare reverse proxy needs this
  });

  await app.register(cookie);
  await app.register(cors, { origin: true, credentials: true });
  await app.register(multipart, { limits: { fileSize: 15 * 1024 * 1024 } }); // 15MB per upload
  await app.register(rateLimit, { global: false }); // opt-in per route, not blanket

  // Legacy imported media, served straight from the repo the panel sits beside.
  await app.register(fastifyStatic, {
    root: path.join(REPO_ROOT, 'assets', 'img'),
    prefix: '/media/legacy/',
    decorateReply: false,
  });
  // New uploads through the panel.
  await app.register(fastifyStatic, {
    root: path.join(HERE, '..', 'uploads'),
    prefix: '/media/uploads/',
    decorateReply: false,
  });
  // Whole repo, for live preview to pull the real css/js/assets by relative
  // path -- see modules/preview/routes.ts. Read-only by construction: static
  // serving has no write path.
  await app.register(fastifyStatic, {
    root: REPO_ROOT,
    prefix: '/live-site/',
    decorateReply: true,
  });

  // Auth runs before every route. `req.user` is null rather than throwing --
  // public routes (login, the future public enquiry endpoint) need to run
  // with no session; requirePermission() is what actually gates access.
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req) => {
    req.user = await loadAuthedUser(req);
  });

  app.get('/api/health', async () => ({ ok: true, time: new Date().toISOString() }));

  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(projectRoutes);
  await app.register(eventRoutes);
  await app.register(awardRoutes);
  await app.register(testimonialRoutes);
  await app.register(blockRoutes);
  await app.register(mediaRoutes);
  await app.register(seoRoutes);
  await app.register(aiRoutes);
  await app.register(enquiryRoutes);
  await app.register(dashboardRoutes);
  await app.register(previewRoutes);

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err.validation) {
      return reply.code(400).send({ error: 'bad_request', message: err.message });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'internal_error', message: 'Something went wrong.' });
  });

  return app;
}

async function main() {
  const app = await buildServer();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

// Only auto-start when run directly -- tests import buildServer() instead.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
