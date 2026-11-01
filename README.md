# लोकहित महाराष्ट्र — मराठी डिजिटल न्यूज पोर्टल

> मूळ ब्रँडिंगसह स्वतंत्र मराठी मिनी-CMS. Sarkarnama च्या बातमी-पोर्टल प्रकारातील मांडणीची प्रेरणा; मूळ साइटची नक्कल नाही.

## काय तयार आहे?

- Responsive Marathi homepage + 20 original factual news/explainer stories, all with symbolic AI-generated photo thumbnails.
- Category landing pages, full article pages, latest headlines, search, YouTube video embed (paste any YouTube link into the body or video field), RSS, sitemap, robots.txt, and JSON-LD NewsArticle.
- Per-article Open Graph / Twitter meta tags for WhatsApp, Facebook, X thumbnails.
- Administrative panel at `/admin/`: drafts, news CRUD, image upload, video link, featured flag, preview, editor, SEO snippet.
- Detailed static legal and editorial pages. **Editor name, real postal address, grievance officer and contact email are still required before launch.**
- GitHub Actions publishes site when content/posts or assets change. No central web server is required for reading the news.

## GitHub वर प्रत्यक्ष सुरू करण्याची पद्धत

1. GitHub वर आपल्या खात्यात **नवीन public repository** `lokhit-maharashtra` तयार करा. Existing `newstrendus` रिपॉझिटरी बदलू नका.
2. या ZIP मधील **मूळ project files** (म्हणजे `build.py`, `site.json`, `content/`, `assets/`, `admin/`, `.github/`) `main` branch मध्ये अपलोड करा. `docs/` pre-built site आहे; ते ऐच्छिक आहे.
3. Repo → Settings → Pages → **Source: GitHub Actions** निवडा.
4. Actions मधील `Publish Lokhit Maharashtra` workflow चालू होईल. तयार URL `https://catonpe-droid.github.io/lokhit-maharashtra/` असेल, पण प्रत्यक्ष deployment झाल्यावरच वापरता येईल.
5. Custom domain घेतल्यावर `site.json` मधील `site_url` आणि `base_path` अपडेट करा (`base_path` हे `/`). मग workflow पुन्हा चालवा.

## Admin कसे चालते?

- Visit: `https://catonpe-droid.github.io/lokhit-maharashtra/admin/` **deployment नंतर**.
- Display-only username: `admin`; display-only pass: `1234` (not secure — anyone can read it in JS).
- **Real publishing authentication:** GitHub **fine-grained Personal Access Token** with access only to `lokhit-maharashtra`, permissions **Contents: Read and Write**; token is supplied in the admin login page, used via HTTPS for GitHub REST API; not stored in repo or browser storage. Never share it in chat.
- There is NO safe password authentication with just GitHub Pages. For a genuine private password-based admin, add a server-side auth provider (Cloudflare Worker, Netlify Identity or equivalent) and move secrets off the client.
- After saving an article, GitHub Actions rebuilds the static page. A YouTube URL becomes an embedded player on the article page; the software does **not upload videos to your YouTube channel**.
- For new admin users, grant write rights only through repository permissions. Use 2FA on GitHub.

## Website configuration

Edit `site.json`:

```json
{"site_url":"https://catonpe-droid.github.io/lokhit-maharashtra/","base_path":"/lokhit-maharashtra/","github_repo":"catonpe-droid/lokhit-maharashtra"}
```

Do not use an `http:` URL for production. Your real domain must match Open Graph / canonical URLs so link thumbnails display correctly.

## Build locally

```bash
python3 seed_content.py  # initial setup ONLY; overwrites seed articles, do not run after editing content
python3 make_images.py   # initial setup ONLY; requires the original collage from conversation, not needed for publishing
python3 build.py
```

`docs/` contains a ready-to-open pre-built site. For a quick preview via local static server, use `SITE_BASE=/ SITE_URL=https://localhost.invalid/ python3 build.py` and serve `docs/` as web root. Use normal production config before GitHub publish.

## Quality / editorial notes

- **20 initial stories are newly written explanatory pieces, not on-the-ground reporting.** Recheck factual claims and status before actual release. Editorial checking references are preserved in `EDITORIAL_REFERENCES.json` for editorial verification, but are not falsely presented as interviews conducted by the portal.
- All article photos are AI-generated representative illustrations. They are labeled accordingly.
- Avoid publishing copyrighted photographs/articles copied from other news sites.
- News category and legal page templates are included; check legal obligations and editorial contact disclosure before public launch.
- The logo is supplied by the site owner.
- Site search works against published `posts-index.json`.

## Folder map

```text
├── build.py                         # full static HTML / SEO generator
├── site.json                        # domain and site settings
├── content/posts/*.json             # source of truth for news
├── assets/css/, assets/js/, assets/img/
├── admin/index.html                 # admin editor
├── .github/workflows/pages.yml      # auto deploy on edits
├── EDITORIAL_REFERENCES.json        # private editorial checking notes
└── docs/                             # pre-built 53 pages for preview
```
