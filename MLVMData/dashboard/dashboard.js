/* MLVM public dashboard: only anonymous aggregated statistics are loaded.
 * No names, telephone numbers, emails, registration IDs or individual details.
 * Capability tags are keyword heuristics, not a verified AI assessment.
 */
'use strict';
const $=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('en-IN').format(Number(n)||0);
const sourceNames='अहिल्यानगर|अकोला|अमरावती|छत्रपती संभाजीनगर|बीड|भंडारा|बुलढाणा|चंद्रपूर|धाराशिव|धुळे|गडचिरोली|गोंदिया|हिंगोली|जळगाव|जालना|कोल्हापूर|लातूर|मुंबई शहर|मुंबई उपनगर|नागपूर|नांदेड|नंदुरबार|नाशिक|पालघर|परभणी|पुणे|रायगड|रत्नागिरी|सांगली|सातारा|सिंधुदुर्ग|सोलापूर|ठाणे|वर्धा|वाशिम|यवतमाळ'.split('|');
const palette=['#a2444a','#db8762','#e7ae70','#7d9b95','#4e827d','#deb97c','#96aaba','#c9a9a3'];
const aliases={
 'ahmednagar':'अहिल्यानगर','ahilyanagar':'अहिल्यानगर','ahilyanag ar':'अहिल्यानगर',
 'akola':'अकोला','amravati':'अमरावती','amaravati':'अमरावती','aurangabad':'छत्रपती संभाजीनगर','chhatrapatisambhajinagar':'छत्रपती संभाजीनगर',
 'beed':'बीड','bid':'बीड','bhandara':'भंडारा','buldana':'बुलढाणा','buldhana':'बुलढाणा','chandrapur':'चंद्रपूर','osmanabad':'धाराशिव','dharashiv':'धाराशिव','dhule':'धुळे',
 'gadchiroli':'गडचिरोली','gondia':'गोंदिया','gondiya':'गोंदिया','hingoli':'हिंगोली','jalgaon':'जळगाव','jalna':'जालना','kolhapur':'कोल्हापूर','latur':'लातूर',
 'mumbai':'मुंबई शहर','mumbaicity':'मुंबई शहर','bombay':'मुंबई शहर','greaterbombay':'मुंबई शहर','mumbaisuburban':'मुंबई उपनगर','mumbaisuburb':'मुंबई उपनगर','bombaysuburban':'मुंबई उपनगर',
 'nagpur':'नागपूर','nanded':'नांदेड','nandurbar':'नंदुरबार','nashik':'नाशिक','nasik':'नाशिक','palghar':'पालघर','parbhani':'परभणी','pune':'पुणे','raigad':'रायगड','raigarh':'रायगड',
 'ratnagiri':'रत्नागिरी','sangli':'सांगली','satara':'सातारा','sindhudurg':'सिंधुदुर्ग','solapur':'सोलापूर','solapur':'सोलापूर','sholapur':'सोलापूर',
 'thane':'ठाणे','wardha':'वर्धा','washim':'वाशिम','yavatmal':'यवतमाळ','yeotmal':'यवतमाळ'
};
let data=null, mapData=null, selected='', sortBy='count', sortDir=-1;
const liveApi=String(window.MLVM_PUBLIC_STATS_API||'').trim();
let loading=false;
function setConnectionStatus(live,failed=false){
 const txt=document.querySelector('.top-status'),dot=document.querySelector('.status-dot');
 if(txt)txt.textContent=data?.sourceMode==='published_csv'?(failed?'माहिती वाचता आली नाही':'CSV डेटा • Refresh करून पाहा'):live?'थेट अद्ययावत डेटा':failed?'माहिती वाचता आली नाही':'मागील उपलब्ध माहिती';
 if(dot){
  dot.style.background=data?.sourceMode==='published_csv'&&!failed?'#26885d':live?'#26885d':failed?'#bc5855':'#e9b668';
  dot.style.boxShadow=data?.sourceMode==='published_csv'&&!failed?'0 0 0 4px #d9f3e7':live?'0 0 0 4px #d9f3e7':failed?'0 0 0 4px #ffe6e1':'0 0 0 4px #fbf0dc';
 }
}
function requestLiveStats(){
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(liveApi))
  return Promise.reject(Error('Live URL not set'));
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const old=window.MLVM_LIVE_JSONP;
  let finished=false;
  const timer=setTimeout(()=>finish(Error('Live API timeout')),15000);
  function finish(err,response){
   if(finished)return;finished=true;clearTimeout(timer);script.remove();
   if(old===undefined)delete window.MLVM_LIVE_JSONP;else window.MLVM_LIVE_JSONP=old;
   if(err)reject(err);else resolve(response);
  }
  window.MLVM_LIVE_JSONP=response=>{
   if(!response||response.ok!==true)finish(Error(response?.error||'Invalid API response'));
   else finish(null,response);
  };
  script.onerror=()=>finish(Error('Live API unreachable'));
  script.src=liveApi+(liveApi.includes('?')?'&':'?')+'t='+Date.now();
  document.head.append(script);
 });
}

