/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Phase 1: TS check OOMs on Windows - Vercel handles TS checking in CI
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
