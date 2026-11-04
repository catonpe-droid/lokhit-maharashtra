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
      try{
        const normalized=rich.map(op=>{
          if(op?.insert?.image && typeof op.insert.image==='string' && op.insert.image.startsWith('assets/img/')){
            return {...op,insert:{...op.insert,image:SITE+op.insert.image}};
          }
          return op;
        });
        quill.setContents(normalized,'silent');
      }catch{quill.setText(text+'\n','silent')}
    }else quill.setText(text+(text.endsWith('\n')?'':'\n'),'silent');
    editorChanged=false;
  }
  function safeText(p){return String(p||'').trim().slice(0,50000)}
  function articleBodyPayload(){
    if(plainMode)return {body:safeText($('plain-body').value),rich_delta:null,body_changed:editorChanged};
    const delta=quill.getContents();
    const ops=(Array.isArray(delta?.ops)?delta.ops:[]).map(op=>{
      if(typeof op?.insert?.image==='string' && op.insert.image.startsWith(SITE+'assets/img/')){
        return {...op,insert:{...op.insert,image:op.insert.image.slice(SITE.length)}};
      }
      return op;
    });
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
  function photoAsJPEG(file,maxSize=920000){
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
          if(encoded&&encoded.length<=maxSize)return encoded;
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
    $('published-note').textContent=status==='draft'?'मसुदा सार्वजनिक वेबसाइटवर दिसणार नाही.':'Server अपडेट झाल्यावर सुधारित बातमी दिसेल.';
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
      alertMsg(status==='draft'?'✅ मसुदा Server वर जतन झाला.':'✅ Server वर Save झाले. HTML पानाचा Build सुरू होईल.');
      try{await loadList()}catch(e){alertMsg('बातमी Save झाली; यादी Refresh करता आली नाही: '+e.message,true)}
      try{const newData=await api('/article?slug='+encodeURIComponent(result.slug));baseline=newData.article;active.sha=newData.sha}catch{}
    }catch(e){alertMsg('❌ '+e.message,true)}
    finally{setBusy(false)}
  }
  async function deletePost(){
    if(!active||busy||!ready)return;
    const slug=active.slug;
    if(!confirm('ही बातमी कायमची Delete करायची आहे का?\n\n'+$('title').value+'\n\nबातमीचे सार्वजनिक HTML पान पुढील Server Update मध्ये काढले जाईल.'))return;
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

  let siteLayout=null,siteLayoutSha='',siteLoaded=false,siteSettingsReady=false;

  const homeNames=['live_tv','drought_banner','latest','gov_links','drought_news','more'];
  const checkId={live_tv:'home-live-tv',drought_banner:'home-drought-banner',latest:'home-latest',gov_links:'home-gov-links',drought_news:'home-drought-news',more:'home-more'};
  function cleanCategorySlug(text){return String(text||'').trim().toLowerCase().replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,65)}
  function rowButton(label,action){
    const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',action);return b;
  }
  function rowActions(div){
    const actions=document.createElement('div');actions.className='row-actions';
    actions.append(
      rowButton('↑',()=>{if(div.previousElementSibling)div.parentNode.insertBefore(div,div.previousElementSibling)}),
      rowButton('↓',()=>{if(div.nextElementSibling)div.parentNode.insertBefore(div.nextElementSibling,div)}),
      rowButton('✕',()=>div.remove())
    );return actions;
  }
  function fieldInput(value,placeholder,max=85){
    const input=document.createElement('input');input.type='text';input.value=String(value||'');input.placeholder=placeholder;input.maxLength=max;return input;
  }
  function categoryRow(obj={}){
    const div=document.createElement('div');div.className='row-card category-card';
    const name=fieldInput(obj.name,'Category नाव',65);
    const slug=fieldInput(obj.slug,'English URL slug',65);
    const label=fieldInput(obj.label||obj.name,'वेबसाइटवर दिसणारे नाव',65);
    for(const el of [name,slug,label])el.dataset.categoryField='1';
    div.append(name,slug,label,rowActions(div));
    return div;
  }
  function layoutCategoryOptions(selected){
    const names=[...new Set([...$('category-items').querySelectorAll('.category-card')].map(row=>row.querySelector('input')?.value.trim()).filter(Boolean))];
    const all=new Set([...names,selected].filter(Boolean));
    return [...all];
  }
  function homeCategoryRow(obj={}){
    const div=document.createElement('div');div.className='row-card homecat-card';
    const select=document.createElement('select');select.dataset.blockField='category';
    for(const name of layoutCategoryOptions(obj.category)){
      const option=new Option(name,name);select.add(option);
    }
    if(obj.category)select.value=obj.category;
    const title=fieldInput(obj.title||obj.category,'मुखपृष्ठावर दिसणारे शीर्षक',65);title.dataset.blockField='title';
    const show=document.createElement('label');show.className='check';
    const checked=document.createElement('input');checked.type='checkbox';checked.checked=obj.enabled!==false;checked.dataset.blockField='enabled';show.append(checked,document.createTextNode('दाखवा'));
    div.append(select,title,show,rowActions(div));
    return div;
  }
  function renderHomeControls(){
    const homepage=siteLayout?.homepage||{};
    for(const name of homeNames)$(checkId[name]).checked=homepage[name]?.enabled===true || (homepage[name]?.enabled!==false && !['live_tv','drought_banner'].includes(name));
    $('home-latest-title').value=homepage.latest?.title||'ताज्या बातम्या';
    $('home-drought-news-title').value=homepage.drought_news?.title||'दुष्काळ विशेष';
    $('home-more-title').value=homepage.more?.title||'अधिक बातम्या';
    $('home-banner-title').value=homepage.drought_banner?.title||'दुष्काळ विशेष : माहिती, मदत आणि मार्गदर्शन';
    $('home-banner-desc').value=homepage.drought_banner?.description||'पाणी, चारा, कर्ज, शेतकरी मदत व रोजगाराच्या बातम्या एकाच ठिकाणी';
    $('home-category-items').replaceChildren();
    const blocks=Array.isArray(homepage.category_blocks)?homepage.category_blocks:[];
    blocks.forEach(b=>$('home-category-items').append(homeCategoryRow(b)));
  }
  function updateArticleCategoryChoices(){
    const selected=$('category').value;
    const entries=(siteLayout?.categories||[]).filter(c=>c&&c.name);
    if(!entries.length)return;
    const node=$('category');node.replaceChildren();
    for(const c of entries){
      const opt=new Option(c.label||c.name,c.name);node.add(opt);
    }
    if(!entries.some(c=>c.name===selected)&&selected){
      node.add(new Option(selected+' (जुनी Category)',selected));
    }
    if(selected)node.value=selected;
  }
  function newHomeData(){
    return {
      latest:{enabled:$('home-latest').checked,title:$('home-latest-title').value.trim()},
      gov_links:{enabled:$('home-gov-links').checked},
      drought_news:{enabled:$('home-drought-news').checked,title:$('home-drought-news-title').value.trim()},
      drought_banner:{enabled:$('home-drought-banner').checked,title:$('home-banner-title').value.trim(),description:$('home-banner-desc').value.trim()},
      live_tv:{enabled:$('home-live-tv').checked},
      more:{enabled:$('home-more').checked,title:$('home-more-title').value.trim()},
      category_blocks:[...$('home-category-items').children].map(row=>({
        category:row.querySelector('[data-block-field="category"]').value,
        title:row.querySelector('[data-block-field="title"]').value.trim(),
        enabled:row.querySelector('[data-block-field="enabled"]').checked
      })).filter(item=>!!item.category).slice(0,20)
    };
  }
  function newCategoryData(){
    const data=[...$('category-items').children].map(row=>{
      const fields=row.querySelectorAll('[data-category-field]');
      return {name:fields[0].value.trim(),slug:cleanCategorySlug(fields[1].value),label:fields[2].value.trim()};
    });
    if(data.some(x=>!x.name||x.slug.length<2)){
      throw Error('Category साठी नाव आणि 2+ इंग्रजी अक्षरांचा URL slug आवश्यक आहे.');
    }
    const names=data.map(x=>x.name),slugs=data.map(x=>x.slug);
    if(new Set(names).size!==data.length||new Set(slugs).size!==data.length){
      throw Error('एकाच नावाची किंवा URL slug असलेली Category दोनदा नको.');
    }
    return data;
  }

  function layoutRow(item={},kind='menu'){
    const isSlide=kind==='slider';
    const div=document.createElement('div');
    div.className='row-card'+(isSlide?' slider-card':'');
    const textField=(value,placeholder,max=140)=>{
      const input=document.createElement('input');
      input.type='text';input.value=String(value||'');input.placeholder=placeholder;input.maxLength=max;
      return input;
    };
    const name=textField(isSlide?item.slug:item.title,isSlide?'बातमी Slug':'मेनूचे नाव',isSlide?115:65);
    name.dataset.field='name';
    const link=textField(isSlide?item.title:item.href,isSlide?'विशेष स्लायडर मथळा':'उदा. vibhag/sheti/',isSlide?160:140);
    link.dataset.field='link';
    const checkLabel=document.createElement('label');checkLabel.className='check';
    const check=document.createElement('input');check.type='checkbox';check.checked=item.enabled!==false;
    check.dataset.field='enabled';checkLabel.append(check,document.createTextNode('दाखवा'));
    const actions=document.createElement('div');actions.className='row-actions';
    function action(label,handler){
      const b=document.createElement('button');b.type='button';b.textContent=label;
      b.addEventListener('click',handler);actions.append(b);
    }
    action('↑',()=>{if(div.previousElementSibling)div.parentNode.insertBefore(div,div.previousElementSibling)});
    action('↓',()=>{if(div.nextElementSibling)div.parentNode.insertBefore(div.nextElementSibling,div)});
    action('✕',()=>div.remove());
    div.append(name,link,checkLabel,actions);
    return div;
  }
  function renderLayout(){
    if(!siteLayout)return;
    const menus=$('menu-items'),slides=$('slider-items');menus.replaceChildren();slides.replaceChildren();
    (siteLayout.menu||[]).forEach(item=>menus.append(layoutRow(item,'menu')));
    (siteLayout.slider||[]).forEach(item=>slides.append(layoutRow(item,'slider')));
    $('breaking-enabled').checked=siteLayout.breaking?.enabled!==false;
    $('breaking-mode').value=siteLayout.breaking?.mode==='custom'?'custom':'latest';
    $('breaking-lines').value=Array.isArray(siteLayout.breaking?.custom)?siteLayout.breaking.custom.join('\n'):'';
    $('slider-seconds').value=Number(siteLayout.slider_seconds)||6;
    $('category-items').replaceChildren();
    (siteLayout.categories||[]).forEach(cat=>$('category-items').append(categoryRow(cat)));
    renderHomeControls();
    updateArticleCategoryChoices();
    $('layout-note').textContent='मेनू, Categories आणि विभागांचा क्रम बदलण्यासाठी ↑ ↓ बटणे वापरा.';
  }
  async function loadLayout(){
    if(!ready)return;
    $('layout-note').textContent='सेटिंग्ज लोड करत आहे…';
    try{
      const result=await api('/layout');
      siteLayout=result.layout;siteLayoutSha=result.sha;siteLoaded=true;renderLayout();
      if(!siteSettingsReady){$('save-layout').disabled=true;$('layout-note').textContent='⚠️ Homepage/Category Save साठी Cloudflare Worker Code अपडेट आवश्यक आहे.';}
      alertMsg('✅ मेनू, ब्रेकिंग आणि स्लायडर लोड झाले.');
    }catch(e){siteLoaded=false;alertMsg('सेटिंग्ज: '+e.message,true)}
  }
  async function saveLayout(){
    if(!ready||!siteLoaded||busy)return;
    if(!siteSettingsReady){alertMsg('नवीन Server Code सक्रिय नाही. Cloudflare मध्ये Worker Code अपडेट केल्याशिवाय या सेटिंग्ज Save होणार नाहीत.',true);return;}
    const extract=(root,kind)=>[...$(root).children].map(node=>{
      const inputs=node.querySelectorAll('[data-field]');
      if(kind==='menu')return {title:inputs[0].value.trim(),href:inputs[1].value.trim(),enabled:inputs[2].checked};
      return {slug:inputs[0].value.trim(),title:inputs[1].value.trim(),enabled:inputs[2].checked};
    }).filter(obj=>kind==='menu'?!!obj.title:!!obj.slug);
    const layout={
      ...siteLayout,
      menu:extract('menu-items','menu'),
      slider:extract('slider-items','slider'),
      breaking:{
        enabled:$('breaking-enabled').checked,
        mode:$('breaking-mode').value,
        custom:$('breaking-lines').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,12)
      },
      slider_seconds:Math.max(3,Math.min(15,Number($('slider-seconds').value)||6))
    };
    try{
      layout.categories=newCategoryData();
      layout.homepage=newHomeData();
    }catch(e){alertMsg('❌ '+e.message,true);return;}
    if(layout.menu.length>24||layout.slider.length>12||layout.categories.length>40){alertMsg('जास्तीत जास्त २४ मेनू, १२ स्लाइड आणि ४० Categories वापरता येतील.',true);return;}
    $('save-layout').disabled=true;
    try{
      const result=await api('/layout','POST',{layout,expected_sha:siteLayoutSha});
      if(!result.saved)throw Error('Save झाले नाही.');
      siteLayout=result.layout;siteLayoutSha=result.sha;
      renderLayout();alertMsg('✅ Categories, मुखपृष्ठ, मेनू आणि ब्रेकिंग न्यूज Server वर Save झाले. वेबसाइट अपडेट होईल.');
      $('layout-note').textContent='✅ जतन झाले. वेबसाइटवर Server अपडेट झाल्यावर बदल दिसतील.';
    }catch(e){alertMsg('❌ सेटिंग्ज Save अयशस्वी: '+e.message,true)}
    finally{$('save-layout').disabled=false;}
  }
  function togglePanel(site){
    $('tab-news').classList.toggle('active',!site);
    $('tab-site').classList.toggle('active',site);
    $('tab-news').setAttribute('aria-selected',String(!site));
    $('tab-site').setAttribute('aria-selected',String(site));
    $('news-layout').classList.toggle('hidden',site);
    $('layout-panel').classList.toggle('hidden',!site);
    if(site&&!siteLoaded)loadLayout();
  }

  function bindEvents(){
    $('tab-news').addEventListener('click',()=>togglePanel(false));
    $('tab-site').addEventListener('click',()=>togglePanel(true));
    $('add-menu').addEventListener('click',()=>{if($('menu-items').children.length<24)$('menu-items').append(layoutRow({title:'',href:'',enabled:true},'menu'))});
    $('add-slide').addEventListener('click',()=>{if($('slider-items').children.length<12)$('slider-items').append(layoutRow({slug:'',title:'',enabled:true},'slider'))});
    $('add-category').addEventListener('click',()=>{
      if($('category-items').children.length<40)$('category-items').append(categoryRow({}));
    });
    $('add-home-category').addEventListener('click',()=>{
      if($('home-category-items').children.length<20)$('home-category-items').append(homeCategoryRow({category:'महाराष्ट्र',title:'',enabled:true}));
    });
    $('save-layout').addEventListener('click',saveLayout);
    $('refresh-layout').addEventListener('click',loadLayout);
    $('top-new').addEventListener('click',resetForm);$('reset').addEventListener('click',resetForm);
    $('refresh').addEventListener('click',()=>loadList().catch(e=>alertMsg(e.message,true)));
    // The Publish button ALWAYS publishes. Saving a draft is a separate, explicit action.
    // Previously this inherited the selected Draft state and silently re-saved as Draft.
    $('post-form').addEventListener('submit',e=>{e.preventDefault();savePost('published')});
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
      quill=new Quill('#rich-editor',{theme:'snow',modules:{toolbar:'#toolbar'},formats:['header','bold','italic','underline','strike','list','blockquote','link','image']});
      quill.on('text-change',(delta,old,source)=>{if(source==='user')editorChanged=true});
      $('inline-image').addEventListener('click',()=>{$('inline-file').click()});
      $('inline-file').addEventListener('change',async()=>{
        const f=$('inline-file').files[0];$('inline-file').value='';
        if(!f)return;
        const embedded=quill.getContents().ops.filter(op=>op?.insert?.image).length;
        if(embedded>=4){alertMsg('एका बातमीत जास्तीत जास्त ४ आतील फोटो घालता येतात.',true);return}
        try{
          alertMsg('मजकुरासाठी फोटो तयार होत आहे…');
          const base64=await photoAsJPEG(f,290000);
          const position=quill.getSelection(true)?.index ?? quill.getLength()-1;
          quill.insertEmbed(position,'image','data:image/jpeg;base64,'+base64,'user');
          quill.insertText(position+1,'\n','user');
          quill.setSelection(position+2,0);
          editorChanged=true;alertMsg('✅ फोटो बातमीच्या मजकुरात जोडला.');
        }catch(e){alertMsg('फोटो जोडता आला नाही: '+e.message,true)}
      });
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
      siteSettingsReady=Array.isArray(status.features)&&status.features.includes('homepage')&&status.features.includes('categories');
      if(!Array.isArray(status.features)||!status.features.includes('editor')) {
        alertMsg('Admin UI तयार आहे. जुनी बातमी Edit/Delete करण्यासाठी अद्ययावत Worker Code Cloudflare मध्ये Deploy करणे आवश्यक आहे.',true);
        return;
      }
      const ping=await api('/list?page=1&limit=1');
      ready=true;alertMsg('✅ News Admin Studio तयार आहे.');
      await loadList();
      await loadLayout();
    }catch(e){alertMsg('प्रकाशन सेवा: '+e.message,true)}
  }
  init();
})();