const $=s=>document.querySelector(s);
const norm=s=>s.normalize('NFKD').replace(/[\u064B-\u065F]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/\s/g,'');
let current=null;
function matchingSwimmers(){const q=norm($('#search').value.trim());return q?swimmers.filter(s=>norm(s.name).includes(q)):[];}
function search(){
 const list=matchingSwimmers();$('#search').setAttribute('aria-expanded',String(list.length>0));
 if(!$('#search').value.trim()){$('#matches').innerHTML='';current=null;$('#athlete-result').innerHTML='';$('#search-state').innerHTML='<div class="search-welcome"><h3>جاهز تشوف أرقامك؟</h3><p>ابدأ بكتابة اسمك، واختاره من اقتراحات البحث.</p></div>';return;}
 $('#search-state').textContent=list.length?'اختار اسمك من اقتراحات البحث لعرض نتيجتك.':'ملقيناش الاسم ده. جرّب جزء تاني من الاسم.';
 $('#matches').innerHTML=list.map(s=>'<button type="button" class="athlete-option" data-id="'+s.id+'"><span class="avatar">'+s.name.split(' ').slice(0,2).map(n=>n[0]).join('')+'</span><span><b>'+s.name+'</b><small>مواليد '+s.year+'</small></span><span class="option-arrow">↙</span></button>').join('');
 document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>showResult(+b.dataset.id));
}
function showResult(id){
 current=swimmers.find(s=>s.id===id);$('#search').value=current.name;$('#search').setAttribute('aria-expanded','false');$('#matches').innerHTML='';$('#search-state').textContent='';
 const icons=["<img class=\"stroke-svg stroke-cutout\" src=\"stroke-free.png\" alt=\"\" aria-hidden=\"true\">","<img class=\"stroke-svg stroke-cutout\" src=\"stroke-fly.png\" alt=\"\" aria-hidden=\"true\">","<img class=\"stroke-svg stroke-cutout\" src=\"stroke-breast.png\" alt=\"\" aria-hidden=\"true\">","<img class=\"stroke-svg stroke-cutout\" src=\"stroke-back.png\" alt=\"\" aria-hidden=\"true\">"];
 $('#athlete-result').innerHTML='<article class="athlete-card water-entry"><div class="entry-ripple" aria-hidden="true"></div><div class="card-ribbon"><span>AMIRIYA SWIMMING POOL</span><span>PERFORMANCE CARD / 50M</span></div><div class="athlete-heading"><span class="large-avatar">'+current.name.split(' ').slice(0,2).map(n=>n[0]).join('')+'</span><div><span class="eyebrow">YOUR PERSONAL RESULTS</span><h3>'+current.name+'</h3><p>مواليد '+current.year+' <span>•</span> ٥٠ متر · حمام ٢٥ متر</p><p class="measurement-date">تاريخ القياس: ٢٥ أكتوبر ٢٠٢٦</p></div><span class="card-watermark" aria-hidden="true">50</span></div><div class="race-cards">'+strokes.map((s,i)=>'<div class="race-card '+(current.times[i]==='NT'?'no-time':'')+'" style="--delay:'+i*90+'ms"><div class="race-top"><span>'+s+'</span><span class="race-icon" aria-hidden="true">'+icons[i]+'</span></div><span class="race-distance">٥٠ متر <span>/ 50M</span></span><strong class="race-time" data-race="'+i+'" aria-label="'+time(current.times[i])+'" dir="ltr">'+time(current.times[i])+'</strong><small>'+(current.times[i]==='NT'?'لا يوجد زمن مسجل':'دقيقة : ثانية . جزء من الثانية')+'</small></div>').join('')+'</div><div class="athlete-footer"><span>كل جزء من الثانية، خطوة للأمام.</span><div class="card-actions"><button id="export-image" class="primary">حفظ النتيجة كصورة ↓</button><button id="share" class="outline">نسخ نتيجتي ↗</button></div></div><p id="share-status" role="status"></p><div class="ranking-action"><button id="rank-toggle" class="rank-button" aria-expanded="false" aria-controls="rank-panel"><span>عاوز تشوف ترتيبك في النادي؟<small>ترتيبك بين سباحي نفس سنة الميلاد</small></span><span class="rank-arrow">↓</span></button><div id="rank-panel" hidden></div></div></article>';
 $('#rank-toggle').onclick=toggleRanks;
 $('#export-image').onclick=()=>exportResult(current);
 animateTimes(current);
 if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>$('#athlete-result').scrollIntoView({behavior:gentleMotion()?'smooth':'auto',block:'start'}));
 $('#share').onclick=async()=>{try{await navigator.clipboard.writeText(current.name+' | مواليد '+current.year+'\nAmiriya Swimming Pool — قياس ٢٥/١٠/٢٠٢٦ — سباق ٥٠ متر — حمام ٢٥ متر\n'+strokes.map((s,i)=>s+': '+time(current.times[i])).join('\n'));$('#share-status').textContent='تم نسخ النتائج ✓';}catch{$('#share-status').textContent='يمكنك تحديد الأزمنة ونسخها يدويًا.';}};
}

