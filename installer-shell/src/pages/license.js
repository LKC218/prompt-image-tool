export function renderLicensePage({ agreed = false } = {}) {
  const checkedAttribute = agreed ? " checked" : "";
  const disabledAttribute = agreed ? "" : " disabled";

  return `
    <section class="book-stage" aria-label="阅读提示词管家许可协议">
      <div class="book-canvas">
        <img class="book-art" src="./assets/installer-license/license-book.webp" alt="" aria-hidden="true" />

        <section class="agreement-panel" aria-labelledby="agreement-title">
          <span class="sparkle agreement-star-one" aria-hidden="true"></span>
          <span class="sparkle agreement-star-two" aria-hidden="true"></span>
          <span class="sparkle agreement-star-three" aria-hidden="true"></span>
          <span class="agreement-heart" aria-hidden="true"></span>

          <h2 id="agreement-title">安装协议</h2>
          <p class="agreement-subtitle">阅读许可协议</p>

          <div class="agreement-divider" aria-hidden="true">
            <span>第 2 页 · 安装协议</span>
          </div>

          <p class="agreement-intro">在安装“提示词管家”之前，请阅读以下许可协议。</p>

          <article class="agreement-box" tabindex="0" aria-label="提示词管家最终用户许可协议正文">
            <h3>提示词管家最终用户许可协议</h3>
            <p class="agreement-date">更新日期：2026 年 5 月 11 日</p>
            <p>
              欢迎使用“提示词管家”软件。请您在安装和使用本软件前，仔细阅读本许可协议。点击同意并继续安装，即表示您已理解并接受本协议的全部条款。
            </p>
            <h4>1. 许可范围</h4>
            <p>
              本软件由提示词管家团队开发和维护，仅授权您在个人或团队内部的合法设备上安装、运行和使用。未经许可，不得对本软件进行反向工程、恶意篡改或用于违法用途。
            </p>
            <h4>2. 数据与隐私</h4>
            <p>
              提示词、分类、标签和本地图片等数据默认保存在您的设备中。请您自行妥善备份重要内容，并确认导入、导出或同步数据时的目标设备可信。
            </p>
            <h4>3. 责任限制</h4>
            <p>
              本软件会持续改进稳定性和兼容性，但不承诺完全避免系统环境、第三方组件或用户操作导致的异常。若安装失败，请根据安装向导提示重新尝试或保留错误信息。
            </p>
            <h4>4. 协议更新</h4>
            <p>
              后续版本可能根据功能变化更新许可内容。继续安装或使用新版软件，表示您接受对应版本的许可协议。
            </p>
          </article>

          <label class="agreement-consent" for="license-agree">
            <input id="license-agree" type="checkbox"${checkedAttribute} />
            <span class="checkbox-visual" aria-hidden="true"></span>
            <span>我已阅读并同意许可协议</span>
          </label>

          <div id="agreement-status" class="sr-only" aria-live="polite">
            ${agreed ? "已同意许可协议，可以继续安装。" : "请勾选同意许可协议后继续。"}
          </div>

          <div class="license-actions" aria-label="安装操作">
            <button id="prev-step" class="secondary" type="button">上一步</button>
            <button id="next-step" class="primary" type="button"${disabledAttribute} aria-describedby="agreement-status">
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
