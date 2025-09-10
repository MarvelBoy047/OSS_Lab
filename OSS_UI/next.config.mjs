// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [{ hostname: 's2.googleusercontent.com' }],
  },
  // Next 15+ setting; replaces experimental.serverComponentsExternalPackages
  serverExternalPackages: ['pdf-parse', 'better-sqlite3'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Never try to polyfill Node APIs in the browser
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
