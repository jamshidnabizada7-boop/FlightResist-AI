import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only use standalone for self-hosted (ECS) deployment.
  // Vercel (and other managed platforms) must not receive a standalone build.
  ...(process.env.DEPLOY_TARGET === "standalone" ? { output: "standalone" as const } : {}),
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
