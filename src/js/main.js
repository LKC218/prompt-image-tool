import { initStorage, isCapacitor } from './storage.js';

function detectUI() {
    const params = new URLSearchParams(window.location.search);
    const forceUI = params.get('ui');
    if (forceUI === 'mobile' || params.has('mobile')) return 'mobile';
    if (forceUI === 'pc') return 'pc';

    if (isCapacitor) return 'mobile';

    if (window.__TAURI__) return 'pc';

    if ('ontouchstart' in window && window.innerWidth < 768) return 'mobile';

    return 'pc';
}

async function init() {
    try {
        await initStorage();

        const ui = detectUI();
        const splash = document.getElementById('splashScreen');

        if (ui === 'mobile') {
            const mobileApp = document.getElementById('mobileApp');
            mobileApp.style.display = 'flex';
            const { mount: mountMobile } = await import('./mobile-app.js');
            await mountMobile(mobileApp);
        } else {
            const pcApp = document.getElementById('pcApp');
            pcApp.style.display = 'flex';
            const { mount: mountPc } = await import('./pc-app.js');
            await mountPc(pcApp);
        }

        if (splash) {
            splash.classList.add('splash-hide');
            setTimeout(() => splash.remove(), 500);
        }
    } catch (e) {
        console.error('App init error:', e);
        const splash = document.getElementById('splashScreen');
        if (splash) {
            splash.innerHTML = `
                <div class="splash-content">
                    <div style="font-size:48px;margin-bottom:16px;">😵</div>
                    <div style="font-size:16px;color:#FF5A5A;">启动失败：${e.message || '未知错误'}</div>
                    <button onclick="location.reload()" style="margin-top:16px;padding:8px 24px;border-radius:8px;border:1px solid #E9E2DA;background:#fff;cursor:pointer;font-size:14px;">重试</button>
                </div>
            `;
        }
    }
}

document.addEventListener('DOMContentLoaded', init);
