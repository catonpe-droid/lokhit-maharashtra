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
function githubPublished_(){
 try{
  const cache=CacheService.getScriptCache();
  const key="GITHUB_ORIGINAL_POSTS_V1";
  let raw=cache.get(key);
  if(!raw){
   const url="https://catonpe-droid.github.io/lokhit-maharashtra/cms-export.json";
   const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true});
   if(response.getResponseCode()!==200)return [];
   raw=response.getContentText("UTF-8");
   if(raw.length<90000)cache.put(key,raw,180);
  }
  const data=JSON.parse(raw);
  return Array.isArray(data)?data.filter(x=>x&&x.slug&&x.status!=="draft")
   .map(x=>({...x,id:String(x.id||x.slug),status:"published",origin:"github"})):[];
 }catch(e){return []}
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
 const seen=new Set(news.map(x=>x.slug));
 for(const item of githubPublished_()){
  if(!seen.has(item.slug)){news.push(item);seen.add(item.slug)}
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
  const saved=jsonCmsRead_("post-"+slug+".json",false);
  const original=saved?null:githubPublished_().find(x=>x.slug===slug);
  const before=saved||original||{};
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
   origin:original||before.origin==="github_override"?"github_override":"drive",
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
 const posts=allNews_().filter(x=>x.status==="published").slice(0,500);
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
 if(p.bridge==="1"){
  const nonce=String(p.nonce||"");
  if(!/^[a-f0-9]{32}$/.test(nonce))return HtmlService.createHtmlOutput("Invalid bridge request.");
  return HtmlService.createHtmlOutput(BRIDGE_HTML_.replaceAll("__NONCE__",nonce))
   .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
   .setTitle("लोकहित महाराष्ट्र Admin Login");
 }
 if(p.feed==="1"){
  const cb=String(p.callback||"");
  if(!/^[A-Za-z_$][A-Za-z0-9_$]{0,90}$/.test(cb))return ContentService.createTextOutput("/* invalid */").setMimeType(ContentService.MimeType.JAVASCRIPT);
  const payload=JSON.stringify(publicFeed_());
  return ContentService.createTextOutput(cb+"("+payload+");").setMimeType(ContentService.MimeType.JAVASCRIPT);
 }
 return HtmlService.createHtmlOutput(
  '<!doctype html><html lang="mr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'+
  '<title>लोकहित महाराष्ट्र GitHub Editor</title></head><body style="font-family:Arial,sans-serif;padding:25px">'+
  '<h2>लोकहित महाराष्ट्र News Admin</h2><p>Editor आता GitHub वेबसाइटवर आहे.</p>'+
  '<p><a href="https://catonpe-droid.github.io/lokhit-maharashtra/admin/" target="_top">मूळ GitHub Editor उघडा →</a></p>'+
  '</body></html>'
 ).setTitle("लोकहित महाराष्ट्र | GitHub Editor")
  .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Tiny authenticated RPC bridge. The full editor UI lives on GitHub Pages. */
const BRIDGE_HTML_ = '<!doctype html><html lang="mr"><head><meta charset="utf-8"><meta name="robots" content="noindex"></head><body>'+
'<script>'+
'(function(){ "use strict";'+
'const nonce="__NONCE__"; const allowed="https://catonpe-droid.github.io";'+
'const permitted=new Set(["publicEditorInfo","editorOptions","loginAdmin","verifySession","logoutAdmin","listNews","saveNews","deleteNews","readCmsJson","writeCmsJson","updateEditorNames"]);'+
'function send(data){window.top.postMessage(Object.assign({topic:"lokhit-sheet-bridge",nonce:nonce},data),allowed)}'+
'function ready(){send({type:"ready"})}'+
'let acknowleded=false; let count=0;'+
'const interval=setInterval(function(){if(acknowledged||count++>25){clearInterval(interval);return;} ready();},1000);'+
'window.addEventListener("message",function(e){'+
'if(e.origin!==allowed)return; const m=e.data||{};'+
'if(m.topic!=="lokhit-sheet-bridge"||m.nonce!==nonce)return;'+
'if(m.type==="ack"){acknowledged=true;clearInterval(interval);return;}'+
'if(m.type!=="rpc"||!Number.isSafeInteger(m.id)||m.id<1||!permitted.has(m.name)||!Array.isArray(m.args)||m.args.length>4)return;'+
'const id=m.id;try{const runner=google.script.run.withSuccessHandler(function(value){send({type:"result",id:id,ok:true,value:value})})'+
'.withFailureHandler(function(err){send({type:"result",id:id,ok:false,error:String(err&&err.message||"Server error").slice(0,400)})});'+
'runner[m.name].apply(runner,m.args);}catch(err){send({type:"result",id:id,ok:false,error:String(err&&err.message||"Error").slice(0,400)})}'+
'}); ready();'+
'})();'+
'<\/script></body></html>';
