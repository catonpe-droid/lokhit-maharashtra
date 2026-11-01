'use strict';
(() => {
 const $=(id)=>document.getElementById(id);let sessionToken='',workerURL='',current=null,records=[],loggedIn=false,selectedEditor=null,pendingPin='';
 const status=(message,error=false,target='editor-status')=>{const node=$(target);if(!node)return;node.textContent=message;node.className=error?'status error':'status'};
 const escapeHTML=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
 async function api(path,method='GET',body=null){
  if(!workerURL||!sessionToken)throw Error('PIN ने पुन्हा Login करा.');
  const res=await fetch(workerURL+path,{method,cache:'no-store',headers:{'Authorization':'Bearer '+sessionToken,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const payload=await res.json().catch(()=>({error:'Server प्रतिसाद मिळाला नाही.'}));
  if(!res.ok)throw Error(payload.error||'Server वर काम पूर्ण होऊ शकले नाही.');
  return payload;
 }
 async function setupPinLogin(){
  try{
   const cfg=await fetch('./config.json',{cache:'no-store'}).then(r=>r.json());
   if(!/^https:\/\/[a-z0-9.-]+(?:\/[a-z0-9/_-]*)?$/i.test(cfg.worker_url||''))throw Error('सुरक्षित PIN Server ची एकदाची जोडणी अजून पूर्ण झालेली नाही.');
   workerURL=cfg.worker_url.replace(/\/+$/,'');
   const resp=await fetch(workerURL+'/status',{cache:'no-store'});
   const data=await resp.json();
   if(!resp.ok||!data.configured)throw Error('PIN Server चा एकदाचा सेटअप पूर्ण झालेला नाही.');
   $('setup-needed').hidden=true;
   status('६ अंकी PIN टाका.',false,'login-status');
  }catch(e){$('setup-needed').hidden=false;status(e.message,true,'login-status')}
 }
 async function publicEditors(){
  const resp=await fetch(workerURL+'/editors',{cache:'no-store'});
  const data=await resp.json();
  if(!resp.ok)throw Error(data.error||'Editor नावे मिळाली नाहीत.');
  return data.editors;
 }
 async function pinStep(event){
  event.preventDefault();
  if(!workerURL){status('सुरक्षित PIN Server अजून सक्रिय नाही.',true,'login-status');return}
  const pin=$('pin-code').value;
  if(!/^\d{6}$/.test(pin)){status('सहा अंकी PIN टाका.',true,'login-status');return}
  pendingPin=pin;
  try{
   const editors=await publicEditors();
   const sel=$('editor-choice');sel.replaceChildren();
   const intro=document.createElement('option');intro.value='';intro.textContent='— Editor निवडा —';sel.append(intro);
   for(const e of editors){const op=document.createElement('option');op.value=String(e.id);op.textContent=e.name;sel.append(op)}
   $('pin-form').hidden=true;$('editor-form').hidden=false;
   status('तुमचे Editor नाव निवडा.',false,'login-status');
  }catch(e){pendingPin='';status(e.message,true,'login-status')}
 }
 async function editorStep(event){
  event.preventDefault();
  const editor=Number($('editor-choice').value);
  if(!editor||!pendingPin){status('PIN आणि Editor निवडा.',true,'login-status');return}
  const btn=$('editor-form').querySelector('button[type="submit"]');
  btn.disabled=true;status('PIN तपासत आहे…',false,'login-status');
  try{
   const response=await fetch(workerURL+'/login',{
    method:'POST',cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({pin:pendingPin,editor})
   });
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'PIN तपासता आला नाही.');
   sessionToken=data.session;selectedEditor=data.editor;pendingPin='';
   $('pin-code').value='';
   loggedIn=true;$('login').hidden=true;$('dashboard').hidden=false;
   $('publish').disabled=false;
   $('author').value=selectedEditor.name;
   await loadPosts();await loadEditorNames();
   status('✅ '+selectedEditor.name+' म्हणून Login झाले. Save/Publish सुरू आहे.');
   document.dispatchEvent(new Event('lokhitcms:ready'));
  }catch(e){sessionToken='';loggedIn=false;status(e.message,true,'login-status')}
  finally{btn.disabled=false}
 }
 async function loadEditorNames(){
  try{
   const editors=await publicEditors();
   const root=$('editor-name-fields');root.replaceChildren();
   for(const e of editors){
    const label=document.createElement('label');label.textContent='Editor '+e.id;
    const inp=document.createElement('input');inp.type='text';inp.maxLength=70;inp.required=true;inp.value=e.name;inp.dataset.editorId=String(e.id);label.append(inp);root.append(label);
   }
  }catch(e){status(e.message,true,'editor-names-status')}
 }
 async function saveEditorNames(ev){
  ev.preventDefault();if(!loggedIn)return;
  const btn=$('save-editor-names');btn.disabled=true;
  try{
   const editors=Array.from(document.querySelectorAll('[data-editor-id]')).map(e=>e.value.trim());
   const res=await api('/editor-names','PUT',{editors});
   status('✅ १० Editor नावे जतन झाली. पुढील Login मध्ये नवीन नावे दिसतील.',false,'editor-names-status');
   const selected=res.editors?.find(e=>e.id===selectedEditor?.id);
   if(selected){selectedEditor=selected;$('author').value=selected.name}
  }catch(e){status('नावे जतन झाली नाहीत: '+e.message,true,'editor-names-status')}
  finally{btn.disabled=false}
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
 function newPost(){current=null;$('post-form').reset();$('author').value=selectedEditor?.name||'Editor';$('category').value='दुष्काळ विशेष';$('post-status').value='published';$('editor-heading').textContent='नवीन बातमी';$('edit-state').textContent='नवीन';$('slug').disabled=false;$('delete').hidden=true;$('image-preview').innerHTML='';$('live-preview').hidden=true;status('');renderList()}
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
  if(!loggedIn){status('आधी PIN ने Login करा.',true);return}
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

 setupPinLogin();$('pin-form').addEventListener('submit',pinStep);$('editor-form').addEventListener('submit',editorStep);$('pin-back').addEventListener('click',()=>{pendingPin='';$('editor-form').hidden=true;$('pin-form').hidden=false;status('PIN पुन्हा टाका.',false,'login-status')});$('toggle-editor-names').addEventListener('click',()=>{const p=$('editor-names-panel');p.hidden=!p.hidden;if(!p.hidden)p.scrollIntoView({behavior:'smooth',block:'start'})});$('editor-names-form').addEventListener('submit',saveEditorNames);$('post-form').addEventListener('submit',submit);$('new-post').addEventListener('click',newPost);$('filter-posts').addEventListener('input',renderList);$('preview').addEventListener('click',preview);$('delete').addEventListener('click',remove);$('logout').addEventListener('click',()=>{sessionToken='';selectedEditor=null;pendingPin='';loggedIn=false;records=[];current=null;$('dashboard').hidden=true;$('login').hidden=false;$('editor-form').hidden=true;$('pin-form').hidden=false;$('pin-code').value='';document.dispatchEvent(new Event('lokhitcms:logout'));status('');status('PIN ने पुन्हा प्रवेश करा.','', 'login-status')});
 $('photo').addEventListener('change',()=>{const file=$('photo').files[0];if(!file)return;const im=document.createElement('img');im.alt='नवीन फोटो पूर्वावलोकन';im.src=URL.createObjectURL(file);$('image-preview').replaceChildren(im)});
})();
