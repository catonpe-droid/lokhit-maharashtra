/**
 * MLVMData – महाराष्ट्र लोक विकास मंच / ड्राऊट वॉरियर
 * Backend: standalone Google Apps Script Web App
 * Execute as: Me; access: Anyone; Google Sheet remains PRIVATE.
 */
const MLVM_SHEET_ID = '16PGT_aimpCJHxJBuCrs5LqAe2THiChv1eibLgruHJws';
const MLVM_TAB = 'NGO_नोंदणी';
const MLVM_DISTRICTS = 'अहिल्यानगर|अकोला|अमरावती|छत्रपती संभाजीनगर|बीड|भंडारा|बुलढाणा|चंद्रपूर|धाराशिव|धुळे|गडचिरोली|गोंदिया|हिंगोली|जळगाव|जालना|कोल्हापूर|लातूर|मुंबई शहर|मुंबई उपनगर|नागपूर|नांदेड|नंदुरबार|नाशिक|पालघर|परभणी|पुणे|रायगड|रत्नागिरी|सांगली|सातारा|सिंधुदुर्ग|सोलापूर|ठाणे|वर्धा|वाशिम|यवतमाळ'.split('|');

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('MLVM | ड्राऊट वॉरियर संस्था नोंदणी')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport','width=device-width,initial-scale=1');
}

function norm_(v) {
  return String(v || '').normalize('NFKC').toLocaleLowerCase('en')
    .replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[.।,'\"\\/()\[\]{}-]/g, ' ')
    .replace(/\s+/g,' ').trim();
}
function clean_(v,max) {
  let s=String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').slice(0,max);
  return /^[=+@]/.test(s) ? '\''+s : s; // spreadsheet formula injection prevention
}
function failure_(message) { return {ok:false,message}; }

/** Only append registrations. Never return existing names, phones, or sheet data publicly. */
function saveNgo(raw) {
  try {
    if (!raw || raw.honeypot) return failure_('नोंदणी स्वीकारता आली नाही.');
    if (!raw.formStarted || Date.now()-Number(raw.formStarted)<1800)
      return failure_('कृपया फॉर्म पूर्ण भरून पुन्हा प्रयत्न करा.');
    const d={
      district:clean_(raw.district,65), name:clean_(raw.name,150),
      head:clean_(raw.head,120), phone:String(raw.phone||'').replace(/\D/g,''),
      taluka:clean_(raw.taluka,180), villages:Number(raw.villages),
      capacity:clean_(raw.capacity,1000), workers:Number(raw.workers),
      reg:clean_(raw.reg,90), email:clean_(raw.email,160)
    };
    if (!MLVM_DISTRICTS.includes(d.district)) return failure_('योग्य जिल्हा निवडा.');
    if (d.name.length<3||d.head.length<3||d.taluka.length<2||d.capacity.length<12)
      return failure_('सर्व आवश्यक माहिती पूर्ण भरा.');
    if (!/^[6-9]\d{9}$/.test(d.phone)) return failure_('योग्य १० अंकी मोबाइल क्रमांक भरा.');
    if (!Number.isInteger(d.villages)||d.villages<1||d.villages>10000)
      return failure_('कार्यक्षेत्रातील गावांची योग्य संख्या भरा.');
    if (!Number.isInteger(d.workers)||d.workers<0||d.workers>100000)
      return failure_('कार्यकर्त्यांची योग्य संख्या भरा.');
    if (d.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
      return failure_('ई-मेल पत्ता तपासा.');
    if (raw.consent!==true) return failure_('माहिती वापरासाठी संमती आवश्यक आहे.');

    const lock=LockService.getScriptLock(); lock.waitLock(25000);
    try {
      const sh=SpreadsheetApp.openById(MLVM_SHEET_ID).getSheetByName(MLVM_TAB);
      if (!sh) return failure_('सध्या नोंदणी सेवा उपलब्ध नाही. कृपया नंतर पुन्हा प्रयत्न करा.');
      const last=sh.getLastRow();
      const n=norm_(d.name),r=norm_(d.reg);
      if(last>1) {
        // D:O includes organisation name D (index 0), registration no K (index 7), duplicate key O (index 11)
        const existing=sh.getRange(2,4,last-1,12).getDisplayValues();
        const duplicate=existing.some(row=>norm_(row[0])===n||(r && norm_(row[7])===r)||(row[11] && row[11]===n));
        if(duplicate) return failure_('ही संस्था आधीच नोंदणीकृत आहे. दुबार नोंदणी स्वीकारली जाणार नाही. जिल्हा समन्वयकांशी संपर्क साधा.');
      }
      const ids=last>1?sh.getRange(2,1,last-1,1).getDisplayValues().flat():[];
      let max=0;ids.forEach(s=>{const m=String(s).match(/^MLVM-\d{2}-(\d+)$/);if(m)max=Math.max(max,Number(m[1]));});
      const year=Utilities.formatDate(new Date(),'Asia/Kolkata','yy');
      const id='MLVM-'+year+'-'+String(max+1).padStart(5,'0');
      const timestamp=Utilities.formatDate(new Date(),'Asia/Kolkata','yyyy-MM-dd HH:mm:ss');
      sh.appendRow([id,timestamp,d.district,d.name,d.head,d.phone,d.taluka,d.villages,d.capacity,d.workers,d.reg,d.email,'प्राप्त','',n]);
      SpreadsheetApp.flush();
      return {ok:true,id,organization:d.name,district:d.district,message:'आपली संस्था नोंदणी यशस्वीरीत्या प्राप्त झाली आहे!'};
    } finally {lock.releaseLock();}
  } catch(err) {
    console.error(err && err.message || err);
    return failure_('सध्या नोंदणी पूर्ण करता आली नाही. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.');
  }
}
