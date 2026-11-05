(function(){
 const qs=(s)=>document.querySelector(s);const date=document.querySelector('#today-date');if(date)date.textContent=new Date().toLocaleDateString('mr-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
 const nav=qs('#nav-toggle'); if(nav){nav.addEventListener('click',()=>{const el=qs('#nav-links'); const open=el.classList.toggle('open');nav.setAttribute('aria-expanded',String(open));});}

 // Only load the homepage's muted live TV when viewers can see most of it.
 const tvFrames=[...document.querySelectorAll('iframe[data-lokhit-auto-src]')];
 if(tvFrames.length){
  const startTV=(frame)=>{
   const source=frame.getAttribute('data-lokhit-auto-src');
   if(!source)return;
   frame.removeAttribute('data-lokhit-auto-src');
   frame.src=source;
  };
  if('IntersectionObserver' in window){
   const observer=new IntersectionObserver((entries)=>{
    for(const entry of entries){
     if(entry.isIntersecting&&entry.intersectionRatio>=0.51){
      startTV(entry.target);
      observer.unobserve(entry.target);
     }
    }
   },{threshold:[0,0.51,1]});
   tvFrames.forEach((frame)=>observer.observe(frame));
  }else{
   const check=()=>{
    for(const frame of tvFrames){
     if(!frame.hasAttribute('data-lokhit-auto-src'))continue;
     const rect=frame.getBoundingClientRect();
     if(rect.height<=0||rect.width<=0)continue;
     const shown=Math.max(0,Math.min(rect.bottom,window.innerHeight)-Math.max(rect.top,0));
     if(shown/rect.height>=0.51)startTV(frame);
    }
   };
   window.addEventListener('scroll',check,{passive:true});
   window.addEventListener('resize',check);
   check();
  }
 }

 const tickerToggle=document.querySelector('.ticker-toggle');
 if(tickerToggle){
  tickerToggle.addEventListener('click',()=>{
   const strip=tickerToggle.closest('.live-ticker');
   const paused=strip.classList.toggle('ticker-paused');
   tickerToggle.textContent=paused?'▶':'Ⅱ';
   tickerToggle.setAttribute('aria-pressed',String(paused));
   tickerToggle.setAttribute('aria-label',paused?'ब्रेकिंग न्यूज पट्टी पुन्हा सुरू करा':'ब्रेकिंग न्यूज पट्टी थांबवा');
   tickerToggle.title=paused?'Play':'Pause';
  });
 }
 const hero=document.getElementById('hero-slider');
 if(hero){
  let slides=Array.from(hero.querySelectorAll('.hero-slide')),dots=Array.from(hero.querySelectorAll('[data-slide-to]'));let active=0,clock=null,startX=null;
  let delay=Math.max(3000,Math.min(15000,Number(hero.dataset.interval)||6000));
  const show=(i)=>{
   if(!slides.length)return;
   active=(i+slides.length)%slides.length;
   slides.forEach((slide,n)=>{const on=n===active;slide.classList.toggle('is-active',on);slide.setAttribute('aria-hidden',String(!on));slide.tabIndex=on?0:-1});
   dots.forEach((dot,n)=>{const on=n===active;dot.classList.toggle('is-active',on);dot.setAttribute('aria-current',String(on))});
  };
  const stop=()=>{if(clock!==null){clearInterval(clock);clock=null}};
  const start=()=>{stop();if(slides.length>1&&!document.hidden&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){clock=setInterval(()=>show(active+1),delay)}};
  hero.addEventListener('click',event=>{
   const target=event.target.closest('button');
   if(!target)return;
   if(target.classList.contains('hero-prev'))show(active-1);
   else if(target.classList.contains('hero-next'))show(active+1);
   else if(target.hasAttribute('data-slide-to'))show(Number(target.dataset.slideTo));
   else return;
   start();
  });
  document.addEventListener('lokhit:hero-updated',()=>{
   stop();
   slides=Array.from(hero.querySelectorAll('.hero-slide'));
   dots=Array.from(hero.querySelectorAll('[data-slide-to]'));
   delay=Math.max(3000,Math.min(15000,Number(hero.dataset.interval)||6000));
   show(0);start();
  });
  hero.addEventListener('mouseenter',stop);hero.addEventListener('mouseleave',start);
  hero.addEventListener('focusin',stop);hero.addEventListener('focusout',e=>{if(!hero.contains(e.relatedTarget))start()});
  hero.addEventListener('touchstart',e=>{startX=e.touches[0]?.clientX??null},{passive:true});
  hero.addEventListener('touchend',e=>{if(startX===null)return;let d=(e.changedTouches[0]?.clientX??startX)-startX;if(Math.abs(d)>55){show(active+(d<0?1:-1));start()}startX=null},{passive:true});
  document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
  show(0);start();
 }
 function notify(msg){let el=qs('#toast');if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.appendChild(el)}el.textContent=msg;el.classList.add('visible');setTimeout(()=>el.classList.remove('visible'),2500)}
 async function copyShareUrl(url){
  try{
   if(navigator.clipboard&&window.isSecureContext){
    await navigator.clipboard.writeText(url);return true;
   }
  }catch(e){}
  // Clipboard permission may be denied on mobile or embedded browsers.
  const field=document.createElement('textarea');
  field.value=url;field.setAttribute('readonly','');
  field.style.cssText='position:fixed;left:-9999px;top:0';
  document.body.appendChild(field);field.select();
  let copied=false;
  try{copied=document.execCommand('copy')}catch(e){}
  field.remove();
  if(!copied)window.prompt('बातमीची लिंक कॉपी करा:',url);
  return copied;
 }
 // Delegation works for articles created after page load, too.
 document.addEventListener('click',async(event)=>{
  const btn=event.target.closest('[data-share]');
  if(!btn)return;
  const link=location.href,title=document.title.replace(' | लोकहित महाराष्ट्र','');
  const t=btn.dataset.share;
  if(t==='native'){
   if(navigator.share){
    try{await navigator.share({title,url:link,text:title})}
    catch(e){if(e?.name!=='AbortError')notify('शेअर करता आले नाही. लिंक कॉपी वापरा.')}
   }else{const done=await copyShareUrl(link);if(done)notify('बातमीची लिंक कॉपी झाली')}
   return;
  }
  if(t==='copy'){
   const done=await copyShareUrl(link);
   if(done)notify('बातमीची लिंक कॉपी झाली');
   return;
  }
  const links={
   wa:'https://api.whatsapp.com/send?text='+encodeURIComponent(title+'\n'+link),
   fb:'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(link),
   x:'https://twitter.com/intent/tweet?text='+encodeURIComponent(title)+'&url='+encodeURIComponent(link),
   tg:'https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(title)
  };
  if(links[t]){
   // Open synchronously from the click; otherwise popup blockers may suppress it.
   const popup=window.open(links[t],'_blank','noopener,noreferrer');
   if(!popup && !/Mobi|Android/i.test(navigator.userAgent||''))notify('नवीन टॅब ब्लॉक झाला असल्यास Pop-up परवानगी द्या.');
  }
 });
 const search=qs('#search-input'), results=qs('#search-results'), form=qs('#search-form');
 if(search&&results){
  const root=document.body.dataset.base||'/';
  let staticPosts=[],livePosts=[],deleted=new Set();
  const deletedKey='lokhit-deleted-slugs-v1';
  const localDeleted=()=>{
   try{
    const v=JSON.parse(localStorage.getItem(deletedKey)||'{}');
    for(const [slug,time] of Object.entries(v))
     if(Date.now()-Number(time)<30*86400000)deleted.add(slug);
   }catch(e){}
  };
  localDeleted();
  function render(){
   const q=search.value.trim().toLocaleLowerCase('mr');
   const bySlug=new Map();
   for(const p of staticPosts)if(p?.slug)bySlug.set(p.slug,p);
   for(const p of livePosts)if(p?.slug)bySlug.set(p.slug,p);
   const list=Array.from(bySlug.values()).filter(p=>!deleted.has(p.slug)&&(p.title+' '+p.description+' '+p.category).toLocaleLowerCase('mr').includes(q));
   results.replaceChildren();
   if(!list.length){const empty=document.createElement('div');empty.className='empty-state';empty.textContent='या शोधासाठी बातम्या आढळल्या नाहीत.';results.append(empty);return}
   for(const p of list){
    const a=document.createElement('a');a.className='news-card';
    a.href=root+'batmi/'+encodeURIComponent(p.slug)+'/';
    const image=document.createElement('img');image.loading='lazy';image.alt='';
    image.src=/^https:\/\//.test(p.image||'')?p.image:root+String(p.image||'assets/img/logo.webp');
    const box=document.createElement('div');box.className='card-body';
    const tag=document.createElement('span');tag.className='category-kicker';tag.textContent=p.category||'';
    const title=document.createElement('h3');title.textContent=p.title||'';
    const desc=document.createElement('p');desc.textContent=p.description||'';
    box.append(tag,title,desc);a.append(image,box);results.append(a);
   }
  }
  fetch(root+'posts-index.json').then(r=>r.json()).then(posts=>{
   staticPosts=Array.isArray(posts)?posts.map(p=>({...p,origin:'github'})):[];
   render();
  }).catch(()=>{results.textContent='सध्या शोध उपलब्ध नाही.'});
  document.addEventListener('lokhit:feed-updated',event=>{
   const d=event.detail||{};
   livePosts=Array.isArray(d.posts)?d.posts:[];
   for(const slug of d.deletedSlugs||[])deleted.add(slug);
   render();
  });
  window.addEventListener('storage',event=>{if(event.key===deletedKey){localDeleted();render()}});
  search.value=new URLSearchParams(location.search).get('q')||'';
  search.addEventListener('input',render);
  if(form)form.addEventListener('submit',e=>{e.preventDefault();history.replaceState({},'',location.pathname+'?q='+encodeURIComponent(search.value));render()});
 }
 function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
})();


