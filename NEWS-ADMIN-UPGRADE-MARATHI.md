# लोकहित महाराष्ट्र — WordPress-सारखा NEWS ADMIN STUDIO

## Live Admin
- [Admin Studio (गुप्त Key लागते)](https://catonpe-droid.github.io/lokhit-maharashtra/news-submit/admin/)
- [जुना सोपा Publish Form](https://catonpe-droid.github.io/lokhit-maharashtra/news-submit/)

**ही पृष्ठे एका गुप्त Key ने चालतात; नवीन Login, Apps Script, Google Sheet किंवा TinyFish लागत नाही.**

### फक्त एकदाची Cloudflare Worker Code अपडेट करणे आवश्यक
वेबसाइटचा फॉर्म GitHub वर अपडेट झाला तरी Cloudflare Worker चा कोड **आपोआप बदलत नाही**.

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) उघडा.
2. **Workers & Pages → `lokhit-news-submit` → Edit code** उघडा.
3. [या Repo मधील Worker Code](https://github.com/catonpe-droid/lokhit-maharashtra/blob/main/backend/secret-publisher-worker.js) पूर्ण Copy करा.
4. Cloudflare Editor मधील जुना Worker Code पूर्ण Replace करून नवीन Code Paste करा आणि **Deploy** करा.
5. आधी वापरलेले `GITHUB_TOKEN` आणि `PUBLISH_KEY` हे **Secrets तशीच ठेवायची आहेत**; बदलण्याची गरज नाही.
6. [Worker Health](https://lokhit-news-submit.catonpe.workers.dev/health) उघडा. खालीलप्रमाणे `"editor"` असलेला प्रतिसाद दिसावा:
   `{"ready":true,"features":["publish","editor","list","edit","draft","delete","layout"]}`
7. गुप्त लिंक `https://catonpe-droid.github.io/lokhit-maharashtra/news-submit/admin/#key=तुमची-स्वतःची-Key` वापरा.

**तुमची गुप्त Key मला किंवा इतर कोणालाही पाठवू नका.**

### Admin Studio मध्ये काय आहे?
- सर्व विद्यमान बातम्यांची यादी, शोध आणि प्रकाशित/मसुदा Filter
- जुन्या बातम्या उघडून Edit/Update; **मूळ बातमीचा URL व प्रकाशन तारीख कायम**
- Rich editor: Bold, Italic, Headings, Bullets, Links, Quotes
- मुख्य फोटो बदलणे; नवीन फोटो निवडला नाही तर जुना फोटो तसाच
- मजकुरात ४ फोटो, प्रत्येकाचा आकार आपोआप कमी होतो
- बातमी Preview, SEO description, Tags, YouTube लिंक, लेखक, विभाग
- Publish / Draft, Featured (मुख्य स्लायडरवर प्राधान्य), Delete
- HTML लिंक कॉपी आणि WhatsApp Share
- वेबसाइट व्यवस्थापन: मुख्य मेनू, Breaking News मथळे, Homepage Slider, Slider speed
- अन्य संपादकाने त्याचवेळी बातमी बदलल्यास Warning (जुना मजकूर गुपचूप overwrite होत नाही)

### मर्यादा व सूचना
- हे **पूर्ण WordPress CMS नाही**; परंतु लोकहित महाराष्ट्रच्या GitHub Pages च्या बातम्यांसाठी महत्त्वाचे व्यवस्थापन आहे.
- संपादकांकडे तेच `PUBLISH_KEY` असते. पूर्ण गुप्त लिंक कोणाच्या हाती गेल्यास त्यांना Edit/Delete करता येईल. विश्वसनीय संपादकांनाच द्या.
- Delete केल्यावर पान पुढील स्वयंचलित Build नंतर हटेल.
- GitHub repository सार्वजनिक असल्याने प्रकाशित न केलेले Draft देखील repository मध्ये प्रवेश असणाऱ्यांना / सार्वजनिक code पाहणाऱ्यांना वाचता येऊ शकतात. **अत्यंत गोपनीय Draft GitHub मध्ये ठेवू नका**.
- Cloudflare मोफत वापर मर्यादा असतात; खूप मोठ्या article library मध्ये सर्व बातम्या पानागणिक लोड होतील.
- जुनी बातमी / HTML पान अपडेट झाल्यावर GitHub Pages च्या caching मुळे बदल दिसायला विलंब होऊ शकतो.
- अनोळखी गुप्त URL सार्वजनिक मेनूमध्ये ठेवू नका, आणि `GITHUB_TOKEN` व `PUBLISH_KEY` HTML/JS मध्ये लिहू नका.
- स्वयं प्रकाशित बातम्यांमध्ये भाषा, अचूक माहिती, कॉपीराइट व कायदेशीर जबाबदारी संपादकांनी तपासावी.
