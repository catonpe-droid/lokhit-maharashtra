(function(){
 const qs=(s)=>document.querySelector(s);const date=document.querySelector('#today-date');if(date)date.textContent=new Date().toLocaleDateString('mr-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
 const nav=qs('#nav-toggle'); if(nav){nav.addEventListener('click',()=>{const el=qs('#nav-links'); const open=el.classList.toggle('open');nav.setAttribute('aria-expanded',String(open));});}
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
