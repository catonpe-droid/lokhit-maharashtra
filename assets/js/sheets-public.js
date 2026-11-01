/* लोकहित महाराष्ट्र — public Google Sheet news, read-only. */
(()=>{'use strict';
 const base=document.body.dataset.base||'/lokhit-maharashtra/';
 const home=document.getElementById('sheet-news-home');
 const latest=document.getElementById('sheet-news-latest');
 const article=document.getElementById('sheet-article-root');
 const scriptUrl=String(window.LOKHIT_SHEETS_WEBAPP_URL||'').trim();
 if(!home&&!latest&&!article)return;
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(scriptUrl)){
  if(article)article.textContent='या बातमीची Google Sheet जोडणी अद्याप सक्रिय नाही.';
  return;
 }
 const ref=document.createElement('script');
 const cb='lokhitSheetsCallback';
 function make(tag,cl,txt){
  const el=document.createElement(tag);
  if(cl)el.className=cl;
  if(txt!==undefined)el.textContent=String(txt??'');
  return el;
 }
 const source=r=>base+'batmi/sheet/?id='+encodeURIComponent(String(r.id||''));
 function card(r){
  const a=make('a','news-card');a.href=source(r);
  const im=make('img');im.loading='lazy';im.width=480;im.height=270;
  im.src=/^https:\/\//.test(r.image||'')?r.image:base+'assets/img/logo.webp';
  im.alt=String(r.title||'बातमी');im.onerror=()=>{im.onerror=null;im.src=base+'assets/img/logo.webp';};
  const b=make('div','card-body');
  b.append(make('span','category-kicker',r.category),make('h3','',r.title),make('p','',r.description));
  b.append(make('div','meta','✍ '+String(r.author||'लोकहित महाराष्ट्र')));
  a.append(im,b);return a;
 }
 function renderArticle(r){
  article.replaceChildren();
  if(!r){article.append(make('h1','','बातमी सापडली नाही'));return;}
  const summary=make('p','article-summary',r.description);
  article.append(make('span','tag',r.category),make('h1','',r.title),summary,
   make('div','meta','✍ '+String(r.author||'लोकहित महाराष्ट्र')+' · '+String(r.date||'').slice(0,10)));
  if(/^https:\/\//.test(r.image||'')){
   const figure=make('figure','article-figure'),image=make('img');
   image.src=r.image;image.alt=r.title;image.onerror=()=>figure.remove();figure.append(image);article.append(figure);
  }
  const section=make('div','article-body');
  for(const part of String(r.body||'').split(/\n\s*\n/).filter(Boolean)){
   section.append(make('p','',part));
  }
  article.append(section);
  const link=make('a','', '← सर्व बातम्या');link.href=base+'tajya-batmya/';article.append(link);
  document.title=String(r.title||'बातमी')+' | लोकहित महाराष्ट्र';
 }
 window[cb]=(data)=>{
  try{
   const items=Array.isArray(data?.posts)?data.posts:[];
   if(home&&items.length){
    const sec=document.getElementById('sheet-news-section');sec.hidden=false;
    home.replaceChildren(...items.slice(0,8).map(card));
   }
   if(latest&&items.length)latest.replaceChildren(...items.slice(0,24).map(card));
   if(article){
    const id=new URLSearchParams(location.search).get('id');
    renderArticle(items.find(x=>x.id===id));
   }
  }finally{try{delete window[cb]}catch(e){}ref.remove();}
 };
 ref.onerror=()=>{
  if(article)article.textContent='सध्या बातमी लोड होत नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.';
  try{delete window[cb]}catch(e){}
  ref.remove();
 };
 ref.src=scriptUrl+'?feed=1&callback='+cb+'&v='+Date.now();
 document.head.append(ref);
})();
