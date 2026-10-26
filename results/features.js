const exportNames=["Farida Abdel Aziz","Nour Mostafa Fadl","Seif Tamer Salah","Omar Mohamed Shaaban","Nour El Din Ahmed","Rahma Mohamed Shaaban","Sama Mohamed Ali","Abdel Fattah Ahmed Abdel Fattah","Abdullah Yasser Khalil Allah","Omar Emad","Jana Mohamed","Khadija Amr Gamal","Asser Ahmed Samir","Abdullah Yasser Abdullah","Eyad Hany Salah","Brihan Hany","Hager Ahmed","Yassin Mostafa","Mohamed Yasser","Ali Mohamed Hussein","Nareen Islam","Retaj Abdel Moneim","Yousef Mostafa","Neyar Islam","Marwan Ahmed Ramadan","Yousef Mahmoud","Marwan Hamada","Talia Abdel Hamid","Ahmed Hafez"];
const exportStrokes=["FREESTYLE","BUTTERFLY","BREASTSTROKE","BACKSTROKE"];
const celebratedSwimmers=new Set();
function gentleMotion(){return !(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)&&!(navigator.connection&&navigator.connection.saveData)&&!(navigator.deviceMemory&&navigator.deviceMemory<=2)&&!(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=2);}
if(!gentleMotion())document.documentElement.classList.add('low-motion');
function animateTimes(swimmer){
 if(!gentleMotion()||typeof requestAnimationFrame!=='function')return;
 document.querySelectorAll('.race-time[data-race]').forEach(el=>{const raw=swimmer.times[+el.dataset.race];if(raw==='NT')return;const goal=seconds(raw),started=performance.now();function tick(now){if(!el.isConnected)return;const p=Math.min((now-started)/620,1),s=goal*(1-Math.pow(1-p,3));el.textContent=p===1?time(raw):Math.floor(s/60)+':'+(s%60).toFixed(3).padStart(6,'0');if(p<1)requestAnimationFrame(tick);}requestAnimationFrame(tick);});
}
function celebrate(swimmer){
 if(celebratedSwimmers.has(swimmer.id))return;celebratedSwimmers.add(swimmer.id);
 if(!gentleMotion()||!strokes.some((_,i)=>{const r=raceRanking(swimmer,i);return r.rank!==null&&r.rank<=3;}))return;
 const host=document.createElement('div');host.className='celebration';host.setAttribute('aria-hidden','true');
 for(let i=0;i<24;i++){const bit=document.createElement('i');bit.style.cssText='--x:'+((i*37)%100)+'%;--turn:'+(i*43)+'deg;--drift:'+((i%2?1:-1)*(25+i*3))+'px;--delay:'+(i%6)*55+'ms;background:'+['#eac878','#c6d8e9','#c89570','#56cbea'][i%4];host.appendChild(bit);}document.querySelector('.ranking-action').appendChild(host);setTimeout(()=>host.remove(),1900);
}
function loadAsset(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Image failed'));img.src=src;});}
let previewUrl=null,previewFile=null,previewFocus=null;
function fitText(ctx,text,maxWidth,size,min=26){while(size>min){ctx.font='600 '+size+'px "IBM Plex Sans Arabic", Tahoma, sans-serif';if(ctx.measureText(text).width<=maxWidth)break;size-=2;}return size;}
function drawRounded(ctx,x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();ctx.fill();}
async function exportResult(swimmer){
 const button=document.querySelector('#export-image');button.disabled=true;button.textContent='جاري تجهيز الصورة…';
 try{
 if(document.fonts&&document.fonts.ready)await document.fonts.ready;
 const assets=await Promise.all(['logo.jpg','stroke-free.png','stroke-fly.png','stroke-breast.png','stroke-back.png'].map(loadAsset));const logo=assets[0];
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1320;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable');
 const g=ctx.createLinearGradient(0,0,1080,1320);g.addColorStop(0,'#15354c');g.addColorStop(1,'#07121f');ctx.fillStyle=g;ctx.fillRect(0,0,1080,1320);
 ctx.strokeStyle='#46c9ef20';ctx.lineWidth=2;for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(i*230-180,0);ctx.lineTo(i*230+250,1320);ctx.stroke();}
 drawRounded(ctx,54,54,972,1212,30,'#0b1928');
 drawRounded(ctx,832,90,138,98,12,'#ffffff');ctx.drawImage(logo,832,90,138,98);
 ctx.direction='ltr';ctx.textAlign='left';ctx.fillStyle='#ecf5fc';ctx.font='700 33px Arial';ctx.fillText('AMIRIYA',110,130);ctx.font='16px Arial';ctx.fillStyle='#83b0c8';ctx.fillText('SWIMMING POOL',110,164);
 ctx.direction='ltr';ctx.textAlign='left';ctx.fillStyle='#54cbee';ctx.font='500 21px Arial';ctx.fillText('SWIMMER PERFORMANCE CARD',110,245);
 ctx.fillStyle='#f1f8fe';const englishName=exportNames[swimmer.id];if(!englishName)throw Error('English name missing');let nameSize=54;while(nameSize>24){ctx.font='600 '+nameSize+'px Arial';if(ctx.measureText(englishName).width<=860)break;nameSize-=2;}ctx.fillText(englishName,110,326);
 ctx.fillStyle='#9fb5c8';ctx.font='23px Arial';ctx.fillText('BORN '+swimmer.year+'    /    TEST DATE: 25 OCTOBER 2026',110,382);ctx.fillText('RACE DISTANCE: 50M    /    POOL LENGTH: 25M',110,424);
 for(let i=0;i<4;i++){
 const x=i%2===0?108:558,y=488+Math.floor(i/2)*280;
 drawRounded(ctx,x,y,414,252,16,'#132c40');ctx.direction='ltr';ctx.textAlign='left';ctx.fillStyle='#c8dfec';ctx.font='600 19px Arial';ctx.fillText(exportStrokes[i],x+24,y+46);ctx.fillStyle='#7ea6be';ctx.font='14px Arial';ctx.fillText('50 METERS',x+24,y+72);
 const icon=document.createElement('canvas');icon.width=240;icon.height=80;const ic=icon.getContext('2d');const img=assets[i+1],scale=Math.min(240/img.width,80/img.height),iw=img.width*scale,ih=img.height*scale;ic.drawImage(img,(240-iw)/2,(80-ih)/2,iw,ih);ic.globalCompositeOperation='source-in';ic.fillStyle='#65cfee';ic.fillRect(0,0,240,80);ctx.drawImage(icon,x+268,y+25,120,40);
 ctx.fillStyle=swimmer.times[i]==='NT'?'#839aad':'#f0f9ff';ctx.textAlign='center';ctx.font='600 52px Arial';ctx.fillText(time(swimmer.times[i]),x+207,y+143);
 const r=raceRanking(swimmer,i);ctx.font='600 17px Arial';ctx.fillStyle=r.rank&&r.rank<=3?['','#eac878','#cedbe6','#cc9c77'][r.rank]:'#8dabc0';ctx.fillText(r.rank===null?'NO TIME RECORDED':'RANK #'+r.rank+' OF '+r.total+'  /  BORN '+swimmer.year,x+207,y+201);
 }
 ctx.textAlign='center';ctx.direction='ltr';ctx.fillStyle='#56cbed';ctx.font='500 25px Arial';ctx.fillText('EVERY SECOND IS A STEP FORWARD.',540,1132);ctx.fillStyle='#89a5bc';ctx.font='18px Arial';ctx.fillText('Designed & Developed by ZIAD._.HASSAN',540,1200);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob?canvas.toBlob(b=>b?resolve(b):reject(Error('Export failed')),'image/png'):reject(Error('Export unsupported')));
 if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(blob);previewFile=typeof File==='function'?new File([blob],'Amiriya-'+swimmer.id+'.png',{type:'image/png'}):null;
 document.querySelector('#result-image').src=previewUrl;const save=document.querySelector('#save-image');save.href=previewUrl;save.download='Amiriya-'+swimmer.id+'.png';save.target='_blank';save.rel='noopener';
 document.querySelector('#native-share').hidden=!(previewFile&&navigator.canShare&&navigator.canShare({files:[previewFile]}));
 document.querySelector('#image-status').textContent='';previewFocus=document.activeElement;document.querySelector('#image-preview').hidden=false;document.body.classList.add('preview-open');document.querySelector('#close-preview').focus();
 }catch(e){document.querySelector('#share-status').textContent='تعذر تجهيز الصورة. جرّب مرة تانية، أو استخدم نسخ نتيجتي.';}finally{button.disabled=false;button.textContent='حفظ النتيجة كصورة ↓';}
}
function closeImagePreview(){document.querySelector('#image-preview').hidden=true;document.body.classList.remove('preview-open');if(previewFocus&&previewFocus.isConnected)previewFocus.focus();}
function setupImagePreview(){
 document.querySelector('#close-preview').onclick=closeImagePreview;
 document.querySelector('#image-preview').onclick=e=>{if(e.target===document.querySelector('#image-preview'))closeImagePreview();};
 document.querySelector('#native-share').onclick=async()=>{try{await navigator.share({files:[previewFile]});}catch(e){if(e.name!=='AbortError')document.querySelector('#image-status').textContent='استخدم تحميل الصورة، وبعدها ابعتها على واتساب.';}};
 document.querySelector('#image-preview').onkeydown=e=>{if(e.key==='Escape')closeImagePreview();if(e.key==='Tab'){const items=Array.from(document.querySelectorAll('#image-preview button, #image-preview a')).filter(x=>!x.hidden),first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
}
setupImagePreview();
