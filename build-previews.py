#!/usr/bin/env python3
"""Build self-contained HTML previews for the Hermes desktop pane."""
from pathlib import Path

ROOT = Path(__file__).parent


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def write(name: str, content: str) -> None:
    (ROOT / name).write_text(content, encoding="utf-8")
    print(f"built {name} ({len(content)} characters)")


def preview_url(name: str) -> str:
    return (ROOT / name).resolve().as_uri()


def without_pwa_links(html: str) -> str:
    lines = [
        line for line in html.splitlines()
        if 'rel="manifest"' not in line
        and 'rel="icon"' not in line
        and 'http-equiv="Content-Security-Policy"' not in line
    ]
    return "\n".join(lines) + "\n"


def landing_preview() -> None:
    html = without_pwa_links(read("index.html"))
    html = html.replace('<link rel="stylesheet" href="site.css">', f"<style>\n{read('site.css')}\n</style>")
    html = html.replace('<script src="site.js"></script>', f"<script>\n{read('site.js')}\n</script>")
    html = html.replace('href="app.html"', f'href="{preview_url("app-preview.html")}"')
    html = html.replace('href="privacy.html"', f'href="{preview_url("privacy-preview.html")}"')
    write("preview.html", html)


def app_preview() -> None:
    html = without_pwa_links(read("app.html"))
    html = html.replace('<link rel="stylesheet" href="app.css">', f"<style>\n{read('app.css')}\n</style>")
    html = html.replace('<script src="core.js"></script>', f"<script>\n{read('core.js')}\n</script>")
    html = html.replace('<script src="smart-inbox.js"></script>', f"<script>\n{read('smart-inbox.js')}\n</script>")
    html = html.replace('<script src="app.js"></script>', f"<script>\n{read('app.js')}\n</script>")
    html = html.replace('href="index.html"', f'href="{preview_url("preview.html")}"')
    html = html.replace('href="privacy.html"', f'href="{preview_url("privacy-preview.html")}"')
    write("app-preview.html", html)


def privacy_preview() -> None:
    html = without_pwa_links(read("privacy.html"))
    html = html.replace('<link rel="stylesheet" href="site.css">', f"<style>\n{read('site.css')}\n</style>")
    html = html.replace('href="index.html"', f'href="{preview_url("preview.html")}"')
    html = html.replace('href="app.html"', f'href="{preview_url("app-preview.html")}"')
    write("privacy-preview.html", html)


if __name__ == "__main__":
    landing_preview()
    app_preview()
    privacy_preview()
