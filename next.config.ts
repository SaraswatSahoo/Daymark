import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every view reads live personal data from SQLite, so pages are rendered per
  // request (see `dynamic = "force-dynamic"` in the root layout) instead of using
  // Cache Components / prerendering.
  cacheComponents: false,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "web-push"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
