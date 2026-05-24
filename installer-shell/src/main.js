import { renderCompletePage } from "./pages/complete.js";
import { renderInstallLocationPage } from "./pages/install-location.js";
import { renderInstallTasksPage } from "./pages/install-tasks.js";
import { renderInstallingPage } from "./pages/installing.js";
import { renderLicensePage } from "./pages/license.js";
import { renderPrepareInstallPage } from "./pages/prepare-install.js";
import { renderWelcomePage } from "./pages/welcome.js";

const app = document.querySelector("#installer-app");
const pageRoot = document.querySelector("#installer-page");
const minimizeButton = document.querySelector("#minimize");
const closeButton = document.querySelector("#close");
const defaultInstallPath = "%USERPROFILE%\\Downloads\\PIM-Test";

const state = {
  currentStepIndex: 0,
  licenseAgreed: false,
  installPath: defaultInstallPath,
  resolvedInstallPath: "",
  locationValidation: {
    state: "idle",
    message: "默认安装到下载目录；也可以点击浏览选择本地位置。",
    availableSpace: "约 256 MB",
  },
  locationBrowsing: false,
  installTasks: {
    desktopShortcut: true,
    startMenuShortcut: true,
    autoCheckUpdates: false,
  },
  installingStarted: false,
  previewMode: false,
  installerStatus: "安装核心将在开始安装时自动校验。",
  installing: {
    phase: "preparing",
    percent: 16,
  },
  completeOptions: {
    launchAfterInstall: true,
    desktopShortcut: true,
    startMenuShortcut: true,
    installPath: "",
    resolvedPath: "",
    appliedTasks: {},
    status: "",
    finishing: false,
  },
};

const steps = [
  {
    id: "welcome",
    shellClass: "welcome-page",
    label: "提示词管家安装向导欢迎页",
    render: renderWelcomePage,
  },
  {
    id: "license",
    shellClass: "license-page",
    label: "提示词管家安装向导许可协议页",
    render: () => renderLicensePage({ agreed: state.licenseAgreed }),
  },
  {
    id: "install-location",
    shellClass: "location-page",
    label: "提示词管家安装向导安装位置页",
    render: () =>
      renderInstallLocationPage({
        installPath: state.installPath,
        resolvedPath: state.resolvedInstallPath,
        validationMessage: state.locationValidation.message,
        validationState: state.locationValidation.state,
        availableSpace: state.locationValidation.availableSpace,
        browsing: state.locationBrowsing,
      }),
  },
  {
    id: "install-tasks",
    shellClass: "tasks-page",
    label: "提示词管家安装向导附加任务页",
    render: () => renderInstallTasksPage(state.installTasks),
  },
  {
    id: "prepare-install",
    shellClass: "prepare-page",
    label: "提示词管家安装向导准备安装页",
    render: () =>
      renderPrepareInstallPage({
        installPath: state.installPath,
        resolvedPath: state.resolvedInstallPath,
        validationMessage: state.locationValidation.message,
        installerStatus: state.installerStatus,
        tasks: state.installTasks,
      }),
  },
  {
    id: "installing",
    shellClass: "installing-page",
    label: "提示词管家安装向导正在安装页",
    render: () => renderInstallingPage(state.installing),
  },
  {
    id: "complete",
    shellClass: "complete-page",
    label: "提示词管家安装向导安装完成页",
    render: () => renderCompletePage(state.completeOptions),
  },
];

const previewParams = new URLSearchParams(window.location.search);
const previewStep = previewParams.get("step");
const previewAliases = {
  location: "install-location",
  tasks: "install-tasks",
  prepare: "prepare-install",
};
const normalizedPreviewStep = previewAliases[previewStep] || previewStep;
const previewStepIndex = steps.findIndex((step) => step.id === normalizedPreviewStep);

if (previewStepIndex >= 0) {
  state.currentStepIndex = previewStepIndex;
  state.previewMode = true;
}

if (normalizedPreviewStep === "license") {
  state.licenseAgreed = previewParams.get("agreed") === "1";
}

if (normalizedPreviewStep === "complete") {
  state.completeOptions = {
    ...state.completeOptions,
    installPath: state.installPath,
    resolvedPath: state.resolvedInstallPath,
    desktopShortcut: state.installTasks.desktopShortcut,
    startMenuShortcut: state.installTasks.startMenuShortcut,
    appliedTasks: state.installTasks,
    status: "安装已完成，点击完成即可关闭安装向导。",
  };
}

