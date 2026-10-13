import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The Docker image runs the small standalone server (ADR-053); the root is the monorepo so it can trace @vyana/shared.
  output: "standalone",
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // @vyana/shared ships TypeScript source (no build step)
  transpilePackages: ["@vyana/shared"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
