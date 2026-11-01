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
function listNews(token){
 session_(token);
 return entries_("NEWS").filter(x=>x[0]).map((x,i)=>({
  row:i+2,id:x[0],date:x[1],title:x[2],description:x[3],body:x[4],
  category:x[5],image:x[6],status:x[7],author:x[8],featured:x[9]==="YES",
  slug:x[10],updated:x[11]
 })).reverse().slice(0,200);
}
function saveNews(token,raw){
 const editor=session_(token);
 if(!raw||typeof raw!=="object")throw Error("बातमीची माहिती भरा.");
 const title=String(raw.title||"").trim().slice(0,180);
 const description=String(raw.description||"").trim().slice(0,500);
 const body=String(raw.body||"").trim().slice(0,30000);
 const category=LOKHIT_CATEGORIES.includes(raw.category)?raw.category:"महाराष्ट्र";
 const status=raw.status==="PUBLISHED"?"PUBLISHED":"DRAFT";
 const image=String(raw.image||"").trim().slice(0,1300);
 if(!title||!description||!body)throw Error("शीर्षक, सारांश आणि बातमीचा मजकूर आवश्यक आहे.");
 if(image&&!/^https:\/\//i.test(image))throw Error("फोटोची लिंक HTTPS असावी.");
 const lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  const sh=sheet_("NEWS"),data=sh.getDataRange().getDisplayValues();
  const existing=raw.id?data.findIndex((x,i)=>i>0&&x[0]===raw.id):-1;
  const now=new Date().toISOString(),id=existing>0?data[existing][0]:Utilities.getUuid().slice(0,13);
  const oldDate=existing>0?data[existing][1]:now;
  const slug=existing>0?data[existing][10]:"sheet-"+id.toLowerCase();
  const values=[id,oldDate,title,description,body,category,image,status,editor.name,raw.featured?"YES":"NO",slug,now];
  if(existing>0)sh.getRange(existing+1,1,1,12).setValues([values]);else sh.appendRow(values);
  return {saved:true,id,status,message:status==="PUBLISHED"?"✅ बातमी प्रकाशित झाली.":"✅ मसुदा जतन झाला."};
 }finally{lock.releaseLock();}
}
function uploadNewsImage(token,file){
 session_(token);
 if(!file||!/^image\/(jpeg|png|webp)$/.test(file.mime||""))throw Error("JPG/PNG/WebP फोटो वापरा.");
 if(!/^[A-Za-z0-9+/=]+$/.test(file.base64||"")||file.base64.length>1600000)throw Error("फोटो १ MB पेक्षा लहान वापरा.");
 const blob=Utilities.newBlob(Utilities.base64Decode(file.base64),file.mime,
  "lokhit-"+Date.now()+"."+(file.mime==="image/png"?"png":file.mime==="image/webp"?"webp":"jpg"));
 const folder=DriveApp.getRootFolder();
 const image=folder.createFile(blob);
 image.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
 return {url:"https://lh3.googleusercontent.com/d/"+image.getId()};
}
function publicFeed_(){
 return entries_("NEWS").filter(r=>r[0]&&r[7]==="PUBLISHED").map(r=>({
  id:r[0],slug:r[10],date:r[1],title:r[2],description:r[3],body:r[4],
  category:r[5],image:r[6],author:r[8],featured:r[9]==="YES",updated:r[11]
 })).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,100);
}
function doGet(e){
 const p=(e&&e.parameter)||{};
 if(p.feed==="1"){
  const cb=String(p.callback||"");
  if(!/^[A-Za-z_$][A-Za-z0-9_$]{0,90}$/.test(cb))return ContentService.createTextOutput("/* invalid */").setMimeType(ContentService.MimeType.JAVASCRIPT);
  const news=publicFeed_();
  const payload=JSON.stringify({ok:true,posts:news});
  return ContentService.createTextOutput(cb+"("+payload+");").setMimeType(ContentService.MimeType.JAVASCRIPT);
 }
 return HtmlService.createHtmlOutput(APP_HTML_).setTitle("लोकहित महाराष्ट्र | News Admin")
  .addMetaTag("viewport","width=device-width, initial-scale=1");
}

const APP_HTML_ = \`<!doctype html>
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
</script></body></html>\`;
