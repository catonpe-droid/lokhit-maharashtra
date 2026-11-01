# ANIK Server: Lokhit News Publishing Bridge (.NET 8)

The main news portal remains hosted entirely on GitHub Pages. This optional API enables the public-facing news editor to submit **new articles** directly into the GitHub repository without entering a GitHub token in the browser.

## Deployment (ANIK IIS or isolated VM)

1. Install .NET 8 ASP.NET Core Hosting Bundle on the server (if IIS). Publish this app as a separate app/website.
2. Configure environment variables **on the server only**:
   - `ANIK_NEWS_GITHUB_TOKEN` — GitHub fine-grained token, repository `catonpe-droid/lokhit-maharashtra`, `Contents: Read and write`.
   - `ANIK_NEWS_PUBLISH_ENABLED=true`
   - `ANIK_NEWS_ALLOWED_REMOTE_IPS` — allowed operator client IP addresses separated by commas.
   - `ANIK_NEWS_SITE_ORIGIN=https://catonpe-droid.github.io`
3. Restrict the API at the IIS/firewall/VPN layer so it is **not accessible to anonymous internet clients**. It intentionally has no interactive login, so a public endpoint is a public write capability. CORS is not authentication. When behind a reverse proxy, validate that IP filtering sees the real operator IP; never trust arbitrary X-Forwarded-For headers. Use separate app pool and keep it away from ANIK financial systems.
4. Serve the API over HTTPS. Set its **publicly reachable (from authorized clients)** base URL in `admin/test/config.json` as `publish_api_url`, e.g. `https://news-api.yourdomain.example` (example only).
5. Open `/admin/` on GitHub Pages. Write an article, choose a photo and select **Publish to GitHub**. The API writes a JPEG (if provided) and an article JSON to GitHub. Existing `.github/workflows/pages.yml` builds the HTML and social tags; the browser waits for the specific article's live HTML before displaying the share link.

## Testing

- `dotnet run --project backend/anik-news-api` (from repo root, with correct env vars).
- GET `/health` shows `publishingConfigured`. It does not validate that the caller IP is permitted.
- Publishing is disabled by default unless BOTH `ANIK_NEWS_PUBLISH_ENABLED=true` and a nonempty token and IP allowlist are present.
- Photos are limited to optimized JPEG <=950 KB, request body <=2.5 MB.
- Server keeps GitHub token private. No token is stored in GitHub Pages or localStorage.
- This starter API creates only new stories; editing/deleting published articles should be added separately with conflict control, editorial audit log, and backups.

## Deployment caveat

Using ANIK merely for permission handling does **not** make GitHub Pages deployment instantaneous. GitHub Actions/Pages will still take time; the editor only offers WhatsApp share after the public article HTML and photo are ready.
