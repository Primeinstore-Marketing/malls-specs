#!/usr/bin/env node
/**
 * Adds an admin, or resets an existing admin's password.
 *
 *   npm run create-admin -- you@example.com "Your Name"            (live database)
 *   npm run create-admin -- you@example.com "Your Name" --local    (local dev database)
 *
 * The password is typed at a hidden prompt and hashed on this machine with
 * the same PBKDF2 settings as the API; only the hash is sent to the database.
 */
import { execFileSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ITERATIONS = 100_000; // must match PBKDF2_ITERATIONS in src/auth.ts
const MIN_LENGTH = 10;

const args = process.argv.slice(2);
const local = args.includes('--local');
const [email, name = ''] = args.filter((arg) => arg !== '--local');
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Usage: npm run create-admin -- <email> ["Full name"] [--local]');
  process.exit(1);
}

function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    // Typing sends one character per event, but a paste arrives as a single
    // chunk — so walk every character in it.
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        } else if (char === '\u0003') {
          process.exit(130);
        } else if (char === '\u007f') {
          value = value.slice(0, -1);
        } else {
          value += char;
        }
      }
    };
    stdin.on('data', onData);
  });
}

const password = await promptHidden(`Password for ${email}: `);
if (password.length < MIN_LENGTH) {
  console.error(`Use at least ${MIN_LENGTH} characters.`);
  process.exit(1);
}
const confirm = await promptHidden('Type it again: ');
if (confirm !== password) {
  console.error('The two passwords don’t match.');
  process.exit(1);
}

const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
const sql = `INSERT INTO admins (email, name, password_hash, password_salt, iterations)
VALUES (${quote(email.toLowerCase())}, ${quote(name)}, ${quote(hash.toString('base64'))}, ${quote(salt.toString('base64'))}, ${ITERATIONS})
ON CONFLICT(email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash,
  password_salt = excluded.password_salt, iterations = excluded.iterations, disabled = 0;
DELETE FROM sessions WHERE admin_id = (SELECT id FROM admins WHERE email = ${quote(email.toLowerCase())});`;

const dir = mkdtempSync(join(tmpdir(), 'malls-admin-'));
const file = join(dir, 'admin.sql');
try {
  writeFileSync(file, sql, { mode: 0o600 });
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'malls-specs', local ? '--local' : '--remote', '--file', file], {
    stdio: 'inherit',
  });
  console.log(`\nAdmin ready: ${email}${local ? ' (local database)' : ''}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
