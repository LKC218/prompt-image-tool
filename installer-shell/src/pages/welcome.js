export function renderWelcomePage() {
  return `
    <section class="book-stage" aria-label="欢迎安装提示词管家">
      <div class="book-canvas">
        <img class="book-art" src="./assets/installer-welcome/welcome-book-mascot.webp" alt="" aria-hidden="true" />

        <section class="welcome-panel" aria-labelledby="welcome-title">
          <span class="sparkle sparkle-one" aria-hidden="true"></span>
          <span class="sparkle sparkle-two" aria-hidden="true"></span>
          <span class="sparkle sparkle-three" aria-hidden="true"></span>

          <p class="welcome-kicker">欢迎安装</p>
          <h2 id="welcome-title">提示词管家</h2>
          <p class="welcome-subtitle">让每一个灵感，都能被更好地记录与使用</p>

          <div class="divider" aria-hidden="true">
            <span></span>
          </div>

          <ul class="feature-list" aria-label="核心功能">
            <li>
              <span class="feature-icon blue" aria-hidden="true">
                <span class="feature-symbol" style="--feature-mask: url('./assets/installer-welcome/feature-manage.png')"></span>
              </span>
              <span class="feature-copy">
                <strong>高效管理</strong>
                <small>分类、标签、收藏，轻松管理你的提示词</small>
              </span>
            </li>
            <li>
              <span class="feature-icon amber" aria-hidden="true">
                <span class="feature-symbol" style="--feature-mask: url('./assets/installer-welcome/feature-quick-access.png')"></span>
              </span>
              <span class="feature-copy">
                <strong>随时调用</strong>
                <small>快速搜索与调用，让创作更高效</small>
              </span>
            </li>
            <li>
              <span class="feature-icon pink" aria-hidden="true">
                <span class="feature-symbol" style="--feature-mask: url('./assets/installer-welcome/feature-secure.png')"></span>
              </span>
              <span class="feature-copy">
                <strong>安全可靠</strong>
                <small>本地数据存储，隐私安全，安心使用</small>
              </span>
            </li>
          </ul>

          <div class="actions" aria-label="安装操作">
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
