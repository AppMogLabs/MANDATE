import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed output: "export" — API routes require server-side runtime

  // On mandate.wtf the MVP is the product. Redirect the root to /mvp.
  async redirects() {
    return [
      { source: "/", destination: "/mvp", permanent: false },
    ];
  },
};

export default nextConfig;
