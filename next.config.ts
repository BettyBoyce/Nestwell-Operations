import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow proof-photo uploads from phones (default limit is 1 MB).
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
