#!/usr/bin/env node
/**
 * Verify dist CSS url(...) targets resolve to real files under dist.
 * Usage: node scripts/verify-dist-assets.mjs [distDir]
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.resolve(root, process.argv[2] || 'dist');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(full));
    else if (name.isFile() && name.name.endsWith('.css')) out.push(full);
  }
  return out;
}

function stripQuotes(value) {
  let v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

function decodeUrl(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function isRemote(raw) {
  return /^(https?:)?\/\//i.test(raw) || /^(data|blob|mailto|tel):/i.test(raw);
}

function stripQueryHash(url) {
  return url.split('#')[0].split('?')[0];
}

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  console.error(`[verify-dist-assets] dist directory not found: ${distDir}`);
  process.exit(1);
}

const cssFiles = walk(distDir);
let ok = 0;
const missing = [];

for (const cssFile of cssFiles) {
  const text = readFileSync(cssFile, 'utf8');
  // Match url(...), allow quoted values that may contain ")" via non-greedy quoted branch
  const urlRe = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]+))\s*\)/g;
  let match;
  while ((match = urlRe.exec(text)) !== null) {
    const raw = stripQuotes(match[1] ?? match[2] ?? match[3] ?? '');
    if (!raw || raw.startsWith('#')) continue;
    if (isRemote(raw)) continue;
    const decoded = stripQueryHash(decodeUrl(raw));
    if (!decoded) continue;
    let target;
    if (decoded.startsWith('/')) {
      target = path.join(distDir, decoded.replace(/^\/+/, ''));
    } else {
      target = path.resolve(path.dirname(cssFile), decoded);
    }
    if (existsSync(target)) {
      ok += 1;
    } else {
      missing.push({ css: path.relative(distDir, cssFile), url: raw, target });
    }
  }
}

if (missing.length > 0) {
  console.error(`[verify-dist-assets] FAIL missing ${missing.length} asset(s), ok=${ok}`);
  for (const item of missing) {
    console.error(`  - ${item.css} -> ${item.url}`);
  }
  process.exit(1);
}

console.log(`[verify-dist-assets] PASS css=${cssFiles.length} resolved_urls=${ok}`);
