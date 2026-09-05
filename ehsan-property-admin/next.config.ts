import path from 'node:path';
import type { NextConfig } from 'next';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // This app sits inside a repo that also holds the static site and the API,
  // each with their own lockfile. Pin the root so Turbopack stops guessing.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  /**
   * Migration seam. These are `fallback` rewrites deliberately: an array-form
   * rewrite is checked BEFORE dynamic routes, so it would shadow a local
   * app/api/projects/[id]/route.ts. `fallback` runs after every local route
   * has been tried, so anything implemented here wins and everything still
   * living in Fastify proxies through untouched.
   *
   * Delete the /api entry once the last module has moved.
   */
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
        { source: '/media/:path*', destination: `${API_ORIGIN}/media/:path*` },
        { source: '/live-site/:path*', destination: `${API_ORIGIN}/live-site/:path*` },
      ],
    };
  },
};

export default nextConfig;
