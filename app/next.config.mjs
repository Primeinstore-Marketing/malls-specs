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
        // Each page becomes a folder with an index.html (and index.txt). Under a
        // sub-path like /malls-specs, the home page's prefetch data otherwise
        // resolves to /malls-specs.txt — outside the site — and 404s.
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
