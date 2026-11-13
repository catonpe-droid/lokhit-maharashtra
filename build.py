#!/usr/bin/env python3
"""Lokhit Maharashtra static mini-CMS renderer. No external pip dependencies."""
import html, json, os, pathlib, re, shutil, datetime, urllib.parse, xml.etree.ElementTree as ET, hashlib, urllib.request
from email.utils import format_datetime
from functools import lru_cache
from rich_renderer import render_rich
from tina_markdown import render_markdown
ROOT=pathlib.Path(__file__).resolve().parent
OUT=ROOT/'docs'
CFG=json.loads((ROOT/'site.json').read_text(encoding='utf8'))
CUSTOM_DOMAIN=str(CFG.get('custom_domain','')).strip().lower()
if CUSTOM_DOMAIN:
 assert re.fullmatch(r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}',CUSTOM_DOMAIN), 'Invalid custom domain'
BASE=os.environ.get('SITE_BASE', '/' if CUSTOM_DOMAIN else CFG['base_path']).rstrip('/')+'/'
URL=os.environ.get('SITE_URL', 'https://'+CUSTOM_DOMAIN+'/' if CUSTOM_DOMAIN else CFG['site_url']).rstrip('/')+'/'
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
# Remove old generated article pages for stories deleted from the source.
# Without this, the existing /docs/batmi/<slug>/index.html can remain publicly
# accessible even after a deleted story vanishes from content/posts.
published_slugs={str(p['slug']) for p in POSTS}
article_dir=OUT/'batmi'
if article_dir.is_dir():
 for old_dir in article_dir.iterdir():
  if old_dir.is_dir() and old_dir.name!='sheet' and old_dir.name not in published_slugs and (old_dir/'index.html').is_file():
   shutil.rmtree(old_dir)
# Editor-managed layout data, committed to GitHub by the CMS.
try:
 LAYOUT=json.loads((ROOT/'content/layout.json').read_text(encoding='utf8'))
except (OSError,ValueError) as exc:
 print('WARNING: layout unavailable:',exc)
 LAYOUT={}
POST_BY_SLUG={p['slug']:p for p in POSTS}
PAGES=[('महाराष्ट्र','maharashtra'),('मराठवाडा','marathwada'),('विदर्भ','vidarbha'),('पश्चिम महाराष्ट्र','paschim-maharashtra'),('कोकण','konkan'),('दुष्काळ विशेष','dushkal'),('शेती','sheti'),('शासन योजना','shasan-yojana'),('पशुसंवर्धन','pashusanvardhan'),('पाणी','pani'),('रोजगार','rojgar'),('ग्रामविकास','gramvikas'),('महिला व विकास','mahila-vikas'),('अर्थकारण','arthakaran'),('राजकारण','rajkaran'),('समाज','samaj'),('शिक्षण','shikshan'),('आरोग्य','arogya'),('विश्लेषण','vishleshan'),('व्हिडिओ','video')]
# Editable categories, with stable URL slugs. Existing categories and article links are retained.
DEFAULT_PAGES=list(PAGES)
custom_categories=LAYOUT.get('categories')
if isinstance(custom_categories,list) and custom_categories:
 categories=[]
 for entry in custom_categories[:40]:
  if not isinstance(entry,dict):continue
  name=str(entry.get('name','')).strip()[:65]
  slug=str(entry.get('slug','')).strip().lower()[:65]
  if name and re.fullmatch(r'[a-z0-9][a-z0-9-]{1,64}',slug) and name not in [n for n,_ in categories] and slug not in [x for _,x in categories]:
   categories.append((name,slug))
 if categories:PAGES=categories
# Keep all legacy category routes as compatibility fallbacks, even if a
# category is taken out of the editor list. Old links must keep working.
for name,slug in DEFAULT_PAGES:
 if name not in [x for x,_ in PAGES] and slug not in [x for _,x in PAGES]:PAGES.append((name,slug))
CATEGORY_PATH={name:'vibhag/'+slug+'/' for name,slug in PAGES}
HOME_SECTIONS=LAYOUT.get('homepage',{}) if isinstance(LAYOUT.get('homepage'),dict) else {}
def home_enabled(name,default=True):return HOME_SECTIONS.get(name,{}).get('enabled',default) is not False
def news_count(value,default=4):
 try:return max(1,min(12,int(value)))
 except (ValueError,TypeError):return default
def home_count(name,default=4):return news_count(HOME_SECTIONS.get(name,{}).get('count',default),default)
def category_label(name):
 for c in LAYOUT.get('categories',[]) if isinstance(LAYOUT.get('categories'),list) else []:
  if isinstance(c,dict) and c.get('name')==name:return str(c.get('label') or name).strip()[:65] or name
 return name
DEFAULT_NAV=[('मुख्यपृष्ठ',''),('ताज्या बातम्या','tajya-batmya/'),('महाराष्ट्र',CATEGORY_PATH['महाराष्ट्र']),('मराठवाडा',CATEGORY_PATH['मराठवाडा']),('विदर्भ',CATEGORY_PATH['विदर्भ']),('दुष्काळ विशेष',CATEGORY_PATH['दुष्काळ विशेष']),('शेती',CATEGORY_PATH['शेती']),('शासन योजना',CATEGORY_PATH['शासन योजना']),('🏛️ शासकीय दुवे','shasakiy-duve/'),('पशुसंवर्धन',CATEGORY_PATH['पशुसंवर्धन']),('राजकारण',CATEGORY_PATH['राजकारण']),('व्हिडिओ','video/'),('🔴 Live TV','live-tv/'),('विश्लेषण',CATEGORY_PATH['विश्लेषण'])]
CUSTOM_NAV=LAYOUT.get('menu')
NAV=[(str(item.get('title','')).strip()[:65],str(item.get('href','')).strip()) for item in CUSTOM_NAV if isinstance(item,dict) and item.get('enabled',True) and str(item.get('title','')).strip() and re.fullmatch(r'[A-Za-z0-9_/-]*',str(item.get('href','')).strip())] if isinstance(CUSTOM_NAV,list) else DEFAULT_NAV
# Suppress Live TV menu entries when the Live TV section is disabled.
if not home_enabled('live_tv',False):NAV=[(t,h) for t,h in NAV if h!='live-tv/']
NAV= NAV[:24] if NAV else [(t,h) for t,h in DEFAULT_NAV if h!='live-tv/']
def article_path(p):return 'batmi/'+p['slug']+'/'
def article_url(p):return A(article_path(p))
def time_marathi(s):
 try:return datetime.datetime.fromisoformat(s).strftime('%d-%m-%Y')
 except:return ''
def img(p):
 src=str(p.get('image') or 'assets/img/logo.webp')
 return src if src.startswith('https://') else U(src)
def absolute_image(p):
 src=str(p.get('image') or 'assets/img/logo.webp')
 return src if src.startswith('https://') else A(src)
def share_preview_image(p):
 # WhatsApp/Facebook scrape the static HTML, not the browser's JavaScript.
 # Google Drive's googleusercontent /d/ links can reject social crawlers.
 # Mirror publicly shared Drive photos into our own GitHub Pages assets.
 src=str(p.get('image') or 'assets/img/logo.webp').strip()
 if not src.startswith('https://'):return A(src)
 parsed=urllib.parse.urlsplit(src)
 if parsed.scheme!='https' or parsed.hostname!='lh3.googleusercontent.com' or not re.fullmatch(r'/d/[A-Za-z0-9_-]+',parsed.path):
  return src
 slug=re.sub(r'[^a-z0-9_-]','',str(p.get('slug') or 'news').lower())[:100]
 digest=hashlib.sha256(src.encode('utf8')).hexdigest()[:12]
 folder=ROOT/'assets/img/share'
 for ext in ('jpg','png','webp'):
  name=f'{slug}-{digest}.{ext}'
  cached=folder/name
  if cached.is_file() and 1500<=cached.stat().st_size<=5_000_000:
   return A('assets/img/share/'+name)
 try:
  request=urllib.request.Request(src,headers={
   'User-Agent':'Mozilla/5.0 (compatible; LokhitNewsPreview/1.0)',
   'Accept':'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.9'})
  with urllib.request.urlopen(request,timeout=16) as response:
   data=response.read(5_000_001)
  if not 1500<=len(data)<=5_000_000:raise ValueError('image size outside share-preview limits')
  if data[:3]==bytes.fromhex('ffd8ff'):ext='jpg'
  elif data[:8]==bytes.fromhex('89504e470d0a1a0a'):ext='png'
  elif data[:4]==b'RIFF' and data[8:12]==b'WEBP':ext='webp'
  else:raise ValueError('not a supported image')
  folder.mkdir(parents=True,exist_ok=True)
  name=f'{slug}-{digest}.{ext}'
  (folder/name).write_bytes(data)
  print('Cached social preview:',name,len(data),'bytes')
  return A('assets/img/share/'+name)
 except (OSError,ValueError,TimeoutError) as exc:
  # Prefer the public portal logo to a blocked Google Drive thumbnail.
  print('WARNING: Unable to mirror social image for',slug,':',exc)
  return A('assets/img/logo.webp')
