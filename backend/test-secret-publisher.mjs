// Offline security and publishing tests. Uses fake credentials, no live GitHub writes.
import fs from "node:fs";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
globalThis.crypto ||= webcrypto;
const source = fs.readFileSync(new URL("./secret-publisher-worker.js",import.meta.url),"utf8");
const worker = (await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"))).default;
const ORIGIN = "https://catonpe-droid.github.io";
const key = "this-is-a-very-long-test-only-secret-key-1234567890";
const env={PUBLISH_KEY:key,GITHUB_TOKEN:"FAKE_TOKEN_FOR_TESTS",ALLOWED_ORIGIN:ORIGIN};
const calls=[];
globalThis.fetch=async(url,options)=>{
  assert.ok(String(url).startsWith("https://api.github.com/repos/catonpe-droid/lokhit-maharashtra/contents/"));
  assert.equal(options.method,"PUT");
  assert.equal(options.headers.Authorization,"Bearer FAKE_TOKEN_FOR_TESTS");
  const body=JSON.parse(options.body);
  calls.push({url:String(url),data:JSON.parse(Buffer.from(body.content,"base64").toString("utf8"))});
  return new Response(JSON.stringify({content:{sha:"fake"}}),{status:201,headers:{"Content-Type":"application/json"}});
};
const req=(method,path,auth,body,origin=ORIGIN)=>new Request("https://news.example.workers.dev"+path,{
 method,
 headers:{"Origin":origin,...(auth?{"Authorization":"Bearer "+auth}:{}),...(body?{"Content-Type":"application/json"}:{})},
 ...(body?{body:JSON.stringify(body)}:{})
});
const sample={title:"शेतकऱ्यांसाठी पाणी नियोजनाची महत्त्वाची बातमी",category:"शेती",author:"बातमीदार",body:"ग्रामस्तरीय पाणी नियोजन करताना उपलब्ध साठा आणि पाण्याची गरज यांची नोंद घेणे आवश्यक आहे."};
{
 const res=await worker.fetch(req("GET","/health"),env);
 assert.equal(res.status,200);assert.deepEqual(await res.json(),{ready:true});
}
{
 const res=await worker.fetch(req("POST","/publish","wrong-secret",sample),env);
 assert.equal(res.status,401);assert.equal(calls.length,0);
}
{
 const res=await worker.fetch(req("POST","/publish",key,sample,"https://evil.example"),env);
 assert.equal(res.status,403);assert.equal(calls.length,0);
}
{
 const res=await worker.fetch(req("POST","/publish",key,{...sample,category:"invalid"}),env);
 assert.equal(res.status,400);assert.equal(calls.length,0);
}
{
 const res=await worker.fetch(req("POST","/publish",key,sample),env);
 assert.equal(res.status,202);
 const data=await res.json();
 assert.equal(data.saved,true);
 assert.ok(data.url.startsWith("https://catonpe-droid.github.io/lokhit-maharashtra/batmi/news-"));
 assert.equal(calls.length,1);
 assert.equal(calls[0].data.title,sample.title);
 assert.equal(calls[0].data.status,"published");
 assert.equal(calls[0].data.category,"शेती");
 assert.equal(calls[0].data.image,"assets/img/logo.webp");
}
console.log("Secret publisher tests passed — no live credentials or publishing");
