/**
 * MLVM Dashboard — read-only public aggregate endpoint.
 * Deploy as Apps Script Web App: execute as sheet owner; access Anyone.
 * Only anonymous district totals/activities/dates are returned; NEVER row-level details.
 * The registration Google Sheet stays private.
 */
const MLVM_LIVE_SHEET_ID = '16PGT_aimpCJHxJBuCrs5LqAe2THiChv1eibLgruHJws';
const MLVM_LIVE_TAB = 'NGO_नोंदणी';
const MLVM_LIVE_TZ = 'Asia/Kolkata';
const MLVM_LIVE_DISTRICTS = 'अहिल्यानगर|अकोला|अमरावती|छत्रपती संभाजीनगर|बीड|भंडारा|बुलढाणा|चंद्रपूर|धाराशिव|धुळे|गडचिरोली|गोंदिया|हिंगोली|जळगाव|जालना|कोल्हापूर|लातूर|मुंबई शहर|मुंबई उपनगर|नागपूर|नांदेड|नंदुरबार|नाशिक|पालघर|परभणी|पुणे|रायगड|रत्नागिरी|सांगली|सातारा|सिंधुदुर्ग|सोलापूर|ठाणे|वर्धा|वाशिम|यवतमाळ'.split('|');
const MLVM_LIVE_ACTIVITIES = [
  { key:'water', label:'जलसंधारण व पाणी', rx:/पाणी|जल|विहीर|विहिर|गाळ|बंधारा|सिंचन|तलाव|वॉटर|water/i },
  { key:'livestock', label:'चारा व पशुधन', rx:/चारा|पशु|जनावर|गाय|गुरे|बकरी|शेळी|fodder|livestock/i },
  { key:'survey', label:'सर्वेक्षण व लाभार्थी', rx:/सर्वे|सर्व्हे|लाभार्थी|माहिती संकलन|डेटा|survey|mapping/i },
  { key:'scheme', label:'शासकीय योजना व समन्वय', rx:/शासन|शासकीय|योजना|प्रशासन|ग्रामपंचायत|समन्वय|convergence|पंचायत/i },
  { key:'awareness', label:'जनजागृती व प्रशिक्षण', rx:/जागृती|प्रशिक्षण|शिबिर|प्रबोधन|मार्गदर्शन|बैठक|awareness|training/i },
  { key:'relief', label:'मदत व साहित्य वितरण', rx:/मदत|वितरण|वाटप|किट|धान्य|राशन|relief|distribution/i },
  { key:'livelihood', label:'शेती व उपजीविका', rx:/शेती|कृषी|बियाण|रोजगार|उपजीविका|livelihood|agriculture/i },
  { key:'community', label:'समुदाय व सामाजिक आधार', rx:/महिला|बाल|समुदाय|सामाजिक|दलित|आदिवासी|गट|समूह|community/i }
];
function doGet(e) {
  // JSONP is used only for public aggregate data because GitHub Pages and Apps
  // Script live on different origins; callbacks are NOT accepted from requests.
  try {
    const result = mlvmLiveSnapshot_();
    return ContentService.createTextOutput('window.MLVM_LIVE_JSONP('+JSON.stringify(result)+');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } catch (err) {
    console.error(err);
    return ContentService.createTextOutput('window.MLVM_LIVE_JSONP('+JSON.stringify({ok:false,error:'Live statistics temporarily unavailable'})+');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}
function mlvmLiveNumber_(v) {
  const n=Number(String(v||'0').replace(/,/g,'').trim());
  return Number.isFinite(n)&&n>0?Math.floor(n):0;
}
function mlvmLiveSnapshot_() {
  const cache=CacheService.getScriptCache();
  const cached=cache.get('mlvm-public-dashboard-v2');
  if(cached) return JSON.parse(cached);
  const sheet=SpreadsheetApp.openById(MLVM_LIVE_SHEET_ID).getSheetByName(MLVM_LIVE_TAB);
  if(!sheet) throw new Error('Registration tab unavailable');
  const count=Math.max(0,sheet.getLastRow()-1);
  const rows=count?sheet.getRange(2,1,count,15).getDisplayValues():[];
  const names=MLVM_LIVE_DISTRICTS;
  const districts=names.map(name=>({name,count:0,workers:0,villages:0,verified:0,activities:{}}));
  const byDistrict={};districts.forEach(d=>{byDistrict[d.name]=d; MLVM_LIVE_ACTIVITIES.forEach(a=>{d.activities[a.key]=0;});});
  const dateCounts={}, activityCounts={};MLVM_LIVE_ACTIVITIES.forEach(a=>{activityCounts[a.key]=0;});
  let organizations=0,workers=0,villages=0,verified=0,tagged=0;
  rows.forEach(row=>{
    if(!String(row[0]||'').trim())return;
    const d=byDistrict[String(row[2]||'').trim()];
    if(!d)return; // only valid Maharashtra districts are counted
    organizations++;d.count++;
    const w=mlvmLiveNumber_(row[9]),v=mlvmLiveNumber_(row[7]);
    workers+=w;villages+=v;d.workers+=w;d.villages+=v;
    const status=String(row[12]||'').trim();
    if(/^(पडताळलेली|पडताळणी पूर्ण|सत्यापित|verified|approved|मान्य)$/i.test(status)){verified++;d.verified++;}
    const when=String(row[1]||'').slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(when))dateCounts[when]=(dateCounts[when]||0)+1;
    const description=String(row[8]||'');
    let matched=false;
    MLVM_LIVE_ACTIVITIES.forEach(a=>{if(a.rx.test(description)){d.activities[a.key]++;activityCounts[a.key]++;matched=true;}});
    if(matched)tagged++;
  });
  const now=new Date();
  const snapshotAt=Utilities.formatDate(now,MLVM_LIVE_TZ,'yyyy-MM-dd HH:mm:ss');
  const result={ok:true,schemaVersion:1,live:true,snapshotAt,
    generatedOn:snapshotAt.slice(0,10),
    source:'महाराष्ट्र लोक विकास मंच — प्राप्त संस्था नोंदणी (स्वयंघोषित माहिती)',
    totals:{organizations,districtsWithRegistrations:districts.filter(d=>d.count>0).length,districtsTotal:36,workers,villages,verified},
    districts,
    activities:MLVM_LIVE_ACTIVITIES.map(a=>({key:a.key,label:a.label,count:activityCounts[a.key]})),
    dates:Object.keys(dateCounts).sort().slice(-14).map(date=>({date,count:dateCounts[date]})),
    quality:{notYetVerified:organizations-verified,noMatchedCapacityCategory:organizations-tagged,taggedCapacity:tagged}
  };
  const serialized=JSON.stringify(result);
  if(serialized.length<95000)cache.put('mlvm-public-dashboard-v2',serialized,30);
  return result;
}
