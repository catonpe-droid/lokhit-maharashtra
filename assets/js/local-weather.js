/* Lokhit Maharashtra — visitor-local weather card (independent of CMS).
 * IP city is approximate; precise browser location is ONLY requested on click.
 * Open-Meteo weather models are estimates, not official disaster alerts.
 */
(() => {
  "use strict";
  const root=document.getElementById("lk-weather");
  if(!root)return;
  const $=id=>root.querySelector("#"+id);
  const API="https://api.open-meteo.com/v1/forecast";
  const GEO="https://get.geojs.io/v1/ip/geo.json";
  const FIND="https://geocoding-api.open-meteo.com/v1/search";
  const cityNames={
    "aurangabad":"छत्रपती संभाजीनगर","chhatrapati sambhajinagar":"छत्रपती संभाजीनगर",
    "pune":"पुणे","mumbai":"मुंबई","nagpur":"नागपूर","nashik":"नाशिक",
    "thane":"ठाणे","navi mumbai":"नवी मुंबई","kolhapur":"कोल्हापूर",
    "solapur":"सोलापूर","ahmednagar":"अहिल्यानगर","ahilyanagar":"अहिल्यानगर",
    "dharashiv":"धाराशिव","osmanabad":"धाराशिव","beed":"बीड","bid":"बीड",
    "latur":"लातूर","parbhani":"परभणी","nanded":"नांदेड","jalna":"जालना",
    "jalgaon":"जळगाव","akola":"अकोला","amravati":"अमरावती",
    "sangli":"सांगली","satara":"सातारा","ratnagiri":"रत्नागिरी",
    "yavatmal":"यवतमाळ","wardha":"वर्धा","chandrapur":"चंद्रपूर",
    "delhi":"दिल्ली","bengaluru":"बेंगळुरू","hyderabad":"हैदराबाद"
  };
  const localName=name=>cityNames[String(name||"").trim().toLowerCase()] || String(name||"").trim();
  const safeNumber=n=>n===null||n===undefined||n===""?null:(Number.isFinite(Number(n))?Math.round(Number(n)):null);
  const display=n=>safeNumber(n)===null?"—":new Intl.NumberFormat("mr-IN").format(safeNumber(n));
  let requestNumber=0;
  let lastLocation=null;
  const formatDay=date=>{
    try{return new Intl.DateTimeFormat("mr-IN",{weekday:"short",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z"));}
    catch{return date.slice(5);}
  };
  function info(code,isDay=true) {
    const w=Number(code);
    if(w===0)return [isDay?"☀️":"🌙","निरभ्र आकाश"];
    if(w===1)return [isDay?"🌤️":"🌙","बहुतेक निरभ्र"];
    if(w===2)return ["⛅","अंशतः ढगाळ"];
    if(w===3)return ["☁️","ढगाळ"];
    if(w===45||w===48)return ["🌫️","धुके"];
    if([51,53,55,56,57].includes(w))return ["🌦️","रिमझिम पाऊस"];
    if([61,63,65,66,67,80,81,82].includes(w))return ["🌧️","पावसाची शक्यता"];
    if([71,73,75,77,85,86].includes(w))return ["🌨️","हिमवृष्टी"];
    if([95,96,99].includes(w))return ["⛈️","मेघगर्जना"];
    return ["🌤️","हवामान"];
  }
  function status(message,isError=false) {
    const node=$("weather-status");
    node.hidden=false;node.textContent=message;
    node.classList.toggle("is-error",isError);
  }
  async function loadJson(url,ms=9500){
    const controller=new AbortController();
    const t=setTimeout(()=>controller.abort(),ms);
    try{
      const response=await fetch(url,{signal:controller.signal,cache:"no-store",mode:"cors"});
      if(!response.ok)throw new Error("HTTP "+response.status);
      const json=await response.json();
      if(!json || json.error)throw new Error(json?.reason||"डेटा उपलब्ध नाही");
      return json;
    }finally{clearTimeout(t);}
  }
  function setLoading(message){
    root.classList.add("weather-loading");
    status(message);
  }
  function renderWeather(data,place,source){
    const current=data.current||{},days=data.daily||{};
    if(current.temperature_2m===null||current.temperature_2m===undefined||!Number.isFinite(Number(current.temperature_2m)))throw new Error("तापमान उपलब्ध नाही");
    const [symbol,condition]=info(current.weather_code,current.is_day!==0);
    $("weather-icon").textContent=symbol;
    $("weather-condition").textContent=condition;
    $("weather-city").textContent=localName(place)||"माझा परिसर";
    $("weather-temp").textContent=display(current.temperature_2m);
    $("weather-feels").textContent="जाणवणारे "+display(current.apparent_temperature)+"°C";
    $("weather-rain").textContent=display(days.precipitation_probability_max?.[0])+"%";
    $("weather-wind").textContent=display(current.wind_speed_10m)+" किमी/ता";
    $("weather-humidity").textContent=display(current.relative_humidity_2m)+"%";
    $("weather-source").textContent=source==="gps"?"मोबाइलचे अचूक स्थान":source==="ip"?"IP वरून शहराचा अंदाज":"निवडलेले शहर";
    const three=$("weather-days");three.replaceChildren();
    const count=Math.min(3,days.time?.length||0);
    for(let i=0;i<count;i++){
      const d=document.createElement("div");d.className="lk-w-day";
      const [ico]=info(days.weather_code?.[i],true);
      const day=document.createElement("span");day.className="lk-w-dayname";day.textContent=i===0?"आज":formatDay(days.time[i]);
      const icon=document.createElement("span");icon.className="lk-w-dayicon";icon.textContent=ico;icon.setAttribute("aria-hidden","true");
      const temp=document.createElement("strong");temp.textContent=display(days.temperature_2m_max?.[i])+"° / "+display(days.temperature_2m_min?.[i])+"°";
      const rain=document.createElement("span");rain.className="lk-w-dayrain";rain.textContent="☔ "+display(days.precipitation_probability_max?.[i])+"%";
      d.append(day,icon,temp,rain);three.append(d);
    }
    root.classList.remove("weather-loading");
    $("weather-content").hidden=false;
    $("weather-loading-view").hidden=true;
    $("weather-status").hidden=true;
    $("weather-refresh").disabled=false;
    const updated=new Date();
    $("weather-updated").textContent="ताजी माहिती: "+updated.toLocaleTimeString("mr-IN",{hour:"numeric",minute:"2-digit"});
  }
  async function loadWeather(lat,lon,name,source){
    const latitude=Number(lat),longitude=Number(lon);
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw new Error("स्थानाचे निर्देशांक उपलब्ध नाहीत");
    const seq=++requestNumber;
    lastLocation={lat:latitude,lon:longitude,name,source};
    setLoading("हवामानाचा ताजा अंदाज मिळवत आहोत…");
    const query=new URLSearchParams({
      latitude:String(latitude.toFixed(4)),longitude:String(longitude.toFixed(4)),
      current:"temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
      daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      forecast_days:"3",timezone:"auto",wind_speed_unit:"kmh"
    });
    try{
      const data=await loadJson(API+"?"+query,10500);
      if(seq!==requestNumber)return;
      renderWeather(data,name,source);
    }catch(e){
      if(seq!==requestNumber)return;
      root.classList.remove("weather-loading");
      $("weather-loading-view").hidden=true;
      status("सध्या हवामान मिळाले नाही. पुन्हा प्रयत्न करा किंवा शहर निवडा.",true);
    }
  }
  async function locateByIP(){
    if(lastLocation)return;
    setLoading("तुमच्या शहराचा अंदाज शोधत आहोत…");
    try{
      const geo=await loadJson(GEO,8000);
      if(lastLocation)return;
      if(geo.latitude==null||geo.longitude==null)throw new Error("शहर उपलब्ध नाही");
      await loadWeather(geo.latitude,geo.longitude,geo.city||geo.region||"तुमचा परिसर","ip");
    }catch{
      root.classList.remove("weather-loading");
      $("weather-loading-view").hidden=true;
      status("शहर आपोआप मिळाले नाही. खाली शहराचे नाव शोधा किंवा ‘माझे स्थान’ दाबा.",true);
    }
  }
  async function findCity(city){
    const name=String(city||"").trim().slice(0,80);
    if(name.length<2){status("कृपया किमान २ अक्षरांचे शहर लिहा.",true);return}
    setLoading("शहर शोधत आहोत…");
    try{
      const query=new URLSearchParams({name,count:"10",language:"en",format:"json"});
      const result=await loadJson(FIND+"?"+query,9000);
      let rows=Array.isArray(result.results)?result.results:[];
      if(!rows.length)throw new Error("शहर सापडले नाही");
      // For Marathi news readers prefer the matching city in India when present.
      const india=rows.filter(x=>x.country_code==="IN");
      if(india.length)rows=india;
      const row=rows[0];
      await loadWeather(row.latitude,row.longitude,row.name||name,"city");
    }catch{
      root.classList.remove("weather-loading");
      $("weather-loading-view").hidden=true;
      status("शहर सापडले नाही. इंग्रजीत शहराचे नाव लिहून पुन्हा शोधा.",true);
    }
  }
  function locatePrecise(){
    if(!navigator.geolocation){
      status("या ब्राउझरमध्ये अचूक स्थानाची सुविधा नाही. शहर शोधा.",true);return;
    }
    setLoading("तुमच्या परवानगीने स्थान शोधत आहोत…");
    navigator.geolocation.getCurrentPosition(
      position=>loadWeather(position.coords.latitude,position.coords.longitude,"माझे स्थान","gps"),
      ()=>{root.classList.remove("weather-loading");$("weather-loading-view").hidden=true;status("स्थानाची परवानगी मिळाली नाही. शहराचे नाव शोधू शकता.",true);},
      {enableHighAccuracy:false,timeout:10500,maximumAge:600000}
    );
  }
  $("weather-search-form").addEventListener("submit",e=>{
    e.preventDefault();findCity($("weather-search").value);
  });
  $("weather-location").addEventListener("click",locatePrecise);
  $("weather-refresh").addEventListener("click",()=>{
    if(lastLocation)loadWeather(lastLocation.lat,lastLocation.lon,lastLocation.name,lastLocation.source);
    else locateByIP();
  });
  // Deferred until the section approaches the viewport to reduce external calls.
  if("IntersectionObserver" in window){
    const io=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){io.disconnect();locateByIP();}
    },{rootMargin:"450px"});
    io.observe(root);
  }else locateByIP();
})();