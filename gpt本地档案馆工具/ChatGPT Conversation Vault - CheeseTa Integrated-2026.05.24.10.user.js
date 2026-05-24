// ==UserScript==
// @name         ChatGPT Conversation Vault - CheeseTa Integrated
// @namespace    https://chatgpt.com/
// @version      2026.05.24.01
// @description  ChatGPT local conversation vault: auto/manual save, JSON/Markdown/HTML/ZIP export, import, project snapshots, search, and continuation context.
// @author       CheeseTa
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @license      MIT
// @run-at       document-start
// @downloadURL https://update.greasyfork.org/scripts/577938/ChatGPT%20Conversation%20Vault%20-%20CheeseTa%20Integrated.user.js
// @updateURL https://update.greasyfork.org/scripts/577938/ChatGPT%20Conversation%20Vault%20-%20CheeseTa%20Integrated.meta.js
// ==/UserScript==

(function () {
  'use strict';

  // 阅读导航：
  // 1. APP/TXT/ICONS/DEFAULT_SETTINGS/state 是全局配置和运行状态。
  // 2. UI 区负责右下角按钮、弹窗面板、按钮点击和本地历史列表。
  // 3. Storage 区负责把对话保存到脚本存储或 IndexedDB。
  // 4. ChatGPT API 区负责拿 Access Token、读取官方历史和项目对话。
  // 5. Save / backup workflows 区负责保存、导出 ZIP、导出 prompt-image-tool JSON。
  // 6. Import 区负责导入 JSON/Markdown/HTML/ZIP。
  // 7. Normalization and rendering 区负责把 ChatGPT 原始数据整理成人能读的格式。
  // 8. Auto save、ZIP、Small utilities 是自动保存、压缩包和小工具函数。

  // APP：程序级常量。想改保存上限、自动保存间隔、图片数量限制，优先看这里。
  const APP = {
    name: 'ChatGPT Conversation Vault - CheeseTa',
    author: 'CheeseTa',
    updatedAt: '2026-05-24',
    dbName: 'ct_chatgpt_conversation_vault',
    dbVersion: 1,
    storagePrefix: 'ctVault:',
    rootId: 'ct-vault-root',
    buttonId: 'ct-vault-button',
    panelId: 'ct-vault-panel',
    pageLimit: 100,
    baseDelay: 180,
    jitter: 120,
    maxNameLength: 90,
    autoSaveDelay: 2600,
    routeCheckInterval: 1300,
    currentSaveMinInterval: 12000,
    currentExportImageLimit: 30,
    promptImageToolJsonImageLimit: 10,
    promptImageToolJsonMaxImageBytes: 4 * 1024 * 1024,
  };

  // TXT：所有界面文案集中放这里，方便以后统一改按钮文字和提示语。
  const TXT = {
    button: '档案馆',
    title: 'ChatGPT 本地档案馆',
    subtitle: 'By CheeseTa',
    saveCurrent: '保存当前',
    exportCurrent: '导出当前',
    exportPromptJson: '导出提示词JSON',
    backupRemote: '备份官方历史',
    exportLocal: '导出本地库',
    importFiles: '导入文件',
    search: '搜索标题 / 正文 / 项目 / 账号',
    autoSave: '自动保存',
    includeProjects: '包含项目',
    includeArchived: '包含归档',
    recentRoot: '最近根对话',
    allRoot: '全部根对话',
    accountLabel: '账号标签',
    ready: '准备就绪',
    saving: '保存中',
    saved: '已保存',
    failed: '失败',
    tokenFail: '无法获取 Access Token。请刷新页面，或打开任意一个对话后再试。',
    noCurrent: '当前页面没有检测到对话 ID。',
    noRecords: '本地档案库还没有记录。',
    clearLocal: '清空',
  };

  // ICONS：按钮里用到的小图标，都是内联 SVG 字符串，不依赖外部图片文件。
  const ICONS = {
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42l2.3 2.3V4a1 1 0 0 1 1-1z"></path><path d="M5 17a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z"></path></svg>',
    wechat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.3 5C5.8 5 3 7.2 3 10c0 1.6.9 3 2.4 3.9l-.6 1.8 2.1-1.1c.7.2 1.5.4 2.4.4 3.5 0 6.3-2.2 6.3-5S12.8 5 9.3 5zm-2.1 3.8a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6zm4.1 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6z"></path><path d="M21 13.1c0-2.5-2.5-4.5-5.5-4.7.3.6.4 1.1.4 1.8 0 3.1-3 5.6-6.8 5.6h-.6c1 1.1 2.7 1.8 4.6 1.8.7 0 1.4-.1 2-.3l1.8.9-.5-1.5c1.4-.8 2.6-2.1 2.6-3.6zm-7.3-1a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4zm3.7 0a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4z"></path></svg>',
    spinner: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none" opacity="0.25"></circle><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"></path></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2l-3.5-3.5L4 14.2 9 19l11-11-1.5-1.5z"></path></svg>',
    error: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 21h22L12 2 1 21zm12-3h-2v2h2v-2zm0-8h-2v6h2v-6z"></path></svg>',
  };

  // DEFAULT_SETTINGS：第一次安装脚本时使用的默认设置。
  const DEFAULT_SETTINGS = {
    autoSave: true,
    includeProjects: true,
    includeArchived: true,
    accountLabel: '默认账号',
    remoteRootMode: 'recent',
    remoteRootLimit: 20,
  };

  // state：脚本运行时的临时状态。刷新页面后这里会重置，真正持久化的数据在 Storage 区。
  const state = {
    accessToken: null,
    capturedWorkspaceIds: new Set(),
    booted: false,
    ui: null,
    db: null,
    settings: { ...DEFAULT_SETTINGS },
    panelOpen: false,
    searchKeyword: '',
    routeTimer: null,
    observer: null,
    lastUrl: location.href,
    saveStateById: new Map(),
  };

  boot();

  // boot：脚本入口。按顺序安装网络拦截、渲染按钮、初始化存储、加载设置并启动自动保存。
  async function boot() {
    installNetworkInterceptors();
    bootButton();
    await initStorage();
    await loadSettings();
    startAutoSaveWatchers();
    setTimeout(() => scheduleAutoSave('initial'), 3000);
  }

  /*************************************************************************
   * UI
   *************************************************************************/

  // bootButton：ChatGPT 页面加载很动态，所以这里会反复尝试把“档案馆”按钮挂到页面右下角。
  function bootButton() {
    if (state.booted) return;
    let attempts = 0;
    let timer = null;
    let observer = null;
    const cleanup = () => {
      if (timer) clearInterval(timer);
      if (observer) observer.disconnect();
    };
    const tryBoot = () => {
      attempts++;
      if (renderButton()) {
        state.booted = true;
        cleanup();
        return true;
      }
      if (attempts >= 160) cleanup();
      return false;
    };
    timer = setInterval(tryBoot, 400);
    if (typeof MutationObserver !== 'undefined' && document.documentElement) {
      observer = new MutationObserver(tryBoot);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryBoot, { once: true });
    }
    window.addEventListener('load', tryBoot, { once: true });
    tryBoot();
  }

  // renderButton：创建 Shadow DOM。这样脚本自己的样式不会轻易被 ChatGPT 页面样式污染。
  function renderButton() {
    try {
      if (!document || !document.documentElement) return false;
      let host = document.getElementById(APP.rootId);
      if (!host) {
        host = document.createElement('div');
        host.id = APP.rootId;
        host.style.cssText = [
          'position:fixed!important',
          'right:22px!important',
          'bottom:22px!important',
          'z-index:2147483647!important',
          'pointer-events:auto!important',
        ].join(';');
        (document.body || document.documentElement).appendChild(host);
      }
      const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
      if (!shadow.getElementById(APP.buttonId)) {
        shadow.innerHTML = getUiMarkup();
        shadow.getElementById(APP.buttonId).addEventListener('click', togglePanel);
        shadow.addEventListener('click', handlePanelClick);
        shadow.addEventListener('input', handlePanelInput);
        shadow.addEventListener('change', handlePanelInput);
      }
      state.ui = {
        host,
        shadow,
        button: shadow.getElementById(APP.buttonId),
        icon: shadow.getElementById('ct-vault-btn-icon'),
        label: shadow.getElementById('ct-vault-btn-label'),
      };
      return true;
    } catch (error) {
      console.warn(`[${APP.name}] render failed`, error);
      return false;
    }
  }

  // getUiMarkup：返回完整的面板 HTML 和 CSS。界面布局、按钮、输入框都在这个模板里。
  function getUiMarkup() {
    return `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; }
        button, input, select { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important; }
        .sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0,0,0,0) !important; white-space: nowrap !important; border: 0 !important; }
        .vault-btn {
          --prog: 0%;
          appearance: none !important;
          border: 1px solid rgba(255,255,255,.32) !important;
          border-radius: 16px !important;
          min-width: 122px !important;
          height: 48px !important;
          padding: 0 14px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          color: #fff !important;
          font: 760 13px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
          letter-spacing: 0 !important;
          cursor: pointer !important;
          background: linear-gradient(90deg, #0f766e 0%, #0f766e var(--prog), #1d4ed8 var(--prog), #111827 100%) !important;
          box-shadow: 0 18px 42px rgba(15,23,42,.22), 0 8px 18px rgba(15,118,110,.18) !important;
          transition: transform .18s ease, filter .18s ease, box-shadow .18s ease !important;
          user-select: none !important;
        }
        .vault-btn:hover { transform: translateY(-2px) !important; filter: saturate(1.05) !important; box-shadow: 0 22px 48px rgba(15,23,42,.26), 0 10px 22px rgba(15,118,110,.22) !important; }
        .vault-btn:disabled { opacity: .9 !important; cursor: default !important; transform: none !important; }
        .vault-icon { width: 26px !important; height: 26px !important; border-radius: 8px !important; background: rgba(255,255,255,.16) !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; flex: 0 0 auto !important; }
        .vault-icon svg { width: 18px !important; height: 18px !important; fill: currentColor !important; }
        .vault-btn.is-loading .vault-icon svg { animation: ct-spin .9s linear infinite !important; }
        .vault-label { font-variant-numeric: tabular-nums !important; white-space: nowrap !important; }
        .panel { position: fixed !important; right: 22px !important; bottom: 84px !important; width: 460px !important; max-width: calc(100vw - 32px) !important; height: min(780px, calc(100vh - 112px)) !important; display: none !important; flex-direction: column !important; color: #111827 !important; background: #ffffff !important; border: 1px solid rgba(15,23,42,.10) !important; border-radius: 16px !important; box-shadow: 0 28px 72px rgba(15,23,42,.24) !important; overflow: hidden !important; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important; }
        .panel.open { display: flex !important; }
        .head { padding: 17px 17px 15px !important; color: #fff !important; background: linear-gradient(135deg, #111827 0%, #0f766e 54%, #1d4ed8 100%) !important; display: flex !important; justify-content: space-between !important; gap: 14px !important; align-items: flex-start !important; }
        .brand { display: flex !important; gap: 11px !important; min-width: 0 !important; align-items: flex-start !important; }
        .mark { width: 38px !important; height: 38px !important; border-radius: 11px !important; background: rgba(255,255,255,.15) !important; border: 1px solid rgba(255,255,255,.22) !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; flex: 0 0 auto !important; }
        .mark svg { width: 20px !important; height: 20px !important; fill: currentColor !important; }
        .head h2 { margin: 0 !important; font-size: 17px !important; line-height: 1.25 !important; font-weight: 780 !important; color: #fff !important; letter-spacing: 0 !important; }
        .head p { margin: 0 !important; color: rgba(255,255,255,.78) !important; font-size: 12px !important; line-height: 1.45 !important; }
        .x { width: 30px !important; height: 30px !important; border-radius: 10px !important; border: 1px solid rgba(255,255,255,.24) !important; background: rgba(255,255,255,.12) !important; color: #fff !important; cursor: pointer !important; font-size: 18px !important; line-height: 1 !important; flex: 0 0 auto !important; }
        .body { padding: 14px !important; overflow: auto !important; flex: 1 !important; background: #f8fafc !important; }
        .surface { background: #fff !important; border: 1px solid #e5e7eb !important; border-radius: 12px !important; padding: 12px !important; margin-bottom: 10px !important; }
        .row { display: flex !important; gap: 8px !important; margin-bottom: 8px !important; align-items: center !important; }
        .row:last-child { margin-bottom: 0 !important; }
        .grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
        .btn { border: 1px solid #d1d5db !important; background: #fff !important; color: #111827 !important; border-radius: 8px !important; min-height: 38px !important; padding: 8px 10px !important; cursor: pointer !important; font-size: 12px !important; font-weight: 740 !important; white-space: nowrap !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 7px !important; }
        .btn:hover { border-color: #94a3b8 !important; background: #f8fafc !important; }
        .btn.primary { background: #111827 !important; color: #fff !important; border-color: #111827 !important; box-shadow: 0 8px 18px rgba(15,23,42,.18) !important; }
        .btn.warn { background: #f0fdfa !important; color: #0f766e !important; border-color: #99f6e4 !important; }
        .btn.icon-btn { min-width: 38px !important; padding: 8px !important; }
        .btn svg { width: 15px !important; height: 15px !important; fill: currentColor !important; flex: 0 0 auto !important; }
        .input, .select { width: 100% !important; min-height: 38px !important; border: 1px solid #d1d5db !important; border-radius: 8px !important; background: #fff !important; color: #111827 !important; padding: 8px 10px !important; font-size: 12px !important; outline: none !important; }
        .input:focus, .select:focus { border-color: #0f766e !important; box-shadow: 0 0 0 3px rgba(15,118,110,.12) !important; }
        .toggle-strip { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 6px !important; }
        .toggle { min-height: 34px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; gap: 6px !important; color: #374151 !important; font-size: 12px !important; white-space: nowrap !important; border: 1px solid #e5e7eb !important; border-radius: 8px !important; background: #fff !important; padding: 0 8px !important; }
        .toggle input { accent-color: #0f766e !important; }
        .status { min-height: 20px !important; margin: 9px 0 0 !important; color: #475569 !important; font-size: 12px !important; line-height: 1.45 !important; padding: 8px 10px !important; border: 1px solid #e5e7eb !important; border-radius: 8px !important; background: #fff !important; }
        .section-title { margin: 2px 0 9px !important; color: #334155 !important; font-size: 12px !important; font-weight: 780 !important; display: flex !important; align-items: center !important; justify-content: space-between !important; }
        .section-title span { color: #64748b !important; font-weight: 650 !important; }
        .clear-btn { border: 1px solid #fecdd3 !important; border-radius: 7px !important; background: #fff1f2 !important; color: #be123c !important; padding: 4px 8px !important; cursor: pointer !important; font-size: 11px !important; font-weight: 740 !important; }
        .clear-btn:hover { background: #ffe4e6 !important; border-color: #fda4af !important; }
        .list { display: flex !important; flex-direction: column !important; gap: 8px !important; }
        .card { border: 1px solid #e5e7eb !important; border-radius: 10px !important; padding: 11px !important; background: #fff !important; box-shadow: 0 1px 2px rgba(15,23,42,.04) !important; }
        .card-title { font-size: 13px !important; font-weight: 780 !important; color: #111827 !important; line-height: 1.35 !important; margin-bottom: 5px !important; word-break: break-word !important; }
        .card-meta { font-size: 11px !important; color: #64748b !important; line-height: 1.45 !important; margin-bottom: 9px !important; }
        .actions { display: flex !important; flex-wrap: wrap !important; gap: 6px !important; }
        .mini { border: 1px solid #e5e7eb !important; border-radius: 7px !important; background: #f8fafc !important; color: #111827 !important; padding: 5px 7px !important; cursor: pointer !important; font-size: 11px !important; }
        .mini:hover { border-color: #cbd5e1 !important; background: #fff !important; }
        .file-input { display: none !important; }
        @media (max-width: 520px) {
          .panel { right: 12px !important; bottom: 76px !important; max-width: calc(100vw - 24px) !important; }
          .grid { grid-template-columns: 1fr !important; }
          .toggle-strip { grid-template-columns: 1fr !important; }
        }
        @keyframes ct-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      </style>
      <button id="${APP.buttonId}" class="vault-btn" type="button" title="${TXT.title}">
        <span id="ct-vault-btn-icon" class="vault-icon">${ICONS.download}</span>
        <span id="ct-vault-btn-label" class="vault-label">${TXT.button}</span>
      </button>
      <section id="${APP.panelId}" class="panel" aria-label="${TXT.title}">
        <div class="head">
          <div class="brand">
            <span class="mark">${ICONS.download}</span>
            <div>
              <h2>${TXT.title}</h2>
            </div>
          </div>
          <button class="x" data-action="close" type="button" title="关闭">&times;</button>
        </div>
        <div class="body">
          <div class="surface">
            <div class="grid">
              <button class="btn primary" data-action="save-current" type="button">${TXT.saveCurrent}</button>
              <button class="btn" data-action="export-current-zip" type="button">${TXT.exportCurrent}</button>
              <button class="btn" data-action="export-prompt-image-tool-json" type="button">${TXT.exportPromptJson}</button>
              <button class="btn warn" data-action="backup-remote" type="button">${TXT.backupRemote}</button>
              <button class="btn" data-action="export-local-zip" type="button">${TXT.exportLocal}</button>
            </div>
          </div>
          <div class="surface">
            <div class="row">
              <button class="btn" data-action="import-files" type="button">${TXT.importFiles}</button>
              <input class="input" data-setting="accountLabel" placeholder="${TXT.accountLabel}">
            </div>
            <div class="toggle-strip">
              <label class="toggle"><input data-setting="autoSave" type="checkbox"> ${TXT.autoSave}</label>
              <label class="toggle"><input data-setting="includeProjects" type="checkbox"> ${TXT.includeProjects}</label>
              <label class="toggle"><input data-setting="includeArchived" type="checkbox"> ${TXT.includeArchived}</label>
            </div>
          </div>
          <div class="surface">
            <div class="row">
              <select class="select" data-setting="remoteRootMode">
                <option value="recent">${TXT.recentRoot}</option>
                <option value="all">${TXT.allRoot}</option>
              </select>
              <input class="input" data-setting="remoteRootLimit" type="number" min="1" max="9999" value="20">
            </div>
            <input class="input" data-action="search" placeholder="${TXT.search}">
            <div class="status" data-role="status">${TXT.ready}</div>
          </div>
          <input class="file-input" data-action="file-input" type="file" multiple accept=".json,.md,.markdown,.html,.htm,.zip">
          <div class="surface">
            <div class="section-title">本地历史 <span>最多保留最新 100 条</span><button class="clear-btn" data-action="clear-local" type="button">${TXT.clearLocal}</button></div>
            <div class="list" data-role="history-list"></div>
          </div>
        </div>
      </section>
    `;
  }

  // togglePanel：点击右下角按钮时打开/关闭面板，打开时顺手刷新本地历史列表。
  async function togglePanel() {
    if (!state.ui) renderButton();
    const panel = state.ui.shadow.getElementById(APP.panelId);
    state.panelOpen = !state.panelOpen;
    panel.classList.toggle('open', state.panelOpen);
    syncSettingsToUi();
    if (state.panelOpen) await renderHistoryList();
  }

  // closePanel：只负责关闭面板，不删除任何数据。
  function closePanel() {
    if (!state.ui) return;
    state.panelOpen = false;
    state.ui.shadow.getElementById(APP.panelId)?.classList.remove('open');
  }

  // setStatus：更新面板里的状态提示，比如“保存中”“导出完成”“操作失败”。
  function setStatus(text) {
    if (!state.ui) return;
    const el = state.ui.shadow.querySelector('[data-role="status"]');
    if (el) el.textContent = text;
  }

  // syncSettingsToUi：把内存里的设置同步到面板控件，避免打开面板时显示旧值。
  function syncSettingsToUi() {
    if (!state.ui) return;
    const root = state.ui.shadow;
    setInput(root, '[data-setting="autoSave"]', state.settings.autoSave);
    setInput(root, '[data-setting="includeProjects"]', state.settings.includeProjects);
    setInput(root, '[data-setting="includeArchived"]', state.settings.includeArchived);
    setInput(root, '[data-setting="accountLabel"]', state.settings.accountLabel);
    setInput(root, '[data-setting="remoteRootMode"]', state.settings.remoteRootMode);
    setInput(root, '[data-setting="remoteRootLimit"]', state.settings.remoteRootLimit);
  }

  // setInput：根据控件类型写入值，checkbox 用 checked，普通输入框和下拉框用 value。
  function setInput(root, selector, value) {
    const el = root.querySelector(selector);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = value == null ? '' : String(value);
  }

  // handlePanelClick：统一处理面板内所有按钮点击，具体动作由 data-action 决定。
  async function handlePanelClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    try {
      if (action === 'close') closePanel();
      if (action === 'save-current') await saveCurrentConversation('manual');
      if (action === 'export-current-zip') await exportCurrentZip();
      if (action === 'export-prompt-image-tool-json') await exportPromptImageToolJson();
      if (action === 'backup-remote') await backupRemoteHistory();
      if (action === 'export-local-zip') await exportLocalVaultZip();
      if (action === 'import-files') state.ui.shadow.querySelector('[data-action="file-input"]')?.click();
      if (action === 'copy-context') await copyContinuationContext(actionEl.dataset.id);
      if (action === 'copy-full') await copyFullConversation(actionEl.dataset.id);
      if (action === 'download-json') await downloadStoredConversation(actionEl.dataset.id, 'json');
      if (action === 'download-md') await downloadStoredConversation(actionEl.dataset.id, 'md');
      if (action === 'download-html') await downloadStoredConversation(actionEl.dataset.id, 'html');
      if (action === 'delete-local') await deleteStoredConversation(actionEl.dataset.id);
      if (action === 'clear-local') await clearLocalVault();
    } catch (error) {
      console.error(`[${APP.name}] action failed`, error);
      setButtonState('error', TXT.failed, 0);
      setStatus(`操作失败：${error && error.message ? error.message : error}`);
      resetButtonSoon();
    }
  }

  const debouncedSearch = debounce(async value => {
    state.searchKeyword = value.trim();
    await renderHistoryList();
  }, 220);

  // handlePanelInput：处理设置项变更、搜索输入和文件导入。
  async function handlePanelInput(event) {
    const el = event.target;
    const settingName = el.dataset.setting;
    const action = el.dataset.action;
    if (settingName) {
      let value = el.type === 'checkbox' ? el.checked : el.value;
      if (settingName === 'remoteRootLimit') value = Math.max(1, parseInt(value || '20', 10) || 20);
      await saveSettings({ [settingName]: value });
    }
    if (action === 'search') debouncedSearch(el.value || '');
    if (action === 'file-input' && el.files && el.files.length) {
      await importFiles(Array.from(el.files));
      el.value = '';
    }
  }

  // renderHistoryList：读取本地保存的对话，按更新时间排序，并渲染成卡片列表。
  async function renderHistoryList() {
    if (!state.ui || !state.db) return;
    const list = state.ui.shadow.querySelector('[data-role="history-list"]');
    if (!list) return;
    const keyword = state.searchKeyword.toLowerCase();
    const items = (await dbGetAll('conversations'))
      .filter(item => {
        if (!keyword) return true;
        const text = [
          item.title,
          item.accountLabel,
          item.workspaceId,
          item.projectTitle,
          item.status,
          ...(item.tags || []),
          ...((item.messages || []).slice(0, 20).map(msg => msg.content)),
        ].join('\n').toLowerCase();
        return text.includes(keyword);
      })
      .sort((a, b) => String(b.updatedAt || b.savedAt || '').localeCompare(String(a.updatedAt || a.savedAt || '')))
      .slice(0, 100);

    if (!items.length) {
      list.innerHTML = `<div class="card"><div class="card-meta">${TXT.noRecords}</div></div>`;
      return;
    }

    list.innerHTML = items.map(item => {
      const meta = [
        item.projectTitle ? `项目：${item.projectTitle}` : '普通对话',
        item.status || 'active',
        item.accountLabel || '',
        `${item.messageCount || 0} 条消息`,
        formatTime(item.updatedAt || item.savedAt),
      ].filter(Boolean).join(' · ');
      return `
        <article class="card">
          <div class="card-title">${escapeHtml(item.title || 'Untitled Conversation')}</div>
          <div class="card-meta">${escapeHtml(meta)}</div>
          <div class="actions">
            <button class="mini" data-action="copy-context" data-id="${escapeHtml(item.id)}" type="button">复制续聊</button>
            <button class="mini" data-action="copy-full" data-id="${escapeHtml(item.id)}" type="button">复制全文</button>
            <button class="mini" data-action="download-json" data-id="${escapeHtml(item.id)}" type="button">JSON</button>
            <button class="mini" data-action="download-md" data-id="${escapeHtml(item.id)}" type="button">MD</button>
            <button class="mini" data-action="download-html" data-id="${escapeHtml(item.id)}" type="button">HTML</button>
            <button class="mini" data-action="delete-local" data-id="${escapeHtml(item.id)}" type="button">删除</button>
          </div>
        </article>
      `;
    }).join('');
  }

  // setButtonState：控制右下角按钮的图标、文字、禁用状态和进度色块。
  function setButtonState(kind, label, progress) {
    if (!state.ui || !state.ui.button) renderButton();
    if (!state.ui || !state.ui.button) return;
    state.ui.button.classList.toggle('is-loading', kind === 'loading');
    state.ui.button.disabled = kind === 'loading';
    if (state.ui.icon) {
      state.ui.icon.innerHTML = kind === 'loading' ? ICONS.spinner : kind === 'done' ? ICONS.check : kind === 'error' ? ICONS.error : ICONS.download;
    }
    if (state.ui.label && label) state.ui.label.textContent = label;
    if (typeof progress === 'number') {
      state.ui.button.style.setProperty('--prog', `${clamp(progress, 0, 100)}%`);
    }
  }

  // resetButtonSoon：操作完成或失败后，延迟把按钮恢复成普通“档案馆”状态。
  function resetButtonSoon() {
    setTimeout(() => setButtonState('idle', TXT.button, 0), 2200);
  }

  /*************************************************************************
   * Storage
   *************************************************************************/

  // initStorage：初始化本地数据库，并在可用时把旧 IndexedDB 数据迁移到脚本管理器存储。
  async function initStorage() {
    state.db = await openDB();
    await migrateIndexedDbToScriptStorage();
  }

  // openDB：创建 IndexedDB 数据库结构。脚本管理器存储不可用时，会退回使用它。
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(APP.dbName, APP.dbVersion);
      request.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('projects')) {
          const store = db.createObjectStore('projects', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('workspaceId', 'workspaceId', { unique: false });
        }
        if (!db.objectStoreNames.contains('conversations')) {
          const store = db.createObjectStore('conversations', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('projectId', 'projectId', { unique: false });
          store.createIndex('workspaceId', 'workspaceId', { unique: false });
        }
        if (!db.objectStoreNames.contains('imports')) {
          db.createObjectStore('imports', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // txStore：拿到某个表的操作入口。mode 为 readonly 或 readwrite。
  function txStore(storeName, mode = 'readonly') {
    return state.db.transaction(storeName, mode).objectStore(storeName);
  }

  // dbGet：按 key 读取单条数据。优先用 GM 存储，兼容性更适合油猴脚本。
  async function dbGet(storeName, key) {
    if (hasScriptStorage()) {
      return GM_getValue(storageKey(storeName, key), null);
    }
    return new Promise((resolve, reject) => {
      const request = txStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // dbGetAll：读取某个表的全部数据，用于历史列表、导出本地库、清理旧记录。
  async function dbGetAll(storeName) {
    if (hasScriptStorage()) {
      const prefix = storagePrefix(storeName);
      return GM_listValues()
        .filter(key => key.startsWith(prefix))
        .map(key => GM_getValue(key, null))
        .filter(Boolean);
    }
    return new Promise((resolve, reject) => {
      const request = txStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // dbPut：写入或覆盖一条数据。conversations/projects/settings/imports 都走这里。
  async function dbPut(storeName, value) {
    if (hasScriptStorage()) {
      const key = value.key || value.id;
      if (!key) throw new Error(`Missing key for ${storeName}`);
      GM_setValue(storageKey(storeName, key), value);
      return value;
    }
    return new Promise((resolve, reject) => {
      const request = txStore(storeName, 'readwrite').put(value);
      request.onsuccess = () => resolve(value);
      request.onerror = () => reject(request.error);
    });
  }

  // dbDelete：删除本地数据。这里只删浏览器本地档案，不会影响 ChatGPT 官方历史。
  async function dbDelete(storeName, key) {
    if (hasScriptStorage()) {
      GM_deleteValue(storageKey(storeName, key));
      return;
    }
    return new Promise((resolve, reject) => {
      const request = txStore(storeName, 'readwrite').delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // hasScriptStorage：判断当前脚本管理器是否提供 GM_getValue 等持久化接口。
  function hasScriptStorage() {
    return typeof GM_getValue === 'function' &&
      typeof GM_setValue === 'function' &&
      typeof GM_deleteValue === 'function' &&
      typeof GM_listValues === 'function';
  }

  function storagePrefix(storeName) {
    return `${APP.storagePrefix}${storeName}:`;
  }

  function storageKey(storeName, key) {
    return `${storagePrefix(storeName)}${String(key)}`;
  }

  // migrateIndexedDbToScriptStorage：老版本数据在 IndexedDB 时，首次运行会复制到 GM 存储。
  async function migrateIndexedDbToScriptStorage() {
    if (!hasScriptStorage() || !state.db) return;
    const marker = `${APP.storagePrefix}migration:indexeddb:v1`;
    if (GM_getValue(marker, false)) return;
    for (const storeName of ['settings', 'projects', 'conversations', 'imports']) {
      let items = [];
      try {
        items = await new Promise((resolve, reject) => {
          const request = txStore(storeName).getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error);
        });
      } catch (_) {
        items = [];
      }
      for (const item of items) {
        const key = item && (item.key || item.id);
        if (key && GM_getValue(storageKey(storeName, key), null) == null) {
          GM_setValue(storageKey(storeName, key), item);
        }
      }
    }
    GM_setValue(marker, true);
  }

  // loadSettings：读取用户设置；没有保存过设置时使用 DEFAULT_SETTINGS。
  async function loadSettings() {
    const saved = await dbGet('settings', 'app');
    state.settings = { ...DEFAULT_SETTINGS, ...(saved ? saved.value : {}) };
  }

  // saveSettings：保存面板设置，比如自动保存、包含项目、账号标签。
  async function saveSettings(patch) {
    state.settings = { ...state.settings, ...patch };
    await dbPut('settings', { key: 'app', value: state.settings, updatedAt: nowIso() });
  }

  // upsertStoredConversation：保存或更新一条对话，同时维护项目索引和本地历史数量上限。
  async function upsertStoredConversation(conversation) {
    const existing = await dbGet('conversations', conversation.id);
    const merged = {
      ...(existing || {}),
      ...conversation,
      savedAt: nowIso(),
      messageCount: conversation.messages ? conversation.messages.length : conversation.messageCount || 0,
    };
    await dbPut('conversations', merged);
    await pruneLocalHistory(100);
    if (merged.projectId) {
      await dbPut('projects', {
        id: merged.projectId,
        workspaceId: merged.workspaceId || null,
        title: merged.projectTitle || 'Untitled Project',
        accountLabel: merged.accountLabel || state.settings.accountLabel,
        updatedAt: merged.updatedAt || nowIso(),
        savedAt: nowIso(),
        metadata: merged.projectMetadata || {},
      });
    }
    return merged;
  }

  /*************************************************************************
   * ChatGPT API
   *************************************************************************/

  // installNetworkInterceptors：监听页面自己的 fetch/XHR 请求，顺手捕获 Authorization 和工作区 ID。
  // 小白提示：这不是主动“破解”，只是复用当前网页已经带着的登录请求信息。
  function installNetworkInterceptors() {
    try {
      if (window.__ctVaultInterceptorsInstalled) return;
      window.__ctVaultInterceptorsInstalled = true;
      if (typeof window.fetch === 'function') {
        const rawFetch = window.fetch;
        window.fetch = function (resource, options) {
          try {
            if (isSameOriginResource(resource)) {
              if (resource && typeof Request !== 'undefined' && resource instanceof Request) captureHeaders(resource.headers);
              if (options && options.headers) captureHeaders(options.headers);
            }
          } catch (_) {}
          return rawFetch.apply(this, arguments);
        };
      }
      if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype) {
        const rawOpen = XMLHttpRequest.prototype.open;
        const rawSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
        XMLHttpRequest.prototype.open = function (method, url) {
          try { this.__ctVaultUrl = url; } catch (_) {}
          return rawOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
          try {
            if (isSameOriginResource(this.__ctVaultUrl || location.href)) {
              const lower = String(name || '').toLowerCase();
              if (lower === 'authorization') tryCaptureToken(value);
              if (lower === 'chatgpt-account-id' && value) state.capturedWorkspaceIds.add(value);
            }
          } catch (_) {}
          return rawSetRequestHeader.apply(this, arguments);
        };
      }
    } catch (error) {
      console.warn(`[${APP.name}] interceptor disabled`, error);
    }
  }

  // isSameOriginResource：只处理 ChatGPT 同站请求，避免误读第三方资源请求头。
  function isSameOriginResource(res) {
    try {
      const rawUrl = typeof res === 'string' ? res : res && res.url;
      const url = new URL(rawUrl || location.href, location.href);
      return url.origin === location.origin;
    } catch (_) {
      return true;
    }
  }

  // captureHeaders：从请求头里提取 token 和 ChatGPT-Account-Id。
  function captureHeaders(headersLike) {
    tryCaptureToken(getHeaderValue(headersLike, 'Authorization'));
    const workspaceId = getHeaderValue(headersLike, 'ChatGPT-Account-Id');
    if (workspaceId) state.capturedWorkspaceIds.add(workspaceId);
  }

  // getHeaderValue：兼容 Headers 对象、数组、普通对象和字符串四种请求头写法。
  function getHeaderValue(headersLike, name) {
    if (!headersLike) return null;
    const lower = name.toLowerCase();
    try {
      if (typeof Headers !== 'undefined' && headersLike instanceof Headers) return headersLike.get(name) || headersLike.get(lower);
      if (Array.isArray(headersLike)) {
        const found = headersLike.find(item => Array.isArray(item) && String(item[0]).toLowerCase() === lower);
        return found ? found[1] : null;
      }
      if (typeof headersLike === 'object') {
        for (const [key, value] of Object.entries(headersLike)) {
          if (String(key).toLowerCase() === lower) return value;
        }
      }
      if (typeof headersLike === 'string' && lower === 'authorization') return headersLike;
    } catch (_) {}
    return null;
  }

  // tryCaptureToken：从 "Bearer xxx" 中提取真正的 Access Token。
  function tryCaptureToken(headerLike) {
    const header = typeof headerLike === 'string' ? headerLike : getHeaderValue(headerLike, 'Authorization');
    if (header && /^Bearer\s+(.+)/i.test(header)) {
      const token = header.replace(/^Bearer\s+/i, '').trim();
      if (token && token.toLowerCase() !== 'dummy') state.accessToken = token;
    }
  }

  // ensureAccessToken：确保后续接口请求有 token；捕获不到时再请求 session 接口兜底。
  async function ensureAccessToken() {
    if (state.accessToken) return state.accessToken;
    try {
      const res = await fetch('/api/auth/session?unstable_client=true', { credentials: 'include' });
      if (!res.ok) throw new Error(`session ${res.status}`);
      const session = await res.json();
      if (session && session.accessToken) {
        state.accessToken = session.accessToken;
        return state.accessToken;
      }
    } catch (_) {}
    throw new Error(TXT.tokenFail);
  }

  // buildHeaders：组装调用 ChatGPT 后端接口需要的请求头。
  function buildHeaders(workspaceId) {
    const headers = {};
    if (state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;
    const did = getCookie('oai-did');
    if (did) headers['oai-device-id'] = did;
    if (workspaceId) headers['ChatGPT-Account-Id'] = workspaceId;
    return headers;
  }

  // fetchWithRetry：带简单重试的 fetch。遇到限流或服务器错误时会稍等再试。
  async function fetchWithRetry(input, init, retries = 3) {
    let attempt = 0;
    while (true) {
      try {
        const res = await fetch(input, init);
        if (res.ok) return res;
        if (attempt < retries && (res.status === 429 || res.status >= 500)) {
          await sleep(APP.baseDelay * Math.pow(2, attempt) + Math.random() * APP.jitter);
          attempt++;
          continue;
        }
        return res;
      } catch (error) {
        if (attempt < retries) {
          await sleep(APP.baseDelay * Math.pow(2, attempt) + Math.random() * APP.jitter);
          attempt++;
          continue;
        }
        throw error;
      }
    }
  }

  // getConversation：按对话 ID 读取完整对话原始数据。
  async function getConversation(id, workspaceId, errors) {
    const res = await fetchWithRetry(`/backend-api/conversation/${encodeURIComponent(id)}`, {
      headers: buildHeaders(workspaceId),
      credentials: 'include',
    });
    if (!res.ok) {
      pushError(errors, 'conversation:get', `${id} failed (${res.status})`);
      return null;
    }
    try {
      const data = await res.json();
      if (!data || !data.mapping) {
        pushError(errors, 'conversation:shape', `${id} missing mapping`);
        return null;
      }
      return data;
    } catch (error) {
      pushError(errors, 'conversation:parse', `${id} JSON parse failed: ${error.message}`);
      return null;
    }
  }

  // collectConversationsMeta：先只扫描对话“目录信息”，再由备份流程逐条读取详情。
  // 这样可以同时覆盖普通对话、归档对话和项目里的对话。
  async function collectConversationsMeta(workspaceId, includeProjects, includeArchived, errors) {
    const headers = buildHeaders(workspaceId);
    const metaMap = new Map();
    const upsert = meta => {
      const existing = metaMap.get(meta.id);
      if (!existing) metaMap.set(meta.id, meta);
      else if (meta.source === 'project' && existing.source !== 'project') metaMap.set(meta.id, { ...existing, ...meta });
      else if ((meta.updatedAt || 0) > (existing.updatedAt || 0)) metaMap.set(meta.id, { ...existing, updatedAt: meta.updatedAt });
    };

    for (const archived of includeArchived ? [false, true] : [false]) {
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const url = `/backend-api/conversations?offset=${offset}&limit=${APP.pageLimit}&order=updated${archived ? '&is_archived=true' : ''}`;
        const res = await fetchWithRetry(url, { headers, credentials: 'include' });
        if (!res.ok) {
          pushError(errors, 'root:list', `${archived ? 'archived' : 'active'} conversations failed (${res.status})`);
          break;
        }
        const data = await res.json();
        const items = data.items || [];
        if (!items.length) break;
        items.forEach(item => {
          if (!item || !item.id) return;
          upsert({
            id: item.id,
            title: item.title || '',
            updatedAt: toEpoch(item.update_time || item.updated_time || item.updated_at || item.update_at || item.create_time),
            source: 'root',
            status: archived ? 'archived' : 'active',
          });
        });
        hasMore = items.length === APP.pageLimit;
        offset += items.length;
        await sleep(jitter());
      }
    }

    const projects = includeProjects ? await getProjects(workspaceId, errors) : [];
    for (const project of projects) {
      let cursor = '0';
      while (cursor) {
        const res = await fetchWithRetry(`/backend-api/gizmos/${project.id}/conversations?cursor=${encodeURIComponent(cursor)}`, {
          headers,
          credentials: 'include',
        });
        if (!res.ok) {
          pushError(errors, 'project:list', `${project.title} failed (${res.status})`);
          break;
        }
        const data = await res.json();
        const items = data.items || [];
        if (!items.length) break;
        items.forEach(item => {
          if (!item || !item.id) return;
          upsert({
            id: item.id,
            title: item.title || '',
            updatedAt: toEpoch(item.update_time || item.updated_time || item.updated_at || item.update_at || item.create_time),
            source: 'project',
            status: item.is_archived ? 'archived' : 'active',
            projectId: project.id,
            projectTitle: project.title,
            projectMetadata: project.raw || {},
          });
        });
        cursor = data.cursor;
        await sleep(jitter());
      }
    }

    const all = Array.from(metaMap.values());
    return {
      rootMeta: all.filter(item => item.source === 'root'),
      projectMeta: all.filter(item => item.source === 'project'),
      projects,
    };
  }

  // getProjects：读取 ChatGPT 左侧项目列表，用来发现项目内对话。
  async function getProjects(workspaceId, errors) {
    const res = await fetchWithRetry('/backend-api/gizmos/snorlax/sidebar', {
      headers: buildHeaders(workspaceId),
      credentials: 'include',
    });
    if (!res.ok) {
      pushError(errors, 'projects:list', `projects failed (${res.status})`);
      return [];
    }
    const data = await res.json();
    const projects = [];
    (data.items || []).forEach(item => {
      if (item && item.gizmo && item.gizmo.id) {
        projects.push({
          id: item.gizmo.id,
          title: item.gizmo.display && item.gizmo.display.name ? item.gizmo.display.name : item.gizmo.id,
          raw: item.gizmo,
        });
      }
    });
    return projects;
  }

  // detectAllWorkspaceIds：尽量从页面数据和已捕获请求中找出账号/工作区 ID。
  function detectAllWorkspaceIds() {
    const ids = new Set(state.capturedWorkspaceIds);
    try {
      const raw = document.getElementById('__NEXT_DATA__')?.textContent || '{}';
      const data = JSON.parse(raw);
      const accounts = data?.props?.pageProps?.user?.accounts;
      if (accounts) {
        Object.values(accounts).forEach(acc => {
          if (acc?.account?.id) ids.add(acc.account.id);
        });
      }
    } catch (_) {}
    return Array.from(ids);
  }

  /*************************************************************************
   * Save / backup workflows
   *************************************************************************/

  // saveCurrentConversation：保存当前打开的这一条对话，是“保存当前”和“导出当前”的共同入口。
  // 自动保存时会计算内容 hash，内容没变化就跳过，避免频繁写入。
  async function saveCurrentConversation(trigger) {
    await ensureAccessToken();
    const id = getCurrentConversationId();
    if (!id) throw new Error(TXT.noCurrent);
    const workspaceId = detectLikelyWorkspaceId();
    setButtonState('loading', TXT.saving, 20);
    setStatus(`正在保存当前对话：${id}`);
    const errors = [];
    const raw = await getConversation(id, workspaceId, errors);
    if (!raw) throw new Error(errors[0]?.detail || '当前对话读取失败');
    const meta = {
      id,
      source: 'current',
      status: raw.is_archived ? 'archived' : 'active',
      workspaceId,
    };
    const stored = normalizeConversationForVault(raw, meta);
    stored.saveTrigger = trigger;
    const hash = simpleHash(JSON.stringify({
      title: stored.title,
      updatedAt: stored.updatedAt,
      messages: stored.messages.map(m => [m.role, m.content, m.createdAt]),
    }));
    const previous = state.saveStateById.get(stored.id);
    if (previous && previous.hash === hash && trigger === 'auto') {
      setStatus('内容未变化，跳过自动保存');
      setButtonState('done', TXT.saved, 100);
      resetButtonSoon();
      return stored;
    }
    await upsertStoredConversation(stored);
    state.saveStateById.set(stored.id, { hash, time: Date.now() });
    setStatus(`已保存：${stored.title}`);
    setButtonState('done', TXT.saved, 100);
    resetButtonSoon();
    if (state.panelOpen) await renderHistoryList();
    return stored;
  }

  // exportCurrentZip：导出当前对话的 JSON、Markdown、HTML，并尽量把页面里的图片一起打进 ZIP。
  async function exportCurrentZip() {
    const stored = await saveCurrentConversation('manual-export');
    setButtonState('loading', '图片', 88);
    const imageAssets = await collectCurrentConversationImageAssets(stored, 'current');
    const zip = new SimpleZip();
    addConversationToZip(zip, stored, 'current', { imageAssets });
    writeImageAssetsToZip(zip, imageAssets);
    if (imageAssets.length) {
      zip.file('current/assets/image-manifest.json', JSON.stringify(buildImageManifest(stored, imageAssets), null, 2));
    }
    zip.file('manifest.json', JSON.stringify(buildZipManifest([stored], [], 'current'), null, 2));
    setButtonState('loading', '打包中', 96);
    const filename = `chatgpt_vault_current_${safeFileName(stored.title)}_${dateStamp()}.zip`;
    downloadFile(zip.generateBlob(), filename);
    const imageCount = imageAssets.filter(asset => asset.status === 'downloaded').length;
    setStatus(`已导出当前对话：${filename}${imageAssets.length ? `，图片 ${imageCount}/${imageAssets.length}` : ''}`);
    setButtonState('done', '完成', 100);
    resetButtonSoon();
  }

  // exportPromptImageToolJson：把当前对话整理成 prompt-image-tool 可导入的 JSON。
  async function exportPromptImageToolJson() {
    const stored = await saveCurrentConversation('prompt-image-tool-export');
    setButtonState('loading', '提示词JSON', 82);
    const imageAssets = await collectCurrentConversationImageAssets(stored, 'prompt-image-tool');
    const filename = buildPromptImageToolJsonFilename(stored);
    const payload = buildPromptImageToolPayload(stored, imageAssets, filename);
    downloadTextFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    setButtonState('done', '完成', 100);
    setStatus(`已导出 prompt-image-tool JSON：${filename}，图片 ${payload.images.length}/${imageAssets.length}`);
    resetButtonSoon();
  }

  // buildPromptImageToolJsonFilename：导出文件名使用“对话标题 + 固定后缀”，方便识别来源。
  function buildPromptImageToolJsonFilename(stored) {
    return `${safeFileName(stored && stored.title ? stored.title : 'Untitled Conversation')}-prompt-image-tool.json`;
  }

  // buildPromptImageToolPayload：生成 prompt-image-tool 导入协议。
  // 这里会限制内嵌图片数量和单张大小，防止 JSON 文件过大。
  function buildPromptImageToolPayload(stored, imageAssets, exportedFileName) {
    const promptFields = extractPromptImageToolPromptFields(stored);
    const images = [];
    const skippedImages = [];

    (imageAssets || []).forEach(asset => {
      const fileName = asset.localPath ? asset.localPath.split('/').pop() : `${asset.id || 'image'}.${asset.extension || 'png'}`;
      if (asset.status !== 'downloaded' || !asset.bytes) {
        skippedImages.push({
          id: asset.id || null,
          fileName,
          reason: asset.error || '图片下载失败',
          source: asset.source || null,
        });
        return;
      }
      if (images.length >= APP.promptImageToolJsonImageLimit) {
        skippedImages.push({
          id: asset.id || null,
          fileName,
          reason: `超过内嵌上限 ${APP.promptImageToolJsonImageLimit} 张`,
          source: asset.source || null,
          size: asset.size || asset.bytes.length,
        });
        return;
      }
      if (asset.bytes.length > APP.promptImageToolJsonMaxImageBytes) {
        skippedImages.push({
          id: asset.id || null,
          fileName,
          reason: `单张图片超过 ${Math.round(APP.promptImageToolJsonMaxImageBytes / 1024 / 1024)}MB`,
          source: asset.source || null,
          size: asset.bytes.length,
        });
        return;
      }
      const mimeType = asset.mimeType || inferImageMimeFromUrl(asset.url) || 'image/png';
      images.push({
        id: asset.id || `image-${String(images.length + 1).padStart(3, '0')}`,
        fileName,
        mimeType,
        dataUrl: bytesToDataUrl(asset.bytes, mimeType),
        source: asset.source || null,
        width: asset.width || null,
        height: asset.height || null,
        size: asset.size || asset.bytes.length,
      });
    });

    return {
      schema: 'prompt-image-tool.import.v1',
      sourceTool: APP.name,
      targetTool: 'prompt-image-tool',
      conversationId: stored.id || null,
      conversationTitle: stored.title || '',
      exportedFileName,
      exportedAt: nowIso(),
      prompt: {
        title: promptFields.title,
        positivePrompt: promptFields.positivePrompt,
        negativePrompt: promptFields.negativePrompt,
        note: '从 ChatGPT 对话导入',
        tags: ['ChatGPT导入'],
        aspectRatio: '1:1',
      },
      images,
      skippedImages,
      raw: {
        messageCount: Array.isArray(stored.messages) ? stored.messages.length : 0,
        model: stored.model || '',
      },
    };
  }

  // extractPromptImageToolPromptFields：从对话里提取标题、正向提示词和负向提示词。
  function extractPromptImageToolPromptFields(stored) {
    const messages = Array.isArray(stored && stored.messages) ? stored.messages : [];
    const firstMessage = messages.find(msg => msg && String(msg.content || '').trim());
    const sourceText = normalizeText(firstMessage ? firstMessage.content : '');
    const readableText = extractReadablePromptText(sourceText);
    const sections = extractPromptSections(sourceText);
    const positiveFromSection = sections.positivePrompt ? extractReadablePromptText(sections.positivePrompt) || sections.positivePrompt : '';
    return {
      title: stored && stored.title ? stored.title : 'Untitled Conversation',
      positivePrompt: positiveFromSection || readableText || sourceText,
      negativePrompt: sections.negativePrompt || '',
    };
  }

  // extractReadablePromptText：跳过代码块和元数据，保留后续完整多段提示词正文。
  function extractReadablePromptText(text) {
    const withoutFencedBlocks = String(text || '').replace(/```[\s\S]*?```/g, '\n\n');
    const paragraphs = withoutFencedBlocks
      .split(/\n\s*\n+/)
      .map(part => normalizeText(part))
      .filter(Boolean);
    const firstReadableIndex = paragraphs.findIndex(paragraph => !isPromptNoiseParagraph(paragraph));
    if (firstReadableIndex < 0) return '';
    return paragraphs
      .slice(firstReadableIndex)
      .filter(paragraph => !isPromptNoiseParagraph(paragraph))
      .join('\n\n');
  }

  // isPromptNoiseParagraph：判断一段文字是不是 JSON、附件元数据等“噪声内容”。
  function isPromptNoiseParagraph(paragraph) {
    const text = normalizeText(paragraph);
    if (!text) return true;
    if (/^```/.test(text)) return true;
    if (/\b(content_type|asset_pointer|sediment:\/\/|size_bytes|fovea|metadata|watermarked_asset_pointer)\b/i.test(text)) return true;
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const jsonLikeLines = lines.filter(line => /^["'][^"']+["']\s*:/.test(line) || /^[{}[\],]+$/.test(line));
    if (lines.length >= 3 && jsonLikeLines.length / lines.length > 0.45) return true;
    if (/^[{[]/.test(text) && /[}\]]$/.test(text) && jsonLikeLines.length >= 2) return true;
    return false;
  }

  // extractPromptSections：识别“正向提示词:”和“负向提示词:”这类显式分段。
  function extractPromptSections(text) {
    const sections = { positivePrompt: '', negativePrompt: '' };
    let current = null;
    String(text || '').split(/\r?\n/).forEach(line => {
      const positive = line.match(/^\s*(?:正向提示词|Positive\s*Prompt)\s*[:：]\s*(.*)$/i);
      const negative = line.match(/^\s*(?:负向提示词|Negative\s*Prompt)\s*[:：]\s*(.*)$/i);
      if (positive) {
        current = 'positivePrompt';
        sections[current] += `${positive[1] || ''}\n`;
        return;
      }
      if (negative) {
        current = 'negativePrompt';
        sections[current] += `${negative[1] || ''}\n`;
        return;
      }
      if (current) sections[current] += `${line}\n`;
    });
    return {
      positivePrompt: normalizeText(sections.positivePrompt),
      negativePrompt: normalizeText(sections.negativePrompt),
    };
  }

  // bytesToDataUrl：把图片二进制转成 data URL，便于直接嵌进 JSON。
  function bytesToDataUrl(bytes, mimeType) {
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    return `data:${mimeType || 'image/png'};base64,${btoa(binary)}`;
  }

  // backupRemoteHistory：批量备份官方历史。会先扫描目录，再逐条拉取完整对话并写入 ZIP。
  async function backupRemoteHistory() {
    await ensureAccessToken();
    const errors = [];
    const workspaceIds = detectAllWorkspaceIds();
    const workspaceId = workspaceIds.length === 1 ? workspaceIds[0] : null;
    const includeProjects = Boolean(state.settings.includeProjects);
    const includeArchived = Boolean(state.settings.includeArchived);
    setButtonState('loading', '扫描中', 5);
    setStatus('正在扫描官方历史和项目...');
    const { rootMeta, projectMeta, projects } = await collectConversationsMeta(workspaceId, includeProjects, includeArchived, errors);
    rootMeta.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    projectMeta.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const selectedRoot = state.settings.remoteRootMode === 'all' ? rootMeta : rootMeta.slice(0, Number(state.settings.remoteRootLimit || 20));
    const metaList = selectedRoot.concat(projectMeta);
    if (!metaList.length) throw new Error('未找到可备份的对话');

    const zip = new SimpleZip();
    const storedList = [];
    for (let i = 0; i < metaList.length; i++) {
      const meta = metaList[i];
      setButtonState('loading', `${i + 1}/${metaList.length}`, 8 + Math.round(((i + 1) / metaList.length) * 82));
      const raw = await getConversation(meta.id, workspaceId, errors);
      if (!raw) {
        await sleep(jitter());
        continue;
      }
      const stored = normalizeConversationForVault(raw, { ...meta, workspaceId });
      await upsertStoredConversation(stored);
      storedList.push(stored);
      const folder = stored.projectId ? `projects/${safeFileName(stored.projectTitle || stored.projectId)}` : `root/${stored.status || 'active'}`;
      addConversationToZip(zip, stored, folder);
      await sleep(jitter());
    }
    zip.file('manifest.json', JSON.stringify(buildZipManifest(storedList, projects, 'remote-backup'), null, 2));
    zip.file('projects/project-index.json', JSON.stringify(projects, null, 2));
    if (errors.length) zip.file('export-errors.json', JSON.stringify(errors, null, 2));
    setButtonState('loading', '打包中', 94);
    const filename = `chatgpt_vault_${workspaceId ? `workspace_${safeFileName(workspaceId)}_` : 'personal_'}${dateStamp()}_${state.settings.remoteRootMode}_${includeProjects ? 'with_projects' : 'no_projects'}.zip`;
    downloadFile(zip.generateBlob(), filename);
    setButtonState('done', '完成', 100);
    resetButtonSoon();
    setStatus(`备份完成：${storedList.length}/${metaList.length} 条对话${errors.length ? '，有错误报告' : ''}`);
    if (state.panelOpen) await renderHistoryList();
  }

  // exportLocalVaultZip：把浏览器本地已经保存过的所有档案整体导出。
  async function exportLocalVaultZip() {
    const conversations = await dbGetAll('conversations');
    const projects = await dbGetAll('projects');
    if (!conversations.length) throw new Error('本地档案库为空');
    const zip = new SimpleZip();
    conversations.forEach(item => {
      const folder = item.projectId ? `projects/${safeFileName(item.projectTitle || item.projectId)}` : `root/${item.status || 'active'}`;
      addConversationToZip(zip, item, folder);
    });
    zip.file('manifest.json', JSON.stringify(buildZipManifest(conversations, projects, 'local-vault'), null, 2));
    zip.file('vault/conversations.json', JSON.stringify(conversations, null, 2));
    zip.file('vault/projects.json', JSON.stringify(projects, null, 2));
    zip.file('index.html', buildIndexHtml(conversations, projects));
    const filename = `chatgpt_vault_local_${dateStamp()}.zip`;
    downloadFile(zip.generateBlob(), filename);
    setStatus(`已导出本地档案库：${conversations.length} 条`);
  }

  // addConversationToZip：同一条对话同时写入 JSON、Markdown、HTML 三种格式。
  function addConversationToZip(zip, stored, folder, options = {}) {
    const filenameBase = `${safeFileName(stored.title)}_${safeFileName(stored.id)}_${compactStamp(stored.createdAt || stored.savedAt)}`;
    zip.file(`${folder}/${filenameBase}.json`, JSON.stringify(stored, null, 2));
    zip.file(`${folder}/${filenameBase}.md`, conversationToMarkdown(stored, options));
    zip.file(`${folder}/${filenameBase}.html`, conversationToHtml(stored, options));
  }

  // collectCurrentConversationImageAssets：从当前页面发现图片并下载，供 ZIP 或 prompt-image-tool JSON 使用。
  async function collectCurrentConversationImageAssets(stored, folder) {
    const candidates = discoverCurrentConversationImages().slice(0, APP.currentExportImageLimit);
    const assets = [];
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const imageNo = String(i + 1).padStart(3, '0');
      const asset = {
        id: `image-${imageNo}`,
        source: candidate.source,
        url: candidate.url,
        alt: candidate.alt || '',
        width: candidate.width || null,
        height: candidate.height || null,
        status: 'pending',
        localPath: null,
        relativePath: null,
        mimeType: candidate.mimeType || null,
        extension: null,
        size: null,
        error: null,
      };
      try {
        const downloaded = await downloadImageCandidate(candidate);
        const extension = imageExtension(downloaded.mimeType, candidate.url);
        const filename = buildImageAssetFileName(stored, imageNo, extension);
        asset.status = 'downloaded';
        asset.mimeType = downloaded.mimeType;
        asset.extension = extension;
        asset.size = downloaded.bytes.length;
        asset.localPath = `${folder}/assets/${filename}`;
        asset.relativePath = `assets/${filename}`;
        asset.bytes = downloaded.bytes;
      } catch (error) {
        asset.status = 'failed';
        asset.error = error && error.message ? error.message : String(error);
      }
      assets.push(asset);
    }
    return assets;
  }

  function imageTitlePrefix(title) {
    const cleaned = safeFileName(title || 'Untitled Conversation').slice(0, 72).trim();
    return cleaned || 'Untitled';
  }

  // buildImageAssetFileName：图片文件名使用“对话标题-图片-序号”，方便导出后人工查找。
  function buildImageAssetFileName(stored, imageNo, extension) {
    const safeExtension = String(extension || 'png').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
    return `${imageTitlePrefix(stored && stored.title)}-图片-${imageNo}.${safeExtension}`;
  }

  // writeImageAssetsToZip：只把下载成功的图片写入 ZIP。
  function writeImageAssetsToZip(zip, imageAssets) {
    imageAssets
      .filter(asset => asset.status === 'downloaded' && asset.bytes && asset.localPath)
      .forEach(asset => zip.file(asset.localPath, asset.bytes));
  }

  // buildImageManifest：生成图片清单，记录哪些图片下载成功、哪些失败以及失败原因。
  function buildImageManifest(stored, imageAssets) {
    return {
      schemaVersion: '1.0',
      conversationId: stored.id || null,
      title: stored.title || '',
      exportedAt: nowIso(),
      counts: {
        total: imageAssets.length,
        downloaded: imageAssets.filter(asset => asset.status === 'downloaded').length,
        failed: imageAssets.filter(asset => asset.status === 'failed').length,
      },
      images: imageAssets.map(asset => ({
        id: asset.id,
        source: asset.source,
        url: asset.url,
        alt: asset.alt,
        width: asset.width,
        height: asset.height,
        status: asset.status,
        localPath: asset.localPath,
        relativePath: asset.relativePath,
        mimeType: asset.mimeType,
        extension: asset.extension,
        size: asset.size,
        error: asset.error,
      })),
    };
  }

  // discoverCurrentConversationImages：从当前对话页面里寻找可导出的图片候选。
  // 它会看 img 标签和 CSS background-image，并过滤头像、图标、SVG 等小资源。
  function discoverCurrentConversationImages() {
    const root = document.querySelector('main') || document.body;
    if (!root) return [];
    const seen = new Set();
    const candidates = [];
    const addCandidate = (url, element, source) => {
      const normalized = normalizeImageCandidateUrl(url);
      if (!normalized || seen.has(normalized)) return;
      if (!isLikelyExportableImage(element, normalized)) return;
      seen.add(normalized);
      const rect = element && element.getBoundingClientRect ? element.getBoundingClientRect() : null;
      candidates.push({
        source,
        url: normalized,
        alt: element && element.getAttribute ? (element.getAttribute('alt') || element.getAttribute('aria-label') || '') : '',
        width: Math.round((element && element.naturalWidth) || (rect && rect.width) || 0) || null,
        height: Math.round((element && element.naturalHeight) || (rect && rect.height) || 0) || null,
        mimeType: inferImageMimeFromUrl(normalized),
      });
    };

    root.querySelectorAll('img').forEach(img => {
      collectImageElementUrls(img).forEach(url => addCandidate(url, img, 'dom-image'));
    });
    root.querySelectorAll('[style*="background-image"]').forEach(element => {
      collectBackgroundImageUrls(element).forEach(url => addCandidate(url, element, 'dom-background'));
    });
    return candidates;
  }

  // collectImageElementUrls：从 img/currentSrc/src/srcset/picture source 中挑出图片 URL。
  function collectImageElementUrls(img) {
    const urls = [];
    if (img.currentSrc) urls.push(img.currentSrc);
    if (img.src) urls.push(img.src);
    if (img.srcset) urls.push(pickBestSrcsetUrl(img.srcset));
    const picture = img.closest && img.closest('picture');
    if (picture) {
      picture.querySelectorAll('source[srcset]').forEach(source => {
        urls.push(pickBestSrcsetUrl(source.getAttribute('srcset')));
      });
    }
    return urls.filter(Boolean);
  }

  // collectBackgroundImageUrls：从元素的 background-image 样式里提取 url(...)。
  function collectBackgroundImageUrls(element) {
    try {
      const value = getComputedStyle(element).backgroundImage || '';
      const urls = [];
      value.replace(/url\(["']?([^"')]+)["']?\)/g, (_, url) => {
        urls.push(url);
        return '';
      });
      return urls;
    } catch (_) {
      return [];
    }
  }

  // pickBestSrcsetUrl：srcset 里可能有多种清晰度，这里优先选分辨率最高的。
  function pickBestSrcsetUrl(srcset) {
    const candidates = String(srcset || '')
      .split(',')
      .map(part => {
        const [url, descriptor] = part.trim().split(/\s+/, 2);
        const score = descriptor && descriptor.endsWith('w')
          ? Number(descriptor.slice(0, -1))
          : descriptor && descriptor.endsWith('x')
            ? Number(descriptor.slice(0, -1)) * 1000
            : 0;
        return { url, score: Number.isFinite(score) ? score : 0 };
      })
      .filter(item => item.url);
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] ? candidates[0].url : null;
  }

  // normalizeImageCandidateUrl：把相对地址转成完整地址，并排除非图片 data、blob 以外的奇怪协议。
  function normalizeImageCandidateUrl(url) {
    try {
      const raw = String(url || '').trim();
      if (!raw) return null;
      if (/^data:image\/svg\+xml/i.test(raw)) return null;
      if (/^data:/i.test(raw) && !/^data:image\//i.test(raw)) return null;
      if (/^blob:/i.test(raw) || /^data:image\//i.test(raw)) return raw;
      const parsed = new URL(raw, location.href);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed.href;
    } catch (_) {
      return null;
    }
  }

  // isLikelyExportableImage：用尺寸、文件类型和关键词判断这张图是否值得导出。
  function isLikelyExportableImage(element, url) {
    if (!element) return false;
    const haystack = [
      url,
      element.getAttribute && element.getAttribute('alt'),
      element.getAttribute && element.getAttribute('class'),
      element.getAttribute && element.getAttribute('aria-label'),
    ].filter(Boolean).join(' ').toLowerCase();
    if (/\b(avatar|favicon|logo|sprite|icon|profile|emoji|glyph)\b/.test(haystack)) return false;
    if (/\.svg(?:[?#]|$)/i.test(url)) return false;
    const rect = element.getBoundingClientRect ? element.getBoundingClientRect() : null;
    const width = Number(element.naturalWidth || (rect && rect.width) || 0);
    const height = Number(element.naturalHeight || (rect && rect.height) || 0);
    if (width && height && (width < 96 || height < 96 || width * height < 12000)) return false;
    if (rect && (rect.width <= 1 || rect.height <= 1)) return false;
    return true;
  }

  // downloadImageCandidate：真正下载图片，并检查响应看起来是不是图片。
  async function downloadImageCandidate(candidate) {
    const response = await fetch(candidate.url, { credentials: 'include' });
    if (!response.ok) throw new Error(`图片请求失败：${response.status}`);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const mimeType = blob.type || candidate.mimeType || inferImageMimeFromUrl(candidate.url) || 'application/octet-stream';
    if (!/^image\//i.test(mimeType) && !looksLikeImageBytes(bytes)) {
      throw new Error(`非图片响应：${mimeType}`);
    }
    return {
      bytes,
      mimeType,
    };
  }

  // imageExtension：根据 mimeType 或 URL 推断图片扩展名。
  function imageExtension(mimeType, url) {
    const mime = String(mimeType || '').toLowerCase();
    if (mime.includes('png')) return 'png';
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
    if (mime.includes('webp')) return 'webp';
    if (mime.includes('gif')) return 'gif';
    if (mime.includes('avif')) return 'avif';
    if (mime.includes('bmp')) return 'bmp';
    const urlExt = imageExtensionFromUrl(url);
    if (urlExt) return urlExt;
    return 'png';
  }

  function imageExtensionFromUrl(url) {
    try {
      const pathname = new URL(String(url || ''), location.href).pathname.toLowerCase();
      const match = pathname.match(/\.([a-z0-9]{2,5})$/);
      if (match && ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp'].includes(match[1])) {
        return match[1] === 'jpeg' ? 'jpg' : match[1];
      }
    } catch (_) {}
    return null;
  }

  function inferImageMimeFromUrl(url) {
    const ext = imageExtensionFromUrl(url);
    if (ext === 'jpg') return 'image/jpeg';
    return ext ? `image/${ext}` : null;
  }

  // looksLikeImageBytes：通过文件头判断二进制内容是否像 PNG/JPG/GIF/WEBP。
  function looksLikeImageBytes(bytes) {
    if (!bytes || !bytes.length) return false;
    if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return true;
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
    if (bytes.length >= 6) {
      const head = String.fromCharCode(...bytes.slice(0, 6));
      if (head === 'GIF87a' || head === 'GIF89a') return true;
    }
    if (bytes.length >= 12) {
      const head = String.fromCharCode(...bytes.slice(0, 4));
      const tail = String.fromCharCode(...bytes.slice(8, 12));
      if (head === 'RIFF' && tail === 'WEBP') return true;
    }
    return false;
  }

  // downloadStoredConversation：从本地历史里下载单条记录的 JSON/Markdown/HTML。
  async function downloadStoredConversation(id, format) {
    const item = await dbGet('conversations', id);
    if (!item) throw new Error('未找到本地记录');
    const base = `${safeFileName(item.title)}_${safeFileName(item.id)}_${dateStamp()}`;
    if (format === 'json') downloadTextFile(`${base}.json`, JSON.stringify(item, null, 2), 'application/json;charset=utf-8');
    if (format === 'md') downloadTextFile(`${base}.md`, conversationToMarkdown(item), 'text/markdown;charset=utf-8');
    if (format === 'html') downloadTextFile(`${base}.html`, conversationToHtml(item), 'text/html;charset=utf-8');
  }

  // deleteStoredConversation：删除一条本地档案，不会删除 ChatGPT 官方对话。
  async function deleteStoredConversation(id) {
    if (!confirm('确定要删除这条本地档案吗？不会影响 ChatGPT 官方历史。')) return;
    await dbDelete('conversations', id);
    await cleanupOrphanProjects();
    setStatus('已删除本地记录');
    await renderHistoryList();
  }

  // clearLocalVault：清空本地保存的 conversations/projects/imports 三类数据。
  async function clearLocalVault() {
    if (!confirm('确定要清空本地历史吗？这只会删除浏览器本地档案，不会影响 ChatGPT 官方历史。')) return;
    const stores = ['conversations', 'projects', 'imports'];
    for (const storeName of stores) {
      const items = await dbGetAll(storeName);
      for (const item of items) {
        await dbDelete(storeName, item.id || item.key);
      }
    }
    state.saveStateById.clear();
    setStatus('本地历史已清空');
    await renderHistoryList();
  }

  // pruneLocalHistory：本地历史超过上限时，按时间删除最旧的记录。
  async function pruneLocalHistory(maxCount) {
    const limit = Number(maxCount) || 100;
    const conversations = await dbGetAll('conversations');
    if (conversations.length <= limit) return;
    const sorted = conversations.sort((a, b) => getConversationTime(b) - getConversationTime(a));
    const stale = sorted.slice(limit);
    for (const item of stale) {
      await dbDelete('conversations', item.id);
      state.saveStateById.delete(item.id);
    }
    await cleanupOrphanProjects();
  }

  // cleanupOrphanProjects：删除已经没有任何对话引用的项目索引。
  async function cleanupOrphanProjects() {
    const conversations = await dbGetAll('conversations');
    const usedProjectIds = new Set(conversations.map(item => item.projectId).filter(Boolean));
    const projects = await dbGetAll('projects');
    for (const project of projects) {
      if (!usedProjectIds.has(project.id)) await dbDelete('projects', project.id);
    }
  }

  function getConversationTime(item) {
    const raw = item && (item.updatedAt || item.savedAt || item.createdAt);
    const time = raw ? Date.parse(raw) : 0;
    return Number.isFinite(time) ? time : 0;
  }

  // copyContinuationContext：复制“续聊用”的精简上下文，优先保留最近消息。
  async function copyContinuationContext(id) {
    const item = await dbGet('conversations', id);
    if (!item) throw new Error('未找到本地记录');
    const clipped = buildContinuationMarkdown(item, 22000);
    const prompt = [
      '以下是我之前保存的一段 ChatGPT 历史对话。请先理解上下文，然后从最后的问题继续帮助我。',
      '',
      clipped,
      '',
      '请基于以上历史上下文继续回答。',
    ].join('\n');
    await navigator.clipboard.writeText(prompt);
    setStatus('已复制续聊上下文到剪贴板：优先保留最近消息');
  }

  async function copyFullConversation(id) {
    const item = await dbGet('conversations', id);
    if (!item) throw new Error('未找到本地记录');
    await navigator.clipboard.writeText(conversationToMarkdown(item));
    setStatus('已复制完整对话到剪贴板');
  }

  // buildContinuationMarkdown：如果对话太长，会从后往前截取，避免复制内容过大。
  function buildContinuationMarkdown(item, maxChars) {
    const messages = item.messages || [];
    const header = [
      `# ${item.title || 'Untitled Conversation'}`,
      '',
      `**Conversation ID:** \`${item.id || 'Unknown'}\``,
      item.projectTitle ? `**Project:** ${item.projectTitle}` : '',
      `**Status:** ${item.status || 'unknown'}`,
      item.updatedAt ? `**Updated:** ${formatTime(item.updatedAt)}` : '',
      '',
      '---',
      '',
    ].filter(line => line !== '').join('\n');

    const full = conversationToMarkdown(item);
    if (full.length <= maxChars) return full;

    const selected = [];
    let used = header.length + 160;
    for (let i = messages.length - 1; i >= 0; i--) {
      const block = messageToMarkdownBlock(messages[i]);
      if (selected.length && used + block.length > maxChars) break;
      selected.unshift(block);
      used += block.length;
    }

    return [
      header,
      '[续聊上下文已自动精简：保留对话元信息和最近消息。需要完整内容请点击“复制全文”或导出 Markdown。]',
      '',
      selected.join('\n---\n\n'),
    ].join('\n');
  }

  function messageToMarkdownBlock(msg) {
    const role = formatRole(msg.role);
    const time = msg.createdAt ? ` (${formatTime(msg.createdAt)})` : '';
    return `## ${role}${time}\n\n${msg.content || ''}\n\n`;
  }

  /*************************************************************************
   * Import
   *************************************************************************/

  // importFiles：统一导入入口。根据文件扩展名分发到 ZIP/JSON/Markdown/HTML 导入逻辑。
  async function importFiles(files) {
    let imported = 0;
    setStatus(`正在导入 ${files.length} 个文件...`);
    for (const file of files) {
      try {
        if (/\.zip$/i.test(file.name)) imported += await importZipFile(file);
        else if (/\.json$/i.test(file.name)) imported += await importJsonText(await file.text(), file.name);
        else if (/\.md|\.markdown$/i.test(file.name)) imported += await importMarkdownText(await file.text(), file.name);
        else if (/\.html?$/i.test(file.name)) imported += await importHtmlText(await file.text(), file.name);
      } catch (error) {
        console.warn(`[${APP.name}] import failed`, file.name, error);
        await dbPut('imports', { id: uuid('import_error'), filename: file.name, status: 'failed', error: error.message, importedAt: nowIso() });
      }
    }
    setStatus(`导入完成：${imported} 条记录`);
    await renderHistoryList();
  }

  // importZipFile：读取本脚本导出的 ZIP，优先导入里面的对话 JSON，找不到再用 Markdown/HTML 兜底。
  async function importZipFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entries = readStoredZip(bytes);
    let count = 0;
    const importableJson = entries.filter(entry =>
      /\.json$/i.test(entry.path) &&
      !/(^|\/)(manifest|project-index|export-errors|projects|conversations)\.json$/i.test(entry.path)
    );
    const importableFallback = entries.filter(entry => /\.(md|markdown|html?)$/i.test(entry.path));
    const targets = importableJson.length ? importableJson : importableFallback;
    for (const entry of targets) {
      if (/\.json$/i.test(entry.path)) {
        const text = new TextDecoder().decode(entry.bytes);
        count += await importJsonText(text, `${file.name}/${entry.path}`);
      } else if (/\.md$/i.test(entry.path)) {
        const text = new TextDecoder().decode(entry.bytes);
        count += await importMarkdownText(text, `${file.name}/${entry.path}`);
      } else if (/\.html?$/i.test(entry.path)) {
        const text = new TextDecoder().decode(entry.bytes);
        count += await importHtmlText(text, `${file.name}/${entry.path}`);
      }
    }
    await dbPut('imports', { id: uuid('import'), filename: file.name, status: 'ok', count, importedAt: nowIso() });
    return count;
  }

  // importJsonText：导入 JSON。既支持 ChatGPT 原始 conversation，也支持本脚本归档格式。
  async function importJsonText(text, filename) {
    const data = JSON.parse(text);
    const records = [];
    if (Array.isArray(data)) records.push(...data);
    else if (Array.isArray(data.conversations)) records.push(...data.conversations);
    else if (data.mapping || data.messages || data.schemaVersion || data.schema_version) records.push(data);
    else return 0;

    let count = 0;
    for (const record of records) {
      const stored = record.mapping
        ? normalizeConversationForVault(record, { source: 'imported_chatgpt_json', status: record.is_archived ? 'archived' : 'imported' })
        : normalizeImportedArchive(record, filename);
      await upsertStoredConversation(stored);
      count++;
    }
    await dbPut('imports', { id: uuid('import'), filename, status: 'ok', count, importedAt: nowIso() });
    return count;
  }

  // importMarkdownText：把普通 Markdown 当作一条“导入文件”记录保存。
  async function importMarkdownText(text, filename) {
    const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim() || stripExt(filename);
    const stored = {
      schemaVersion: '1.0',
      id: uuid('imported_md'),
      source: 'imported_markdown',
      title,
      accountLabel: '导入文件',
      workspaceId: null,
      projectId: null,
      projectTitle: null,
      status: 'imported',
      sourceUrl: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      savedAt: nowIso(),
      messages: [{ id: uuid('msg'), role: 'imported_markdown', content: normalizeText(text), createdAt: null, model: null, metadata: { filename } }],
      tags: ['imported', 'markdown'],
      raw: null,
      metadata: { filename },
    };
    await upsertStoredConversation(stored);
    await dbPut('imports', { id: uuid('import'), filename, status: 'ok', count: 1, importedAt: nowIso() });
    return 1;
  }

  // importHtmlText：把普通 HTML 的正文文本抽出来，当作一条“导入文件”记录保存。
  async function importHtmlText(text, filename) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const title = doc.querySelector('title')?.textContent?.trim() || stripExt(filename);
    const stored = {
      schemaVersion: '1.0',
      id: uuid('imported_html'),
      source: 'imported_html',
      title,
      accountLabel: '导入文件',
      workspaceId: null,
      projectId: null,
      projectTitle: null,
      status: 'imported',
      sourceUrl: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      savedAt: nowIso(),
      messages: [{ id: uuid('msg'), role: 'imported_html', content: normalizeText(doc.body?.innerText || text), createdAt: null, model: null, metadata: { filename } }],
      tags: ['imported', 'html'],
      rawHtml: text,
      metadata: { filename },
    };
    await upsertStoredConversation(stored);
    await dbPut('imports', { id: uuid('import'), filename, status: 'ok', count: 1, importedAt: nowIso() });
    return 1;
  }

  // normalizeImportedArchive：把外部导入的归档对象整理成本脚本内部统一结构。
  function normalizeImportedArchive(record, filename) {
    const messages = Array.isArray(record.messages) ? record.messages.map((msg, index) => ({
      id: msg.id || uuid(`msg_${index}`),
      role: msg.role || 'unknown',
      content: normalizeText(msg.content || msg.text || ''),
      createdAt: normalizeTime(msg.createdAt || msg.created_at || msg.createTime || msg.create_time),
      model: msg.model || '',
      metadata: msg.metadata || {},
    })).filter(msg => msg.content) : [];
    return {
      schemaVersion: record.schemaVersion || record.schema_version || '1.0',
      id: record.id || record.conversationId || record.conversation_id || uuid('imported_json'),
      source: record.source || 'imported_json',
      title: record.title || 'Imported Conversation',
      accountLabel: record.accountLabel || record.account_label || '导入文件',
      workspaceId: record.workspaceId || record.workspace_id || null,
      projectId: record.projectId || record.project_id || null,
      projectTitle: record.projectTitle || record.project_name || record.projectName || null,
      status: record.status || 'imported',
      sourceUrl: record.sourceUrl || record.url || null,
      createdAt: normalizeTime(record.createdAt || record.created_at || record.createTime || record.create_time) || nowIso(),
      updatedAt: normalizeTime(record.updatedAt || record.updated_at || record.updateTime || record.update_time) || nowIso(),
      savedAt: nowIso(),
      messages,
      tags: record.tags || ['imported', 'json'],
      raw: record.raw || null,
      metadata: { ...(record.metadata || {}), filename },
    };
  }

  /*************************************************************************
   * Normalization and rendering
   *************************************************************************/

  // normalizeConversationForVault：把 ChatGPT 后端返回的原始对话，整理成本地档案统一结构。
  // 后续保存、导出、搜索、复制续聊都依赖这个统一结构。
  function normalizeConversationForVault(raw, meta) {
    const parsed = parseConversation(raw);
    return {
      schemaVersion: '1.0',
      id: raw.conversation_id || meta.id || uuid('conversation'),
      source: meta.source || 'chatgpt_api',
      title: parsed.title,
      accountLabel: state.settings.accountLabel,
      workspaceId: meta.workspaceId || null,
      projectId: meta.projectId || raw.gizmo_id || null,
      projectTitle: meta.projectTitle || null,
      projectMetadata: meta.projectMetadata || null,
      status: meta.status || (raw.is_archived ? 'archived' : 'active'),
      sourceUrl: `https://chatgpt.com/c/${raw.conversation_id || meta.id || ''}`,
      createdAt: normalizeTime(raw.create_time || parsed.createTime) || nowIso(),
      updatedAt: normalizeTime(raw.update_time || parsed.updateTime || meta.updatedAt) || nowIso(),
      savedAt: nowIso(),
      model: parsed.model || raw.default_model_slug || '',
      messages: parsed.messages,
      files: collectFileManifest(raw),
      tags: [
        meta.source === 'project' || meta.projectId ? 'project' : 'root',
        meta.status || (raw.is_archived ? 'archived' : 'active'),
      ],
      raw,
      metadata: {
        exporter: APP.name,
        author: APP.author,
        updatedAt: APP.updatedAt,
        isArchived: Boolean(raw.is_archived),
        currentNode: raw.current_node || null,
      },
    };
  }

  // parseConversation：从 ChatGPT mapping 树里提取 user/assistant 消息，并按时间排序。
  function parseConversation(convData) {
    const messages = [];
    const mapping = convData.mapping || {};
    Object.keys(mapping).forEach(key => {
      const node = mapping[key];
      const message = node && node.message;
      if (!message || !message.content) return;
      const role = message.author && message.author.role;
      if (role !== 'user' && role !== 'assistant') return;
      const content = extractMessageContent(message.content);
      if (!content.trim()) return;
      messages.push({
        id: message.id || key,
        role,
        content: normalizeText(content),
        createdAt: normalizeTime(message.create_time),
        updatedAt: normalizeTime(message.update_time),
        model: (message.metadata && (message.metadata.model_slug || message.metadata.model_slug_override || message.metadata.default_model_slug)) || '',
        metadata: {
          status: message.status || null,
          endTurn: message.end_turn,
          parent: node.parent || null,
        },
      });
    });
    messages.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    return {
      title: convData.title || 'Untitled Conversation',
      createTime: convData.create_time,
      updateTime: convData.update_time,
      conversationId: convData.conversation_id,
      model: convData.default_model_slug || '',
      messages,
    };
  }

  // extractMessageContent：兼容不同消息内容结构，把它们统一转成纯文本。
  function extractMessageContent(content) {
    if (!content) return '';
    if (Array.isArray(content.parts)) return content.parts.map(stringifyPart).join('\n');
    if (typeof content.text === 'string') return content.text;
    if (typeof content.content === 'string') return content.content;
    return stringifyPart(content);
  }

  // stringifyPart：把消息片段转成字符串；遇到对象时用 JSON 代码块保留信息。
  function stringifyPart(part) {
    if (typeof part === 'string') return part;
    if (part == null) return '';
    if (typeof part === 'number' || typeof part === 'boolean') return String(part);
    if (typeof part === 'object') {
      if (typeof part.text === 'string') return part.text;
      if (typeof part.content === 'string') return part.content;
      if (typeof part.url === 'string') return part.url;
      try { return '```json\n' + JSON.stringify(part, null, 2) + '\n```'; } catch (_) {}
    }
    return String(part);
  }

  // collectFileManifest：扫描原始数据里的附件元信息。这里只保存元数据，不下载附件内容。
  function collectFileManifest(raw) {
    const files = [];
    try {
      const seen = new Set();
      JSON.stringify(raw, (key, value) => {
        if (value && typeof value === 'object') {
          const name = value.name || value.filename || value.file_name;
          const id = value.file_id || value.id;
          if (name && id && /file|attachment|upload/i.test(JSON.stringify(Object.keys(value)))) {
            const marker = `${id}:${name}`;
            if (!seen.has(marker)) {
              seen.add(marker);
              files.push({
                id,
                name,
                mimeType: value.mime_type || value.mimeType || null,
                size: value.size || null,
                captureStatus: 'metadata_only',
                metadata: value,
              });
            }
          }
        }
        return value;
      });
    } catch (_) {}
    return files;
  }

  // conversationToMarkdown：把统一结构渲染成 Markdown 文本，导出 MD 和复制全文都会用到。
  function conversationToMarkdown(item, options = {}) {
    let md = `# ${item.title || 'Untitled Conversation'}\n\n`;
    md += `**Conversation ID:** \`${item.id || 'Unknown'}\`\n\n`;
    md += `**Account:** ${item.accountLabel || ''}\n\n`;
    if (item.projectTitle) md += `**Project:** ${item.projectTitle}\n\n`;
    md += `**Status:** ${item.status || 'unknown'}\n\n`;
    md += `**Exporter:** ${APP.name}\n\n`;
    if (item.model) md += `**Model:** ${item.model}\n\n`;
    if (item.createdAt) md += `**Created:** ${formatTime(item.createdAt)}\n\n`;
    if (item.updatedAt) md += `**Updated:** ${formatTime(item.updatedAt)}\n\n`;
    md += '---\n\n';
    (item.messages || []).forEach((msg, index) => {
      const role = formatRole(msg.role);
      const time = msg.createdAt ? ` (${formatTime(msg.createdAt)})` : '';
      md += `## ${role}${time}\n\n${msg.content || ''}\n\n`;
      if (index < item.messages.length - 1) md += '---\n\n';
    });
    if (item.files && item.files.length) {
      md += '\n---\n\n## Files\n\n';
      item.files.forEach(file => {
        md += `- ${file.name || file.id || 'file'} (${file.captureStatus || 'metadata_only'})\n`;
      });
    }
    const images = getDownloadedImageAssets(options);
    if (images.length) {
      md += '\n---\n\n## Images\n\n';
      images.forEach((image, index) => {
        const label = markdownImageAlt(image.alt || `Generated image ${index + 1}`);
        md += `![${label}](${image.relativePath})\n\n`;
      });
    }
    return md;
  }

  // conversationToHtml：把统一结构渲染成一个可离线打开的 HTML 页面。
  function conversationToHtml(item, options = {}) {
    const messages = (item.messages || []).map(msg => {
      const time = msg.createdAt ? formatTime(msg.createdAt) : '';
      return `<section class="message ${escapeHtml(msg.role)}"><header><strong>${escapeHtml(formatRole(msg.role))}</strong>${time ? `<span>${escapeHtml(time)}</span>` : ''}</header><div>${renderMessageHtml(msg.content)}</div></section>`;
    }).join('\n');
    const imageGallery = buildImageGalleryHtml(options);
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="${escapeHtml(APP.name)}">
<title>${escapeHtml(item.title || 'Untitled Conversation')}</title>
<style>
body{margin:0;background:#f4f6f8;color:#202123;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.65;padding:24px}
.wrap{max-width:940px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 18px 45px rgba(15,23,42,.12);overflow:hidden}
.top{background:linear-gradient(135deg,#0f766e,#2563eb);color:#fff;padding:30px}.top h1{font-size:25px;line-height:1.3;margin:0 0 12px}.meta{font-size:13px;opacity:.92}
.content{padding:24px}.message{margin-bottom:22px;padding:20px;border-radius:10px;border:1px solid #e5e7eb}.message.user{background:#eef6ff;border-left:4px solid #2563eb}.message.assistant{background:#f8fafc;border-left:4px solid #0f766e}
.assets{margin-top:28px;padding-top:22px;border-top:1px solid #e5e7eb}.assets h2{font-size:18px;margin:0 0 14px}.asset-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.asset-grid figure{margin:0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;background:#f8fafc}.asset-grid img{display:block;width:100%;height:auto}.asset-grid figcaption{font-size:12px;color:#64748b;padding:8px 10px}
header{display:flex;gap:8px;margin-bottom:12px}header span{margin-left:auto;color:#64748b;font-size:12px}pre{background:#111827;color:#f9fafb;padding:15px;border-radius:8px;overflow:auto}code{font-family:Consolas,monospace;font-size:13px}a{color:#2563eb}.foot{color:#64748b;font-size:12px;padding:0 24px 24px}
</style>
</head>
<body>
<main class="wrap">
<div class="top"><h1>${escapeHtml(item.title || 'Untitled Conversation')}</h1><div class="meta">ID: ${escapeHtml(item.id || 'Unknown')}<br>Project: ${escapeHtml(item.projectTitle || 'Root')}<br>Status: ${escapeHtml(item.status || 'unknown')}<br>Updated: ${escapeHtml(formatTime(item.updatedAt))}</div></div>
<div class="content">${messages}${imageGallery}</div>
<div class="foot">Exported by ${escapeHtml(APP.name)}.</div>
</main>
</body>
</html>`;
  }

  // getDownloadedImageAssets：从导出选项中筛出已经下载成功、可写入文档的图片。
  function getDownloadedImageAssets(options) {
    return (options.imageAssets || [])
      .filter(asset => asset.status === 'downloaded' && asset.relativePath);
  }

  // markdownImageAlt：清理 Markdown 图片 alt 文本，避免方括号和换行破坏语法。
  function markdownImageAlt(value) {
    return String(value || 'image').replace(/[\[\]\n\r]/g, ' ').trim() || 'image';
  }

  // buildImageGalleryHtml：生成 HTML 导出里的图片画廊。
  function buildImageGalleryHtml(options) {
    const images = getDownloadedImageAssets(options);
    if (!images.length) return '';
    const figures = images.map((image, index) => {
      const caption = image.alt || `Generated image ${index + 1}`;
      return `<figure><img src="${escapeHtml(image.relativePath)}" alt="${escapeHtml(caption)}"><figcaption>${escapeHtml(caption)}</figcaption></figure>`;
    }).join('\n');
    return `<section class="assets"><h2>Images</h2><div class="asset-grid">${figures}</div></section>`;
  }

  // renderMessageHtml：把消息里的 Markdown-ish 文本转成简单 HTML，保留代码块和链接。
  function renderMessageHtml(content) {
    const blocks = [];
    const links = [];
    let text = String(content || '').replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      const id = blocks.length;
      blocks.push(`<pre><code class="language-${escapeHtml(lang || 'text')}">${escapeHtml(code.trim())}</code></pre>`);
      return `@@CT_BLOCK_${id}@@`;
    });
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, label, href) => {
      const id = links.length;
      const safe = sanitizeHref(href);
      links.push(safe ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noreferrer noopener">${escapeHtml(label)}</a>` : escapeHtml(`${label} (${href})`));
      return `@@CT_LINK_${id}@@`;
    });
    let html = escapeHtml(text);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/@@CT_LINK_(\d+)@@/g, (_, id) => links[Number(id)] || '');
    html = html.replace(/@@CT_BLOCK_(\d+)@@/g, (_, id) => blocks[Number(id)] || '');
    return html;
  }

  // buildZipManifest：生成 ZIP 顶层 manifest，方便以后知道包里有多少对话和项目。
  function buildZipManifest(conversations, projects, kind) {
    return {
      schemaVersion: '1.0',
      kind,
      exporter: APP.name,
      author: APP.author,
      updatedAt: APP.updatedAt,
      exportedAt: nowIso(),
      settings: {
        includeProjects: state.settings.includeProjects,
        includeArchived: state.settings.includeArchived,
        accountLabel: state.settings.accountLabel,
      },
      counts: {
        conversations: conversations.length,
        projects: projects.length,
      },
      projects: projects.map(project => ({
        id: project.id,
        title: project.title || project.name,
        updatedAt: project.updatedAt || null,
      })),
      conversations: conversations.map(item => ({
        id: item.id,
        title: item.title,
        projectId: item.projectId || null,
        projectTitle: item.projectTitle || null,
        status: item.status,
        updatedAt: item.updatedAt,
        messageCount: item.messageCount || (item.messages || []).length,
      })),
    };
  }

  // buildIndexHtml：本地库整体导出时生成一个简单索引页，方便浏览所有对话。
  function buildIndexHtml(conversations, projects) {
    const rows = conversations.map(item => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.projectTitle || 'Root')}</td><td>${escapeHtml(item.status || '')}</td><td>${escapeHtml(formatTime(item.updatedAt))}</td><td>${(item.messages || []).length}</td></tr>`).join('');
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>ChatGPT Vault Index</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:24px;color:#111827}table{border-collapse:collapse;width:100%}td,th{border:1px solid #e5e7eb;padding:8px;text-align:left}th{background:#f8fafc}</style></head><body><h1>ChatGPT Vault Index</h1><p>${conversations.length} conversations, ${projects.length} projects.</p><table><thead><tr><th>Title</th><th>Project</th><th>Status</th><th>Updated</th><th>Messages</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  }

  /*************************************************************************
   * Auto save
   *************************************************************************/

  // scheduleAutoSave：防抖后的自动保存入口。页面频繁变化时，只在安静一小段时间后保存一次。
  const scheduleAutoSave = debounce(async trigger => {
    if (!state.settings.autoSave) return;
    const id = getCurrentConversationId();
    if (!id) return;
    const previous = state.saveStateById.get(id);
    if (previous && Date.now() - previous.time < APP.currentSaveMinInterval) return;
    try {
      await saveCurrentConversation(trigger || 'auto');
    } catch (error) {
      console.warn(`[${APP.name}] auto save failed`, error);
      setStatus(`自动保存失败：${error.message}`);
    }
  }, APP.autoSaveDelay);

  // startAutoSaveWatchers：监听页面内容变化、路由变化、隐藏页面等事件，触发自动保存。
  function startAutoSaveWatchers() {
    const start = () => {
      if (!document.body) return setTimeout(start, 400);
      if (state.observer) state.observer.disconnect();
      state.observer = new MutationObserver(() => scheduleAutoSave('dom'));
      state.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      if (state.routeTimer) clearInterval(state.routeTimer);
      state.routeTimer = setInterval(() => {
        if (state.lastUrl !== location.href) {
          state.lastUrl = location.href;
          setTimeout(() => scheduleAutoSave('route'), 1200);
        }
      }, APP.routeCheckInterval);
      window.addEventListener('beforeunload', () => scheduleAutoSave('beforeunload'));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') scheduleAutoSave('hidden');
      });
    };
    start();
  }

  /*************************************************************************
   * ZIP write/read
   *************************************************************************/

  // SimpleZip：一个极简 ZIP 写入器，只生成“未压缩”的 ZIP。
  // 好处是不需要外部库；代价是文件不会被压缩，但足够稳定、可离线使用。
  class SimpleZip {
    constructor() {
      this.files = [];
      this.encoder = new TextEncoder();
    }
    // file：往 ZIP 里加入一个文件。content 可以是字符串，也可以是 Uint8Array。
    file(path, content) {
      const cleanPath = String(path || 'file.txt').replace(/^\/+/, '').replace(/\\/g, '/');
      const bytes = content instanceof Uint8Array ? content : this.encoder.encode(String(content == null ? '' : content));
      this.files.push({ path: cleanPath, bytes, crc: crc32(bytes) });
    }
    // generateBlob：把已加入的文件写成 ZIP Blob，供浏览器下载。
    generateBlob() {
      const parts = [];
      const central = [];
      let offset = 0;
      const { time, date } = dosDateTime(new Date());
      this.files.forEach(file => {
        const name = this.encoder.encode(file.path);
        const local = new Uint8Array(30 + name.length);
        const view = new DataView(local.buffer);
        writeU32(view, 0, 0x04034b50);
        writeU16(view, 4, 20);
        writeU16(view, 6, 0x0800);
        writeU16(view, 8, 0);
        writeU16(view, 10, time);
        writeU16(view, 12, date);
        writeU32(view, 14, file.crc);
        writeU32(view, 18, file.bytes.length);
        writeU32(view, 22, file.bytes.length);
        writeU16(view, 26, name.length);
        writeU16(view, 28, 0);
        local.set(name, 30);
        parts.push(local, file.bytes);
        const cd = new Uint8Array(46 + name.length);
        const cdv = new DataView(cd.buffer);
        writeU32(cdv, 0, 0x02014b50);
        writeU16(cdv, 4, 20);
        writeU16(cdv, 6, 20);
        writeU16(cdv, 8, 0x0800);
        writeU16(cdv, 10, 0);
        writeU16(cdv, 12, time);
        writeU16(cdv, 14, date);
        writeU32(cdv, 16, file.crc);
        writeU32(cdv, 20, file.bytes.length);
        writeU32(cdv, 24, file.bytes.length);
        writeU16(cdv, 28, name.length);
        writeU16(cdv, 30, 0);
        writeU16(cdv, 32, 0);
        writeU16(cdv, 34, 0);
        writeU16(cdv, 36, 0);
        writeU32(cdv, 38, 0);
        writeU32(cdv, 42, offset);
        cd.set(name, 46);
        central.push(cd);
        offset += local.length + file.bytes.length;
      });
      const centralOffset = offset;
      let centralSize = 0;
      central.forEach(item => {
        centralSize += item.length;
        parts.push(item);
      });
      const end = new Uint8Array(22);
      const ev = new DataView(end.buffer);
      writeU32(ev, 0, 0x06054b50);
      writeU16(ev, 4, 0);
      writeU16(ev, 6, 0);
      writeU16(ev, 8, this.files.length);
      writeU16(ev, 10, this.files.length);
      writeU32(ev, 12, centralSize);
      writeU32(ev, 16, centralOffset);
      writeU16(ev, 20, 0);
      parts.push(end);
      return new Blob(parts, { type: 'application/zip' });
    }
  }

  // readStoredZip：读取本脚本生成的未压缩 ZIP。导入 ZIP 时会用到。
  function readStoredZip(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error('无法识别 ZIP 目录');
    const count = view.getUint16(eocd + 10, true);
    const centralOffset = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder();
    const entries = [];
    let offset = centralOffset;
    for (let i = 0; i < count; i++) {
      if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('ZIP central directory 损坏');
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const nameLen = view.getUint16(offset + 28, true);
      const extraLen = view.getUint16(offset + 30, true);
      const commentLen = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const path = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLen));
      if (method !== 0) {
        offset += 46 + nameLen + extraLen + commentLen;
        continue;
      }
      const localNameLen = view.getUint16(localOffset + 26, true);
      const localExtraLen = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      entries.push({ path, bytes: bytes.slice(dataStart, dataStart + compressedSize) });
      offset += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
    return table;
  })();

  // crc32：ZIP 文件需要 CRC 校验值，这里用标准 CRC32 算法生成。
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function writeU16(view, offset, value) { view.setUint16(offset, value & 0xffff, true); }
  function writeU32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }
  // dosDateTime：把 JS Date 转成 ZIP 规范使用的 DOS 日期和时间格式。
  function dosDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
  }

  /*************************************************************************
   * Small utilities
   *************************************************************************/

  // getCurrentConversationId：从当前 URL 的 /c/{id} 中提取对话 ID。
  function getCurrentConversationId() {
    const match = location.pathname.match(/\/c\/([a-f0-9-]{10,}|[^/?#]+)/i);
    return match ? decodeURIComponent(match[1]) : null;
  }

  // detectLikelyWorkspaceId：如果只检测到一个账号/工作区，就认为当前页面属于它。
  function detectLikelyWorkspaceId() {
    const ids = detectAllWorkspaceIds();
    return ids.length === 1 ? ids[0] : null;
  }

  // getCookie：读取浏览器 cookie。这里主要用于拿 oai-did。
  function getCookie(name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  }

  // pushError：把批量备份中的错误统一收集到数组，最后可写入 export-errors.json。
  function pushError(errors, stage, detail) {
    errors.push({ stage, detail, time: nowIso() });
  }

  // sleep：等待指定毫秒数，用于接口重试和批量备份节流。
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // jitter：生成一点随机等待时间，避免批量请求过于密集。
  function jitter() {
    return APP.baseDelay + Math.random() * APP.jitter;
  }

  // uuid：生成本地记录 ID。浏览器支持 crypto.randomUUID 时优先使用它。
  function uuid(prefix = 'id') {
    if (crypto && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  // normalizeText：清理多余空格和空行，让导出的文本更整洁。
  function normalizeText(text) {
    return String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // safeFileName：把标题转换成 Windows/macOS 都比较安全的文件名。
  function safeFileName(name) {
    return String(name || 'Untitled')
      .replace(/[\/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, APP.maxNameLength) || 'Untitled';
  }

  function stripExt(filename) {
    return String(filename || 'Imported').replace(/\.[^.]+$/i, '');
  }

  function formatRole(role) {
    if (role === 'user') return 'User';
    if (role === 'assistant') return 'Assistant';
    return role || 'Message';
  }

  // normalizeTime：兼容秒级时间戳、毫秒级时间戳和 ISO 字符串。
  function normalizeTime(value) {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-/.test(value)) return value;
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return new Date(n > 100000000000 ? n : n * 1000).toISOString();
  }

  function toEpoch(value) {
    if (!value) return 0;
    if (typeof value === 'string' && /^\d{4}-/.test(value)) return Math.floor(new Date(value).getTime() / 1000);
    return Number(value) || 0;
  }

  function formatTime(value) {
    if (!value) return '';
    try { return new Date(value).toLocaleString(); } catch (_) { return String(value); }
  }

  function dateStamp() {
    const d = new Date();
    return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  }

  function compactStamp(value) {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return dateStamp();
    return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  // debounce：防抖工具。连续触发时只执行最后一次，常用于搜索和自动保存。
  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // simpleHash：快速计算字符串 hash，用来判断自动保存时内容是否变化。
  function simpleHash(input) {
    const str = String(input || '');
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }

  // sanitizeHref：导出 HTML 时只允许安全的链接协议。
  function sanitizeHref(href) {
    try {
      const url = new URL(String(href || '').trim(), location.href);
      return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
    } catch (_) {
      return null;
    }
  }

  // escapeHtml：把特殊字符转义，避免导出的 HTML 被消息内容破坏结构。
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // downloadTextFile：下载纯文本类文件，比如 JSON、Markdown、HTML。
  function downloadTextFile(filename, content, mime) {
    downloadFile(new Blob([content], { type: mime || 'text/plain;charset=utf-8' }), filename);
  }

  // downloadFile：浏览器端下载文件的通用方法。
  function downloadFile(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
})();
