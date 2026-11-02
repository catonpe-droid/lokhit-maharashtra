# लोकहित महाराष्ट्र — TinaCMS News Editor

मुख्य बातमी वेबसाइट: https://catonpe-droid.github.io/lokhit-maharashtra/
TinaCloud प्रोजेक्ट: https://app.tina.io/projects/c6dc2598-fd40-47df-951f-c074fcc9a7e8/overview
GitHub Repository: https://github.com/catonpe-droid/lokhit-maharashtra

## तयार केलेले तांत्रिक घटक

- `tina/config.ts`: TinaCloud Client ID, GitHub main branch आणि जुन्याच `content/posts/*.json` बातम्यांचे schema.
- `package.json`: TinaCMS आणि CLI.
- `tina_markdown.py`: Bold, headings, links, lists, फोटो आणि standalone YouTube URL सुरक्षितपणे HTML मध्ये दाखवते.
- `tests/test_tina_markdown.py`: जुना मजकूर, अनेक फोटो, YouTube, unsafe HTML चाचण्या.
- `build.py`: जुन्या Quill rich_delta आणि TinaCMS Markdown या दोन्ही प्रकारांना सपोर्ट.
- `tina/tina-lock.json`: Tina build नंतर तयार होऊन Repository मध्ये commit होणे आवश्यक आहे.
- Tina Editor वेबसाइटपासून वेगळा `/tina-editor/` या मार्गावर प्रकाशित करण्याचा उद्देश; आधीचा `/admin/` बदलणार नाही.

## खात्याच्या मालकाने करायची एकदाची सुरक्षित जोडणी

1. TinaCloud वरील आपल्या **lokhit-maharashtra** प्रोजेक्टमध्ये **Tokens** टॅब उघडा.
2. **Read-only Content Token** तयार करा. हे कोणालाही चॅटवर, ईमेलवर किंवा सार्वजनिक GitHub फाईलमध्ये पाठवू नका.
3. GitHub → `catonpe-droid/lokhit-maharashtra` → **Settings → Secrets and variables → Actions → New repository secret**.
4. Secret name **TINA_TOKEN** आणि value म्हणून TinaCloud मधील Read-only Content Token जतन करा.
5. GitHub → **Actions → Publish TinaCMS Editor → Run workflow** चालवा. त्यातून Tina SPA व Tina lockfile build आणि GitHub Pages वर sync होतात.
6. Workflow यशस्वी झाल्यावर `https://catonpe-droid.github.io/lokhit-maharashtra/tina-editor/` उघडून TinaCloud ने Login करा.
7. आधी Draft बातमी, नंतर छोटा test लेख (मुख्य फोटो, मधला फोटो, YouTube URL) प्रकाशित करून HTML आणि WhatsApp OG image तपासा.

**GitHub Secret सेट झाल्याशिवाय TinaCloud Production Editor उपलब्ध होणार नाही.** TinaCloud वर Project तयार करणे वेगळा टप्पा आहे; तेवढ्याने Editor तयार होत नाही.

## संपादकासाठी टिपा

- बातमीसाठी **News / बातम्या** collection वापरा.
- मथळा, सारांश, विभाग, पूर्ण बातमी, मुख्य फोटो आणि स्थिती भरून Save करा.
- पूर्ण बातमीच्या Rich Text मध्ये WordPress-सारखे Bold, Italic, Headings, Links, List आणि अनेक फोटो वापरा.
- बातमीमध्ये YouTube व्हिडिओ हवा असेल तर त्याची `https://www.youtube.com/watch?v=...` लिंक **स्वतंत्र ओळीत** लिहा. किंवा वेगळ्या YouTube लिंक फील्डमध्ये टाका.
- **Published** निवडल्यावर TinaCloud GitHub मध्ये फाईल commit करेल; GitHub Actions `build.py` चालवेल; HTML तयार होण्यास deployment वेळ लागतो.
- **Draft** झालेली बातमी `build.py` सार्वजनिक वेबसाइटवर दाखवत नाही.
- TinaCloud चा Visual Editing प्रकार मुख्य React पानांवर वापरला जातो; आपल्या Python साइटवर CMS Form Editor मिळेल, in-place React visual editing नाही.

## सुरक्षा
- GitHub Repo Permissions व TinaCloud Editors द्वारे लेखन अधिकार मर्यादित ठेवा.
- GitHub Token/पासवर्ड वेबसाइटच्या HTML किंवा JavaScript मध्ये ठेवू नका.
- GitHub च्या Repo History / Actions मधील मागील versions पर्याय उपलब्ध आहेत, परंतु स्वतंत्र संपादकीय Backups उपयोगी ठरतात.
