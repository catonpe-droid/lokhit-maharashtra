#!/usr/bin/env python3
"""Lokhit Maharashtra static mini-CMS renderer. No external pip dependencies."""
import html, json, os, pathlib, re, shutil, datetime, urllib.parse, xml.etree.ElementTree as ET
from email.utils import format_datetime
ROOT=pathlib.Path(__file__).resolve().parent
OUT=ROOT/'docs'
CFG=json.loads((ROOT/'site.json').read_text(encoding='utf8'))
BASE=os.environ.get('SITE_BASE',CFG['base_path']).rstrip('/')+'/'
URL=os.environ.get('SITE_URL',CFG['site_url']).rstrip('/')+'/'
assert BASE.startswith('/') and URL.startswith('https://')
E=lambda s:html.escape(str(s or ''),quote=True)
def U(s=''):return BASE+s.lstrip('/')
def A(s=''):return URL+s.lstrip('/')
def L(text,slug):return f'<a href="{U(slug)}">{E(text)}</a>'
POSTS=[]
for x in sorted((ROOT/'content/posts').glob('*.json')):
 try:
  p=json.loads(x.read_text(encoding='utf8'))
  if p.get('status','published')=='published' and p.get('slug'):
   POSTS.append(p)
 except Exception as exc: print(f'WARNING: invalid {x}: {exc}')
POSTS.sort(key=lambda p:p.get('date',''),reverse=True)
PAGES=[('महाराष्ट्र','maharashtra'),('मराठवाडा','marathwada'),('विदर्भ','vidarbha'),('पश्चिम महाराष्ट्र','paschim-maharashtra'),('कोकण','konkan'),('दुष्काळ विशेष','dushkal'),('शेती','sheti'),('शासन योजना','shasan-yojana'),('पशुसंवर्धन','pashusanvardhan'),('पाणी','pani'),('रोजगार','rojgar'),('ग्रामविकास','gramvikas'),('महिला व विकास','mahila-vikas'),('अर्थकारण','arthakaran'),('राजकारण','rajkaran'),('समाज','samaj'),('शिक्षण','shikshan'),('आरोग्य','arogya'),('विश्लेषण','vishleshan'),('व्हिडिओ','video')]
CATEGORY_PATH={name:'vibhag/'+slug+'/' for name,slug in PAGES}
NAV=[('मुख्यपृष्ठ',''),('ताज्या बातम्या','tajya-batmya/'),('महाराष्ट्र',CATEGORY_PATH['महाराष्ट्र']),('मराठवाडा',CATEGORY_PATH['मराठवाडा']),('विदर्भ',CATEGORY_PATH['विदर्भ']),('दुष्काळ विशेष',CATEGORY_PATH['दुष्काळ विशेष']),('शेती',CATEGORY_PATH['शेती']),('शासन योजना',CATEGORY_PATH['शासन योजना']),('पशुसंवर्धन',CATEGORY_PATH['पशुसंवर्धन']),('राजकारण',CATEGORY_PATH['राजकारण']),('व्हिडिओ','video/'),('विश्लेषण',CATEGORY_PATH['विश्लेषण'])]
def article_path(p):return 'batmi/'+p['slug']+'/'
def article_url(p):return A(article_path(p))
def time_marathi(s):
 try:return datetime.datetime.fromisoformat(s).strftime('%d-%m-%Y')
 except:return ''
