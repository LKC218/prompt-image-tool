"""Capture README preview screenshots from the local dev server."""

from __future__ import annotations

import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "assets" / "readme"
PC_BASE = "http://127.0.0.1:5173/?ui=pc"
MOBILE_BASE = "http://127.0.0.1:5173/?ui=mobile"


def dismiss_release_notes(page) -> None:
    try:
        page.evaluate("localStorage.setItem('pc-release-notes-last-seen-version', '2.5.0')")
    except Exception:
        pass
    close = page.locator('[data-release-close], .pc-release-notes-actions button').first
    if close.count() > 0 and close.is_visible():
        try:
            close.click(timeout=2000)
            page.wait_for_timeout(400)
        except Exception:
            pass
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    overlay = page.locator("#pcModalOverlay.pc-modal-active")
    if overlay.count() > 0:
        try:
            page.evaluate(
                "document.getElementById('pcModalOverlay')?.classList.remove('pc-modal-active');"
                "document.getElementById('pcModalOverlay')?.classList.remove('pc-modal-visible');"
            )
        except Exception:
            pass


def wait_app(page) -> None:
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(2500)
    dismiss_release_notes(page)


def capture_pc() -> list[Path]:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    shots: list[Path] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,
            locale="zh-CN",
        )
        page = context.new_page()

        page.goto(PC_BASE, wait_until="domcontentloaded")
        wait_app(page)
        home = OUT_DIR / "preview-pc.png"
        page.screenshot(path=str(home), full_page=False)
        shots.append(home)

        def goto_nav(path_label: str, fallback: str) -> None:
            selectors = [
                f'[data-nav="{fallback}"]',
                f'text={path_label}',
            ]
            for sel in selectors:
                loc = page.locator(sel).first
                if loc.count() > 0 and loc.is_visible():
                    try:
                        loc.click(timeout=3000)
                        page.wait_for_timeout(1500)
                        dismiss_release_notes(page)
                        return
                    except Exception:
                        continue
            page.goto(PC_BASE + fallback, wait_until="domcontentloaded")
            page.wait_for_timeout(1500)
            dismiss_release_notes(page)

        goto_nav("提示词库", "/library")
        library = OUT_DIR / "preview-library.png"
        page.screenshot(path=str(library), full_page=False)
        shots.append(library)

        goto_nav("目标计划", "/goals")
        goals = OUT_DIR / "preview-goals.png"
        page.screenshot(path=str(goals), full_page=False)
        shots.append(goals)

        # Open a prompt detail if possible for editor-ish shot
        try:
            goto_nav("提示词库", "/library")
            row = page.locator(".pc-table-row, tbody tr, [data-prompt-row], .pc-prompt-row, [data-prompt-id]").first
            if row.count() > 0:
                row.click()
                page.wait_for_timeout(1200)
                dismiss_release_notes(page)
                detail = OUT_DIR / "preview-detail.png"
                page.screenshot(path=str(detail), full_page=False)
                shots.append(detail)
        except Exception as exc:
            print(f"skip detail shot: {exc}", file=sys.stderr)

        context.close()

        mobile = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
            locale="zh-CN",
        )
        mpage = mobile.new_page()
        mpage.goto(MOBILE_BASE, wait_until="domcontentloaded")
        wait_app(mpage)
        mshot = OUT_DIR / "preview-mobile.png"
        mpage.screenshot(path=str(mshot), full_page=False)
        shots.append(mshot)
        mobile.close()
        browser.close()
    return shots


if __name__ == "__main__":
    paths = capture_pc()
    for path in paths:
        print(path)
