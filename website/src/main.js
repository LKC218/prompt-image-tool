import appPackage from "../../package.json";

const images = {
  home: new URL("../../docs/assets/readme/preview-pc.png", import.meta.url)
    .href,
  library: new URL(
    "../../docs/assets/readme/preview-library.png",
    import.meta.url,
  ).href,
  goals: new URL("../../docs/assets/readme/preview-goals.png", import.meta.url)
    .href,
};
const imageTitles = { library: "提示词库界面预览", goals: "目标计划界面预览" };
document.querySelectorAll("[data-image]").forEach((image) => {
  image.src = images[image.dataset.image];
});
document.querySelectorAll("[data-version]").forEach((element) => {
  element.textContent = `v${appPackage.version}`;
});

const pixels = document.querySelector(".pixel-field");
for (let index = 0; index < 34; index += 1) {
  const pixel = document.createElement("i");
  pixel.style.left = `${(index % 9) * 31 + (Math.floor(index / 9) % 2) * 15}px`;
  pixel.style.top = `${Math.floor(index / 9) * 31}px`;
  pixels.append(pixel);
}

const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
const motionButton = document.querySelector(".motion-toggle");
let manuallyPaused = false;
let studio;

function applyMotionPreference() {
  const paused = motionQuery.matches || manuallyPaused;
  document.documentElement.classList.toggle("motion-paused", paused);
  document.documentElement.classList.toggle("js-motion", !paused);
  motionButton.setAttribute("aria-pressed", String(paused));
  motionButton.setAttribute(
    "aria-label",
    paused ? "启用动态效果" : "暂停动态效果",
  );
  // 系统减少动态效果优先，不在用户选择减少动态效果时强行开启动画。
  motionButton.disabled = motionQuery.matches;
  if (motionQuery.matches)
    motionButton.setAttribute("aria-label", "已遵循系统减少动态效果设置");
  studio?.setReducedMotion(paused);
}
motionButton.addEventListener("click", () => {
  manuallyPaused = !manuallyPaused;
  applyMotionPreference();
});
motionQuery.addEventListener("change", applyMotionPreference);
applyMotionPreference();

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.07 },
);
document
  .querySelectorAll(".reveal")
  .forEach((element) => revealObserver.observe(element));

const menuButton = document.querySelector(".menu-toggle");
const mobileNav = document.querySelector(".mobile-nav");
function closeMenu(returnFocus = false) {
  mobileNav.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "展开导航");
  if (returnFocus) menuButton.focus();
}
menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  mobileNav.hidden = !open;
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "收起导航" : "展开导航");
});
mobileNav
  .querySelectorAll("a")
  .forEach((link) => link.addEventListener("click", () => closeMenu()));
document.addEventListener("click", (event) => {
  if (!event.target.closest(".header")) closeMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !mobileNav.hidden) closeMenu(true);
});
matchMedia("(min-width: 761px)").addEventListener("change", (event) => {
  if (event.matches) closeMenu();
});

const dialog = document.querySelector(".preview-dialog");
let previewTrigger;
document.querySelectorAll("[data-preview]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.preview;
    previewTrigger = button;
    dialog.querySelector(".preview-image").src = images[key];
    dialog.querySelector(".preview-image").alt = imageTitles[key];
    dialog.querySelector("h2").textContent = imageTitles[key];
    dialog.showModal();
    document.body.style.overflow = "hidden";
  });
});
dialog
  .querySelector(".preview-close")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
  document.body.style.overflow = "";
  previewTrigger?.focus();
});

let disposed = false;
async function initializeStudio() {
  try {
    const { createStudio } = await import("./studio.js");
    if (disposed) return;
    studio = createStudio(document.querySelector("#studio"), {
      reducedMotion: motionQuery.matches,
    });
    applyMotionPreference();
    document
      .querySelector(".studio-reset")
      .addEventListener("click", () => studio.reset());
    document.querySelector("#studio-hint").textContent =
      "轻轻移动鼠标 · 拖动探索工作室";
  } catch (error) {
    if (disposed) return;
    document.querySelector("#studio-hint").textContent =
      "工作台预览 · 当前设备使用静态展示";
    document.querySelector(".studio-reset").hidden = true;
    console.warn("三维工作室不可用，已切换静态预览。", error);
  }
}
initializeStudio();

function dispose() {
  disposed = true;
  studio?.dispose();
  revealObserver.disconnect();
  motionQuery.removeEventListener("change", applyMotionPreference);
}
window.addEventListener(
  "pagehide",
  (event) => {
    if (!event.persisted) dispose();
  },
  { once: true },
);
if (import.meta.hot) import.meta.hot.dispose(dispose);
