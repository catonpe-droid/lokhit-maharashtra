/**
 * लोकहित महाराष्ट्र — Google Sheets News Admin
 * Paste this ONE file into Extensions > Apps Script > Code.gs
 * Deploy as Web App, Execute as Me, Access: Anyone.
 * Main website stays on GitHub Pages; no GitHub token or Cloudflare required.
 */
const LOKHIT_BOOK_ID = "1vLW3s18KTUACexCHvYx0NjVh4M67_yavzIVAhO_DIrk";
const LOKHIT_SESSION_SECONDS = 30*24*60*60;
const LOKHIT_CATEGORIES = ["महाराष्ट्र","मराठवाडा","विदर्भ","पश्चिम महाराष्ट्र","कोकण","दुष्काळ विशेष","शेती","शासन योजना","पशुसंवर्धन","पाणी","रोजगार","ग्रामविकास","राजकारण","शिक्षण","आरोग्य","विश्लेषण"];
function sheet_(name){const sh=SpreadsheetApp.openById(LOKHIT_BOOK_ID).getSheetByName(name);if(!sh)throw Error(name+" टॅब उपलब्ध नाही.");return sh;}
function entries_(name){return sheet_(name).getDataRange().getDisplayValues().slice(1);}
function security_(key){const row=entries_("SECURITY").find(x=>x[0]===key);return row?String(row[1]||""):"";}
function updateSecurity_(key,value){
 const sh=sheet_("SECURITY"),data=sh.getDataRange().getDisplayValues();
 const idx=data.findIndex(row=>row[0]===key);
 if(idx<0)throw Error("SECURITY setting आढळली नाही: "+key);
 sh.getRange(idx+1,2).setValue(String(value));
}
function generateSalt_(){return Utilities.getUuid().replace(/-/g,"")+Utilities.getUuid().replace(/-/g,"");}
function hashPin_(pin,salt){
 let digest=String(salt)+":"+String(pin);
 for(let i=0;i<2200;i++){
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,digest,Utilities.Charset.UTF_8);
  digest=Utilities.base64EncodeWebSafe(bytes)+salt;
 }
 return digest.slice(0,80);
}
function onOpen(){
 SpreadsheetApp.getUi().createMenu("लोकहित Admin")
  .addItem("PIN सेट / बदल करा","menuSetPin")
  .addItem("Admin Web App लिंक","menuShowAppUrl")
  .addToUi();
}
function menuSetPin(){
 const ui=SpreadsheetApp.getUi(),currentSalt=security_("PIN_SALT"),currentHash=security_("PIN_HASH");
 if(currentSalt&&currentHash){
  const ask=ui.prompt("Admin PIN बदला","सध्याचा सहा अंकी PIN टाका",ui.ButtonSet.OK_CANCEL);
  if(ask.getSelectedButton()!==ui.Button.OK)return;
  if(hashPin_(ask.getResponseText(),currentSalt)!==currentHash){ui.alert("जुना PIN चुकीचा आहे.");return;}
 }
 const prompt=ui.prompt("लोकहित महाराष्ट्र — Admin PIN","नवीन सहा अंकी PIN टाका. तो Sheet मध्ये साध्या मजकुरात साठवला जाणार नाही.",ui.ButtonSet.OK_CANCEL);
 if(prompt.getSelectedButton()!==ui.Button.OK)return;
 const pin=String(prompt.getResponseText()||"").trim();
 if(!/^\d{6}$/.test(pin)){ui.alert("फक्त सहा अंकी PIN द्या.");return;}
 const lock=LockService.getScriptLock();lock.waitLock(15000);
 try{
  const salt=generateSalt_();
  updateSecurity_("PIN_SALT",salt);
  updateSecurity_("PIN_HASH",hashPin_(pin,salt));
  updateSecurity_("PIN_UPDATED_AT",new Date().toISOString());
  const n=Number(security_("LOGIN_VERSION")||"0")+1;
  updateSecurity_("LOGIN_VERSION",String(n));
 }finally{lock.releaseLock();}
 ui.alert("✅ PIN सुरक्षितपणे जतन झाला. आता Web App वरून Login करता येईल.");
}
function menuShowAppUrl(){
 const u=ScriptApp.getService().getUrl();
 SpreadsheetApp.getUi().alert(u?"Admin लिंक: "+u:"Deploy → New deployment → Web app केल्यावर Admin लिंक मिळेल.");
}
function sessionsSheet_(){
 const book=SpreadsheetApp.openById(LOKHIT_BOOK_ID);
 let sh=book.getSheetByName("SESSIONS");
 if(!sh){
  const lock=LockService.getDocumentLock()||LockService.getScriptLock();
  lock.waitLock(15000);
  try{
   sh=book.getSheetByName("SESSIONS");
   if(!sh){sh=book.insertSheet("SESSIONS");sh.appendRow(["Token Hash","Editor ID","Login Version","Created At","Expires At","Revoked"]);sh.setFrozenRows(1);}
  }finally{lock.releaseLock()}
 }
 return sh;
}
function digestToken_(token){
 return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(token),Utilities.Charset.UTF_8)
  .map(b=>("0"+((b+256)%256).toString(16)).slice(-2)).join("");
}
function editorOptions(){
 return entries_("EDITORS").filter(row=>String(row[2]||"YES").toUpperCase()!=="NO").map(row=>({id:Number(row[0]),name:String(row[1]||"").trim()})).filter(x=>x.id>=1&&x.id<=10&&x.name);
}
function loginAdmin(pin,id){
 const lock=LockService.getScriptLock();lock.waitLock(10000);
 try{
  const cache=CacheService.getScriptCache();
  const failed=Number(cache.get("PIN_FAILS")||"0");
  if(failed>=6)throw Error("खूप चुकीचे प्रयत्न झाले. १५ मिनिटांनी पुन्हा प्रयत्न करा.");
  const salt=security_("PIN_SALT"),saved=security_("PIN_HASH");
  if(!salt||!saved)throw Error("Sheet मधून आधी PIN सेट करा: लोकहित Admin → PIN सेट करा.");
  if(typeof pin!=="string"||!/^\d{6}$/.test(pin)||hashPin_(pin,salt)!==saved){
   cache.put("PIN_FAILS",String(failed+1),900);
   throw Error("PIN चुकीचा आहे.");
  }
  const editor=editorOptions().find(x=>x.id===Number(id));
  if(!editor)throw Error("Editor निवडा.");
  const token=Utilities.getUuid().replace(/-/g,"")+Utilities.getUuid().replace(/-/g,"");
  const expiry=new Date(Date.now()+LOKHIT_SESSION_SECONDS*1000);
  sessionsSheet_().appendRow([digestToken_(token),editor.id,security_("LOGIN_VERSION"),new Date().toISOString(),expiry.toISOString(),"NO"]);
  cache.remove("PIN_FAILS");
  return {ok:true,token,editor,expiresAt:expiry.toISOString()};
 }finally{lock.releaseLock();}
}
function session_(token){
 if(!/^[a-f0-9]{64}$/i.test(String(token||"")))throw Error("PIN ने पुन्हा Login करा.");
 const hash=digestToken_(token);
 const sessions=sessionsSheet_().getDataRange().getDisplayValues().slice(1);
 const item=sessions.find(r=>r[0]===hash);
 if(!item||item[5]==="YES")throw Error("Login संपला आहे. PIN पुन्हा टाका.");
 const exp=Date.parse(item[4]);
 if(!Number.isFinite(exp)||exp<Date.now())throw Error("Login ची ३० दिवसांची मुदत संपली आहे.");
 if(item[2]!==security_("LOGIN_VERSION"))throw Error("PIN बदलल्यामुळे पुन्हा Login करा.");
 const editor=editorOptions().find(x=>x.id===Number(item[1]));
 if(!editor)throw Error("Editor उपलब्ध नाही.");
 return editor;
}
function verifySession(token){const editor=session_(token);return {ok:true,editor};}
function logoutAdmin(token){
 if(!token||!/^[a-f0-9]{64}$/i.test(String(token)))return {ok:true};
 const key=digestToken_(token),sheet=sessionsSheet_();
 const rows=sheet.getDataRange().getDisplayValues();
 const idx=rows.findIndex((r,i)=>i>0&&r[0]===key);
 if(idx>=1)sheet.getRange(idx+1,6).setValue("YES");
 return {ok:true};
}

