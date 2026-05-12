function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderCompletePage({
  launchAfterInstall = true,
  desktopShortcut = true,
  startMenuShortcut = true,
  installPath = "",
  resolvedPath = "",
  appliedTasks = {},
  status = "",
  finishing = false,
} = {}) {
  const launchChecked = launchAfterInstall ? " checked" : "";
  const shortcutChecked = desktopShortcut ? " checked" : "";
  const startMenuChecked = startMenuShortcut ? " checked" : "";
  const displayPath = escapeHtml(resolvedPath || installPath || "安装目录已校验");
  const statusText = escapeHtml(status || "");
  const finishState = finishing ? ' disabled data-state="working"' : "";

  return `
    <section class="book-stage" aria-label="提示词管家安装完成">
      <div class="book-canvas">
        <img class="book-art" src="./assets/installer-complete/complete-book.webp" alt="" aria-hidden="true" />

        <section class="complete-panel" aria-labelledby="complete-title">
          <span class="sparkle complete-star-one" aria-hidden="true"></span>
          <span class="sparkle complete-star-two" aria-hidden="true"></span>
          <span class="complete-heart" aria-hidden="true"></span>

          <h2 id="complete-title">安装完成</h2>

          <div class="complete-divider" aria-hidden="true">
            <span></span>
          </div>

          <div class="complete-check" aria-hidden="true">
            <span></span>
          </div>

          <p class="complete-result">提示词管家已成功安装到你的电脑</p>
          <p class="complete-subtitle" title="${displayPath}">安装目录：${displayPath}</p>

          <div class="complete-options" aria-label="安装完成后操作">
            <label class="complete-option">
              <span class="complete-option-icon launch" aria-hidden="true">
                <img src="./assets/installer-welcome/app-icon.png" alt="" aria-hidden="true" />
              </span>
              <span class="complete-option-copy">
                <strong>立即启动软件</strong>
                <small>体验智能提示词管理的高效与便捷</small>
              </span>
              <input class="complete-toggle-input sr-only" type="checkbox" data-complete-option="launchAfterInstall"${launchChecked} />
              <span class="complete-switch" aria-hidden="true"></span>
            </label>

            <label class="complete-option">
              <span class="complete-option-icon desktop" aria-hidden="true"></span>
              <span class="complete-option-copy">
                <strong>创建桌面快捷方式</strong>
                <small>${appliedTasks.desktopShortcut === false ? "完成时将移除桌面快捷方式" : "在桌面快速打开提示词管家"}</small>
              </span>
              <input class="complete-toggle-input sr-only" type="checkbox" data-complete-option="desktopShortcut"${shortcutChecked} />
              <span class="complete-switch" aria-hidden="true"></span>
            </label>

            <label class="complete-option">
              <span class="complete-option-icon start-menu" aria-hidden="true"></span>
              <span class="complete-option-copy">
                <strong>保留开始菜单入口</strong>
                <small>${appliedTasks.startMenuShortcut === false ? "完成时将移除开始菜单入口" : "包含启动与卸载快捷方式"}</small>
              </span>
              <input class="complete-toggle-input sr-only" type="checkbox" data-complete-option="startMenuShortcut"${startMenuChecked} />
              <span class="complete-switch" aria-hidden="true"></span>
            </label>
          </div>

          <p id="complete-status" class="complete-status" aria-live="polite">${statusText}</p>

          <div class="complete-actions" aria-label="安装操作">
            <button id="finish-install" class="primary" type="button"${finishState}>
              <span>完成</span>
              <span class="finish-icon" aria-hidden="true"></span>
            </button>
          </div>
        </section>
      </div>
    </section>
  `;
}
