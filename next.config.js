/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.qoo10.jp' },
      { protocol: 'https', hostname: 'gd.image-qoo10.jp' },
    ],
  },
};

module.exports = nextConfig;
