/**
 * Lokhit Maharashtra Google Sign-In publisher
 * Free Cloudflare Worker. GitHub credential remains ONLY in Worker secret.
 * Browser only receives Google ID token. No public passwords or hard-coded keys.
 */
const REPOSITORY="catonpe-droid/lokhit-maharashtra";
const REPO_API="https://api.github.com/repos/"+REPOSITORY;
const GOOGLE_CERTS="https://www.googleapis.com/oauth2/v3/certs";
const APPROVED_EMAIL_SHA256="b79b4e70be6ad43ac640aec6c8c97fb04713e7ddcb24ded424331dbee9867dd9";
const TXT="application/json; charset=utf-8";
let certCache={expires:0,keys:[]};
const enc=new TextEncoder();
function response(data,status=200,headers={}){
 return new Response(JSON.stringify(data),{status,headers:{"Content-Type":TXT,"Cache-Control":"no-store",...headers}});
}
function fail(message,status=400){const e=new Error(message);e.httpStatus=status;throw e}
function b64urlToBytes(t){
 if(typeof t!=="string"||!/^[A-Za-z0-9_-]+$/.test(t))fail("Malformed authentication token",401);
 const raw=atob(t.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(t.length/4)*4,"="));
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function decodedJWTpart(t){try{return JSON.parse(new TextDecoder().decode(b64urlToBytes(t)))}catch{fail("Invalid Google login token",401)}}
async function googleKeys(){
 if(certCache.keys.length&&Date.now()<certCache.expires)return certCache.keys;
 const r=await fetch(GOOGLE_CERTS,{headers:{Accept:"application/json"}});
 if(!r.ok)fail("Google verification unavailable",503);
 const j=await r.json();
 if(!Array.isArray(j.keys)||!j.keys.length)fail("Google verification unavailable",503);
 let ttl=Number(r.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1]||900);
 certCache={keys:j.keys,expires:Date.now()+Math.min(3600,Math.max(120,ttl))*1000};
 return certCache.keys;
}
async function googleUser(token,env){
 if(typeof token!=="string"||token.length>12000)fail("Google Sign-In required",401);
 const parts=token.split(".");
 if(parts.length!==3)fail("Invalid Google login token",401);
 const header=decodedJWTpart(parts[0]),claims=decodedJWTpart(parts[1]);
 if(header.alg!=="RS256"||!header.kid)fail("Unsupported Google login token",401);
 const key=(await googleKeys()).find(k=>k.kid===header.kid&&k.kty==="RSA"&&k.use==="sig");
 if(!key)fail("Google verification key unavailable; sign in again",401);
 const cryptoKey=await crypto.subtle.importKey("jwk",key,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 const verified=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",cryptoKey,b64urlToBytes(parts[2]),enc.encode(parts[0]+"."+parts[1]));
 if(!verified)fail("Google login signature invalid",401);
 const now=Math.floor(Date.now()/1000);
 if(!["https://accounts.google.com","accounts.google.com"].includes(claims.iss)||
    claims.aud!==env.GOOGLE_CLIENT_ID||!claims.sub||
    typeof claims.exp!=="number"||claims.exp<=now||
    typeof claims.iat!=="number"||claims.iat>now+60||
    claims.email_verified!==true)fail("Google login expired or invalid",401);
 const verifiedEmail=String(claims.email||"").trim().toLowerCase();
 const digest=await crypto.subtle.digest("SHA-256",enc.encode(verifiedEmail));
 const digestHex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
 const approvedHash=String(env.ADMIN_EMAIL_SHA256||APPROVED_EMAIL_SHA256).trim().toLowerCase();
 if(digestHex!==approvedHash)fail("या Gmail खात्याला Admin परवानगी नाही.",403);
 return {sub:claims.sub,email:claims.email,name:claims.name||""};
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
async function savePost(env,input){
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
  author:String(p.author||"लोकहित महाराष्ट्र डिजिटल डेस्क").slice(0,120),
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
  const allowed=(String(env.SITE_ORIGINS||"https://catonpe-droid.github.io").split(",").map(s=>s.trim()));
  const cors=allowed.includes(origin)?{"Access-Control-Allow-Origin":origin,"Vary":"Origin","Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Allow-Methods":"GET, POST, PUT, DELETE, OPTIONS"}:{};
  if(origin&&!allowed.includes(origin))return response({error:"This website origin is not authorized."},403);
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  try{
   const route=new URL(request.url),configured=!!(env.GOOGLE_CLIENT_ID&&env.GITHUB_TOKEN);
   if(route.pathname==="/status"&&request.method==="GET")return response({configured,google_client_id:env.GOOGLE_CLIENT_ID||""},200,cors);
   if(!configured)fail("Admin Server अजून जोडलेला नाही. एकदाच Cloudflare सेटअप आवश्यक आहे.",503);
   const auth=request.headers.get("Authorization")||"";
   if(!auth.startsWith("Bearer "))fail("Gmail ने पुन्हा Login करा.",401);
   const user=await googleUser(auth.slice(7),env);
   if(route.pathname==="/session"&&request.method==="GET")return response({authenticated:true,name:user.name,email:user.email},200,cors);
   if(route.pathname==="/posts"&&request.method==="GET")return response({posts:await listPosts(env)},200,cors);
   if(route.pathname==="/post"&&request.method==="PUT")return response(await savePost(env,await jsonInput(request)),200,cors);
   if(route.pathname==="/post"&&request.method==="DELETE")return response(await deletePost(env,route.searchParams.get("slug")),200,cors);
   if(route.pathname==="/file"&&request.method==="GET")return response(await readJson(env,route.searchParams.get("path")),200,cors);
   if(route.pathname==="/file"&&request.method==="PUT"){
    const input=await jsonInput(request);
    return response(await writeJson(env,input.path,input.data),200,cors);
   }
   return response({error:"Unknown editor action"},404,cors);
  }catch(err){
   return response({error:String(err.message||"Server error")},err.httpStatus||500,cors);
  }
 }
};