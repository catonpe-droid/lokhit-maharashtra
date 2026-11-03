# FINAL V7 — use this one file (2 November 2026)

**Current consolidated Theme:** [LOKHIT-MAHARASHTRA-FINAL-V7.xml](./LOKHIT-MAHARASHTRA-FINAL-V7.xml).

**Clean native Blogger Pages import:** [pages-import-clean.xml](./pages-import-clean.xml).

**Single installation guide:** [INSTALL-FINAL-V7-MARATHI.md](./INSTALL-FINAL-V7-MARATHI.md).

V7 includes: 14 Blogger Layout regions, six preconfigured LinkList controls for Homepage Sections/Menu/Ticker/Slider/Side Cards/Footer, current Blogger article permalinks, Blogger label category routes, share controls, related news and sidebar, dynamic Homepage cards, and responsive featured Blogger post images.

Image sharpness depends on the original uploaded resolution. The existing Sunil Tatkare post is sourced from a roughly 438px-wide image; requesting 1600px cannot create lost image detail. New high-res image upload is best.

**Testing limits:** local XML structure/entity/JavaScript parsing checks passed; actual Blogger import/upload remains to be tested. No changes made to Blogger account. The GitHub Pages main branch is unchanged. Do not reimport 22 posts.

---
# लोकहित महाराष्ट्र — Blogger migration preview (2 November 2026)

## What has been created

This branch contains a non-production **Blogger migration preview** using the existing GitHub site as the visual source. **The GitHub main branch is unchanged.**

| File | Purpose |
| --- | --- |
| `blogger-theme.xml` | Custom Blogger template using the exact current homepage HTML fragments (header, navigation, homepage content, footer), logo, colors and links to the original CSS/JS assets |
| `news-import-part-1.xml` | First 12 articles with original rendered HTML extracted from `batmi/.../index.html` |
| `news-import-part-2.xml` | Remaining 11 articles, including the 2 test news HTML pages |
| `pages-import.xml` | 12 original information, editorial, privacy, legal, video and Live TV pages |

**23 news articles + 12 pages prepared for import.** The 2 test articles entitled `ddd` and `NEWS BATMI` are deliberately included because the instruction was to retain all published HTML news pages.

## Use on an EMPTY Blogger test site (not the live domain yet)

1. Sign in to Blogger and create a temporary private/unlisted test blog.
2. Go to **Theme → Backup** and save the existing Blogger theme.
3. Go to **Theme → Restore** and upload `blogger-theme.xml`.
4. In **Settings → Manage Blog → Import Content**, import `news-import-part-1.xml` then `news-import-part-2.xml`. Test one import first; **do not import twice** because it could create duplicate posts.
5. Import `pages-import.xml` and verify all 12 imported pages. If Blogger rejects page import, recreate pages using the supplied HTML manually.
6. Check the homepage, 23 articles, the logo, breaking ticker, slider, desktop/mobile view, all image URLs, category links, 12 pages, and post URLs.
7. Only after comparison and manual checks, point a custom domain to Blogger and plan redirects for the old GitHub URLs.

## Important limitations to verify

- **Not yet installed or tested on Blogger**. Theme acceptance, Atom import and rendering require an authenticated Blogger test site and may require adjustments.
- **Zero visual or functional differences cannot be guaranteed**: Blogger generates DOM wrappers, URLs and post markup, which differ from GitHub Pages.
- Current CSS, logo, JS, and original photo assets still load from `https://catonpe-droid.github.io/lokhit-maharashtra/`. Keep GitHub Pages running. This is a migration preview, not independent asset hosting.
- Original homepage's curated content stays as-is. The theme attempts to map imported article hyperlinks using Blogger's public post feed and add **future** new Blogger posts to the latest-news grid; this adapter has not yet been tested live.
- Imported article content is full rendered HTML, including its own surrounding layout, headline, related-news cards, ticker and sharing controls. Blogger may sanitize some markup during import. Recheck after import.
- Page links are remapped only when the Blogger pages JSON feed is available. Unmapped links can still lead to the old GitHub site.
- WhatsApp thumbnails and search-engine metadata must be verified on the real Blogger hostname. Client-side link rewriting does not guarantee crawler-readable canonical paths.
- No visible `Powered by Blogger` widget is included, but platform fingerprints may be detectable through source inspection or Blogger-style URLs.
- Publishing fresh news via the plain Blogger editor may not use every imported article's HTML wrapper automatically; a follow-up post-template or custom editor configuration may be necessary.

## Approval checklist
- [ ] Theme uploads to a Blogger test blog without XML/template errors
- [ ] Both news XML parts import with **23/23 articles**
- [ ] 12 pages import and open
- [ ] Home and article pages compare visually against GitHub on desktop and mobile
- [ ] Internal links, category/search pages and latest articles work
- [ ] WhatsApp link preview uses the correct news image
- [ ] New Blogger posts display in the news section with an appropriate article layout
- [ ] No public Blogger attribution text appears
- [ ] Existing Github main branch and site remain unchanged

All files are generated **only** on the `blogger-migration-preview` branch, for user review before production.