/* CMS data lives as JSON files in private Google Drive; Sheet keeps PIN, sessions and editor names. */
const CMS_FOLDER_NAME="Lokhit Maharashtra — News CMS";
const GH_RAW="https://raw.githubusercontent.com/catonpe-droid/lokhit-maharashtra/main/";
function cmsFolder_(){
 const props=PropertiesService.getScriptProperties();
 const id=props.getProperty("CMS_FOLDER_ID");
 if(id){try{return DriveApp.getFolderById(id)}catch(e){}}
 const folder=DriveApp.createFolder(CMS_FOLDER_NAME);
 props.setProperty("CMS_FOLDER_ID",folder.getId());
 return folder;
}
function cmsFile_(name){
 if(!/^(?:post-[a-z0-9_-]{3,115}\.json|layout\.json|site\.json)$/i.test(name))throw Error("अवैध CMS फाइल.");
 const iter=cmsFolder_().getFilesByName(name);
 return iter.hasNext()?iter.next():null;
}
function jsonCmsRead_(name,fallback){
 const file=cmsFile_(name);
 if(file){try{return JSON.parse(file.getBlob().getDataAsString("UTF-8"))}catch(e){throw Error(name+" वाचता आला नाही.")}}
 if(fallback){
  try{
   const u=GH_RAW+(name==="layout.json"?"content/layout.json":"site.json");
   const response=UrlFetchApp.fetch(u,{muteHttpExceptions:true});
   if(response.getResponseCode()===200)return JSON.parse(response.getContentText("UTF-8"));
  }catch(e){}
 }
 return null;
}
function jsonCmsWrite_(name,data){
 const json=JSON.stringify(data,null,2);
 if(json.length>150000)throw Error("डेटा मर्यादेपेक्षा मोठा आहे.");
 const file=cmsFile_(name);
 if(file){file.setContent(json);return file}
 return cmsFolder_().createFile(name,json,MimeType.PLAIN_TEXT);
}
function allNews_(){
 const folder=cmsFolder_(),files=folder.getFiles(),news=[];
 while(files.hasNext()&&news.length<500){
  const file=files.next(),name=file.getName();
  if(!/^post-[a-z0-9_-]{3,115}\.json$/i.test(name))continue;
  try{
   const p=JSON.parse(file.getBlob().getDataAsString("UTF-8"));
   if(p&&p.id)news.push(p);
  }catch(e){}
 }
 return news.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
}
function listNews(token){session_(token);return {posts:allNews_()};}
function saveNews(token,raw,image){
 const editor=session_(token);
 if(!raw||typeof raw!=="object")throw Error("बातमीचा मजकूर द्या.");
 const title=String(raw.title||"").trim().slice(0,180),
  description=String(raw.description||"").trim().slice(0,500),
  body=String(raw.body||"").trim().slice(0,50000);
 if(!title||!description||!body)throw Error("शीर्षक, सारांश आणि संपूर्ण बातमी लिहा.");
 const slug=String(raw.slug||"").toLowerCase();
 if(!/^[a-z0-9][a-z0-9_-]{2,110}$/.test(slug))throw Error("बातमीचा URL/Slug योग्य नाही.");
 const validStatus=String(raw.status).toLowerCase()==="draft"?"draft":"published";
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const before=jsonCmsRead_("post-"+slug+".json",false)||{};
  let imageUrl=String(before.image||"").trim();
  if(image){
   if(image.type!=="image/jpeg"||typeof image.data!=="string"||image.data.length>1100000||!/^[A-Za-z0-9+/=]+$/.test(image.data))throw Error("JPEG फोटो ७५० KB पेक्षा लहान निवडा.");
   const blob=Utilities.newBlob(Utilities.base64Decode(image.data),"image/jpeg","lokhit-"+slug+"-"+Date.now()+".jpg");
   const file=cmsFolder_().createFile(blob);
   file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
   imageUrl="https://lh3.googleusercontent.com/d/"+file.getId();
  }
  const now=new Date().toISOString();
  const data={
   id:before.id||Utilities.getUuid(),slug,title,description,body,
   category:String(raw.category||"महाराष्ट्र").slice(0,65),
   image:imageUrl,video:String(raw.video||"").slice(0,600),
   author:editor.name,status:validStatus,featured:!!raw.featured,
   date:before.date||now,updated:now
  };
  jsonCmsWrite_("post-"+slug+".json",data);
  return {saved:true,slug,status:validStatus,
   message:validStatus==="draft"?"✅ मसुदा जतन झाला.":"✅ बातमी Save झाली. वेबसाइटवर Feed मधून दिसेल."};
 }finally{lock.releaseLock();}
}
function deleteNews(token,slug){
 session_(token);
 const name="post-"+String(slug||"").toLowerCase()+".json";
 const file=cmsFile_(name);
 if(!file)throw Error("बातमी उपलब्ध नाही.");
 file.setTrashed(true);
 return {deleted:true,slug};
}
function publicFeed_(){
 const posts=allNews_().filter(x=>x.status==="published").slice(0,100);
 return {ok:true,posts,layout:jsonCmsRead_("layout.json",true),site:jsonCmsRead_("site.json",true)};
}
function readCmsJson(token,path){
 session_(token);
 if(!["content/layout.json","site.json"].includes(path))throw Error("सेटिंग्ज फाइल अवैध आहे.");
 return {data:jsonCmsRead_(path==="site.json"?"site.json":"layout.json",true)||{}};
}
function writeCmsJson(token,path,data){
 session_(token);
 if(!["content/layout.json","site.json"].includes(path))throw Error("सेटिंग्ज फाइल अवैध आहे.");
 if(!data||typeof data!=="object")throw Error("रिकामी सेटिंग्ज.");
 const name=path==="site.json"?"site.json":"layout.json",before=jsonCmsRead_(name,true)||{};
 let safe={...before};
 if(name==="site.json"){
  for(const key of ["name","tagline","description","editor_name","contact_email","youtube_live_url","youtube_live_provider","youtube_live_channel_id","youtube_live_channel_url","youtube_url","facebook_url","instagram_url","twitter_url"])
   if(typeof data[key]==="string")safe[key]=data[key].slice(0,500);
  if(!String(safe.name||"").trim())throw Error("वेबसाइटचे नाव आवश्यक आहे.");
 }else{
  if(!Array.isArray(data.menu)||!Array.isArray(data.slider)||!data.breaking)throw Error("मेनू किंवा स्लायडर डेटा अवैध आहे.");
  safe={...before,version:2,
   menu:data.menu.slice(0,24).map(x=>({title:String(x.title||"").slice(0,65),href:String(x.href||"").slice(0,150),enabled:x.enabled!==false})),
   slider:data.slider.slice(0,12).map(x=>({slug:String(x.slug||"").slice(0,110),title:String(x.title||"").slice(0,160),enabled:x.enabled!==false})),
   slider_seconds:Math.max(3,Math.min(15,Number(data.slider_seconds)||6)),
   breaking:{enabled:data.breaking.enabled!==false,mode:data.breaking.mode==="custom"?"custom":"latest",
    custom:(Array.isArray(data.breaking.custom)?data.breaking.custom:[]).slice(0,12).map(x=>String(x||"").slice(0,170))}
  };
  if(safe.menu.some(x=>!x.title||!(/^[a-z0-9_/-]*$/i.test(x.href))||x.href.includes("..")||x.href.startsWith("/")))throw Error("मेनू लिंक तपासा.");
 }
 jsonCmsWrite_(name,safe);
 return {saved:true};
}
function updateEditorNames(token,editors){
 session_(token);
 if(!Array.isArray(editors)||editors.length!==10)throw Error("दहा Editor नावे आवश्यक आहेत.");
 const names=editors.map(v=>String(v||"").trim().slice(0,70));
 if(names.some(x=>!x))throw Error("Editor नाव रिकामे ठेवू नका.");
 const sh=sheet_("EDITORS");
 sh.getRange(2,2,10,1).setValues(names.map(x=>[x]));
 return {saved:true,editors:editorOptions()};
}
function publicEditorInfo(){return editorOptions();}
function doGet(e){
 const p=(e&&e.parameter)||{};
 if(p.feed==="1"){
  const cb=String(p.callback||"");
  if(!/^[A-Za-z_$][A-Za-z0-9_$]{0,90}$/.test(cb))return ContentService.createTextOutput("/* invalid */").setMimeType(ContentService.MimeType.JAVASCRIPT);
  const payload=JSON.stringify(publicFeed_());
  return ContentService.createTextOutput(cb+"("+payload+");").setMimeType(ContentService.MimeType.JAVASCRIPT);
 }
 return HtmlService.createHtmlOutput(APP_HTML_).setTitle("लोकहित महाराष्ट्र | News Admin")
  .addMetaTag("viewport","width=device-width, initial-scale=1");
}

