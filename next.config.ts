import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image is built with BUILD_STANDALONE=1 so `node server.js` can
  // run without node_modules. Local `npm start` uses the regular build output.
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" } : {}),
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
