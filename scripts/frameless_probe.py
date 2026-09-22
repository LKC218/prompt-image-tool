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


def main():
    try:
        import webview

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
        threading.Thread(target=closer, args=(window,), daemon=True).start()
        webview.start()
        info["start"] = "ok"
    except Exception as e:
        info["error"] = f"{type(e).__name__}: {e}"
        info["trace"] = traceback.format_exc()
    print(info)


if __name__ == "__main__":
    main()