def ld_head(title,desc,canonical,image=None,kind='website',published=None,modified=None,schema=None):
 metadata={'@context':'https://schema.org','@type':'WebSite' if kind=='website' else 'NewsArticle','headline':title,'name':title,'description':desc,'url':canonical,'inLanguage':'mr-IN','publisher':{'@type':'Organization','name':CFG['name'],'legalName':CFG.get('publisher_legal_name',CFG['name']),'identifier':{'@type':'PropertyValue','propertyID':'Udyam MSME registration','value':CFG.get('udyam_registration_number','')},'logo':{'@type':'ImageObject','url':A('assets/img/logo.webp')}}}
 metadata['editor']={'@type':'Person','name':CFG.get('editor_name','')}
 metadata['publisher']['sameAs']=CFG.get('youtube_url','')
 if kind=='article':metadata.update({'image':[image or A('assets/img/logo.webp')],'datePublished':published,'dateModified':modified or published,'author':{'@type':'Organization','name':CFG['name']},'mainEntityOfPage':canonical})
 elif kind=='website':metadata.update({'potentialAction':{'@type':'SearchAction','target':A('shodh/')+'?q={search_term_string}','query-input':'required name=search_term_string'}})
 page_title=(CFG["name"]+" | मुख्य कार्यकारी संपादक "+CFG.get("editor_name","")+" | उद्यम MSME "+CFG.get("udyam_registration_number","") if canonical==URL else title+" | "+CFG["name"])
 social_title=(CFG["name"]+" | मुख्य कार्यकारी संपादक: "+CFG.get("editor_name","")+" | उद्यम नोंदणी: "+CFG.get("udyam_registration_number","") if canonical==URL else title)
 share_desc=(desc+" | मुख्य कार्यकारी संपादक: "+CFG.get("editor_name","")+" | उद्यम MSME: "+CFG.get("udyam_registration_number",""))
 tags=[f'<title>{E(page_title)}</title>',f'<meta name="description" content="{E(share_desc)}">',f'<link rel="canonical" href="{E(canonical)}">',f'<meta property="og:type" content="{"article" if kind=="article" else "website"}">',f'<meta property="og:title" content="{E(social_title)}">',f'<meta property="og:description" content="{E(share_desc)}">',f'<meta property="og:url" content="{E(canonical)}">',f'<meta property="og:site_name" content="{E(CFG["name"])}">',f'<meta property="og:locale" content="mr_IN">',f'<meta property="og:image" content="{E(image or A("assets/img/logo.webp"))}">',f'<meta property="og:image:alt" content="{E(social_title)}">',f'<meta name="twitter:card" content="summary_large_image">',f'<meta name="twitter:title" content="{E(social_title)}">',f'<meta name="twitter:image" content="{E(image or A("assets/img/logo.webp"))}">',f'<script type="application/ld+json">{json.dumps(metadata,ensure_ascii=False)}</script>']
 # Declare the HTTPS preview image explicitly for messaging/social crawlers.
 preview=image or A('assets/img/logo.webp')
 tags.extend([f'<meta property="og:image:secure_url" content="{E(preview)}">',f'<meta name="twitter:description" content="{E(share_desc)}">',f'<meta name="twitter:image:alt" content="{E(social_title)}">'])
 extension=urllib.parse.urlsplit(preview).path.rsplit('.',1)[-1].lower()
 image_mimes={'jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png','webp':'image/webp'}
 if extension in image_mimes:tags.append(f'<meta property="og:image:type" content="{image_mimes[extension]}">')
 if kind=='article':tags+= [f'<meta property="article:published_time" content="{E(published)}">',f'<meta property="article:modified_time" content="{E(modified or published)}">']
 return '\n'.join(tags)
def shell(content,title,desc,path='',image=None,kind='website',published=None,modified=None,active=''):
 lang='en' if path in {name+'/' for name in ['about','contact','privacy-policy','terms','disclaimer','editorial-policy','corrections','advertise','grievance','cookie-policy']} else 'mr'
 nav=''.join(f'<a class="{"active" if active==href else ""}" href="{U(href)}">{E(text)}</a>' for text,href in NAV)
 quick=''.join(L(s,path) for s,path in [('About Us','about/'),('Contact','contact/'),('Advertise','advertise/')])
 yt_url=str(CFG.get('youtube_url','')).strip()
 yt_url=yt_url if yt_url.startswith('https://www.youtube.com/') else ''
 yt_action=(f'<a class="youtube-header-btn" href="{E(yt_url)}" target="_blank" rel="noopener noreferrer" aria-label="लोकहित महाराष्ट्र YouTube चॅनेल उघडा" title="Lokhit Maharashtra YouTube"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="25" height="25" aria-hidden="true" focusable="false"><rect x="1.2" y="4.2" width="21.6" height="15.6" rx="5" fill="#ff0033"/><path d="M10 8.1L16.2 12L10 15.9Z" fill="#fff"/></svg></a>') if yt_url else ''
 yt_footer=f'<p><a href="{E(yt_url)}" target="_blank" rel="noopener noreferrer">▶ Lokhit Maharashtra — @LokhitMaharashtra1 (YouTube)</a></p>' if yt_url else ''
 footer_lists=[('विभाग',[('महाराष्ट्र',CATEGORY_PATH['महाराष्ट्र']),('मराठवाडा',CATEGORY_PATH['मराठवाडा']),('दुष्काळ विशेष',CATEGORY_PATH['दुष्काळ विशेष']),('शेती',CATEGORY_PATH['शेती']),('शासन योजना',CATEGORY_PATH['शासन योजना']),('शासकीय दुवे','shasakiy-duve/')]),('Information',[('About Us','about/'),('Contact','contact/'),('Editorial Policy','editorial-policy/'),('Corrections Policy','corrections/'),('Advertise','advertise/')]),('Legal & Policies',[('Privacy Policy','privacy-policy/'),('Terms & Conditions','terms/'),('Disclaimer','disclaimer/'),('Grievance Redressal','grievance/'),('Cookie Policy','cookie-policy/')])]
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
 return f'''<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#b60013"><link rel="icon" type="image/png" href="{U('assets/img/favicon.png')}"><link rel="manifest" href="{U('manifest.webmanifest')}"><link rel="alternate" type="application/rss+xml" title="लोकहित महाराष्ट्र बातम्या" href="{U('rss.xml')}"><link rel="stylesheet" href="{U('assets/css/style.css')}?v=20261105-sidebarrestore3">{meta}{GOV_STYLE if path in ("", "shasakiy-duve/") else ""}</head><body data-base="{E(BASE)}">
<div class="utility"><div class="container"><span><span id="today-date">महाराष्ट्राचा डिजिटल आवाज</span> · स्वतंत्र मराठी न्यूज पोर्टल</span><div class="utility-links">{quick}<a href="{U('privacy-policy/')}">Privacy Policy</a></div></div></div>

<header class="brand-header"><div class="container brand-inner"><a href="{U()}" class="identity" aria-label="लोकहित महाराष्ट्र मुख्यपृष्ठ"><img src="{U('assets/img/logo.webp')}" alt="लोकहित महाराष्ट्र लोगो" class="site-logo" width="112" height="112"><div class="brand-copy"><div class="brand-title">लोकहित <span>महाराष्ट्र</span></div><div class="brand-tagline">{E(CFG['tagline'])}</div><div class="brand-detail-lines"><div class="brand-editor"><span>मुख्य कार्यकारी संपादक :</span> <strong>{E(CFG.get('editor_name',''))}</strong></div><div class="brand-registration"><span>उद्यम MSME नोंदणी :</span> <strong>{E(CFG.get('udyam_registration_number',''))}</strong></div></div></div></a><div class="brand-actions"><a class="icon-btn" href="{U('shodh/')}" aria-label="बातमी शोधा">⌕ शोधा</a>{('<a class="live-nav-cta" href="'+U('live-tv/')+'">🔴 Live TV</a>') if home_enabled('live_tv',False) else ''}{yt_action}</div></div></header>
<nav class="nav" aria-label="मुख्य मेनू"><div class="container nav-inner"><button id="nav-toggle" class="hamburger" aria-expanded="false" aria-controls="nav-links" aria-label="मेनू उघडा">☰</button><div class="nav-links" id="nav-links" style="display:contents">{nav}</div></div></nav>
<main>{breakbar}{content}</main>
<footer class="footer"><div class="container"><div class="footer-grid"><div><div class="footer-brand"><img src="{U('assets/img/logo.webp')}" alt="" class="footer-logo">लोकहित महाराष्ट्र</div><p>{E(CFG['tagline'])}. महाराष्ट्र, दुष्काळ, शेती, योजना आणि ग्रामीण विकासाविषयी मराठी माहिती.</p><small>डिजिटल न्यूज व जनमाहिती पोर्टल. हे कोणत्याही शासकीय कार्यालयाचे अधिकृत संकेतस्थळ नाही.</small><p class="footer-udyam">मुख्य कार्यकारी संपादक : <strong>{E(CFG.get("editor_name",""))}</strong><span>MSME उद्यम नोंदणी: <strong>{E(CFG.get("udyam_registration_number",""))}</strong></span><span>उद्यम नाव: {E(CFG.get("publisher_legal_name",""))}</span></p>{yt_footer}</div>{footer}</div><div class="footer-bottom"><span>© २०२६ लोकहित महाराष्ट्र. सर्व हक्क राखीव.</span><span>माहितीतील त्रुटी निदर्शनास आणण्यासाठी संपर्क पृष्ठ वापरा.</span></div></div></footer>
<div id="toast" class="toast" role="status" aria-live="polite"></div><script src="{U('assets/js/site.js')}?v=20261105-sidebarrestore3" defer></script></body></html>'''.replace('id="nav-links" style="display:contents"','id="nav-links"')
def write(path,content):
 target=OUT/path
 target.parent.mkdir(parents=True,exist_ok=True)
 target.write_text(content,encoding='utf8')
