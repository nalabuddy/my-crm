/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false, // the dev-mode "N" badge covers buttons on phone-sized test runs; no effect in production
  // Reopen pages you just visited instantly from the browser cache (30s). Any save clears it.
  experimental: { staleTimes: { dynamic: 30, static: 180 } },
  headers: async () => [
    { source: "/:path*", headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
    ] },
  ],
};
export default nextConfig;
