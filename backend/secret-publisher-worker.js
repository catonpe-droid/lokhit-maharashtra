/**
 * Lokhit Maharashtra — no-login secret-link news publisher.
 * Deploy as a FREE Cloudflare Worker. Credentials are Worker secrets only.
 * A hidden page by itself is NOT authentication; the #key fragment in the
 * publisher URL is checked here (it is never committed to the repository).
 */
const REPO = "catonpe-droid/lokhit-maharashtra";
const API = "https://api.github.com/repos/" + REPO + "/contents/";
const SITE = "https://catonpe-droid.github.io/lokhit-maharashtra/";
const ORIGIN = "https://catonpe-droid.github.io";
const MAX_REQUEST = 2900000;
const encoder = new TextEncoder();

const CATEGORIES = new Set([
  "महाराष्ट्र","मराठवाडा","विदर्भ","पश्चिम महाराष्ट्र","कोकण",
  "दुष्काळ विशेष","शेती","शासन योजना","पशुसंवर्धन","पाणी",
  "रोजगार","ग्रामविकास","महिला व विकास","अर्थकारण","राजकारण",
  "समाज","शिक्षण","आरोग्य","विश्लेषण"
]);

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}
async function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const parts = await Promise.all([a,b].map(s => crypto.subtle.digest("SHA-256",encoder.encode(s))));
  const left = new Uint8Array(parts[0]), right = new Uint8Array(parts[1]);
  let different = 0;
  for (let i = 0; i < left.length; i++) different |= left[i] ^ right[i];
  return different === 0;
}
function clean(value, max) {
  return String(value || "").replace(/\r\n?/g,"\n").trim().slice(0,max);
}
function encodeBase64(input) {
  const bytes = encoder.encode(input);
  let binary = "";
  for(let i=0;i<bytes.length;i+=8192) {
    binary += String.fromCharCode(...bytes.subarray(i,i+8192));
  }
  return btoa(binary);
}
async function github(env, path, content, commitMessage) {
  const response = await fetch(API + path, {
    method: "PUT",
    headers: {
      "Accept":"application/vnd.github+json",
      "Authorization":"Bearer " + env.GITHUB_TOKEN,
      "X-GitHub-Api-Version":"2022-11-28",
      "User-Agent":"lokhit-simple-news-publisher",
      "Content-Type":"application/json"
    },
    body: JSON.stringify({
      branch:"main",
      message:commitMessage,
      content:content
    })
  });
  const payload = await response.json().catch(() => ({}));
  if(!response.ok) {
    if(response.status === 401 || response.status === 403) fail("GitHub प्रकाशन परवानगी उपलब्ध नाही.",502);
    if(response.status === 409 || response.status === 422) fail("बातमी जतन करताना GitHub संघर्ष झाला. पुन्हा प्रयत्न करा.",409);
    fail("GitHub जतन अयशस्वी: " + String(payload.message || response.status).slice(0,130),502);
  }
}
function validateImage(raw) {
  if(raw === undefined || raw === null || raw === "") return "";
  if(typeof raw !== "string" || raw.length > 1050000 ||
     !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) fail("फोटो खूप मोठा किंवा अवैध आहे.",413);
  try {
    const first = atob(raw.slice(0,40));
    if(first.charCodeAt(0)!==255 || first.charCodeAt(1)!==216 || first.charCodeAt(2)!==255) {
      fail("JPEG फोटो आवश्यक आहे.");
    }
  } catch(e) {
    if(e.status) throw e;
    fail("फोटो अवैध आहे.");
  }
  return raw;
}
async function publish(env, request) {
  const auth = request.headers.get("Authorization") || "";
  const supplied = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if(!(await sameSecret(supplied,env.PUBLISH_KEY))) fail("गुप्त प्रकाशन लिंक चुकीची आहे.",401);
  const length = Number(request.headers.get("content-length") || "0");
  if(length > MAX_REQUEST) fail("बातमी किंवा फोटोचा आकार जास्त आहे.",413);
  const raw = await request.text();
  if(encoder.encode(raw).byteLength > MAX_REQUEST) fail("बातमी किंवा फोटोचा आकार जास्त आहे.",413);
  let input;
  try { input = JSON.parse(raw); } catch { fail("बातमीची माहिती चुकीची आहे."); }
  if(!input || typeof input!=="object" || Array.isArray(input)) fail("बातमीची माहिती चुकीची आहे.");
  const title = clean(input.title,180);
  const body = clean(input.body,50000);
  const author = clean(input.author,90) || "लोकहित महाराष्ट्र डिजिटल डेस्क";
  const category = clean(input.category,80);
  let description = clean(input.description,300);
  if(!description) description = body.replace(/[#*_~\[\]]/g,"").replace(/\s+/g," ").slice(0,180);
  if(title.length<8 || body.length<30) fail("योग्य शीर्षक आणि किमान ३० अक्षरांची बातमी लिहा.");
  if(!(await isAllowedCategory(env,category))) fail("बातमीचा योग्य विभाग निवडा.");
  const photo = validateImage(input.photo);
  const now = new Date().toISOString();
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(5)),b=>b.toString(16).padStart(2,"0")).join("");
  const slug = "news-" + now.replace(/\D/g,"").slice(0,14) + "-" + nonce;
  let image = "assets/img/logo.webp";
  if(photo) {
    image = "assets/img/" + slug + ".jpg";
    await github(env,image,photo,"Add news photo " + slug);
  }
  const item = {
    slug,title,description,category,body,image,author,
    status:"published",featured:false,video:"",
    date:now,updated:now,tags:["महाराष्ट्र",category]
  };
  await github(env,"content/posts/" + slug + ".json",encodeBase64(JSON.stringify(item,null,2)+"\n"),"Publish news " + slug);
  return {saved:true,status:"building",slug,url:SITE+"batmi/"+slug+"/"};
}

