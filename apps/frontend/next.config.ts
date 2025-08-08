import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow loading screenshots from arbitrary HTTPS hosts. Adjust if you know exact domains.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
