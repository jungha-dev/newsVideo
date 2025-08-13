import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        "@ffmpeg-installer/ffmpeg",
      ];
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*", // 모든 경로에 적용
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "unsafe-none", // 🚨 COOP 완화
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "unsafe-none", // 🚨 COEP 완화
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*", // 또는 특정 도메인: "https://your-domain.com"
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-Requested-With",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
        ],
      },
    ];
  },
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"], // serverComponentsExternalPackages에서 변경
};

export default nextConfig;
