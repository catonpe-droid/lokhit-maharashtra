// Offline tests for the secret-link Publisher & News Admin. No real credentials.
import fs from "node:fs";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
globalThis.crypto ||= webcrypto;
const src=fs.readFileSync(new URL("./secret-publisher-worker.js",import.meta.url),"utf8");
const worker=(await import("data:text/javascript;base64,"+Buffer.from(src).toString("base64"))).default;
const ORIGIN="https://catonpe-droid.github.io";
const KEY="this-is-a-very-long-test-only-secret-key-1234567890";
const env={PUBLISH_KEY:KEY,GITHUB_TOKEN:"FAKE_TEST_TOKEN",ALLOWED_ORIGIN:ORIGIN};
const docs=new Map();
let revision=0;const writes=[];
function objFromBase64(s){return JSON.parse(Buffer.from(s.replace(/\s/g,""),"base64").toString("utf8"))}
function toFile(data,sha){return {content:Buffer.from(JSON.stringify(data)).toString("base64"),sha,encoding:"base64"}}
function store(path,item){const sha="sha"+(++revision);docs.set(path,{item,sha});return sha}
const BASE="https://api.github.com/repos/catonpe-droid/lokhit-maharashtra/";
globalThis.fetch=async (url,options={})=>{
  assert.ok(String(url).startsWith(BASE));
  assert.equal(options.headers.Authorization,"Bearer FAKE_TEST_TOKEN");
  const loc=new URL(String(url));
  const path=loc.pathname.replace("/repos/catonpe-droid/lokhit-maharashtra/contents/","");
  const method=options.method||"GET";
  let out={},code=200;
  if(method==="GET"){
    if(path==="content/posts"){
      out=[...docs].filter(([p])=>p.startsWith("content/posts/")&&p.endsWith(".json")).map(([p,record])=>({path:p,name:p.split("/").at(-1),sha:record.sha,type:"file"}));
    }else if(docs.has(path)){
      const record=docs.get(path);out=toFile(record.item,record.sha);
    }else{code=404;out={message:"Not Found"};}
  }else if(method==="PUT"){
    const payload=JSON.parse(options.body);
    if(docs.has(path)&&payload.sha!==docs.get(path).sha){code=409;out={message:"Conflict"};}
    else if(!docs.has(path)&&payload.sha){code=409;out={message:"Conflict"};}
    else{
      const item=path.endsWith(".json")?objFromBase64(payload.content):"BINARY_IMAGE";
      const sha=store(path,item);writes.push({method,path,item});
      out={content:{sha}};code=201;
    }
  }else if(method==="DELETE"){
    const payload=JSON.parse(options.body);
    if(!docs.has(path)){code=404;out={message:"Not Found"};}
    else if(payload.sha!==docs.get(path).sha){code=409;out={message:"Conflict"};}
    else{docs.delete(path);out={commit:{sha:"deleted"}};writes.push({method,path});}
  }else{code=405;out={message:"Unsupported"};}
  return new Response(JSON.stringify(out),{status:code,headers:{"Content-Type":"application/json"}});
};
const req=(method,path,auth,body,origin=ORIGIN)=>new Request("https://local-worker.test"+path,{
  method,headers:{"Origin":origin,...(auth?{"Authorization":"Bearer "+auth}:{}),...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
});
const sample={title:"शेतकऱ्यांसाठी पाणी नियोजनाची महत्त्वाची बातमी",category:"शेती",author:"बातमीदार",
 body:"ग्रामस्तरीय पाणी नियोजन करताना उपलब्ध साठा आणि पाण्याची गरज यांची नोंद घेणे आवश्यक आहे."};
{
 const resp=await worker.fetch(req("GET","/health"),env);
 assert.equal(resp.status,200);
 const health=await resp.json();assert.equal(health.ready,true);assert.ok(health.features.includes("editor"));
}
{
 const resp=await worker.fetch(req("POST","/publish","invalid-secret",sample),env);
 assert.equal(resp.status,401);assert.equal(writes.length,0);
}
{
 const resp=await worker.fetch(req("POST","/publish",KEY,sample,"https://evil.example"),env);
 assert.equal(resp.status,403);assert.equal(writes.length,0);
}
{
 const resp=await worker.fetch(req("POST","/publish",KEY,{...sample,category:"invalid"}),env);
 assert.equal(resp.status,400);assert.equal(writes.length,0);
}
let savedSlug="",firstSha="",date="";
{
 const resp=await worker.fetch(req("POST","/publish",KEY,sample),env);
 assert.equal(resp.status,202);
 const result=await resp.json();assert.equal(result.saved,true);
 savedSlug=result.slug;assert.ok(/^news-\d{14}-[0-9a-f]{10}$/.test(savedSlug));
 assert.equal(writes.length,1);
 assert.equal(writes[0].item.status,"published");
}
{
 const res=await worker.fetch(req("GET","/list?page=1&limit=24",KEY),env);
 assert.equal(res.status,200);
 const data=await res.json();assert.equal(data.posts.length,1);assert.equal(data.hasMore,false);
 assert.equal(data.posts[0].slug,savedSlug);
}
{
 const res=await worker.fetch(req("GET","/article?slug="+savedSlug,KEY),env);
 assert.equal(res.status,200);
 const data=await res.json();assert.equal(data.article.title,sample.title);
 firstSha=data.sha;date=data.article.date;
}
{
 // Change metadata only: preserve previous article body/image/date/URL.
 const res=await worker.fetch(req("POST","/save",KEY,{
  article:{slug:savedSlug,expected_sha:firstSha,...sample,title:"शेतीसाठी मोठ्या पाणी उपक्रमाचे वृत्तांकन",
   body:"A different text that must not overwrite the original, because body_changed=false.",
   body_changed:false,status:"draft",featured:true,tags:["शेती"],video:""}
 }),env);
 assert.equal(res.status,200);
 const data=await res.json();assert.equal(data.saved,true);assert.equal(data.status,"draft");assert.equal(data.date,date);
 const item=docs.get("content/posts/"+savedSlug+".json").item;
 assert.equal(item.body,sample.body);assert.equal(item.image,"assets/img/logo.webp");
 assert.equal(item.featured,true);assert.equal(item.date,date);
 assert.equal(item.slug,savedSlug);
}
{
 // Revision protection: stale browser must not silently overwrite newer content.
 const res=await worker.fetch(req("POST","/save",KEY,{
  article:{slug:savedSlug,expected_sha:firstSha,...sample,body_changed:true,status:"published"}
 }),env);
 assert.equal(res.status,409);
}
let latestSha=docs.get("content/posts/"+savedSlug+".json").sha;
{
 const rich=[{insert:"शेतकऱ्यांसाठी ताजा अहवाल",attributes:{bold:true}},
             {insert:"\n"},
             {insert:"संपूर्ण माहिती पुढील परिच्छेदात दिली आहे.\n"}];
 const res=await worker.fetch(req("POST","/save",KEY,{
   article:{slug:savedSlug,expected_sha:latestSha,...sample,
   body:"शेतकऱ्यांसाठी ताजा अहवाल\nसंपूर्ण माहिती पुढील परिच्छेदात दिली आहे.",
   body_changed:true,rich_delta:rich,status:"published",tags:["पाणी"]},
   photo:""
 }),env);
 assert.equal(res.status,200);
 const item=docs.get("content/posts/"+savedSlug+".json").item;
 assert.deepEqual(item.rich_delta,rich);
 assert.equal(item.status,"published");
 latestSha=docs.get("content/posts/"+savedSlug+".json").sha;
}
{
 // Inline news photos are stored as local JPEG assets, not as dangerous data URLs.
 const image=Buffer.from([0xff,0xd8,0xff,0xe0,0x11,0x22,0x33,0x44]).toString("base64");
 const rich=[
   {insert:"संपूर्ण बातमीतील फोटो पाहा.\n"},
   {insert:{image:"data:image/jpeg;base64,"+image}},
   {insert:"\nशेतकऱ्यांना योजनेची माहिती देण्यात आली.\n"}
 ];
 const res=await worker.fetch(req("POST","/save",KEY,{
   article:{slug:savedSlug,expected_sha:latestSha,...sample,
     body:"संपूर्ण बातमीतील फोटो पाहा.\nशेतकऱ्यांना योजनेची माहिती देण्यात आली.",
     rich_delta:rich,body_changed:true,status:"published"}
 }),env);
 assert.equal(res.status,200);
 const item=docs.get("content/posts/"+savedSlug+".json").item;
 const src=item.rich_delta.find(x=>x.insert?.image)?.insert.image;
 assert.match(src,/^assets\/img\/news-.*-inline-.*\.jpg$/);
 assert.equal(docs.has(src),true);
 latestSha=docs.get("content/posts/"+savedSlug+".json").sha;
}
{
 const res=await worker.fetch(req("POST","/delete",KEY,{slug:savedSlug,expected_sha:"wrong-sha"}),env);
 assert.equal(res.status,409);
}
{
 const res=await worker.fetch(req("POST","/delete",KEY,{slug:savedSlug,expected_sha:latestSha}),env);
 assert.equal(res.status,200);assert.equal((await res.json()).deleted,true);
 assert.equal([...docs.keys()].filter(x=>x.startsWith("content/posts/")).length,0);
}
console.log("Secret Publisher + Admin Studio tests passed. No live API writes.");
