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
        ],
      },
    ];
  },
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"], // serverComponentsExternalPackages에서 변경
};

export default nextConfig;
