const taskDefinitions = [
  {
    key: "desktopShortcut",
    title: "创建桌面快捷方式",
    description: "在桌面创建快捷方式，快速打开应用",
    icon: "desktop",
  },
  {
    key: "startMenuShortcut",
    title: "添加到开始菜单",
    description: "在开始菜单中创建应用程序快捷方式",
    icon: "start-menu",
  },
  {
    key: "autoCheckUpdates",
    title: "安装后开启更新提醒",
    description: "保留为应用内提醒，不写入系统开机任务",
    icon: "update",
  },
];

function checkedAttribute(value) {
  return value ? " checked" : "";
}

function renderTaskOption(task, tasks) {
  return `
    <label class="task-option">
      <input
        class="task-checkbox sr-only"
        type="checkbox"
        data-task-key="${task.key}"
        ${checkedAttribute(tasks[task.key])}
      />
      <span class="task-checkbox-visual" aria-hidden="true"></span>
      <span class="task-icon ${task.icon}" aria-hidden="true"></span>
      <span class="task-copy">
        <strong>${task.title}</strong>
        <small>${task.description}</small>
      </span>
    </label>
  `;
}

export function renderInstallTasksPage({
  desktopShortcut = true,
  startMenuShortcut = true,
  autoCheckUpdates = false,
} = {}) {
  const tasks = {
    desktopShortcut,
    startMenuShortcut,
    autoCheckUpdates,
  };

  return `
    <section class="book-stage" aria-label="选择提示词管家附加任务">
      <div class="book-canvas">
        <img class="book-art" src="./assets/installer-tasks/tasks-book.webp" alt="" aria-hidden="true" />

        <section class="install-tasks-panel" aria-labelledby="install-tasks-title">
          <span class="sparkle tasks-star-one" aria-hidden="true"></span>
          <span class="sparkle tasks-star-two" aria-hidden="true"></span>
          <span class="sparkle tasks-star-three" aria-hidden="true"></span>

          <h2 id="install-tasks-title">
            <span>安装选项</span><strong>附加任务</strong>
          </h2>
          <p class="tasks-subtitle">选择您希望在安装过程中执行的附加任务</p>

          <div class="tasks-step-divider" aria-hidden="true">
            <span>第 4 页 · 安装选项</span>
          </div>

          <div class="task-list" aria-label="附加任务">
            ${taskDefinitions.map((task) => renderTaskOption(task, tasks)).join("")}
          </div>

          <article class="tasks-summary" aria-label="安装摘要">
            <img src="./assets/installer-welcome/app-icon.png" alt="" aria-hidden="true" />
            <div>
              <strong>提示词管家</strong>
              <small>你的灵感，你的提示词，都在你手中</small>
            </div>
            <dl>
              <dt>安装大小</dt>
              <dd>128 MB</dd>
            </dl>
            <span class="summary-ring" aria-hidden="true"></span>
          </article>

          <div class="tasks-actions" aria-label="安装操作">
            <button id="prev-step" class="secondary" type="button">上一步</button>
            <button id="next-step" class="primary" type="button">
              <span>下一步</span>
              <span class="arrow" aria-hidden="true"></span>
            </button>
            <button id="cancel" class="secondary" type="button">取消</button>
          </div>
        </section>
      </div>
    </section>
  `;
}
