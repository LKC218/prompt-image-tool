function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderInstallLocationPage({
  installPath = "%USERPROFILE%\\Downloads\\PIM-Test",
  resolvedPath = "",
  validationMessage = "默认安装到下载目录；也可以点击浏览选择本地位置。",
  validationState = "idle",
  availableSpace = "将自动校验",
} = {}) {
  const escapedInstallPath = escapeAttribute(installPath);
  const escapedMessage = escapeAttribute(validationMessage);
  const escapedResolvedPath = escapeAttribute(resolvedPath || "继续前展开");
  const escapedAvailableSpace = escapeAttribute(availableSpace);

  return `
    <section class="book-stage" aria-label="选择提示词管家安装位置">
      <div class="book-canvas">
        <img class="book-art" src="./assets/installer-location/location-book.webp" alt="" aria-hidden="true" />

        <section class="install-location-panel" aria-labelledby="install-location-title">
          <span class="sparkle location-star-one" aria-hidden="true"></span>
          <span class="sparkle location-star-two" aria-hidden="true"></span>
          <span class="sparkle location-star-three" aria-hidden="true"></span>

          <h2 id="install-location-title">
            <span>选择</span><strong>安装位置</strong>
          </h2>
          <p class="location-subtitle">默认位置在下载目录，可浏览选择本地文件夹</p>

          <div class="location-step-divider" aria-hidden="true">
            <span>第 3 页 · 安装位置</span>
          </div>

          <div class="install-path-card">
            <span class="location-icon folder" aria-hidden="true"></span>
            <label class="sr-only" for="install-path">安装路径</label>
            <input id="install-path" type="text" value="${escapedInstallPath}" autocomplete="off" spellcheck="false" />
            <button id="browse-install-path" class="browse-button" type="button">浏览</button>
          </div>

          <dl class="space-row" aria-label="磁盘空间信息">
            <div>
              <span class="location-icon hard-drive" aria-hidden="true"></span>
              <dt>实际路径：</dt>
              <dd title="${escapedResolvedPath}">${escapedResolvedPath}</dd>
            </div>
            <div>
              <dt>所需空间：</dt>
              <dd>${escapedAvailableSpace}</dd>
            </div>
          </dl>

          <p id="location-status" class="install-tip ${validationState}" aria-live="polite">
            <span class="location-icon lightbulb" aria-hidden="true"></span>
            <span>${escapedMessage}</span>
          </p>

          <div class="location-actions" aria-label="安装操作">
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
