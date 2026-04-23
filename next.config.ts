import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Required for Docker deployment
  async rewrites() {
    // Only proxy in development. In production, vercel.json handles routing.
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*`,
        },
      ];
    }
    return [];
  },

};

export default nextConfig;
