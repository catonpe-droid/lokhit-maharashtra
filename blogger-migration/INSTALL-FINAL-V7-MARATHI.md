# लोकहित महाराष्ट्र — अंतिम V7 एकत्रित Theme

## फक्त दोन गोष्टी Blogger मध्ये कराव्या लागतील

1. Theme → Backup → Restore → Upload → `LOKHIT-MAHARASHTRA-FINAL-V7.xml`.
2. Settings → Manage blog → Import content → `pages-import-clean.xml` (only once, as current public Pages feed reports zero pages).

**21 जुनी व 1 नवीन बातमी पुन्हा Import करू नका.** Original GitHub Pages website untouched.

## Blogger Layout मधील तयार Edit options

- Main Menu (LinkList101): Main Menu title, links, order.
- Homepage Sections (LinkList102): Home Section title, order, count. Example: `शेती | 6` and the corresponding Blogger label URL.
- Breaking News (LinkList103): ticker links.
- Main Hero Slider (LinkList104): featured Blogger article URLs.
- Right cards (LinkList105): recent cards.
- Footer (LinkList106): Footer and legal links.
- Remaining Layout regions: Header, optional homepage top/after slider/after latest/bottom, homepage sidebar, article sidebar, footer content.

## New post image

New post's first image is promoted to the featured article image and displayed at responsive full column width without fixed 400px constraints. Blogger image URL is requested at a larger size. For genuinely sharp images, upload originals at least 1200px wide; 438px originals do not gain detail by upscaling.

## Routes and Pages

Marathwada, Maharashtra, drought and other section URLs point to Blogger `/search/label/...`; news permalink links point to Blogger posts; CSS/JS/photo assets remain hosted on GitHub without sending readers to GitHub pages. The 12 About, Contact, Live TV and English legal pages require the **separate cleaned Pages import** for correct native Blogger pages.

Local XML balancing, entity checks, and JavaScript parsing passed. Blogger live upload and functional QA remain unverified until user uploads it. This final variant supersedes prior V2/V3/V4/V5/V6.

Theme: https://github.com/catonpe-droid/lokhit-maharashtra/blob/blogger-migration-preview/blogger-migration/LOKHIT-MAHARASHTRA-FINAL-V7.xml
Pages: https://github.com/catonpe-droid/lokhit-maharashtra/blob/blogger-migration-preview/blogger-migration/pages-import-clean.xml