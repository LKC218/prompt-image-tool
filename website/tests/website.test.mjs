import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { JSDOM } from "jsdom";

const base = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", base), "utf8");
const dom = new JSDOM(html);
const { document } = dom.window;
const main = await readFile(new URL("src/main.js", base), "utf8");
const studio = await readFile(new URL("src/studio.js", base), "utf8");
const css = await readFile(new URL("src/style.css", base), "utf8");

test("中文语义结构具有唯一标题和完整锚点", () => {
  assert.equal(document.documentElement.lang, "zh-CN");
  assert.equal(document.querySelectorAll("h1").length, 1);
  const ids = [...document.querySelectorAll("[id]")].map(
    (element) => element.id,
  );
  assert.equal(ids.length, new Set(ids).size);
  for (const link of document.querySelectorAll('a[href^="#"]')) {
    assert.ok(
      document.getElementById(link.hash.slice(1)),
      `锚点不存在：${link.hash}`,
    );
  }
});

test("功能与平台边界完整，不虚构生图或云端能力", () => {
  assert.equal(document.querySelectorAll(".feature-card").length, 5);
  assert.equal(document.querySelectorAll(".timeline-item").length, 5);
  assert.equal(document.querySelectorAll("details").length, 5);
  for (const fact of [
    "不直接提供 AI 图片生成服务",
    "不是公网云同步",
    "缩放会改变像素",
    "以发布页可用附件为准",
  ]) {
    assert.ok(
      document.body.textContent.replace(/\s+/g, "").includes(fact.replace(/\s+/g, "")),
      fact,
    );
  }
  assert.match(
    main,
    /import appPackage from ['"]\.\.\/\.\.\/package\.json['"]/,
  );
});

test("下载与项目链接仅使用现有官方仓库", () => {
  const downloads = [...document.querySelectorAll("[data-release-link]")];
  assert.equal(downloads.length, 2);
  downloads.forEach((link) =>
    assert.equal(
      link.href,
      "https://github.com/LKC218/prompt-image-tool/releases/latest",
    ),
  );
  for (const link of document.querySelectorAll('a[target="_blank"]')) {
    assert.match(link.rel, /noopener/);
    assert.match(link.rel, /noreferrer/);
  }
});

test("移动导航、弹窗、原生FAQ保留可访问语义", () => {
  assert.equal(
    document.querySelector(".menu-toggle").getAttribute("aria-controls"),
    "mobile-nav",
  );
  assert.equal(
    document.querySelector(".menu-toggle").getAttribute("aria-expanded"),
    "false",
  );
  assert.ok(document.querySelector(".mobile-nav").hasAttribute("hidden"));
  assert.equal(
    document.querySelector("dialog").getAttribute("aria-labelledby"),
    "preview-title",
  );
  for (const button of document.querySelectorAll("button"))
    assert.ok(button.getAttribute("aria-label") || button.textContent.trim());
  for (const question of document.querySelectorAll("details"))
    assert.ok(question.querySelector("summary"));
});

test("低动效、离屏暂停与三维资源释放均有实现", () => {
  assert.match(css, /prefers-reduced-motion/);
  assert.match(main, /motionQuery\.addEventListener\(['"]change['"]/);
  assert.match(studio, /IntersectionObserver/);
  assert.match(studio, /performance\.now\(\)/);
  assert.match(studio, /renderer\.dispose\(\)/);
  assert.match(studio, /geometry\.dispose\(\)/);
  assert.match(studio, /webglcontextlost/);
});

test("页面不连接业务API，不读写个人数据", () => {
  assert.doesNotMatch(
    main + studio,
    /\bfetch\s*\(|XMLHttpRequest|localStorage|indexedDB/,
  );
  assert.doesNotMatch(html, /<form\b|analytics|googletagmanager/);
});

test("生产构建资源完整且仅包含官网白名单", async () => {
  const built = await readFile(new URL("dist/index.html", base), "utf8");
  const assets = await readdir(new URL("dist/assets/", base));
  const references = [
    ...built.matchAll(/(?:src|href)="\.\/assets\/([^"?#]+)"/g),
  ].map((match) => match[1]);
  assert.ok(references.length >= 3);
  for (const asset of references)
    assert.ok(assets.includes(asset), `构建资源缺失：${asset}`);
  assert.ok(assets.some((name) => name.startsWith("preview-library-")));
  assert.ok(assets.some((name) => name.startsWith("preview-goals-")));
  assert.ok(assets.every((name) => /\.(png|js|css)$/.test(name)));
  assert.doesNotMatch(built, /G:\\|Administrator|python\/data/);
});