def section(title,items,see=None,grid_id='',limit=4):
 if not items:return ''
 see=see or CATEGORY_PATH.get(title,'tajya-batmya/')
 grid_attr=' id="'+E(grid_id)+'"' if grid_id else ''
 return f'<section class="page-section"><div class="section-head"><h2>{E(title)}</h2></div><div class="news-grid"{grid_attr}>'+''.join(card(p) for p in items[:min(4,news_count(limit))])+f'</div><div class="home-more-news"><a class="home-more-news-button" href="{U(see)}">आणखी बातम्या वाचा ›</a></div></section>'
def card(p):
 return f'<a class="news-card" data-article-slug="{E(p["slug"])}" href="{U(article_path(p))}"><img src="{img(p)}" alt="{E(p["title"])}" width="480" height="270" loading="lazy"><div class="card-body"><span class="category-kicker">{E(p["category"])}</span><h3>{E(p["title"])}</h3><p>{E(p["description"])}</p><div class="meta"><span>📅 {E(time_marathi(p["date"]))}</span><span>लोकहित डेस्क</span></div></div></a>'
def stack(p):return f'<a class="stack-card" href="{U(article_path(p))}"><img src="{img(p)}" alt="" loading="lazy"><div><h3>{E(p["title"])}</h3><span class="meta">{E(time_marathi(p["date"]))}</span></div></a>'
def latest(p):return f'<a class="latest-item" href="{U(article_path(p))}"><span class="latest-dot">•</span><span>{E(p["title"])}</span></a>'
def breadcrumbs(parts):return '<div class="breadcrumbs"><a href="'+U()+'">मुख्यपृष्ठ</a> / '+' / '.join(parts)+'</div>'

