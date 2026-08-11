/**
 * `next/image` with `images.unoptimized: true` (required for static export)
 * does NOT automatically prepend `basePath` to a public-folder `src` — only
 * `next/link` and the (unused, in unoptimized mode) `/_next/image` proxy get
 * that for free. Any `<Image src="/...">` pointing at `public/` must go
 * through this helper or it 404s once deployed under a sub-path (e.g. GitHub
 * Pages' `/repo-name/`).
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