const getWindowApi = () => window.__TAURI__?.window?.getCurrentWindow?.();
const getTauriInvoke = () => window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
const getTauriDialogOpen = () => window.__TAURI__?.dialog?.open;

const closeCurrentWindow = async () => {
  const currentWindow = getWindowApi();
  if (currentWindow?.close) {
    await currentWindow.close();
    return;
  }

  window.close();
};

const closeInstaller = async () => {
  if (isInstallingActive() && !confirmInstallExit()) {
    return;
  }

  if (isBeforeInstallCommitStep() && !confirmBeforeInstallExit()) {
    return;
  }

  await closeCurrentWindow();
};

minimizeButton?.addEventListener("click", async () => {
  await getWindowApi()?.minimize();
});

closeButton?.addEventListener("click", closeInstaller);

function currentStep() {
  return steps[state.currentStepIndex];
}

function goToStep(stepIndex) {
  if (stepIndex < 0 || stepIndex >= steps.length) {
    return;
  }

  state.currentStepIndex = stepIndex;
  renderCurrentStep();
}

function goToStepById(stepId) {
  const stepIndex = steps.findIndex((step) => step.id === stepId);
  goToStep(stepIndex);
}

function renderCurrentStep() {
  const step = currentStep();
  if (!app || !pageRoot || !step) {
    return;
  }

  app.className = `installer-shell ${step.shellClass}`;
  app.setAttribute("aria-label", step.label);
  pageRoot.innerHTML = step.render();
  bindStepEvents(step.id);
}

function bindStepEvents(stepId) {
  const nextStepButton = pageRoot.querySelector("#next-step");
  const prevStepButton = pageRoot.querySelector("#prev-step");
  const cancelButton = pageRoot.querySelector("#cancel");

  cancelButton?.addEventListener("click", closeInstaller);

  prevStepButton?.addEventListener("click", () => {
    goToStep(state.currentStepIndex - 1);
  });

  nextStepButton?.addEventListener("click", async () => {
    if (nextStepButton.disabled) {
      return;
    }

    if (stepId === "install-location") {
      const valid = await validateInstallPath({ renderOnSuccess: false });
      if (!valid) {
        return;
      }
      goToStep(state.currentStepIndex + 1);
      return;
    }

    if (stepId === "prepare-install") {
      await beginInstallation();
      return;
    }

    if (["welcome", "license", "install-tasks"].includes(stepId)) {
      goToStep(state.currentStepIndex + 1);
    }
  });

  if (stepId === "license") {
    bindLicenseEvents();
  }

  if (stepId === "install-location") {
    bindInstallLocationEvents();
  }

  if (stepId === "install-tasks") {
    bindInstallTasksEvents();
  }

  if (stepId === "installing") {
    bindInstallingEvents();
  }

  if (stepId === "complete") {
    bindCompleteEvents();
  }
}

function bindLicenseEvents() {
  const nextStepButton = pageRoot.querySelector("#next-step");
  const agreementCheckbox = pageRoot.querySelector("#license-agree");
  const agreementStatus = pageRoot.querySelector("#agreement-status");

  if (!agreementCheckbox || !nextStepButton) {
    return;
  }

  agreementCheckbox.addEventListener("change", () => {
    const agreed = agreementCheckbox.checked;
    state.licenseAgreed = agreed;
    nextStepButton.disabled = !agreed;
    nextStepButton.dataset.state = agreed ? "enabled" : "disabled";

    if (agreementStatus) {
      agreementStatus.textContent = agreed ? "已同意许可协议，可以继续安装。" : "请勾选同意许可协议后继续。";
    }
  });
}

function bindInstallLocationEvents() {
  const browseButton = pageRoot.querySelector("#browse-install-path");
  const installPathInput = pageRoot.querySelector("#install-path");

  installPathInput?.addEventListener("input", () => {
    state.installPath = installPathInput.value;
    state.resolvedInstallPath = "";
    updateLocationValidation({
      state: "idle",
      message: "路径已修改，点击下一步时会再次校验。",
      availableSpace: "约 256 MB",
    });
  });

  installPathInput?.addEventListener("blur", () => {
    state.installPath = installPathInput.value;
    validateInstallPath({ renderOnSuccess: false });
  });

  browseButton?.addEventListener("click", chooseInstallDirectory);
}

