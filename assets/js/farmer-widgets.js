/* Lokhit Maharashtra: farmer market-price card.
 * Embeds BajarBhav's licensed free website widget, not guessed prices.
 */
(() => {
  "use strict";
  const frame=document.getElementById("lk-market-embed");
  const link=document.getElementById("lk-market-full");
  const buttons=[...document.querySelectorAll("[data-market-crop]")];
  if(!frame||!link||!buttons.length)return;
  const crops={
    soybean:{embed:"https://www.bajarbhav.in/embed/commodity/soybean",page:"https://www.bajarbhav.in/commodities/soybean",name:"सोयाबीन"},
    cotton:{embed:"https://www.bajarbhav.in/embed/commodity/cotton",page:"https://www.bajarbhav.in/commodities/cotton",name:"कापूस"},
    tur:{embed:"https://www.bajarbhav.in/embed/commodity/tur",page:"https://www.bajarbhav.in/commodities/tur",name:"तूर"},
    maharashtra:{embed:"https://www.bajarbhav.in/embed/state/maharashtra",page:"https://www.bajarbhav.in/states/maharashtra",name:"महाराष्ट्र"}
  };
  buttons.forEach(button=>button.addEventListener("click",()=>{
    const key=button.getAttribute("data-market-crop");
    const item=crops[key];
    if(!item)return;
    buttons.forEach(b=>{
      const active=b===button;b.classList.toggle("is-active",active);
      b.setAttribute("aria-pressed",String(active));
    });
    if(frame.getAttribute("src")!==item.embed)frame.setAttribute("src",item.embed);
    frame.title=item.name+" नवीनतम APMC बाजारभाव — BajarBhav";
    link.href=item.page;
  }));
})();
