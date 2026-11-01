(function(){
 const qs=(s)=>document.querySelector(s);const date=document.querySelector('#today-date');if(date)date.textContent=new Date().toLocaleDateString('mr-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
 const nav=qs('#nav-toggle'); if(nav){nav.addEventListener('click',()=>{const el=qs('#nav-links'); const open=el.classList.toggle('open');nav.setAttribute('aria-expanded',String(open));});}
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
 document.querySelectorAll('[data-share]').forEach(btn=>btn.addEventListener('click',async()=>{
  const link=location.href, title=document.title.replace(' | लोकहित महाराष्ट्र',''); const t=btn.dataset.share;
  if(t==='native'){if(navigator.share){try{await navigator.share({title,url:link,text:title})}catch(e){}}else{try{await navigator.clipboard.writeText(link);notify('बातमीची लिंक कॉपी झाली')}catch(e){notify('लिंक कॉपी करता आली नाही')}}return;}
  if(t==='copy'){try{await navigator.clipboard.writeText(link);notify('लिंक कॉपी झाली')}catch(e){notify('लिंक कॉपी करता आली नाही')}return;}
  const links={wa:'https://api.whatsapp.com/send?text='+encodeURIComponent(title+'\n'+link),fb:'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(link),x:'https://twitter.com/intent/tweet?text='+encodeURIComponent(title)+'&url='+encodeURIComponent(link),tg:'https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(title)};
  if(links[t])window.open(links[t],'_blank','noopener,noreferrer,width=850,height=680');
 }));
 const search=qs('#search-input'), results=qs('#search-results'), form=qs('#search-form');
 if(search&&results){
  const root=document.body.dataset.base||'/';
  fetch(root+'posts-index.json').then(r=>r.json()).then(posts=>{
   const render=()=>{const q=search.value.trim().toLocaleLowerCase('mr');const list=posts.filter(p=>(p.title+' '+p.description+' '+p.category).toLocaleLowerCase('mr').includes(q));results.innerHTML=list.length?list.map(p=>`<a class="news-card" href="${root}batmi/${encodeURIComponent(p.slug)}/"><img loading="lazy" src="${root}${p.image}" alt=""><div class="card-body"><span class="category-kicker">${esc(p.category)}</span><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p></div></a>`).join(''):'<div class="empty-state">या शोधासाठी बातम्या आढळल्या नाहीत.</div>'};
   search.value=new URLSearchParams(location.search).get('q')||'';search.addEventListener('input',render);render();if(form)form.addEventListener('submit',e=>{e.preventDefault();history.replaceState({},'',location.pathname+'?q='+encodeURIComponent(search.value));render()});
  }).catch(()=>{results.innerHTML='<div class="empty-state">सध्या शोध उपलब्ध नाही.</div>'});
 }
 function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
})();