function bindInstallTasksEvents() {
  const taskCheckboxes = pageRoot.querySelectorAll(".task-checkbox");

  taskCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const key = checkbox.dataset.taskKey;
      if (!key) {
        return;
      }

      state.installTasks = {
        ...state.installTasks,
        [key]: checkbox.checked,
      };
    });
  });
}

function bindInstallingEvents() {
  const retryButton = pageRoot.querySelector("#retry-install");
  const backButton = pageRoot.querySelector("#back-to-settings");

  retryButton?.addEventListener("click", beginInstallation);
  backButton?.addEventListener("click", () => {
    state.installingStarted = false;
    goToStepById("install-location");
  });
}

function bindCompleteEvents() {
  const optionInputs = pageRoot.querySelectorAll(".complete-toggle-input");
  const finishButton = pageRoot.querySelector("#finish-install");

  optionInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.dataset.completeOption;
      if (!key) {
        return;
      }

      state.completeOptions = {
        ...state.completeOptions,
        [key]: input.checked,
      };
    });
  });

  finishButton?.addEventListener("click", finishInstallation);
}

function isInstallingActive() {
  const step = currentStep();
  return step?.id === "installing" && state.installing.phase !== "complete" && state.installing.phase !== "failed";
}

function isBeforeInstallCommitStep() {
  const step = currentStep();
  return ["install-tasks", "prepare-install"].includes(step?.id);
}

function confirmInstallExit() {
  return window.confirm("安装正在进行，强制退出可能导致安装不完整。确定要退出安装向导吗？");
}

function confirmBeforeInstallExit() {
  return window.confirm("安装尚未开始，确定要退出安装向导吗？");
}

function updateLocationValidation(nextState) {
  state.locationValidation = {
    ...state.locationValidation,
    ...nextState,
  };

  const statusText = pageRoot.querySelector("#location-status span:last-child");
  const statusRoot = pageRoot.querySelector("#location-status");

  if (statusText) {
    statusText.textContent = state.locationValidation.message;
  }

  if (statusRoot) {
    statusRoot.className = `install-tip ${state.locationValidation.state}`;
  }
}

async function chooseInstallDirectory() {
  if (state.locationBrowsing) {
    return;
  }

  const invoke = getTauriInvoke();
  const openDialog = getTauriDialogOpen();

  if (!openDialog || state.previewMode) {
    updateLocationValidation({
      state: "warning",
      message: "浏览目录需要在 Tauri 窗口中使用；当前可直接编辑路径。",
    });
    return;
  }

  state.locationBrowsing = true;
  renderCurrentStep();

  try {
    const defaultPath = await getInstallDialogDefaultPath(invoke);
    const selected = await openDialog({
      title: "选择提示词管家的安装目录",
      directory: true,
      multiple: false,
      defaultPath,
    });
    const selectedPath = Array.isArray(selected) ? selected[0] : selected;

    if (!selectedPath) {
      state.locationBrowsing = false;
      renderCurrentStep();
      updateLocationValidation({
        state: "idle",
        message: "已取消目录选择，继续使用当前安装路径。",
      });
      return;
    }

    state.installPath = selectedPath;
    state.resolvedInstallPath = selectedPath;
    state.locationBrowsing = false;
    renderCurrentStep();
    await validateInstallPath({ renderOnSuccess: false });
  } catch (error) {
    state.locationBrowsing = false;
    renderCurrentStep();
    updateLocationValidation({
      state: "error",
      message: String(error || "打开目录选择失败，请直接编辑安装路径。"),
    });
  }
}

async function getInstallDialogDefaultPath(invoke = getTauriInvoke()) {
  if (!invoke) {
    return state.resolvedInstallPath || state.installPath;
  }

  try {
    const result = await invoke("validate_install_path", { targetDir: state.installPath });
    return result?.target_dir || state.resolvedInstallPath || state.installPath;
  } catch {
    return state.resolvedInstallPath || state.installPath;
  }
}

