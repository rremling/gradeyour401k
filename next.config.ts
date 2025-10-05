import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ⛔ Skip ESLint errors during production builds (lets Vercel build cleanly)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ⛔ Skip type errors during production builds
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
