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
  // Do not recursively acquire a script lock here: loginAdmin already holds it.
  try{
   sh=book.insertSheet("SESSIONS");
   sh.appendRow(["Token Hash","Editor ID","Login Version","Created At","Expires At","Revoked"]);
   sh.setFrozenRows(1);
  }catch(e){
   sh=book.getSheetByName("SESSIONS");
   if(!sh)throw e;
  }
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

const APP_HTML_ = "<!doctype html><html lang=\"mr\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow\"><meta name=\"theme-color\" content=\"#092045\"><title>प्रशासन पॅनल | लोकहित महाराष्ट्र</title><link rel=\"stylesheet\" href=\"https://catonpe-droid.github.io/lokhit-maharashtra/assets/css/style.css\"><link rel=\"stylesheet\" href=\"https://catonpe-droid.github.io/lokhit-maharashtra/assets/css/admin.css\"></head><body data-root-prefix=\"https://catonpe-droid.github.io/lokhit-maharashtra/\">\n<header class=\"admin-header\"><div class=\"container admin-header-inner\"><a href=\"https://catonpe-droid.github.io/lokhit-maharashtra/\"><img alt=\"\" src=\"https://catonpe-droid.github.io/lokhit-maharashtra/assets/img/logo.webp\" class=\"admin-logo\"> <strong>लोकहित महाराष्ट्र</strong></a><span>संपादकीय प्रशासन</span></div></header>\n<main class=\"container\"><section id=\"login\" class=\"login-card\">\n<div class=\"login-symbol\">🔐</div><h1>लोकहित महाराष्ट्र — Admin</h1>\n<p>फक्त PIN टाका, Editor निवडा. या ब्राउझरमध्ये Login लक्षात ठेवता येईल.</p>\n<form id=\"login-form\" autocomplete=\"off\">\n<label>सहा अंकी Admin PIN<input id=\"pin-code\" type=\"password\" inputmode=\"numeric\" pattern=\"[0-9]{6}\" maxlength=\"6\" required placeholder=\"••••••\"></label>\n<label>Editor नाव<select id=\"editor-choice\" required><option value=\"\">Editor लोड होत आहेत...</option></select></label>\n<label style=\"display:flex;align-items:center;gap:8px;font-weight:500;margin:15px 0\">\n<input id=\"remember\" type=\"checkbox\" checked style=\"width:16px;height:16px\"> या ब्राउझरवर ३० दिवस Login लक्षात ठेवा\n</label>\n<button type=\"submit\" class=\"btn btn-primary login-submit\" id=\"login-btn\">प्रवेश करा →</button>\n</form><p id=\"login-status\" class=\"status\" role=\"status\"></p>\n</section>\n<section id=\"dashboard\" hidden>\n<div class=\"dash-title\"><div><h1>लोकहित महाराष्ट्र <span class=\"cms-heading-accent\">Mini CMS</span></h1><p>बातम्या, मेनू, स्लायडर आणि वेबसाइटचे व्यवस्थापन एकाच ठिकाणी.</p></div><div class=\"dash-buttons\"><a href=\"https://catonpe-droid.github.io/lokhit-maharashtra/\" target=\"_blank\" rel=\"noopener\" class=\"btn btn-light\">🌐 वेबसाइट पाहा</a><button id=\"toggle-editor-names\" type=\"button\" class=\"btn btn-light\">✍️ Editor नावे बदला</button><button id=\"logout\" type=\"button\" class=\"btn btn-light\">बाहेर पडा</button></div></div>\n\n<section id=\"editor-names-panel\" class=\"cms-card\" hidden style=\"padding:20px;margin:18px 0\">\n<h2>Editor 1 ते 10 — नावे बदला</h2>\n<p>तुम्हाला हवे तसे नाव टाका आणि जतन करा. पुढील Login मध्ये बदललेले नाव दिसेल.</p>\n<form id=\"editor-names-form\"><div id=\"editor-name-fields\" class=\"form-two\"></div>\n<button type=\"submit\" id=\"save-editor-names\" class=\"btn btn-primary\">💾 Editor नावे जतन करा</button>\n<p id=\"editor-names-status\" class=\"status\" role=\"status\"></p></form></section>\n<nav class=\"cms-tabs\" aria-label=\"व्यवस्थापन विभाग\">\n<button type=\"button\" data-cms-tab=\"news\" class=\"cms-tab is-active\">📰 बातम्या</button>\n<button type=\"button\" data-cms-tab=\"menu\" class=\"cms-tab\">☰ मेनू व्यवस्थापन</button>\n<button type=\"button\" data-cms-tab=\"slider\" class=\"cms-tab\">▣ मुख्य स्लायडर</button>\n<button type=\"button\" data-cms-tab=\"breaking\" class=\"cms-tab\">⚡ ब्रेकिंग न्यूज</button>\n<button type=\"button\" data-cms-tab=\"settings\" class=\"cms-tab\">⚙️ साइट सेटिंग्ज</button>\n</nav>\n<section id=\"cms-news\" class=\"cms-tab-panel\"><div class=\"dashboard-grid\"><aside class=\"dash-list\"><div class=\"dash-list-head\"><strong>सर्व बातम्या</strong><button class=\"btn btn-small\" id=\"new-post\" type=\"button\">+ नवीन</button></div><input id=\"filter-posts\" class=\"admin-input\" placeholder=\"बातमी शोधा...\"><div id=\"post-list\" class=\"admin-post-list\"><p>लोड होत आहे...</p></div></aside><section class=\"editor-panel\"><form id=\"post-form\"><div class=\"edit-top\"><h2 id=\"editor-heading\">नवीन बातमी</h2><span id=\"edit-state\" class=\"edit-state\">नवीन</span></div><label>बातमीचे शीर्षक *<input id=\"title\" required maxlength=\"180\" placeholder=\"मराठी बातमीचे संपूर्ण शीर्षक...\"></label><div class=\"form-two\"><label>विभाग<select id=\"category\"><option>दुष्काळ विशेष</option><option>महाराष्ट्र</option><option>मराठवाडा</option><option>विदर्भ</option><option>पश्चिम महाराष्ट्र</option><option>कोकण</option><option>शेती</option><option>शासन योजना</option><option>पशुसंवर्धन</option><option>पाणी</option><option>रोजगार</option><option>अर्थकारण</option><option>ग्रामविकास</option><option>महिला व विकास</option><option>राजकारण</option><option>समाज</option><option>शिक्षण</option><option>आरोग्य</option><option>विश्लेषण</option></select></label><label>स्थिती<select id=\"post-status\"><option value=\"published\">प्रकाशित करा</option><option value=\"draft\">मसुदा ठेवा</option></select></label></div><label>थोडक्यात सारांश (SEO) *<textarea id=\"description\" required rows=\"2\" maxlength=\"300\" placeholder=\"बातमीचा 1-2 वाक्यांतील सारांश...\"></textarea></label><label>पूर्ण बातमी *<textarea id=\"body\" rows=\"15\" required placeholder=\"प्रत्येक परिच्छेदानंतर एक रिकामी ओळ द्या. शीर्षकासाठी ## वापरू शकता. YouTube लिंक मजकुरात दिली तरी व्हिडिओ ओळखला जाईल.\"></textarea></label><label>YouTube व्हिडिओ लिंक (ऐच्छिक)<input id=\"video\" type=\"url\" placeholder=\"https://www.youtube.com/watch?v=...\"></label><div class=\"form-two\"><label>लेखक<input id=\"author\" value=\"लोकहित महाराष्ट्र डिजिटल डेस्क\"></label><label>URL / Slug (नवीन लेखासाठी)<input id=\"slug\" spellcheck=\"false\" placeholder=\"news-2026-...\"></label></div><label>बातमीचा फोटो <input id=\"photo\" type=\"file\" accept=\"image/jpeg,image/png,image/webp\"><small>फोटो निवडल्यास प्रकाशनावेळी योग्य आकाराचा फोटो Server मध्ये जोडला जाईल. ८ MB पेक्षा लहान फोटो वापरा.</small></label><div id=\"image-preview\" class=\"photo-preview\"></div><label class=\"check-row\"><input type=\"checkbox\" id=\"featured\"> मुख्य बातमी म्हणून दाखवा</label><div class=\"editor-actions\"><button class=\"btn btn-light\" id=\"preview\" type=\"button\">👁 पूर्वावलोकन</button><button class=\"btn btn-primary\" type=\"submit\" id=\"publish\">💾 Server वर जतन करा</button><button class=\"btn btn-danger\" id=\"delete\" type=\"button\" hidden>बातमी काढा</button></div><p id=\"editor-status\" class=\"status\" role=\"status\"></p></form><div id=\"live-preview\" class=\"live-preview\" hidden></div></section></div></section>\n<section id=\"cms-menu\" class=\"cms-tab-panel\" hidden>\n<div class=\"cms-section-header\"><div><h2>☰ मेनू व्यवस्थापन</h2><p>मेनूचे नाव, लिंक, क्रम आणि दिसण्याची स्थिती ठरवा.</p></div><a href=\"https://catonpe-droid.github.io/lokhit-maharashtra/\" class=\"btn btn-light\" target=\"_blank\" rel=\"noopener\">वेबसाइट ↗</a></div>\n<div class=\"cms-card\"><h3>मुख्य मेनू <span id=\"menu-count\" class=\"cms-count\"></span></h3><div id=\"cms-menu-list\" class=\"cms-manage-list\"></div>\n<form id=\"menu-add-form\" class=\"cms-add-form\">\n<label>नाव<input id=\"menu-add-title\" maxlength=\"65\" required placeholder=\"उदा. रोजगार\"></label>\n<label>लिंक (साइटमधील पाथ)<input id=\"menu-add-href\" list=\"cms-link-options\" required placeholder=\"उदा. vibhag/rojgar/\"></label>\n<datalist id=\"cms-link-options\"><option value=\"tajya-batmya/\"></option><option value=\"vibhag/maharashtra/\"></option><option value=\"vibhag/marathwada/\"></option><option value=\"vibhag/dushkal/\"></option><option value=\"vibhag/sheti/\"></option><option value=\"vibhag/shasan-yojana/\"></option><option value=\"vibhag/pani/\"></option><option value=\"vibhag/mahila-vikas/\"></option><option value=\"vibhag/rojgar/\"></option><option value=\"video/\"></option><option value=\"live-tv/\"></option><option value=\"about/\"></option><option value=\"contact/\"></option></datalist>\n<button type=\"submit\" class=\"btn btn-light\">+ मेनू जोडा</button></form>\n<div class=\"cms-actions\"><button type=\"button\" id=\"menu-save\" class=\"btn btn-primary\">💾 मेनू प्रकाशित करा</button><span id=\"menu-status\" class=\"status\" role=\"status\"></span></div>\n<p class=\"cms-hint\">↑ ↓ बटणांनी क्रम बदला. बंद केलेले मेनू वेबसाइटवर दिसणार नाहीत. बाहेरील URL ऐवजी साइटमधील पाथ वापरा.</p></div></section>\n<section id=\"cms-slider\" class=\"cms-tab-panel\" hidden>\n<div class=\"cms-section-header\"><div><h2>▣ मुख्यपृष्ठ स्लायडर</h2><p>फोटोसह बातम्या जोडा आणि स्लायडचा क्रम बदला.</p></div><a href=\"https://catonpe-droid.github.io/lokhit-maharashtra/\" class=\"btn btn-light\" target=\"_blank\" rel=\"noopener\">मुख्यपृष्ठ ↗</a></div>\n<div class=\"cms-card\"><h3>स्लायडरमध्ये निवडलेल्या बातम्या <span id=\"slider-count\" class=\"cms-count\"></span></h3>\n<div id=\"cms-slider-list\" class=\"cms-manage-list\"></div>\n<form id=\"slider-add-form\" class=\"cms-add-form\"><label>बातमी निवडा<select id=\"slider-add-post\" required><option value=\"\">बातमी निवडा…</option></select></label><button type=\"submit\" class=\"btn btn-light\">+ स्लायडरमध्ये जोडा</button></form>\n<label class=\"cms-inline-field\">स्लायड किती सेकंदांनी बदलेल? <select id=\"slider-seconds\"><option value=\"4\">४ सेकंद</option><option value=\"5\">५ सेकंद</option><option value=\"6\">६ सेकंद</option><option value=\"8\">८ सेकंद</option><option value=\"10\">१० सेकंद</option><option value=\"12\">१२ सेकंद</option></select></label>\n<div class=\"cms-actions\"><button type=\"button\" id=\"slider-save\" class=\"btn btn-primary\">💾 स्लायडर प्रकाशित करा</button><span id=\"slider-status\" class=\"status\" role=\"status\"></span></div><p class=\"cms-hint\">फोटो हा संबंधित बातमीतील फोटो आहे. फोटो बदलण्यासाठी बातमी संपादित करा. १० स्लायडपर्यंत निवडू शकता.</p></div></section>\n<section id=\"cms-breaking\" class=\"cms-tab-panel\" hidden>\n<div class=\"cms-section-header\"><div><h2>⚡ चालणारी ब्रेकिंग न्यूज पट्टी</h2><p>स्क्रीनवर सतत उजवीकडून डावीकडे सरकणारे मथळे.</p></div></div>\n<form id=\"breaking-form\" class=\"cms-card\">\n<label class=\"cms-check\"><input type=\"checkbox\" id=\"breaking-enabled\"> ब्रेकिंग न्यूज पट्टी सुरू ठेवा</label>\n<label>बातम्यांचे मथळे<select id=\"breaking-mode\"><option value=\"latest\">नवीन बातम्यांचे मथळे आपोआप</option><option value=\"custom\">स्वतः लिहिलेले मथळे</option></select></label>\n<label>सानुकूल मथळे (प्रत्येक ओळीत एक)<textarea id=\"breaking-custom\" rows=\"7\" placeholder=\"पहिली महत्त्वाची बातमी…&#10;दुसरी महत्त्वाची बातमी…\"></textarea></label>\n<p class=\"cms-hint\">ब्रेकिंग पट्टी सर्व पानांवर सतत स्क्रोल होईल; वाचक माऊस ठेवल्यावर ती थांबेल.</p>\n<div class=\"cms-actions\"><button type=\"submit\" id=\"breaking-save\" class=\"btn btn-primary\">💾 ब्रेकिंग न्यूज प्रकाशित करा</button><span id=\"breaking-status\" class=\"status\" role=\"status\"></span></div></form></section>\n<section id=\"cms-settings\" class=\"cms-tab-panel\" hidden>\n<div class=\"cms-section-header\"><div><h2>⚙️ वेबसाइट सेटिंग्ज</h2><p>ब्रँडिंग, संपर्क, सोशल मीडिया आणि Live TV माहिती.</p></div></div>\n<form id=\"settings-form\" class=\"cms-card\">\n<div class=\"form-two\"><label>वेबसाइट नाव<input id=\"setting-name\" maxlength=\"90\" required></label><label>टॅगलाइन<input id=\"setting-tagline\" maxlength=\"180\"></label></div>\n<label>SEO वर्णन<textarea id=\"setting-description\" rows=\"3\" maxlength=\"300\"></textarea></label>\n<div class=\"form-two\"><label>संपादकाचे नाव<input id=\"setting-editor_name\" maxlength=\"120\"></label><label>संपर्क ईमेल<input id=\"setting-contact_email\" type=\"email\"></label></div>\n<h3>🔴 YouTube Live TV</h3>\n<div class=\"form-two\"><label>YouTube व्हिडिओ / Live URL<input id=\"setting-youtube_live_url\" type=\"url\" placeholder=\"https://www.youtube.com/watch?v=...\"></label><label>चॅनेलचे नाव<input id=\"setting-youtube_live_provider\"></label></div>\n<div class=\"form-two\"><label>YouTube चॅनेल ID<input id=\"setting-youtube_live_channel_id\" placeholder=\"UC...\"></label><label>चॅनेल लिंक<input id=\"setting-youtube_live_channel_url\" type=\"url\"></label></div>\n<h3>सोशल मीडिया</h3>\n<div class=\"form-two\"><label>YouTube<input id=\"setting-youtube_url\" type=\"url\"></label><label>Facebook<input id=\"setting-facebook_url\" type=\"url\"></label><label>Instagram<input id=\"setting-instagram_url\" type=\"url\"></label><label>X / Twitter<input id=\"setting-twitter_url\" type=\"url\"></label></div>\n<p class=\"cms-hint\">Server configuration आणि live वेबसाइट URL सुरक्षिततेसाठी या फॉर्ममध्ये बदलता येत नाहीत.</p>\n<div class=\"cms-actions\"><button type=\"submit\" id=\"settings-save\" class=\"btn btn-primary\">💾 सेटिंग्ज प्रकाशित करा</button><span id=\"settings-status\" class=\"status\" role=\"status\"></span></div></form></section>\n</section></main>\n<script>\n'use strict';\n(()=>{\nconst $=id=>document.getElementById(id);\nconst BROWSER_KEY=\"lokhit_old_cms_session_v2\";\nlet sessionToken='',current=null,records=[],loggedIn=false,selectedEditor=null;\nconst status=(message,error=false,target='editor-status')=>{\n const node=$(target);if(!node)return;\n node.textContent=message||'';node.className=error?'status error':'status';\n};\nconst escapeHTML=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&quot;'}[c]));\nfunction gas(name,...args){\n return new Promise((resolve,reject)=>{\n  google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(new Error(e.message||'Server प्रतिसाद नाही.')))[name](...args);\n });\n}\nasync function api(path,method='GET',body=null){\n if(!sessionToken)throw Error('PIN ने पुन्हा Login करा.');\n if(path==='/posts'&&method==='GET')return gas('listNews',sessionToken);\n if(path==='/post'&&method==='PUT')return gas('saveNews',sessionToken,body.article,body.image);\n if(path.startsWith('/post?slug=')&&method==='DELETE')return gas('deleteNews',sessionToken,decodeURIComponent(path.split('slug=')[1]));\n if(path==='/editor-names'&&method==='PUT')return gas('updateEditorNames',sessionToken,body.editors);\n if(path.startsWith('/file?path=')&&method==='GET')return gas('readCmsJson',sessionToken,decodeURIComponent(path.split('path=')[1]));\n if(path==='/file'&&method==='PUT')return gas('writeCmsJson',sessionToken,body.path,body.data);\n throw Error('अवैध Server विनंती.');\n}\nasync function editors(){\n const out=await gas('publicEditorInfo');\n const sel=$('editor-choice');sel.replaceChildren();\n const blank=document.createElement('option');blank.value='';blank.textContent='— Editor निवडा —';sel.append(blank);\n out.forEach(e=>{const o=document.createElement('option');o.value=String(e.id);o.textContent=e.name;sel.append(o)});\n return out;\n}\nfunction rememberToken(value){\n try{localStorage.setItem(BROWSER_KEY,value)}catch(e){}\n}\nfunction removeRemembered(){\n try{localStorage.removeItem(BROWSER_KEY)}catch(e){}\n}\nasync function activate(user){\n selectedEditor=user;\n loggedIn=true;$('login').hidden=true;$('dashboard').hidden=false;\n $('pin-code').value='';$('author').value=user.name;\n $('publish').disabled=false;\n try{\n  await loadPosts();\n  await loadEditorNames();\n  document.dispatchEvent(new Event('lokhitcms:ready'));\n  status('✅ '+user.name+' म्हणून Login झाले. बातम्या प्रकाशित करता येतील.');\n }catch(err){status('Admin डेटा लोड करताना अडचण: '+err.message,true)}\n}\nasync function login(e){\n e.preventDefault();\n const pin=$('pin-code').value,selected=$('editor-choice').value,btn=$('login-btn');\n if(!/^\\d{6}$/.test(pin)||!selected){status('PIN आणि Editor नाव निवडा.',true,'login-status');return;}\n btn.disabled=true;status('PIN तपासत आहे...',false,'login-status');\n try{\n  const result=await gas('loginAdmin',pin,Number(selected));\n  sessionToken=result.token;\n  if($('remember').checked)rememberToken(sessionToken);else removeRemembered();\n  await activate(result.editor);\n }catch(err){status(err.message,true,'login-status')}\n finally{btn.disabled=false}\n}\nasync function restore(){\n let saved='';\n try{saved=localStorage.getItem(BROWSER_KEY)||''}catch(e){}\n if(!saved)return;\n status('मागील Login तपासत आहे...',false,'login-status');\n try{\n  const res=await gas('verifySession',saved);\n  sessionToken=saved;await activate(res.editor);\n }catch(e){removeRemembered();sessionToken='';status('PIN टाकून पुन्हा Login करा.',false,'login-status')}\n}\nasync function loadEditorNames(){\n try{\n  const all=await gas('publicEditorInfo'),root=$('editor-name-fields');\n  root.replaceChildren();\n  all.forEach(e=>{\n   const label=document.createElement('label');label.textContent='Editor '+e.id;\n   const input=document.createElement('input');input.type='text';input.required=true;input.maxLength=70;\n   input.value=e.name;input.dataset.editorId=String(e.id);label.append(input);root.append(label);\n  });\n }catch(e){status(e.message,true,'editor-names-status')}\n}\nasync function saveEditorNames(ev){\n ev.preventDefault();const button=$('save-editor-names');button.disabled=true;\n try{\n  const names=Array.from($('editor-name-fields').querySelectorAll('[data-editor-id]')).map(e=>e.value.trim());\n  const result=await api('/editor-names','PUT',{editors:names});\n  const updated=result.editors.find(e=>e.id===selectedEditor.id);\n  if(updated){selectedEditor=updated;$('author').value=updated.name}\n  status('✅ दहा Editor नावे जतन झाली.',false,'editor-names-status');\n }catch(e){status(e.message,true,'editor-names-status')}\n finally{button.disabled=false}\n}\n async function loadPosts(){\n  $('post-list').textContent='बातम्या वाचत आहे…';\n  try{\n   const data=await api('/posts');\n   records=(data.posts||[]).sort((a,b)=>(b.date||'').localeCompare(a.date||''));\n   renderList();\n  }catch(e){$('post-list').textContent='बातम्या लोड होत नाहीत: '+e.message;throw e}\n }\n function renderList(){const q=$('filter-posts').value.trim().toLowerCase(), list=records.filter(p=>(p.title+' '+p.category).toLowerCase().includes(q));\n  $('post-list').innerHTML='';if(!list.length){$('post-list').textContent='बातम्या आढळल्या नाहीत.';return}\n  for(const p of list){const b=document.createElement('button');b.type='button';b.className='admin-post'+(current?._path===p._path?' active':'');const strong=document.createElement('strong');strong.textContent=p.title;const small=document.createElement('small');small.textContent=p.category+' · '+(p.status==='draft'?'मसुदा':'प्रकाशित');b.append(strong,small);b.onclick=()=>openPost(p);$('post-list').appendChild(b)}\n }\n function newPost(){current=null;$('post-form').reset();$('author').value=selectedEditor?.name||'Editor';$('category').value='दुष्काळ विशेष';$('post-status').value='published';$('editor-heading').textContent='नवीन बातमी';$('edit-state').textContent='नवीन';$('slug').disabled=false;$('delete').hidden=true;$('image-preview').innerHTML='';$('live-preview').hidden=true;status('');renderList()}\n function openPost(p){current=p;$('title').value=p.title||'';$('description').value=p.description||'';$('category').value=p.category||'महाराष्ट्र';$('body').value=p.body||'';$('video').value=p.video||'';$('author').value=p.author||'';$('slug').value=p.slug||'';$('slug').disabled=true;$('post-status').value=p.status||'published';$('featured').checked=!!p.featured;$('editor-heading').textContent='बातमी संपादित करा';$('edit-state').textContent='अद्ययावत';$('delete').hidden=false;$('image-preview').innerHTML='';if(p.image){let im=document.createElement('img');im.src=String(p.image||'').startsWith('https://')?p.image:'https://catonpe-droid.github.io/lokhit-maharashtra/'+p.image;im.alt='सध्याचा फोटो';$('image-preview').appendChild(im)}$('live-preview').hidden=true;status('');renderList();window.scrollTo({top:0,behavior:'smooth'})}\n function makeSlug(){const supplied=$('slug').value.trim();if(supplied)return supplied;let time=new Date().toISOString().replace(/\\D/g,'').slice(0,14);return 'news-'+time+'-'+Math.random().toString(36).slice(2,6)}\n async function imageData(file){\n  if(file.size>8*1024*1024)throw Error('फोटो ८ MB पेक्षा लहान हवा.');\n  const bitmap=await createImageBitmap(file);\n  let width=Math.min(1100,bitmap.width),height=Math.round(bitmap.height*width/bitmap.width);\n  const canvas=document.createElement('canvas');\n  const ctx=canvas.getContext('2d');\n  let quality=.8,base64='';\n  for(let n=0;n<7;n++){\n   canvas.width=width;canvas.height=height;ctx.drawImage(bitmap,0,0,width,height);\n   base64=canvas.toDataURL('image/jpeg',quality).split(',')[1];\n   if(base64.length<980000)break;\n   quality=Math.max(.46,quality-.07);\n   width=Math.round(width*.9);height=Math.round(height*.9);\n  }\n  bitmap.close();\n  if(base64.length>=1050000)throw Error('फोटो खूप मोठा आहे. कृपया कमी आकाराचा फोटो वापरा.');\n  return {type:'image/jpeg',data:base64};\n }\n async function submit(ev){\n  ev.preventDefault();\n  if(!loggedIn){status('आधी PIN ने Login करा.',true);return}\n  const slug=current?.slug||makeSlug();\n  if(!/^[a-z0-9][a-z0-9_-]{2,110}$/i.test(slug)){status('URL/Slug इंग्रजी अक्षरे, अंक, - किंवा _ मध्ये द्या.',true);return}\n  $('publish').disabled=true;\n  status('बातमी Server वर जतन करत आहे…');\n  try{\n   const file=$('photo').files[0];\n   const image=file?await imageData(file):null;\n   const article={slug,title:$('title').value.trim(),description:$('description').value.trim(),\n    body:$('body').value.trim(),category:$('category').value,\n    author:$('author').value.trim(),video:$('video').value.trim(),\n    featured:$('featured').checked,status:$('post-status').value};\n   const result=await api('/post','PUT',{article,image});\n   await loadPosts();\n   const found=records.find(p=>p.slug===result.slug);\n   if(found)openPost(found);\n   status(result.status==='draft'?'✅ मसुदा Server वर जतन झाला.':'✅ बातमी Save झाली! वेबसाइटचा स्वयंचलित Build सुरू होईल.');\n  }catch(e){status('जतन अयशस्वी: '+e.message,true)}\n  finally{$('publish').disabled=false}\n }\n async function remove(){\n  if(!loggedIn||!current||!confirm('ही बातमी कायमची काढायची?'))return;\n  try{await api('/post?slug='+encodeURIComponent(current.slug),'DELETE');newPost();await loadPosts();status('✅ बातमी काढली.')}\n  catch(e){status('बातमी काढता आली नाही: '+e.message,true)}\n }\n function preview(){const box=$('live-preview');box.replaceChildren();let note=document.createElement('p');note.className='preview-note';note.textContent='पूर्वावलोकन — ही माहिती अजून प्रकाशित केलेली नाही.';let h=document.createElement('h2');h.textContent=$('title').value;let desc=document.createElement('strong');desc.textContent=$('description').value;box.append(note,h,desc);for(const para of $('body').value.split(/\\n\\s*\\n/).filter(Boolean)){const p=document.createElement('p');p.textContent=para;box.appendChild(p)}box.hidden=false;box.scrollIntoView({behavior:'smooth',block:'start'})}\n // Controlled publishing bridge for the CMS tabs; credentials remain private in this closure.\n window.LokhitCMS={\n  canPublish:()=>loggedIn,\n  posts:()=>records.map(({slug,title,description,category,image,status})=>({slug,title,description,category,image,status})),\n  async readJson(path){return api('/file?path='+encodeURIComponent(path))},\n  async writeJson(path,data){return api('/file','PUT',{path,data})}\n };\n $('post-form').addEventListener('invalid',event=>{\n  const label=event.target.closest('label');\n  status('कृपया आवश्यक माहिती भरा: '+(label?.textContent?.trim().slice(0,60)||'शीर्षक, सारांश आणि बातमीचा मजकूर'),true);\n },true);\n\n\n$('login-form').addEventListener('submit',login);\n$('post-form').addEventListener('submit',submit);\n$('new-post').addEventListener('click',newPost);\n$('filter-posts').addEventListener('input',renderList);\n$('preview').addEventListener('click',preview);\n$('delete').addEventListener('click',remove);\n$('toggle-editor-names').addEventListener('click',()=>{\n const panel=$('editor-names-panel');panel.hidden=!panel.hidden;\n if(!panel.hidden)panel.scrollIntoView({behavior:'smooth',block:'start'});\n});\n$('editor-names-form').addEventListener('submit',saveEditorNames);\n$('logout').addEventListener('click',()=>{\n const oldToken=sessionToken;\n sessionToken='';loggedIn=false;records=[];current=null;selectedEditor=null;\n removeRemembered();\n $('login').hidden=false;$('dashboard').hidden=true;$('pin-code').value='';\n document.dispatchEvent(new Event('lokhitcms:logout'));\n status('Logout झाले. PIN ने पुन्हा प्रवेश करा.',false,'login-status');\n if(oldToken)gas('logoutAdmin',oldToken).catch(()=>{});\n});\n$('photo').addEventListener('change',()=>{\n const file=$('photo').files[0];if(!file)return;\n const image=document.createElement('img');\n image.alt='फोटो पूर्वावलोकन';image.src=URL.createObjectURL(file);\n $('image-preview').replaceChildren(image);\n});\neditors().catch(e=>status(e.message,true,'login-status'));\nrestore();\n})();\n</script>\n<script src=\"https://catonpe-droid.github.io/lokhit-maharashtra/assets/js/cms.js?v=sheetcms20261101\"></script></body></html>";