function validatePathInPreview(targetPath) {
  const trimmed = targetPath.trim();

  if (!trimmed) {
    return {
      ok: false,
      target_dir: "",
      message: "安装目录不能为空。",
      available_space_label: "约 256 MB",
    };
  }

  if (/^[A-Za-z]:[\\/]?$/.test(trimmed)) {
    return {
      ok: false,
      target_dir: trimmed,
      message: "安装目录不能直接使用磁盘根目录，请选择一个子文件夹。",
      available_space_label: "约 256 MB",
    };
  }

  return {
    ok: true,
    target_dir: trimmed,
    message: "当前路径格式有效，真实可写性将在 Tauri 中校验。",
    available_space_label: "约 256 MB",
  };
}

async function validateInstallPath({ renderOnSuccess = true } = {}) {
  const installPathInput = pageRoot.querySelector("#install-path");
  if (installPathInput) {
    state.installPath = installPathInput.value;
  }

  const invoke = getTauriInvoke();
  let result;

  try {
    result =
      invoke && !state.previewMode
        ? await invoke("validate_install_path", { targetDir: state.installPath })
        : validatePathInPreview(state.installPath);
  } catch (error) {
    result = {
      ok: false,
      target_dir: state.installPath,
      message: String(error || "安装路径校验失败。"),
      available_space_label: "约 256 MB",
    };
  }

  state.resolvedInstallPath = result?.target_dir || state.installPath;
  updateLocationValidation({
    state: result?.ok ? "success" : "error",
    message: result?.message || (result?.ok ? "安装目录已准备好。" : "安装目录不可用。"),
    availableSpace: result?.available_space_label || "约 256 MB",
  });

  if (result?.ok && renderOnSuccess && currentStep()?.id === "install-location") {
    renderCurrentStep();
  }

  if (!result?.ok && currentStep()?.id !== "install-location") {
    goToStepById("install-location");
  }

  return Boolean(result?.ok);
}

function updateInstallingState(nextState) {
  state.installing = {
    ...state.installing,
    ...nextState,
  };

  if (currentStep()?.id === "installing") {
    renderCurrentStep();
  }
}

function updateCompleteState(nextState) {
  state.completeOptions = {
    ...state.completeOptions,
    ...nextState,
  };

  if (currentStep()?.id === "complete") {
    renderCurrentStep();
  }
}

async function beginInstallation() {
  if (state.installingStarted && state.installing.phase !== "failed") {
    return;
  }

  const valid = await validateInstallPath({ renderOnSuccess: false });
  if (!valid) {
    return;
  }

  state.installingStarted = true;
  state.installerStatus = "安装核心校验通过后将执行静默安装。";
  state.installing = {
    phase: "preparing",
    percent: 16,
    title: "正在准备安装...",
    path: "正在检查安装目录与安装核心",
  };
  goToStepById("installing");
  await startInstallation();
}

async function startInstallation() {
  const invoke = getTauriInvoke();

  if (!invoke || state.previewMode) {
    updateInstallingState({
      phase: "failed",
      title: "当前环境无法执行安装",
      error: "请在 Tauri 安装器壳窗口中开始真实安装。",
    });
    state.installingStarted = false;
    return;
  }

  try {
    updateInstallingState({
      phase: "copying",
      percent: 58,
      title: "正在写入程序文件...",
      path: "正在执行静默安装核心，请稍候...",
    });

    const result = await invoke("install_with_nsis", {
      targetDir: state.installPath,
    });

    updateInstallingState({
      phase: "verifying",
      percent: 84,
      title: "正在校验安装结果...",
      path: result?.target_dir || "正在确认主程序与卸载器是否可用",
    });

    if (!result?.success) {
      updateInstallingState({
        phase: "failed",
        title: "安装校验未通过",
        error: buildInstallFailureMessage(result),
      });
      state.installingStarted = false;
      return;
    }

    updateInstallingState({
      phase: "finalizing",
      percent: 94,
      title: "正在执行收尾任务...",
      path: "正在根据您的选择处理快捷方式",
    });

    const shortcutResult = await applyShortcutOptions(state.installTasks);
    const shortcutWarnings = shortcutResult.warnings;

    updateInstallingState({
      phase: "complete",
      percent: 100,
      title: "正在完成安装...",
      path: "提示词管家已安装完成",
    });

    state.completeOptions = {
      ...state.completeOptions,
      desktopShortcut: state.installTasks.desktopShortcut,
      startMenuShortcut: state.installTasks.startMenuShortcut,
      installPath: state.installPath,
      resolvedPath: result?.target_dir || state.resolvedInstallPath,
      appliedTasks: {
        ...state.installTasks,
      },
      status:
        shortcutWarnings.length > 0
          ? `安装已完成；${shortcutWarnings.join("；")}`
          : "安装已完成，并已创建桌面和开始菜单快捷方式。",
    };
    goToStepById("complete");
  } catch (error) {
    updateInstallingState({
      phase: "failed",
      title: "安装遇到问题",
      error: String(error || "安装命令执行失败，请重新尝试。"),
    });
    state.installingStarted = false;
  }
}

