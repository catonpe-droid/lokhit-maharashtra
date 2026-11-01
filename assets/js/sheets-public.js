/* Lokhit Maharashtra: public Google Apps Script articles and live CMS settings. No admin credentials. */
(()=>{'use strict';
 const base=document.body.dataset.base||'/lokhit-maharashtra/';
 const home=document.getElementById('sheet-news-home');
 const latest=document.getElementById('sheet-news-latest');
 const article=document.getElementById('sheet-article-root');
 const scriptUrl=String(window.LOKHIT_SHEETS_WEBAPP_URL||'').trim();
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(scriptUrl)){
  if(article)article.textContent='या बातमीची Google Script जोडणी अद्याप सक्रिय नाही.';
  return;
 }
 const ref=document.createElement('script');
 const cb='lokhitSheetsCallback';
 function make(tag,cl,txt){
  const el=document.createElement(tag);if(cl)el.className=cl;
  if(txt!==undefined)el.textContent=String(txt??'');
  return el;
 }
 function imageUrl(p){
  const img=String(p?.image||'');
  if(/^https:\/\//i.test(img))return img;
  if(/^assets\/img\/[a-z0-9_.-]+$/i.test(img))return base+img;
  return base+'assets/img/logo.webp';
 }
 const source=p=>base+'batmi/sheet/?slug='+encodeURIComponent(String(p.slug||p.id||''));
 const urlFor=p=>p.origin==='github'&&p.slug?base+'batmi/'+encodeURIComponent(p.slug)+'/':source(p);
 function card(p){
  const a=make('a','news-card');a.href=urlFor(p);
  const im=make('img');im.loading='lazy';im.width=480;im.height=270;im.src=imageUrl(p);
  im.alt=String(p.title||'बातमी');im.onerror=()=>{im.onerror=null;im.src=base+'assets/img/logo.webp';};
  const b=make('div','card-body');
  b.append(make('span','category-kicker',p.category),make('h3','',p.title),make('p','',p.description));
  b.append(make('div','meta','✍ '+String(p.author||'लोकहित महाराष्ट्र')));
  a.append(im,b);return a;
 }
 function renderArticle(p){
  article.replaceChildren();
  if(!p){article.append(make('h1','','बातमी सापडली नाही'));return}
  article.append(make('span','tag',p.category),make('h1','',p.title),
   make('p','article-summary',p.description),
   make('div','meta','✍ '+String(p.author||'लोकहित महाराष्ट्र')+' · '+String(p.date||'').slice(0,10)));
  if(p.image){
   const fig=make('figure','article-figure'),img=make('img');
   img.src=imageUrl(p);img.alt=String(p.title||'बातमी');img.onerror=()=>fig.remove();fig.append(img);article.append(fig);
  }
  const section=make('div','article-body');
  for(const para of String(p.body||'').split(/\n\s*\n/).filter(Boolean)){
   if(para.startsWith('## '))section.append(make('h2','',para.slice(3)));
   else section.append(make('p','',para));
  }
  article.append(section);
  if(p.video&&/^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(p.video)){
   const link=make('a','','संबंधित YouTube व्हिडिओ पहा');link.href=p.video;link.target='_blank';link.rel='noopener noreferrer';article.append(link);
  }
  const back=make('a','','← सर्व बातम्या');back.href=base+'tajya-batmya/';article.append(back);
  document.title=String(p.title||'बातमी')+' | लोकहित महाराष्ट्र';
 }
 function updateMenu(layout){
  if(!Array.isArray(layout?.menu)||!layout.menu.length)return;
  const root=document.getElementById('nav-links');if(!root)return;
  const active=layout.menu.filter(m=>m?.enabled!==false&&m.title&&/^[a-z0-9_/-]*$/i.test(String(m.href||'')));
  if(!active.length)return;
  root.replaceChildren(...active.map(m=>{
   const a=make('a','',m.title);a.href=base+String(m.href||'').replace(/^\/+/,'' );return a;
  }));
 }
 function updateBreaking(layout,posts){
  const bar=document.querySelector('.live-ticker');
  if(!bar||!layout?.breaking)return;
  if(layout.breaking.enabled===false){bar.hidden=true;return}
  bar.hidden=false;
  let data=[];
  if(layout.breaking.mode==='custom'&&Array.isArray(layout.breaking.custom)){
   data=layout.breaking.custom.filter(Boolean).slice(0,12).map(s=>({title:String(s)}));
  }else if(posts.length){
   data=posts.slice(0,8).map(p=>({title:p.title,url:urlFor(p)}));
  }
  if(!data.length)return;
  document.querySelectorAll('.ticker-segment').forEach(seg=>{
   seg.replaceChildren(...data.map(x=>{
    const span=make('span','ticker-item');
    span.append(make('span','ticker-star','◆'));
    if(x.url){const a=make('a','',x.title);a.href=x.url;span.append(a)}
    else span.append(document.createTextNode(x.title));
    return span;
   }));
  });
 }
 function updateSlider(layout,items){
  const hero=document.getElementById('hero-slider');
  if(!hero||!Array.isArray(layout?.slider)||!layout.slider.length)return;
  const desired=layout.slider.filter(x=>x?.enabled!==false&&x.slug).slice(0,10);
  const found=desired.map(s=>({meta:s,post:items.find(p=>p.slug===s.slug)})).filter(x=>x.post);
  if(!found.length)return;
  hero.querySelectorAll('.hero-slide').forEach(e=>e.remove());
  const control=hero.querySelector('.hero-prev');
  found.forEach(({meta,post},i)=>{
   const a=make('a','hero-main hero-slide'+(i?'':' is-active'));a.href=urlFor(post);
   a.dataset.slideIndex=String(i);a.setAttribute('aria-hidden',String(i!==0));a.tabIndex=i===0?0:-1;
   const img=make('img');img.src=imageUrl(post);img.alt=post.title;
   img.onerror=()=>{img.onerror=null;img.src=base+'assets/img/logo.webp'};
   const content=make('div','hero-content');
   content.append(make('span','tag',post.category),make('h1','',meta.title||post.title),
    make('p','',post.description),make('div','meta','✍ '+(post.author||'लोकहित महाराष्ट्र')));
   a.append(img,content);hero.insertBefore(a,control||hero.firstChild);
  });
  let dots=hero.querySelector('.hero-dots');
  if(!dots){dots=make('div','hero-dots');hero.append(dots)}
  dots.replaceChildren(...found.map((_,i)=>{
   const b=make('button','hero-dot'+(i?'':' is-active'));b.type='button';b.dataset.slideTo=String(i);
   b.setAttribute('aria-label','बातमी स्लाइड '+(i+1));b.setAttribute('aria-current',String(i===0));return b;
  }));
  if(found.length>1&&!hero.querySelector('.hero-prev')){
   const prev=make('button','hero-arrow hero-prev','‹');prev.type='button';hero.append(prev);
   const next=make('button','hero-arrow hero-next','›');next.type='button';hero.append(next);
  }
  hero.dataset.interval=String((Number(layout.slider_seconds)||6)*1000);
  document.dispatchEvent(new Event('lokhit:hero-updated'));
 }
 function updateSite(site){
  if(!site||typeof site!=='object')return;
  if(site.tagline){const el=document.querySelector('.brand-tagline');if(el)el.textContent=String(site.tagline)}
 }
 function updateCategory(items){
  const m=location.pathname.match(/\/vibhag\/([a-z0-9-]+)\/?$/i);
  if(!m)return;
  const catMap={
   'maharashtra':'महाराष्ट्र','marathwada':'मराठवाडा','vidarbha':'विदर्भ',
   'paschim-maharashtra':'पश्चिम महाराष्ट्र','konkan':'कोकण','dushkal':'दुष्काळ विशेष',
   'sheti':'शेती','shasan-yojana':'शासन योजना','pashusanvardhan':'पशुसंवर्धन',
   'pani':'पाणी','rojgar':'रोजगार','gramvikas':'ग्रामविकास',
   'rajkaran':'राजकारण','shikshan':'शिक्षण','arogya':'आरोग्य'
  };
  const category=catMap[m[1]];if(!category)return;
  const grid=document.querySelector('.page-section .news-grid')||document.querySelector('.news-grid');
  if(grid){const matched=items.filter(p=>category==='दुष्काळ विशेष'||p.category===category).slice(0,24);
   matched.reverse().forEach(p=>grid.prepend(card(p)));
  }
 }
 window[cb]=(data)=>{
  try{
   const items=Array.isArray(data?.posts)?data.posts:[];
   if(home&&items.length){
    const section=document.getElementById('sheet-news-section');if(section)section.hidden=false;
    home.replaceChildren(...items.slice(0,8).map(card));
   }
   if(latest&&items.length)latest.replaceChildren(...items.slice(0,24).map(card));
   if(article){
    const qs=new URLSearchParams(location.search),slug=qs.get('slug'),id=qs.get('id');
    renderArticle(items.find(p=>(slug&&p.slug===slug)||(id&&p.id===id)));
   }
   updateCategory(items);
   if(data?.layout){
    updateMenu(data.layout);
    updateBreaking(data.layout,items);
    updateSlider(data.layout,items);
    // Existing articles remain on GitHub Pages: include their metadata when
    // a saved slider selection points to one of those earlier news stories.
    if(Array.isArray(data.layout.slider)&&data.layout.slider.length){
     fetch(base+'posts-index.json',{cache:'force-cache'})
      .then(r=>r.ok?r.json():[])
      .then(oldPosts=>{if(Array.isArray(oldPosts))updateSlider(data.layout,[...items,...oldPosts])})
      .catch(()=>{});
    }
   }
   if(data?.site)updateSite(data.site);
  }catch(err){console.warn('Lokhit news feed display error',err)}
  finally{try{delete window[cb]}catch(e){}ref.remove()}
 };
 ref.onerror=()=>{
  if(article)article.textContent='सध्या बातमी लोड होत नाही. नंतर पुन्हा प्रयत्न करा.';
  try{delete window[cb]}catch(e){}ref.remove();
 };
 ref.src=scriptUrl+'?feed=1&callback='+cb+'&v='+Date.now();
 document.head.append(ref);
})();