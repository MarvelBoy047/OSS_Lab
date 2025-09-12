/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  distDir: 'out',
  images: {
    unoptimized: true,
    remotePatterns: [{ hostname: 's2.googleusercontent.com' }],
  },
  // ✅ REMOVED headers - not compatible with export mode
  serverExternalPackages: ['pdf-parse', 'better-sqlite3'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        util: false,
      };
    }
    return config;
  },
};

export default nextConfig;
