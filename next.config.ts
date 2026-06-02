import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true, // Static exports do not support Next.js dynamic image optimization
  }
};

export default nextConfig;