/* Admin Studio API v2: title library, edit, draft, photo update and deletion.
 * All mutation/list/read endpoints require the same high-entropy PUBLISH_KEY.
 * GitHub token remains a Worker secret; no credentials are sent to GitHub Pages.
 */
const slugAllowed=s=>typeof s==="string"&&/^[a-z0-9][a-z0-9_-]{2,115}$/.test(s);
async function githubRequest(env,path,method="GET",body){
  const headers={
    "Accept":"application/vnd.github+json",
    "Authorization":"Bearer "+env.GITHUB_TOKEN,
    "X-GitHub-Api-Version":"2022-11-28",
    "User-Agent":"lokhit-news-admin-studio"
  };
  if(body)headers["Content-Type"]="application/json";
  const r=await fetch("https://api.github.com/repos/"+REPO+"/"+path,{
    method,headers,...(body?{body:JSON.stringify(body)}:{})
  });
  let data;
  try{data=await r.json()}catch{data={}}
  if(!r.ok){
    if(r.status===404)fail("बातमी / फाइल सापडली नाही.",404);
    if(r.status===409||r.status===422)fail("GitHub वर एकाच वेळी बदल झाले. पान Refresh करून पुन्हा प्रयत्न करा.",409);
    if(r.status===401||r.status===403)fail("GitHub Token किंवा Contents Read & Write permission तपासा.",502);
    fail("GitHub: "+String(data.message||r.status).slice(0,170),502);
  }
  return data;
}
function decodeGitHub(file){
  if(!file||typeof file.content!=="string")fail("GitHub फाइलचा मजकूर उपलब्ध नाही.",502);
  try{
    const chars=atob(file.content.replace(/\s/g,""));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(chars,c=>c.charCodeAt(0))));
  }catch{fail("GitHub JSON फाइल वाचता आली नाही.",502)}
}
async function getArticle(env,slug){
  if(!slugAllowed(slug))fail("बातमीचा URL अवैध आहे.");
  const file=await githubRequest(env,"contents/content/posts/"+encodeURIComponent(slug)+".json?ref=main");
  return {article:decodeGitHub(file),sha:file.sha};
}
async function listArticles(env,url){
  const page=Math.max(1,Math.min(500,Number.parseInt(url.searchParams.get("page")||"1",10)||1));
  const limit=Math.max(1,Math.min(24,Number.parseInt(url.searchParams.get("limit")||"24",10)||24));
  const entries=await githubRequest(env,"contents/content/posts?ref=main");
  if(!Array.isArray(entries))fail("बातम्यांची यादी उपलब्ध नाही.",502);
  // Include draft source files, unlike cms-export.json which includes published only.
  const files=entries.filter(x=>x.type==="file"&&/^[a-z0-9][a-z0-9_-]*\.json$/.test(x.name)).sort((a,b)=>b.name.localeCompare(a.name));
  const start=(page-1)*limit;
  const selected=files.slice(start,start+limit);
  const items=[];
  // Work within Cloudflare's free-tier outbound-subrequest limits.
  for(let offset=0;offset<selected.length;offset+=5){
    const part=await Promise.all(selected.slice(offset,offset+5).map(async file=>{
      try{
        const item=decodeGitHub(await githubRequest(env,"contents/"+file.path+"?ref=main"));
        return {
          slug:clean(item.slug,120)||file.name.slice(0,-5),
          title:clean(item.title,180),category:clean(item.category,80),
          status:item.status==="draft"?"draft":"published",
          author:clean(item.author,90),date:clean(item.date,40),updated:clean(item.updated,40),
          featured:!!item.featured
        };
      }catch(e){return null}
    }));
    items.push(...part.filter(Boolean));
  }
  items.sort((a,b)=>String(b.updated||b.date).localeCompare(String(a.updated||a.date)));
  return {posts:items,page,limit,total:files.length,hasMore:start+limit<files.length};
}
async function safeRichDelta(env,slug,value){
  if(value===null||value===undefined)return null;
  if(!Array.isArray(value)||value.length>2000)fail("Rich Text आकार अवैध आहे.");
  const output=[];
  let total=0,images=0;
  const safeImage=/^assets\/img\/(?!.*\.\.)[A-Za-z0-9_./-]+\.(?:jpe?g|png|webp)$/i;
  for(const op of value){
    if(!op||typeof op!=="object")continue;
    const insert=op.insert;
    let cleanOp;
    if(typeof insert==="string"){
      total+=insert.length;if(total>80000)fail("Rich Text खूप मोठा आहे.");
      cleanOp={insert};
      if(op.attributes&&typeof op.attributes==="object"){
        const a={},old=op.attributes;
        for(const field of ["bold","italic","underline","strike","blockquote"]){
          if(old[field]===true)a[field]=true;
        }
        if([2,3].includes(Number(old.header)))a.header=Number(old.header);
        if(["bullet","ordered"].includes(old.list))a.list=old.list;
        if(typeof old.link==="string"&&old.link.length<=1000){
          try{
            const u=new URL(old.link);
            if(u.protocol==="https:"&&!u.username&&!u.password)a.link=old.link;
          }catch{}
        }
        if(Object.keys(a).length)cleanOp.attributes=a;
      }
    }else if(insert&&typeof insert==="object"&&typeof insert.image==="string"){
      images++;if(images>4)fail("मजकुरात जास्तीत जास्त ४ फोटो घाला.");
      let image=insert.image;
      if(image.startsWith("data:image/jpeg;base64,")){
        const jpeg=image.slice("data:image/jpeg;base64,".length);
        if(jpeg.length>380000)fail("मजकुरातील फोटोचा आकार मोठा आहे.",413);
        validateImage(jpeg);
        const random=Array.from(crypto.getRandomValues(new Uint8Array(3)),v=>v.toString(16).padStart(2,"0")).join("");
        const name="assets/img/"+slug+"-inline-"+Date.now()+"-"+images+"-"+random+".jpg";
        await githubRequest(env,"contents/"+name,"PUT",{branch:"main",message:"Add inline news image "+slug,content:jpeg});
        image=name;
      }else if(!safeImage.test(image)){
        fail("मजकुरात फक्त या वेबसाइटवर साठवलेले फोटो वापरा.");
      }
      cleanOp={insert:{image}};
    }else if(insert&&typeof insert==="object"&&typeof insert.video==="string"){
      // Video embed URLs are converted into safe youtube-nocookie frames by rich_renderer.py.
      try{
        const u=new URL(insert.video);
        if(u.protocol!=="https:"||u.hostname!=="www.youtube-nocookie.com"||!/^\/embed\/[A-Za-z0-9_-]{11}$/.test(u.pathname))continue;
        cleanOp={insert:{video:u.origin+u.pathname}};
      }catch{continue}
    }else continue;
    output.push(cleanOp);
  }
  return output;
}
async function isAllowedCategory(env,category){
  if(CATEGORIES.has(category))return true;
  try{
    const file=await githubRequest(env,"contents/content/layout.json?ref=main");
    const settings=decodeGitHub(file);
    return Array.isArray(settings.categories)&&settings.categories.some(x=>x&&x.name===category);
  }catch{return false}
}

