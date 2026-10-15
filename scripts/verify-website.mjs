import assert from "node:assert/strict";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

// 本脚本只验收构建产物、静态HTTP入口与文档，不把静态检查冒充浏览器验收。
const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const websiteRoot = path.join(projectRoot, "website");
const output = path.join(projectRoot, "output", "website");
const report = {
  type: "官网静态与HTTP验收",
  checkedAt: new Date().toISOString(),
  checks: [],
  browserValidation: "不在本脚本范围内",
};
function record(name, result) {
  assert.ok(result, name);
  report.checks.push({ name, passed: true });
}
const built = await readFile(
  path.join(websiteRoot, "dist", "index.html"),
  "utf8",
);
const document = new JSDOM(built).window.document;
record("唯一页面标题", document.querySelectorAll("h1").length === 1);
record(
  "五个功能展示和五个流程说明",
  document.querySelectorAll(".feature-card").length === 5 &&
    document.querySelectorAll(".timeline-item").length === 5,
);
for (const link of document.querySelectorAll('a[href^="#"]'))
  record(
    `页内链接 ${link.hash}`,
    Boolean(document.getElementById(link.hash.slice(1))),
  );
const files = await readdir(path.join(websiteRoot, "dist", "assets"));
record(
  "构建不包含后端或私有资料",
  files.every((name) =>
    /^(index|studio|logo|preview-pc|preview-library|preview-goals)-[\w-]+\.(js|css|png)$/.test(
      name,
    ),
  ),
);
for (const file of ["README.md", ".gitignore"])
  record(
    `官网文档 ${file}`,
    (await readFile(path.join(websiteRoot, file), "utf8")).length > 50,
  );
record(
  "就近模块说明",
  (
    await readFile(
      path.join(projectRoot, "docs", "模块说明", "产品官网模块.md"),
      "utf8",
    )
  ).includes("website/"),
);
if (process.argv.includes("--http")) {
  const requestedUrl = process.env.WEBSITE_TEST_URL || "http://127.0.0.1:5180/";
  const url = new URL(requestedUrl);
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname),
    "只允许检查本机预览服务",
  );
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  record(
    "官网HTTP入口",
    response.ok && (await response.text()).includes("让灵感自由生长"),
  );
}
await mkdir(output, { recursive: true });
await writeFile(
  path.join(output, "静态验收.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
console.log(
  `通过 ${report.checks.length} 项静态检查；报告：output/website/静态验收.json。浏览器交互与视觉需单独验证。`,
);
