/**
 * Lokhit Maharashtra secure PIN + editorial selection backend.
 * PIN and GitHub credentials MUST be Cloudflare Worker secrets.
 * No PIN or GitHub credential may be committed into public GitHub Pages.
 */
const REPOSITORY="catonpe-droid/lokhit-maharashtra";
const REPO_API="https://api.github.com/repos/"+REPOSITORY;
const encoder=new TextEncoder(),decoder=new TextDecoder();
const b64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
function unbase64url(input){
 if(typeof input!=="string"||!/^[\w-]+$/.test(input))fail("अवैध Login माहिती.",401);
 return Uint8Array.from(atob(input.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(input.length/4)*4,"=")),x=>x.charCodeAt(0));
}
function fail(message,status=400){const err=new Error(message);err.httpStatus=status;throw err}
function response(data,status=200,headers={}){
 return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers}});
}
async function hash(value){return new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(value)))}
async function sameSecret(a,b){
 const [x,y]=await Promise.all([hash(a),hash(b)]);
 let diff=0;for(let i=0;i<32;i++)diff|=x[i]^y[i];
 return diff===0;
}
async function signingKey(env){
 return crypto.subtle.importKey("raw",encoder.encode(env.SESSION_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
async function signSession(env,user){
 const payload=b64url(encoder.encode(JSON.stringify({eid:user.id,name:user.name,exp:Date.now()+4*3600*1000})));
 const key=await signingKey(env);
 const signature=await crypto.subtle.sign("HMAC",key,encoder.encode(payload));
 return payload+"."+b64url(new Uint8Array(signature));
}
async function getSession(env,header){
 if(typeof header!=="string"||!header.startsWith("Bearer "))fail("PIN ने पुन्हा Login करा.",401);
 const t=header.slice(7).split(".");
 if(t.length!==2)fail("Login संपला आहे.",401);
 const key=await signingKey(env);
 let verified=false;
 try{verified=await crypto.subtle.verify("HMAC",key,unbase64url(t[1]),encoder.encode(t[0]))}catch{}
 if(!verified)fail("Login अवैध आहे.",401);
 let decoded;
 try{decoded=JSON.parse(decoder.decode(unbase64url(t[0])))}catch{fail("Login अवैध आहे.",401)}
 if(!Number.isInteger(decoded.eid)||decoded.eid<1||decoded.eid>10||typeof decoded.name!=="string"||!decoded.name||typeof decoded.exp!=="number"||decoded.exp<Date.now())fail("Login संपला आहे. PIN पुन्हा टाका.",401);
 return {id:decoded.eid,name:decoded.name};
}
async function getEditors(env){
 const file=await github(env,"/contents/content/editor-names.json?ref=main");
 const data=parseFile(file);
 if(!Array.isArray(data.editors)||data.editors.length!==10)fail("Editor यादी उपलब्ध नाही.",502);
 return data.editors.map((entry,i)=>({id:i+1,name:String(entry?.name||"Editor "+(i+1)).slice(0,70)}));
}
async function saveEditors(env,input){
 if(!Array.isArray(input?.editors)||input.editors.length!==10)fail("सर्व १० Editor नावे द्या.");
 const editors=input.editors.map((name,i)=>({id:i+1,name:String(name||"").trim().slice(0,70)}));
 if(editors.some(e=>!e.name))fail("Editor चे नाव रिकामे ठेवता येत नाही.");
 const file=await github(env,"/contents/content/editor-names.json?ref=main");
 await github(env,"/contents/content/editor-names.json","PUT",{
  branch:"main",sha:file.sha,message:"Update editorial display names",
  content:toBase64(JSON.stringify({version:1,editors},null,2)+"\n")
 });
 return {saved:true,editors};
}
async function validatePin(env,request,pin){
 if(!env.LOGIN_LIMITER?.limit)fail("सुरक्षित PIN Login अजून जोडलेला नाही.",503);
 const ip=request.headers.get("CF-Connecting-IP")||"unknown";
 const budget=await env.LOGIN_LIMITER.limit({key:"pin:"+ip});
 if(!budget.success)fail("खूप PIN प्रयत्न झाले. एक मिनिटानंतर पुन्हा प्रयत्न करा.",429);
 if(typeof pin!=="string"||!/^\d{6}$/.test(pin))fail("सहा अंकी PIN टाका.",401);
 if(!(await sameSecret(pin,env.EDITOR_PIN)))fail("PIN चुकीचा आहे.",401);
}
async function github(env,path,method="GET",payload){
 const r=await fetch(REPO_API+path,{method,headers:{
  "Accept":"application/vnd.github+json","Authorization":"Bearer "+env.GITHUB_TOKEN,
  "X-GitHub-Api-Version":"2022-11-28","User-Agent":"lokhit-maharashtra-editor",
  ...(payload?{"Content-Type":"application/json"}:{})
 },...(payload?{body:JSON.stringify(payload)}:{})});
 const body=await r.json().catch(()=>({}));
 if(!r.ok){
  if(r.status===404)fail("फाइल सापडली नाही.",404);
  if(r.status===409||r.status===422)fail("याच वेळी दुसरा बदल झाला. पान पुन्हा उघडून Save करा.",409);
  if(r.status===401||r.status===403)fail("Server ची GitHub प्रकाशन-परवानगी तपासणे आवश्यक आहे.",502);
  fail(body.message||"Server वर जतन होऊ शकले नाही.",502);
 }
 return body;
}
function toBase64(s){
 const bytes=enc.encode(s);let binary="";
 for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(binary);
}
function parseFile(file){
 if(!file?.content)fail("अवैध Server डेटा.",502);
 try{
  const bytes=Uint8Array.from(atob(file.content.replace(/\s/g,"")),c=>c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
 }catch{fail("Server डेटा वाचता आला नाही.",502)}
}
const isSlug=s=>typeof s==="string"&&/^[a-z0-9][a-z0-9_-]{2,110}$/i.test(s);
const safeFile=p=>["content/layout.json","site.json"].includes(p);
const jsonInput=async request=>{
 const len=Number(request.headers.get("content-length")||0);
 if(len>1500000)fail("फोटो किंवा बातमी खूप मोठी आहे.",413);
 let raw=await request.text();if(raw.length>1750000)fail("फोटो किंवा बातमी खूप मोठी आहे.",413);
 try{return JSON.parse(raw)}catch{fail("अवैध माहिती.",400)}
};
async function listPosts(env){
 const items=await github(env,"/contents/content/posts?ref=main");
 if(!Array.isArray(items))fail("बातम्या लोड होऊ शकल्या नाहीत.",502);
 const files=items.filter(x=>x.type==="file"&&x.name.endsWith(".json")).slice(0,150);
 const out=[];
 // Four concurrent outgoing requests: within Workers limits.
 for(let i=0;i<files.length;i+=4){
  const group=await Promise.all(files.slice(i,i+4).map(async f=>{
   const x=await github(env,"/contents/"+f.path+"?ref=main");
   return {...parseFile(x),_sha:x.sha,_path:f.path};
  }));
  out.push(...group);
 }
 return out.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
}
function requiredArticle(p){
 if(!p||typeof p!=="object")fail("बातमीची माहिती द्या.");
 if(!isSlug(p.slug))fail("बातमीचा URL/Slug इंग्रजीत लिहा (किमान 3 अक्षरे).");
 for(const [key,max] of [["title",180],["description",300],["body",100000],["category",90]]){
  if(typeof p[key]!=="string"||!p[key].trim()||p[key].length>max)fail("बातमीचे शीर्षक, सारांश, विभाग आणि मजकूर तपासा.");
 }
}
async function savePost(env,input,user){
 const p=input.article;
 requiredArticle(p);
 const path="content/posts/"+p.slug+".json";
 const now=new Date().toISOString();
 let existing=null;
 try{existing=await github(env,"/contents/"+path+"?ref=main")}catch(e){if(e.httpStatus!==404)throw e}
 let image=existing?parseFile(existing).image:"assets/img/logo.webp";
 if(input.image){
  if(input.image.type!=="image/jpeg"||typeof input.image.data!=="string"||input.image.data.length>1050000||!/^[a-zA-Z0-9+/=]+$/.test(input.image.data))fail("कृपया योग्य आकाराचा JPEG फोटो द्या (750 KB पर्यंत).");
  const imgpath="assets/img/"+p.slug+"-"+Date.now()+".jpg";
  await github(env,"/contents/"+imgpath,"PUT",{branch:"main",message:"Add news image "+p.slug,content:input.image.data});
  image=imgpath;
 }
 const old=existing?parseFile(existing):{};
 const item={
  slug:p.slug,title:p.title.trim(),description:p.description.trim(),
  category:p.category.trim(),body:p.body.trim(),image,
  author:user.name.slice(0,120),
  status:p.status==="draft"?"draft":"published",featured:!!p.featured,
  video:String(p.video||"").slice(0,600),
  date:old.date||now,updated:now,
  tags:Array.isArray(p.tags)?p.tags.slice(0,20):["महाराष्ट्र",p.category.trim()]
 };
 const payload={branch:"main",message:(existing?"Update ":"Publish ")+p.slug,content:toBase64(JSON.stringify(item,null,2)+"\n")};
 if(existing)payload.sha=existing.sha;
 await github(env,"/contents/"+path,"PUT",payload);
 return {saved:true,slug:p.slug,status:item.status,note:"बातमी जतन झाली; वेबसाइटचा स्वयंचलित Build सुरू होईल."};
}
async function deletePost(env,slug){
 if(!isSlug(slug))fail("Invalid article URL");
 const path="content/posts/"+slug+".json";
 const x=await github(env,"/contents/"+path+"?ref=main");
 await github(env,"/contents/"+path,"DELETE",{sha:x.sha,branch:"main",message:"Remove news "+slug});
 return {deleted:true,slug};
}
async function readJson(env,path){
 if(!safeFile(path))fail("अवैध सेटिंग्ज.");
 const file=await github(env,"/contents/"+path+"?ref=main");
 return {data:parseFile(file),sha:file.sha};
}
async function writeJson(env,path,raw){
 if(!safeFile(path))fail("अवैध सेटिंग्ज.");
 const file=await github(env,"/contents/"+path+"?ref=main");
 const current=parseFile(file);
 let updated;
 if(path==="site.json"){
  const fields=["name","tagline","description","editor_name","contact_email","youtube_live_url","youtube_live_provider","youtube_live_channel_id","youtube_live_channel_url","youtube_url","facebook_url","instagram_url","twitter_url"];
  updated={...current};
  for(const key of fields)if(typeof raw?.[key]==="string")updated[key]=raw[key].trim().slice(0,500);
  if(!updated.name)fail("वेबसाइटचे नाव आवश्यक आहे.");
 }else{
  if(!raw||!Array.isArray(raw.menu)||!Array.isArray(raw.slider)||!raw.breaking)fail("मेनू व स्लायडर डेटा अपूर्ण.");
  const menu=raw.menu.slice(0,24).map(x=>({
   title:String(x.title||"").trim().slice(0,65),
   href:String(x.href||"").trim(),
   enabled:x.enabled!==false
  }));
  if(menu.some(m=>!m.title||!(/^[a-zA-Z0-9_/-]*$/.test(m.href))||m.href.includes("..")||m.href.startsWith("/")))fail("मेनूच्या लिंक तपासा.");
  const slider=raw.slider.slice(0,12).filter(x=>isSlug(x.slug)).map(x=>({
   slug:x.slug,title:String(x.title||"").slice(0,160),enabled:x.enabled!==false
  }));
  const custom=(Array.isArray(raw.breaking.custom)?raw.breaking.custom:[]).slice(0,12).map(x=>String(x).slice(0,170)).filter(Boolean);
  updated={...current,version:2,menu,slider,slider_seconds:Math.max(3,Math.min(15,Number(raw.slider_seconds)||6)),
   breaking:{enabled:raw.breaking.enabled!==false,mode:raw.breaking.mode==="custom"?"custom":"latest",custom}};
 }
 await github(env,"/contents/"+path,"PUT",{branch:"main",sha:file.sha,message:"Update "+path+" via editor",content:toBase64(JSON.stringify(updated,null,2)+"\n")});
 return {saved:true};
}

export default {
 async fetch(request,env){
  const origin=request.headers.get("Origin")||"";
  const allowed=String(env.SITE_ORIGINS||"https://catonpe-droid.github.io").split(",").map(x=>x.trim());
  const cors=allowed.includes(origin)?{
   "Access-Control-Allow-Origin":origin,"Vary":"Origin",
   "Access-Control-Allow-Headers":"Authorization, Content-Type",
   "Access-Control-Allow-Methods":"GET, POST, PUT, DELETE, OPTIONS"
  }:{};
  if(origin&&!allowed.includes(origin))return response({error:"या वेबसाइटवरून Login करता येत नाही."},403);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  try{
   const url=new URL(request.url),path=url.pathname;
   const configured=!!(env.EDITOR_PIN&&env.SESSION_SECRET&&env.GITHUB_TOKEN&&env.LOGIN_LIMITER);
   if(path==="/status"&&request.method==="GET")return response({configured,editorCount:10},200,cors);
   if(!configured)fail("PIN Server ची एकदाची जोडणी अजून बाकी आहे.",503);
   if(path==="/editors"&&request.method==="GET")return response({editors:await getEditors(env)},200,cors);
   if(path==="/login"&&request.method==="POST"){
    const input=await jsonInput(request);
    await validatePin(env,request,input.pin);
    const editors=await getEditors(env),user=editors.find(e=>e.id===Number(input.editor));
    if(!user)fail("Editor निवडा.",400);
    return response({authenticated:true,editor:user,session:await signSession(env,user)},200,cors);
   }
   const user=await getSession(env,request.headers.get("Authorization"));
   if(path==="/session"&&request.method==="GET")return response({authenticated:true,editor:user},200,cors);
   if(path==="/editor-names"&&request.method==="PUT")return response(await saveEditors(env,await jsonInput(request)),200,cors);
   if(path==="/posts"&&request.method==="GET")return response({posts:await listPosts(env)},200,cors);
   if(path==="/post"&&request.method==="PUT")return response(await savePost(env,await jsonInput(request),user),200,cors);
   if(path==="/post"&&request.method==="DELETE")return response(await deletePost(env,url.searchParams.get("slug")),200,cors);
   if(path==="/file"&&request.method==="GET")return response(await readJson(env,url.searchParams.get("path")),200,cors);
   if(path==="/file"&&request.method==="PUT"){
    const input=await jsonInput(request);
    return response(await writeJson(env,input.path,input.data),200,cors);
   }
   return response({error:"अवैध विनंती."},404,cors);
  }catch(e){return response({error:String(e.message||"Server समस्या")},e.httpStatus||500,cors)}
 }
};
