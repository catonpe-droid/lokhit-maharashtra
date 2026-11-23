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
 function fromArray(row) {
   return {
     id:plain(row[0]), date:plain(row[1]),district:plain(row[2]),name:plain(row[3]),
     taluka:plain(row[6]),registration:plain(row[10]),status:plain(row[12]) || 'प्राप्त'
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
 function render() {
   const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));
   if(page>=pages)page=pages-1;
   const list=rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
   $('orgRows').replaceChildren();$('orgCards').replaceChildren();
   list.forEach((r,i)=>{
     const tr=document.createElement('tr');
     cell(tr,fmt(page*PAGE_SIZE+i+1));cell(tr,r.id);cell(tr,r.name);cell(tr,r.district);
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
     card.append(top,h,meta,reg);$('orgCards').append(card);
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
   if(records.length && clean.length < records.length){$('orgSource').textContent=lastSource+' • नवीन नोंदी असलेली जतन केलेली यादी दाखवत आहोत';return;} // Avoid replacing newer data with a lagging published CSV.
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
     const clean=parsed.slice(1).map(fromArray);
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
 render();loadDirectory();
})();
