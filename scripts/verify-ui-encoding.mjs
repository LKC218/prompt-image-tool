#!/usr/bin/env node
/**
 * Verify UI source encoding hygiene:
 * - no classic UTF-8-as-GBK mojibake markers in src / installer-shell/src
 * - build/installer.nsi starts with UTF-8 BOM when it contains Chinese
 * Usage: node scripts/verify-ui-encoding.mjs
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SRC_DIRS = [path.join(root, 'src'), path.join(root, 'installer-shell', 'src')];
const EXTS = new Set(['.js', '.jsx', '.html', '.css']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

// UTF-8 Chinese mis-decoded as GBK often yields these BMP chars, plus PUA:
// 绺(U+7EAE) 鍙(U+9359) 栨(U+6828) 秷(U+79F7) 畾(U+757E) 鎿(U+93BF)
// 嶄(U+5D84) 綔(U+7D94) 鈥(U+9225) + U+E000–U+F8FF
const MOJIBAKE_CHARS = /[\u7EAE\u9359\u6828\u79F7\u757E\u93BF\u5D84\u7D94\u9225\uE000-\uF8FF]/;

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(name.name)) continue;
    const full = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(full));
    else if (name.isFile() && EXTS.has(path.extname(name.name))) out.push(full);
  }
  return out;
}

const findings = [];
let scanned = 0;

for (const dir of SRC_DIRS) {
  for (const file of walk(dir)) {
    scanned += 1;
    const text = readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (MOJIBAKE_CHARS.test(line)) {
        findings.push({
          file: path.relative(root, file),
          line: index + 1,
          snippet: line.trim().slice(0, 120),
        });
      }
    });
  }
}

const nsiPath = path.join(root, 'build', 'installer.nsi');
let nsiStatus = 'missing';
if (!existsSync(nsiPath)) {
  findings.push({
    file: path.relative(root, nsiPath),
    line: 0,
    snippet: 'build/installer.nsi is missing',
  });
  nsiStatus = 'missing';
} else {
  const buf = readFileSync(nsiPath);
  const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const text = hasBom ? buf.subarray(3).toString('utf8') : buf.toString('utf8');
  const hasChinese = /[一-鿿]/.test(text);
  if (hasChinese && !hasBom) {
    findings.push({
      file: path.relative(root, nsiPath),
      line: 0,
      snippet: 'contains Chinese but missing UTF-8 BOM (NSIS ANSI risk)',
    });
    nsiStatus = 'no-bom-with-chinese';
  } else {
    nsiStatus = hasBom ? 'utf8-bom' : 'ascii-or-no-chinese';
  }
}

if (findings.length > 0) {
  console.error(`[verify-ui-encoding] FAIL findings=${findings.length} scanned_files=${scanned} nsi=${nsiStatus}`);
  for (const item of findings) {
    console.error(`  - ${item.file}:${item.line} ${item.snippet}`);
  }
  process.exit(1);
}

console.log(`[verify-ui-encoding] PASS scanned_files=${scanned} nsi=${nsiStatus}`);