async function saveArticle(env,request){
  const raw=await request.text();
  if(encoder.encode(raw).byteLength>MAX_REQUEST)fail("बातमी / फोटो खूप मोठा आहे.",413);
  let input;
  try{input=JSON.parse(raw)}catch{fail("बातमीची माहिती चुकीची आहे.")}
  const p=input?.article;
  if(!p||typeof p!=="object"||Array.isArray(p))fail("बातमीचा डेटा अपूर्ण आहे.");
  const title=clean(p.title,180),body=clean(p.body,50000),category=clean(p.category,80);
  if(title.length<8||body.length<30)fail("योग्य शीर्षक आणि किमान ३० अक्षरांची बातमी आवश्यक आहे.");
  if(!(await isAllowedCategory(env,category)))fail("योग्य विभाग निवडा.");
  const video=clean(p.video,400);
  if(video){
    let u;try{u=new URL(video)}catch{fail("YouTube ची योग्य URL द्या.")}
    if(u.protocol!=="https:"||!["youtube.com","www.youtube.com","m.youtube.com","youtu.be","www.youtube-nocookie.com"].includes(u.hostname))fail("फक्त अधिकृत YouTube लिंक वापरा.");
  }
  const photo=validateImage(input.photo);
  const now=new Date().toISOString();
  let slug=clean(p.slug,120),file=null,old={};
  if(slug){
    if(!slugAllowed(slug))fail("बातमीचा URL अवैध आहे.");
    file=await githubRequest(env,"contents/content/posts/"+encodeURIComponent(slug)+".json?ref=main");
    if(!p.expected_sha||p.expected_sha!==file.sha)fail("ही बातमी दुसऱ्या ठिकाणी बदलली आहे. Refresh करून पुन्हा Edit करा.",409);
    old=decodeGitHub(file);
  }else{
    const nonce=Array.from(crypto.getRandomValues(new Uint8Array(6)),x=>x.toString(16).padStart(2,"0")).join("");
    slug="news-"+now.replace(/\D/g,"").slice(0,14)+"-"+nonce;
  }
  let image=old.image||"assets/img/logo.webp";
  if(photo){
    image="assets/img/"+slug+"-"+Date.now()+".jpg";
    await githubRequest(env,"contents/"+image,"PUT",{branch:"main",message:"Update news cover "+slug,content:photo});
  }
  const changed=!file||p.body_changed===true;
  const cleanDelta=changed?await safeRichDelta(env,slug,p.rich_delta):undefined;
  const item={
    ...old,
    slug,title,description:clean(p.description,300)||body.replace(/[#*_~\[\]]/g,"").replace(/\s+/g," ").slice(0,180),
    category,
    body:changed?body:old.body,
    image,author:clean(p.author,90)||"लोकहित महाराष्ट्र डिजिटल डेस्क",
    status:p.status==="draft"?"draft":"published",
    featured:p.featured===true,
    video,
    tags:Array.isArray(p.tags)?p.tags.map(x=>clean(x,50)).filter(Boolean).slice(0,15):[],
    date:old.date||now,updated:now
  };
  if(changed){
    if(cleanDelta!==null&&cleanDelta!==undefined)item.rich_delta=cleanDelta;
    else delete item.rich_delta;
  }
  const data={branch:"main",message:(file?"Update ":"Publish ")+slug,
    content:encodeBase64(JSON.stringify(item,null,2)+"\n")};
  if(file)data.sha=file.sha;
  const saved=await githubRequest(env,"contents/content/posts/"+slug+".json","PUT",data);
  return {saved:true,slug,status:item.status,sha:saved.content?.sha||"",date:item.date,url:SITE+"batmi/"+slug+"/"};
}
async function deleteArticle(env,request){
  const raw=await request.text();
  if(raw.length>1000)fail("अवैध विनंती.");
  let data;try{data=JSON.parse(raw)}catch{fail("Delete डेटा चुकीचा आहे.")}
  const slug=clean(data?.slug,120);
  if(!slugAllowed(slug))fail("अवैध बातमी URL.");
  const old=await githubRequest(env,"contents/content/posts/"+encodeURIComponent(slug)+".json?ref=main");
  if(!data?.expected_sha||data.expected_sha!==old.sha)fail("बातमी बदलली आहे. Refresh करून पुन्हा प्रयत्न करा.",409);
  await githubRequest(env,"contents/content/posts/"+slug+".json","DELETE",{
    branch:"main",sha:old.sha,message:"Delete news "+slug
  });
  return {deleted:true,slug};
}

async function readLayout(env){
  const file=await githubRequest(env,"contents/content/layout.json?ref=main");
  return {layout:decodeGitHub(file),sha:file.sha};
}
async function saveLayout(env,request){
  const raw=await request.text();
  if(raw.length>40000)fail("मेनूचा डेटा खूप मोठा आहे.",413);
  let input;
  try{input=JSON.parse(raw)}catch{fail("मेनू डेटा चुकीचा आहे.")}
  const file=await githubRequest(env,"contents/content/layout.json?ref=main");
  if(!input.expected_sha||input.expected_sha!==file.sha)fail("मेनू आधीच बदलला आहे. Refresh करा.",409);
  const current=decodeGitHub(file),p=input.layout;
  if(!p||!Array.isArray(p.menu)||!Array.isArray(p.slider)||!p.breaking)fail("मेनू, स्लायडर किंवा ब्रेकिंग न्यूज अपूर्ण.");
  const menu=p.menu.slice(0,24).map(x=>({
    title:clean(x.title,65),href:clean(x.href,150),enabled:x.enabled!==false
  }));
  if(menu.some(m=>!m.title||!(/^[a-zA-Z0-9_/-]*$/.test(m.href))||m.href.includes("..")||m.href.startsWith("/")))fail("मेनूच्या लिंक तपासा.");
  const slider=p.slider.slice(0,12).filter(x=>slugAllowed(x.slug)).map(x=>({
    slug:x.slug,title:clean(x.title,160),enabled:x.enabled!==false
  }));
  const breaking={
    enabled:p.breaking.enabled!==false,
    mode:p.breaking.mode==="custom"?"custom":"latest",
    custom:(Array.isArray(p.breaking.custom)?p.breaking.custom:[]).slice(0,12).map(x=>clean(x,170)).filter(Boolean)
  };
  // Existing layout fields stay backward compatible; these additional settings
  // allow a publisher to hide modules and manage new categories without code edits.
  const categories=Array.isArray(p.categories)?p.categories.slice(0,40).map(c=>({
    name:clean(c.name,65),label:clean(c.label||c.name,65),
    slug:clean(c.slug,65).toLowerCase()
  })):current.categories||[];
  if(!Array.isArray(categories)||!categories.length)fail("किमान एक Category आवश्यक आहे.");
  if(categories.some(c=>!c.name||!c.label||!c.slug||!/^[a-z0-9][a-z0-9-]{1,64}$/.test(c.slug))||
    new Set(categories.map(c=>c.name)).size!==categories.length||
    new Set(categories.map(c=>c.slug)).size!==categories.length){
    fail("Category नावे किंवा URL slug चुकीचे/दुबार आहेत.");
  }
  const homeIn=p.homepage&&typeof p.homepage==="object"?p.homepage:current.homepage||{};
  const defaults={
    latest:{enabled:true,title:"ताज्या बातम्या"},
    gov_links:{enabled:true},drought_news:{enabled:true,title:"दुष्काळ विशेष"},
    drought_banner:{enabled:false,title:"दुष्काळ विशेष : माहिती, मदत आणि मार्गदर्शन",description:"पाणी, चारा, कर्ज, शेतकरी मदत व रोजगाराच्या बातम्या एकाच ठिकाणी"},
    live_tv:{enabled:false},more:{enabled:true,title:"अधिक बातम्या"}
  };
  const homepage={};
  for(const k of Object.keys(defaults)){
    const old=homeIn[k]&&typeof homeIn[k]==="object"?homeIn[k]:defaults[k];
    homepage[k]={
      enabled:old.enabled===true,
      ...(defaults[k].title!==undefined?{title:clean(old.title||defaults[k].title,k==="drought_banner"?130:65)}:{}),
      ...(k==="drought_banner"?{description:clean(old.description||defaults[k].description,250)}:{})
    };
  }
  const choices=new Set([...categories.map(c=>c.name),...CATEGORIES]);
  homepage.category_blocks=(Array.isArray(homeIn.category_blocks)?homeIn.category_blocks:[]).slice(0,20)
    .filter(x=>x&&choices.has(x.category)).map(x=>({
      category:clean(x.category,65),title:clean(x.title,65),enabled:x.enabled!==false
    }));
  const updated={...current,version:3,menu,slider,breaking,categories,homepage,
    slider_seconds:Math.max(3,Math.min(15,Number(p.slider_seconds)||6))};
  const result=await githubRequest(env,"contents/content/layout.json","PUT",{
    branch:"main",sha:file.sha,message:"Update menu slider breaking news via News Admin",
    content:encodeBase64(JSON.stringify(updated,null,2)+"\n")
  });
  return {saved:true,sha:result.content?.sha||"",layout:updated};
}

async function checkEditorKey(env,request){
  const h=request.headers.get("Authorization")||"";
  const supplied=h.startsWith("Bearer ")?h.slice(7):"";
  if(!(await sameSecret(supplied,env.PUBLISH_KEY)))fail("गुप्त प्रकाशन लिंक चुकीची आहे.",401);
}

export default {
  async fetch(request,env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = String(env.ALLOWED_ORIGIN || ORIGIN);
    const cors = origin===allowed ? {
      "Access-Control-Allow-Origin":origin,
      "Vary":"Origin",
      "Access-Control-Allow-Headers":"Authorization, Content-Type",
      "Access-Control-Allow-Methods":"GET, POST, OPTIONS"
    } : {};
    if(origin && origin!==allowed) return json({error:"अवैध वेबसाइट विनंती."},403);
    if(request.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
    const url = new URL(request.url);
    if(url.pathname==="/health" && request.method==="GET") {
      return json({ready:!!(env.GITHUB_TOKEN && env.PUBLISH_KEY),features:["publish","editor","list","edit","draft","delete","layout","homepage","categories"]},200,cors);
    }
    const route=url.pathname,method=request.method;
    const valid=(route==="/publish"&&method==="POST")||
      (route==="/list"&&method==="GET")||
      (route==="/article"&&method==="GET")||
      (route==="/save"&&method==="POST")||
      (route==="/delete"&&method==="POST")||
      (route==="/layout"&&["GET","POST"].includes(method));
    if(!valid)return json({error:"अवैध विनंती."},404,cors);
    if(!env.GITHUB_TOKEN || !env.PUBLISH_KEY || env.PUBLISH_KEY.length<32) {
      return json({error:"प्रकाशन सेवा अद्याप सक्रिय नाही."},503,cors);
    }
    try {
      if(route==="/publish")return json(await publish(env,request),202,cors);
      await checkEditorKey(env,request);
      if(route==="/list")return json(await listArticles(env,url),200,cors);
      if(route==="/article")return json(await getArticle(env,url.searchParams.get("slug")),200,cors);
      if(route==="/save")return json(await saveArticle(env,request),200,cors);
      if(route==="/delete")return json(await deleteArticle(env,request),200,cors);
      if(route==="/layout"&&method==="GET")return json(await readLayout(env),200,cors);
      if(route==="/layout"&&method==="POST")return json(await saveLayout(env,request),200,cors);
      return json({error:"अवैध विनंती."},404,cors);
    }catch(e){
      return json({error:e.message || "बातमी जतन करता आली नाही."},e.status || 500,cors);
    }
  }
};
