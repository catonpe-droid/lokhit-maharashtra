'use strict';
(() => {
 const $=(id)=>document.getElementById(id);let googleToken='',workerURL='',current=null,records=[],loggedIn=false;
 const status=(message,error=false,target='editor-status')=>{const node=$(target);if(!node)return;node.textContent=message;node.className=error?'status error':'status'};
 const escapeHTML=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
 async function api(path,method='GET',body=null){
  if(!workerURL||!googleToken)throw Error('Gmail ने पुन्हा Login करा.');
  const res=await fetch(workerURL+path,{method,cache:'no-store',headers:{'Authorization':'Bearer '+googleToken,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const payload=await res.json().catch(()=>({error:'Server प्रतिसाद मिळाला नाही.'}));
  if(!res.ok)throw Error(payload.error||'Server वर काम पूर्ण होऊ शकले नाही.');
  return payload;
 }
 async function googleLogin(result){
  const credential=result?.credential;
  if(!credential){status('Gmail Login रद्द झाला; पुन्हा प्रयत्न करा.',true,'login-status');return}
  googleToken=credential;
  status('Gmail तपासत आहे…',false,'login-status');
  try{
   const who=await api('/session');
   loggedIn=true;
   $('login').hidden=true;$('dashboard').hidden=false;
   $('publish').disabled=false;
   await loadPosts();
   status('✅ '+who.email+' ने Login झाले. बातमी Save आणि Publish करता येईल.');
   document.dispatchEvent(new Event('lokhitcms:ready'));
  }catch(e){loggedIn=false;googleToken='';status(e.message,true,'login-status')}
 }
 async function setupGoogleLogin(){
  try{
   const cfg=await fetch('./config.json',{cache:'no-store'}).then(r=>r.json());
   if(!/^https:\/\/[a-z0-9.-]+(?:\/[a-z0-9/_-]*)?$/i.test(cfg.worker_url||'')){
    throw Error('Gmail Login साठी मोफत Server ची जोडणी अजून पूर्ण झालेली नाही.');
   }
   workerURL=cfg.worker_url.replace(/\/+$/,'');
   const reply=await fetch(workerURL+'/status',{cache:'no-store'});
   const data=await reply.json();
   if(!reply.ok||!data.configured||!data.google_client_id)throw Error('Gmail Login चा एकदाचा सेटअप पूर्ण झालेला नाही.');
   if(!window.google?.accounts?.id)throw Error('Google Login उपलब्ध नाही. ब्राउझर तपासा.');
   window.google.accounts.id.initialize({client_id:data.google_client_id,callback:googleLogin,auto_select:false,ux_mode:'popup',cancel_on_tap_outside:true});
   window.google.accounts.id.renderButton($('google-signin-button'),{type:'standard',theme:'outline',size:'large',text:'signin_with',shape:'rectangular',logo_alignment:'left',width:270});
   $('setup-needed').hidden=true;
   status('तुमच्या अधिकृत Gmail खात्याने Sign in करा.',false,'login-status');
  }catch(err){
   $('setup-needed').hidden=false;
   status(err.message,true,'login-status');
  }
 }

 async function loadPosts(){
  $('post-list').textContent='बातम्या वाचत आहे…';
  try{
   const data=await api('/posts');
   records=(data.posts||[]).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
   renderList();
  }catch(e){$('post-list').textContent='बातम्या लोड होत नाहीत: '+e.message;throw e}
 }
 function renderList(){const q=$('filter-posts').value.trim().toLowerCase(), list=records.filter(p=>(p.title+' '+p.category).toLowerCase().includes(q));
  $('post-list').innerHTML='';if(!list.length){$('post-list').textContent='बातम्या आढळल्या नाहीत.';return}
  for(const p of list){const b=document.createElement('button');b.type='button';b.className='admin-post'+(current?._path===p._path?' active':'');const strong=document.createElement('strong');strong.textContent=p.title;const small=document.createElement('small');small.textContent=p.category+' · '+(p.status==='draft'?'मसुदा':'प्रकाशित');b.append(strong,small);b.onclick=()=>openPost(p);$('post-list').appendChild(b)}
 }
 function newPost(){current=null;$('post-form').reset();$('author').value='लोकहित महाराष्ट्र डिजिटल डेस्क';$('category').value='दुष्काळ विशेष';$('post-status').value='published';$('editor-heading').textContent='नवीन बातमी';$('edit-state').textContent='नवीन';$('slug').disabled=false;$('delete').hidden=true;$('image-preview').innerHTML='';$('live-preview').hidden=true;status('');renderList()}
 function openPost(p){current=p;$('title').value=p.title||'';$('description').value=p.description||'';$('category').value=p.category||'महाराष्ट्र';$('body').value=p.body||'';$('video').value=p.video||'';$('author').value=p.author||'';$('slug').value=p.slug||'';$('slug').disabled=true;$('post-status').value=p.status||'published';$('featured').checked=!!p.featured;$('editor-heading').textContent='बातमी संपादित करा';$('edit-state').textContent='अद्ययावत';$('delete').hidden=false;$('image-preview').innerHTML='';if(p.image){let im=document.createElement('img');im.src='../../'+p.image;im.alt='सध्याचा फोटो';$('image-preview').appendChild(im)}$('live-preview').hidden=true;status('');renderList();window.scrollTo({top:0,behavior:'smooth'})}
 function makeSlug(){const supplied=$('slug').value.trim();if(supplied)return supplied;let time=new Date().toISOString().replace(/\D/g,'').slice(0,14);return 'news-'+time+'-'+Math.random().toString(36).slice(2,6)}
 async function imageData(file){
  if(file.size>8*1024*1024)throw Error('फोटो ८ MB पेक्षा लहान हवा.');
  const bitmap=await createImageBitmap(file);
  let width=Math.min(1100,bitmap.width),height=Math.round(bitmap.height*width/bitmap.width);
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d');
  let quality=.8,base64='';
  for(let n=0;n<7;n++){
   canvas.width=width;canvas.height=height;ctx.drawImage(bitmap,0,0,width,height);
   base64=canvas.toDataURL('image/jpeg',quality).split(',')[1];
   if(base64.length<980000)break;
   quality=Math.max(.46,quality-.07);
   width=Math.round(width*.9);height=Math.round(height*.9);
  }
  bitmap.close();
  if(base64.length>=1050000)throw Error('फोटो खूप मोठा आहे. कृपया कमी आकाराचा फोटो वापरा.');
  return {type:'image/jpeg',data:base64};
 }
 async function submit(ev){
  ev.preventDefault();
  if(!loggedIn){status('आधी Gmail ने Login करा.',true);return}
  const slug=current?.slug||makeSlug();
  if(!/^[a-z0-9][a-z0-9_-]{2,110}$/i.test(slug)){status('URL/Slug इंग्रजी अक्षरे, अंक, - किंवा _ मध्ये द्या.',true);return}
  $('publish').disabled=true;
  status('बातमी Server वर जतन करत आहे…');
  try{
   const file=$('photo').files[0];
   const image=file?await imageData(file):null;
   const article={slug,title:$('title').value.trim(),description:$('description').value.trim(),
    body:$('body').value.trim(),category:$('category').value,
    author:$('author').value.trim(),video:$('video').value.trim(),
    featured:$('featured').checked,status:$('post-status').value};
   const result=await api('/post','PUT',{article,image});
   await loadPosts();
   const found=records.find(p=>p.slug===result.slug);
   if(found)openPost(found);
   status(result.status==='draft'?'✅ मसुदा Server वर जतन झाला.':'✅ बातमी Save झाली! वेबसाइटचा स्वयंचलित Build सुरू होईल.');
  }catch(e){status('जतन अयशस्वी: '+e.message,true)}
  finally{$('publish').disabled=false}
 }
 async function remove(){
  if(!loggedIn||!current||!confirm('ही बातमी कायमची काढायची?'))return;
  try{await api('/post?slug='+encodeURIComponent(current.slug),'DELETE');newPost();await loadPosts();status('✅ बातमी काढली.')}
  catch(e){status('बातमी काढता आली नाही: '+e.message,true)}
 }
 function preview(){const box=$('live-preview');box.replaceChildren();let note=document.createElement('p');note.className='preview-note';note.textContent='पूर्वावलोकन — ही माहिती अजून प्रकाशित केलेली नाही.';let h=document.createElement('h2');h.textContent=$('title').value;let desc=document.createElement('strong');desc.textContent=$('description').value;box.append(note,h,desc);for(const para of $('body').value.split(/\n\s*\n/).filter(Boolean)){const p=document.createElement('p');p.textContent=para;box.appendChild(p)}box.hidden=false;box.scrollIntoView({behavior:'smooth',block:'start'})}
 // Controlled publishing bridge for the CMS tabs; credentials remain private in this closure.
 window.LokhitCMS={
  canPublish:()=>loggedIn,
  posts:()=>records.map(({slug,title,description,category,image,status})=>({slug,title,description,category,image,status})),
  async readJson(path){return api('/file?path='+encodeURIComponent(path))},
  async writeJson(path,data){return api('/file','PUT',{path,data})}
 };
 $('post-form').addEventListener('invalid',event=>{
  const label=event.target.closest('label');
  status('कृपया आवश्यक माहिती भरा: '+(label?.textContent?.trim().slice(0,60)||'शीर्षक, सारांश आणि बातमीचा मजकूर'),true);
 },true);

 setupGoogleLogin();$('post-form').addEventListener('submit',submit);$('new-post').addEventListener('click',newPost);$('filter-posts').addEventListener('input',renderList);$('preview').addEventListener('click',preview);$('delete').addEventListener('click',remove);$('logout').addEventListener('click',()=>{googleToken='';loggedIn=false;records=[];current=null;$('dashboard').hidden=true;$('login').hidden=false;$('login-form').reset();document.dispatchEvent(new Event('lokhitcms:logout'));status('');status('Gmail ने पुन्हा Sign in करा.','', 'login-status')});
 $('photo').addEventListener('change',()=>{const file=$('photo').files[0];if(!file)return;const im=document.createElement('img');im.alt='नवीन फोटो पूर्वावलोकन';im.src=URL.createObjectURL(file);$('image-preview').replaceChildren(im)});
})();
