const isGithubPages = process.env.GITHUB_PAGES === 'true';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true,
  },
  // pptxgenjs (the proposal PowerPoint) names Node modules ("node:fs", "node:https")
  // it only uses on a server. In the browser they're left out: strip the "node:"
  // prefix webpack can't read, then let its browser settings skip them.
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, '');
      }));
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, https: false, http: false, path: false, os: false };
    }
    return config;
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
