# लोकहित महाराष्ट्र — Gmail Login (Zero additional monthly hosting cost)

Status: Code prepared. **Google login cannot work until Google OAuth and Cloudflare Worker are connected once.** Never commit a GitHub token, OAuth client secret or Gmail password to this repository.

## One-time connection (by site owner)
1. Make a free [Cloudflare Workers](https://dash.cloudflare.com/) account and deploy `backend/worker.js` as a Worker named e.g. `lokhit-admin`. Free tier limits apply.
2. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth 2.0 **Web application** client for Google Identity Services. Authorized JavaScript origin: `https://catonpe-droid.github.io`. If you later use a custom domain, add its HTTPS origin as well. Complete OAuth consent branding if required. Copy the **Client ID only**; it is not a secret.
3. In the Cloudflare Worker's **Variables & Secrets** set:
   - `GOOGLE_CLIENT_ID` (text) = the Google OAuth Web Client ID
   - Approved Gmail: already fixed in the Worker by its SHA-256 email fingerprint; no Gmail address needs to be entered in the public repository. The optional `ADMIN_EMAIL_SHA256` text variable can override the fingerprint for a future editor change.
   - `SITE_ORIGINS` (text) = `https://catonpe-droid.github.io` (later add custom domain)
   - `GITHUB_TOKEN` (Secret) = one repository-scoped GitHub fine-grained token with Contents: Read/write on `catonpe-droid/lokhit-maharashtra`. This is configured **once in the backend**, never supplied by editors, never exposed to the website and never pasted into chat.
4. Edit `admin/google/config.json` and supply only the public Worker URL, e.g. `"worker_url":"https://lokhit-admin.<your-subdomain>.workers.dev"`. Do not put secrets in that file.
5. Open `https://catonpe-droid.github.io/lokhit-maharashtra/admin/google/` and click **Sign in with Google**. Only the allowlisted Gmail account will be authorized.
6. Test with a **draft** article, then a published article, then confirm GitHub Actions and public site update.
7. After successful end-to-end verification, change the main `/admin/` link to the Gmail editor. Do **not** switch before verifying publishing.

## What stays the same
The public news website and all articles continue to be generated in the GitHub repo via `build.py` and GitHub Pages. Cloudflare only authenticates an editor and performs server-side GitHub writes; it does not host or move the public site. No regular token entry; editor signs in with Google.

## Security
- Only allowed Gmail addresses may publish.
- Google ID tokens are validated by the Worker against Google public signing keys, app audience, issuer, verified email and expiry.
- GitHub token must stay in Cloudflare secret, never in public code or GitHub Pages.
- User-requested `admin/1234` is not used: publishing with a publicly visible fixed password on GitHub Pages would not be secure.
- Google browser token is kept in page memory; re-login may be needed when it expires.
- Only the single pre-approved Gmail may publish, as checked against the verified Google identity. No wildcard Gmail access is allowed.
