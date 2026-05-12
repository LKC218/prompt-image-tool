function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderTaskState(enabled) {
  return enabled ? "将执行" : "不执行";
}

export function renderPrepareInstallPage({
  installPath = "%LOCALAPPDATA%\\PIM-Test",
  resolvedPath = "",
  validationMessage = "安装目录已准备好。",
  installerStatus = "安装核心将在开始安装时自动校验。",
  tasks = {},
} = {}) {
  const displayPath = escapeHtml(resolvedPath || installPath);
  const message = escapeHtml(validationMessage);
  const status = escapeHtml(installerStatus);

  return `
    <section class="book-stage" aria-label="确认提示词管家安装设置">
      <div class="book-canvas">
        <img class="book-art" src="./assets/installer-tasks/tasks-book.webp" alt="" aria-hidden="true" />

        <section class="prepare-panel" aria-labelledby="prepare-title">
          <span class="sparkle prepare-star-one" aria-hidden="true"></span>
          <span class="sparkle prepare-star-two" aria-hidden="true"></span>
          <span class="sparkle prepare-star-three" aria-hidden="true"></span>

          <h2 id="prepare-title">
            <span>准备</span><strong>开始安装</strong>
          </h2>
          <p class="prepare-subtitle">请确认以下设置，安装只会在点击开始后执行</p>

          <div class="prepare-step-divider" aria-hidden="true">
            <span>第 5 页 · 准备安装</span>
          </div>

          <article class="prepare-summary" aria-label="安装摘要">
            <div class="prepare-path-card">
              <span class="prepare-icon path" aria-hidden="true"></span>
              <div>
                <strong>安装目录</strong>
                <small title="${displayPath}">${displayPath}</small>
              </div>
            </div>

            <p class="prepare-message" aria-live="polite">${message}</p>
            <p class="prepare-installer">${status}</p>

            <ul class="prepare-task-list" aria-label="即将执行的附加任务">
              <li>
                <span class="prepare-icon desktop" aria-hidden="true"></span>
                <span>桌面快捷方式</span>
                <strong>${renderTaskState(tasks.desktopShortcut)}</strong>
              </li>
              <li>
                <span class="prepare-icon start-menu" aria-hidden="true"></span>
                <span>开始菜单快捷方式</span>
                <strong>${renderTaskState(tasks.startMenuShortcut)}</strong>
              </li>
              <li>
                <span class="prepare-icon update" aria-hidden="true"></span>
                <span>应用内更新提醒</span>
                <strong>${renderTaskState(tasks.autoCheckUpdates)}</strong>
              </li>
            </ul>
          </article>

          <div class="prepare-actions" aria-label="安装操作">
            <button id="prev-step" class="secondary" type="button">上一步</button>
            <button id="next-step" class="primary" type="button">
              <span>开始安装</span>
              <span class="arrow" aria-hidden="true"></span>
            </button>
            <button id="cancel" class="secondary" type="button">取消</button>
          </div>
        </section>
      </div>
    </section>
  `;
}
