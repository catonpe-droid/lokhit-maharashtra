# CURRENT RECOMMENDED THEME — V6 Blogger-Only Links (2 November 2026)

**Use [blogger-theme-blogger-only-v6.xml](./blogger-theme-blogger-only-v6.xml)** for new theme installations after backup. It retains V5's Layout Manager and V4 article share controls, while replacing 20 static news link destinations with actual Blogger article permalinks, converting category links (e.g. `vibhag/marathwada/`) to Blogger `/search/label/...` URLs, rewriting old GitHub article/menu URLs in user-configured gadgets at runtime, and rendering Blogger-native category grids when needed.

**Blogspot Pages:** the blog currently contains 21 Posts and **0 Pages**, so About, Contact, Live TV and legal pages cannot be complete until the [12-page cleaned import](./pages-import-clean.xml) is imported. V6 maps their links to Blogger `/p/...` routes and will discover the actual page permalinks from Blogger's pages feed after import. Do not assume guessed page URLs work before import. The page import file has been cleaned of duplicate GitHub tickers and site wrappers.

**Install order:** back up current Blogger Theme; upload V6 through Theme → Restore → Upload; verify the Blogger Marathwada menu link and a news article; then separately import Pages through Settings → Manage blog → Import content (once, with backup) and check About / Contact / Live TV. **Do not reimport the 21 existing Posts.** The original GitHub Pages site remains unmodified and direct GitHub URLs remain reachable; only Blogger-origin navigation changes.

**Validation:** local XML structure, known entities, and inline JavaScript syntax pass. Actual installation on Blogger and page-import behavior are NOT yet live-verified.

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
