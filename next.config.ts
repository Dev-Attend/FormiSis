import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  allowedDevOrigins: ["127.0.0.1", "10.1.11.64"],
};

export default nextConfig;
