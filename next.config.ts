import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image is built with BUILD_STANDALONE=1 so `node server.js` can
  // run without node_modules. Local `npm start` uses the regular build output.
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" } : {}),
  serverExternalPackages: ["nodemailer"],
  webpack: (config, { isServer }) => {
    // Instrumentation is also compiled for the edge runtime, which cannot
    // resolve Node built-ins used by nodemailer. The Node branch loads it at
    // runtime, so keep the package external instead of bundling it.
    if (isServer) {
      config.externals = [...(config.externals ?? []), "nodemailer"];
    }
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