def img(p):return U(p.get('image','assets/img/logo.webp'))
def ld_head(title,desc,canonical,image=None,kind='website',published=None,modified=None,schema=None):
 metadata={'@context':'https://schema.org','@type':'WebSite' if kind=='website' else 'NewsArticle','headline':title,'name':title,'description':desc,'url':canonical,'inLanguage':'mr-IN','publisher':{'@type':'Organization','name':CFG['name'],'logo':{'@type':'ImageObject','url':A('assets/img/logo.webp')}}}
 if kind=='article':metadata.update({'image':[image or A('assets/img/logo.webp')],'datePublished':published,'dateModified':modified or published,'author':{'@type':'Organization','name':CFG['name']},'mainEntityOfPage':canonical})
 elif kind=='website':metadata.update({'potentialAction':{'@type':'SearchAction','target':A('shodh/')+'?q={search_term_string}','query-input':'required name=search_term_string'}})
 tags=[f'<title>{E(title)} | {E(CFG["name"])}</title>',f'<meta name="description" content="{E(desc)}">',f'<link rel="canonical" href="{E(canonical)}">',f'<meta property="og:type" content="{"article" if kind=="article" else "website"}">',f'<meta property="og:title" content="{E(title)}">',f'<meta property="og:description" content="{E(desc)}">',f'<meta property="og:url" content="{E(canonical)}">',f'<meta property="og:site_name" content="{E(CFG["name"])}">',f'<meta property="og:locale" content="mr_IN">',f'<meta property="og:image" content="{E(image or A("assets/img/logo.webp"))}">',f'<meta property="og:image:alt" content="{E(title)}">',f'<meta name="twitter:card" content="summary_large_image">',f'<meta name="twitter:title" content="{E(title)}">',f'<meta name="twitter:image" content="{E(image or A("assets/img/logo.webp"))}">',f'<script type="application/ld+json">{json.dumps(metadata,ensure_ascii=False)}</script>']
 if kind=='article':tags+= [f'<meta property="article:published_time" content="{E(published)}">',f'<meta property="article:modified_time" content="{E(modified or published)}">']
 return '\n'.join(tags)
def shell(content,title,desc,path='',image=None,kind='website',published=None,modified=None,active=''):
 nav=''.join(f'<a class="{"active" if active==href else ""}" href="{U(href)}">{E(text)}</a>' for text,href in NAV)
 quick=''.join(L(s,path) for s,path in [('आमच्याविषयी','about/'),('संपर्क','contact/'),('जाहिरात','advertise/')])
 footer_lists=[('विभाग',[('महाराष्ट्र',CATEGORY_PATH['महाराष्ट्र']),('मराठवाडा',CATEGORY_PATH['मराठवाडा']),('दुष्काळ विशेष',CATEGORY_PATH['दुष्काळ विशेष']),('शेती',CATEGORY_PATH['शेती']),('शासन योजना',CATEGORY_PATH['शासन योजना'])]),('संपर्क',[('आमच्याविषयी','about/'),('संपर्क','contact/'),('संपादकीय धोरण','editorial-policy/'),('दुरुस्ती धोरण','corrections/'),('जाहिरात','advertise/')]),('कायदेशीर माहिती',[('गोपनीयता धोरण','privacy-policy/'),('वापर अटी','terms/'),('अस्वीकरण','disclaimer/'),('तक्रार निवारण','grievance/'),('कुकी धोरण','cookie-policy/')])]
 footer=''.join('<div><h3>'+E(name)+'</h3>'+''.join(L(n,p) for n,p in group)+'</div>' for name,group in footer_lists)
 ticker=' · '.join(f'<a href="{U(article_path(p))}">{E(p["title"])}</a>' for p in POSTS[:3])
 meta=ld_head(title,desc,A(path),image,kind,published,modified)
 return f'''<!doctype html><html lang="mr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#b60013"><link rel="icon" type="image/png" href="{U('assets/img/favicon.png')}"><link rel="manifest" href="{U('manifest.webmanifest')}"><link rel="alternate" type="application/rss+xml" title="लोकहित महाराष्ट्र बातम्या" href="{U('rss.xml')}"><link rel="stylesheet" href="{U('assets/css/style.css')}">{meta}</head><body data-base="{E(BASE)}">
<div class="utility"><div class="container"><span><span id="today-date">महाराष्ट्राचा डिजिटल आवाज</span> · स्वतंत्र मराठी न्यूज पोर्टल</span><div class="utility-links">{quick}<a href="{U('privacy-policy/')}">Privacy Policy</a></div></div></div>
<header class="brand-header"><div class="container brand-inner"><a href="{U()}" class="identity" aria-label="लोकहित महाराष्ट्र मुखपृष्ठ"><img src="{U('assets/img/logo.webp')}" alt="लोकहित महाराष्ट्र लोगो" class="site-logo" width="112" height="112"><div><div class="brand-title">लोकहित <span>महाराष्ट्र</span></div><div class="brand-tagline">{E(CFG['tagline'])}</div></div></a><div class="brand-actions"><a class="icon-btn" href="{U('shodh/')}" aria-label="बातमी शोधा">⌕ शोधा</a><a class="admin-link" href="{U('admin/')}" rel="nofollow">🔒 प्रशासन</a></div></div></header>
<nav class="nav" aria-label="मुख्य मेनू"><div class="container nav-inner"><button id="nav-toggle" class="hamburger" aria-expanded="false" aria-controls="nav-links" aria-label="मेनू उघडा">☰</button><div class="nav-links" id="nav-links" style="display:contents">{nav}</div></div></nav>
<main><div class="container"><div class="search-strip"><span class="breaking-label">ठळक बातम्या</span><div class="breaking-text">{ticker}</div><a class="search-btn" href="{U('shodh/')}" aria-label="शोधा">⌕</a></div></div>{content}</main>
<footer class="footer"><div class="container"><div class="footer-grid"><div><div class="footer-brand"><img src="{U('assets/img/logo.webp')}" alt="" class="footer-logo">लोकहित महाराष्ट्र</div><p>{E(CFG['tagline'])}. महाराष्ट्र, दुष्काळ, शेती, योजना आणि ग्रामीण विकासाविषयी मराठी माहिती.</p><small>डिजिटल न्यूज व जनमाहिती पोर्टल. हे कोणत्याही शासकीय कार्यालयाचे अधिकृत संकेतस्थळ नाही.</small></div>{footer}</div><div class="footer-bottom"><span>© २०२६ लोकहित महाराष्ट्र. सर्व हक्क राखीव.</span><span>माहितीतील त्रुटी निदर्शनास आणण्यासाठी संपर्क पृष्ठ वापरा.</span></div></div></footer>
<div id="toast" class="toast" role="status" aria-live="polite"></div><script src="{U('assets/js/site.js')}" defer></script></body></html>'''.replace('id="nav-links" style="display:contents"','id="nav-links"')
def write(path,content):
 target=OUT/path
 target.parent.mkdir(parents=True,exist_ok=True)
 target.write_text(content,encoding='utf8')
