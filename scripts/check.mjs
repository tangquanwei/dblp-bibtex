#!/usr/bin/env node
// Static checks for the extension: manifest shape, file layout, icon signatures, JS syntax.
// Run from the repository root: `npm run check`.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const notes = [];

function file(rel) {
  const path = resolve(root, rel);
  if (!existsSync(path)) {
    errors.push(`missing file: ${rel}`);
    return null;
  }
  return path;
}

function readJson(rel) {
  const path = file(rel);
  if (!path) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    errors.push(`${rel} is not valid JSON: ${err.message}`);
    return null;
  }
}

const required = [
  'manifest.json',
  'sw.js',
  'content.js',
  'popup.html',
  'popup.js',
  'popup.css',
  'icons/16.png',
  'icons/32.png',
  'icons/48.png',
  'icons/128.png',
  'README.md',
  'README.zh.md',
  'LICENSE',
];
required.forEach(file);

const manifest = readJson('manifest.json');
const pkg = readJson('package.json');

if (manifest) {
  if (manifest.manifest_version !== 3) errors.push('manifest_version must be 3');
  if (!manifest.name) errors.push('manifest.name is required');
  if (!manifest.version) errors.push('manifest.version is required');
  if (pkg && manifest.version !== pkg.version) {
    errors.push(`manifest.version (${manifest.version}) !== package.json version (${pkg.version})`);
  }

  const action = manifest.action || {};
  if (action.default_popup !== 'popup.html') errors.push('action.default_popup should be popup.html');
  if (!manifest.background || manifest.background.service_worker !== 'sw.js') {
    errors.push('background.service_worker should be sw.js');
  }

  const scripts = manifest.content_scripts || [];
  const dblpScript = scripts.find((entry) =>
    (entry.matches || []).some((pattern) => pattern.startsWith('https://dblp.org/')),
  );
  if (!dblpScript) errors.push('content_scripts must match https://dblp.org/*');
  if (dblpScript && !(dblpScript.js || []).includes('content.js')) {
    errors.push('content_scripts should inject content.js');
  }

  const hosts = manifest.host_permissions || [];
  if (!hosts.some((pattern) => pattern.startsWith('https://dblp.org/'))) {
    errors.push('host_permissions must include https://dblp.org/*');
  }
  if (hosts.includes('<all_urls>')) errors.push('host_permissions must not include <all_urls>');

  const allowed = new Set(['tabs', 'storage', 'clipboardWrite']);
  for (const permission of manifest.permissions || []) {
    if (!allowed.has(permission)) errors.push(`unexpected permission: ${permission}`);
  }

  for (const [size, rel] of Object.entries(manifest.icons || {})) {
    const path = file(rel);
    if (!path) continue;
    const buf = readFileSync(path);
    const isPng = buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (!isPng) errors.push(`${rel} is not a PNG`);
    if (!Number.isInteger(Number(size))) errors.push(`bad icon size key: ${size}`);
  }
}

const popup = file('popup.html');
if (popup) {
  const html = readFileSync(popup, 'utf8');
  if (!html.includes('popup.js')) errors.push('popup.html does not reference popup.js');
  if (!html.includes('popup.css')) errors.push('popup.html does not reference popup.css');
}

for (const js of ['sw.js', 'content.js', 'popup.js', 'scripts/check.mjs', 'scripts/pack.mjs']) {
  const path = file(js);
  if (!path) continue;
  try {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
  } catch (err) {
    errors.push(`${js} failed syntax check: ${String(err.stderr || err.message).trim()}`);
  }
}

if (!manifest?.content_scripts?.length) notes.push('no content scripts declared');

if (notes.length) for (const note of notes) console.warn(`note: ${note}`);

if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`OK: ${required.length} files checked, manifest v${manifest.version}, ${required.length ? 'no problems' : ''}`.trim());
