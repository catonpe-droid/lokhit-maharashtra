# लोकहित महाराष्ट्र — गुप्त लिंकवरून सोपे बातमी प्रकाशन

## रोजची प्रक्रिया (एकदा सेटअप पूर्ण झाल्यावर)
1. विश्वसनीय बातमीदाराला दिलेली पूर्ण गुप्त लिंक उघडा: `https://catonpe-droid.github.io/lokhit-maharashtra/news-submit/#key=<YOUR_SECRET_KEY>`
2. शीर्षक, विभाग, बातमी, नाव व फोटो भरा.
3. **Publish News** दाबा. GitHub मध्ये बातमी आणि फोटो जतन होतात.
4. GitHub Actions नवीन HTML तयार करतो; लिंक `/batmi/news-.../` या स्वरूपात मिळते.
5. पान उपलब्ध असल्याची खात्री झाल्यावर लिंक WhatsApp वर पाठवा.

**महत्त्वाचे:** हा URL पूर्णपणे private नाही. HTML पेज GitHub Pages वर सार्वजनिक आहे; पण `#key=` मधील गुप्त मूल्य नसताना Publish API बातमी स्वीकारत नाही. गुप्त लिंक म्हणजे प्रकाशनाची परवानगी. अनोळखी व्यक्तीला पाठवू नका.

## फक्त एकदाचा मोफत सेटअप (वेबसाइट व्यवस्थापक)
1. Cloudflare Dashboard → Workers & Pages → Create Worker. Worker नाव `lokhit-news-submit` ठेवू शकता.
2. Repository मधील `backend/secret-publisher-worker.js` फाइलचा पूर्ण कोड Worker मध्ये टाका व Deploy करा.
3. Cloudflare Worker → Settings → Variables and Secrets मध्ये **Secret** म्हणून खालील दोन गोष्टी तयार करा:
   - `GITHUB_TOKEN` — GitHub fine-grained personal access token, फक्त `catonpe-droid/lokhit-maharashtra` repository, **Contents: Read and write**. गुप्त token website मधील HTML, JavaScript किंवा config मध्ये ठेवू नका.
   - `PUBLISH_KEY` — कमीत कमी 32 अक्षरांचा दीर्घ random secret (उदा. स्थानिक टर्मिनलवर `openssl rand -hex 32` वापरून स्वतः तयार करा). हा GitHub मध्ये commit करू नका.
   - ऐच्छिक `ALLOWED_ORIGIN` — `https://catonpe-droid.github.io`.
4. Cloudflare कडून मिळालेली HTTPS Worker URL ही `news-submit/config.json` मधील `worker_url` येथे फक्त URL म्हणून लिहा. **Token किंवा key कधीही या फाइलमध्ये लिहू नका.**
5. GitHub मध्ये हे config update होताच साइट build होते. मग मूळ गुप्त key ला URL fragment मध्ये जोडा:
   `https://catonpe-droid.github.io/lokhit-maharashtra/news-submit/#key=YOUR_SECRET_KEY`
   लिंक फक्त अधिकृत लोकांना द्या. Browser ने fragment HTTP request मध्ये पाठवला जात नाही; पानाचा JavaScript Worker ला Authorization header मध्ये secret देतो.
6. `https://YOUR-WORKER.workers.dev/health` येथे `{"ready":true}` दिसणे आवश्यक. त्यानंतर फॉर्ममधून एक बातमी प्रकाशित करा; HTML लिंक तपासा.

## प्रत्यक्षात काय होतं?
- WordPress किंवा Blogger वापरण्याची गरज नाही.
- Apps Script, Google Sheets, Paid CMS किंवा user login नाही.
- GitHub Pages static hosting वापरते. Publishing permission मागे Cloudflare Worker द्वारे सुरक्षितपणे तपासली जाते.
- Default फोटो नसल्यास ब्रँड लोगो वापरला जातो.
- फॉर्म आपोआप image size मर्यादित करून JPEG बनवतो.
- सार्वजनिक HTML पेज GitHub Actions तयार करतो. GitHub/Cloudflare मध्ये कधी कधी विलंब होऊ शकतो.
- GitHub अथवा Cloudflare मोफत वापराच्या मर्यादा लागू होतात.

## सुरक्षेच्या बाबी
- गुप्त लिंक म्हणजे **bearer credential**; ती लीक झाल्यास कोणीतरी Publish करू शकते.
- गुप्त लिंक कधीही सोशल मीडियावर किंवा वेबसाइटच्या मेनूमध्ये देऊ नका.
- गुप्त key लीक झाल्यास Cloudflare मध्ये `PUBLISH_KEY` लगेच बदलून नवीन secret लिंक तयार करा.
- Public repository मध्ये कोणताही GitHub token, key, PIN, secret, password, service account ठेवू नका.
- विनंतीचे Origin तपासले जाते, परंतु Origin हे key चा पर्याय नाही.
- Worker न जोडल्यास फॉर्ममध्ये Preview चालते; प्रत्यक्ष Publish बंद राहते. हे अपेक्षित सुरक्षित वर्तन आहे.

## महत्त्वाच्या फाइल्स
- `news-submit/index.html` — मराठी मोबाइल फॉर्म
- `news-submit/publisher.js` — फोटो compression, Publish API, लिंक verification
- `news-submit/config.json` — सार्वजनिक Worker URL (रिकामी असताना Publish बंद)
- `backend/secret-publisher-worker.js` — सुरक्षित गुप्त लिंक व GitHub मध्ये जतन
- `build.py` — फॉर्मला GitHub Pages च्या प्रकाशित build मध्ये समाविष्ट करते
