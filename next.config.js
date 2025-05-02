/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactStrictMode: false,

  // 개발 서버에서 HTTPS 사용 (로컬 개발 환경에서만)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          // 모바일에서 카메라 접근 권한 관련 헤더
          {
            key: "Feature-Policy",
            value: "camera *; microphone *",
          },
          {
            key: "Permissions-Policy",
            value: "camera=*, microphone=*",
          },
          // 보안 관련 헤더
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          // CORS 헤더 추가
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, OPTIONS",
          },
        ],
      },
      // TensorFlow.js 모델 파일에 대한 추가 헤더
      {
        source: "/(.*).bin",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // TensorFlow.js 최적화 - 웹어셈블리 사용
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };

    // 웹 워커 지원 (TensorFlow.js 최적화)
    config.externals.push({
      "@tensorflow/tfjs-node": "commonjs @tensorflow/tfjs-node",
    });

    // TensorFlow.js 및 미디어 관련 최적화
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });

    // SharedArrayBuffer 지원을 위한 Worker 설정
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
      asyncWebAssembly: true,
    };

    return config;
  },

  // 개발 환경에서 모바일 디바이스 접근 허용
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://192.168.219.163:3000",
    "http://192.168.219.163:3001",
  ],

  // 이미지 및 CDN 접근 허용
  images: {
    domains: ["cdn.jsdelivr.net"],
  },
};

module.exports = nextConfig;
