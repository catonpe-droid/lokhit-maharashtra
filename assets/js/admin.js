'use strict';
(() => {
 const $=(id)=>document.getElementById(id);let token='',repository='',branch='main',current=null,records=[],loggedIn=false,shareCheckId=0;
 const apiBase='https://api.github.com/repos/';
 const status=(message,error=false,target='editor-status')=>{const node=$(target);node.textContent=message;node.className=error?'status error':'status'};
 const escapeHTML=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
 async function github(path,method='GET',body=null){
  const r=await fetch(apiBase+repository+'/'+path,{method,headers:{'Accept':'application/vnd.github+json',...(token?{'Authorization':'Bearer '+token}:{}),'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!r.ok){const message=await r.json().catch(()=>({message:r.statusText}));throw Error('GitHub '+r.status+': '+(message.message||'अज्ञात त्रुटी'))}
  return r.status===204?{}:r.json();
 }
 function base64UTF8(text){let bytes=new TextEncoder().encode(text),str='';for(const b of bytes)str+=String.fromCharCode(b);return btoa(str)}
 function decodeUTF8(content){const bin=atob(content.replace(/\s/g,'')),bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes)}
 async function login(ev){
  ev.preventDefault();
  const id=$('username').value.trim(),key=$('password').value.trim(),button=$('login-form').querySelector('[type="submit"]');
  repository='catonpe-droid/lokhit-maharashtra';branch='main';loggedIn=false;
  if(!id||!key){status('Login ID आणि Password (Access Key) भरा.',true,'login-status');return}
  button.disabled=true;button.textContent='अधिकार तपासत आहे…';token=key;
  status('प्रकाशनासाठी अधिकृत प्रवेश तपासत आहे…',false,'login-status');
  try{
   const res=await fetch('https://api.github.com/user',{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token}});
   if(!res.ok)throw Error('Access Key चुकीचा आहे किंवा कालबाह्य झाला आहे. GitHub fine-grained Personal Access Token वापरा.');
   const user=await res.json();
   if(!user.login||user.login.toLowerCase()!==id.toLowerCase())throw Error('Login ID हा Access Key असलेल्या GitHub खात्याच्या username शी जुळत नाही.');
   const info=await github('');
   if(info.permissions&&info.permissions.push===false)throw Error('या खात्याला वेबसाइटमध्ये बदल करण्याची परवानगी नाही. Repository Contents → Read and write अधिकार तपासा.');
   branch=info.default_branch||'main';
   const files=await github('contents/content/posts?ref='+encodeURIComponent(branch));
   if(!Array.isArray(files))throw Error('बातम्यांचा डेटा उपलब्ध नाही.');
   loggedIn=true;$('password').value='';$('login').hidden=true;$('dashboard').hidden=false;
   $('publish').disabled=false;$('publish').removeAttribute('aria-disabled');
   $('publish').title='बातमी Server वर जतन करा';
   await loadPosts();
   status('✅ अधिकृत प्रवेश सुरू आहे. बातम्या प्रकाशित आणि संपादित करता येतील.');
   document.dispatchEvent(new Event('lokhitcms:ready'));
  }catch(err){token='';loggedIn=false;$('password').value='';status(err.message||'Login होऊ शकला नाही. Access Key आणि अधिकार तपासा.',true,'login-status')}
  finally{button.disabled=false;button.textContent='प्रवेश करा →'}
 }
 async function loadPosts(){
  $('post-list').textContent='बातम्या वाचत आहे…';
  try{
   const files=await github('contents/content/posts?ref='+encodeURIComponent(branch));
   if(!Array.isArray(files))throw Error('content/posts फोल्डर उपलब्ध नाही.');
   records=await Promise.all(files.filter(f=>f.name.endsWith('.json')).map(async f=>{
    try{const p=await github('contents/'+f.path+'?ref='+encodeURIComponent(branch));return {...JSON.parse(decodeUTF8(p.content)),_sha:p.sha,_path:f.path}}
    catch{return null}
   }));records=records.filter(Boolean).sort((a,b)=>(b.date||'').localeCompare(a.date||''));renderList();
  }catch(e){$('post-list').textContent='बातम्या लोड होत नाहीत: '+e.message}
 }
 function renderList(){const q=$('filter-posts').value.trim().toLowerCase(), list=records.filter(p=>(p.title+' '+p.category).toLowerCase().includes(q));
  $('post-list').innerHTML='';if(!list.length){$('post-list').textContent='बातम्या आढळल्या नाहीत.';return}
  for(const p of list){const b=document.createElement('button');b.type='button';b.className='admin-post'+(current?._path===p._path?' active':'');const strong=document.createElement('strong');strong.textContent=p.title;const small=document.createElement('small');small.textContent=p.category+' · '+(p.status==='draft'?'मसुदा':'प्रकाशित');b.append(strong,small);b.onclick=()=>openPost(p);$('post-list').appendChild(b)}
 }
 function newPost(){shareCheckId++;$('published-link').hidden=true;current=null;$('post-form').reset();$('author').value='लोकहित महाराष्ट्र डिजिटल डेस्क';$('category').value='दुष्काळ विशेष';$('post-status').value='published';$('editor-heading').textContent='नवीन बातमी';$('edit-state').textContent='नवीन';$('slug').disabled=false;$('delete').hidden=true;$('image-preview').innerHTML='';$('live-preview').hidden=true;status('');renderList()}
 function openPost(p){shareCheckId++;$('published-link').hidden=true;current=p;$('title').value=p.title||'';$('description').value=p.description||'';$('category').value=p.category||'महाराष्ट्र';$('body').value=p.body||'';$('video').value=p.video||'';$('author').value=p.author||'';$('slug').value=p.slug||'';$('slug').disabled=true;$('post-status').value=p.status||'published';$('featured').checked=!!p.featured;$('editor-heading').textContent='बातमी संपादित करा';$('edit-state').textContent='अद्ययावत';$('delete').hidden=false;$('image-preview').innerHTML='';if(p.image){let im=document.createElement('img');im.src=/^https:\/\//i.test(p.image)?p.image:new URL('../../'+p.image,location.href).href;im.alt='सध्याचा फोटो';$('image-preview').appendChild(im)}$('live-preview').hidden=true;status('');renderList();window.scrollTo({top:0,behavior:'smooth'})}
 function makeSlug(){const supplied=$('slug').value.trim();if(supplied)return supplied;let time=new Date().toISOString().replace(/\D/g,'').slice(0,14);return 'news-'+time+'-'+Math.random().toString(36).slice(2,6)}
 async function imageData(file,slug){
  if(file.size>8*1024*1024)throw Error('फोटो ८ MB पेक्षा कमी असावा.');
  const bitmap=await createImageBitmap(file);const width=Math.min(1280,bitmap.width),height=Math.round(bitmap.height*width/bitmap.width);const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(bitmap,0,0,width,height);bitmap.close();
  const data=canvas.toDataURL('image/jpeg',.86).split(',')[1],path='assets/img/'+slug+'-'+Date.now()+'.jpg';
  return{data,path};
 }
 function publishedUrl(slug){return new URL('../../batmi/'+encodeURIComponent(slug)+'/',location.href).href}
 function showPublishedLink(slug){
  const url=publishedUrl(slug),panel=$('published-link');
  $('published-open').href=url;
  $('published-url').textContent=url;
  panel.hidden=false;
 }
 async function waitForLiveStory(post){
  // WhatsApp scrapes the public HTML source. A GitHub JSON commit alone is not enough.
  // Never invite sharing before the correct article-specific OG title + image are published.
  const seq=++shareCheckId,url=publishedUrl(post.slug);
  for(let n=0;n<28;n++){
   if(seq!==shareCheckId||!loggedIn)return;
   try{
    const response=await fetch(url+'?verify='+encodeURIComponent(post.updated||''),{cache:'no-store'});
    if(response.ok){
     const doc=new DOMParser().parseFromString(await response.text(),'text/html');
     const title=doc.querySelector('meta[property="og:title"]')?.content;
     const updated=doc.querySelector('meta[property="article:modified_time"]')?.content;
     const image=doc.querySelector('meta[property="og:image"]')?.content;
     let imageReady=!!image;
     if(image){
      const imageUrl=new URL(image,url);
      if(imageUrl.origin===location.origin){
       const head=await fetch(imageUrl.href,{method:'HEAD',cache:'no-store'});
       imageReady=head.ok;
      }
     }
     if(title===post.title&&updated===post.updated&&imageReady){
      showPublishedLink(post.slug);
      status('✅ HTML पान आणि WhatsApp Thumbnail प्रकाशित झाले. आता लिंक शेअर करू शकता.');
      return;
     }
    }
   }catch(e){/* The public website may still be publishing. Retry. */}
   status('⏳ GitHub वर बातमी जतन झाली. HTML पान आणि Thumbnail प्रकाशित होत आहेत; लिंक तयार झाल्यावर दिसेल.');
   await new Promise(resolve=>setTimeout(resolve,3500));
  }
  if(seq===shareCheckId)status('⚠️ GitHub वर बातमी जतन झाली, पण सार्वजनिक HTML अजून तयार नाही. कृपया GitHub Actions तपासा आणि नंतर पान Refresh करा.',true);
 }
 async function submit(ev){
  ev.preventDefault();if(!loggedIn){status('🔒 प्रकाशनासाठी आधी अधिकृत Login आवश्यक आहे.',true);return}
  const slug=current?.slug||makeSlug();
  if(!/^[a-zA-Z0-9_-]{3,120}$/.test(slug)){status('URL/Slug साठी फक्त इंग्रजी अक्षरे, अंक, - किंवा _ वापरा.',true);return}
  $('publish').disabled=true;status('बातमी Server वर जतन होत आहे…');
  try{
   let image=current?.image||'assets/img/logo.webp';const file=$('photo').files[0];
   if(file){status('फोटो अपलोड होत आहे…');const pic=await imageData(file,slug);await github('contents/'+pic.path,'PUT',{message:'Add editorial image for '+slug,content:pic.data,branch});image=pic.path}
   const now=new Date().toISOString(), p={slug,title:$('title').value.trim(),description:$('description').value.trim(),category:$('category').value,body:$('body').value.trim(),image,author:$('author').value.trim()||'लोकहित महाराष्ट्र डिजिटल डेस्क',date:current?.date||now,updated:now,featured:$('featured').checked,status:$('post-status').value,video:$('video').value.trim(),tags:['महाराष्ट्र',$('category').value]};
   const path=current?._path||'content/posts/'+slug+'.json', payload={message:(current?'Update ':'Publish ')+slug,content:base64UTF8(JSON.stringify(p,null,2)+'\n'),branch};if(current?._sha)payload.sha=current._sha;
   await github('contents/'+path,'PUT',payload);
   await loadPosts();const found=records.find(x=>x.slug===slug);if(found)openPost(found);status('⏳ GitHub Save पूर्ण. HTML पान तयार होत आहे.');if(p.status==='published')void waitForLiveStory(p);else $('published-link').hidden=true;
  }catch(e){status('जतन अयशस्वी: '+e.message,true)}finally{$('publish').disabled=false}
 }
 async function remove(){if(!current||!confirm('ही बातमी कायमची काढायची?'))return;
  if(!confirm('खात्री करा: हा बदल Server वरील प्रकाशित सामग्रीतही होईल.'))return;
  try{await github('contents/'+current._path,'DELETE',{message:'Remove article '+current.slug,sha:current._sha,branch});status('बातमी काढली.');newPost();await loadPosts()}catch(e){status(e.message,true)}
 }
 function preview(){const box=$('live-preview');box.replaceChildren();let note=document.createElement('p');note.className='preview-note';note.textContent='पूर्वावलोकन — ही माहिती अजून प्रकाशित केलेली नाही.';let h=document.createElement('h2');h.textContent=$('title').value;let desc=document.createElement('strong');desc.textContent=$('description').value;box.append(note,h,desc);for(const para of $('body').value.split(/\n\s*\n/).filter(Boolean)){const p=document.createElement('p');p.textContent=para;box.appendChild(p)}box.hidden=false;box.scrollIntoView({behavior:'smooth',block:'start'})}
 // Controlled publishing bridge for the CMS tabs; credentials remain private in this closure.
 window.LokhitCMS={
  canPublish:()=>loggedIn,
  posts:()=>records.map(({slug,title,description,category,image,status})=>({slug,title,description,category,image,status})),
  async readJson(path){
   if(!['content/layout.json','site.json'].includes(path))throw Error('अमान्य सेटिंग्ज पाथ');
   if(!repository)throw Error('कृपया आधी लॉगिन करा.');
   const file=await github('contents/'+path+'?ref='+encodeURIComponent(branch));
   return {data:JSON.parse(decodeUTF8(file.content)),sha:file.sha};
  },
  async writeJson(path,data,message){
   if(!['content/layout.json','site.json'].includes(path))throw Error('अमान्य सेटिंग्ज पाथ');
   if(!loggedIn)throw Error('अधिकृत प्रवेश आवश्यक आहे. पुन्हा Login करा.');
   const existing=await github('contents/'+path+'?ref='+encodeURIComponent(branch));
   return github('contents/'+path,'PUT',{message:String(message||'Update CMS settings').slice(0,120),sha:existing.sha,branch,content:base64UTF8(JSON.stringify(data,null,2)+'\n')});
  }
 };

 // Missing required fields must display a clear error.
 $('post-form').addEventListener('invalid',event=>{
  const label=event.target.closest('label');
  status('कृपया आवश्यक माहिती भरा: '+(label?.textContent?.trim().slice(0,60)||'शीर्षक, सारांश आणि बातमीचा मजकूर'),true);
 },true);
 $('published-copy')?.addEventListener('click',async()=>{const u=$('published-url').textContent;if(!u)return;try{await navigator.clipboard.writeText(u);status('✅ लिंक कॉपी झाली.')}catch(e){status('लिंक कॉपी झाली नाही; वर दिलेली लिंक कॉपी करा.',true)}});
 $('login-form').addEventListener('submit',login);$('post-form').addEventListener('submit',submit);$('new-post').addEventListener('click',newPost);$('filter-posts').addEventListener('input',renderList);$('preview').addEventListener('click',preview);$('delete').addEventListener('click',remove);$('logout').addEventListener('click',()=>{token='';repository='';loggedIn=false;records=[];current=null;$('dashboard').hidden=true;$('login').hidden=false;$('login-form').reset();document.dispatchEvent(new Event('lokhitcms:logout'));status('');status('','', 'login-status')});
 $('photo').addEventListener('change',()=>{const file=$('photo').files[0];if(!file)return;const im=document.createElement('img');im.alt='नवीन फोटो पूर्वावलोकन';im.src=URL.createObjectURL(file);$('image-preview').replaceChildren(im)});
})();
