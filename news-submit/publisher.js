'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const SITE = 'https://catonpe-droid.github.io/lokhit-maharashtra/';
  // Read the whole #key= fragment, not URLSearchParams: a + sign in a
  // password must remain + (URLSearchParams would silently turn it into a space).
  function getPublishKey() {
    const fragment = location.hash || '';
    if(!fragment.startsWith('#key=')) return '';
    const raw = fragment.slice(5);
    try { return decodeURIComponent(raw).trim(); }
    catch { return raw.trim(); }
  }
  const key = getPublishKey();
  let worker = '',busy = false, publishedUrl = '',previewObjectURL = '';

  function notice(text, kind = 'info') {
    const node = $('status');
    node.style.display = 'block';
    node.className = kind;
    node.textContent = text;
  }
  function validateLink(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' &&
        u.hostname.endsWith('.workers.dev') ||
        (u.protocol === 'https:' && u.hostname !== location.hostname);
    } catch { return false; }
  }
  async function init() {
    $('publish-button').disabled = true;
    try {
      const response = await fetch('./config.json', {cache:'no-store'});
      if(!response.ok) throw Error('सुरक्षित प्रकाशन जोडणी उपलब्ध नाही.');
      const cfg = await response.json();
      worker = String(cfg.worker_url || '').trim().replace(/\/+$/,'');
      if(!worker || !validateLink(worker)) {
        notice('हा फॉर्म तयार आहे. एकदाची सुरक्षित प्रकाशन जोडणी अजून बाकी आहे. बातमीचे पूर्वावलोकन वापरता येईल.','info');
        return;
      }
      if(key.length < 32) {
        notice('हा प्रकाशन फॉर्म गुप्त लिंकवरच चालतो. पूर्ण गुप्त लिंक वापरून पान उघडा.','error');
        return;
      }
      const check = await fetch(worker + '/health', {cache:'no-store'});
      const state = await check.json();
      if(!check.ok || !state.ready) throw Error('सुरक्षित प्रकाशन सेवा अजून सक्रिय नाही.');
      $('publish-button').disabled = false;
      notice('✅ फॉर्म तयार आहे. बातमी भरा आणि Publish दाबा.','ok');
    } catch(e) {
      notice('प्रकाशन सेवा जोडता आली नाही: ' + e.message,'error');
    }
  }
  function articleInput() {
    return {
      title:$('title').value.trim(),
      category:$('category').value,
      body:$('body').value.trim(),
      author:$('author').value.trim()
    };
  }
  function imagePreview() {
    const file = $('photo').files[0];
    if(previewObjectURL) URL.revokeObjectURL(previewObjectURL);
    previewObjectURL = file ? URL.createObjectURL(file) : '';
    const img = $('photo-preview');
    img.src = previewObjectURL || '';
    img.style.display = file ? 'block' : 'none';
  }
  $('photo').addEventListener('change',imagePreview);
  function showPreview() {
    if(!$('title').value.trim() || !$('body').value.trim()) {
      notice('पूर्वावलोकनासाठी शीर्षक आणि बातमी लिहा.','error');
      return;
    }
    $('preview-title').textContent = $('title').value.trim();
    $('preview-category').textContent = $('category').value || 'विभाग';
    $('preview-body').textContent = $('body').value.trim();
    const img = $('preview-photo');
    img.src = previewObjectURL || '';
    img.hidden = !previewObjectURL;
    $('preview-dialog').showModal();
  }
  $('preview-button').addEventListener('click',showPreview);
  $('preview-close').addEventListener('click',() => $('preview-dialog').close());

  async function photoAsJPEG(file) {
    if(!file)return '';
    if(file.size > 12*1024*1024) throw Error('फोटो १२ MB पेक्षा लहान हवा.');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw Error('JPG, PNG किंवा WebP फोटो निवडा.');
    const bmp = await createImageBitmap(file);
    try {
      const scale = Math.min(1,1400/Math.max(bmp.width,bmp.height));
      let w = Math.max(1,Math.round(bmp.width*scale)),h = Math.max(1,Math.round(bmp.height*scale));
      let quality=.82;
      for(let i=0;i<14;i++){
        const canvas = document.createElement('canvas');
        canvas.width=w;canvas.height=h;
        const ctx=canvas.getContext('2d');
        ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
        ctx.drawImage(bmp,0,0,w,h);
        const b64=canvas.toDataURL('image/jpeg',quality).split(',')[1] || '';
        if(b64 && b64.length<=920000) return b64;
        w=Math.max(200,Math.round(w*.82));h=Math.max(150,Math.round(h*.82));
        quality=Math.max(.56,quality-.03);
      }
      throw Error('फोटोचा आकार कमी करता आला नाही. दुसरा फोटो वापरा.');
    } finally { bmp.close?.(); }
  }
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function waitForPage(url,title) {
    for(let i=0;i<25;i++){
      try {
        const res = await fetch(url + '?v=' + Date.now(), {cache:'no-store'});
        if(res.ok) {
          const html = await res.text();
          const doc = new DOMParser().parseFromString(html,'text/html');
          const siteTitle=doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
          const h1=doc.querySelector('h1')?.textContent || '';
          if(siteTitle.trim()===title || h1.trim()===title) return true;
        }
      } catch {}
      await sleep(3000);
    }
    return false;
  }
  function showResult(url, live) {
    $('published').style.display='block';
    $('published-heading').textContent = live ? '✅ बातमी प्रकाशित झाली!' : '✅ बातमी जतन झाली; HTML पान तयार होत आहे';
    $('published-note').textContent = live
      ? 'लिंक तयार आहे. ती WhatsApp वर पाठवू शकता.'
      : 'GitHub Pages वर नवीन HTML उपलब्ध झाल्यावर हीच लिंक उघडेल.';
    $('published-url').href=url;
    $('published-url').textContent=url;
    $('share-link').href='https://api.whatsapp.com/send?text=' + encodeURIComponent($('title').value.trim()+'\n'+url);
    publishedUrl=url;
  }
  $('copy-button').addEventListener('click',async () => {
    if(!publishedUrl)return;
    try { await navigator.clipboard.writeText(publishedUrl); notice('✅ बातमीची लिंक कॉपी झाली.','ok'); }
    catch { notice('लिंक कॉपी करता आली नाही. वर दिलेली लिंक कॉपी करा.','error'); }
  });
  $('news-form').addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy)return;
    if(!worker || key.length<32) {
      notice('गुप्त प्रकाशन लिंक आणि प्रकाशन सेवा एकदाच सक्रिय करणे आवश्यक आहे.','error');
      return;
    }
    if(!$('news-form').reportValidity())return;
    const data=articleInput();
    if(data.title.length<8 || data.body.length<30) {
      notice('शीर्षक आणि किमान ३० अक्षरांची बातमी लिहा.','error');
      return;
    }
    busy=true;$('publish-button').disabled=true;$('published').style.display='none';
    try {
      notice('फोटो तयार करत आहे आणि बातमी GitHub वर सुरक्षितपणे जतन करत आहे…','info');
      data.photo=await photoAsJPEG($('photo').files[0]);
      const response=await fetch(worker+'/publish',{
        method:'POST',cache:'no-store',
        headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
        body:JSON.stringify(data)
      });
      const output=await response.json().catch(()=>({}));
      if(!response.ok || !output.saved) {
        if(response.status===401) throw Error('गुप्त Key जुळत नाही. Cloudflare मधील PUBLISH_KEY रीसेट करा आणि त्या नवीन Key सह #key= लिंक उघडा. Key कोणालाही पाठवू नका.');
        throw Error(output.error || 'बातमी जतन झाली नाही.');
      }
      if(!/^news-[a-z0-9-]{10,50}$/.test(output.slug||'')) throw Error('सर्व्हरकडून अवैध बातमी क्रमांक आला.');
      const url=SITE+'batmi/'+output.slug+'/';
      showResult(url,false);
      notice('✅ बातमी GitHub वर जतन झाली. HTML पान प्रकाशित होत आहे…','info');
      const live=await waitForPage(url,data.title);
      showResult(url,live);
      notice(live?'✅ HTML बातमी Live झाली. लिंक शेअर करा.':'✅ बातमी जतन झाली. HTML पान तयार होण्याची प्रक्रिया सुरू आहे. लिंक उघडून तपासा.', live?'ok':'info');
    } catch(e) {
      notice('बातमी प्रकाशित करता आली नाही: '+e.message,'error');
    } finally {
      busy=false;
      $('publish-button').disabled=false;
    }
  });
  init();
})();
