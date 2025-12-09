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
  // ▼▼▼【重要】AWS Amplify standalone mode ▼▼▼
  output: 'standalone',
  // ▲▲▲
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
  webpack: (config, { isServer }) => {
    // ensureGcpCreds.ts와 load-env-vars.ts는 서버 전용이므로 클라이언트 번들에서 제외
    // ensureGcpCreds.ts and load-env-vars.ts are server-only, so exclude from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        'fs/promises': false,
        path: false,
        'node:fs': false,
        'node:fs/promises': false,
        'node:path': false,
      };
      // load-env-vars.ts를 클라이언트 번들에서 완전히 제외
      // Completely exclude load-env-vars.ts from client bundle
      config.resolve.alias = {
        ...config.resolve.alias,
        '@/lib/load-env-vars': false,
      };
      // externals에 추가하여 클라이언트 번들에서 제외
      // Add to externals to exclude from client bundle
      if (!config.externals) {
        config.externals = [];
      }
      if (Array.isArray(config.externals)) {
        config.externals.push('@/lib/load-env-vars');
      }
    } else {
      // ▼▼▼【重要】서버 사이드에서 AWS/GCP SDK를 external로 처리 ▼▼▼
      // AWS SDK와 Google Cloud SDK를 번들링하지 않고 외부 모듈로 처리
      // This prevents webpack from trying to bundle Node.js-only modules
      const sdkExternals = [
        '@google-cloud/secret-manager',
        '@aws-sdk/client-secrets-manager',
        'google-gax',
        'google-auth-library',
        'gaxios',
      ];
      
      // externals를 함수로 설정하여 조건부 처리
      const originalExternals = config.externals || [];
      config.externals = [
        ...Array.isArray(originalExternals) ? originalExternals : [originalExternals],
        ({ request }: { request?: string }) => {
          if (request && sdkExternals.some(ext => request.startsWith(ext))) {
            return `commonjs ${request}`;
          }
          return;
        }
      ];
      // ▲▲▲
      
      // 서버 사이드에서는 node: 프리픽스를 처리하기 위한 설정
      // Server-side configuration to handle node: prefix
      config.resolve.alias = {
        ...config.resolve.alias,
        'node:fs': 'fs',
        'node:fs/promises': 'fs/promises',
        'node:path': 'path',
      };
    }
    return config;
  },
  // NextAuth 호환성을 위한 설정
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;