# Curated official public-service links. External portals remain operated by their owners.
GOV_GROUPS = [{"id":"seva","title":"नागरिक सेवा व शासन निर्णय","icon":"🏛️","sites":[["महाराष्ट्र शासन","सर्व विभाग, घोषणा व शासन सेवा","https://www.maharashtra.gov.in/"],["आपले सरकार","उत्पन्न, जात, रहिवासी व इतर दाखले","https://aaplesarkar.mahaonline.gov.in/"],["शासन निर्णय (GR)","विभागनिहाय सरकारी निर्णय व परिपत्रके","https://gr.maharashtra.gov.in/1145/Government-Resolutions"],["आपले सरकार तक्रार निवारण","नागरिकांच्या तक्रारी व पाठपुरावा","https://grievances.maharashtra.gov.in/"],["महाराष्ट्र RTI ऑनलाइन","माहिती अधिकार अर्ज व प्रथम अपील","https://rtionline.maharashtra.gov.in/"],["भारत सरकार सेवा पोर्टल","केंद्र व राज्य शासनाच्या सेवा शोधा","https://services.india.gov.in/"],["भारताचे राष्ट्रीय पोर्टल","केंद्र सरकारची माहिती व सेवा","https://www.india.gov.in/"]]},{"id":"land","title":"जमीन व महसूल","icon":"📜","sites":[["महाभूलेख – ७/१२ व ८अ","जमिनीचे ऑनलाइन उतारे पाहा","https://bhulekh.mahabhumi.gov.in/"],["महाभूमी","जमीन अभिलेख, ई-फेरफार व इतर सेवा","https://mahabhumi.gov.in/mahabhumilink"],["डिजिटल सातबारा","डिजिटल स्वाक्षरीत सातबारा उतारा","https://digitalsatbara.mahabhumi.gov.in/"],["नोंदणी व मुद्रांक विभाग","मालमत्ता नोंदणीसंबंधी माहिती","https://igrmaharashtra.gov.in/"]]},{"id":"agri","title":"शेती, शेतकरी व पशुपालन","icon":"🌾","sites":[["महाराष्ट्र कृषी विभाग","शेतीसंबंधी योजना व शासकीय सूचना","https://krishi.maharashtra.gov.in/"],["महाडीबीटी शेतकरी","कृषी योजनांसाठी अर्ज व अर्जस्थिती","https://mahadbt.maharashtra.gov.in/Farmer/AgriLogin/AgriLogin"],["पीएम किसान","शेतकरी लाभार्थी माहिती व ई-केवायसी","https://pmkisan.gov.in/"],["पीकविमा – PMFBY","पीकविमा अर्ज व पॉलिसी स्थिती","https://pmfby.gov.in/"],["पशुसंवर्धन विभाग","पशुधन, दुग्धविकास व विभागीय योजना","https://dahd.maharashtra.gov.in/"],["भारतीय हवामान विभाग","हवामान अंदाज, पाऊस व इशारे","https://mausam.imd.gov.in/"]]},{"id":"women","title":"महिला, बचत गट व सामाजिक योजना","icon":"👩‍🌾","sites":[["महिला व बालविकास विभाग","महिला, बालकल्याण व संबंधित योजना","https://womenchild.maharashtra.gov.in/"],["उमेद – ग्रामीण जीवनोन्नती अभियान","महिला बचत गट व ग्रामीण उपजीविका","https://rdd.maharashtra.gov.in/en/maharashtra-state-rural-livelihood-mission/"],["महाDBT योजना","शिष्यवृत्ती, निवृत्तीवेतन व इतर लाभ","https://mahadbt.maharashtra.gov.in/"],["महाDBT 2.0","२०२६–२७ शैक्षणिक वर्षातील अर्जांसाठी पोर्टल","https://mahadbt2.maharashtra.gov.in/"]]},{"id":"education","title":"शिक्षण, युवक व रोजगार","icon":"🎓","sites":[["महास्वयंम","नोकरी, कौशल्य प्रशिक्षण व स्वयंरोजगार","https://www.mahaswayam.gov.in/"],["राष्ट्रीय शिष्यवृत्ती पोर्टल","केंद्र शासनाच्या शिष्यवृत्ती व अर्ज","https://scholarships.gov.in/"],["डिजिलॉकर","अधिकृत डिजिटल कागदपत्रे उपलब्ध करा","https://www.digilocker.gov.in/"]]},{"id":"welfare","title":"कामगार, रेशन व जनसेवा","icon":"🤝","sites":[["ई-श्रम","असंघटित कामगारांसाठी नोंदणी","https://eshram.gov.in/"],["बांधकाम कामगार मंडळ","बांधकाम कामगार नोंदणी व कल्याण योजना","https://www.mahabocw.in/"],["रेशनकार्ड व्यवस्थापन","रेशनकार्ड अर्ज व संबंधित सेवा","https://rcms.mahafood.gov.in/"],["केंद्रीय तक्रार निवारण – CPGRAMS","केंद्र व सार्वजनिक सेवांवरील तक्रारी","https://pgportal.gov.in/"]]},{"id":"ngo","title":"स्वयंसेवी संस्था व नोंदणी","icon":"🏢","sites":[["एनजीओ दर्पण – NITI Aayog","संस्थांसाठी दर्पण नोंदणी व युनिक आयडी","https://ngodarpan.gov.in/"],["धर्मादाय आयुक्त, महाराष्ट्र","विश्वस्त संस्था नोंदणी व माहिती","https://charity.aurionprosolutions.com/"]]}]
GOV_STYLE = r'''<style id="gov-style-20261104">
/* Lokhit government links • polished accessible directory • 2026-11-04 */
.gov-home,.gov-directory{--gd-ink:#183148;--gd-deep:#102b43;--gd-muted:#647487;--gd-border:#e3e9ec;--gd-accent:#ae112c;font-family:'Mukta','Noto Sans Devanagari',system-ui,sans-serif}
.gov-home{padding:26px 27px 28px!important;background:#fff!important;border:1px solid var(--gd-border)!important;border-radius:16px!important;box-shadow:0 12px 36px rgba(17,44,65,.055)!important}
.gov-home .section-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:18px!important;margin:0 0 9px!important;border:0!important;padding:0!important;flex-wrap:wrap!important}
.gov-home .section-head h2{margin:0!important;padding:0!important;background:none!important;color:var(--gd-deep)!important;border:0!important;box-shadow:none!important;font-size:clamp(23px,2.4vw,29px)!important;line-height:1.32!important;letter-spacing:0!important}
.gov-home .section-head a{display:inline-flex!important;align-items:center!important;justify-content:center!important;background:var(--gd-accent)!important;color:#fff!important;padding:9px 15px!important;border-radius:9px!important;text-decoration:none!important;font-size:15px!important;font-weight:800!important;white-space:nowrap!important}
.gov-home .section-head a:hover{background:#850d24!important}
.gov-home .gov-intro{color:#657487!important;font-size:16px!important;margin:0 0 20px!important;line-height:1.7!important}
.gov-link-grid,.gov-home .gov-link-grid,.gov-directory .gov-link-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:14px!important;align-items:stretch!important}
.gov-directory .gov-link-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
.gov-link-card,.gov-home .gov-link-card,.gov-directory .gov-link-card{box-sizing:border-box!important;display:flex!important;align-items:flex-start!important;flex-direction:row!important;gap:12px!important;min-width:0!important;min-height:108px!important;margin:0!important;padding:17px 14px!important;border:1px solid var(--gd-border)!important;border-radius:12px!important;background:#fff!important;text-decoration:none!important;white-space:normal!important;box-shadow:0 2px 6px rgba(30,55,79,.03)!important;position:relative!important;transition:transform .18s,box-shadow .18s,border-color .18s!important}
.gov-link-card:hover{transform:translateY(-3px)!important;border-color:#c4d1da!important;box-shadow:0 10px 25px rgba(24,48,70,.11)!important}
.gov-link-card:focus-visible{outline:3px solid #d05b5c!important;outline-offset:3px!important}
.gov-link-icon{display:flex!important;align-items:center!important;justify-content:center!important;flex:0 0 42px!important;width:42px!important;height:42px!important;border-radius:10px!important;background:#eaf1f3!important;color:#193c4c!important;font-size:20px!important;line-height:1!important}
.gov-link-copy{display:block!important;min-width:0!important;flex:1 1 auto!important}
.gov-link-copy strong{display:block!important;max-width:100%!important;margin:0!important;color:var(--gd-deep)!important;font-size:17px!important;font-weight:800!important;line-height:1.35!important;overflow-wrap:break-word!important}
.gov-link-copy small{display:block!important;margin-top:5px!important;color:var(--gd-muted)!important;font-size:13.5px!important;font-weight:500!important;line-height:1.55!important;overflow-wrap:break-word!important}
.gov-link-arrow{flex:0 0 auto!important;margin-left:auto!important;color:var(--gd-accent)!important;font-size:17px!important;font-weight:800!important}
.gov-directory{padding-bottom:34px!important}
.gov-directory .breadcrumbs{margin:18px 0 15px!important}
.gov-directory .gov-page-heading{position:relative!important;padding:32px 34px!important;margin:12px 0 22px!important;background:linear-gradient(115deg,#102b43,#204c5c)!important;border:0!important;border-radius:16px!important;box-shadow:0 12px 35px rgba(15,42,63,.12)!important;overflow:hidden!important}
.gov-page-heading:after{content:"";position:absolute;right:-48px;top:-65px;width:250px;height:250px;border:32px solid rgba(255,255,255,.045);border-radius:50%;pointer-events:none}
.gov-directory .gov-page-heading h1{margin:0 0 8px!important;color:#fff!important;font-size:clamp(27px,3.4vw,38px)!important;line-height:1.27!important;position:relative;z-index:1}
.gov-directory .gov-page-heading p{margin:0!important;color:#dce9eb!important;max-width:750px!important;font-size:17px!important;line-height:1.7!important;position:relative;z-index:1}
.gov-directory .gov-search-row{display:flex!important;align-items:center!important;gap:14px!important;margin:0 0 16px!important;flex-wrap:wrap!important}
.gov-directory .gov-search-label{position:relative;display:flex!important;align-items:center!important;flex:1 1 420px!important;max-width:760px!important;background:#fff!important;border:1px solid #cfd8df!important;border-radius:11px!important;min-height:52px!important}
.gov-directory .gov-search-label .gov-search-icon{position:absolute;left:16px;color:#6a7b89;font-size:23px;pointer-events:none}
.gov-directory .gov-search-label input{width:100%!important;background:transparent!important;color:var(--gd-deep)!important;padding:12px 15px 12px 46px!important;border:0!important;outline:0!important;font:600 16px 'Mukta',sans-serif!important}
.gov-directory .gov-search-label:focus-within{border-color:var(--gd-accent)!important;box-shadow:0 0 0 3px rgba(174,17,44,.09)}
.gov-directory .gov-result-count{color:#52687a;font-size:14px;font-weight:800;background:#e8eef0;padding:9px 15px;border-radius:20px}
.gov-directory .gov-category-nav{display:flex!important;flex-wrap:wrap!important;gap:9px!important;margin:0 0 24px!important;padding:0!important;border:0!important;overflow:visible!important}
.gov-directory .gov-category-nav a{display:inline-flex!important;align-items:center!important;gap:4px!important;color:#214056!important;border:1px solid #dbe3e8!important;background:#fff!important;padding:9px 14px!important;border-radius:30px!important;font-size:14px!important;font-weight:800!important;text-decoration:none!important;white-space:normal!important}
.gov-directory .gov-category-nav a:hover{color:var(--gd-accent)!important;background:#fff7f8!important;border-color:#d7b5bf!important}
.gov-directory .gov-directory-section{background:#fff!important;border:1px solid var(--gd-border)!important;border-radius:15px!important;padding:21px 22px 24px!important;margin:0 0 20px!important;scroll-margin-top:20px!important;box-shadow:0 4px 22px rgba(16,42,62,.035)!important}
.gov-directory-section h2,.gov-directory .gov-directory-section h2{font-size:21px!important;line-height:1.4!important;color:var(--gd-deep)!important;font-weight:800!important;padding:0 0 12px!important;margin:0 0 17px!important;border:0!important;border-bottom:1px solid var(--gd-border)!important;background:transparent!important}
.gov-directory .gov-disclaimer{margin-top:25px!important;padding:18px 22px!important;background:#f8fafb!important;border:1px solid #d9e4e8!important;border-left:4px solid var(--gd-accent)!important;border-radius:9px!important;color:#536779!important;font-size:14.5px!important;line-height:1.7!important}
.gov-directory .gov-empty{background:#fff;padding:22px;border:1px dashed #cbd7e1;border-radius:12px;text-align:center;color:#5b7180}
.gov-directory .gov-empty[hidden]{display:none!important}
@media(max-width:1180px){.gov-home .gov-link-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}.gov-directory .gov-link-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:800px){.gov-home .gov-link-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.gov-home{padding:20px!important}.gov-directory .gov-page-heading{padding:24px!important}.gov-directory .gov-directory-section{padding:18px!important}}
@media(max-width:580px){.gov-home .gov-link-grid,.gov-directory .gov-link-grid{grid-template-columns:1fr!important}.gov-home .section-head{align-items:flex-start!important}.gov-home .section-head a{width:100%!important}.gov-home{padding:17px 15px!important}.gov-link-card{min-height:92px!important;padding:13px 12px!important}.gov-link-icon{width:38px!important;height:38px!important;flex-basis:38px!important}.gov-link-copy strong{font-size:16px!important}.gov-directory .gov-page-heading{padding:22px 18px!important;border-radius:12px!important}.gov-directory .gov-page-heading h1{font-size:27px!important}.gov-directory .gov-page-heading p{font-size:15.5px!important}.gov-directory .gov-category-nav{flex-wrap:wrap!important;overflow:visible!important}.gov-directory .gov-category-nav a{font-size:13px!important;padding:7px 10px!important}.gov-directory .gov-directory-section{padding:15px 13px!important}.gov-directory .gov-directory-section h2{font-size:19px!important}}
@media(prefers-reduced-motion:reduce){.gov-link-card{transition:none!important}}
</style>'''
GOV_SCRIPT = r'''
<script>
(function(){
 var input=document.getElementById('gov-search');
 if(!input)return;
 var cards=[].slice.call(document.querySelectorAll('.gov-directory .gov-link-card'));
 var groups=[].slice.call(document.querySelectorAll('.gov-directory .gov-directory-section'));
 var count=document.getElementById('gov-result-count');
 var empty=document.getElementById('gov-no-results');
 function update(){
  var q=(input.value||'').trim().toLocaleLowerCase('mr').normalize('NFKC');
  var shown=0;
  cards.forEach(function(card){
   var match=!q||card.textContent.toLocaleLowerCase('mr').normalize('NFKC').indexOf(q)>=0;
   card.hidden=!match;card.style.display=match?'':'none';if(match)shown++;
  });
  groups.forEach(function(group){group.hidden=!group.querySelector('.gov-link-card:not([hidden])');});
  if(count)count.textContent=shown+' दुवे उपलब्ध';
  if(empty)empty.hidden=shown>0;
 }
 input.addEventListener('input',update);
 update();
})();
</script>
'''

