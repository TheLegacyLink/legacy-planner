/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ─── Base44 SSO: redirect /start to Base44 login ─────────────────────────
  // This is the server-level fallback. The page component also handles it
  // client-side. Remove or update the destination once your Base44 URL is set.
  async redirects() {
    const base44Url = process.env.NEXT_PUBLIC_BASE44_LOGIN_URL;
    if (!base44Url) {
      // No Base44 URL set yet — skip redirect
      return [];
    }
    return [
      {
        source: '/start',
        destination: base44Url,
        permanent: false, // 307 — keeps it easy to change later
        has: [
          // Only redirect if none of these bypass params are present
          // (next.js doesn't support "missing" on source params natively,
          // so we handle the bypass logic in the page component instead)
        ],
      },
    ];
  },
};

export default nextConfig;