function raceRanking(swimmer,index,roster=swimmers){
 const value=seconds(swimmer.times[index]);
 if(!Number.isFinite(value))return {rank:null,total:0,best:null,tied:false};
 const group=roster.filter(s=>s.year===swimmer.year&&Number.isFinite(seconds(s.times[index])));
 return {rank:1+group.filter(s=>seconds(s.times[index])<value).length,total:group.length,best:Math.min(...group.map(s=>seconds(s.times[index]))),tied:group.filter(s=>seconds(s.times[index])===value).length>1};
}
function toggleRanks(){
 const panel=$('#rank-panel'),button=$('#rank-toggle'),open=button.getAttribute('aria-expanded')!=='true';
 button.setAttribute('aria-expanded',String(open));panel.hidden=!open;
 if(!open)return;
 panel.innerHTML='<div class="rank-intro"><span class="eyebrow">CLUB RANKINGS / '+current.year+'</span><h4>ترتيبك بين مواليد '+current.year+'</h4><p>كل عومة ليها ترتيب مستقل. أقل زمن هو الأول، والأزمنة المتساوية بتاخد نفس الترتيب.</p></div><div class="rank-grid">'+strokes.map((s,i)=>{const r=raceRanking(current,i);return '<div class="rank-tile '+(r.rank===null?'rank-nt':r.rank<=3?'podium podium-'+r.rank:'')+'" style="--delay:'+i*70+'ms"><span class="rank-stroke">٥٠م '+s+'</span><strong>'+(r.rank===null?'NT':'<small>#</small>'+r.rank)+'</strong><span class="rank-detail">'+(r.rank===null?'لا يوجد زمن مسجل — بدون ترتيب':'من '+r.total+' سباح وسباحة'+(r.tied?' · ترتيب مشترك':''))+'</span><span class="rank-time" dir="ltr">'+time(current.times[i])+'</span></div>';}).join('')+'</div><p class="rank-footnote">المقارنة داخل سنة الميلاد نفسها، وتشمل كل السباحين المسجلين. NT لا تدخل في الترتيب.</p>';
 celebrate(current);
}

$('#search-form').onsubmit=e=>{e.preventDefault();const list=matchingSwimmers();if(list.length===1)showResult(list[0].id);else{search();const first=$('#matches button');if(first)first.focus();}};
$('#search').oninput=()=>{current=null;$('#athlete-result').innerHTML='';search();};
$('#search').onkeydown=e=>{if(e.key==='ArrowDown'){const first=$('#matches button');if(first){e.preventDefault();first.focus();}}if(e.key==='Escape'){$('#matches').innerHTML='';$('#search').setAttribute('aria-expanded','false');}};
$('#matches').onkeydown=e=>{const buttons=Array.from(document.querySelectorAll('#matches button'));const i=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const next=buttons[i+(e.key==='ArrowDown'?1:-1)];if(next)next.focus();else $('#search').focus();}if(e.key==='Escape'){$('#matches').innerHTML='';$('#search').setAttribute('aria-expanded','false');$('#search').focus();}};
document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap')){$('#matches').innerHTML='';$('#search').setAttribute('aria-expanded','false');}});
document.querySelectorAll('a[href="#results"]').forEach(a=>a.addEventListener('click',()=>$('#search').focus({preventScroll:true})));
search();
