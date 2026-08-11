const isGithubPages = process.env.GITHUB_PAGES === 'true';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
  },
  ...(isGithubPages
    ? {
        output: 'export',
        basePath,
        assetPrefix: basePath ? `${basePath}/` : undefined,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
