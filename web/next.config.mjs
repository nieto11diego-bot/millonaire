/** @type {import('next').NextConfig} */
const nextConfig = {
  // Game assets live under /public/game — never cache during local play
  async headers() {
    return [
      {
        source: "/game/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
