import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true, // Static exports do not support Next.js dynamic image optimization
  }
};

export default nextConfig;
