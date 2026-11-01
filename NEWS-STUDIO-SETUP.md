# लोकहित महाराष्ट्र — Rich News Studio (WordPress शैली)

**Status (1 Nov 2026):** GitHub मध्ये Editor, Quill Rich Text, image/video renderer आणि .NET 8 publishing API कोड तयार आहे. GitHub Actions Python tests आणि .NET compile तपासतात. **ANIK Server वर API deploy व HTTPS URL सेट करेपर्यंत Live Publish चालू नाही.**

## News Admin
- Public editor entry: https://catonpe-droid.github.io/lokhit-maharashtra/admin/
- Direct Studio: https://catonpe-droid.github.io/lokhit-maharashtra/admin/studio/
- टेक्स्ट निवडून Bold / Italic / Underline / Heading / bullet/numbered list / link / quote करता येते.
- Cursor ठेवून **फोटो घाला** → एकाच बातमीत ८ पर्यंत वेगवेगळ्या ठिकाणी फोटो; ब्राउझर JPEG मध्ये compress करतो.
- **YouTube घाला** → embed त्या ठिकाणी दिसेल. खालचा स्वतंत्र YouTube field शेवटी व्हिडिओ दाखवतो.
- मुख्य फोटो हे news card आणि WhatsApp/Open Graph साठी वापरले जाते.
- Preview, Local Draft, Published/Draft, Featured, category, author, tags, published news search, edit/delete यांचा समावेश.
- जुनी Plain Text बातमी Edit करता येते; Rich Editor मध्ये पहिल्यांदा उघडल्यावर साधा मजकूर दिसेल.
- **Local Draft** हा केवळ त्या ब्राउझरमध्ये असतो; त्यात नवीन फोटो साठवले जात नाहीत. Server Draft म्हणजे GitHub मध्ये `status=draft` असलेली बातमी, जी वाचकांना दिसणार नाही.

## ANIK Server — एकदाची जोडणी

1. ANIK च्या IIS/isolated VM वर **.NET 8 ASP.NET Core Hosting Bundle** बसवा.
2. Repository मधील `backend/anik-news-api` प्रोजेक्ट publish करून स्वतंत्र IIS application म्हणून HTTPS वर चालवा. ANIK NBFC च्या आर्थिक APIs किंवा मुख्य डेटाबेसपासून वेगळे ठेवा.
3. Server चे Environment Variables (कधीही GitHub repo किंवा Browser मध्ये लिहू नका):
   - `ANIK_NEWS_GITHUB_TOKEN` = फक्त `catonpe-droid/lokhit-maharashtra` repo साठी **Contents: Read and write** असलेला fine-grained GitHub token
   - `ANIK_NEWS_PUBLISH_ENABLED=true`
   - `ANIK_NEWS_ALLOWED_REMOTE_IPS` = editor वापरणाऱ्या अधिकृत client चे public/private IPs, comma-separated
   - `ANIK_NEWS_SITE_ORIGIN=https://catonpe-droid.github.io`
4. API चे **anonymous public access firewall/VPN द्वारे बंद** ठेवा. या परीक्षणात Editor login नसल्यामुळे IP allowlist आणि नेटवर्क प्रवेश नियंत्रण अतिशय आवश्यक आहे. CORS हा सुरक्षा login चा पर्याय नाही. Proxy/Cloudflare/IIS मधून प्रत्यक्ष client IP योग्य दिसतो याची स्वतंत्र चाचणी घ्या; arbitrary `X-Forwarded-For` header वर विश्वास ठेवू नका.
5. अधिकृत नेटवर्कवरून `https://YOUR-ANIK-NEWS-API/health` उघडा; `publishingConfigured=true` तपासा.
6. `admin/test/config.json` मध्ये `publish_api_url` या field मध्ये केवळ **public HTTPS API base URL** द्या. त्या फाईलमध्ये token, PIN, password, client secret अजिबात टाकू नका. Studio त्याच config ला वाचतो.
7. News Studio मध्ये आधी **Draft** Save करा, नंतर test news प्रकाशित करा. GitHub Actions पूर्ण होऊन `/batmi/<slug>/` चा स्वतःचा HTML, `og:title`, `og:image`, revision आणि इतर बातम्या/sidebar दिसतात ते तपासा.
8. WhatsApp वर लिंक share करण्यापूर्वी Studio मधील Live validation पूर्ण व्हावी. GitHub Pages चा HTML build **क्षणात होईलच अशी हमी नाही**.

## API Routes (VPN / IP allowlisted)
- `GET /health` — configuration readiness (publishing permission check नाही)
- `GET /studio/posts` — सर्व published/draft JSON articles
- `POST /studio/save` — create/edit + media upload; image compression browser मध्ये; GitHub मध्ये path-based JSON
- `POST /studio/delete` — news source JSON remove; build नंतर page remove
- `POST /publish` — legacy simple-editor publishing endpoint

## Verification
- `python -m unittest discover -s tests -v` — rich renderer security & formatting
- `dotnet build backend/anik-news-api/AnikNewsApi.csproj -c Release` — API compile
- `python build.py` — static site build
- GitHub workflows automatically run tests and publish on content changes.

## महत्त्वाचे
- मुख्य साइट GitHub Pages वरच राहील; ANIK Server केवळ सुरक्षित News API साठी.
- Google Sheet आवश्यक नाही; `content/posts/*.json` हे News Source of Truth आहे.
- स्वतंत्र Blog/WordPress hosting, MySQL database किंवा Contentful/Sanity खाते लागत नाही.
- वर्तमान IP-only/anonymous Editor scheme मर्यादित testing व approved private network साठी आहे. Internet-wide production किंवा अनेक editors साठी editor-specific authenticated identities, audit logs आणि revision backups जोडणे शिफारसीय.
