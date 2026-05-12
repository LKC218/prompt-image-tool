const stageLabels = {
  preparing: {
    percent: 16,
    title: "正在准备安装...",
    path: "正在检查安装目录与安装核心",
    stages: ["active", "waiting", "waiting", "waiting"],
  },
  copying: {
    percent: 58,
    title: "正在写入程序文件...",
    path: "%LOCALAPPDATA%\\PIM-Test\\PromptImageManager.exe",
    stages: ["done", "active", "waiting", "waiting"],
  },
  verifying: {
    percent: 84,
    title: "正在校验安装结果...",
    path: "正在确认主程序与卸载器是否可用",
    stages: ["done", "done", "active", "waiting"],
  },
  finalizing: {
    percent: 94,
    title: "正在执行收尾任务...",
    path: "正在对齐快捷方式与完成页选项",
    stages: ["done", "done", "done", "active"],
  },
  complete: {
    percent: 100,
    title: "正在完成安装...",
    path: "安装结果校验已完成",
    stages: ["done", "done", "done", "done"],
  },
  failed: {
    percent: 86,
    title: "安装遇到问题",
    path: "请保留错误信息后重新尝试",
    stages: ["done", "done", "active", "waiting"],
  },
};

const stageText = {
  done: "已完成",
  active: "进行中",
  waiting: "等待中",
};

function resolveInstallingState(state = {}) {
  const phase = state.phase || "copying";
  const base = stageLabels[phase] || stageLabels.copying;

  return {
    phase,
    percent: state.percent ?? base.percent,
    title: state.title || base.title,
    path: state.path || base.path,
    stages: state.stages || base.stages,
    error: state.error || "",
  };
}

function renderStage(name, status) {
  return `
    <li class="${status}">
      <span class="stage-dot" aria-hidden="true"></span>
      <span>${name}</span>
      <strong>${stageText[status] || "等待中"}</strong>
    </li>
  `;
}

export function renderInstallingPage(state = {}) {
  const installing = resolveInstallingState(state);
  const statusText = installing.error || installing.path;
  const isFailed = installing.phase === "failed";

  return `
    <section class="book-stage" aria-label="提示词管家正在安装">
      <div class="book-canvas">
        <img class="book-art" src="./assets/installer-installing/installing-book.webp" alt="" aria-hidden="true" />

        <section class="installing-panel" aria-labelledby="installing-title">
          <span class="sparkle installing-star-one" aria-hidden="true"></span>
          <span class="sparkle installing-star-two" aria-hidden="true"></span>
          <span class="sparkle installing-star-three" aria-hidden="true"></span>

          <h2 id="installing-title">正在安装</h2>
          <p class="installing-subtitle">程序正在安装到您的设备中，请稍候...</p>

          <div class="installing-step-divider" aria-hidden="true">
            <span>第 6 页 · 正在安装</span>
          </div>

          <div class="install-progress-row">
            <div
              class="install-progress"
              role="progressbar"
              aria-label="安装进度"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow="${installing.percent}"
              style="--install-progress: ${installing.percent}%"
            >
              <span></span>
            </div>
            <strong>${installing.percent}%</strong>
          </div>

          <article class="install-current-action" aria-live="polite">
            <span class="install-file-icon" aria-hidden="true"></span>
            <div>
              <h3>${installing.title}</h3>
              <p>${statusText}</p>
            </div>
          </article>

          <ul class="install-stage-list" aria-label="安装阶段">
            ${renderStage("准备安装", installing.stages[0])}
            ${renderStage("复制文件", installing.stages[1])}
            ${renderStage("校验结果", installing.stages[2])}
            ${renderStage("收尾任务", installing.stages[3])}
          </ul>

          <div class="installing-actions" aria-label="安装操作">
            ${
              isFailed
                ? '<button id="retry-install" class="primary" type="button">重试安装</button><button id="back-to-settings" class="secondary" type="button">修改设置</button>'
                : '<button id="installing-status" class="primary" type="button" disabled>安装中</button><button id="cancel" class="secondary" type="button">取消</button>'
            }
          </div>
        </section>
      </div>
    </section>
  `;
}
