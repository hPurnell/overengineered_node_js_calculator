import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * Workspace packages ship as TypeScript-compiled CommonJS. Transpiling them
   * through Next's pipeline keeps a single copy of their dependencies in the
   * bundle and avoids the ESM/CJS dual-package hazard.
   */
  transpilePackages: ['@calc/contracts'],

  typescript: {
    // Never ship a build that does not type-check.
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
