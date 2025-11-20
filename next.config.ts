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
  // ▼▼▼【AWS Amplify対応】サーバ専用パッケージをクライアントバンドルから除外 ▼▼▼
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // クライアントバンドルからNode.js専用モジュールを除外
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        path: false,
        http: false,
        https: false,
        stream: false,
        crypto: false,
        child_process: false,
        os: false,
        util: false,
      };
      
      // @google-cloud/secret-manager とその依存関係を外部化
      config.externals = config.externals || [];
      config.externals.push({
        '@google-cloud/secret-manager': 'commonjs @google-cloud/secret-manager',
        '@google-cloud/vertexai': 'commonjs @google-cloud/vertexai',
        '@google/generative-ai': 'commonjs @google/generative-ai',
        'google-gax': 'commonjs google-gax',
        'google-auth-library': 'commonjs google-auth-library',
        'gaxios': 'commonjs gaxios',
        'agent-base': 'commonjs agent-base',
        'https-proxy-agent': 'commonjs https-proxy-agent',
      });
    }
    return config;
  },
  // ▲▲▲
  images: {
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
};

export default nextConfig;