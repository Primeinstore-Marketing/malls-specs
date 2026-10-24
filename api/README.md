# Primedia Malls specs API

The admin backend for the specs site: sign-in, and the edits admins make
(spec changes, added screens, confirmed screen positions). It's a
Cloudflare Worker (`malls-specs-api`) with a D1 database (`malls-specs`)
and a KV namespace for files (`malls-specs-files`). They live in the
mosesm@primeinstore.co.za Cloudflare account but share nothing with the
Instore resources there (`polished-moon-7019`, `SPECS_DATA`, the hrcomms
Workers).

The site itself stays on GitHub Pages. It reads `GET /data` on every visit
and layers those edits over its built-in data, so changes are live for
everyone as soon as an admin saves. If the API is unreachable, the site
still works, read-only, on the built-in data.

## Pictures and files

Uploads (pictures, artwork templates, attachments) go to the Workers KV
namespace `malls-specs-files` (binding `FILES`), catalogued in the `assets`
table. Up to 25 MB per file. Allowed: JPG, PNG, WebP, GIF, SVG, MP4/WebM,
PDF, ZIP, AI/EPS, PSD, DWG/DXF. Files are served from `GET /files/:key`
with headers that stop any uploaded file (e.g. an SVG) from running script.

To move to R2 later (bigger files, cheaper at scale): enable R2 in the
dashboard, add an `r2_buckets` binding, and implement the three methods of
`FileStore` in `src/files.ts` against it. Existing KV files would need
copying across once.

## Security model

- No public sign-up. Admins are created from the command line (below).
- Passwords: PBKDF2-SHA256, 100,000 iterations, per-admin random salt.
  Typed at a hidden prompt and hashed locally; never sent anywhere in
  plain text, never stored.
- Sessions: random 256-bit tokens, 7-day expiry, only a SHA-256 of each
  stored. Changing a password signs out the admin's other sessions.
- Sign-in lockout: 5 failures per email or 20 per IP in 15 minutes.
- Writes are refused from any origin not in `ALLOWED_ORIGINS`
  (`wrangler.jsonc`), and every change is recorded in `audit_log`.

## First-time setup

1. Sign in to the Primedia Malls Cloudflare account:

   ```sh
   cd api
   npx wrangler logout     # if signed in to another account
   npx wrangler login
   npx wrangler whoami     # check it's the Malls account
   ```

2. Create the database, then copy the `database_id` it prints into
   `wrangler.jsonc` under `d1_databases`:

   ```sh
   npx wrangler d1 create malls-specs
   ```

3. Create the tables and deploy:

   ```sh
   npm run db:migrate
   npm run deploy
   ```

   Note the `https://malls-specs-api.<subdomain>.workers.dev` URL.

4. Point the site at it — `app/.env.production`:

   ```
   NEXT_PUBLIC_API_URL=https://malls-specs-api.<subdomain>.workers.dev
   ```

   Commit that file; the GitHub Pages build reads it. (It's a public URL,
   not a secret.)

5. Create the first admin. You'll be asked for the password twice:

   ```sh
   npm run create-admin -- mosesm@primeinstore.co.za "Moses Mkhumbuza"
   ```

## Day to day

| Task | Command (in `api/`) |
|---|---|
| Add an admin, or reset a password | `npm run create-admin -- name@example.com "Full Name"` |
| Disable an admin | `npx wrangler d1 execute malls-specs --remote --command "UPDATE admins SET disabled = 1 WHERE email = 'name@example.com'"` |
| See recent changes | `npx wrangler d1 execute malls-specs --remote --command "SELECT at, admin, action, target FROM audit_log ORDER BY id DESC LIMIT 50"` |
| Back up everything | `npx wrangler d1 export malls-specs --remote --output backup.sql` |
| Deploy code changes | `npm run deploy` |

## Local development

```sh
cd api
npm run db:migrate:local
npm run create-admin -- you@example.com "You" --local
npm run dev                          # API on http://localhost:8787
```

and in `app/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:8787`.