def gov_card(site, icon):
 name,details,url=site
 return (f'<a class="gov-link-card" href="{E(url)}" target="_blank" rel="noopener noreferrer external" aria-label="{E(name)} - नवीन टॅबमध्ये उघडा">'
         f'<span class="gov-link-icon" aria-hidden="true">{E(icon)}</span><span class="gov-link-copy"><strong>{E(name)}</strong><small>{E(details)}</small></span><span class="gov-link-arrow" aria-hidden="true">↗</span></a>')
def govt_home_section():
 lookup={site[0]:(site,group['icon']) for group in GOV_GROUPS for site in group['sites']}
 picks=['आपले सरकार','महाभूलेख – ७/१२ व ८अ','महाडीबीटी शेतकरी','पीएम किसान','पीकविमा – PMFBY','शासन निर्णय (GR)','महाDBT योजना','एनजीओ दर्पण – NITI Aayog']
 links=''.join(gov_card(*lookup[name]) for name in picks if name in lookup)
 total=sum(len(group['sites']) for group in GOV_GROUPS)
 return (f'<section class="page-section gov-home" aria-labelledby="gov-home-title"><div class="section-head"><h2 id="gov-home-title">🏛️ महत्त्वाच्या शासकीय वेबसाइट्स</h2><a href="{U("shasakiy-duve/")}">सर्व {total} दुवे पहा ›</a></div>'
         f'<p class="gov-intro">शेतकरी, महिला, विद्यार्थी, कामगार, बचत गट आणि स्वयंसेवी संस्थांसाठी उपयुक्त अधिकृत संकेतस्थळे एकाच ठिकाणी.</p>'
         f'<div class="gov-link-grid">{links}</div></section>')
def govt_directory_page():
 chips=''.join(f'<a href="#gov-{E(group["id"])}">{E(group["icon"])} {E(group["title"])}</a>' for group in GOV_GROUPS)
 sections=''.join(f'<section class="gov-directory-section" id="gov-{E(group["id"])}"><h2>{E(group["icon"])} {E(group["title"])}</h2><div class="gov-link-grid">'
                  +''.join(gov_card(site,group['icon']) for site in group['sites'])+'</div></section>' for group in GOV_GROUPS)
 return (f'<div class="container gov-directory">{breadcrumbs(["शासकीय दुवे"])}<div class="gov-page-heading"><h1>🏛️ महत्त्वाच्या शासकीय वेबसाइट्स</h1><p>महाराष्ट्र आणि केंद्र शासनाच्या विविध सेवांसाठी उपयुक्त अधिकृत दुव्यांचे संकलन.</p></div>'
         f'<div class="gov-search-row"><label class="gov-search-label" for="gov-search"><span class="gov-search-icon" aria-hidden="true">⌕</span><input type="search" id="gov-search" autocomplete="off" placeholder="शासकीय सेवा शोधा — उदा. सातबारा, किसान, शिष्यवृत्ती"/></label><span class="gov-result-count" id="gov-result-count">{sum(len(g["sites"]) for g in GOV_GROUPS)} दुवे उपलब्ध</span></div>'
         f'<nav class="gov-category-nav" aria-label="शासकीय दुव्यांचे विभाग">{chips}</nav>{sections}'
         f'<div class="gov-empty" id="gov-no-results" hidden>या नावाने कोणताही दुवा सापडला नाही. दुसरा शब्द वापरून शोधा.</div>'
         f'<p class="gov-disclaimer">सूचना: लोकहित महाराष्ट्र हे स्वतंत्र वृत्त व जनमाहिती पोर्टल आहे; शासकीय संकेतस्थळ नाही. बाह्य संकेतस्थळांवरील योजना, अर्ज, पात्रता, शुल्क आणि तारखा संबंधित शासकीय विभागाकडून तपासा. सर्व दुवे नवीन टॅबमध्ये उघडतात.</p>{GOV_SCRIPT}</div>')

# Live TV is explicitly credited to the external YouTube broadcaster.
# Compact Lokhit Maharashtra video player: featured video and four channel picks.
# The YouTube playlist parameter allows playback to continue to the next item.
LOKHIT_VIDEOS=[
 ('ljw_b7h6HqA','विशेष व्हिडिओ'),
 ('cYe2sc91RA8','पाण्याचा प्रत्येक थेंब'),
 ('iUp2W1r_YZ8','एक झाड'),
 ('OCE1lZ2sMYk','खोप्यामंदी खोपा'),
 ('gTxUldst0v4','पाऊस २०२५')
]
def live_link():
 return str(CFG.get('youtube_url','https://www.youtube.com/@LokhitMaharashtra1')).rstrip('/')+'/videos'
def video_embed_url(video_id):
 ids=[video_id]+[vid for vid,_ in LOKHIT_VIDEOS if vid!=video_id]
 return ('https://www.youtube-nocookie.com/embed/'+video_id+
   '?autoplay=1&mute=1&playsinline=1&rel=0&loop=1&playlist='+','.join(ids))
