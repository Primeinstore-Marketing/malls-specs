#!/usr/bin/env node
/**
 * Bakes the database's specs into the site: fetches the API's GET /data and
 * writes it to lib/liveSnapshot.json, which lib/catalogue.ts merges over the
 * code catalogue. Runs before every GitHub Pages build (see
 * .github/workflows/deploy-pages.yml), so published pages show the
 * database's specs on first paint; the browser then applies later edits.
 *
 *   node scripts/snapshot-live.mjs          (or: npm run snapshot)
 *
 * The API URL comes from NEXT_PUBLIC_API_URL, else app/.env.production.
 * If the API can't be reached, the existing snapshot is kept and the build
 * carries on — the browser still loads the latest data on every visit.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(appDir, 'lib', 'liveSnapshot.json');

function apiUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  try {
    const env = readFileSync(join(appDir, '.env.production'), 'utf8');
    return env.match(/^NEXT_PUBLIC_API_URL=(.+)$/m)?.[1]?.trim() ?? '';
  } catch {
    return '';
  }
}

const base = apiUrl().replace(/\/$/, '');
if (!base) {
  console.warn('snapshot-live: no API URL configured; keeping the existing snapshot.');
  process.exit(0);
}

try {
  const response = await fetch(`${base}/data`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.specs) || !Array.isArray(data.pins)) throw new Error('unexpected response shape');
  writeFileSync(out, JSON.stringify(data) + '\n');
  console.log(
    `snapshot-live: ${data.specs.length} specs, ${data.pins.length} positions, ${(data.assets ?? []).length} files -> lib/liveSnapshot.json`,
  );
} catch (error) {
  console.warn(`snapshot-live: couldn't reach ${base}/data (${error.message}); keeping the existing snapshot.`);
}
