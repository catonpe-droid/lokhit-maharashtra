'use strict';
(() => {
 const $=(id)=>document.getElementById(id);let token='',repository='',branch='main',current=null,records=[],loggedIn=false,demoMode=false;
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
  const id=$('username').value.trim(),password=$('password').value.trim();
  repository='catonpe-droid/lokhit-maharashtra';branch='main';demoMode=(id==='admin'&&password==='1234');
  token=demoMode?'':password;
  $('login-status').textContent=demoMode?'डेमो पूर्वावलोकन उघडत आहे…':'GitHub अधिकार तपासत आहे…';
  try{
   if(!demoMode){
    const userResp=await fetch('https://api.github.com/user',{headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token}});
    if(!userResp.ok)throw Error('प्रकाशनासाठी GitHub access token आवश्यक आहे. साधा GitHub पासवर्ड येथे वापरू नका.');
    const user=await userResp.json();
    if(!user.login||user.login.toLowerCase()!==id.toLowerCase())throw Error('Login ID हा GitHub username असणे आवश्यक आहे.');
    const info=await github('');
    branch=info.default_branch||'main';
   }
   const files=await github('contents/content/posts?ref='+encodeURIComponent(branch));
   if(!Array.isArray(files))throw Error('बातम्यांचा डेटा सापडला नाही.');
   loggedIn=!demoMode;
   $('password').value='';
   $('login').hidden=true;$('dashboard').hidden=false;
   $('publish').disabled=demoMode;
   status(demoMode?'डेमो मोड : बातम्या वाचा आणि पूर्वावलोकन करा. प्रकाशित करण्यासाठी GitHub username आणि fine-grained token वापरून पुन्हा प्रवेश करा.':'✅ GitHub ची ओळख तपासली. तुम्ही बातम्या जतन करू शकता.',demoMode);
   await loadPosts();
  }catch(e){status(e.message,true,'login-status');token='';demoMode=false;loggedIn=false;}
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
 function newPost(){current=null;$('post-form').reset();$('author').value='लोकहित महाराष्ट्र डिजिटल डेस्क';$('category').value='दुष्काळ विशेष';$('post-status').value='published';$('editor-heading').textContent='नवीन बातमी';$('edit-state').textContent='नवीन';$('slug').disabled=false;$('delete').hidden=true;$('image-preview').innerHTML='';$('live-preview').hidden=true;status('');renderList()}
 function openPost(p){current=p;$('title').value=p.title||'';$('description').value=p.description||'';$('category').value=p.category||'महाराष्ट्र';$('body').value=p.body||'';$('video').value=p.video||'';$('author').value=p.author||'';$('slug').value=p.slug||'';$('slug').disabled=true;$('post-status').value=p.status||'published';$('featured').checked=!!p.featured;$('editor-heading').textContent='बातमी संपादित करा';$('edit-state').textContent='अद्ययावत';$('delete').hidden=demoMode;$('image-preview').innerHTML='';if(p.image){let im=document.createElement('img');im.src='../'+p.image;im.alt='सध्याचा फोटो';$('image-preview').appendChild(im)}$('live-preview').hidden=true;status('');renderList();window.scrollTo({top:0,behavior:'smooth'})}
 function makeSlug(){const supplied=$('slug').value.trim();if(supplied)return supplied;let time=new Date().toISOString().replace(/\D/g,'').slice(0,14);return 'news-'+time+'-'+Math.random().toString(36).slice(2,6)}
 async function imageData(file,slug){
  if(file.size>8*1024*1024)throw Error('फोटो ८ MB पेक्षा कमी असावा.');
  const bitmap=await createImageBitmap(file);const width=Math.min(1280,bitmap.width),height=Math.round(bitmap.height*width/bitmap.width);const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(bitmap,0,0,width,height);bitmap.close();
  const data=canvas.toDataURL('image/jpeg',.86).split(',')[1],path='assets/img/'+slug+'-'+Date.now()+'.jpg';
  return{data,path};
 }
 async function submit(ev){
  ev.preventDefault();if(!loggedIn){status('सर्वप्रथम GitHub प्रवेश करा.',true);return}
  const slug=current?.slug||makeSlug();
  if(!/^[a-zA-Z0-9_-]{3,120}$/.test(slug)){status('URL/Slug साठी फक्त इंग्रजी अक्षरे, अंक, - किंवा _ वापरा.',true);return}
  $('publish').disabled=true;status('बातमी GitHub वर जतन होत आहे…');
  try{
   let image=current?.image||'assets/img/logo.webp';const file=$('photo').files[0];
   if(file){status('फोटो अपलोड होत आहे…');const pic=await imageData(file,slug);await github('contents/'+pic.path,'PUT',{message:'Add editorial image for '+slug,content:pic.data,branch});image=pic.path}
   const now=new Date().toISOString(), p={slug,title:$('title').value.trim(),description:$('description').value.trim(),category:$('category').value,body:$('body').value.trim(),image,author:$('author').value.trim()||'लोकहित महाराष्ट्र डिजिटल डेस्क',date:current?.date||now,updated:now,featured:$('featured').checked,status:$('post-status').value,video:$('video').value.trim(),tags:['महाराष्ट्र',$('category').value]};
   const path=current?._path||'content/posts/'+slug+'.json', payload={message:(current?'Update ':'Publish ')+slug,content:base64UTF8(JSON.stringify(p,null,2)+'\n'),branch};if(current?._sha)payload.sha=current._sha;
   await github('contents/'+path,'PUT',payload);
   status('✅ GitHub वर बातमी जतन झाली. Pages workflow पूर्ण झाल्यावर वेबसाइट अपडेट होईल.');await loadPosts();const found=records.find(x=>x.slug===slug);if(found)openPost(found);
  }catch(e){status('जतन अयशस्वी: '+e.message,true)}finally{$('publish').disabled=false}
 }
 async function remove(){if(!current||!confirm('ही बातमी कायमची काढायची?'))return;
  if(!confirm('खात्री करा: हा बदल GitHub मध्येही होईल.'))return;
  try{await github('contents/'+current._path,'DELETE',{message:'Remove article '+current.slug,sha:current._sha,branch});status('बातमी काढली.');newPost();await loadPosts()}catch(e){status(e.message,true)}
 }
 function preview(){const box=$('live-preview');box.replaceChildren();let note=document.createElement('p');note.className='preview-note';note.textContent='पूर्वावलोकन — ही माहिती अजून प्रकाशित केलेली नाही.';let h=document.createElement('h2');h.textContent=$('title').value;let desc=document.createElement('strong');desc.textContent=$('description').value;box.append(note,h,desc);for(const para of $('body').value.split(/\n\s*\n/).filter(Boolean)){const p=document.createElement('p');p.textContent=para;box.appendChild(p)}box.hidden=false;box.scrollIntoView({behavior:'smooth',block:'start'})}
 $('login-form').addEventListener('submit',login);$('post-form').addEventListener('submit',submit);$('new-post').addEventListener('click',newPost);$('filter-posts').addEventListener('input',renderList);$('preview').addEventListener('click',preview);$('delete').addEventListener('click',remove);$('logout').addEventListener('click',()=>{token='';repository='';loggedIn=false;demoMode=false;records=[];current=null;$('dashboard').hidden=true;$('login').hidden=false;$('login-form').reset();status('');status('','', 'login-status')});
 $('photo').addEventListener('change',()=>{const file=$('photo').files[0];if(!file)return;const im=document.createElement('img');im.alt='नवीन फोटो पूर्वावलोकन';im.src=URL.createObjectURL(file);$('image-preview').replaceChildren(im)});
})();