def section(title,items,see=None):
 if not items:return ''
 see=see or CATEGORY_PATH.get(title,'tajya-batmya/')
 return f'<section class="page-section"><div class="section-head"><h2>{E(title)}</h2><a href="{U(see)}">सर्व बातम्या ›</a></div><div class="news-grid">'+''.join(card(p) for p in items[:4])+'</div></section>'
def card(p):
 return f'<a class="news-card" href="{U(article_path(p))}"><img src="{img(p)}" alt="{E(p["title"])}" width="480" height="270" loading="lazy"><div class="card-body"><span class="category-kicker">{E(p["category"])}</span><h3>{E(p["title"])}</h3><p>{E(p["description"])}</p><div class="meta"><span>📅 {E(time_marathi(p["date"]))}</span><span>लोकहित डेस्क</span></div></div></a>'
def stack(p):return f'<a class="stack-card" href="{U(article_path(p))}"><img src="{img(p)}" alt="" loading="lazy"><div><h3>{E(p["title"])}</h3><span class="meta">{E(time_marathi(p["date"]))}</span></div></a>'
def latest(p):return f'<a class="latest-item" href="{U(article_path(p))}"><span class="latest-dot">•</span><span>{E(p["title"])}</span></a>'
def breadcrumbs(parts):return '<div class="breadcrumbs"><a href="'+U()+'">मुख्यपृष्ठ</a> / '+' / '.join(parts)+'</div>'
# Home
lead=next((p for p in POSTS if p.get('featured')),POSTS[0] if POSTS else None)
if lead:
 hero=f'<a class="hero-main" href="{U(article_path(lead))}"><img src="{img(lead)}" alt="" fetchpriority="high"><div class="hero-content"><span class="tag">{E(lead["category"])}</span><h1>{E(lead["title"])}</h1><p>{E(lead["description"])}</p><div class="meta">📅 {E(time_marathi(lead["date"]))} · लोकहित महाराष्ट्र डिजिटल डेस्क</div></div></a>'
 else_hero=''
