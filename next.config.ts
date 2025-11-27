import type { NextConfig } from "next";

const csp = [
  "default-src 'self';",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com;",
  "style-src 'self' 'unsafe-inline';",
  "img-src 'self' data: blob: https:;",
  "font-src 'self' data:;",
  "connect-src 'self' https://*.supabase.co https://*.upstash.io https://*.googleapis.com https://accounts.google.com https://www.googleapis.com https://vertex.googleapis.com ws:;",
  "media-src 'self' blob: data:;",
  "frame-src 'self' https://accounts.google.com;",
  "object-src 'none';",
  "base-uri 'self';",
  "frame-ancestors 'none';",
].join(" ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: csp,
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), fullscreen=*, geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=*, publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  images: {
    // SVG placeholders (e.g. https://placehold.co) are used across character pages.
    // Allow them explicitly while remote optimizer remains enabled.
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "**",
        port: "",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  // API routes를 빌드 시 분석하지 않도록 설정（ビルド時の問題を回避）
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@google-cloud/secret-manager/**',
        'node_modules/@google-cloud/**',
      ],
    },
  },
};

export default nextConfig;