'use strict';
(() => {
 const $=id=>document.getElementById(id),api=()=>window.LokhitCMS;
 let layout={},site={},menu=[],slides=[],posts=[],mode='news',loading=false;
 const mk=(tag,cls='',txt='')=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt)e.textContent=txt;return e;};
 const status=(id,txt,bad=false)=>{const e=$(id);if(e){e.textContent=txt;e.classList.toggle('error',bad)}};
 const previewOnly=()=>!api()?.canPublish();
 const saveBtnIds=['menu-save','slider-save','breaking-save','settings-save'];
 const refreshPermissions=()=>{saveBtnIds.forEach(id=>{const b=$(id);if(b){b.disabled=false;b.removeAttribute('aria-disabled');b.title='साइटवर बदल प्रकाशित करा'}})};
 const safePath=s=>/^[a-z0-9_/-]*$/i.test(s) && !s.includes('..') && !s.startsWith('/') && !s.includes('//');
 function setTab(name){
  mode=name;
  document.querySelectorAll('[data-cms-tab]').forEach(b=>{const on=b.dataset.cmsTab===name;b.classList.toggle('is-active',on);b.setAttribute('aria-selected',String(on))});
  ['news','menu','slider','breaking','settings'].forEach(id=>{const el=$('cms-'+id);if(el)el.hidden=id!==name});
 }
 function actionBtn(label,action,disabled=false){
  const b=mk('button','cms-icon-btn',label);b.type='button';b.disabled=disabled;b.addEventListener('click',action);return b;
 }
 function move(arr,i,delta,paint){
  const n=i+delta;if(n<0||n>=arr.length)return;[arr[i],arr[n]]=[arr[n],arr[i]];paint();
 }
 function remove(arr,i,paint){arr.splice(i,1);paint()}
 function rowControls(arr,i,paint){
  const wrap=mk('div','cms-row-actions');
  wrap.append(
   actionBtn('↑',()=>move(arr,i,-1,paint),i===0),
   actionBtn('↓',()=>move(arr,i,1,paint),i===arr.length-1),
   actionBtn('✕',()=>remove(arr,i,paint))
  );
  return wrap;
 }
 function renderMenu(){
  const root=$('cms-menu-list');root.replaceChildren();$('menu-count').textContent='('+menu.length+')';
  if(!menu.length)root.append(mk('p','cms-hint','मेनू अजून जोडलेला नाही.'));
  menu.forEach((item,i)=>{
   const row=mk('div','cms-manage-item cms-menu-item');
   const idx=mk('span','cms-item-number',String(i+1));
   const name=mk('label','cms-row-field');name.append(mk('span','','मेनूचे नाव'));
   const ni=mk('input');ni.value=item.title||'';ni.maxLength=65;ni.setAttribute('aria-label','मेनूचे नाव');ni.addEventListener('input',()=>item.title=ni.value);name.append(ni);
   const href=mk('label','cms-row-field');href.append(mk('span','','पेज लिंक'));
   const hi=mk('input');hi.value=item.href||'';hi.setAttribute('aria-label','पेज लिंक');hi.addEventListener('input',()=>item.href=hi.value);href.append(hi);
   const vis=mk('label','cms-row-check');const check=mk('input');check.type='checkbox';check.checked=item.enabled!==false;check.addEventListener('change',()=>item.enabled=check.checked);vis.append(check,mk('span','','दाखवा'));
   row.append(idx,name,href,vis,rowControls(menu,i,renderMenu));root.append(row);
  });
 }
 function renderSlideOptions(){
  const select=$('slider-add-post'),selected=select.value;select.replaceChildren();
  const placeholder=mk('option','','बातमी निवडा…');placeholder.value='';select.append(placeholder);
  posts.filter(p=>p.status!=='draft').forEach(p=>{const opt=mk('option','',p.title);opt.value=p.slug;select.append(opt)});
  select.value=selected;
 }
 function renderSlider(){
  const root=$('cms-slider-list');root.replaceChildren();$('slider-count').textContent='('+slides.length+')';
  const bySlug=Object.fromEntries(posts.map(p=>[p.slug,p]));
  if(!slides.length)root.append(mk('p','cms-hint','स्लायडरमध्ये अजून बातम्या नाहीत.'));
  slides.forEach((slide,i)=>{
   const post=bySlug[slide.slug],row=mk('div','cms-manage-item cms-slider-item');
   const img=mk('img','cms-slide-thumb');img.alt='स्लायडर फोटो';img.loading='lazy';
   img.src=(post?.image?.startsWith('assets/img/')?'../'+post.image:'../assets/img/logo.webp');
   const fields=mk('div','cms-slide-info');
   fields.append(mk('strong','',post?.title||'बातमी उपलब्ध नाही — '+slide.slug));
   const label=mk('label','cms-row-field');label.append(mk('span','','विशेष मथळा (ऐच्छिक)'));
   const input=mk('input');input.value=slide.title||'';input.maxLength=160;input.placeholder='मूळ बातमीचा मथळा वापरा';input.addEventListener('input',()=>slide.title=input.value);label.append(input);fields.append(label);
   const vis=mk('label','cms-row-check'),ch=mk('input');ch.type='checkbox';ch.checked=slide.enabled!==false;ch.addEventListener('change',()=>slide.enabled=ch.checked);vis.append(ch,mk('span','','दाखवा'));
   row.append(img,fields,vis,rowControls(slides,i,renderSlider));root.append(row);
  });
 }
 function renderBreaking(){
  const v=layout.breaking||{};
  $('breaking-enabled').checked=v.enabled!==false;
  $('breaking-mode').value=v.mode==='custom'?'custom':'latest';
  $('breaking-custom').value=Array.isArray(v.custom)?v.custom.join('\n'):'';
  toggleCustom();
 }
 function toggleCustom(){const c=$('breaking-custom');c.disabled=$('breaking-mode').value!=='custom';c.closest('label').classList.toggle('cms-muted',c.disabled)}
 const settingKeys=['name','tagline','description','editor_name','contact_email','youtube_live_url','youtube_live_provider','youtube_live_channel_id','youtube_live_channel_url','youtube_url','facebook_url','instagram_url','twitter_url'];
 function renderSettings(){settingKeys.forEach(k=>{const e=$('setting-'+k);if(e)e.value=site[k]||''})}
 async function initialize(){
  if(loading)return;loading=true;
  refreshPermissions();
  try{
   const [l,s]=await Promise.all([api().readJson('content/layout.json'),api().readJson('site.json')]);
   layout=l.data;site=s.data;menu=Array.isArray(layout.menu)?structuredClone(layout.menu):[];slides=Array.isArray(layout.slider)?structuredClone(layout.slider):[];
   posts=api().posts();renderMenu();renderSlideOptions();renderSlider();renderBreaking();renderSettings();
   $('slider-seconds').value=String(layout.slider_seconds||6);
   ['menu-status','slider-status','breaking-status','settings-status'].forEach(id=>status(id,'सेटिंग्ज वाचल्या. प्रकाशनासाठी Save क्लिक करा.'));
  }catch(err){['menu-status','slider-status','breaking-status','settings-status'].forEach(id=>status(id,'सेटिंग्ज मिळाल्या नाहीत: '+err.message,true))}
  finally{loading=false}
 }
 async function saveLayout(section,newData,buttonId,statusId,message){
  if(previewOnly()){status(statusId,'प्रकाशनासाठी आधी अधिकृत Login करा.',true);return}
  const button=$(buttonId);button.disabled=true;status(statusId,'Server वर प्रकाशित करत आहे…');
  try{
   // Read the current remote layout before each save to preserve other settings.
   const current=await api().readJson('content/layout.json');
   const merged={...current.data,...newData,version:2};
   await api().writeJson('content/layout.json',merged,message);
   layout=merged;status(statusId,'✅ बदल जतन झाले. Server वर नवीन आवृत्ती प्रकाशित झाल्यावर वेबसाइटवर दिसतील.');
  }catch(err){status(statusId,'प्रकाशन अयशस्वी: '+err.message,true)}
  finally{button.disabled=false}
 }
 document.querySelectorAll('[data-cms-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.cmsTab)));
 $('menu-add-form').addEventListener('submit',ev=>{
  ev.preventDefault();const title=$('menu-add-title').value.trim(),href=$('menu-add-href').value.trim();
  if(!title||!safePath(href)){status('menu-status','नाव किंवा लिंक चुकीची आहे. वेबसाइटमधील इंग्रजी पाथ द्या.',true);return}
  if(menu.length>=24){status('menu-status','जास्तीत जास्त २४ मेनू जोडता येतील.',true);return}
  menu.push({title,href,enabled:true});$('menu-add-form').reset();renderMenu();status('menu-status','नवीन मेनू जोडला. प्रकाशित करण्यासाठी Save करा.');
 });
 $('menu-save').addEventListener('click',()=>{
  if(!menu.length||menu.some(m=>!m.title?.trim()||!safePath(String(m.href||'')))){status('menu-status','मेनूची नावे व लिंक तपासा.',true);return}
  saveLayout('menu',{menu:menu.map(m=>({title:String(m.title).trim().slice(0,65),href:String(m.href||'').trim(),enabled:!!m.enabled}))},'menu-save','menu-status','Update Lokhit Maharashtra navigation menus');
 });
 $('slider-add-form').addEventListener('submit',ev=>{
  ev.preventDefault();const slug=$('slider-add-post').value;
  if(!slug||!posts.some(p=>p.slug===slug)){status('slider-status','कृपया बातमी निवडा.',true);return}
  if(slides.length>=10){status('slider-status','जास्तीत जास्त १० स्लाइड्स.',true);return}
  if(slides.some(x=>x.slug===slug)){status('slider-status','ही बातमी स्लायडरमध्ये आधीच आहे.',true);return}
  slides.push({slug,title:'',enabled:true});renderSlider();status('slider-status','स्लाइड जोडली. Save करा.');
 });
 $('slider-save').addEventListener('click',()=>{
  if(!slides.some(x=>x.enabled)){status('slider-status','किमान एक स्लाइड सुरू ठेवा.',true);return}
  saveLayout('slider',{slider:slides.map(s=>({slug:s.slug,title:(s.title||'').trim().slice(0,160),enabled:!!s.enabled})),slider_seconds:Number($('slider-seconds').value)||6},'slider-save','slider-status','Update Lokhit Maharashtra homepage story slider');
 });
 $('breaking-mode').addEventListener('change',toggleCustom);
 $('breaking-form').addEventListener('submit',ev=>{
  ev.preventDefault();
  const mode=$('breaking-mode').value;
  const custom=$('breaking-custom').value.split(/\r?\n/).map(s=>s.trim().slice(0,170)).filter(Boolean).slice(0,12);
  if(mode==='custom'&&$('breaking-enabled').checked&&!custom.length){status('breaking-status','किमान एक ब्रेकिंग न्यूज मथळा लिहा.',true);return}
  saveLayout('breaking',{breaking:{enabled:$('breaking-enabled').checked,mode,custom}},'breaking-save','breaking-status','Update scrolling breaking-news headlines');
 });
 $('settings-form').addEventListener('submit',async ev=>{
  ev.preventDefault();if(previewOnly()){status('settings-status','प्रकाशनासाठी अधिकृत Server प्रवेश आवश्यक आहे.',true);return}
  const btn=$('settings-save');btn.disabled=true;status('settings-status','साइट सेटिंग्ज Server वर प्रकाशित करत आहे…');
  try{
   const current=await api().readJson('site.json'),update={...current.data};
   settingKeys.forEach(k=>update[k]=String($('setting-'+k).value||'').trim());
   if(!update.name)throw Error('वेबसाइट नाव आवश्यक आहे.');
   await api().writeJson('site.json',update,'Update Lokhit Maharashtra site settings');
   site=update;status('settings-status','✅ वेबसाइट सेटिंग्ज जतन झाली. पुनर्प्रकाशन झाल्यावर बदल दिसतील.');
  }catch(err){status('settings-status','प्रकाशन अयशस्वी: '+err.message,true)}
  finally{btn.disabled=false}
 });
 document.addEventListener('lokhitcms:ready',initialize);
 document.addEventListener('lokhitcms:logout',()=>{layout={};site={};menu=[];slides=[];posts=[];setTab('news')});
 setTab('news');
})();