else:hero='<div class="empty-state">बातम्या लवकरच उपलब्ध होतील.</div>'
home=f'<div class="container"><section class="page-section hero-layout">{hero}<div class="hero-stack">'+''.join(stack(p) for p in [p for p in POSTS if p['slug']!=lead['slug']][:4])+f'</div><div class="hero-latest side-panel"><div class="panel-title">ताज्या बातम्या <a href="{U("tajya-batmya/")}">सर्व पहा ›</a></div><div class="panel-content">'+''.join(latest(p) for p in POSTS[5:11])+'</div></div></section>'
home+=section('दुष्काळ विशेष',[p for p in POSTS if p['category'] in ('दुष्काळ विशेष','मराठवाडा','पाणी')][:4],CATEGORY_PATH['दुष्काळ विशेष'])
home+='<section class="page-section drought-banner"><div><h2>🌾 दुष्काळ विशेष : माहिती, मदत आणि मार्गदर्शन</h2><p>पाणी, चारा, कर्ज, शेतकरी मदत व रोजगाराच्या बातम्या एकाच ठिकाणी</p></div><a href="'+U(CATEGORY_PATH['दुष्काळ विशेष'])+'">सर्व बातम्या पहा →</a></section>'
for cat in ['महाराष्ट्र','शेती','शासन योजना','पशुसंवर्धन']:
 items=[p for p in POSTS if p['category']==cat]
 if items:home+=section(cat,items,CATEGORY_PATH[cat])
home+=section('अधिक बातम्या',POSTS[10:14],'tajya-batmya/')
home+='</div>'
write('index.html',shell(home,'ताज्या बातम्या आणि महाराष्ट्राचे अपडेट्स',CFG['description']))
# Articles
yt_patterns=[re.compile(r'(?:youtube\.com/(?:watch\?v=|shorts/|live/|embed/)|youtu\.be/)([A-Za-z0-9_-]{11})')]
def youtube_id(text):
 for pat in yt_patterns:
  m=pat.search(text or '')
  if m:return m.group(1)
 return None
for p in POSTS:
 body=[];body_yts=[]
 for para in re.split(r'\n\s*\n',p.get('body','')):
  para=para.strip()
  if not para:continue
  if para.startswith('## '):body.append('<h2>'+E(para[3:])+'</h2>');continue
  vid=youtube_id(para)
  if vid: body_yts.append(vid)
  body.append('<p>'+E(para).replace('\n','<br>')+'</p>')
 yvid=youtube_id(p.get('video','')) or (body_yts[0] if body_yts else None)
 video=f'<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/{yvid}" title="संबंधित YouTube व्हिडिओ" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>' if yvid else ''
 bar='<div class="share-bar"><strong>ही बातमी शेअर करा :</strong><button class="share-btn share-wa" data-share="wa">WhatsApp</button><button class="share-btn share-fb" data-share="fb">Facebook</button><button class="share-btn share-x" data-share="x">X</button><button class="share-btn share-tg" data-share="tg">Telegram</button><button class="share-btn share-copy" data-share="copy">लिंक कॉपी</button><button class="share-btn share-native" data-share="native">इतर</button></div>'
 related=[q for q in POSTS if q['slug']!=p['slug'] and q['category']==p['category']][:2] or [q for q in POSTS if q['slug']!=p['slug']][:2]
 content=f'<div class="container">{breadcrumbs([E(p["category"]),E(p["title"])])}<div class="content-layout"><article class="article"><span class="tag">{E(p["category"])}</span><h1>{E(p["title"])}</h1><p class="article-summary">{E(p["description"])}</p><div class="meta"><span>✍ {E(p.get("author",CFG["name"]))}</span><span>📅 {E(time_marathi(p["date"]))}</span></div><figure class="article-figure"><img src="{img(p)}" alt="{E(p["title"])}" width="960" height="540"><figcaption>प्रतीकात्मक, संगणकनिर्मित चित्र</figcaption></figure>{bar}<div class="article-body">{"".join(body)}{video}</div>{bar}<div class="section-head"><h2>संबंधित बातम्या</h2></div><div class="related-grid">{"".join(card(q) for q in related)}</div></article><aside><div class="side-panel sidebar-box"><div class="panel-title">ताज्या बातम्या</div><div class="panel-content">{"".join(latest(q) for q in POSTS[:9])}</div></div><div class="side-panel"><div class="panel-title">लोकहित विशेष</div><div class="panel-content"><p>शेती, पाणी, रोजगार आणि शासन योजनांची माहिती</p><a class="admin-link" href="{U(CATEGORY_PATH["दुष्काळ विशेष"])}">सर्व लेख पहा</a></div></div></aside></div></div>'
 write(article_path(p)+'index.html',shell(content,p['title'],p['description'],article_path(p),A(p['image']),'article',p['date'],p.get('updated') or p['date']))
