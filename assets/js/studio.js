'use strict';
(() => {
 const $ = id => document.getElementById(id);
 const BASE='https://catonpe-droid.github.io/lokhit-maharashtra/';
 const LOCAL='lokhit-studio-local-draft-v2';
 const notice=(text,error=false)=>{ $('notice').textContent=text; $('notice').style.color=error?'#b00020':'#254a60'; };
 if (!window.Quill || !window.DOMPurify) {
   notice('Rich Editor लोड झाला नाही. इंटरनेट जोडणी तपासून पान Refresh करा.',true);
   return;
 }
 const quill=new Quill('#rich-editor',{theme:'snow',placeholder:'येथे बातमी लिहा. Bold, Heading, फोटो किंवा व्हिडिओ टाकण्यासाठी वरील Toolbar वापरा…',modules:{toolbar:'#toolbar'},formats:['header','bold','italic','underline','strike','list','blockquote','link','image','video']});
 let current=null,posts=[],apiUrl='',busy=false,coverUrl='',activeFilter='all',ready=false;
 let lastRange=null;
 const clone=v=>JSON.parse(JSON.stringify(v));
 const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const makeUrl=slug=>BASE+'batmi/'+encodeURIComponent(slug)+'/';
 const cleanYouTube = raw => {
  try{
   const u=new URL(raw);
   let id='';
   if (u.hostname==='youtu.be') id=u.pathname.slice(1).split('/')[0];
   else if (['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(u.hostname)){
    if(u.pathname==='/watch') id=u.searchParams.get('v')||'';
    else id=u.pathname.match(/^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})(?:\/|$)/)?.[1]||'';
   }
   return /^[A-Za-z0-9_-]{11}$/.test(id)?'https://www.youtube-nocookie.com/embed/'+id:'';
  }catch{return '';}
 };
 const ownAsset = raw => {
  try {
   const u=new URL(raw,BASE);
   if(u.origin===new URL(BASE).origin && u.pathname.startsWith('/lokhit-maharashtra/assets/img/')) return u.pathname.replace('/lokhit-maharashtra/','');
  }catch{}
  return '';
 };
 const toAbsoluteDelta=ops=>(Array.isArray(ops)?ops:[]).map(o=>{
   const next=clone(o);
   if(next.insert?.image && !next.insert.image.startsWith('data:') && ownAsset(next.insert.image)) next.insert.image=BASE+ownAsset(next.insert.image);
   return next;
 });
 const range=()=>quill.getSelection(true)?.index ?? quill.getLength()-1;
 quill.on('selection-change',r=>{if(r)lastRange=r;});
 async function imageToJpegBase64(source,max=430000){
  const blob=source instanceof Blob?source:await fetch(source).then(r=>r.blob());
  if(!blob.type.startsWith('image/'))throw Error('फक्त फोटो निवडा.');
  if(blob.size>12*1024*1024)throw Error('फोटो 12 MB पेक्षा लहान असावा.');
  const bitmap=await createImageBitmap(blob);
  try{
   let w=Math.min(1500,bitmap.width),h=Math.max(1,Math.round(bitmap.height*w/bitmap.width));
   let quality=.83;
   for(let k=0;k<13;k++){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bitmap,0,0,w,h);
    const data=canvas.toDataURL('image/jpeg',quality).split(',')[1];
    if(data.length*3/4<=max)return data;
    w=Math.max(240,Math.round(w*.84));h=Math.max(150,Math.round(h*.84));quality=Math.max(.58,quality-.025);
   }
   throw Error('फोटोचा आकार कमी करता आला नाही.');
  } finally {bitmap.close();}
 }
 $('insert-photo').addEventListener('click',()=>{lastRange=quill.getSelection(true);$('inline-photo-input').click();});
 $('inline-photo-input').addEventListener('change',async e=>{
  const files=[...e.target.files];e.target.value='';
  const count=quill.getContents().ops.filter(o=>o.insert?.image).length;
  if(count+files.length>8){notice('बातमीमध्ये जास्तीत जास्त ८ फोटो घालू शकता.',true);return;}
  for(const file of files){
   try{
    const data=await imageToJpegBase64(file);
    const pos=lastRange?.index ?? range();
    quill.insertEmbed(pos,'image','data:image/jpeg;base64,'+data,'user');
    quill.insertText(pos+1,'\n','user');lastRange={index:pos+2,length:0};
    notice('✅ फोटो मजकुरात जोडला आहे. प्रकाशनावेळी GitHub वर जाईल.');
   }catch(err){notice('फोटो जोडता आला नाही: '+err.message,true);}
  }
 });
 $('insert-video').addEventListener('click',()=>{
  const url=prompt('YouTube व्हिडिओ लिंक टाका (youtube.com / youtu.be)');
  if(url===null)return;
  const clean=cleanYouTube(url);
  if(!clean){notice('योग्य YouTube लिंक द्या.',true);return;}
  const pos=range();quill.insertEmbed(pos,'video',clean,'user');quill.insertText(pos+1,'\n','user');quill.setSelection(pos+2,0);
  notice('✅ व्हिडिओ बातमीच्या मजकुरात जोडला आहे.');
 });
 const summarize=p=>({slug:p.slug,title:p.title,description:p.description,category:p.category,body:p.body,rich_delta:p.rich_delta,video:p.video,author:p.author,featured:p.featured,status:p.status,image:p.image,tags:p.tags});
 function renderPosts(){
   const query=$('filter-posts').value.trim().toLowerCase();
   const list=posts.filter(p=>(activeFilter==='all'||(p.status||'published')===activeFilter) && (!query||((p.title||'')+' '+(p.category||'')).toLowerCase().includes(query)));
   const holder=$('post-list');holder.replaceChildren();
   if(!list.length){const p=document.createElement('p');p.className='muted';p.textContent='या प्रकारात बातम्या नाहीत.';holder.append(p);return;}
   for(const p of list){
    const b=document.createElement('button');b.type='button';b.className='post-item'+(current?.slug===p.slug?' selected':'');
    const strong=document.createElement('strong');strong.textContent=p.title;
    const small=document.createElement('small');small.textContent=(p.category||'महाराष्ट्र')+' · '+(p.status||'published')+' · '+(p.slug||'');
    b.append(strong,small);b.onclick=()=>openPost(p);holder.append(b);
   }
 }
 function setCover(url){ if(coverUrl?.startsWith('blob:'))URL.revokeObjectURL(coverUrl);coverUrl=url||'';const target=$('cover-preview');if(coverUrl){target.src=coverUrl;target.hidden=false;}else{target.hidden=true;target.removeAttribute('src');}}
 function clearForm(){
  current=null;$('studio-form').reset();$('author').value='लोकहित महाराष्ट्र डिजिटल डेस्क';
  $('status').value='published';$('category').value='महाराष्ट्र';$('photo').value='';setCover('');
  quill.setText('');$('editor-title').textContent='नवीन बातमी';$('edit-label').textContent='नवीन लेख';$('delete').hidden=true;$('live-box').hidden=true;
  notice('नवीन बातमी तयार आहे.');renderPosts();
 }
 function openPost(p){
  current=summarize(p);$('headline').value=p.title||'';$('summary').value=p.description||'';
  $('category').value=p.category||'महाराष्ट्र';$('status').value=p.status||'published';
  $('author').value=p.author||'लोकहित महाराष्ट्र डिजिटल डेस्क';
  $('tags').value=Array.isArray(p.tags)?p.tags.join(', '):'';
  $('video').value=p.video||'';$('featured').checked=!!p.featured;
  $('photo').value='';setCover(p.image?new URL(p.image,BASE).href:'');
  if(Array.isArray(p.rich_delta) && p.rich_delta.length)quill.setContents(toAbsoluteDelta(p.rich_delta),'silent');
  else quill.setText(p.body||'','silent');
  $('editor-title').textContent='बातमी संपादित करा';$('edit-label').textContent=p.slug;
  $('delete').hidden=false;$('live-box').hidden=true;renderPosts();notice('बातमी उघडली आहे. बदल करून Save करा.');scrollTo({top:0,behavior:'smooth'});
 }
 $('new-post').addEventListener('click',clearForm);$('filter-posts').addEventListener('input',renderPosts);
 document.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{activeFilter=btn.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===btn));renderPosts();}));
 $('photo').addEventListener('change',e=>{const f=e.target.files?.[0];setCover(f?URL.createObjectURL(f):(current?.image?new URL(current.image,BASE).href:''));});
 function preview(){
  const title=$('headline').value.trim()||'बातमीचा मथळा';
  const safe=DOMPurify.sanitize(quill.root.innerHTML,{ALLOWED_URI_REGEXP:/^(?:(?:https?:|data:image\/(?:jpeg|png|webp);base64,)|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i});
  const modal=$('preview-modal');
  const media=coverUrl?'<img alt="" src="'+escapeHTML(coverUrl)+'">':'';
  $('article-preview').innerHTML='<small>'+escapeHTML($('category').value)+'</small><h1>'+escapeHTML(title)+'</h1><p class="summary">'+escapeHTML($('summary').value)+'</p>'+media+'<div class="body-preview">'+safe+'</div>';
  modal.showModal();
 }
 $('preview').onclick=preview;$('close-preview').onclick=()=>$('preview-modal').close();
 function localDraft(){
   try{
    const delta=quill.getContents().ops.filter(op=>!op.insert?.image||!String(op.insert.image).startsWith('data:'));
    localStorage.setItem(LOCAL,JSON.stringify({title:$('headline').value,summary:$('summary').value,category:$('category').value,body:delta,author:$('author').value,video:$('video').value,tags:$('tags').value,featured:$('featured').checked,saved:new Date().toISOString()}));
    notice('✅ मसुद्याचा मजकूर या ब्राउझरमध्ये जतन केला. नवीन अपलोड न केलेले फोटो स्वतंत्रपणे सुरक्षित ठेवा.');
   }catch(err){notice('Local Draft जतन झाला नाही: '+err.message,true);}
 }
 $('save-local').onclick=localDraft;
 async function loadPosts(){
  try{
   let list=[];
   if(apiUrl){
    const response=await fetch(apiUrl+'/studio/posts',{cache:'no-store'});
    if(!response.ok)throw Error('Server '+response.status);
    list=await response.json();
   }else{
    const response=await fetch('../../cms-export.json',{cache:'no-store'});
    if(response.ok)list=await response.json();
   }
   posts=Array.isArray(list)?list:[];posts.sort((a,b)=>String(b.updated||b.date||'').localeCompare(String(a.updated||a.date||'')));
   renderPosts();ready=true;
  }catch(err){notice('बातम्यांची यादी लोड झाली नाही: '+err.message,true);}
 }
 async function init(){
  try{
    const config=await fetch('../test/config.json',{cache:'no-store'}).then(r=>r.json());
    const raw=String(config.publish_api_url||'').trim();
    if(raw){const u=new URL(raw);if(u.protocol!=='https:'&&u.hostname!=='localhost')throw Error('HTTPS API आवश्यक');apiUrl=raw.replace(/\/+$/,'');}
    if(apiUrl){
      const r=await fetch(apiUrl+'/health',{cache:'no-store'});if(!r.ok)throw Error('Server '+r.status);
      const d=await r.json();
      $('server-status').textContent=d.publishingConfigured?'✅ ANIK Publishing Server सज्ज (प्रवेश नेटवर्क मर्यादित)':'⚠️ ANIK Server settings अपूर्ण';
    }else $('server-status').textContent='⚠️ ANIK Server URL अजून जोडायचा आहे — Preview चालू';
  }catch(err){$('server-status').textContent='⚠️ Server संपर्कात नाही: '+err.message;}
  await loadPosts();
  try{const old=JSON.parse(localStorage.getItem(LOCAL)||'null');if(old && !current){$('headline').value=old.title||'';$('summary').value=old.summary||'';$('category').value=old.category||'महाराष्ट्र';$('author').value=old.author||'लोकहित महाराष्ट्र डिजिटल डेस्क';$('tags').value=old.tags||'';$('video').value=old.video||'';$('featured').checked=!!old.featured;if(Array.isArray(old.body))quill.setContents(old.body);notice('पूर्वीचा Local Draft उघडला आहे.');}}catch{}
 }
 async function waitLive(post,slug){
   const url=makeUrl(slug);let verified=false;
   for(let i=0;i<28;i++){
    try{
     const res=await fetch(url+'?cms-check='+Date.now(),{cache:'no-store'});
     if(res.ok){
      const doc=new DOMParser().parseFromString(await res.text(),'text/html');
      const title=doc.querySelector('meta[property="og:title"]')?.content||'';
      const og=doc.querySelector('meta[property="og:image"]')?.content||'';
      if(title===post.title && og && doc.querySelector('link[rel="canonical"]')?.href===url){
       const pic=new URL(og,url);
       if(pic.origin===location.origin){const head=await fetch(pic.href,{method:'HEAD',cache:'no-store'});if(!head.ok)throw Error('Photo pending');}
       verified=true;break;
      }
     }
    }catch{}
    notice('⏳ बातमी GitHub वर Save झाली. स्वतंत्र HTML आणि WhatsApp Thumbnail तयार होत आहेत… ('+(i+1)+'/28)');
    await new Promise(resolve=>setTimeout(resolve,4000));
   }
   if(verified){$('live-url').textContent=url;$('live-url').href=url;$('live-box').hidden=false;notice('✅ बातमी Live झाली. WhatsApp फोटो तपासून आता लिंक शेअर करा.');}
   else notice('⚠️ GitHub Save पूर्ण; HTML deployment अजून पडताळला नाही. Actions पूर्ण झाल्यावर लिंक तपासा: '+url,true);
 }
 async function savePost(overrideStatus=null){
  if(busy)return;
  if(!$('studio-form').reportValidity())return;
  const body=quill.getText().trim();
  if(body.length<20 && !quill.getContents().ops.some(x=>x.insert?.video)) {notice('पूर्ण बातमीमध्ये किमान २० अक्षरांचा मजकूर असावा.',true);return;}
  if(!apiUrl){notice('⚠️ ANIK Publishing API अजून जोडलेली नाही. Local Draft व Preview चालू आहेत; प्रत्यक्ष Publish साठी Server Setup पूर्ण करावे लागेल.',true);return;}
  const video=$('video').value.trim();if(video && !cleanYouTube(video)){notice('योग्य YouTube लिंक द्या.',true);return;}
  busy=true;['publish','save-publish','save-draft','delete'].forEach(id=>$(id).disabled=true);
  try{
   const inlineImages=[];let ops=clone(quill.getContents().ops);
   let imageCount=0;
   for(const op of ops){
    if(op.insert && typeof op.insert==='object' && op.insert.image){
     imageCount++;
     let src=String(op.insert.image);
     if(src.startsWith('data:image/')){
       const data=await imageToJpegBase64(src);
       const idx=inlineImages.push(data)-1;
       op.insert.image='upload:'+idx;
     }else{
       const saved=ownAsset(src);
       if(!saved)throw Error('बाहेरील फोटो देऊ नका; कृपया फोटो अपलोड करा.');
       op.insert.image=saved;
     }
    }
    if(op.insert && typeof op.insert==='object' && op.insert.video){
      const video=cleanYouTube(String(op.insert.video));if(!video)throw Error('YouTube embed लिंक तपासा.');
      op.insert.video=video;
    }
   }
   if(imageCount>8)throw Error('८ पेक्षा जास्त फोटो देता येत नाहीत.');
   const coverBase64=$('photo').files?.[0]?await imageToJpegBase64($('photo').files[0],850000):null;
   const data={slug:current?.slug||null,title:$('headline').value.trim(),description:$('summary').value.trim(),category:$('category').value,
    author:$('author').value.trim(),body,richDelta:ops,inlineImages,coverBase64,coverPath:current?.image||null,
    status:overrideStatus||$('status').value,featured:$('featured').checked,video,tags:$('tags').value.split(',').map(t=>t.trim()).filter(Boolean).slice(0,15)};
   notice('⏳ फोटो व बातमी GitHub वर जतन होत आहेत…');
   const res=await fetch(apiUrl+'/studio/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
   const result=await res.json().catch(()=>({}));
   if(!res.ok||!result.saved)throw Error(result.error||'Server HTTP '+res.status);
   localStorage.removeItem(LOCAL);$('photo').value='';
   await loadPosts();const fresh=posts.find(p=>p.slug===result.slug);if(fresh)openPost(fresh);
   if(data.status==='published'){await waitLive(data,result.slug);}
   else{notice('✅ बातमी Draft म्हणून GitHub वर जतन झाली; सार्वजनिक वेबसाइटवर दिसणार नाही.');$('live-box').hidden=true;}
  }catch(err){notice('❌ जतन अयशस्वी: '+err.message,true);}
  finally{busy=false;['publish','save-publish','save-draft','delete'].forEach(id=>$(id).disabled=false);}
 }
 $('studio-form').onsubmit=e=>e.preventDefault();
 $('publish').onclick=()=>savePost();$('save-publish').onclick=()=>savePost('published');$('save-draft').onclick=()=>savePost('draft');
 $('delete').onclick=async()=>{
   if(!current||busy||!apiUrl)return;
   if(!confirm('ही बातमी कायमची Delete करायची का? यामुळे सार्वजनिक HTML सुद्धा पुढील build मध्ये काढले जाईल.'))return;
   busy=true;
   try{
    const r=await fetch(apiUrl+'/studio/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:current.slug})});
    const data=await r.json().catch(()=>({}));if(!r.ok||!data.deleted)throw Error(data.error||'Delete failed');
    await loadPosts();clearForm();notice('✅ बातमी GitHub मधून काढली. Pages deploy झाल्यावर सार्वजनिक पान हटेल.');
   }catch(err){notice('❌ Delete अयशस्वी: '+err.message,true);}finally{busy=false;}
 };
 $('copy-url').onclick=async()=>{await navigator.clipboard.writeText($('live-url').href);notice('✅ लिंक कॉपी झाली.');};
 init();
})();
