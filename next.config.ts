import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Vercel Free Tier Optimizations ──
  // "standalone" is for Docker/self-hosted, NOT needed on Vercel.
  // Removing it reduces build size and avoids conflicts with Vercel's builder.
  // output: "standalone", // ← REMOVED for Vercel

  reactStrictMode: false,
  compress: true,

  // ── Type checking: let CI handle it, but don't silently deploy broken code ──
  // ignoreBuildErrors was hiding real type issues — changed to false
  typescript: {
    ignoreBuildErrors: false,
  },

  allowedDevOrigins: [
    ".space-z.ai",
    "localhost",
  ],

  images: {
    loader: 'custom',
    loaderFile: './src/lib/cloudinary-loader.ts',
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 828, 1080, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },

  // ── PWA Headers: Allow service worker to work correctly ──
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800',
          },
        ],
      },
    ];
  },

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
      'recharts',
      'framer-motion',
      '@tanstack/react-table',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
    ],
  },
};

export default nextConfig;
