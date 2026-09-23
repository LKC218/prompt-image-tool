import threading
import time
import traceback

info = {}


def closer(window):
    time.sleep(1.2)
    try:
        window.destroy()
    except Exception as e:
        info["destroy_err"] = str(e)


def read_caption_style(window):
    if not hasattr(__import__("sys"), "platform") or __import__("sys").platform != "win32":
        return None
    try:
        import ctypes

        GWL_STYLE = -16
        WS_CAPTION = 0x00C00000
        hwnd = 0
        native = getattr(window, "native", None)
        if native is not None:
            handle = getattr(native, "Handle", None)
            if handle is not None:
                if hasattr(handle, "ToInt64"):
                    hwnd = int(handle.ToInt64())
                elif hasattr(handle, "value"):
                    hwnd = int(handle.value)
                else:
                    try:
                        hwnd = int(handle)
                    except (TypeError, ValueError):
                        hwnd = 0
        if not hwnd:
            hwnd = int(ctypes.windll.user32.GetForegroundWindow())
        style = ctypes.windll.user32.GetWindowLongW(hwnd, GWL_STYLE)
        return {
            "hwnd": hwnd,
            "style": f"{style:#x}",
            "has_ws_caption": bool(style & WS_CAPTION),
        }
    except Exception as e:
        return {"error": str(e)}


def main():
    try:
        import webview
        from pathlib import Path
        import sys

        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "build"))
        # Import strip helper from app_main without running the server.
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "app_main_helpers",
            Path(__file__).resolve().parents[1] / "build" / "app_main.py",
        )
        # Avoid executing app_main (starts servers). Inline the strip logic instead.
        def strip_native_caption(window, log=None):
            if sys.platform != "win32":
                return False
            try:
                import ctypes

                GA_ROOT = 2
                GWL_STYLE = -16
                WS_CAPTION = 0x00C00000
                WS_SYSMENU = 0x00080000
                WS_BORDER = 0x00800000
                WS_DLGFRAME = 0x00400000
                WS_THICKFRAME = 0x00040000
                WS_MINIMIZEBOX = 0x00020000
                WS_MAXIMIZEBOX = 0x00010000
                SWP_NOSIZE = 0x0001
                SWP_NOMOVE = 0x0002
                SWP_NOZORDER = 0x0004
                SWP_FRAMECHANGED = 0x0020
                DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE = 19
                DWMWA_USE_IMMERSIVE_DARK_MODE = 20
                hwnd = 0
                native = getattr(window, "native", None)
                if native is not None:
                    handle = getattr(native, "Handle", None)
                    if handle is not None:
                        if hasattr(handle, "ToInt64"):
                            hwnd = int(handle.ToInt64())
                        elif hasattr(handle, "value"):
                            hwnd = int(handle.value)
                        else:
                            try:
                                hwnd = int(handle)
                            except (TypeError, ValueError):
                                hwnd = 0
                user32 = ctypes.windll.user32
                if hwnd:
                    hwnd = int(user32.GetAncestor(hwnd, GA_ROOT) or 0)
                if not hwnd:
                    hwnd = int(user32.GetForegroundWindow())
                if not hwnd:
                    return False
                style = user32.GetWindowLongW(hwnd, GWL_STYLE)
                style &= ~(WS_CAPTION | WS_SYSMENU | WS_BORDER | WS_DLGFRAME)
                style |= WS_THICKFRAME | WS_MINIMIZEBOX | WS_MAXIMIZEBOX
                user32.SetWindowLongW(hwnd, GWL_STYLE, style)
                user32.SetWindowPos(
                    hwnd, 0, 0, 0, 0, 0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED,
                )
                try:
                    class MARGINS(ctypes.Structure):
                        _fields_ = [
                            ("cxLeftWidth", ctypes.c_int),
                            ("cxRightWidth", ctypes.c_int),
                            ("cyTopHeight", ctypes.c_int),
                            ("cyBottomHeight", ctypes.c_int),
                        ]
                    ctypes.windll.dwmapi.DwmExtendFrameIntoClientArea(
                        hwnd, ctypes.byref(MARGINS(-1, -1, -1, -1))
                    )
                except Exception as dwm_err:
                    info["dwm_extend_err"] = str(dwm_err)
                try:
                    dark = ctypes.c_int(0)
                    dwm = ctypes.windll.dwmapi
                    for attr in (DWMWA_USE_IMMERSIVE_DARK_MODE, DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE):
                        try:
                            dwm.DwmSetWindowAttribute(
                                hwnd, attr, ctypes.byref(dark), ctypes.sizeof(dark)
                            )
                        except Exception:
                            pass
                    try:
                        DWMWA_BORDER_COLOR = 34
                        DWMWA_COLOR_NONE = 0xFFFFFFFE
                        border = ctypes.c_uint(DWMWA_COLOR_NONE)
                        dwm.DwmSetWindowAttribute(
                            hwnd, DWMWA_BORDER_COLOR, ctypes.byref(border), ctypes.sizeof(border)
                        )
                    except Exception:
                        pass
                except Exception as dark_err:
                    info["dwm_dark_err"] = str(dark_err)
                return True
            except Exception as exc:
                if log:
                    log(str(exc))
                info["strip_err"] = str(exc)
                return False

        class Api:
            def ping(self):
                return "pong"

        api = Api()
        window = webview.create_window(
            title="frameless-probe",
            html="<!doctype html><html><body style='font-family:sans-serif;padding:16px'>frameless probe</body></html>",
            width=480,
            height=240,
            frameless=True,
            easy_drag=False,
            js_api=api,
        )
        info["frameless"] = window.frameless
        info["easy_drag"] = window.easy_drag
        info["has_js_api"] = window._js_api is api

        def on_shown(*_a, **_k):
            info["before_strip"] = read_caption_style(window)
            info["stripped"] = strip_native_caption(window)
            info["after_strip"] = read_caption_style(window)
            threading.Thread(target=closer, args=(window,), daemon=True).start()

        try:
            window.events.shown += on_shown
        except Exception:
            threading.Thread(target=closer, args=(window,), daemon=True).start()

        webview.start()
        info["start"] = "ok"
    except Exception as e:
        info["error"] = f"{type(e).__name__}: {e}"
        info["trace"] = traceback.format_exc()
    print(info)


if __name__ == "__main__":
    main()
