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
const MAX_REQUEST = 1300000;
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
  if(!CATEGORIES.has(category)) fail("बातमीचा योग्य विभाग निवडा.");
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
      return json({ready:!!(env.GITHUB_TOKEN && env.PUBLISH_KEY)},200,cors);
    }
    if(url.pathname!=="/publish" || request.method!=="POST") {
      return json({error:"अवैध विनंती."},404,cors);
    }
    if(!env.GITHUB_TOKEN || !env.PUBLISH_KEY || env.PUBLISH_KEY.length<32) {
      return json({error:"प्रकाशन सेवा अद्याप सक्रिय नाही."},503,cors);
    }
    try {
      const outcome = await publish(env,request);
      return json(outcome,202,cors);
    } catch(e) {
      return json({error:e.message || "बातमी जतन करता आली नाही."},e.status || 500,cors);
    }
  }
};