const cleanName=s=>String(s||'').toLowerCase().normalize('NFKC').replace(/[^a-z\u0900-\u097f]/g,'');
const nameFromMap=s=>aliases[cleanName(s)] || sourceNames.find(n=>cleanName(n)===cleanName(s)) || s;
const district=n=>data?.districts?.find(d=>d.name===n)||{name:n,count:0,workers:0,villages:0,verified:0,activities:{}};
const number=id=>$(id).textContent='—';
const set=id=>v=>{if($(id))$(id).textContent=v};
const esc=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const ns='http://www.w3.org/2000/svg';
const svg=(name,attrs)=>{const e=document.createElementNS(ns,name);Object.entries(attrs||{}).forEach(([k,v])=>e.setAttribute(k,String(v)));return e};
const sorted=()=>[...(data?.districts||[])].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'mr'));
function updateMetrics(){
 const t=data.totals;
 $('mOrganizations').textContent=fmt(t.organizations);
 $('mDistricts').textContent=fmt(t.districtsWithRegistrations);
 $('mWorkers').textContent=fmt(t.workers);
 $('mVillages').textContent=fmt(t.villages);
 const estimatedPeople=Math.round((Number(t.villages)||0)*300);
 $('mBeneficiaries').textContent=(estimatedPeople/100000).toFixed(2)+' लाख';
 $('districtCoverage').textContent=Math.round(t.districtsWithRegistrations/t.districtsTotal*100)+'% जिल्ह्यांमधून नोंदणी';
 $('mapCoverage').textContent=fmt(t.districtsWithRegistrations)+' जिल्ह्यांत नोंदणी';
 $('trendTotal').textContent=fmt(t.organizations)+' संस्था';
 $('qualityVerified').textContent=fmt(t.verified);
 $('qualityPending').textContent=fmt(data.quality.notYetVerified);
 $('qualityUnclear').textContent=fmt(data.quality.noMatchedCapacityCategory);
 $('qualityProgress').style.width=(t.organizations?t.verified/t.organizations*100:0)+'%';
 const dt=String(data.snapshotAt||'').trim();
 const s=dt?dt.replace('T',' ').slice(0,16):'तारीख उपलब्ध नाही';
 $('updatedStamp').textContent=(data.sourceMode==='published_csv'?'शेवटचा डेटा अपडेट: ':data.live?'शेवटचा तपास: ':'डेटा स्नॅपशॉट: ')+s+' IST';
 $('footerTime').textContent=' • '+s;
}
function drawRanks(){
 const top=sorted().filter(d=>d.count>0).slice(0,10),max=top[0]?.count||1;
 $('topDistricts').replaceChildren();
 top.forEach((d,i)=>{
  const b=document.createElement('button');b.type='button';b.className='rank-item';b.title=d.name+' : '+d.count+' संस्था';
  b.innerHTML='<span class="rank-num">'+String(i+1).padStart(2,'0')+'</span><span><span class="rank-label">'+esc(d.name)+'</span><span class="rank-bar"><span class="rank-fill" style="width:'+Math.max(4,d.count/max*100)+'%"></span></span></span><span class="rank-value">'+fmt(d.count)+'</span>';
  b.addEventListener('click',()=>choose(d.name,true));$('topDistricts').append(b);
 });
}
function fillDistricts(){
 $('districtSelect').replaceChildren(new Option('संपूर्ण महाराष्ट्र',''));
 for(const name of sourceNames) $('districtSelect').add(new Option(name,name));
}
function choose(name,scroll=false){
 selected=sourceNames.includes(name)?name:'';
 $('districtSelect').value=selected;
 const d=selected?district(selected):{name:'संपूर्ण महाराष्ट्र',count:data.totals.organizations,workers:data.totals.workers,villages:data.totals.villages,activities:Object.fromEntries(data.activities.map(a=>[a.key,a.count]))};
 $('selectedName').textContent=d.name;
 $('selectedCount').textContent=fmt(d.count);
 $('selectedWorkers').textContent=fmt(d.workers);
 $('selectedVillages').textContent=fmt(d.villages);
 $('selectedActivities').replaceChildren();
 const cats=data.activities.filter(a=>(d.activities||{})[a.key]>0).sort((a,b)=>(d.activities[b.key]||0)-(d.activities[a.key]||0));
 for(const a of cats.slice(0,6)){const c=document.createElement('span');c.textContent=a.label+' • '+fmt(d.activities[a.key]);$('selectedActivities').append(c);}
 if(!cats.length){const c=document.createElement('span');c.textContent='कार्यविषयाची स्पष्ट नोंद उपलब्ध नाही';$('selectedActivities').append(c);}
 $('selectedFoot').textContent=selected?(d.count? 'प्राप्त संस्था: '+fmt(d.count)+' • पडताळलेल्या: '+fmt(d.verified):'या जिल्ह्यात अद्याप नोंदणी नाही.'):'राज्यातील सर्व जिल्ह्यांची एकत्रित माहिती.';
 $('mahaMap').querySelectorAll('path[data-district]').forEach(p=>p.classList.toggle('selected',p.dataset.district===selected));
 buildInsights();
 if(scroll) $('mapSection').scrollIntoView({behavior:'smooth',block:'start'});
}
const heat=(n,max)=>{
 if(!n)return '#e6edf0';
 const x=n/Math.max(max,1);
 return x>.7?'#a74243':x>.4?'#c96e59':x>.21?'#e2a06b':x>.07?'#e9be83':'#f2dcae';
};
function mapBounds(geo){
 let lowX=180,hiX=-180,lowY=90,hiY=-90;
 const visit=c=>{if(Array.isArray(c)&&typeof c[0]==='number'){lowX=Math.min(lowX,c[0]);hiX=Math.max(hiX,c[0]);lowY=Math.min(lowY,c[1]);hiY=Math.max(hiY,c[1]);}else if(Array.isArray(c))c.forEach(visit)};
 geo.features.forEach(f=>visit(f.geometry.coordinates));return {lowX,hiX,lowY,hiY};
}
function mapPath(geom,projection){
 const polys=geom.type==='Polygon'?[geom.coordinates]:geom.coordinates;
 return polys.map(poly=>poly.map(ring=>ring.map((pt,i)=>{const [x,y]=projection(pt);return (i?'L':'M')+x.toFixed(1)+','+y.toFixed(1)}).join(' ')+' Z').join(' ')).join(' ');
}
function renderMap(){
 const root=$('mahaMap');root.replaceChildren();
 if(!mapData||!mapData.features?.length){const t=svg('text',{x:335,y:225,'text-anchor':'middle',fill:'#73888b'});t.textContent='नकाशा सध्या उपलब्ध नाही. जिल्हा यादी खाली पाहा.';root.append(t);return;}
 const b=mapBounds(mapData),scale=Math.min(605/(b.hiX-b.lowX),410/(b.hiY-b.lowY));
 const W=(b.hiX-b.lowX)*scale,H=(b.hiY-b.lowY)*scale;
 const ox=(670-W)/2,oy=(465-H)/2;
 const pr=p=>[ox+(p[0]-b.lowX)*scale,oy+(b.hiY-p[1])*scale];
 const max=Math.max(...data.districts.map(d=>d.count));
 const tooltip=$('mapTooltip'),wrap=root.parentElement;
 mapData.features.forEach(f=>{
  const name=nameFromMap(f.properties?.name),d=district(name),path=svg('path',{d:mapPath(f.geometry,pr),fill:heat(d.count,max),'data-district':name,tabindex:0,role:'button','aria-label':name+' : '+d.count+' नोंदणीकृत संस्था'});
  const title=svg('title');title.textContent=name+' — '+fmt(d.count)+' संस्था';path.append(title);
  path.addEventListener('click',()=>choose(name,false));
  path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(name,false)}});
  const pointer=e=>{const rect=wrap.getBoundingClientRect();tooltip.innerHTML='<b>'+esc(name)+'</b>'+fmt(d.count)+' संस्था • '+fmt(d.workers)+' कार्यकर्ते';tooltip.style.display='block';tooltip.style.left=Math.min(rect.width-165,Math.max(5,e.clientX-rect.left+11))+'px';tooltip.style.top=Math.max(5,e.clientY-rect.top-42)+'px'};
  path.addEventListener('pointermove',pointer);
  path.addEventListener('pointerleave',()=>tooltip.style.display='none');
  root.append(path);
 });
 choose(selected);
}
function arcPath(cx,cy,r0,r1,start,end){
 const p=(r,a)=>[cx+Math.cos(a)*r,cy+Math.sin(a)*r],a=p(r1,start),b=p(r1,end),c=p(r0,end),d=p(r0,start);
 return ['M',a.join(','),'A',r1,r1,0,+(end-start>Math.PI),1,b.join(','),'L',c.join(','),'A',r0,r0,0,+(end-start>Math.PI),0,d.join(','),'Z'].join(' ');
}
function drawCapability(){
 const arr=[...data.activities].sort((a,b)=>b.count-a.count),total=arr.reduce((s,a)=>s+a.count,0);
 const out=$('donut');out.replaceChildren();$('donutTotal').textContent=fmt(total);
 const center=svg('circle',{cx:140,cy:140,r:121,fill:'#f4f7f6'});out.append(center);
 let angle=0;
 arr.forEach((a,i)=>{
  const end=angle+(total?a.count/total:0)*Math.PI*2;
  if(end>angle){const p=svg('path',{d:arcPath(140,140,87,121,angle,end-.015),fill:palette[i%palette.length]});const title=svg('title');title.textContent=a.label+' : '+fmt(a.count);p.append(title);out.append(p)}
  angle=end;
 });
 const ctr=svg('circle',{cx:140,cy:140,r:80,fill:'#fff'});out.append(ctr);
 $('capLegend').replaceChildren();arr.forEach((a,i)=>{
  const line=document.createElement('div');line.className='legend-row';
  line.innerHTML='<i class="legend-swatch" style="background:'+palette[i%palette.length]+'"></i><span>'+esc(a.label)+'</span><b>'+fmt(a.count)+'</b>';
  $('capLegend').append(line);
 });
}
function shortDate(x){const parts=String(x).split('-');return Number(parts[2])+' '+(['','जाने','फेब्रु','मार्च','एप्रिल','मे','जून','जुलै','ऑग','सप्टें','ऑक्टो','नोव्हें','डिसें'][Number(parts[1])]||'');}
function drawTrend(){
 const days=data.dates||[],box=$('trendChart');box.replaceChildren();
 if(!days.length){box.textContent='नोंदणीच्या तारखा उपलब्ध नाहीत.';return;}
 const width=590,height=255, plot={left:46,right:18,top:20,bottom:51}, base=height-plot.bottom;
 const max=Math.max(1,...days.map(d=>d.count)), count=days.length,space=(width-plot.left-plot.right)/count,barw=Math.min(74,space*.48);
 const root=svg('svg',{viewBox:'0 0 '+width+' '+height,role:'img','aria-label':'दिवसवार संस्था नोंदणीचे स्तंभचित्र'});
 for(let i=0;i<=4;i++){let val=max*i/4,y=base-(base-plot.top)*i/4;root.append(svg('line',{x1:plot.left,y1:y,x2:width-plot.right,y2:y,stroke:'#e9eef0','stroke-width':1}));const t=svg('text',{x:plot.left-10,y:y+4,'text-anchor':'end',fill:'#8e9aa1','font-size':12});t.textContent=Math.round(val);root.append(t)}
 days.forEach((d,i)=>{let h=Math.max(d.count?5:0,(d.count/max)*(base-plot.top)),x=plot.left+space*i+(space-barw)/2,y=base-h;
  const rect=svg('rect',{x,y,width:barw,height:h,rx:Math.min(9,barw/7),fill:i===0?'#b45b56':'#d89a71',tabindex:0});
  const tip=svg('title');tip.textContent=shortDate(d.date)+' : '+fmt(d.count)+' नवीन संस्था';rect.append(tip);root.append(rect);
  const label=svg('text',{x:x+barw/2,y:base+24,'text-anchor':'middle',fill:'#75898d','font-size':12});label.textContent=shortDate(d.date);root.append(label);
  const value=svg('text',{x:x+barw/2,y:Math.max(13,y-9),'text-anchor':'middle',fill:'#6a4946','font-weight':800,'font-size':15});value.textContent=fmt(d.count);root.append(value);
 });box.append(root);
}
function buildInsights(){
 const t=data.totals,sortedD=sorted(),top=sortedD[0],topCat=[...data.activities].sort((a,b)=>b.count-a.count)[0],zero=t.districtsTotal-t.districtsWithRegistrations;
 const cards=[];
 if(selected){const d=district(selected);const largest=data.activities.slice().sort((a,b)=>(d.activities[b.key]||0)-(d.activities[a.key]||0))[0];
 cards.push(['◎',selected+' : जिल्हा चित्र',fmt(d.count)+' संस्थांनी नोंदणी केली; '+fmt(d.workers)+' कार्यकर्ते व '+fmt(d.villages)+' गावांचे कार्यक्षेत्र नोंदवले आहे.']);
 cards.push(['◈','जिल्ह्यातील ठळक क्षमता',(d.activities[largest?.key]||0)>0?largest.label+' हा सर्वाधिक नमूद केलेला विषय ('+fmt(d.activities[largest.key])+' संस्था).':'स्पष्ट विषयवर्गीकरणासाठी माहिती अपुरी आहे.']);
 }else{
 cards.push(['◈','सर्वाधिक सहभाग',top.name+' जिल्ह्यात '+fmt(top.count)+' संस्था; राज्यातील नोंदींपैकी '+Math.round(top.count/t.organizations*100)+'%.']);
 cards.push(['⌁','विस्ताराची संधी',fmt(zero)+' जिल्ह्यांत अद्याप नोंदणी नाही. जिल्हा समन्वयातून विस्ताराला वाव आहे.']);
 }
 cards.push(['♧','प्रमुख कार्यविषय',topCat.label+' या विषयाचा उल्लेख '+fmt(topCat.count)+' संस्थांच्या उत्तरांमध्ये आढळतो.']);
 cards.push(['✓','पडताळणीवर भर',fmt(data.quality.notYetVerified)+' अर्जांची पडताळणी प्रलंबित आहे; संस्थांची क्षमता प्रत्यक्ष खात्री करूनच वापरावी.']);
 $('smartInsights').replaceChildren();cards.forEach(([icon,title,description])=>{const e=document.createElement('div');e.className='insight-card';e.innerHTML='<span class="insight-symbol">'+icon+'</span><div><h4>'+esc(title)+'</h4><p>'+esc(description)+'</p></div>';$('smartInsights').append(e)});
}
function drawTable(){
 const term=$('tableSearch').value.trim().toLowerCase();
 let rows=[...data.districts].filter(d=>d.name.toLowerCase().includes(term));
 rows.sort((a,b)=>sortDir*((Number(a[sortBy])||0)-(Number(b[sortBy])||0))||a.name.localeCompare(b.name,'mr'));
 $('districtRows').replaceChildren();
 rows.forEach((d,i)=>{const tr=document.createElement('tr');
 tr.innerHTML='<td>'+fmt(i+1)+'</td><td>'+esc(d.name)+'</td><td>'+fmt(d.count)+'</td><td>'+fmt(d.workers)+'</td><td>'+fmt(d.villages)+'</td><td><span class="status-badge '+(d.count?'':'zero')+'">'+(d.count?'नोंदणी प्राप्त':'नोंदणी नाही')+'</span></td><td><button type="button" class="table-view">तपशील ↗</button></td>';
 tr.querySelector('button').addEventListener('click',()=>choose(d.name,true));$('districtRows').append(tr)});
 $('tableCaption').textContent=fmt(rows.length)+' जिल्हे दाखवले जात आहेत • फक्त संकलित आकडेवारी • वैयक्तिक माहिती नाही';
}
function exportCSV(){
 const lines=[['जिल्हा','नोंदणीकृत संस्था','कार्यकर्ते','गावसंख्या','पडताळलेल्या संस्था'],
 ...data.districts.map(x=>[x.name,x.count,x.workers,x.villages,x.verified])];
 const csv='\ufeff'+lines.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='MLVM_District_Dashboard_'+String(data.snapshotAt||'').slice(0,10)+'.csv';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
}
async function load(){
 if(loading)return;loading=true;
 const btn=$('refreshBtn');btn.disabled=true;btn.textContent='⟳ अपडेट होत आहे...';
 let sourceError=null;
 try{
  let json=null;
  if(liveApi){
   try{json=await requestLiveStats();}
   catch(err){sourceError=err;console.warn('MLVM live statistics unavailable',err);}
  }
  if(!json){
   if(data?.live){
    $('updatedStamp').textContent='Live जोडणी तात्पुरती बंद • मागील आकडे दाखवत आहोत';
    setConnectionStatus(false,true);return;
   }
   const response=await fetch('./data.json?v='+Date.now(),{cache:'no-store'});
   if(!response.ok)throw Error('स्नॅपशॉट उपलब्ध नाही ('+response.status+')');
   json=await response.json();
  }
  if(!Array.isArray(json.districts)||!json.totals||json.districts.length!==36)
   throw Error('डेटाची रचना चुकीची आहे');
  data=json;
  fillDistricts();updateMetrics();drawRanks();drawCapability();drawTrend();drawTable();choose(selected);
  setConnectionStatus(Boolean(json.live),Boolean(sourceError));
  if(sourceError)$('updatedStamp').textContent+=' • Live जोडणी उपलब्ध नाही';
  if(!mapData)try{
   const m=await fetch('./map.json',{cache:'force-cache'});
   if(m.ok){const geo=await m.json();if(geo.features?.length>=35)mapData=geo;}
  }catch(e){console.warn('Map unavailable',e);}
  renderMap();
 }catch(err){
  console.error(err);
  if(data){$('updatedStamp').textContent='नवीन माहिती मिळाली नाही • मागील आकडे दाखवत आहोत';setConnectionStatus(false,true);}
  else{
   $('updatedStamp').textContent='डेटा उपलब्ध नाही';setConnectionStatus(false,true);$('mahaMap').replaceChildren();
   const t=svg('text',{x:335,y:210,'text-anchor':'middle',fill:'#a05854'});
   t.textContent='माहिती वाचताना अडथळा आला.';$('mahaMap').append(t);
  }
 }finally{loading=false;btn.disabled=false;btn.textContent='⟳ अपडेट करा';}
}
$('districtSelect').addEventListener('change',e=>choose(e.target.value));
$('resetDistrict').addEventListener('click',()=>choose(''));
$('tableSearch').addEventListener('input',drawTable);
$('csvBtn').addEventListener('click',exportCSV);
$('refreshBtn').addEventListener('click',load);
document.querySelectorAll('th.sortable').forEach(el=>{const act=()=>{const k=el.dataset.sort;sortDir=(k===sortBy)?-sortDir:-1;sortBy=k;drawTable()};el.addEventListener('click',act);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act()}})});
const spy=()=>{let current='overview';document.querySelectorAll('section[id]').forEach(section=>{if(section.getBoundingClientRect().top<180)current=section.id});document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('active',a.hash==='#'+current))};
window.addEventListener('scroll',spy,{passive:true});
load();
