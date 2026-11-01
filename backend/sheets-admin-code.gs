/**
 * लोकहित महाराष्ट्र — Google Sheets News Admin
 * Paste this ONE file into Extensions > Apps Script > Code.gs
 * Deploy as Web App, Execute as Me, Access: Anyone.
 * Main website stays on GitHub Pages; no GitHub token or Cloudflare required.
 */
const LOKHIT_BOOK_ID = "1vLW3s18KTUACexCHvYx0NjVh4M67_yavzIVAhO_DIrk";
const LOKHIT_SESSION_SECONDS = 6*60*60;
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
function editorOptions(){
 return entries_("EDITORS").filter(row=>String(row[2]||"YES").toUpperCase()!=="NO").map(row=>({id:Number(row[0]),name:String(row[1]||"").trim()})).filter(x=>x.id>=1&&x.id<=10&&x.name);
}
function loginAdmin(pin,id){
 const lock=LockService.getScriptLock();lock.waitLock(10000);
 try{
  const cache=CacheService.getScriptCache(),failed=Number(cache.get("PIN_FAILS")||"0");
  if(failed>=6)throw Error("खूप चुकीचे प्रयत्न झाले. १५ मिनिटांनी पुन्हा प्रयत्न करा.");
  const salt=security_("PIN_SALT"),saved=security_("PIN_HASH");
  if(!salt||!saved)throw Error("Sheet मध्ये आधी PIN सेट करा: लोकहित Admin → PIN सेट करा.");
  if(typeof pin!=="string"||!/^\d{6}$/.test(pin)||hashPin_(pin,salt)!==saved){
   cache.put("PIN_FAILS",String(failed+1),900);
   throw Error("PIN चुकीचा आहे.");
  }
  const editor=editorOptions().find(x=>x.id===Number(id));
  if(!editor)throw Error("Editor निवडा.");
  const token=Utilities.getUuid().replace(/-/g,"")+Utilities.getUuid().replace(/-/g,"");
  cache.put("sess:"+token,JSON.stringify({id:editor.id,name:editor.name,version:security_("LOGIN_VERSION")}),LOKHIT_SESSION_SECONDS);
  cache.remove("PIN_FAILS");
  return {ok:true,token,editor};
 }finally{lock.releaseLock();}
}
function session_(token){
 if(!/^[a-f0-9]{64}$/i.test(String(token||"")))throw Error("PIN ने पुन्हा Login करा.");
 const raw=CacheService.getScriptCache().get("sess:"+token);
 if(!raw)throw Error("Login संपला आहे. PIN पुन्हा टाका.");
 const value=JSON.parse(raw);
 if(value.version!==security_("LOGIN_VERSION"))throw Error("PIN बदलल्यामुळे पुन्हा Login करा.");
 const ed=editorOptions().find(x=>x.id===value.id);
 if(!ed)throw Error("Editor उपलब्ध नाही.");
 return ed;
}
function verifySession(token){const ed=session_(token);return {ok:true,editor:ed};}
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
