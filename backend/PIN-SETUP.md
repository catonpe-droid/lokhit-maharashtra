# लोकहित महाराष्ट्र — सोपा PIN Admin

**स्थिती:** PIN UI, १० Editor नावे, बातमी/फोटो/मेनू/स्लायडर/ब्रेकिंग न्यूज Publish API आणि सुरक्षा चाचण्या तयार. सार्वजनिक वेबसाइट GitHub Pages वरच राहील. Cloudflare Worker जोडल्याशिवाय या PIN स्क्रीनमधून Save कार्यरत नाही.

## रोजची पद्धत
१. वेबसाइट → `/admin/pin/`
२. **६ अंकी PIN** लिहा
३. **Editor 1 ते Editor 10** मधून नाव निवडा
४. बातमी लिहा → फोटो जोडा → **Save/Publish**
५. **Editor नावे बदला** बटणावरून नावे बदलता येतील

## एकदाची मोफत सुरक्षित जोडणी
- [Cloudflare Workers](https://dash.cloudflare.com/) मध्ये Free प्लॅन वापरा; `backend/wrangler.toml` व `backend/pin-worker.js` वापरून Worker deploy करा.
- Cloudflare Worker **Secrets** मध्ये `EDITOR_PIN` (फक्त मालकाने निवडलेला सहा-अंकी PIN), `SESSION_SECRET` (मजबूत यादृच्छिक ३२+ अक्षरी गुप्त किल्ली), `GITHUB_TOKEN` (फक्त `catonpe-droid/lokhit-maharashtra` repository चा Contents read/write fine-grained token) जोडा.
- `LOGIN_LIMITER` binding `backend/wrangler.toml` मधील ५ प्रयत्न प्रति ६० सेकंद प्रमाणे जोडा.
- Worker URL फक्त `admin/pin/config.json` मधील `worker_url` मध्ये टाका.
- प्रत्यक्ष PIN Login करून **Draft** बातमी जतन करा; त्यानंतर Published बातमीची पडताळणी करा.
- चाचणी यशस्वी झाल्यावर मुख्य `/admin/` पेज PIN Editor कडे वळवा.

**सुरक्षा:** PIN किंवा GITHUB_TOKEN सार्वजनिक GitHub files, HTML, JavaScript किंवा चॅटमध्ये सेव्ह करू नका. PIN Cloudflare Worker च्या Secret मध्येच ठेवावा. PIN आधीच संदेशात लिहिला गेला असल्यास तो सुरू करण्यापूर्वी नवीन PIN निवडणे अधिक सुरक्षित. चार तासांनी PIN पुन्हा टाकावा लागू शकतो. हा PIN स्वतंत्र Editor ओळख निश्चित करत नाही; सर्व Editor मध्ये सामायिक असल्यामुळे प्रत्येकाला समान प्रवेश आहे. IP-आधारित Rate Limiting हे मर्यादित संरक्षण आहे, पूर्ण brute-force प्रतिबंध नाही.

Cloudflare Worker मुख्य बातमी वेबसाइट होस्ट करत नाही; तो फक्त PIN Login आणि GitHub मध्ये जतन करण्यासाठी वापरला जातो.
