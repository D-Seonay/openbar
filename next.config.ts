import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Uploaded images live on the API, but the browser must never be told the
      // API's address: a NEXT_PUBLIC_* value is inlined into the bundle at build
      // time, so an image built for one host would point at that host from every
      // deployment. Proxy instead — `/uploads/*` stays same-origin and works
      // behind any hostname, and NEST_API_URL is read here, on the server, at
      // request time. src/proxy.ts already excludes `uploads` from its matcher.
      {
        source: "/uploads/:path*",
        destination: `${process.env.NEST_API_URL ?? "http://api:3001"}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
