import type { NextConfig } from "next";

const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_INTERNAL_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
