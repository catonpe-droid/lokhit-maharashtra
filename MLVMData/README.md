# MLVMData | ड्राऊट वॉरियर ऑर्गनायझेशन
महाराष्ट्र लोक विकास मंच संलग्न संस्थांची जिल्हानिहाय नोंदणी.

## तयार घटक
- `index.html` — GitHub Pages सार्वजनिक मुख्य लिंक. Google Apps Script लिंक जोडेपर्यंत फक्त सुरक्षित पूर्वदृश्य.
- `Index.html` — मराठी, मोबाइल-फ्रेंडली नोंदणी फॉर्म आणि यशस्वी नोंदणी पावती.
- `Code.gs` — Google Sheet मध्ये नोंद, नाव/नोंदणी क्रमांक दुबार तपासणी, LockService, स्वयंचलित MLVM ID.
- `logo.svg` — वापरकर्त्याने दिलेला मूळ MLVM लोगो (मोबाइलसाठी अनुकूल प्रत).
- `config.js` — Apps Script /exec URL सेटिंग.
- [Google Sheet](https://docs.google.com/spreadsheets/d/16PGT_aimpCJHxJBuCrs5LqAe2THiChv1eibLgruHJws/edit) — NGO_नोंदणी, जिल्हानिहाय_सारांश, जिल्हा_पदाधिकारी, मार्गदर्शक_सूचना.

## शेवटची Google Apps Script जोडणी (अत्यावश्यक)
1. Google Sheet चा मालकी/संपादन अधिकार असलेल्या Google खात्यातून [script.google.com](https://script.google.com/home/projects/create) वर **New project** उघडा. नाव: `MLVMData – Drought Warrior Registration`.
2. `Code.gs` मधील डिफॉल्ट कोड हटवा आणि [हा Code.gs](https://github.com/catonpe-droid/Dalalnama/blob/main/MLVMData/Code.gs) पूर्ण कॉपी करून पेस्ट करा.
3. **+ → HTML** फाईल नवीन करा. नाव अचूक **Index** ठेवा. त्या फाईलमध्ये [हा Index.html](https://github.com/catonpe-droid/Dalalnama/blob/main/MLVMData/Index.html) पूर्ण कॉपी करून पेस्ट करा.
4. **Save → Deploy → New deployment → Web app**. `Execute as: Me` आणि `Who has access: Anyone`. आवश्यक Google Sheets परवानग्या द्या.
5. Deploy मधून मिळणारी `https://script.google.com/macros/s/.../exec` लिंक कॉपी करा.
6. या रेपॉझिटरीमधील [config.js](https://github.com/catonpe-droid/Dalalnama/blob/main/MLVMData/config.js) उघडून `window.MLVM_WEBAPP_URL = '';` या रिकाम्या quotes मध्ये ती URL टाका आणि commit करा.
7. [सार्वजनिक नोंदणी लिंक](https://lokhitmaharashtra.com/MLVMData/) उघडून प्रत्यक्ष एका अधिकृत संस्थेची नोंद करून Google Sheet मध्ये डेटा गेला आहे का ते तपासा. तीच संस्था पुन्हा सबमिट केल्यावर दुबार नोंदणी नाकारली जाते का ते तपासा.

## सुरक्षेबाबत
- Google Sheet सार्वजनिकपणे शेअर करू नका. फक्त अधिकृत समन्वयकांना access द्या.
- फॉर्ममधील वैयक्तिक संपर्क क्रमांक Google Sheet मध्ये राहतील; सार्वजनिक फॉर्मवर यादी प्रकाशित होणार नाही.
- नावाच्या सामान्यीकृत (case/space/punctuation) साम्याने आणि असल्यास अधिकृत नोंदणी क्रमांकाने दुबार नोंदणी थांबवली जाते; सारखे उच्चारण/भिन्न स्पेलिंगसाठी मानवी पडताळणी गरजेची आहे.
- ही माहिती संकलन मोहीम आहे; शासनाची अधिकृत मान्यता, अनुदान किंवा निवडीची हमी नाही.
- Google Apps Script deploy आणि प्रत्यक्ष submission test याआधी हे पूर्वदृश्यच आहे.
