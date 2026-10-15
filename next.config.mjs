/** @type {import('next').NextConfig} */
const nextConfig = {
  headers: async () => [
    { source: "/:path*", headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
    ] },
  ],
};
export default nextConfig;
