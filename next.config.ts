import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",   // ✅ すべての https ドメインを許可
        port: "",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "**",   // ✅ 必要なら http も許可
        port: "",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;