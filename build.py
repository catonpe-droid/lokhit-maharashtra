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
  if p.get('status','published')=='published':
   p['slug']=p.get('slug') or x.stem
   POSTS.append(p)
 except Exception as exc: print(f'WARNING: invalid {x}: {exc}')
POSTS.sort(key=lambda p:p.get('date',''),reverse=True)
# Editor-managed layout data, committed to GitHub by the CMS.
try:
 LAYOUT=json.loads((ROOT/'content/layout.json').read_text(encoding='utf8'))
except (OSError,ValueError) as exc:
 print('WARNING: layout unavailable:',exc)
 LAYOUT={}
POST_BY_SLUG={p['slug']:p for p in POSTS}
PAGES=[('महाराष्ट्र','maharashtra'),('मराठवाडा','marathwada'),('विदर्भ','vidarbha'),('पश्चिम महाराष्ट्र','paschim-maharashtra'),('कोकण','konkan'),('दुष्काळ विशेष','dushkal'),('शेती','sheti'),('शासन योजना','shasan-yojana'),('पशुसंवर्धन','pashusanvardhan'),('पाणी','pani'),('रोजगार','rojgar'),('ग्रामविकास','gramvikas'),('महिला व विकास','mahila-vikas'),('अर्थकारण','arthakaran'),('राजकारण','rajkaran'),('समाज','samaj'),('शिक्षण','shikshan'),('आरोग्य','arogya'),('विश्लेषण','vishleshan'),('व्हिडिओ','video')]
CATEGORY_PATH={name:'vibhag/'+slug+'/' for name,slug in PAGES}
DEFAULT_NAV=[('मुख्यपृष्ठ',''),('ताज्या बातम्या','tajya-batmya/'),('महाराष्ट्र',CATEGORY_PATH['महाराष्ट्र']),('मराठवाडा',CATEGORY_PATH['मराठवाडा']),('विदर्भ',CATEGORY_PATH['विदर्भ']),('दुष्काळ विशेष',CATEGORY_PATH['दुष्काळ विशेष']),('शेती',CATEGORY_PATH['शेती']),('शासन योजना',CATEGORY_PATH['शासन योजना']),('पशुसंवर्धन',CATEGORY_PATH['पशुसंवर्धन']),('राजकारण',CATEGORY_PATH['राजकारण']),('व्हिडिओ','video/'),('🔴 Live TV','live-tv/'),('विश्लेषण',CATEGORY_PATH['विश्लेषण'])]
CUSTOM_NAV=LAYOUT.get('menu')
NAV=[(str(item.get('title','')).strip()[:65],str(item.get('href','')).strip()) for item in CUSTOM_NAV if isinstance(item,dict) and item.get('enabled',True) and str(item.get('title','')).strip() and re.fullmatch(r'[A-Za-z0-9_/-]*',str(item.get('href','')).strip())] if isinstance(CUSTOM_NAV,list) else DEFAULT_NAV
NAV= NAV[:24] if NAV else DEFAULT_NAV
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
 lang='en' if path in {name+'/' for name in ['about','contact','privacy-policy','terms','disclaimer','editorial-policy','corrections','advertise','grievance','cookie-policy']} else 'mr'
 nav=''.join(f'<a class="{"active" if active==href else ""}" href="{U(href)}">{E(text)}</a>' for text,href in NAV)
 quick=''.join(L(s,path) for s,path in [('About Us','about/'),('Contact','contact/'),('Advertise','advertise/')])
 footer_lists=[('विभाग',[('महाराष्ट्र',CATEGORY_PATH['महाराष्ट्र']),('मराठवाडा',CATEGORY_PATH['मराठवाडा']),('दुष्काळ विशेष',CATEGORY_PATH['दुष्काळ विशेष']),('शेती',CATEGORY_PATH['शेती']),('शासन योजना',CATEGORY_PATH['शासन योजना'])]),('Information',[('About Us','about/'),('Contact','contact/'),('Editorial Policy','editorial-policy/'),('Corrections Policy','corrections/'),('Advertise','advertise/')]),('Legal & Policies',[('Privacy Policy','privacy-policy/'),('Terms & Conditions','terms/'),('Disclaimer','disclaimer/'),('Grievance Redressal','grievance/'),('Cookie Policy','cookie-policy/')])]
 footer=''.join('<div><h3>'+E(name)+'</h3>'+''.join(L(n,p) for n,p in group)+'</div>' for name,group in footer_lists)
 ticker_settings=LAYOUT.get('breaking',{})
 custom_headlines=ticker_settings.get('custom',[]) if isinstance(ticker_settings,dict) else []
 if isinstance(custom_headlines,list) and ticker_settings.get('mode')=='custom':
  items=[E(str(t).strip()[:170]) for t in custom_headlines[:12] if str(t).strip()]
 else:
  items=[f'<a href="{U(article_path(p))}">{E(p["title"])}</a>' for p in POSTS[:8]]
 ticker=''.join(f'<span class="ticker-item"><span class="ticker-star" aria-hidden="true">◆</span>{item}</span>' for item in items)
 ticker_copy=''.join(f'<span class="ticker-item"><span class="ticker-star">◆</span>{item}</span>' for item in items)
 breakbar=(f'<div class="container"><div class="search-strip live-ticker"><span class="breaking-label"><span class="on-air-dot"></span> BREAKING NEWS</span><div class="ticker-window" aria-label="ब्रेकिंग न्यूज"><div class="ticker-move"><div class="ticker-segment">{ticker}</div><div class="ticker-segment" aria-hidden="true" inert>{ticker_copy}</div></div></div><button class="ticker-toggle" type="button" aria-label="ब्रेकिंग न्यूज पट्टी थांबवा" aria-pressed="false" title="Pause / Play">Ⅱ</button><a class="search-btn" href="{U("shodh/")}" aria-label="शोधा">⌕</a></div></div>' if items and ticker_settings.get('enabled',True) else '')
 meta=ld_head(title,desc,A(path),image,kind,published,modified)
 return f'''<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#b60013"><link rel="icon" type="image/png" href="{U('assets/img/favicon.png')}"><link rel="manifest" href="{U('manifest.webmanifest')}"><link rel="alternate" type="application/rss+xml" title="लोकहित महाराष्ट्र बातम्या" href="{U('rss.xml')}"><link rel="stylesheet" href="{U('assets/css/style.css')}">{meta}</head><body data-base="{E(BASE)}">
<div class="utility"><div class="container"><span><span id="today-date">महाराष्ट्राचा डिजिटल आवाज</span> · स्वतंत्र मराठी न्यूज पोर्टल</span><div class="utility-links">{quick}<a href="{U('privacy-policy/')}">Privacy Policy</a></div></div></div>
<header class="brand-header"><div class="container brand-inner"><a href="{U()}" class="identity" aria-label="लोकहित महाराष्ट्र मुखपृष्ठ"><img src="{U('assets/img/logo.webp')}" alt="लोकहित महाराष्ट्र लोगो" class="site-logo" width="112" height="112"><div><div class="brand-title">लोकहित <span>महाराष्ट्र</span></div><div class="brand-tagline">{E(CFG['tagline'])}</div></div></a><div class="brand-actions"><a class="icon-btn" href="{U('shodh/')}" aria-label="बातमी शोधा">⌕ शोधा</a><a class="live-nav-cta" href="{U('live-tv/')}">🔴 Live TV</a><a class="admin-link" href="{U('admin/')}" rel="nofollow">🔒 प्रशासन</a></div></div></header>
<nav class="nav" aria-label="मुख्य मेनू"><div class="container nav-inner"><button id="nav-toggle" class="hamburger" aria-expanded="false" aria-controls="nav-links" aria-label="मेनू उघडा">☰</button><div class="nav-links" id="nav-links" style="display:contents">{nav}</div></div></nav>
<main>{breakbar}{content}</main>
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
# Live TV is explicitly credited to the external YouTube broadcaster.
def live_source():
 direct=str(CFG.get('youtube_live_url','')).strip()
 m=re.search(r'(?:youtube\.com/(?:watch\?v=|live/|embed/)|youtu\.be/)([A-Za-z0-9_-]{11})',direct)
 if m:return 'https://www.youtube-nocookie.com/embed/'+m.group(1)
 cid=str(CFG.get('youtube_live_channel_id','')).strip()
 if re.fullmatch(r'UC[A-Za-z0-9_-]{22}',cid):
  return 'https://www.youtube-nocookie.com/embed/live_stream?channel='+cid
 return ''
def live_embed():
 src=live_source()
 if src:
  return '<div class="tv-frame"><iframe src="'+E(src)+'" title="YouTube channel video player" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>'
 return '<div class="tv-offline"><div class="tv-play-symbol">▶</div><h3>YouTube Live TV</h3><p>या विभागासाठी अधिकृत YouTube व्हिडिओ लिंक जोडली जाईल.</p></div>'
def live_link():
 src=str(CFG.get('youtube_live_channel_url','')).strip()
 return src if src.startswith('https://www.youtube.com/') else ''
def live_section(homepage=False):
 label=E(CFG.get('youtube_live_provider','YouTube channel'))
 url=live_link()
 btn='<a class="tv-watch-link" href="'+E(url)+'" target="_blank" rel="noopener noreferrer">YouTube वर चॅनेल उघडा ↗</a>' if url else ''
 note='हे '+label+' या बाह्य YouTube चॅनेलचे प्रक्षेपण आहे; लोकहित महाराष्ट्रचे स्वतःचे प्रक्षेपण नाही. कार्यक्रम लाइव्ह उपलब्ध असताना प्लेअर चालेल.'
 return '<section class="page-section live-tv-section"><div class="section-head"><h2><span class="on-air-dot"></span> YouTube Live TV</h2><a href="'+U('live-tv/')+'">Live TV पान उघडा ›</a></div><div class="tv-layout">'+live_embed()+'<div class="tv-info"><div class="tv-eyebrow">बाह्य YouTube प्रक्षेपण</div><h3>'+label+'</h3><p>'+E(note)+'</p>'+btn+'<div class="tv-status-note">टीप: YouTube वर सध्या लाइव्ह प्रसारण नसल्यास व्हिडिओ उपलब्ध नसेल.</div></div></div></section>'

# Homepage carousel is rendered from the editor-managed slider list.
lead=next((p for p in POSTS if p.get('featured')),POSTS[0] if POSTS else None)
configured=LAYOUT.get('slider',[])
slides=[]
if isinstance(configured,list):
 for item in configured[:12]:
  if not isinstance(item,dict) or not item.get('enabled',True):continue
  post=POST_BY_SLUG.get(str(item.get('slug','')))
  if post:
   slides.append((post,str(item.get('title','')).strip()[:160]))
if not slides:
 slides=[(p,'') for p in ([lead]+[q for q in POSTS if lead and q['slug']!=lead['slug']][:3] if lead else [])]
if slides:
 slide_html=[]
 for i,(post,custom_title) in enumerate(slides):
  is_active=i==0
  slide_html.append(f'<a href="{U(article_path(post))}" class="hero-main hero-slide {"is-active" if is_active else ""}" data-slide-index="{i}" aria-hidden="{"false" if is_active else "true"}" tabindex="{0 if is_active else -1}"><img src="{img(post)}" alt="{E(post["title"])}" fetchpriority="{"high" if is_active else "auto"}"><div class="hero-content"><span class="tag">{E(post["category"])}</span><h1>{E(custom_title or post["title"])}</h1><p>{E(post["description"])}</p><div class="meta">📅 {E(time_marathi(post["date"]))} · लोकहित महाराष्ट्र डिजिटल डेस्क</div></div></a>')
 controls=''
 if len(slide_html)>1:
  dots=''.join(f'<button type="button" class="hero-dot {"is-active" if i==0 else ""}" aria-label="बातमी स्लाइड {i+1}" aria-current="{"true" if i==0 else "false"}" data-slide-to="{i}"></button>' for i in range(len(slide_html)))
  controls=f'<button class="hero-arrow hero-prev" type="button" aria-label="मागील स्लाइड">‹</button><button class="hero-arrow hero-next" type="button" aria-label="पुढील स्लाइड">›</button><div class="hero-dots">{dots}</div>'
 seconds=LAYOUT.get('slider_seconds',6)
 seconds=seconds if isinstance(seconds,(int,float)) and 3<=seconds<=15 else 6
 hero=f'<div class="hero-slider" id="hero-slider" aria-roledescription="carousel" aria-label="मुख्य बातम्या" data-interval="{int(seconds)*1000}">{"".join(slide_html)}{controls}</div>'
else:
 hero='<div class="empty-state">बातम्या लवकरच उपलब्ध होतील.</div>'
other_posts=[p for p in POSTS if not lead or p['slug']!=lead['slug']]
home=f'<div class="container"><section class="page-section hero-layout">{hero}<div class="hero-stack">'+''.join(stack(p) for p in other_posts[:4])+f'</div><div class="hero-latest side-panel"><div class="panel-title">ताज्या बातम्या <a href="{U("tajya-batmya/")}">सर्व पहा ›</a></div><div class="panel-content">'+''.join(latest(p) for p in POSTS[5:11])+'</div></div></section>'
home+=section('दुष्काळ विशेष',[p for p in POSTS if p['category'] in ('दुष्काळ विशेष','मराठवाडा','पाणी')][:4],CATEGORY_PATH['दुष्काळ विशेष'])
home+='<section class="page-section drought-banner"><div><h2>🌾 दुष्काळ विशेष : माहिती, मदत आणि मार्गदर्शन</h2><p>पाणी, चारा, कर्ज, शेतकरी मदत व रोजगाराच्या बातम्या एकाच ठिकाणी</p></div><a href="'+U(CATEGORY_PATH['दुष्काळ विशेष'])+'">सर्व बातम्या पहा →</a></section>'
home+=live_section(True)
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
  if para.startswith('### '):body.append('<h3>'+E(para[4:])+'</h3>');continue
  if para.startswith('## '):body.append('<h2>'+E(para[3:])+'</h2>');continue
  if para.startswith('# '):body.append('<h2>'+E(para[2:])+'</h2>');continue
  vid=youtube_id(para)
  if vid:body_yts.append(vid)
  if re.match(r'^[-*] ',para):
   items=[re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',E(line[2:])) for line in para.split('\n') if line.startswith(('- ','* '))]
   body.append('<ul>'+''.join('<li>'+item+'</li>' for item in items)+'</ul>')
   continue
  safe=re.sub(r'\*\*([^*\n]+)\*\*',r'<strong>\1</strong>',E(para))
  safe=re.sub(r'(?<!\*)\*([^*\n]+)\*(?!\*)',r'<em>\1</em>',safe)
  body.append('<p>'+safe.replace('\n','<br>')+'</p>')
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
# Live TV page with the provider explicitly credited
livetv_content=f'<div class="container">{breadcrumbs(["Live TV"])}'+live_section(False)+'</div>'
write('live-tv/index.html',shell(livetv_content,'YouTube Live TV | लोकहित महाराष्ट्र','बाह्य YouTube चॅनेलचे मराठी बातम्या व लाइव्ह प्रक्षेपण','live-tv/',active='live-tv/'))
# Static editorial / legal pages
legal=json.loads(r'''{"about":["About Us","Lokhit Maharashtra is an independent Marathi-language digital news and public-information portal serving readers across Maharashtra.",[["Our Mission","We aim to make news about rural life, farming, water, drought, employment, public services and government schemes accessible and understandable. Our coverage includes news reports, explainers, and public-interest analysis."],["Editorial Independence","We distinguish reporting from opinion, seek verifiable evidence, and correct significant errors when brought to our attention. Paid or sponsored content should be clearly identified."],["Not a Government Website","Lokhit Maharashtra is not an official website of any government department. Verify scheme eligibility, deadlines and official orders with the relevant government authority."]]],"contact":["Contact Us","Reach the Lokhit Maharashtra editorial team for feedback, corrections, grievances and business enquiries.",[["Editorial Contact","The publisher's verified editorial email address, postal office address and responsible editor details will be displayed here when formally confirmed. Do not use this page as proof of a physical office or registration."],["Corrections and Feedback","When writing to us, include the article URL, a clear description of your concern, supporting evidence where available, and a way to respond."],["Official Contact Information","Contact email: pending publisher confirmation. Postal address: pending publisher confirmation."]]],"privacy-policy":["Privacy Policy","This policy explains the information processed when you visit Lokhit Maharashtra. Last updated: 1 November 2026.",[["Information We Process","This static website currently does not offer public reader accounts or a comment system. The hosting provider may process standard request logs, including IP address, browser details and access times."],["Third-Party Services","Google Fonts may serve web fonts. YouTube embeds can connect to Google's services when activated. Using social sharing links opens third-party websites governed by their own policies."],["Administration and Credentials","Authorised editorial users interact with the GitHub API to publish content. Access credentials must not be submitted in comments, public posts or shared links. A GitHub access token is used in the browser only for authorised GitHub API requests and is not intentionally stored on our hosting server."],["Cookies and Analytics","No first-party advertising or behavioural tracking system is currently configured in this static project. Third-party embedded services may use their own storage and cookies. This policy must be reviewed if advertising, analytics, registration or forms are added."],["Contact and Changes","For privacy questions, use the official contact details once published. We may update this policy as services and legal requirements change."]]],"terms":["Terms & Conditions","Please read these terms before using Lokhit Maharashtra. Last updated: 1 November 2026.",[["Use of Content","Articles, images, logos and original editorial work may be protected by intellectual-property rights. Do not republish substantial material for commercial purposes without permission or an applicable legal basis."],["Accuracy and Updates","We strive for accuracy, but information on public schemes, dates, benefit amounts and eligibility can change. Always verify important decisions with official documents."],["External Links and Embeds","Our pages may contain links or embedded videos operated by third parties. We do not control their availability, terms, privacy practices or content."],["Acceptable Use","Do not misuse this website, attempt unauthorised access or impersonate an editor. Access to the editorial publishing system is restricted to authorised personnel."],["Changes to Terms","We may revise these terms. Continued use of the website after changes means you should review the latest published version."]]],"disclaimer":["Disclaimer","Lokhit Maharashtra publishes general news, features and public-interest explanations.",[["Independent Publication","This is not an official Maharashtra Government or Government of India portal. Government announcements and benefits are subject to the relevant official notifications."],["No Professional Advice","Content about finance, credit, health, agriculture, insurance or law is for general information only and does not replace advice tailored to your circumstances."],["Illustrative Images","Some article illustrations are AI-generated and symbolic. They do not necessarily show actual people, events or locations. Such images are identified in article captions."],["Nature of Coverage","Some publications are explainers based on publicly available material and should not be mistaken for independently witnessed on-the-ground reporting."]]],"editorial-policy":["Editorial Policy","We aim for accurate, fair and responsible journalism.",[["News, Opinion and Analysis","Readers should be able to distinguish verified news, explanatory articles, opinion and sponsored communication."],["Verification","Claims about official policies, drought declarations, financial assistance, eligibility and deadlines should be checked against primary documents or credible, attributable reporting before publication."],["Images and Video","We label illustrative or AI-created images. Third-party YouTube videos remain under their respective owners' rights and platform terms."],["Corrections and Independence","We review credible correction requests and aim to separate editorial decisions from commercial influence."]]],"corrections":["Corrections Policy","We welcome evidence-based corrections to published content.",[["Request a Correction","Send the article URL, the exact statement you dispute, a brief explanation and supporting documents to the verified editorial contact once available."],["Review","Editors should assess the evidence and update, clarify or remove demonstrably inaccurate material as appropriate."],["Transparency","Where a material factual error is corrected, we aim to mark the article's update date and explain significant changes when appropriate."]]],"advertise":["Advertising & Partnerships","Information for potential advertisers and partners.",[["Advertising Enquiries","Verified advertising contact details will be published after confirmation by the publisher."],["Sponsored Content","Paid partnerships, advertisements and promotional articles should be conspicuously labelled so readers can distinguish them from independent editorial coverage."],["Editorial Integrity","Advertising relationships should not override fact-checking and editorial judgment."]]],"grievance":["Grievance Redressal","How to raise concerns about published articles, privacy or content.",[["Submit a Complaint","Provide the affected URL, a clear statement of the issue, relevant evidence and suitable contact details to the designated grievance contact when published."],["Publisher Details","The verified grievance officer's name, official contact email, office address and applicable procedure must be supplied by the publisher before representing this page as complete legal compliance."],["Scope","This is an interim information page, not certification of compliance with any particular regulatory requirement."]]],"cookie-policy":["Cookie Policy","This page explains the use of cookies and similar technology on the site.",[["Current Site Configuration","The website is hosted as a static GitHub Pages project and currently has no configured first-party behavioural advertising or reader tracking cookies."],["Embedded Services","Google Fonts, embedded YouTube video players and social websites may process usage data or set cookies according to their own policies."],["Future Changes","If analytics, advertising networks, subscriptions or other interactive features are added, this page and any required consent arrangements will be revised."]]]}''')
for slug,(title,intro,sections) in legal.items():
 path=slug+'/'
 body=f'<div class="container">{breadcrumbs([E(title)])}<div class="plain-page"><h1>{E(title)}</h1><p>{E(intro)}</p>'+''.join(f'<h2>{E(k)}</h2><p>{E(v)}</p>' for k,v in sections)+'</div></div>'
 write(path+'index.html',shell(body,title,intro,path))
# category listing, post index, sitemap and RSS
index=[{k:p.get(k) for k in ['slug','title','description','category','image','date']} for p in POSTS]
write('posts-index.json',json.dumps(index,ensure_ascii=False,indent=2))
write('manifest.webmanifest',json.dumps({'name':CFG['name'],'short_name':'लोकहित','start_url':BASE,'display':'standalone','background_color':'#ffffff','theme_color':'#b60013','icons':[{'src':U('assets/img/favicon.png'),'sizes':'192x192','type':'image/png'}]},ensure_ascii=False))
allpaths=['','tajya-batmya/','shodh/','video/','live-tv/'] + [x+'/' for x in legal] + [x for x in CATEGORY_PATH.values() if x!='vibhag/video/'] + [article_path(p) for p in POSTS]
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
