// Offline worker contract tests. All GitHub and Google HTTPS calls are mocked.
import fs from "node:fs";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
globalThis.crypto ||= webcrypto;
const workerCode=fs.readFileSync(new URL("./worker.js",import.meta.url),"utf8");
const worker=(await import("data:text/javascript;base64,"+Buffer.from(workerCode).toString("base64"))).default;
const ORIGIN="https://catonpe-droid.github.io";
const WEB_CLIENT="test-client.apps.googleusercontent.com";
const ENV={GOOGLE_CLIENT_ID:WEB_CLIENT,ADMIN_EMAILS:"editor@gmail.com",GITHUB_TOKEN:"fake-secret",SITE_ORIGINS:ORIGIN};
const keys=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
const jwk=await crypto.subtle.exportKey("jwk",keys.publicKey);
Object.assign(jwk,{kid:"test-google-key",use:"sig",alg:"RS256"});
const encoder=new TextEncoder();
const b64url=s=>Buffer.from(s).toString("base64url");
async function idToken(email="editor@gmail.com",expired=false){
 const now=Math.floor(Date.now()/1000);
 const a=b64url(JSON.stringify({alg:"RS256",typ:"JWT",kid:jwk.kid}));
 const b=b64url(JSON.stringify({iss:"https://accounts.google.com",aud:WEB_CLIENT,sub:"google-user-123",email,email_verified:true,iat:now-20,exp:now+(expired?-5:3600)}));
 const signature=await crypto.subtle.sign({name:"RSASSA-PKCS1-v1_5"},keys.privateKey,encoder.encode(a+"."+b));
 return a+"."+b+"."+Buffer.from(signature).toString("base64url");
}
const store=new Map();
const put=(path,obj)=>store.set(path,{path,sha:"sha-"+(store.size+1),content:Buffer.from(JSON.stringify(obj)).toString("base64")});
put("content/layout.json",{menu:[],slider:[],breaking:{enabled:true,mode:"latest",custom:[]}});
put("site.json",{name:"लोकहित महाराष्ट्र",base_path:"/lokhit-maharashtra/",site_url:"https://catonpe-droid.github.io/lokhit-maharashtra/",github_repo:"catonpe-droid/lokhit-maharashtra"});
const oldFetch=globalThis.fetch;
globalThis.fetch=async (url,opts={})=>{
 const u=String(url);
 if(u==="https://www.googleapis.com/oauth2/v3/certs")return new Response(JSON.stringify({keys:[jwk]}),{status:200,headers:{"cache-control":"max-age=1800"}});
 if(!u.startsWith("https://api.github.com/repos/catonpe-droid/lokhit-maharashtra/"))throw Error("Unexpected network URL: "+u);
 const path=new URL(u).pathname.split("/contents/")[1];
 if(!path)throw Error("No contents path");
 const method=opts.method||"GET";
 if(method==="GET"&&path==="content/posts")return Response.json([...store.values()].filter(x=>x.path.startsWith("content/posts/")).map(x=>({path:x.path,name:x.path.split("/").pop(),type:"file"})));
 if(method==="GET")return store.has(path)?Response.json(store.get(path)):Response.json({message:"Not Found"},{status:404});
 if(method==="PUT"){
  const body=JSON.parse(opts.body);
  const prior=store.get(path);
  if(prior&&prior.sha!==body.sha)return Response.json({message:"Conflict"},{status:409});
  store.set(path,{path,sha:"sha-"+(Math.random()*1e9|0),content:body.content});
  return Response.json({content:{path}});
 }
 if(method==="DELETE"){store.delete(path);return Response.json({ok:true})}
 throw Error("Unexpected request: "+method);
};
const request=(path,method="GET",token="",body,origin=ORIGIN)=>new Request("https://lokhit-test.workers.dev"+path,{method,headers:{Origin:origin,...(token?{Authorization:"Bearer "+token}:{}),...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
try{
 const status=await worker.fetch(request("/status"),ENV);
 assert.equal(status.status,200);assert.equal((await status.json()).configured,true);
 const missing=await worker.fetch(request("/session"),ENV);assert.equal(missing.status,401);
 const good=await idToken();
 const login=await worker.fetch(request("/session","GET",good),ENV);
 assert.equal(login.status,200);assert.equal((await login.json()).email,"editor@gmail.com");
 const denied=await worker.fetch(request("/session","GET",await idToken("intruder@gmail.com")),ENV);
 assert.equal(denied.status,403);
 const expired=await worker.fetch(request("/session","GET",await idToken("editor@gmail.com",true)),ENV);
 assert.equal(expired.status,401);
 const noOrigin=await worker.fetch(request("/session","GET",good,undefined,"https://malicious.example"),ENV);
 assert.equal(noOrigin.status,403);
 const item={article:{slug:"test-article",title:"चाचणी बातमी",description:"चाचणी सारांश",category:"महाराष्ट्र",body:"मजकूर",status:"published"}};
 const saved=await worker.fetch(request("/post","PUT",good,item),ENV);
 assert.equal(saved.status,200);assert.equal((await saved.json()).saved,true);
 const posts=await worker.fetch(request("/posts","GET",good),ENV);
 assert.equal(posts.status,200);assert.equal((await posts.json()).posts[0].slug,"test-article");
 const layout=await worker.fetch(request("/file?path=content%2Flayout.json","GET",good),ENV);
 assert.equal(layout.status,200);assert.ok((await layout.json()).data.menu);
 const badFile=await worker.fetch(request("/file?path=.github%2Fworkflows%2Fpages.yml","GET",good),ENV);
 assert.equal(badFile.status,400);
 console.log("Gmail editor Worker tests passed: Google signature verification, email allowlist, CORS, publishing, listings and file permissions.");
}finally{globalThis.fetch=oldFetch}
