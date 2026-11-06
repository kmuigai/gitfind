import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [
      {
        // E1 canonical host: fold www into the apex domain with a permanent
        // (308) redirect, preserving the path. Page canonicals already point
        // at https://gitfind.ai — this stops the www host from being crawled
        // and indexed as a duplicate of the whole site. Applies whenever a
        // request reaches the app with a www.gitfind.ai Host header; if the
        // www domain is ever detached from the deployment in Vercel, the
        // redirect must be configured there instead.
        source: '/:path*',
        has: [{ type: 'host', value: 'www.gitfind.ai' }],
        destination: 'https://gitfind.ai/:path*',
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'github.com',
        pathname: '/**',
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  disableLogger: true,
  automaticVercelMonitors: true,
});
