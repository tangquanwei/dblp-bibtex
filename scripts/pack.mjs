#!/usr/bin/env node
// Build dist/dblp-bibtex-<version>.zip from the runtime files.
// Run from the repository root: `npm run pack`.

import { mkdirSync, rmSync, existsSync, statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
const dist = resolve(root, 'dist');
const output = resolve(dist, `dblp-bibtex-${manifest.version}.zip`);

mkdirSync(dist, { recursive: true });
rmSync(output, { force: true });

const files = [
  'manifest.json',
  'sw.js',
  'content.js',
  'popup.html',
  'popup.js',
  'popup.css',
  'icons',
  'README.md',
  'LICENSE',
];

try {
  execFileSync('zip', ['-r', '-X', output, ...files, '-x', '*.DS_Store'], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
} catch (err) {
  console.error('Could not run `zip`. Install it (macOS/Linux usually ship it) and retry.');
  console.error(String(err.stderr || err.message).trim());
  process.exit(1);
}

if (!existsSync(output)) {
  console.error('zip produced no output');
  process.exit(1);
}

const kib = (statSync(output).size / 1024).toFixed(1);
console.log(`packed ${output} (${kib} KiB)`);
