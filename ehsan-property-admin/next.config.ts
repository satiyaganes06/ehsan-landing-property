import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // This app sits inside a repo that also holds the static site and the API,
  // each with their own lockfile. Pin the root so Turbopack stops guessing.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