/* LOKHIT BLOGGER CMS BRIDGE — v1.0 (blogspot only, no theme upload required) */
(function(){
  'use strict';
  // GitHub Pages continues to run its own original UI. This bridge is Blogger-only.
  if (location.hostname !== 'lokhitmaharashtraserver.blogspot.com') return;
  const base = location.origin;
  const label = name => '/search/label/' + encodeURIComponent(name);
  // Edits to this list can be deployed through GitHub without replacing Blogger's theme.
  const groups = {
    LkMenuSettings: [
      ['मुख्यपृष्ठ','/'], ['ताज्या बातम्या','/search'],
      ['महाराष्ट्र',label('महाराष्ट्र')], ['मराठवाडा',label('मराठवाडा')],
      ['विदर्भ',label('विदर्भ')], ['दुष्काळ विशेष',label('दुष्काळ विशेष')],
      ['शेती',label('शेती')], ['शासन योजना',label('शासन योजना')],
      ['पशुसंवर्धन',label('पशुसंवर्धन')], ['राजकारण',label('राजकारण')],
      ['व्हिडिओ','/p/video-news.html'], ['🔴 Live TV','/p/live-tv.html'],
      ['विश्लेषण',label('विश्लेषण')]
    ],
    LkTickerSettings: [
      ['शरद पवार शेतकऱ्यांच्या बांधावर; 50 लाखांची मदत','/2026/11/50.html'],
      ['सुनील तटकरे यांची राजकीय प्रतिक्रिया','/2026/11/Suniltatkarenews.html'],
      ['महाराष्ट्रातील दुष्काळ विशेष बातम्या',label('दुष्काळ विशेष')]
    ],
    LkSliderSettings: [
      ['सुनील तटकरे','/2026/11/Suniltatkarenews.html'],
      ['शरद पवार','/2026/11/50.html'],
      ['दुष्काळाचे बदलते चित्र','/2026/10/_36.html'],
      ['ठिबक सिंचन','/2026/10/_9.html']
    ],
    LkFeaturedCards: [
      ['शेतकरी मदत','/2026/10/_2.html'],
      ['पीकनुकसान पंचनामा','/2026/10/_05.html'],
      ['मुरघास','/2026/10/_41.html']
    ],
    LkHomepageSettings: [
      ['ताज्या बातम्या | 12','/search'],
      ['दुष्काळ विशेष | 4',label('दुष्काळ विशेष')],
      ['दुष्काळ मदत बॅनर','#lk-drought-banner'],
      ['🔴 Live TV','#lk-live-tv'],
      ['महाराष्ट्र | 4',label('महाराष्ट्र')],
      ['शेती | 4',label('शेती')],
      ['शासन योजना | 4',label('शासन योजना')],
      ['पशुसंवर्धन | 4',label('पशुसंवर्धन')],
      ['अधिक बातम्या | 6','/search']
    ],
    LkFooterLinks: [
      ['About Us','/p/about-us.html'], ['Contact Us','/p/contact-us.html'],
      ['Privacy Policy','/p/privacy-policy.html'],
      ['Terms','/p/terms-and-conditions.html'],
      ['Disclaimer','/p/disclaimer.html'],
      ['Grievance','/p/grievance-redressal.html']
    ]
  };
  // The existing Blogger theme already has the renderer for these Link List
  // configurations. Feed-driven cards continue to come from Blogger posts.
  function insertSettings(id, rows) {
    let section = document.getElementById(id);
    // A genuine Blogger widget always takes priority over our fallback.
    if (section && section.querySelector('.widget a[href], .widget-content a[href]')) return false;
    if (!section) {
      section = document.createElement('div');
      section.id = id;
      section.hidden = true;
      document.body.appendChild(section);
    }
    const widget = document.createElement('div');
    widget.className = 'widget LinkList lk-github-fallback';
    widget.hidden = true;
    const content = document.createElement('div');
    content.className = 'widget-content';
    const ul = document.createElement('ul');
    rows.forEach(([title, href]) => {
      if (!title || !href) return;
      let url;
      try { url = new URL(href, base); } catch { return; }
      if (url.origin !== base) return;
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = url.href;
      a.textContent = title;
      li.appendChild(a);
      ul.appendChild(li);
    });
    content.appendChild(ul);
    widget.appendChild(content);
    section.appendChild(widget);
    return true;
  }
  function install() {
    if (!document.getElementById('nav-links')) return;
    let count = 0;
    for (const id in groups) if (insertSettings(id, groups[id])) count++;
    document.documentElement.setAttribute('data-lokhit-cms-bridge', 'v1');
    document.documentElement.setAttribute('data-lokhit-cms-groups', String(count));
  }
  // This file is defer-loaded; execute synchronously before DOMContentLoaded,
  // when the theme's own renderer reads the settings sections.
  if (document.getElementById('nav-links')) install();
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
})();