const APP_HTML_ = `<!doctype html>
<html lang="mr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;background:#f0f4f8;color:#162b46;font-family:Arial,"Noto Sans Devanagari",sans-serif;line-height:1.5}
header{background:#0e3054;color:white;border-bottom:5px solid #b60020;padding:18px 24px}
header strong{font-size:23px}header small{display:block;color:#cfdeed;font-size:13px}
main{max-width:1050px;margin:28px auto;padding:0 14px}
.card{background:white;border:1px solid #dce5ee;border-radius:14px;box-shadow:0 8px 26px #1536530d;padding:22px;margin-bottom:18px}
#login-panel{max-width:450px;margin:46px auto}
h1{font-size:24px;margin:0 0 11px}h2{font-size:19px;margin:0 0 12px}
label{font-size:14px;font-weight:700;display:block;margin:12px 0 6px;color:#3b5069}
input,select,textarea{display:block;width:100%;font:inherit;font-size:15px;border:1px solid #cad6e2;background:#fff;border-radius:9px;padding:11px;outline-color:#ad1832;color:#18314d}
input[type=checkbox]{display:inline;width:auto;margin:0 7px 0 0}
textarea{min-height:100px;resize:vertical}textarea.body{min-height:220px}
button{border:0;border-radius:8px;padding:11px 16px;font-size:14px;font-weight:700;cursor:pointer}
button:disabled{opacity:.6;cursor:wait}.red{background:#b60020;color:#fff}.blue{background:#e7eff7;color:#234461}.outline{border:1px solid #d0dbe6;background:white;color:#274159}
.note{font-size:13px;color:#687b8d;margin:8px 0 16px}.remember{display:flex;align-items:center;gap:4px;margin:17px 0}
.row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px}
.actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.status{font-size:14px;color:#19724b;min-height:18px;margin-top:14px}
.error{color:#a40823}.news-row{width:100%;background:#fff;border:1px solid #e0e7ef;text-align:left;color:#172d47;margin:6px 0;display:block}
.news-row strong{display:block;font-size:14px;overflow-wrap:anywhere}.news-row span{display:block;font-size:12px;margin-top:3px;color:#718092}
#preview{max-width:260px;max-height:190px;object-fit:contain;margin-top:9px;display:block}
a{color:#b60020;text-decoration:none}
@media(max-width:720px){main{margin:14px auto}.grid,.row{grid-template-columns:1fr}header{padding:13px}.card{padding:16px}h1{font-size:22px}}
</style>
</head><body><header><strong>📰 लोकहित महाराष्ट्र</strong><small>News Admin • Google Sheet मधून बातम्या</small></header>
<main>
<section class="card" id="login-panel">
<h1>🔐 Admin Login</h1>
<p class="note">फक्त PIN टाका, Editor निवडा आणि बातमी प्रकाशित करा.</p>
<form id="login-form">
<label for="pin">सहा अंकी PIN</label>
<input id="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="off" placeholder="••••••">
<label for="editor">Editor नाव</label>
<select id="editor" required><option value="">Editor लोड होत आहेत…</option></select>
<label class="remember"><input type="checkbox" id="remember" checked> या ब्राउझरवर ३० दिवस Login लक्षात ठेवा</label>
<button type="submit" class="red" id="login-btn">प्रवेश करा →</button>
</form><p id="login-status" class="status"></p>
</section>
<section id="dashboard" hidden>
<div class="card"><div class="actions" style="justify-content:space-between"><h1 style="margin:0">बातम्या व्यवस्थापन</h1>
<div class="actions"><strong id="signed-editor"></strong><button type="button" class="outline" id="logout">Logout</button></div></div>
<p class="note">बातमी PUBLISHED म्हणून Save केल्यावर ती Google Sheet मध्ये जतन होते. वेबसाइटशी Feed जोडल्यानंतर सार्वजनिक पेजवर दिसते.</p>
</div>
<div class="grid">
<section class="card">
<div class="actions" style="justify-content:space-between"><h2 id="form-title">नवीन बातमी</h2><button type="button" id="new" class="blue">+ नवीन बातमी</button></div>
<form id="news-form">
<label>बातमीचे शीर्षक *</label><input id="title" required maxlength="180" placeholder="मराठीत बातमीचा मथळा">
<label>थोडक्यात सारांश *</label><textarea id="description" required maxlength="500" placeholder="२-३ ओळींत सारांश"></textarea>
<div class="row"><div><label>विभाग</label><select id="category"></select></div>
<div><label>स्थिती</label><select id="news-status"><option value="PUBLISHED">✅ प्रकाशित करा</option><option value="DRAFT">मसुदा जतन करा</option></select></div></div>
<label>संपूर्ण बातमी *</label><textarea id="body" class="body" required placeholder="संपूर्ण बातमी लिहा..."></textarea>
<label>फोटो जोडा (JPG/PNG/WebP, १ MB पर्यंत)</label><input id="photo-file" type="file" accept="image/jpeg,image/png,image/webp">
<div class="actions" style="margin-top:7px"><button class="blue" id="upload-btn" type="button">📷 फोटो अपलोड</button><span id="photo-state" class="note"></span></div>
<label>फोटोची लिंक (ऐच्छिक)</label><input id="image" type="url" placeholder="https://...">
<img id="preview" hidden alt="फोटो पूर्वावलोकन">
<label class="remember"><input type="checkbox" id="featured"> मुख्य बातमी / Featured</label>
<button class="red" id="save-btn" type="submit">💾 Save / Publish</button>
<p id="save-status" class="status"></p>
</form></section>
<aside class="card"><h2>🗞️ सेव्ह केलेल्या बातम्या</h2><input id="search" type="search" placeholder="बातमी शोधा...">
<div id="news-list"><p class="note">बातम्या लोड होत आहेत...</p></div>
<p class="note">Editor ची नावे बदलण्यासाठी Google Sheet मधील EDITORS टॅब वापरा.</p></aside>
</div>
</section>
</main>
<script>
(function(){
"use strict";
const $=id=>document.getElementById(id);
const KEY="lokhit_sheet_login_2026_v1";
const categories=["महाराष्ट्र","मराठवाडा","विदर्भ","पश्चिम महाराष्ट्र","कोकण","दुष्काळ विशेष","शेती","शासन योजना","पशुसंवर्धन","पाणी","रोजगार","ग्रामविकास","राजकारण","शिक्षण","आरोग्य","विश्लेषण"];
let token="",editor=null,currentId=null,news=[];
function status(id,msg,bad){const x=$(id);x.textContent=msg||"";x.classList.toggle("error",!!bad)}
function call(name,args,onSuccess,onFail){
 const runner=google.script.run.withSuccessHandler(onSuccess).withFailureHandler(e=>onFail(e.message||"Server प्रतिसाद नाही."));
 runner[name].apply(runner,args);
}
function clearSaved(){try{localStorage.removeItem(KEY)}catch(e){}}
function remember(t){
 try{localStorage.setItem(KEY,t);return true}catch(e){return false}
}
function showLoggedIn(user){
 editor=user;$("signed-editor").textContent=user.name;
 $("login-panel").hidden=true;$("dashboard").hidden=false;$("pin").value="";
 loadNews();
}
function invalidLogin(msg){clearSaved();token="";status("login-status",msg,true);$("login-btn").disabled=false}
function loadEditors(){
 call("editorOptions",[],list=>{
  const select=$("editor");select.replaceChildren();
  const empty=document.createElement("option");empty.value="";empty.textContent="— Editor निवडा —";select.append(empty);
  list.forEach(ed=>{const opt=document.createElement("option");opt.value=String(ed.id);opt.textContent=ed.name;select.append(opt)});
 },msg=>status("login-status",msg,true));
}
function restore(){
 let saved="";
 try{saved=localStorage.getItem(KEY)||""}catch(e){}
 if(!saved)return;
 status("login-status","आधीचा Login तपासत आहे...");
 call("verifySession",[saved],result=>{
  token=saved;showLoggedIn(result.editor);
 },()=>{clearSaved();status("login-status","PIN टाकून Login करा.")});
}
$("login-form").addEventListener("submit",function(e){
 e.preventDefault();
 const pin=$("pin").value,selected=$("editor").value;
 if(!/^\\d{6}$/.test(pin)||!selected){status("login-status","PIN आणि Editor निवडा.",true);return;}
 $("login-btn").disabled=true;status("login-status","Login तपासत आहे...");
 call("loginAdmin",[pin,selected],result=>{
  token=result.token;
  if($("remember").checked){
   const ok=remember(token);
   if(!ok)status("login-status","हा ब्राउझर Login सेव्ह करू देत नाही. ब्राउझर सेटिंग्ज तपासा.",true);
  }
  showLoggedIn(result.editor);$("login-btn").disabled=false;
 },invalidLogin);
});
$("logout").addEventListener("click",function(){
 const old=token;token="";clearSaved();editor=null;currentId=null;news=[];
 $("dashboard").hidden=true;$("login-panel").hidden=false;
 status("login-status","Logout झाले. पुन्हा PIN टाकून प्रवेश करा.");
 if(old)call("logoutAdmin",[old],()=>{},()=>{});
});
function resetForm(){
 currentId=null;$("news-form").reset();$("form-title").textContent="नवीन बातमी";
 $("news-status").value="PUBLISHED";$("preview").hidden=true;
 status("save-status","");status("photo-state","");
}
$("new").addEventListener("click",resetForm);
function loadNews(){
 call("listNews",[token],result=>{
  news=result;renderList();
 },msg=>status("save-status","बातम्या लोड होत नाहीत: "+msg,true));
}
function renderList(){
 const q=$("search").value.toLocaleLowerCase("mr"),list=$("news-list");list.replaceChildren();
 const matches=news.filter(n=>(n.title+" "+n.category).toLocaleLowerCase("mr").includes(q));
 if(!matches.length){const p=document.createElement("p");p.className="note";p.textContent="बातम्या आढळल्या नाहीत.";list.append(p);return;}
 matches.forEach(n=>{
  const b=document.createElement("button");b.type="button";b.className="news-row";
  const a=document.createElement("strong");a.textContent=n.title;
  const small=document.createElement("span");small.textContent=n.category+" · "+(n.status==="PUBLISHED"?"प्रकाशित":"मसुदा");
  b.append(a,small);b.addEventListener("click",()=>editNews(n));list.append(b);
 });
}
function editNews(n){
 currentId=n.id;$("form-title").textContent="बातमी संपादित करा";
 for(const key of ["title","description","body","image"]){$(key).value=n[key]||""}
 $("category").value=n.category||"महाराष्ट्र";$("news-status").value=n.status||"DRAFT";
 $("featured").checked=!!n.featured;preview();status("save-status","");
 window.scrollTo({top:0,behavior:"smooth"});
}
function preview(){const url=$("image").value.trim();$("preview").hidden=!url;if(url)$("preview").src=url;}
$("image").addEventListener("change",preview);
$("photo-file").addEventListener("change",()=>status("photo-state","फोटो निवडला आहे. 'फोटो अपलोड' क्लिक करा."));
$("upload-btn").addEventListener("click",function(){
 const file=$("photo-file").files[0];
 if(!file){status("photo-state","आधी फोटो निवडा.",true);return}
 if(file.size>1200000){status("photo-state","फोटो १ MB पेक्षा लहान हवा.",true);return}
 if(!/^image\\/(jpeg|png|webp)$/.test(file.type)){status("photo-state","JPG/PNG/WebP फोटो वापरा.",true);return}
 $("upload-btn").disabled=true;status("photo-state","फोटो अपलोड होत आहे...");
 const reader=new FileReader();
 reader.onload=()=>{
  const base64=String(reader.result).split(",")[1];
  call("uploadNewsImage",[token,{base64:base64,mime:file.type}],result=>{
   $("image").value=result.url;preview();$("upload-btn").disabled=false;
   status("photo-state","✅ फोटो अपलोड झाला.");
  },msg=>{$("upload-btn").disabled=false;status("photo-state",msg,true)});
 };
 reader.onerror=()=>{$("upload-btn").disabled=false;status("photo-state","फोटो वाचता आला नाही.",true)};
 reader.readAsDataURL(file);
});
$("news-form").addEventListener("submit",function(e){
 e.preventDefault();
 if(!token){status("save-status","पुन्हा Login करा.",true);return}
 const data={id:currentId,title:$("title").value.trim(),description:$("description").value.trim(),
  category:$("category").value,body:$("body").value.trim(),
  image:$("image").value.trim(),status:$("news-status").value,featured:$("featured").checked};
 $("save-btn").disabled=true;status("save-status","बातमी जतन होत आहे...");
 call("saveNews",[token,data],result=>{
  currentId=result.id;status("save-status",result.message);
  $("save-btn").disabled=false;loadNews();
 },msg=>{$("save-btn").disabled=false;status("save-status",msg,true)});
});
$("search").addEventListener("input",renderList);
categories.forEach(name=>{const op=document.createElement("option");op.value=name;op.textContent=name;$("category").append(op)});
loadEditors();restore();
})();
</script></body></html>`;
