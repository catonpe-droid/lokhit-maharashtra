/* MLVM public NGO directory: organisation-level records only. Personal contact details are deliberately excluded. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR9Wl653D8WU3JNusIsfDJapFaKuRnBnBDLjDBWBPBAtDlu7jWrzBDDXqvoUjYE5qqSxWchQ-gt-twM/pub?output=csv';
 const PAGE_SIZE = 15;
 let records = [], page = 0, lastSource = '', isLoading = false;
 const fmt = n => new Intl.NumberFormat('en-IN').format(n);
 const norm = s => String(s ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[\u200b-\u200d\ufeff]/g,'').trim();
 const plain = s => String(s ?? '').trim().slice(0,250);
 const cell = (tr, v, tag='td') => {const c=document.createElement(tag);c.textContent=String(v??'');tr.append(c);return c};
 const label = (name,value) => {const c=document.createElement('div'),b=document.createElement('b');b.textContent=name;c.append(b,document.createTextNode(value||'—'));return c};
 const valid = r => /^MLVM-\d{2}-\d{5,}$/.test(r.id) && r.name.length>1 && !!r.district;
 // Only institutional fields from the published directory are shown in public profiles.
 function publicDetails(row,headers) {
   const privateField=/आधार|आधारकार्ड|पॅन|पासवर्ड|ओटीपी|बँक खाते|खाते क्रमांक|जन्म|वैयक्तिक|संस्थाप्रमुख|प्रतिनिधी|संचालकाचे|अध्यक्षाचे|सचिवाचे|aadhaar|aadhar|password|\botp\b|bank account|account number|birth|personal|contact person|head name|chairperson|secretary|director name|\bpan\b|signature|document upload|कागदपत्र|स्वाक्षरी/i;
   const contact=/मोबाईल|मोबाइल|फोन|दूरध्वनी|ई.?मेल|इमेल|संपर्क|phone|mobile|email|e-mail|contact/i;
   const institutional=/संस्थेचा|संस्थेचे|संस्थेची|संस्थेच्या|संस्था कार्यालय|कार्यालय|organisation|organization|office|institutional|official/i;
   const publicField=/गाव|तालुक|जिल्ह|कार्य|काम|क्षमता|अनुभव|उद्दिष्ट|उपक्रम|क्षेत्र|विषय|दुष्काळ|पाणी|शेती|पशु|महिला|लाभार्थ|पत्ता|वेबसाइट|संस्था प्रकार|स्थापना|नोंदणी|वार्षिक|उलाढाल|एफसीआरए|\bfcra\b|\b12a\b|\b80g\b|village|taluk|district|worker|volunteer|activity|activities|capacity|experience|focus|sector|coverage|beneficiar|address|website|registration|establish|turnover|annual|organisation type|organization type/i;
   return headers.flatMap((raw,i)=>{
     if([0,1,2,3,4,5,6,10,12].includes(i))return [];
     const key=plain(raw),value=String(row[i]??'').trim();
     if(!key||privateField.test(key))return [];
     if(contact.test(key)&&!institutional.test(key))return [];
     if(!publicField.test(key)&&!(contact.test(key)&&institutional.test(key)))return [];
     return [{label:key,value:value||'—'}];
   });
 }
 function fromArray(row,headers=[]) {
   return {
     id:plain(row[0]), date:plain(row[1]),district:plain(row[2]),name:plain(row[3]),
     taluka:plain(row[6]),registration:plain(row[10]),status:plain(row[12]) || 'प्राप्त',details:publicDetails(row,headers)
   };
 }
 function cleanRows(rows) {
   const seen=new Set();
   return rows.filter(r=>{if(!valid(r)||seen.has(r.id))return false;seen.add(r.id);return true})
     .map(r=>({...r,taluka:/^\+?[0-9 ()-]{10,}$/.test(r.taluka)?'':r.taluka}))
     .sort((a,b)=>b.id.localeCompare(a.id,undefined,{numeric:true}));
 }
 function parseCSV(s) {
   const rows=[];let row=[],field='',inside=false;
   s=String(s||'').replace(/^\ufeff/,'');
   for(let i=0;i<s.length;i++) {
     const ch=s[i];
     if(ch==='"'){
       if(inside&&s[i+1]==='"'){field+='"';i++}else inside=!inside;
     } else if(ch===','&&!inside){row.push(field);field=''}
     else if((ch==='\n'||ch==='\r')&&!inside){
       if(ch==='\r'&&s[i+1]==='\n')i++;
       row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';
     }else field+=ch;
   }
   row.push(field);if(row.some(v=>v.trim()))rows.push(row);
   return rows;
 }
 function filtered() {
   const query=norm($('orgSearch').value),district=$('orgDistrict').value;
   return records.filter(r => (!district||r.district===district) &&
      (!query||[r.name,r.id,r.district,r.taluka,r.registration].some(v=>norm(v).includes(query))));
 }
 const profile=document.createElement('dialog');
 profile.className='org-profile';
 profile.setAttribute('aria-labelledby','orgProfileTitle');
 document.body.append(profile);
 const el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n};
 function openProfile(r){
   profile.replaceChildren();
   const head=el('div','org-profile-head');
   const brand=el('div','org-profile-brand','महाराष्ट्र लोक विकास मंच  /  संस्था परिचय');
   const logo=el('img','org-profile-logo');logo.src='../logo.svg';logo.alt='MLVM';brand.prepend(logo);
   const close=el('button','org-profile-close','×');close.type='button';close.setAttribute('aria-label','प्रोफाइल बंद करा');close.addEventListener('click',()=>profile.close());
   const top=el('div','org-profile-top');top.append(brand,close);
   const title=el('h2','org-profile-title',r.name);title.id='orgProfileTitle';
   const tags=el('div','org-profile-tags');tags.append(el('span','',r.id),el('span','',r.district),el('span','',r.status||'प्राप्त'));
   head.append(top,title,tags);
   const body=el('div','org-profile-body');
   const section=(heading,fields)=>{
     const s=el('section','org-profile-section'),h=el('h3','',heading),grid=el('dl','org-profile-grid');
     for(const [key,val] of fields){
       const field=el('div','org-profile-field');
       field.append(el('dt','',key),el('dd','',val||'नोंद उपलब्ध नाही'));grid.append(field);
     }
     s.append(h,grid);body.append(s);
   };
   section('संस्थेची मूलभूत माहिती',[
     ['संस्थेचे नाव',r.name],['MLVM नोंदणी क्रमांक',r.id],['नोंदणी तारीख',r.date],
     ['जिल्हा',r.district],['तालुका / कार्यक्षेत्र',r.taluka],
     ['संस्थेचा अधिकृत नोंदणी क्रमांक',r.registration],['नोंदणी स्थिती',r.status||'प्राप्त']
   ]);
   if(r.details?.length)section('संस्थेचे काम, कार्यक्षेत्र व इतर उपलब्ध माहिती',r.details.map(d=>[d.label,d.value]));
   else body.append(el('p','org-profile-note','अतिरिक्त संस्थात्मक माहिती या उपलब्ध सार्वजनिक नोंदीत नाही.'));
   const footer=el('div','org-profile-footer');
   const note=el('p','org-profile-note','माहिती स्वयंघोषित आहे. नोंदणी म्हणजे शासन मान्यता नाही. अधिकृत संपर्क माहिती MLVM टीमच्या प्रवेशाद्वारे उपलब्ध आहे.');
   const link=el('a','org-profile-link','अधिकृत संपर्क यादी ↗');link.href='../districts/';link.target='_blank';link.rel='noopener';
   const done=el('button','org-profile-done','बंद करा');done.type='button';done.addEventListener('click',()=>profile.close());
   footer.append(note,link,done);body.append(footer);profile.append(head,body);
   if(!profile.open)profile.showModal();close.focus();
 }
 profile.addEventListener('click',e=>{if(e.target===profile)profile.close()});
 const profileButton=(r,text,cls)=>{const b=el('button',cls,text);b.type='button';b.setAttribute('aria-label',r.name+' — संस्थेची संपूर्ण उपलब्ध माहिती पहा');b.addEventListener('click',e=>{e.stopPropagation();openProfile(r)});return b};
 function render() {
   const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
   if(page>=pages)page=pages-1;
   const list=rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
   $('orgRows').replaceChildren();$('orgCards').replaceChildren();
   list.forEach((r,i)=>{
     const tr=document.createElement('tr');
     tr.className='org-profile-row';tr.addEventListener('click',()=>openProfile(r));
     cell(tr,fmt(page*PAGE_SIZE+i+1));
     cell(tr,'').append(profileButton(r,r.id,'org-profile-id-btn'));
     cell(tr,'').append(profileButton(r,r.name,'org-profile-name-btn'));cell(tr,r.district);
     cell(tr,r.taluka||'—');cell(tr,r.registration||'—');
     const td=cell(tr,'');const badge=document.createElement('span');badge.className='org-status';badge.textContent='नोंदणी प्राप्त';td.append(badge);
     $('orgRows').append(tr);
     const card=document.createElement('article');card.className='directory-card';
     const top=document.createElement('div');top.className='directory-card-top';
     const id=document.createElement('span');id.className='directory-card-id';id.textContent=r.id;
     const mark=document.createElement('span');mark.className='org-status';mark.textContent='प्राप्त';
     top.append(id,mark);
     const h=document.createElement('h4');h.textContent=r.name;
     const meta=document.createElement('div');meta.className='directory-card-meta';
     meta.append(label('जिल्हा',r.district),label('तालुका',r.taluka));
     const reg=document.createElement('div');reg.className='directory-card-reg';
     reg.textContent='अधिकृत संस्था नोंदणी क्र. : '+(r.registration||'नोंद उपलब्ध नाही');
     const view=profileButton(r,'संस्थेची सविस्तर माहिती पहा →','org-profile-view');
     card.classList.add('org-profile-row');card.addEventListener('click',()=>openProfile(r));
     card.append(top,h,meta,reg,view);$('orgCards').append(card);
   });
   if(!list.length){
     const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;
     td.textContent=records.length?'या शोधासाठी एकही संस्था सापडली नाही. कृपया दुसरे नाव किंवा क्रमांक वापरा.':'संस्थांची यादी सध्या उपलब्ध नाही.';
     td.style.cssText='text-align:center!important;padding:28px 12px;color:#70878c';tr.append(td);$('orgRows').append(tr);
     const card=document.createElement('div');card.className='directory-card';
     card.textContent=td.textContent;$('orgCards').append(card);
   }
   $('orgCount').textContent=fmt(records.length);
   $('orgSummary').textContent=fmt(rows.length)+' संस्था दाखवल्या जात आहेत'+(rows.length!==records.length?' (एकूण '+fmt(records.length)+')':'');
   $('orgPageInfo').textContent=rows.length?fmt(page*PAGE_SIZE+1)+'–'+fmt(Math.min(rows.length,(page+1)*PAGE_SIZE))+' / '+fmt(rows.length)+' • पान '+fmt(page+1)+' / '+fmt(pages):'० संस्था';
   $('orgPrev').disabled=page<=0;$('orgNext').disabled=page>=pages-1;
   $('orgCsv').disabled=!records.length;
 }
 function setRecords(arr,source,stamp) {
   const clean=cleanRows(arr);
   if(!clean.length)throw Error('No valid MLVM organisation records');
   if(records.length && clean.length < records.length){
     const extra=new Map(clean.map(r=>[r.id,r.details]));
     records=records.map(r=>extra.has(r.id)?{...r,details:extra.get(r.id)}:r);
     $('orgSource').textContent=lastSource+' • नवीन नोंदी असलेली जतन केलेली यादी दाखवत आहोत';render();return;
   } // Preserve newer snapshot entries while enriching matching public profiles.
   records=clean;lastSource=source;
   const districts=[...new Set(records.map(r=>r.district))].sort((a,b)=>a.localeCompare(b,'mr'));
   const current=$('orgDistrict').value;
   $('orgDistrict').replaceChildren(new Option('सर्व जिल्हे',''));
   districts.forEach(d=>$('orgDistrict').add(new Option(d,d)));
   $('orgDistrict').value=districts.includes(current)?current:'';
   $('orgSource').textContent=source+' • शेवटची नोंद: '+(stamp||records.map(x=>x.date).sort().at(-1)||'—');
   render();
 }
 async function loadDirectory(){
   if(isLoading)return;isLoading=true;
   $('orgSource').textContent=records.length?'नवीन नोंदी तपासत आहोत...':'माहिती वाचली जात आहे...';
   try{
     const res=await fetch('./organizations.json?nocache='+Date.now(),{cache:'no-store'});
     if(!res.ok)throw Error('Snapshot HTTP '+res.status);
     const snapshot=await res.json();
     if(!Array.isArray(snapshot.organizations))throw Error('Invalid snapshot');
     setRecords(snapshot.organizations,'उपलब्ध नोंदणी यादी',snapshot.snapshotAt);
   }catch(e){console.warn('MLVM directory snapshot unavailable',e)}
   const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8500);
   try{
     const res=await fetch(CSV_URL+'&nocache='+Date.now(),{cache:'no-store',signal:abort.signal,redirect:'follow'});
     if(!res.ok)throw Error('Published CSV HTTP '+res.status);
     const str=await res.text(),parsed=parseCSV(str);
     const clean=parsed.slice(1).map(row=>fromArray(row,parsed[0]||[]));
     if(clean.filter(valid).length<1)throw Error('Published data has no identifiable MLVM IDs');
     setRecords(clean,'प्रकाशित Google Sheet',clean.map(x=>x.date).sort().at(-1));
   }catch(e){
     console.warn('Published CSV unavailable; keeping validated directory snapshot',e);
     if(!records.length)$('orgSource').textContent='यादी वाचता आली नाही • थोड्या वेळाने पुन्हा प्रयत्न करा';
     else if(lastSource!=='प्रकाशित Google Sheet')$('orgSource').textContent+=' • थेट शीट उपलब्ध नसल्याने शेवटची जतन केलेली यादी';
   }finally{clearTimeout(timer);isLoading=false;render()}
 }
 function exportCSV(){
   const cols=['MLVM नोंदणी ID','नोंदणी तारीख','जिल्हा','संस्थेचे नाव','तालुका','संस्थेचा अधिकृत नोंदणी क्रमांक','नोंदणी स्थिती'];
   const list=[cols,...filtered().map(r=>[r.id,r.date,r.district,r.name,r.taluka,r.registration,'नोंदणी प्राप्त'])];
   const text='\ufeff'+list.map(row=>row.map(value=>{
      let s=String(value??'');if(/^[=+@-]/.test(s))s="'"+s;
      return '"'+s.replace(/"/g,'""')+'"';
   }).join(',')).join('\r\n');
   const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='MLVM_Registered_NGOs.csv';document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1500);
 }
 $('orgSearch').addEventListener('input',()=>{page=0;render()});
 $('orgDistrict').addEventListener('change',()=>{page=0;render()});
 $('orgClear').addEventListener('click',()=>{$('orgSearch').value='';$('orgDistrict').value='';page=0;render();$('orgSearch').focus()});
 $('orgPrev').addEventListener('click',()=>{page=Math.max(0,page-1);render();$('organizations').scrollIntoView({behavior:'smooth',block:'start'})});
 $('orgNext').addEventListener('click',()=>{page+=1;render();$('organizations').scrollIntoView({behavior:'smooth',block:'start'})});
 $('orgCsv').addEventListener('click',exportCSV);
 $('refreshBtn')?.addEventListener('click',loadDirectory);
 const hint=el('p','org-profile-hint','संस्थेचे नाव किंवा MLVM क्रमांक निवडा आणि सविस्तर संस्था परिचय पहा.');
 $('orgRows').closest('.directory-scroll').before(hint);
 render();loadDirectory();
})();