function buildInstallFailureMessage(result) {
  if (!result) {
    return "安装命令没有返回结果，请重新尝试。";
  }

  if (result.error_message) {
    return result.error_message;
  }

  const missing = [];
  if (!result.exe_exists) {
    missing.push("主程序");
  }
  if (!result.uninstaller_exists) {
    missing.push("卸载器");
  }

  if (missing.length > 0) {
    return `未检测到${missing.join("和")}，请重新尝试安装。`;
  }

  return `安装器返回码：${result.exit_code ?? "未知"}，请重新尝试安装。`;
}

function buildShortcutWarning(error, fallback) {
  const message = String(error || "");
  return message ? fallback : fallback;
}

function buildShortcutStatusWarnings(status = {}, tasks = state.installTasks) {
  const warnings = [];
  if (tasks.desktopShortcut && status.desktop_shortcut_exists === false) {
    warnings.push("未检测到桌面快捷方式，可点击完成时再次尝试创建。");
  }

  if (
    tasks.startMenuShortcut &&
    (status.start_menu_shortcut_exists === false ||
      status.start_menu_uninstaller_shortcut_exists === false)
  ) {
    warnings.push("未检测到完整开始菜单入口，可点击完成时再次尝试创建。");
  }

  return warnings;
}

async function applyShortcutOptions(tasks = state.installTasks) {
  const invoke = getTauriInvoke();
  if (!invoke || state.previewMode) {
    return { warnings: [], status: null };
  }

  const warnings = [];
  let status = null;

  try {
    status = await invoke("apply_desktop_shortcut", {
      targetDir: state.installPath,
      enabled: tasks.desktopShortcut,
    });
  } catch (error) {
    warnings.push(buildShortcutWarning(error, "桌面快捷方式处理失败，可安装后手动创建。"));
  }

  try {
    status = await invoke("apply_start_menu_shortcut", {
      targetDir: state.installPath,
      enabled: tasks.startMenuShortcut,
    });
  } catch (error) {
    warnings.push(buildShortcutWarning(error, "开始菜单快捷方式处理失败，可安装后手动创建。"));
  }

  if (!status) {
    try {
      status = await invoke("get_shortcut_status");
    } catch {
      status = null;
    }
  }

  warnings.push(...buildShortcutStatusWarnings(status || {}, tasks));

  return { warnings: [...new Set(warnings)], status };
}

async function finishInstallation() {
  if (state.completeOptions.finishing) {
    return;
  }

  const finishButton = pageRoot.querySelector("#finish-install");
  const invoke = getTauriInvoke();

  if (finishButton) {
    finishButton.disabled = true;
    finishButton.dataset.state = "working";
  }

  updateCompleteState({
    status: "正在收尾安装结果...",
    finishing: true,
  });

  try {
    if (invoke && !state.previewMode) {
      const shortcutResult = await applyShortcutOptions(state.completeOptions);
      if (shortcutResult.warnings.length > 0) {
        updateCompleteState({
          status: `安装已完成；${shortcutResult.warnings.join("；")}`,
        });
      }

      if (state.completeOptions.launchAfterInstall) {
        updateCompleteState({
          status: "正在启动提示词管家...",
        });
        try {
          await invoke("launch_installed_app", {
            targetDir: state.installPath,
          });
        } catch (error) {
          updateCompleteState({
            status: String(error || "启动提示词管家失败，安装窗口将继续退出。"),
          });
        }
      }
    }

    await closeCurrentWindow();
  } catch (error) {
    updateCompleteState({
      status: String(error || "完成收尾操作失败，请手动启动提示词管家。"),
      finishing: false,
    });

    if (finishButton) {
      finishButton.disabled = false;
      finishButton.dataset.state = "ready";
    }
  }
}

renderCurrentStep();