def live_embed(homepage=False):
 primary=LOKHIT_VIDEOS[0][0]
 player_src=video_embed_url(primary)
 source_attr=(' data-lokhit-auto-src="'+E(player_src)+'" src="about:blank"') if homepage else (' src="'+E(player_src)+'"')
 return ('<div class="tv-frame"><iframe data-lokhit-featured-player data-main-video-id="'+primary+'"'+source_attr+
  ' title="लोकहित महाराष्ट्र विशेष व्हिडिओ" loading="eager" referrerpolicy="strict-origin-when-cross-origin"'
  ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>')
def live_section(homepage=False):
 picks=[]
 for i,(video_id,title) in enumerate(LOKHIT_VIDEOS[1:]):
  picks.append('<button type="button" class="tv-video-card" data-video-id="'+E(video_id)+'" data-video-title="'+E(title)+'" aria-label="'+E(title)+' व्हिडिओ पाहा">'
    '<img src="https://i.ytimg.com/vi/'+E(video_id)+'/mqdefault.jpg" loading="lazy" alt="">'
    '<span class="tv-card-title">'+E(title)+'</span><span class="tv-card-play" aria-hidden="true">▶</span></button>')
 side=''.join(picks)
 return ('<section class="page-section live-tv-section">'
  '<div class="section-head"><h2><span class="on-air-dot"></span> लोकहित महाराष्ट्र व्हिडिओ TV</h2>'
  '<a href="'+U('live-tv/')+'">व्हिडिओ पान उघडा ›</a></div>'
  '<div class="tv-layout tv-compact">'
  '<div class="tv-player-col">'+live_embed(homepage)+
  '<div class="tv-player-meta"><span class="tv-featured-label">▶ विशेष व्हिडिओ</span>'
  '<span class="tv-current-title" aria-live="polite">लोकहित महाराष्ट्र — मुख्य व्हिडिओ</span></div></div>'
  '<div class="tv-video-sidebar"><div class="tv-video-sidebar-title">आणखी व्हिडिओ <small>लोकहित महाराष्ट्र</small></div>'
  '<div class="tv-video-list">'+side+'</div>'
  '<a class="tv-all-videos" href="'+E(live_link())+'" target="_blank" rel="noopener noreferrer">सर्व YouTube व्हिडिओ पहा ↗</a>'
  '</div></div></section>')

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
# A freshly featured article takes priority without deleting manual slider entries.
if lead and lead.get('featured'):
 slides=[(lead,'')]+[(post,title) for post,title in slides if post['slug']!=lead['slug']][:3]
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
home=f'<div class="container"><section class="page-section hero-layout">{hero}<div class="hero-stack">'+''.join(stack(p) for p in other_posts[:4])+f'</div><div class="hero-latest side-panel"><div class="panel-title">ताज्या बातम्या <a href="{U("tajya-batmya/")}">सर्व पहा ›</a></div><div class="panel-content">'+''.join(latest(p) for p in POSTS[:8])+'</div></div></section>'
# Homepage blocks and categories are now managed from the secret News Admin.
if home_enabled('latest',True):
 home+=section(str(HOME_SECTIONS.get('latest',{}).get('title') or 'ताज्या बातम्या')[:65],POSTS,'tajya-batmya/',grid_id='homepage-latest-grid',limit=home_count('latest'))
if home_enabled('gov_links',True):home+=govt_home_section()
if home_enabled('drought_news',True):
 home+=section(str(HOME_SECTIONS.get('drought_news',{}).get('title') or 'दुष्काळ विशेष')[:65],[p for p in POSTS if p['category'] in ('दुष्काळ विशेष','मराठवाडा','पाणी')],CATEGORY_PATH.get('दुष्काळ विशेष','tajya-batmya/'),limit=home_count('drought_news'))
if home_enabled('drought_banner',False):
 banner=HOME_SECTIONS.get('drought_banner',{})
 title=str(banner.get('title') or 'दुष्काळ विशेष : माहिती, मदत आणि मार्गदर्शन')[:130]
 description=str(banner.get('description') or 'पाणी, चारा, कर्ज, शेतकरी मदत व रोजगाराच्या बातम्या एकाच ठिकाणी')[:250]
 home+='<section class="page-section drought-banner"><div><h2>🌾 '+E(title)+'</h2><p>'+E(description)+'</p></div><a href="'+U(CATEGORY_PATH.get('दुष्काळ विशेष','tajya-batmya/'))+'">सर्व बातम्या पहा →</a></section>'
if home_enabled('live_tv',False):home+=live_section(True)
category_blocks=HOME_SECTIONS.get('category_blocks')
if not isinstance(category_blocks,list):
 category_blocks=[{'category':n,'title':n,'enabled':True} for n in ['महाराष्ट्र','शेती','शासन योजना','पशुसंवर्धन']]
for item in category_blocks[:20]:
 if not isinstance(item,dict) or item.get('enabled',True) is False:continue
 cat=str(item.get('category','')).strip()
 if cat not in CATEGORY_PATH:continue
 title=str(item.get('title') or category_label(cat))[:65]
 items=[p for p in POSTS if p.get('category')==cat]
 if items:home+=section(title,items,CATEGORY_PATH[cat],limit=news_count(item.get('count',4)))
if home_enabled('more',True):
 # Avoid an empty "more news" module when the site has fewer than 11 posts.
 offset=10 if len(POSTS)>10 else min(4,max(0,len(POSTS)-1))
 home+=section(str(HOME_SECTIONS.get('more',{}).get('title') or 'अधिक बातम्या')[:65],POSTS[offset:],'tajya-batmya/',limit=home_count('more'))
home+='</div>'
write('index.html',shell(home,'लोकहित महाराष्ट्र',CFG['description']))
# Compact, verified government service links in every article sidebar.
# These are external official portals, not live news feeds or endorsements.
GOVT_SIDEBAR_SERVICES=[
 ("💰","PM-KISAN","हप्ता व लाभार्थी स्थिती","https://pmkisan.gov.in/"),
 ("🌱","महाDBT शेतकरी","अनुदान व अर्जाची माहिती","https://mahadbt.maharashtra.gov.in/Farmer/"),
 ("📜","महाभूलेख ७/१२","७/१२, ८अ व मालमत्ता पत्रक","https://bhulekh.mahabhumi.gov.in/"),
 ("🏛️","आपले सरकार","दाखले व नागरिक सेवा","https://aaplesarkar.mahaonline.gov.in/"),
 ("🛡️","पीक विमा योजना","विमा व दावा माहिती","https://pmfby.gov.in/"),
 ("🌾","महाराष्ट्र कृषी विभाग","शेतीविषयक सूचना व योजना","https://krishi.maharashtra.gov.in/")
]
def government_sidebar_widget():
 rows=[]
 for symbol,name,subtitle,url in GOVT_SIDEBAR_SERVICES:
  rows.append(
   '<a class="govt-quick-link" href="'+E(url)+'" target="_blank" rel="noopener noreferrer">'
   '<span class="govt-quick-icon" aria-hidden="true">'+E(symbol)+'</span>'
   '<span class="govt-quick-copy"><strong>'+E(name)+'</strong><small>'+E(subtitle)+'</small></span>'
   '<span class="govt-quick-arrow" aria-hidden="true">↗</span></a>'
  )
 return ('<div class="side-panel govt-quick-panel">'
         '<div class="panel-title">🏛️ महत्त्वाचे शासकीय दुवे</div>'
         '<nav class="govt-quick-links" aria-label="शेतकरी आणि नागरिकांसाठी महत्त्वाच्या शासकीय सेवा">'
         +''.join(rows)+'</nav>'
         '<p class="govt-quick-disclaimer">लिंक संबंधित अधिकृत संकेतस्थळावर उघडेल. योजना, अर्ज व मुदत तेथे तपासा.</p>'
         '</div>')

# Articles
yt_patterns=[re.compile(r'(?:youtube\.com/(?:watch\?v=|shorts/|live/|embed/)|youtu\.be/)([A-Za-z0-9_-]{11})')]
def youtube_id(text):
 for pat in yt_patterns:
  m=pat.search(text or '')
  if m:return m.group(1)
 return None
for p in POSTS:
 if isinstance(p.get('rich_delta'),list):
  # Legacy Quill Studio documents retain their rich Delta support.
  body=render_rich(p['rich_delta'],U)
 else:
  # TinaCMS stores formatted news text as Markdown inside the same JSON body.
  # Raw HTML is never trusted or rendered as executable markup.
  body=render_markdown(p.get('body',''),U)
 tags=[str(t).strip() for t in (p.get('tags') or []) if isinstance(t,str) and str(t).strip()][:12]
 tag_html=('<div class="pill-links" aria-label="बातमीचे विषय"><span>विषय : </span>'+''.join('<a href="'+U('shodh/')+'?q='+urllib.parse.quote(tag)+'">#'+E(tag)+'</a>' for tag in tags)+'</div>') if tags else ''
 yvid=youtube_id(p.get('video',''))
 video=f'<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/{yvid}" title="संबंधित YouTube व्हिडिओ" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>' if yvid else ''
 bar='<div class="share-bar"><strong>ही बातमी शेअर करा :</strong><button class="share-btn share-wa" data-share="wa">WhatsApp</button><button class="share-btn share-fb" data-share="fb">Facebook</button><button class="share-btn share-x" data-share="x">X</button><button class="share-btn share-tg" data-share="tg">Telegram</button><button class="share-btn share-copy" data-share="copy">लिंक कॉपी</button><button class="share-btn share-native" data-share="native">इतर</button></div>'
 related=[q for q in POSTS if q['slug']!=p['slug'] and q['category']==p['category']][:2] or [q for q in POSTS if q['slug']!=p['slug']][:2]
 content=f'<div class="container">{breadcrumbs([E(p["category"]),E(p["title"])])}<div class="content-layout"><article class="article" data-news-revision="{E(p.get("updated") or p["date"])}"><span class="tag">{E(p["category"])}</span><h1>{E(p["title"])}</h1><p class="article-summary">{E(p["description"])}</p><div class="meta"><span>✍ {E(p.get("author",CFG["name"]))}</span><span>📅 {E(time_marathi(p["date"]))}</span></div><figure class="article-figure"><img src="{img(p)}" alt="{E(p["title"])}" width="960" height="540">{"<figcaption>प्रतीकात्मक, संगणकनिर्मित चित्र</figcaption>" if str(p.get("image","")).startswith("assets/img/story-") else ""}</figure>{bar}<div class="article-body">{"".join(body)}{video}</div>{tag_html}{bar}<div class="section-head"><h2>संबंधित बातम्या</h2></div><div class="related-grid">{"".join(card(q) for q in related)}</div></article><aside><div class="side-panel sidebar-box"><div class="panel-title">ताज्या बातम्या</div><div class="panel-content">{"".join(latest(q) for q in POSTS[:9])}</div></div><div class="side-panel"><div class="panel-title">लोकहित विशेष</div><div class="panel-content"><p>शेती, पाणी, रोजगार आणि शासन योजनांची माहिती</p><a class="admin-link" href="{U(CATEGORY_PATH["दुष्काळ विशेष"])}">सर्व लेख पहा</a></div></div>{government_sidebar_widget()}</aside></div></div>'
 write(article_path(p)+'index.html',shell(content,p['title'],p['description'],article_path(p),share_preview_image(p),'article',p['date'],p.get('updated') or p['date']))
# Category pages
for cat,slug in PAGES:
 path='vibhag/'+slug+'/'
 if cat=='व्हिडिओ':continue
 items=[p for p in POSTS if p['category']==cat]
 # curated drought category includes all drought-related content
 if cat=='दुष्काळ विशेष':items=POSTS
 content=f'<div class="container">{breadcrumbs([E(category_label(cat))])}<div class="section-head"><h2>{E(category_label(cat))}</h2></div>'
 content+='<div class="news-grid">'+''.join(card(p) for p in items)+'</div>' if items else '<div class="empty-state">या विभागातील नवीन बातम्या लवकरच प्रकाशित होतील.</div>'
 content+='</div>'
 write(path+'index.html',shell(content,category_label(cat)+' बातम्या',category_label(cat)+' विभागातील ताज्या मराठी बातम्या',path,active=path))
# latest index
path='tajya-batmya/'
latest_content=f'<div class="container">{breadcrumbs(["ताज्या बातम्या"])}<div class="section-head"><h2>ताज्या बातम्या</h2></div><div class="news-grid" id="latest-all-grid">'+''.join(card(p) for p in POSTS)+'</div></div>'
write(path+'index.html',shell(latest_content,'ताज्या बातम्या','लोकहित महाराष्ट्रच्या सर्व बातम्या',path,active=path))
# Reader-accessible immediate article route: works before the next GitHub build.
instant_sidebar='<aside><div class="side-panel sidebar-box"><div class="panel-title">ताज्या बातम्या</div><div class="panel-content" id="live-article-sidebar">'+''.join(latest(q) for q in POSTS[:9])+'</div></div><div class="side-panel"><div class="panel-title">लोकहित विशेष</div><div class="panel-content"><p>शेती, पाणी, रोजगार आणि शासन योजनांची माहिती</p><a class="admin-link" href="'+U(CATEGORY_PATH['दुष्काळ विशेष'])+'">सर्व लेख पहा</a></div></div>'+government_sidebar_widget()+'</aside>'
instant_article='<div class="container"><div class="breadcrumbs" id="live-article-breadcrumb"><a href="'+U()+'">मुख्यपृष्ठ</a> / ताज्या बातम्या</div><div class="content-layout"><article class="article" id="sheet-article-root"><p class="article-summary">बातमी लोड होत आहे…</p></article>'+instant_sidebar+'</div></div>'
# Keep legacy links working, but use a neutral public "live" URL for new news.
# GitHub Pages serves this same full news layout at /batmi/<slug>/ before
# its first static build (404 fallback). Once synced, the proper indexed page takes over.
write('404.html',shell(instant_article,'बातमी','लोकहित महाराष्ट्र बातमी','batmi/'))
# Keep legacy links working, without creating a separate-looking news design.
write('batmi/live/index.html',shell(instant_article,'बातमी','लोकहित महाराष्ट्र बातमी','batmi/live/'))
write('batmi/sheet/index.html',shell(instant_article,'बातमी','लोकहित महाराष्ट्र बातमी','batmi/sheet/'))


# Search page
path='shodh/'
search_content=f'<div class="container">{breadcrumbs(["बातमी शोधा"])}<div class="section-head"><h2>बातमी शोधा</h2></div><form class="results-toolbar" id="search-form"><input type="search" id="search-input" placeholder="मराठी मथळा, विभाग किंवा विषय शोधा..." aria-label="बातमी शोधा"><button type="submit">शोधा</button></form><div id="search-results" class="news-grid"><div class="empty-state">बातम्या लोड होत आहेत...</div></div></div>'
write(path+'index.html',shell(search_content,'बातमी शोधा','लोकहित महाराष्ट्रच्या बातम्या शोधा',path))
# Video page
videos=[p for p in POSTS if youtube_id(p.get('video','')) or youtube_id(p.get('body','')) or any(isinstance(x,dict) and isinstance(x.get("insert"),dict) and x["insert"].get("video") for x in (p.get("rich_delta") if isinstance(p.get("rich_delta"),list) else []))]
video_content=f'<div class="container">{breadcrumbs(["व्हिडिओ"])}<div class="section-head"><h2>व्हिडिओ बातम्या</h2><a href="{E(CFG.get("youtube_url","https://www.youtube.com/@LokhitMaharashtra"))}" target="_blank" rel="noopener noreferrer">▶ लोकहित महाराष्ट्र YouTube चॅनेल</a></div>'+( '<div class="news-grid">'+''.join(card(p) for p in videos)+'</div>' if videos else '<div class="empty-state">अधिकृत व्हिडिओ बातमी उपलब्ध झाल्यावर या विभागात दिसेल. प्रशासनातून बातमीमध्ये YouTube लिंक जोडा.</div>')+'</div>'
write('video/index.html',shell(video_content,'व्हिडिओ बातम्या','YouTube व्हिडिओसह मराठी बातम्या','video/',active='video/'))
# Auto-play video TV page dedicated exclusively to Lokhit Maharashtra
if home_enabled('live_tv',False):
 livetv_content=f'<div class="container">{breadcrumbs(["Live TV"])}'+live_section(False)+'</div>'
 write('live-tv/index.html',shell(livetv_content,'लोकहित महाराष्ट्र व्हिडिओ TV','विशेष व्हिडिओ आणि लोकहित महाराष्ट्रचे इतर निवडक व्हिडिओ','live-tv/',active='live-tv/'))
# Curated government services directory
write('shasakiy-duve/index.html',shell(govt_directory_page(),'महत्त्वाच्या शासकीय वेबसाइट्स','शेतकरी, महिला, विद्यार्थी, कामगार आणि संस्थांसाठी उपयुक्त अधिकृत शासकीय दुवे','shasakiy-duve/',active='shasakiy-duve/'))
# Static editorial / legal pages
legal=json.loads(r'''{"about":["About Us","Lokhit Maharashtra is an independent Marathi-language digital news and public-information portal serving readers across Maharashtra.",[["Our Mission","We aim to make news about rural life, farming, water, drought, employment, public services and government schemes accessible and understandable. Our coverage includes news reports, explainers, and public-interest analysis."],["Editorial Independence","We distinguish reporting from opinion, seek verifiable evidence, and correct significant errors when brought to our attention. Paid or sponsored content should be clearly identified."],["Not a Government Website","Lokhit Maharashtra is not an official website of any government department. Verify scheme eligibility, deadlines and official orders with the relevant government authority."]]],"contact":["Contact Us","Reach the Lokhit Maharashtra editorial team for feedback, corrections, grievances and business enquiries.",[["Editorial Contact","The publisher's verified editorial email address, postal office address and responsible editor details will be displayed here when formally confirmed. Do not use this page as proof of a physical office or registration."],["Corrections and Feedback","When writing to us, include the article URL, a clear description of your concern, supporting evidence where available, and a way to respond."],["Official Contact Information","Contact email: pending publisher confirmation. Postal address: pending publisher confirmation."]]],"privacy-policy":["Privacy Policy","This policy explains the information processed when you visit Lokhit Maharashtra. Last updated: 4 November 2026.",[["Information We Process","This static website currently does not offer public reader accounts or a comment system. The hosting provider may process standard request logs, including IP address, browser details and access times."],["Third-Party Services","Google Fonts may serve web fonts. YouTube embeds can connect to Google's services when activated. Using social sharing links opens third-party websites governed by their own policies."],["Administration and Credentials","Authorised editorial users publish through a secured server service. Publishing credentials are handled on the server and must never be included in public pages, posts, comments or shared links."],["Cookies and Analytics","No first-party advertising or behavioural tracking system is currently configured in this static project. Third-party embedded services may use their own storage and cookies. This policy must be reviewed if advertising, analytics, registration or forms are added."],["Contact and Changes","For privacy questions, use the official contact details once published. We may update this policy as services and legal requirements change."]]],"terms":["Terms & Conditions","Please read these terms before using Lokhit Maharashtra. Last updated: 1 November 2026.",[["Use of Content","Articles, images, logos and original editorial work may be protected by intellectual-property rights. Do not republish substantial material for commercial purposes without permission or an applicable legal basis."],["Accuracy and Updates","We strive for accuracy, but information on public schemes, dates, benefit amounts and eligibility can change. Always verify important decisions with official documents."],["External Links and Embeds","Our pages may contain links or embedded videos operated by third parties. We do not control their availability, terms, privacy practices or content."],["Acceptable Use","Do not misuse this website, attempt unauthorised access or impersonate an editor. Access to the editorial publishing system is restricted to authorised personnel."],["Changes to Terms","We may revise these terms. Continued use of the website after changes means you should review the latest published version."]]],"disclaimer":["Disclaimer","Lokhit Maharashtra publishes general news, features and public-interest explanations.",[["Independent Publication","This is not an official Maharashtra Government or Government of India portal. Government announcements and benefits are subject to the relevant official notifications."],["No Professional Advice","Content about finance, credit, health, agriculture, insurance or law is for general information only and does not replace advice tailored to your circumstances."],["Illustrative Images","Some article illustrations are AI-generated and symbolic. They do not necessarily show actual people, events or locations. Such images are identified in article captions."],["Nature of Coverage","Some publications are explainers based on publicly available material and should not be mistaken for independently witnessed on-the-ground reporting."]]],"editorial-policy":["Editorial Policy","We aim for accurate, fair and responsible journalism.",[["News, Opinion and Analysis","Readers should be able to distinguish verified news, explanatory articles, opinion and sponsored communication."],["Verification","Claims about official policies, drought declarations, financial assistance, eligibility and deadlines should be checked against primary documents or credible, attributable reporting before publication."],["Images and Video","We label illustrative or AI-created images. Third-party YouTube videos remain under their respective owners' rights and platform terms."],["Corrections and Independence","We review credible correction requests and aim to separate editorial decisions from commercial influence."]]],"corrections":["Corrections Policy","We welcome evidence-based corrections to published content.",[["Request a Correction","Send the article URL, the exact statement you dispute, a brief explanation and supporting documents to the verified editorial contact once available."],["Review","Editors should assess the evidence and update, clarify or remove demonstrably inaccurate material as appropriate."],["Transparency","Where a material factual error is corrected, we aim to mark the article's update date and explain significant changes when appropriate."]]],"advertise":["Advertising & Partnerships","Information for potential advertisers and partners.",[["Advertising Enquiries","Verified advertising contact details will be published after confirmation by the publisher."],["Sponsored Content","Paid partnerships, advertisements and promotional articles should be conspicuously labelled so readers can distinguish them from independent editorial coverage."],["Editorial Integrity","Advertising relationships should not override fact-checking and editorial judgment."]]],"grievance":["Grievance Redressal","How to raise concerns about published articles, privacy or content.",[["Submit a Complaint","Provide the affected URL, a clear statement of the issue, relevant evidence and suitable contact details to the designated grievance contact when published."],["Publisher Details","The verified grievance officer's name, official contact email, office address and applicable procedure must be supplied by the publisher before representing this page as complete legal compliance."],["Scope","This is an interim information page, not certification of compliance with any particular regulatory requirement."]]],"cookie-policy":["Cookie Policy","This page explains the use of cookies and similar technology on the site.",[["Current Site Configuration","The website uses static hosting and a secured server publishing service. There is currently no configured first-party behavioural advertising or reader tracking cookie system."],["Embedded Services","Google Fonts, embedded YouTube video players and social websites may process usage data or set cookies according to their own policies."],["Future Changes","If analytics, advertising networks, subscriptions or other interactive features are added, this page and any required consent arrangements will be revised."]]]}''')
legal['about'][2].append(['Chief Executive Editor','मुख्य कार्यकारी संपादक: '+CFG.get('editor_name','')])
legal['about'][2].append(['Udyam Enterprise Registration','Associated enterprise name: '+CFG.get('publisher_legal_name','')+'. Udyam MSME Registration Number: '+CFG.get('udyam_registration_number','')+'. This is an enterprise/MSME registration, not a separate news media accreditation or licence.'])
for slug,(title,intro,sections) in legal.items():
 path=slug+'/'
 body=f'<div class="container">{breadcrumbs([E(title)])}<div class="plain-page"><h1>{E(title)}</h1><p>{E(intro)}</p>'+''.join(f'<h2>{E(k)}</h2><p>{E(v)}</p>' for k,v in sections)+'</div></div>'
 write(path+'index.html',shell(body,title,intro,path))
# category listing, post index, sitemap and RSS
index=[{k:p.get(k) for k in ['slug','title','description','category','image','date']} for p in POSTS]
write('posts-index.json',json.dumps(index,ensure_ascii=False,indent=2))
# Public category catalog for the simple no-login publisher; no secret data.
write('categories.json',json.dumps([{'name':str(c['name']),'label':str(c.get('label') or c['name']),'slug':str(c['slug'])} for c in (LAYOUT.get('categories') if isinstance(LAYOUT.get('categories'),list) and LAYOUT.get('categories') else [{'name':n,'slug':slug} for n,slug in DEFAULT_PAGES]) if isinstance(c,dict) and c.get('name') and c.get('slug') and c.get('name')!='व्हिडिओ'],ensure_ascii=False,indent=2))
# Public copy of already-published articles; lets the unchanged GitHub Editor edit older news.
write('cms-export.json',json.dumps(POSTS,ensure_ascii=False,indent=2))
write('manifest.webmanifest',json.dumps({'name':CFG['name'],'short_name':'लोकहित','start_url':BASE,'display':'standalone','background_color':'#ffffff','theme_color':'#b60013','icons':[{'src':U('assets/img/favicon.png'),'sizes':'192x192','type':'image/png'}]},ensure_ascii=False))
allpaths=['','tajya-batmya/','shodh/','video/','shasakiy-duve/']+(['live-tv/'] if home_enabled('live_tv',False) else []) + [x+'/' for x in legal] + [x for x in CATEGORY_PATH.values() if x!='vibhag/video/'] + [article_path(p) for p in POSTS]
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
for folder in ['assets','admin','news-submit']:
 dest=OUT/folder
 if dest.exists():shutil.rmtree(dest)
 shutil.copytree(ROOT/folder,dest)
if CUSTOM_DOMAIN:
 write('CNAME',CUSTOM_DOMAIN+'\n')
write('.nojekyll','')
print(f'Built {len(POSTS)} published articles, {len(allpaths)} indexable URLs in {OUT}')
