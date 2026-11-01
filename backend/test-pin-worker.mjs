// PIN Worker regression tests, self-contained and no real GitHub or PIN credentials.
import fs from "node:fs";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
globalThis.crypto ||= webcrypto;
const source=fs.readFileSync(new URL("./pin-worker.js",import.meta.url),"utf8");
const handler=(await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"))).default;
const origin="https://catonpe-droid.github.io";
const editorPin="123456"; // TEST ONLY, not the production PIN.
let quota=5;
const env={
 EDITOR_PIN:editorPin,SESSION_SECRET:"sample-tests-only-very-long-session-secret",
 GITHUB_TOKEN:"test-secret",SITE_ORIGINS:origin,
 LOGIN_LIMITER:{limit:async()=>({success:quota-- >0})}
};
const objects=new Map(),encode=obj=>Buffer.from(JSON.stringify(obj)).toString("base64");
let rev=1;
function put(path,obj){objects.set(path,{path,sha:"sha"+rev++,content:encode(obj)})}
put("content/editor-names.json",{version:1,editors:Array.from({length:10},(_,i)=>({id:i+1,name:"Editor "+(i+1)}))});
put("content/layout.json",{version:2,menu:[],slider:[],breaking:{enabled:true,mode:"latest",custom:[]}});
put("site.json",{name:"लोकहित महाराष्ट्र",base_path:"/lokhit-maharashtra/",site_url:"https://catonpe-droid.github.io/lokhit-maharashtra/"});
const original=globalThis.fetch;
globalThis.fetch=async(url,opts={})=>{
 const u=new URL(String(url)),method=opts.method||"GET";
 assert.equal(u.host,"api.github.com");
 assert.ok(u.pathname.startsWith("/repos/catonpe-droid/lokhit-maharashtra/contents/"));
 const path=decodeURI(u.pathname.split("/contents/")[1]);
 if(method==="GET"&&path==="content/posts")return Response.json([...objects.values()].filter(x=>x.path.startsWith("content/posts/")).map(x=>({path:x.path,name:x.path.split("/").at(-1),type:"file"})));
 if(method==="GET")return objects.has(path)?Response.json(objects.get(path)):Response.json({message:"Not Found"},{status:404});
 if(method==="PUT"){
  const p=JSON.parse(opts.body),existing=objects.get(path);
  if(existing&&p.sha!==existing.sha)return Response.json({message:"Conflict"},{status:409});
  objects.set(path,{path,sha:"sha"+rev++,content:p.content});
  return Response.json({ok:true});
 }
 if(method==="DELETE"){objects.delete(path);return Response.json({ok:true})}
 throw Error("Unexpected Github request: "+method+" "+path);
};
function req(path,method="GET",body,session="",o=origin){
 const headers={Origin:o,"CF-Connecting-IP":"203.0.113.1",...(body?{"Content-Type":"application/json"}:{}),...(session?{"Authorization":"Bearer "+session}:{})};
 return new Request("https://test-pin.workers.dev"+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
}
try{
 const status=await handler.fetch(req("/status"),env);
 assert.equal((await status.json()).configured,true);
 const editorList=await handler.fetch(req("/editors"),env);
 assert.equal((await editorList.json()).editors.length,10);
 const missing=await handler.fetch(req("/posts"),env);
 assert.equal(missing.status,401);
 const wrong=await handler.fetch(req("/login","POST",{pin:"000000",editor:2}),env);
 assert.equal(wrong.status,401);
 const login=await handler.fetch(req("/login","POST",{pin:editorPin,editor:2}),env);
 assert.equal(login.status,200);const session=(await login.json()).session;
 assert.ok(session?.includes("."));
 const profile=await handler.fetch(req("/session","GET",undefined,session),env);
 assert.equal((await profile.json()).editor.name,"Editor 2");
 const unauthorized=await handler.fetch(req("/editor-names","PUT",{editors:Array(10).fill("X")}),env);
 assert.equal(unauthorized.status,401);
 const updated=await handler.fetch(req("/editor-names","PUT",{editors:Array.from({length:10},(_,i)=>"पत्रकार "+(i+1))},session),env);
 assert.equal(updated.status,200);assert.equal((await updated.json()).saved,true);
 const article={article:{slug:"test-news",title:"Test News",description:"Test Summary",body:"News body",category:"महाराष्ट्र",author:"Forged Author",status:"published"}};
 const post=await handler.fetch(req("/post","PUT",article,session),env);
 assert.equal(post.status,200);assert.equal((await post.json()).saved,true);
 const stored=JSON.parse(Buffer.from(objects.get("content/posts/test-news.json").content,"base64").toString());
 assert.equal(stored.author,"Editor 2"); // Client cannot forge article byline
 const badOrigin=await handler.fetch(req("/posts","GET",undefined,session,"https://evil.example"),env);
 assert.equal(badOrigin.status,403);
 const malformed=await handler.fetch(req("/posts","GET",undefined,"not-a-session"),env);
 assert.equal(malformed.status,401);
 quota=0;
 const limited=await handler.fetch(req("/login","POST",{pin:editorPin,editor:2}),env);
 assert.equal(limited.status,429);
 const unfinished=await handler.fetch(req("/status"),{...env,EDITOR_PIN:""});
 assert.equal((await unfinished.json()).configured,false);
 console.log("PIN Worker tests passed: PIN validation, brute-force throttle, 10 editor profiles, session, byline attribution, origin checks, save and authorization.");
}finally{globalThis.fetch=original}