# Category pages
for cat,slug in PAGES:
 path='vibhag/'+slug+'/'
 if cat=='व्हिडिओ':continue
 items=[p for p in POSTS if p['category']==cat]
 # curated drought category includes all drought-related content
 if cat=='दुष्काळ विशेष':items=POSTS
 content=f'<div class="container">{breadcrumbs([E(cat)])}<div class="section-head"><h2>{E(cat)}</h2></div>'
 content+='<div class="news-grid">'+''.join(card(p) for p in items)+'</div>' if items else '<div class="empty-state">या विभागातील नवीन बातम्या लवकरच प्रकाशित होतील.</div>'
 content+='</div>'
 write(path+'index.html',shell(content,cat+' बातम्या',cat+' विभागातील ताज्या मराठी बातम्या',path,active=path))
# latest index
path='tajya-batmya/'
latest_content=f'<div class="container">{breadcrumbs(["ताज्या बातम्या"])}<div class="section-head"><h2>ताज्या बातम्या</h2></div><div class="news-grid">'+''.join(card(p) for p in POSTS)+'</div></div>'
write(path+'index.html',shell(latest_content,'ताज्या बातम्या','लोकहित महाराष्ट्रच्या सर्व बातम्या',path,active=path))
# Search page
path='shodh/'
search_content=f'<div class="container">{breadcrumbs(["बातमी शोधा"])}<div class="section-head"><h2>बातमी शोधा</h2></div><form class="results-toolbar" id="search-form"><input type="search" id="search-input" placeholder="मराठी मथळा, विभाग किंवा विषय शोधा..." aria-label="बातमी शोधा"><button type="submit">शोधा</button></form><div id="search-results" class="news-grid"><div class="empty-state">बातम्या लोड होत आहेत...</div></div></div>'
write(path+'index.html',shell(search_content,'बातमी शोधा','लोकहित महाराष्ट्रच्या बातम्या शोधा',path))
# Video page
videos=[p for p in POSTS if youtube_id(p.get('video','')) or youtube_id(p.get('body',''))]
video_content=f'<div class="container">{breadcrumbs(["व्हिडिओ"])}<div class="section-head"><h2>व्हिडिओ बातम्या</h2></div>'+( '<div class="news-grid">'+''.join(card(p) for p in videos)+'</div>' if videos else '<div class="empty-state">अधिकृत व्हिडिओ बातमी उपलब्ध झाल्यावर या विभागात दिसेल. प्रशासनातून बातमीमध्ये YouTube लिंक जोडा.</div>')+'</div>'
write('video/index.html',shell(video_content,'व्हिडिओ बातम्या','YouTube व्हिडिओसह मराठी बातम्या','video/',active='video/'))
# Static editorial / legal pages
legal={
'about':('आमच्याविषयी','लोकहित महाराष्ट्र हे मराठी डिजिटल बातमी व जनमाहितीचे स्वतंत्र व्यासपीठ आहे.',[
('आमचा उद्देश','महाराष्ट्रातील ग्रामीण भाग, शेती, पाणी, दुष्काळ, रोजगार, शासन योजना आणि समाजजीवनाबाबत माहिती सोप्या व स्पष्ट मराठीत पोहोचवणे हा आमचा उद्देश आहे.'),
('संपादकीय भूमिका','बातमी आणि मत यातील फरक राखण्याचा, शक्य तेथे माहितीची पडताळणी करण्याचा आणि त्रुटी लक्षात आल्यास दुरुस्ती करण्याचा आमचा प्रयत्न आहे.'),
('महत्त्वाची सूचना','या पोर्टलवर प्रकाशित माहिती शासकीय आदेश किंवा वैयक्तिक कायदेशीर सल्ल्याचा पर्याय नाही. योजनांच्या पात्रतेची खात्री संबंधित सरकारी कार्यालयाशी करावी.')]),
'contact':('संपर्क','लोकहित महाराष्ट्राशी संपर्क साधण्याची माहिती.',[
('संपादकीय संपर्क','प्रकाशनापूर्वी पोर्टलच्या मालकाने अधिकृत ईमेल पत्ता, कार्यालयाचा पत्ता आणि संपादकीय जबाबदार व्यक्तीचे नाव येथे नोंदवावे.'),
('बातमी, दुरुस्ती किंवा अभिप्राय','बातमीची दुरुस्ती, अधिक माहिती अथवा तक्रार असल्यास अधिकृत संपर्क पत्त्यावर तपशील पाठवावा. ही संपर्क माहिती सुरू झाल्यावर या पृष्ठावर अद्ययावत केली जाईल.'),
('महत्त्वाचे','येथे कोणतीही काल्पनिक ईमेल आयडी, फोन नंबर किंवा नोंदणी क्रमांक दाखवलेला नाही.')]),
'privacy-policy':('गोपनीयता धोरण','वाचकांच्या गोपनीयतेचा आदर करणे महत्त्वाचे आहे.',[
('काय माहिती घेतली जाते?','सध्या या स्थिर संकेतस्थळावर स्वतंत्र नोंदणी किंवा टिप्पणीची यंत्रणा नाही. वेबसाइटची विनंती GitHub Pages किंवा पुढील होस्टिंग प्रदात्याच्या सर्व्हर लॉगमध्ये नोंदली जाऊ शकते.'),
('बाह्य सेवा','Google Fonts, YouTube एम्बेड आणि समाजमाध्यमांवरील शेअरिंग लिंक वापरल्यास संबंधित सेवांचे स्वतंत्र गोपनीयता धोरण लागू होऊ शकते.'),
('प्रशासन प्रवेश','प्रशासन विभागातून GitHub वापरकर्त्याने पुरवलेला टोकन या वेबसाइटच्या सर्व्हरवर साठवला जात नाही. तो ब्राउझरमधून थेट GitHub API शी संवादासाठी वापरला जातो.'),
('अद्ययावत धोरण','जाहिराती, विश्लेषण सेवा, सदस्यता किंवा इतर फॉर्म सुरू केल्यास हे धोरण नव्याने अद्ययावत करणे आवश्यक राहील.')]),
 'terms':('वापर अटी','लोकहित महाराष्ट्रवरील माहिती वापरताना लागू असणाऱ्या सामान्य अटी.',[
('मजकूर आणि पुनर्वापर','लेख, प्रतिमा, ब्रँडिंग आणि इतर मूळ सामग्रीचे पुनर्प्रकाशन किंवा व्यावसायिक वापर करण्यापूर्वी परवानगी घेणे आवश्यक असू शकते.'),
('अचूकता','प्रकाशनावेळी माहिती अचूक ठेवण्याचा प्रयत्न केला जातो. शासन निर्णय, सवलती व पात्रता निकष बदलू शकतात.'),
('बाह्य संकेतस्थळे','लेखातील किंवा मेनूमधील बाह्य लिंकवरील सामग्री आणि पद्धतींसाठी संबंधित संकेतस्थळ जबाबदार असते.'),
('अटींमध्ये बदल','प्रकाशक आवश्यकतेनुसार अटींमध्ये सुधारणा करू शकतो; सुधारित आवृत्ती याच पृष्ठावर प्रदर्शित केली जाईल.')]),
 'disclaimer':('अस्वीकरण','स्वतंत्र डिजिटल बातमी व माहिती माध्यमाचे महत्त्वाचे अस्वीकरण.',[
('सरकारी मान्यता','लोकहित महाराष्ट्र हे शासकीय पोर्टल नाही. येथे नमूद माहिती, योजना किंवा मदतीच्या पात्रतेची अंतिम खात्री अधिकृत शासन आदेशांद्वारे करावी.'),
('सल्ल्याची मर्यादा','कर्ज, शेती, वैद्यकीय, विमा, आर्थिक किंवा कायदेशीर विषयांवरील लेख सर्वसाधारण माहितीच्या उद्देशाने आहेत; वैयक्तिक व्यावसायिक सल्ल्याचा पर्याय नाहीत.'),
('प्रतीकात्मक दृश्ये','लेखातील काही चित्रे संगणकनिर्मित प्रतीकात्मक आहेत; ती प्रत्यक्ष घटनास्थळाची किंवा विशिष्ट व्यक्तीची छायाचित्रे नाहीत.'),
('बातम्यांचे स्वरूप','काही लेख सार्वजनिक माहितीनुसार संकलित जनजागृती लेख किंवा विश्लेषणात्मक मार्गदर्शक आहेत; त्यांना स्वतंत्र प्रत्यक्ष वार्तांकन समजू नये.')]),
 'editorial-policy':('संपादकीय धोरण','स्वतंत्र, जबाबदार आणि वाचकाभिमुख मराठी संपादकीय प्रक्रिया.',[
('तथ्य आणि मत','बातमी, माहितीपर मार्गदर्शक व विश्लेषण यांतील फरक वाचकाला स्पष्ट होईल अशी मांडणी करण्याचा प्रयत्न केला जातो.'),
('पडताळणी','शासननिर्णय, योजना, रक्कम, वेळापत्रक आणि पात्रता यांची शक्य तितकी अधिकृत कागदपत्रांशी पडताळणी करावी.'),
('चित्रे व व्हिडिओ','प्रतिनिधिक किंवा संगणकनिर्मित दृश्यांचा तसा उल्लेख केला जाईल. YouTube व्हिडिओ स्वतंत्र निर्मात्याचा असल्यास त्याचे अधिकार त्याच्याकडे राहतात.'),
('दुरुस्ती','विश्वसनीय माहितीच्या आधारे त्रुटी आढळल्यास मजकूर अद्ययावत करता येईल व आवश्यकतेनुसार दुरुस्ती नोंद केली जाईल.')]),
 'corrections':('दुरुस्ती धोरण','बातम्यांमधील चूक लक्षात आल्यास योग्य प्रक्रिया.',[
('दुरुस्ती कशी मागावी?','संबंधित बातमीचा दुवा, आक्षेप असलेला मजकूर आणि पडताळता येण्याजोगा पुरावा अधिकृत संपादकीय संपर्कावर पाठवावा.'),
('पुनरावलोकन','संपादकीय तपासणीत त्रुटी मान्य झाल्यास योग्य दुरुस्ती अथवा अद्ययावतीकरण केले जाऊ शकते.'),
('पारदर्शकता','महत्त्वाच्या तथ्यात्मक बदलांसाठी अद्ययावत तारीख नमूद करण्याचा प्रयत्न केला जाईल.')]),
 'advertise':('जाहिरात व भागीदारी','लोकहित महाराष्ट्रवरील जाहिरात, प्रायोजित सामग्री आणि सहकार्य.',[
('जाहिरात चौकशी','जाहिरातीसाठी संपर्काची अधिकृत माहिती प्रकाशनापूर्वी जोडली जाईल.'),
('स्पष्ट ओळख','प्रायोजित अथवा सशुल्क मजकूर प्रकाशित केल्यास त्याची वाचकाला स्पष्ट ओळख करून देण्याचे धोरण राहील.'),
('संपादकीय स्वातंत्र्य','जाहिरात आणि स्वतंत्र संपादकीय निर्णय यांचा फरक राखण्याचा उद्देश आहे.')]),
 'grievance':('तक्रार निवारण','सामग्री किंवा गोपनीयतेविषयी तक्रार नोंदवण्याची माहिती.',[
('तक्रार नोंदवणे','प्रकाशकाने आवश्यक कायदेशीर तपशील, तक्रार निवारणासाठी संपर्क अधिकारी, ईमेल आणि प्रक्रिया प्रत्यक्ष कामकाज सुरू होण्यापूर्वी येथे प्रसिद्ध करावी.'),
('आवश्यक तपशील','तक्रारीमध्ये पानाचा दुवा, नेमका आक्षेप, संपर्क माहिती आणि संबंधित पुरावा द्यावा.'),
('सावधान','या नमुना पृष्ठाला कोणत्याही विशिष्ट कायद्यानुसार पूर्ण अनुपालन झाल्याचे प्रमाणपत्र समजू नये. अंतिम मजकूर योग्य कायदेशीर सल्ल्यानंतर निश्चित करावा.')]),
 'cookie-policy':('कुकी धोरण','या संकेतस्थळाच्या सध्याच्या तांत्रिक वापराविषयी माहिती.',[
('सध्याची रचना','हा प्रकल्प GitHub Pages वर चालणारा स्थिर न्यूज पोर्टल आहे. आमच्या स्वतःच्या नावाने ट्रॅकिंग कुकी सेट करणारी व्यवस्था सध्या समाविष्ट नाही.'),
('तृतीय-पक्ष सेवा','Google Fonts, YouTube आणि समाजमाध्यमांच्या बाह्य सेवांमुळे त्या सेवांवर भेट दिल्यावर त्यांचे स्वतंत्र डेटा धोरण लागू होते.'),
('भविष्यातील बदल','विश्लेषण, जाहिरात नेटवर्क अथवा सदस्यता सेवा जोडल्यास कुकी धोरण आणि आवश्यक संमती व्यवस्था अपडेट करावी लागेल.')])
}
for slug,(title,intro,sections) in legal.items():
 path=slug+'/'
 body=f'<div class="container">{breadcrumbs([E(title)])}<div class="plain-page"><h1>{E(title)}</h1><p>{E(intro)}</p>'+''.join(f'<h2>{E(k)}</h2><p>{E(v)}</p>' for k,v in sections)+'</div></div>'
 write(path+'index.html',shell(body,title,intro,path))
