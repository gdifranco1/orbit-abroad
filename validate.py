#!/usr/bin/env python3
"""Validate Orbit Abroad's static launch package."""
from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).parent
PAGES = [ROOT / "index.html", ROOT / "app.html", ROOT / "privacy.html"]
REQUIRED = [
    "site.css", "site.js", "app.css", "app.js", "core.js", "smart-inbox.js",
    "manifest.webmanifest", "service-worker.js", "privacy.html", "assets/icon.svg",
    "assets/icon-192.png", "assets/icon-512.png", "assets/og-card.png",
    "sitemap.xml", "robots.txt", "404.html", "LICENSE", ".nojekyll", "DEPLOYMENT.md",
    ".github/ISSUE_TEMPLATE/beta-feedback.md",
]
PRODUCTION_ORIGIN = "https://gdifranco1.github.io/orbit-abroad/"


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: list[str] = []
        self.links: list[str] = []
        self.title = False
        self.description = False
        self.csp = False
        self.canonical = ""
        self.lang = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = dict(attrs)
        if tag == "html":
            self.lang = data.get("lang") or ""
        element_id = data.get("id")
        if element_id:
            self.ids.append(element_id)
        if tag in {"a", "link", "script", "img"}:
            target = data.get("href") or data.get("src")
            if target:
                self.links.append(target)
        if tag == "title":
            self.title = True
        if tag == "meta" and data.get("name") == "description" and data.get("content"):
            self.description = True
        if tag == "meta" and data.get("http-equiv") == "Content-Security-Policy" and data.get("content"):
            self.csp = True
        if tag == "link" and data.get("rel") == "canonical":
            self.canonical = data.get("href") or ""


def fail(message: str, errors: list[str]) -> None:
    errors.append(message)


def main() -> int:
    errors: list[str] = []
    for relative in REQUIRED:
        if not (ROOT / relative).is_file():
            fail(f"Missing required file: {relative}", errors)

    for page in PAGES:
        parser = PageParser()
        parser.feed(page.read_text(encoding="utf-8"))
        if not parser.title:
            fail(f"{page.name}: missing title", errors)
        if not parser.description:
            fail(f"{page.name}: missing meta description", errors)
        if not parser.csp:
            fail(f"{page.name}: missing Content Security Policy", errors)
        if not parser.canonical.startswith(PRODUCTION_ORIGIN):
            fail(f"{page.name}: wrong canonical URL: {parser.canonical}", errors)
        if parser.lang != "en-US":
            fail(f"{page.name}: html lang must be en-US", errors)
        duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
        if duplicates:
            fail(f"{page.name}: duplicate IDs: {', '.join(duplicates)}", errors)
        for link in parser.links:
            parsed = urlparse(link)
            if parsed.scheme in {"http", "https", "mailto", "data"} or link.startswith("#"):
                continue
            target = link.split("#", 1)[0].split("?", 1)[0]
            if target and not (ROOT / target).exists():
                fail(f"{page.name}: broken local reference: {link}", errors)

    manifest = json.loads((ROOT / "manifest.webmanifest").read_text(encoding="utf-8"))
    for key in ["name", "short_name", "start_url", "display", "icons"]:
        if not manifest.get(key):
            fail(f"Manifest missing: {key}", errors)
    if manifest.get("display") != "standalone":
        fail("Manifest display must be standalone", errors)
    sizes = {icon.get("sizes") for icon in manifest.get("icons", [])}
    if not {"192x192", "512x512"}.issubset(sizes):
        fail("Manifest needs 192x192 and 512x512 icons", errors)

    worker = (ROOT / "service-worker.js").read_text(encoding="utf-8")
    cached = set(re.findall(r'"\.\/([^"?]+)"', worker))
    for needed in ["index.html", "app.html", "privacy.html", "app.css", "app.js"]:
        if needed not in cached:
            fail(f"Service worker does not cache: {needed}", errors)

    headers = (ROOT / "_headers").read_text(encoding="utf-8")
    for header in ["Content-Security-Policy", "Referrer-Policy", "X-Content-Type-Options", "Permissions-Policy"]:
        if header not in headers:
            fail(f"Security headers missing: {header}", errors)

    searchable = "\n".join(path.read_text(encoding="utf-8", errors="ignore") for path in ROOT.glob("*.html"))
    for forbidden in ["example.com", "github.com/cameron", "cameron.github.io"]:
        if forbidden.lower() in searchable.lower():
            fail(f"Forbidden placeholder or owner reference: {forbidden}", errors)
    robots = (ROOT / "robots.txt").read_text(encoding="utf-8")
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    if f"{PRODUCTION_ORIGIN}sitemap.xml" not in robots:
        fail("robots.txt has the wrong sitemap URL", errors)
    if PRODUCTION_ORIGIN not in sitemap:
        fail("sitemap.xml has the wrong production origin", errors)

    if errors:
        print("LAUNCH VALIDATION FAILED")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"LAUNCH VALIDATION PASSED: {len(PAGES)} pages, {len(REQUIRED)} required assets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
