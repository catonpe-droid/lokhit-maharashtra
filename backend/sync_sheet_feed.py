#!/usr/bin/env python3
"""Sync published news + editor settings into the existing GitHub Pages website.
Only Google Apps Script's public read-only feed is used, no user PAT or credentials.
Run from GitHub Actions every five minutes; preserve original/unsynced news files.
"""
import json
import pathlib
import re
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
POSTS = ROOT / "content" / "posts"
MANIFEST = ROOT / "content" / "sheet-sync-manifest.json"
FEED = ("https://script.google.com/macros/s/"
        "AKfycby68PcZ0he76x-zkhbVtmoa2EBQcdvfQhCFplpDx12oVxX7DpUbMfiMBznjE5nOoLE"
        "/exec?feed=1&callback=lokhitImport")
SLUG = re.compile(r"^[a-z0-9][a-z0-9_-]{2,110}$")
HTTPS = re.compile(r"^https://", re.I)

def read_json(path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return fallback

def save_if_changed(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(obj, ensure_ascii=False, indent=2) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == body:
        return False
    path.write_text(body, encoding="utf-8")
    return True

def download_feed():
    req = urllib.request.Request(
        FEED, headers={"User-Agent": "Lokhit-GitHub-Publisher/1.0", "Accept": "application/javascript"})
    with urllib.request.urlopen(req, timeout=45) as res:
        raw = res.read(4_000_001)
    if len(raw) > 4_000_000:
        raise RuntimeError("Feed exceeded safety size")
    text = raw.decode("utf-8-sig").strip()
    match = re.fullmatch(r"lokhitImport\((\{.*\})\);?", text, flags=re.S)
    if not match:
        raise RuntimeError("Unexpected or unconfigured Google Sheet feed response")
    data = json.loads(match.group(1))
    if not isinstance(data, dict) or data.get("ok") is not True or not isinstance(data.get("posts"), list):
        raise RuntimeError("Invalid Google Sheet news feed")
    return data

def main():
    data = download_feed()
    former = read_json(MANIFEST, {"managedSlugs": []})
    managed = set(former.get("managedSlugs") or [])
    updated = False
    seen = set()
    for item in data["posts"]:
        if not isinstance(item, dict) or item.get("status") != "published":
            continue
        slug = str(item.get("slug") or "").strip().lower()
        if not SLUG.fullmatch(slug) or slug in seen:
            continue
        path = POSTS / (slug + ".json")
        if path.exists() and slug not in managed and item.get("origin") != "github_override":
            print("Preserving unedited original GitHub article:", slug)
            continue
        seen.add(slug)
        image = str(item.get("image") or "")
        if not HTTPS.match(image) and not re.fullmatch(r"assets/img/[a-zA-Z0-9._/-]+", image):
            image = "assets/img/logo.webp"
        title = str(item.get("title") or "").strip()[:180]
        body = str(item.get("body") or "").strip()[:50000]
        description = str(item.get("description") or "").strip()[:500]
        if not title or not body or not description:
            print("Skipping incomplete article:", slug)
            continue
        article = {
            "slug": slug, "title": title, "description": description,
            "category": str(item.get("category") or "महाराष्ट्र")[:65],
            "body": body, "image": image,
            "author": str(item.get("author") or "लोकहित महाराष्ट्र")[:100],
            "date": str(item.get("date") or datetime.now(timezone.utc).isoformat())[:40],
            "updated": str(item.get("updated") or item.get("date") or "")[:40],
            "video": str(item.get("video") or "")[:600],
            "featured": bool(item.get("featured")), "status": "published"
        }
        updated |= save_if_changed(path, article)
    # Previous Sheet-managed stories no longer published are removed, never original stories.
    for slug in managed - seen:
        if not SLUG.fullmatch(slug):
            continue
        path = POSTS / (slug + ".json")
        if path.exists():
            path.unlink()
            updated = True
    if seen != managed:
        save_if_changed(MANIFEST, {"managedSlugs": sorted(seen)})
        updated = True

    layout = data.get("layout")
    if isinstance(layout, dict) and isinstance(layout.get("menu"), list) and isinstance(layout.get("slider"), list):
        path = ROOT / "content" / "layout.json"
        old = read_json(path, {})
        keys = ("menu", "slider", "slider_seconds", "breaking")
        updated |= save_if_changed(path, {**old, **{k: layout[k] for k in keys if k in layout}})
    site = data.get("site")
    if isinstance(site, dict):
        path = ROOT / "site.json"
        old = read_json(path, {})
        editable = ("name", "tagline", "description", "editor_name", "contact_email",
                    "youtube_live_url", "youtube_live_provider", "youtube_live_channel_id",
                    "youtube_live_channel_url", "youtube_url", "facebook_url", "instagram_url",
                    "twitter_url")
        changed = {k: site[k] for k in editable if isinstance(site.get(k), str)}
        if changed:
            updated |= save_if_changed(path, {**old, **changed})
    print("Google Sheet news sync:", len(seen), "published", "updated" if updated else "already current")

if __name__ == "__main__":
    main()
