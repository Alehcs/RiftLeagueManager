/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Real LoL esports assets live on many public CDNs. Allow remote images broadly;
    // the app always falls back to generated initials when an image fails to load.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    unoptimized: true,
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
