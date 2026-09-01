import path from 'node:path';
import type { NextConfig } from 'next';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // This app sits inside a repo that also holds the static site and the API,
  // each with their own lockfile. Pin the root so Turbopack stops guessing.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
  // The Fastify API stays its own service. Proxying it under this origin is
  // what lets the session cookie, the /media/* static mounts and the preview
  // iframe all behave as same-origin -- the iframe in particular only sends
  // credentials when it is not cross-site.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
      { source: '/media/:path*', destination: `${API_ORIGIN}/media/:path*` },
      { source: '/live-site/:path*', destination: `${API_ORIGIN}/live-site/:path*` },
    ];
  },
};

export default nextConfig;
