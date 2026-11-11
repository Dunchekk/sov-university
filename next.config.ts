import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "*": [
      "./.env*",
      "./.local/**/*",
      "./.data/**/*",
      "./test-results/**/*",
      "./playwright-report/**/*",
    ],
  },
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  serverExternalPackages: ["@node-rs/argon2"],
  poweredByHeader: false,
  devIndicators: false,
  logging: { incomingRequests: { ignore: [/\/api\/calendar\/feeds\//] } },
  outputFileTracingIncludes: {
    "/api/calendar/imports/*": [
      "./runtime/**/*",
      "./node_modules/node-ical/**/*",
      "./node_modules/rrule-temporal/**/*",
      "./node_modules/ical.js/**/*",
      "./node_modules/date-fns-tz/**/*",
      "./node_modules/date-fns/**/*",
      "./node_modules/@js-temporal/**/*",
      "./node_modules/jsbi/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
