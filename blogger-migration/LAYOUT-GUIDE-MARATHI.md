# लोकहित महाराष्ट्र — Blogger Layout Manager V5
Updated: 2 November 2026

**Theme:** [blogger-theme-layout-v5.xml](./blogger-theme-layout-v5.xml)

## Why V5 exists
The GitHub design was carried to Blogger but menu, ticker, hero cards, sidebar and homepage blocks were previously hardcoded. V5 exposes 14 genuine `b:section` layout regions with `showaddelement="yes"`, so Blogger → Layout can offer Add a Gadget / Edit. Each region is **optional**. Until you add gadgets, the public design retains its existing default markup and CSS.

## ONE-TIME installation (test without deleting news)
1. Blogger → **Theme** → Back up your current working V4 theme.
2. Download raw `blogger-theme-layout-v5.xml`.
3. Blogger → **Theme → Restore → Upload** and select the new V5 XML.
4. Check Blogger → **Layout**. You should see the following regions; if any are absent, report the screenshot and do not reimport posts.
5. Check the homepage and one article page on desktop/mobile, WhatsApp share, and links.
6. **Do not reimport / delete the 21 existing news posts.** Theme changes and content import are different workflows.

## Blogger Layout: regions and recommended gadget type
| Section name | Gadget type | What it edits |
|---|---|---|
| SiteHeader | HTML/JavaScript or Image | Use an image to replace current logo. For tagline HTML, provide an element with attribute `data-lokhit-tagline`. |
| MainMenuLinks | Link List | Every top navigation label / URL and its order. When you add items, configured menu replaces the defaults. |
| BreakingNewsLinks | Link List | Breaking news headlines and targets, ticker loops automatically. |
| HeroSliderLinks | Link List | Featured article URLs; article images/titles pulled from current Blogger posts. |
| HeroRightLinks | Link List | Right-hand hero small cards using links to Blogger articles. |
| HomepageSections | Link List | Homepage category blocks and their order. Names should match Blogger Labels; only selected category blocks are shown when configured. |
| HomeTopGadgets | HTML, Image | Content/banner before the main slider. |
| HomeAfterSlider | HTML, Image | New Homepage block immediately after slider. |
| HomeAfterLatest | HTML, Image | New Homepage block after latest news. |
| HomeBottomGadgets | HTML, Image | New Homepage content at bottom. |
| HomeSidebarGadgets | HTML, Image, Popular Posts | Extra cards under right side of homepage slider. |
| ArticleSidebarGadgets | HTML, Image, Popular Posts, Labels | Article-page sidebar alongside auto-generated latest-news list. |
| FooterLinks | Link List | Footer Legal/Policies menu links and order. |
| FooterContent | HTML, Image | Extra footer info, addresses and links. |

## Daily updates without editing code
- **New News:** Blogger → Posts → New Post → title, HTML/text, image, and assign Labels (e.g. `महाराष्ट्र`, `दुष्काळ विशेष`, `शेती`). On homepage, corresponding category grids and latest-news cards update from Blogger feed.
- **Navigation Menu:** Layout → MainMenuLinks → Add a Gadget → Link List → enter title and target for each menu link → Save.
- **Slider:** Layout → HeroSliderLinks → Link List → enter existing Blogger article links; order them in the gadget; save. Images/titles use the linked post. If a linked URL is not an existing Blogger news post, it will not appear in the slider.
- **Breaking News:** Layout → BreakingNewsLinks → Link List → names are ticker headlines, URLs are destination links.
- **Article sidebar:** Layout → ArticleSidebarGadgets → Add a Gadget → HTML/JavaScript or other gadget. Its content is moved to the existing article sidebar at runtime.
- **Homepage sections:** Layout → HomepageSections → Link List → use Blogger label names like `महाराष्ट्र`, `शेती`, `शासन योजना`. Reorder the items to reorder those blocks; removing a listed label hides that block once this controller has been configured. Without this gadget, the original homepage sections stay unchanged.

## Important
- The V5 XML has passed basic local checks for balanced XML tags, known XML entities, and inline JS syntax. **Actual Blogger upload, gadget editing, and live runtime are not yet confirmed.**
- Blogger may add its own widget wrappers or sanitize imported HTML. Perfect 0-pixel parity between GitHub and Blogger cannot be guaranteed.
- The layout gadget configuration works best if the Blogger JSON feed `/feeds/posts/default?alt=json` is accessible. If it is disabled, static homepage cards remain in place.
- All original assets still load from the original GitHub Pages location; do not turn the GitHub website off.
- Public Blogger attribution text is not included, but source/URLs can still reveal Blogger hosting.
- Preserve manual backups before installing any later versions.
