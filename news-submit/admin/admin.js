'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const SITE='https://catonpe-droid.github.io/lokhit-maharashtra/';
  const ADMIN=SITE+'news-submit/admin/';
  const raw=location.hash.startsWith('#key=')?location.hash.slice(5):'';
  let key='';
  try{key=decodeURIComponent(raw).trim()}catch{key=raw.trim()}
  let worker='',ready=false,busy=false,quill=null,posts=[],active=null,baseline=null,editorChanged=false,plainMode=false,page=1,hasMore=false,filter='all',imageURL='',pendingPhoto='';
  const alertMsg=(message,bad=false)=>{
    const el=$('status');el.textContent=message;el.className='state '+(bad?'bad':'ok');
  };
  function resetPreviewPhoto(){
    if(imageURL){URL.revokeObjectURL(imageURL);imageURL=''}
    const img=$('cover-preview');img.classList.add('hidden');img.removeAttribute('src');
  }
  function postURL(slug){return SITE+'batmi/'+encodeURIComponent(slug)+'/';}
  async function api(path,method='GET',body=null){
    if(!worker||key.length<32)throw Error('गुप्त प्रकाशन Key आणि Worker जोडणी आवश्यक आहे.');
    const options={method,cache:'no-store',headers:{Authorization:'Bearer '+key,...(body?{'Content-Type':'application/json'}:{})}};
    if(body)options.body=JSON.stringify(body);
    const response=await fetch(worker+path,options);
    const data=await response.json().catch(()=>({}));
    if(!response.ok) {
      if(response.status===401)throw Error('गुप्त Key जुळत नाही. Cloudflare मधील PUBLISH_KEY आणि लिंक तपासा.');
      if(response.status===404)throw Error('नवीन Admin Worker Code Cloudflare मध्ये Deploy झालेला नाही. Worker ची नवीन फाइल Deploy करा.');
      throw Error(data.error||'Server वर काम पूर्ण झाले नाही ('+response.status+').');
    }
    return data;
  }
  function textBody(){
    return (plainMode?$('plain-body').value:quill.getText()).trim();
  }
  function setBody(p){
    editorChanged=false;
    const rich=Array.isArray(p?.rich_delta)?p.rich_delta:null;
    const text=String(p?.body||'');
    if(plainMode) $('plain-body').value=text;
    else if(rich){
      try{quill.setContents(rich,'silent')}catch{quill.setText(text+'\n','silent')}
    }else quill.setText(text+(text.endsWith('\n')?'':'\n'),'silent');
    editorChanged=false;
  }
  function safeText(p){return String(p||'').trim().slice(0,50000)}
  function articleBodyPayload(){
    if(plainMode)return {body:safeText($('plain-body').value),rich_delta:null,body_changed:editorChanged};
    const delta=quill.getContents();
    const ops=Array.isArray(delta?.ops)?delta.ops:[];
    return {body:safeText(quill.getText()),rich_delta:ops,body_changed:editorChanged};
  }
  function setBusy(state){busy=state;for(const id of ['publish','save-draft','delete','refresh','top-new','reset'])$(id).disabled=state;}
  function resetForm(){
    if(busy)return;
    active=null;baseline=null;editorChanged=false;pendingPhoto='';
    $('post-form').reset();$('title').value='';$('author').value='लोकहित महाराष्ट्र डिजिटल डेस्क';$('category').value='महाराष्ट्र';$('post-status').value='published';
    $('featured').checked=false;$('slug').value='';$('tags').value='';$('video').value='';$('description').value='';$('post-date').textContent='नवीन बातमी';
    $('editor-heading').textContent='📰 नवीन बातमी';$('delete').classList.add('hidden');$('published').classList.add('hidden');
    resetPreviewPhoto();setBody({body:''});countDesc();renderList();
  }
  function countDesc(){$('desc-count').textContent=String($('description').value||'').length}
  function renderList(){
    const search=$('search').value.trim().toLowerCase();
    const list=posts.filter(p=>(filter==='all'||p.status===filter)&&(!search||[p.title,p.category,p.author,p.slug].join(' ').toLowerCase().includes(search)));
    const root=$('post-list');root.replaceChildren();
    if(!list.length){const note=document.createElement('p');note.className='muted';note.textContent='या पानावर जुळणारी बातमी नाही.';root.append(note);}
    list.forEach(p=>{
      const button=document.createElement('button');button.type='button';button.className='post-item'+(active?.slug===p.slug?' active':'');
      const strong=document.createElement('strong');strong.textContent=p.title||p.slug;
      const small=document.createElement('small');small.textContent=(p.status==='draft'?'📝 मसुदा':'✅ प्रकाशित')+' · '+(p.category||'')+' · '+String(p.date||'').slice(0,10);
      button.append(strong,small);button.addEventListener('click',()=>openPost(p.slug));root.append(button);
    });
    $('list-info').textContent=posts.length+' बातम्या · पान '+page+(hasMore?' · पुढील पान उपलब्ध':'');
    $('page-number').textContent=String(page);$('prev-page').disabled=page<=1;$('next-page').disabled=!hasMore;
  }
  async function loadList(){
    if(!ready)return;
    $('list-info').textContent='जुन्या बातम्या लोड होत आहेत…';
    const data=await api('/list?page='+page+'&limit=24');
    posts=Array.isArray(data.posts)?data.posts:[];
    hasMore=!!data.hasMore;
    posts.sort((a,b)=>String(b.updated||b.date||'').localeCompare(String(a.updated||a.date||'')));
    renderList();
  }
  async function openPost(slug){
    if(busy)return;
    setBusy(true);alertMsg('बातमी उघडत आहे…');
    try{
      const data=await api('/article?slug='+encodeURIComponent(slug));
      const p=data.article;
      if(!p||!p.slug)throw Error('बातमी मिळाली नाही.');
      active={slug:p.slug,sha:data.sha,status:p.status||'published'};
      baseline=p;
      $('title').value=p.title||'';$('category').value=p.category||'महाराष्ट्र';
      $('author').value=p.author||'लोकहित महाराष्ट्र डिजिटल डेस्क';$('description').value=p.description||'';
      $('tags').value=Array.isArray(p.tags)?p.tags.join(', '):'';$('video').value=p.video||'';
      $('post-status').value=p.status==='draft'?'draft':'published';$('featured').checked=!!p.featured;
      $('slug').value=p.slug;$('post-date').textContent=String(p.date||'').slice(0,19).replace('T',' ')||'—';
      $('editor-heading').textContent='✏️ बातमी संपादित करा';
      $('delete').classList.remove('hidden');$('published').classList.add('hidden');
      resetPreviewPhoto();pendingPhoto='';
      if(p.image && p.image!=='assets/img/logo.webp'){
        const img=$('cover-preview');
        img.src=p.image.startsWith('https://')?p.image:SITE+p.image.replace(/^\/+/,'');
        img.classList.remove('hidden');
      }
      setBody(p);countDesc();renderList();alertMsg('✅ जुनी बातमी उघडली. बदल करा आणि Update दाबा.');
      if(innerWidth<800)document.querySelector('.main-editor').scrollIntoView({behavior:'smooth'});
    }catch(e){alertMsg(e.message,true)}
    finally{setBusy(false)}
  }
  function photoAsJPEG(file){
    if(!file)return Promise.resolve('');
    if(file.size>12*1024*1024) return Promise.reject(Error('फोटो १२ MB पेक्षा लहान हवा.'));
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))return Promise.reject(Error('JPG, PNG किंवा WebP फोटो निवडा.'));
    return createImageBitmap(file).then(async bmp=>{
      try{
        const scale=Math.min(1,1400/Math.max(bmp.width,bmp.height));
        let w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale)),quality=.82;
        for(let n=0;n<14;n++){
          const c=document.createElement('canvas');c.width=w;c.height=h;
          const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bmp,0,0,w,h);
          const encoded=(c.toDataURL('image/jpeg',quality).split(',')[1]||'');
          if(encoded&&encoded.length<=920000)return encoded;
          w=Math.max(200,Math.round(w*.82));h=Math.max(150,Math.round(h*.82));quality=Math.max(.55,quality-.03);
        }
        throw Error('फोटो खूप मोठा आहे. दुसरा फोटो वापरा.');
      }finally{bmp.close?.()}
    });
  }
  function dataFromForm(status){
    const bodyData=articleBodyPayload();
    const title=$('title').value.trim(),description=$('description').value.trim();
    return {article:{
      ...(active?{slug:active.slug,expected_sha:active.sha}:{}),
      title,category:$('category').value,author:$('author').value.trim(),
      description,body:bodyData.body,
      ...(bodyData.body_changed?{rich_delta:bodyData.rich_delta}:{}),
      body_changed:bodyData.body_changed,
      status,featured:$('featured').checked,
      video:$('video').value.trim(),
      tags:$('tags').value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,15)
    }};
  }
  function shareResult(url,title,status){
    $('published').classList.remove('hidden');
    $('published-title').textContent=status==='draft'?'✅ मसुदा जतन झाला':'✅ बातमी जतन झाली';
    $('published-note').textContent=status==='draft'?'मसुदा सार्वजनिक वेबसाइटवर दिसणार नाही.':'GitHub वेबसाइटचा HTML Build पूर्ण झाल्यावर सुधारित बातमी दिसेल.';
    $('article-url').href=url;$('article-url').textContent=url;
    $('whatsapp').href='https://api.whatsapp.com/send?text='+encodeURIComponent(title+'\n'+url);
    $('whatsapp').classList.toggle('hidden',status==='draft');
  }
  async function savePost(status){
    if(busy||!ready)return;
    if(!$('post-form').reportValidity())return;
    const data=dataFromForm(status);
    if(data.article.title.length<8||data.article.body.length<30){alertMsg('शीर्षक आणि किमान ३० अक्षरांची बातमी लिहा.',true);return}
    setBusy(true);alertMsg('🕓 बातमी जतन होत आहे…');
    try{
      data.photo=await photoAsJPEG($('photo').files[0]);
      const result=await api('/save','POST',data);
      const url=postURL(result.slug);
      active={slug:result.slug,sha:result.sha,status};
      $('slug').value=result.slug;$('delete').classList.remove('hidden');
      $('post-status').value=status;
      $('post-date').textContent=String(result.date||new Date().toISOString()).slice(0,19).replace('T',' ');
      $('editor-heading').textContent='✏️ बातमी संपादित करा';
      $('photo').value='';pendingPhoto='';editorChanged=false;
      shareResult(url,data.article.title,status);
      alertMsg(status==='draft'?'✅ मसुदा GitHub वर जतन झाला.':'✅ GitHub वर Save झाले. HTML पानाचा Build सुरू होईल.');
      try{await loadList()}catch(e){alertMsg('बातमी Save झाली; यादी Refresh करता आली नाही: '+e.message,true)}
      try{const newData=await api('/article?slug='+encodeURIComponent(result.slug));baseline=newData.article;active.sha=newData.sha}catch{}
    }catch(e){alertMsg('❌ '+e.message,true)}
    finally{setBusy(false)}
  }
  async function deletePost(){
    if(!active||busy||!ready)return;
    const slug=active.slug;
    if(!confirm('ही बातमी कायमची Delete करायची आहे का?\n\n'+$('title').value+'\n\nबातमीचे सार्वजनिक HTML पान पुढील GitHub Build मध्ये काढले जाईल.'))return;
    setBusy(true);alertMsg('बातमी काढत आहे…');
    try{
      const res=await api('/delete','POST',{slug,expected_sha:active.sha});
      if(!res.deleted)throw Error('Delete झाले नाही.');
      active=null;baseline=null;setBusy(false);resetForm();await loadList();alertMsg('✅ बातमी Delete झाली. सार्वजनिक HTML Build नंतर काढले जाईल.');
    }catch(e){alertMsg('Delete अयशस्वी: '+e.message,true)}
    finally{setBusy(false)}
  }
  function preview(){
    const title=$('title').value.trim();if(!title){alertMsg('Preview साठी शीर्षक द्या.',true);return}
    $('preview-title').textContent=title;
    $('preview-summary').textContent=$('description').value.trim();
    const img=$('preview-cover'),src=$('cover-preview').getAttribute('src');
    img.classList.toggle('hidden',!src);
    if(src)img.src=src;
    const body=$('preview-body');
    if(plainMode){body.textContent=$('plain-body').value;body.style.whiteSpace='pre-wrap';}
    else{body.replaceChildren(quill.root.cloneNode(true));body.style.whiteSpace='normal';}
    $('preview-dialog').showModal();
  }
  function bindEvents(){
    $('top-new').addEventListener('click',resetForm);$('reset').addEventListener('click',resetForm);
    $('refresh').addEventListener('click',()=>loadList().catch(e=>alertMsg(e.message,true)));
    $('post-form').addEventListener('submit',e=>{e.preventDefault();savePost($('post-status').value)});
    $('save-draft').addEventListener('click',()=>savePost('draft'));
    $('delete').addEventListener('click',deletePost);
    $('preview').addEventListener('click',preview);
    $('close-preview').addEventListener('click',()=>$('preview-dialog').close());
    $('description').addEventListener('input',countDesc);
    $('search').addEventListener('input',renderList);
    document.querySelectorAll('[data-status]').forEach(b=>b.addEventListener('click',()=>{
      filter=b.dataset.status;document.querySelectorAll('[data-status]').forEach(x=>x.classList.toggle('active',x===b));renderList();
    }));
    $('prev-page').addEventListener('click',async()=>{if(page<=1||busy)return;page--;try{await loadList()}catch(e){page++;alertMsg(e.message,true)}});
    $('next-page').addEventListener('click',async()=>{if(!hasMore||busy)return;page++;try{await loadList()}catch(e){page--;alertMsg(e.message,true)}});
    $('photo').addEventListener('change',()=>{
      resetPreviewPhoto();
      const f=$('photo').files[0];
      if(f){imageURL=URL.createObjectURL(f);$('cover-preview').src=imageURL;$('cover-preview').classList.remove('hidden');}
      else if(baseline?.image && baseline.image!=='assets/img/logo.webp'){
        $('cover-preview').src=baseline.image.startsWith('https://')?baseline.image:SITE+baseline.image;
        $('cover-preview').classList.remove('hidden');
      }
    });
    $('copy-link').addEventListener('click',async()=>{
      const href=$('article-url').href;try{await navigator.clipboard.writeText(href);alertMsg('✅ लिंक कॉपी झाली.')}catch{alertMsg('लिंक निवडून कॉपी करा.',true)}
    });
    if(window.Quill){
      quill=new Quill('#rich-editor',{theme:'snow',modules:{toolbar:'#toolbar'},formats:['header','bold','italic','underline','strike','list','blockquote','link']});
      quill.on('text-change',(delta,old,source)=>{if(source==='user')editorChanged=true});
    }else{
      plainMode=true;
      $('toolbar').classList.add('hidden');$('rich-editor').classList.add('hidden');$('plain-body').classList.remove('hidden');
      $('plain-body').addEventListener('input',()=>{editorChanged=true});
      alertMsg('Rich Editor लोड झाला नाही. साधा Text Editor चालू आहे.');
    }
  }
  async function init(){
    bindEvents();resetForm();
    $('simple-link').href='../'+location.hash;
    if(key.length<32){alertMsg('गुप्त लिंक अपूर्ण आहे. News Publish Form मधील पूर्ण #key= लिंक वापरा.',true);return}
    try{
      const response=await fetch('../config.json',{cache:'no-store'});
      const c=await response.json();worker=String(c.worker_url||'').trim().replace(/\/+$/,'');
      const u=new URL(worker);
      if(u.protocol!=='https:'||!u.hostname.endsWith('.workers.dev'))throw Error('Worker URL योग्य नाही.');
      const status=await fetch(worker+'/health',{cache:'no-store'}).then(r=>r.json());
      if(!status.ready)throw Error('Cloudflare Worker अजून Configure झालेला नाही.');
      if(!Array.isArray(status.features)||!status.features.includes('editor')) {
        alertMsg('Admin UI तयार आहे. जुनी बातमी Edit/Delete करण्यासाठी अद्ययावत Worker Code Cloudflare मध्ये Deploy करणे आवश्यक आहे.',true);
        return;
      }
      const ping=await api('/list?page=1&limit=1');
      ready=true;alertMsg('✅ News Admin Studio तयार आहे.');
      await loadList();
    }catch(e){alertMsg('प्रकाशन सेवा: '+e.message,true)}
  }
  init();
})();