# category listing, post index, sitemap and RSS
index=[{k:p.get(k) for k in ['slug','title','description','category','image','date']} for p in POSTS]
write('posts-index.json',json.dumps(index,ensure_ascii=False,indent=2))
write('manifest.webmanifest',json.dumps({'name':CFG['name'],'short_name':'लोकहित','start_url':BASE,'display':'standalone','background_color':'#ffffff','theme_color':'#b60013','icons':[{'src':U('assets/img/favicon.png'),'sizes':'192x192','type':'image/png'}]},ensure_ascii=False))
allpaths=['','tajya-batmya/','shodh/','video/'] + [x+'/' for x in legal] + [x for x in CATEGORY_PATH.values() if x!='vibhag/video/'] + [article_path(p) for p in POSTS]
sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join(f'  <url><loc>{E(A(path))}</loc></url>\n' for path in allpaths)+'</urlset>\n'
write('sitemap.xml',sitemap)
write('robots.txt',f'User-agent: *\nAllow: /\nDisallow: {BASE}admin/\nSitemap: {A("sitemap.xml")}\n')
items=''
for p in POSTS[:25]:
 try: pub=format_datetime(datetime.datetime.fromisoformat(p['date']))
 except:pub=''
 items+=f'<item><title>{E(p["title"])}</title><link>{E(article_url(p))}</link><guid>{E(article_url(p))}</guid><description>{E(p["description"])}</description><pubDate>{E(pub)}</pubDate></item>'
write('rss.xml',f'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>{E(CFG["name"])}</title><link>{E(URL)}</link><description>{E(CFG["description"])}</description><language>mr-IN</language>{items}</channel></rss>')
# copy assets and browser admin into publish root
for folder in ['assets','admin']:
 dest=OUT/folder
 if dest.exists():shutil.rmtree(dest)
 shutil.copytree(ROOT/folder,dest)
write('.nojekyll','')
print(f'Built {len(POSTS)} published articles, {len(allpaths)} indexable URLs in {OUT}')
