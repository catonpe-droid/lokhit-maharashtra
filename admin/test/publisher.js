'use strict';
// Login-free editor: no GitHub credentials are ever kept in browser code.
// The ANIK server accepts writes ONLY after its administrator configures private network access.
(()=>{
 const $=id=>document.getElementById(id);
 const $publish=$('publish-live'),$health=$('api-health'),$notice=$('notice'),$live=$('live-published');
 let apiUrl='',publishing=false;
 const setStatus=msg=>{$notice.textContent=msg;};
 const liveUrl=slug=>new URL('../../batmi/'+encodeURIComponent(slug)+'/',location.href).href;
 function publishedLink(url){
  $('live-link').href=url;
  $('live-link').textContent=url;
  $live.classList.remove('hidden');
 }
 function hidePublished(){ $live.classList.add('hidden'); }
 async function checkServer(){
  try{
   const config=await fetch('./config.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(Error('Config missing')));
   const base=String(config.publish_api_url||'').trim().replace(/\/+$/,'');
   if(!base){$health.textContent=' ANIK Server API URL अजून जोडलेला नाही; Preview आणि Draft सुविधा चालू आहेत.';return;}
   const url=new URL(base);
   if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1')throw Error('HTTPS URL आवश्यक');
   apiUrl=url.href.replace(/\/+$/,'');
   const r=await fetch(apiUrl+'/health',{cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();
   $health.textContent=data.publishingConfigured?
     ' ✅ ANIK Server GitHub Publishing साठी तयार आहे.':
     ' ANIK API सुरू आहे, पण GitHub Publishing चे Server Settings अपूर्ण आहेत.';
  }catch(e){$health.textContent=' ANIK Server संपर्कात नाही: '+e.message;}
 }
 async function photoJPEGBase64(file){
  if(!file)return null;
  if(file.size>8*1024*1024)throw Error('फोटो 8 MB पेक्षा लहान निवडा.');
  const bitmap=await createImageBitmap(file);
  try{
   let width=Math.min(bitmap.width,1400),height=Math.max(1,Math.round(bitmap.height*width/bitmap.width));
   let quality=.85;
   for(let attempt=0;attempt<9;attempt++){
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    canvas.getContext('2d').drawImage(bitmap,0,0,width,height);
    const base64=canvas.toDataURL('image/jpeg',quality).split(',')[1];
    if(base64.length<1_240_000)return base64; // < 950 KB decoded
    quality=Math.max(.5,quality-.06);
    width=Math.max(160,Math.round(width*.87));height=Math.max(100,Math.round(height*.87));
   }
   throw Error('फोटो कमी आकाराचा निवडा.');
  }finally{bitmap.close();}
 }
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function waitForHTML(url,expectedTitle){
  for(let attempt=0;attempt<35;attempt++){
   try{
    const res=await fetch(url+'?livecheck='+Date.now(),{cache:'no-store'});
    if(res.ok){
     const page=new DOMParser().parseFromString(await res.text(),'text/html');
     const meta=prop=>page.querySelector('meta[property="'+prop+'"]')?.content;
     const image=meta('og:image');
     if(meta('og:title')===expectedTitle&&image){
      const imgURL=new URL(image,url);
      // Only check same-origin assets; external sites may not allow HEAD requests.
      if(imgURL.origin===location.origin){
       const im=await fetch(imgURL.href,{method:'HEAD',cache:'no-store'});
       if(!im.ok)throw Error('Thumbnail waiting');
      }
      return true;
     }
    }
   }catch(e){/* Pages build not yet ready. */}
   setStatus('⏳ GitHub वर Save झाले. HTML आणि WhatsApp Thumbnail तयार होत आहेत… ('+(attempt+1)+'/35)');
   await sleep(3500);
  }
  return false;
 }
 $publish.addEventListener('click',async()=>{
  if(publishing)return;
  hidePublished();
  if(!$('story').reportValidity())return;
  if(!apiUrl){
   setStatus('⚠️ ANIK Server Publishing API अजून जोडलेली नाही. बातमीचा Preview व Test Draft वापरता येईल; प्रत्यक्ष Publish साठी Server URL जोडणे बाकी आहे.');
   return;
  }
  publishing=true;$publish.disabled=true;
  try{
   setStatus('फोटो तयार होत आहे…');
   const imageBase64=await photoJPEGBase64($('photo').files?.[0]);
   const article={
    title:$('headline').value.trim(),
    description:$('summary').value.trim(),
    category:$('category').value,
    body:$('body').value.trim(),
    author:'लोकहित महाराष्ट्र डिजिटल डेस्क',
    featured:false,
    imageBase64
   };
   setStatus('ANIK Server मार्फत GitHub वर बातमी पाठवत आहे…');
   const response=await fetch(apiUrl+'/publish',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    cache:'no-store',
    body:JSON.stringify(article)
   });
   const result=await response.json().catch(()=>({error:'Server प्रतिसाद वाचता आला नाही.'}));
   if(!response.ok||!result.saved||!result.url)throw Error(result.error||'बातमी Save झाली नाही.');
   if(new URL(result.url).origin!==location.origin)throw Error('Server ने अवैध बातमी URL दिला.');
   setStatus('✅ GitHub मध्ये बातमी जतन झाली. सार्वजनिक HTML तपासत आहे…');
   const ready=await waitForHTML(result.url,article.title);
   if(ready){
    publishedLink(result.url);
    setStatus('✅ बातमी वेबसाइटवर उपलब्ध आहे. आता लिंक WhatsApp वर शेअर करू शकता.');
   }else{
    setStatus('⚠️ GitHub मध्ये बातमी जतन झाली, परंतु सार्वजनिक HTML अजून उपलब्ध नाही. GitHub Actions पूर्ण झाल्यावर लिंक तपासा: '+result.url);
   }
  }catch(error){setStatus('❌ Publish अयशस्वी: '+error.message);}
  finally{publishing=false;$publish.disabled=false;}
 });
 $('live-copy').addEventListener('click',async()=>{
  const url=$('live-link').href;
  try{await navigator.clipboard.writeText(url);setStatus('✅ Live बातमीची लिंक कॉपी झाली.');}
  catch(e){setStatus('लिंक कॉपी होत नाही; कृपया दिसणारी लिंक कॉपी करा.');}
 });
 checkServer();
})();
