import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  images: {
    /**
     * Allow next/image to load product images served from:
     *  - Payload's local /media/ handler (same-origin — no pattern needed, but
     *    listing localhost makes `bun run build` static analysis pass cleanly)
     *  - Any HTTPS host (for production CDN / Payload Cloud / S3 URLs)
     *
     * Tighten to specific hostnames before going to production.
     */
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default withPayload(nextConfig);
