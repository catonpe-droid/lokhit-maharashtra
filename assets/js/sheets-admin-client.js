
'use strict';
(()=>{
const $=id=>document.getElementById(id);
const BROWSER_KEY="lokhit_old_cms_session_v2";
let sessionToken='',current=null,records=[],loggedIn=false,selectedEditor=null;
const status=(message,error=false,target='editor-status')=>{
 const node=$(target);if(!node)return;
 node.textContent=message||'';node.className=error?'status error':'status';
};
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
// Google Sheets authenticates only; this UI remains in the original GitHub Editor.
const SCRIPT_URL="https://script.google.com/macros/s/AKfycby68PcZ0he76x-zkhbVtmoa2EBQcdvfQhCFplpDx12oVxX7DpUbMfiMBznjE5nOoLE/exec";
const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
let bridgeWindow=null,bridgeOrigin='',bridgeResolve,requestId=0;
const pending=new Map();
const bridgeReady=new Promise(resolve=>{bridgeResolve=resolve});
window.addEventListener('message',event=>{
 const m=event.data;
 if(!m||m.topic!=='lokhit-sheet-bridge'||m.nonce!==nonce)return;
 if(!/^https:\/\/[a-z0-9.-]*googleusercontent\.com$/.test(event.origin))return;
 if(m.type==='ready'){
  if(!bridgeWindow){bridgeWindow=event.source;bridgeOrigin=event.origin;bridgeResolve();}
  bridgeWindow.postMessage({topic:'lokhit-sheet-bridge',type:'ack',nonce},bridgeOrigin);
  return;
 }
 if(event.source!==bridgeWindow||event.origin!==bridgeOrigin||m.type!=='result')return;
 const task=pending.get(m.id);
 if(!task)return;
 pending.delete(m.id);clearTimeout(task.timer);
 if(m.ok)task.resolve(m.value);else task.reject(new Error(String(m.error||'Google Sheet Server error')));
});
const frame=document.createElement('iframe');
frame.title='Google Sheet Login';frame.setAttribute('aria-hidden','true');
frame.tabIndex=-1;frame.style.cssText='position:absolute;width:1px;height:1px;left:-9999px;top:0;border:0;visibility:hidden';
frame.src=SCRIPT_URL+'?bridge=1&nonce='+nonce;
document.body.append(frame);
function bridgeRpc(name,args){
 return new Promise(async(resolve,reject)=>{
  let readyTimer;
  try{
   await Promise.race([
    bridgeReady,
    new Promise((_,bad)=>{readyTimer=setTimeout(()=>bad(new Error('Google Sheet Login जोडणी चालू नाही. Apps Script मध्ये नवीन Version Deploy करा.')),18000)})
   ]);
   clearTimeout(readyTimer);
   const id=++requestId;
   const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Server उत्तर मिळाले नाही. पुन्हा प्रयत्न करा.'))},45000);
   pending.set(id,{resolve,reject,timer});
   bridgeWindow.postMessage({topic:'lokhit-sheet-bridge',type:'rpc',id,nonce,name,args},bridgeOrigin);
  }catch(err){clearTimeout(readyTimer);reject(err)}
 });
}
function gas(name,...args){return bridgeRpc(name,args)}
async function api(path,method='GET',body=null){
 if(!sessionToken)throw Error('PIN ने पुन्हा Login करा.');
 if(path==='/posts'&&method==='GET')return gas('listNews',sessionToken);
 if(path==='/post'&&method==='PUT')return gas('saveNews',sessionToken,body.article,body.image);
 if(path.startsWith('/post?slug=')&&method==='DELETE')return gas('deleteNews',sessionToken,decodeURIComponent(path.split('slug=')[1]));
 if(path==='/editor-names'&&method==='PUT')return gas('updateEditorNames',sessionToken,body.editors);
 if(path.startsWith('/file?path=')&&method==='GET')return gas('readCmsJson',sessionToken,decodeURIComponent(path.split('path=')[1]));
 if(path==='/file'&&method==='PUT')return gas('writeCmsJson',sessionToken,body.path,body.data);
 throw Error('अवैध Server विनंती.');
}
async function editors(){
 const out=await gas('publicEditorInfo');
 const sel=$('editor-choice');sel.replaceChildren();
 const blank=document.createElement('option');blank.value='';blank.textContent='— Editor निवडा —';sel.append(blank);
 out.forEach(e=>{const o=document.createElement('option');o.value=String(e.id);o.textContent=e.name;sel.append(o)});
 return out;
}
function rememberToken(value){
 try{localStorage.setItem(BROWSER_KEY,value)}catch(e){}
}
function removeRemembered(){
 try{localStorage.removeItem(BROWSER_KEY)}catch(e){}
}
async function activate(user){
 selectedEditor=user;
 loggedIn=true;$('login').hidden=true;$('dashboard').hidden=false;
 $('pin-code').value='';$('author').value=user.name;
 $('publish').disabled=false;
 try{
  await loadPosts();
  await loadEditorNames();
  document.dispatchEvent(new Event('lokhitcms:ready'));
  status('✅ '+user.name+' म्हणून Login झाले. मूळ GitHub Editor सुरू आहे.');
 }catch(err){status('Admin डेटा लोड करताना अडचण: '+err.message,true)}
}
async function login(e){
 e.preventDefault();
 const pin=$('pin-code').value,selected=$('editor-choice').value,btn=$('login-btn');
 if(!/^\d{6}$/.test(pin)||!selected){status('PIN आणि Editor नाव निवडा.',true,'login-status');return;}
 btn.disabled=true;status('PIN तपासत आहे...',false,'login-status');
 try{
  const result=await gas('loginAdmin',pin,Number(selected));
  sessionToken=result.token;
  if($('remember').checked)rememberToken(sessionToken);else removeRemembered();
  await activate(result.editor);
 }catch(err){status(err.message,true,'login-status')}
 finally{btn.disabled=false}
}
async function restore(){
 let saved='';
 try{saved=localStorage.getItem(BROWSER_KEY)||''}catch(e){}
 if(!saved)return;
 status('मागील Login तपासत आहे...',false,'login-status');
 try{
  const res=await gas('verifySession',saved);
  sessionToken=saved;await activate(res.editor);
 }catch(e){removeRemembered();sessionToken='';status('PIN टाकून पुन्हा Login करा.',false,'login-status')}
}
async function loadEditorNames(){
 try{
  const all=await gas('publicEditorInfo'),root=$('editor-name-fields');
  root.replaceChildren();
  all.forEach(e=>{
   const label=document.createElement('label');label.textContent='Editor '+e.id;
   const input=document.createElement('input');input.type='text';input.required=true;input.maxLength=70;
   input.value=e.name;input.dataset.editorId=String(e.id);label.append(input);root.append(label);
  });
 }catch(e){status(e.message,true,'editor-names-status')}
}
async function saveEditorNames(ev){
 ev.preventDefault();const button=$('save-editor-names');button.disabled=true;
 try{
  const names=Array.from($('editor-name-fields').querySelectorAll('[data-editor-id]')).map(e=>e.value.trim());
  const result=await api('/editor-names','PUT',{editors:names});
  const updated=result.editors.find(e=>e.id===selectedEditor.id);
  if(updated){selectedEditor=updated;$('author').value=updated.name}
  status('✅ दहा Editor नावे जतन झाली.',false,'editor-names-status');
 }catch(e){status(e.message,true,'editor-names-status')}
 finally{button.disabled=false}
}
 async function loadPosts(){
  $('post-list').textContent='मूळ GitHub बातम्या आणि नवीन बातम्या वाचत आहे…';
  try{
   // GitHub Pages remains the source of all originally published stories.
   // The Apps Script back end may not be able to fetch Github's original
   // export; fetch it directly from this same-origin site instead.
   const [saved,original]=await Promise.allSettled([
    api('/posts'),
    fetch('../../cms-export.json',{cache:'no-store'})
      .then(r=>{if(!r.ok)throw Error('मूळ बातम्यांची फाइल उघडली नाही.');return r.json()})
   ]);
   const fromDrive=saved.status==='fulfilled'&&Array.isArray(saved.value?.posts)?saved.value.posts:[];
   const fromGithub=original.status==='fulfilled'&&Array.isArray(original.value)?original.value:[];
   if(saved.status==='rejected'&&original.status==='rejected'){
    throw Error('Google Sheet: '+saved.reason.message+' | GitHub: '+original.reason.message);
   }
   const bySlug=new Map();
   for(const p of fromGithub){
    if(p&&p.slug&&p.status!=='draft'){
     bySlug.set(p.slug,{...p,id:p.id||p.slug,origin:'github'});
    }
   }
   // New stories and edits saved through the editor always win.
   for(const p of fromDrive){
    if(p&&p.slug)bySlug.set(p.slug,p);
   }
   records=Array.from(bySlug.values()).filter(p=>p.status!=='deleted')
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
   renderList();
   if(saved.status==='rejected'){
    status('मूळ GitHub बातम्या दिसत आहेत; नवीन बातम्या लोड होऊ शकल्या नाहीत: '+saved.reason.message,true);
   }else if(original.status==='rejected'){
    status('Google Sheet बातम्या दिसत आहेत; जुन्या GitHub बातम्या लोड होऊ शकल्या नाहीत: '+original.reason.message,true);
   }
  }catch(e){$('post-list').textContent='बातम्या लोड होत नाहीत: '+e.message;throw e}
 }
 function renderList(){const q=$('filter-posts').value.trim().toLowerCase(), list=records.filter(p=>(p.title+' '+p.category).toLowerCase().includes(q));
  $('post-list').innerHTML='';if(!list.length){$('post-list').textContent='बातम्या आढळल्या नाहीत.';return}
  for(const p of list){const b=document.createElement('button');b.type='button';b.className='admin-post'+(current?.slug===p.slug?' active':'');const strong=document.createElement('strong');strong.textContent=p.title;const small=document.createElement('small');small.textContent=p.category+' · '+(p.status==='draft'?'मसुदा':'प्रकाशित');b.append(strong,small);b.onclick=()=>openPost(p);$('post-list').appendChild(b)}
 }
 function newPost(){current=null;$('post-form').reset();$('author').value=selectedEditor?.name||'Editor';$('category').value='दुष्काळ विशेष';$('post-status').value='published';$('editor-heading').textContent='नवीन बातमी';$('edit-state').textContent='नवीन';$('slug').disabled=false;$('delete').hidden=true;$('image-preview').innerHTML='';$('live-preview').hidden=true;status('');renderList()}
 function openPost(p){current=p;$('title').value=p.title||'';$('description').value=p.description||'';$('category').value=p.category||'महाराष्ट्र';$('body').value=p.body||'';$('video').value=p.video||'';$('author').value=p.author||'';$('slug').value=p.slug||'';$('slug').disabled=true;$('post-status').value=p.status||'published';$('featured').checked=!!p.featured;$('editor-heading').textContent='बातमी संपादित करा';$('edit-state').textContent='अद्ययावत';$('delete').hidden=false;$('image-preview').innerHTML='';if(p.image){let im=document.createElement('img');im.src=String(p.image||'').startsWith('https://')?p.image:'https://catonpe-droid.github.io/lokhit-maharashtra/'+p.image;im.alt='सध्याचा फोटो';$('image-preview').appendChild(im)}$('live-preview').hidden=true;status('');renderList();window.scrollTo({top:0,behavior:'smooth'})}
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
   status(result.status==='draft'?'✅ मसुदा Server वर जतन झाला.':'✅ बातमी Save झाली! Google Drive Feed मधून वेबसाइटवर दिसेल.');
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


$('login-form').addEventListener('submit',login);
$('post-form').addEventListener('submit',submit);
$('new-post').addEventListener('click',newPost);
$('filter-posts').addEventListener('input',renderList);
$('preview').addEventListener('click',preview);
$('delete').addEventListener('click',remove);
$('toggle-editor-names').addEventListener('click',()=>{
 const panel=$('editor-names-panel');panel.hidden=!panel.hidden;
 if(!panel.hidden)panel.scrollIntoView({behavior:'smooth',block:'start'});
});
$('editor-names-form').addEventListener('submit',saveEditorNames);
$('logout').addEventListener('click',()=>{
 const oldToken=sessionToken;
 sessionToken='';loggedIn=false;records=[];current=null;selectedEditor=null;
 removeRemembered();
 $('login').hidden=false;$('dashboard').hidden=true;$('pin-code').value='';
 document.dispatchEvent(new Event('lokhitcms:logout'));
 status('Logout झाले. PIN ने पुन्हा प्रवेश करा.',false,'login-status');
 if(oldToken)gas('logoutAdmin',oldToken).catch(()=>{});
});
$('photo').addEventListener('change',()=>{
 const file=$('photo').files[0];if(!file)return;
 const image=document.createElement('img');
 image.alt='फोटो पूर्वावलोकन';image.src=URL.createObjectURL(file);
 $('image-preview').replaceChildren(image);
});
editors().catch(e=>status(e.message,true,'login-status'));
restore();
})();
