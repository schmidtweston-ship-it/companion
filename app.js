'use strict';
/* Companion v2. Every part is a "room" added with addRoom(). New rooms plug in the same way. */
const VERSION=2, KEY='companion';
const $=s=>document.querySelector(s);
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
const num=(v,d,lo,hi)=>{v=Number(v);if(!isFinite(v))return d;if(lo!=null&&v<lo)v=lo;if(hi!=null&&v>hi)v=hi;return v};
const arr=v=>Array.isArray(v)?v:[];
const MIN=60000,HOUR=60*MIN,DAY=24*HOUR;
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ---------- Storage, with careful reading and upgrade from the first version ---------- */
function blank(){return{v:VERSION,name:'',address:'',helperNote:'',pharmacy:{name:'',phone:''},
 pills:{groups:[],quiet:{on:true,from:'23:00',to:'06:00'},history:[],snooze:{}},
 bills:[],people:[],notes:[],helpers:[],alarms:[],timer:null,weather:null,
 remember:{places:[],notes:[],birthdays:[],check:{}},groceries:{list:[],usuals:[]}}}
function readOld(k,d){try{const v=JSON.parse(localStorage.getItem('c_'+k));return v==null?d:v}catch(e){return d}}
function upgradeFromV1(){const D=blank();let any=false;
 const p=readOld('pills',null);
 if(p&&typeof p==='object'){any=true;D.pills.groups.push(cleanGroup({name:'My pills',list:arr(p.list),mode:'every',every:p.every,anchor:p.start}))}
 const b=readOld('bills',null);if(Array.isArray(b)){any=true;D.bills=b}
 const pe=readOld('people',null);if(Array.isArray(pe)){any=true;D.people=pe}
 const n=readOld('notes',null);if(Array.isArray(n)){any=true;D.notes=n}
 const h=readOld('helpers',null);if(Array.isArray(h)){any=true;D.helpers=h.map(x=>({name:x&&x.name,rooms:{pills:!!(x&&x.pills),bills:!!(x&&x.bills),talk:!!(x&&x.talk)}}))}
 const nm=readOld('name',null);if(typeof nm==='string'){any=true;D.name=nm}
 const miss=readOld('missed',null);if(Array.isArray(miss)&&D.pills.groups[0])miss.forEach(t=>D.pills.history.push({g:D.pills.groups[0].id,t:num(t,0),s:'missed',seen:false}));
 return any?D:null}
function cleanGroup(g){g=g&&typeof g==='object'?g:{};
 return{id:typeof g.id==='string'?g.id:uid(),name:String(g.name||'My pills').slice(0,80),list:arr(g.list).map(String).filter(Boolean).slice(0,200),
 mode:g.mode==='times'?'times':'every',every:num(g.every,70,5,1440),anchor:num(g.anchor,Date.now()),
 times:arr(g.times).map(String).filter(x=>/^\d\d:\d\d$/.test(x)),night:!!g.night,
 count:g.count===''||g.count==null?null:num(g.count,null,0,100000),low:num(g.low,5,0,100000)}}
function clean(D){const B=blank();if(!D||typeof D!=='object')return B;
 const o=Object.assign(B,D);o.v=VERSION;
 ['name','address','helperNote'].forEach(k=>o[k]=typeof o[k]==='string'?o[k]:'');
 o.pharmacy=Object.assign({name:'',phone:''},o.pharmacy||{});
 o.pills=Object.assign(blank().pills,o.pills||{});o.pills.groups=arr(o.pills.groups).map(cleanGroup);
 o.pills.history=arr(o.pills.history).filter(h=>h&&isFinite(h.t));o.pills.snooze=o.pills.snooze&&typeof o.pills.snooze==='object'?o.pills.snooze:{};
 o.pills.quiet=Object.assign({on:true,from:'23:00',to:'06:00'},o.pills.quiet||{});
 o.bills=arr(o.bills).filter(b=>b&&b.name).map(b=>({id:b.id||uid(),name:String(b.name),day:num(b.day,1,1,31),amt:String(b.amt||''),paid:b.paid||'',how:String(b.how||''),phone:String(b.phone||'')}));
 o.people=arr(o.people).filter(p=>p&&p.name).map(p=>({id:p.id||uid(),name:String(p.name),phone:String(p.phone||''),photo:typeof p.photo==='string'&&p.photo.startsWith('data:image')?p.photo:'',fav:!!p.fav,urgent:!!p.urgent}));
 o.notes=arr(o.notes).filter(n=>n&&n.a);o.alarms=arr(o.alarms).filter(a=>a&&/^\d\d:\d\d$/.test(a.time));
 o.helpers=arr(o.helpers).filter(h=>h&&h.name).map(h=>({name:String(h.name),rooms:h.rooms&&typeof h.rooms==='object'?h.rooms:{}}));
 o.remember=Object.assign(blank().remember,o.remember||{});['places','notes','birthdays'].forEach(k=>o.remember[k]=arr(o.remember[k]));
 if(!o.remember.check||typeof o.remember.check!=='object')o.remember.check={};
 o.groceries=Object.assign({list:[],usuals:[]},o.groceries||{});o.groceries.list=arr(o.groceries.list);o.groceries.usuals=arr(o.groceries.usuals).map(String);
 return o}
function load(){let raw=null;try{raw=localStorage.getItem(KEY)}catch(e){}
 if(raw){try{return clean(JSON.parse(raw))}catch(e){try{localStorage.setItem(KEY+'-broken-'+Date.now(),raw)}catch(_){}} return blank()}
 const up=upgradeFromV1();return up?clean(up):blank()}
let D=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(D));return true}catch(e){alert('There is no more room to keep this. Try a smaller picture, or take off some old notes.');return false}}
save();

/* ---------- Time helpers ---------- */
function clock(t){return new Date(t).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}
function parseT(s){const m=String(s).trim().toLowerCase().match(/^(\d{1,2})(?::?(\d{2}))?\s*(a|p|am|pm|a\.m\.|p\.m\.)?$/);if(!m)return null;
 let h=+m[1],mi=+(m[2]||0);if(mi>59)return null;if(m[3]){if(h<1||h>12)return null;if(m[3][0]==='p'&&h<12)h+=12;if(m[3][0]==='a'&&h===12)h=0}else if(h>23)return null;
 return String(h).padStart(2,'0')+':'+String(mi).padStart(2,'0')}
function hmToMin(s){const [h,m]=String(s||'0:0').split(':').map(Number);return(h||0)*60+(m||0)}
function atDay(base,hm){const d=new Date(base);d.setHours(0,0,0,0);return d.getTime()+hmToMin(hm)*MIN}
function nice(hm){return clock(atDay(Date.now(),hm))}
function listAnd(a){return a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1]}
function dayKey(t){const d=new Date(t);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()}

/* ---------- Rooms and screens ---------- */
const rooms=[];function addRoom(r){rooms.push(r)}
const view=$('#view');let here='home',arg=null;
function go(id,a){here=id;arg=a;try{const r=rooms.find(x=>x.id===id);view.innerHTML=r?r.draw(a):home();if(r&&r.after)r.after(a)}catch(e){console.error(e);here='home';view.innerHTML=home()}
 try{history.replaceState(null,'','#'+here)}catch(e){}window.scrollTo(0,0);const h=view.querySelector('h1,h2');if(h){h.tabIndex=-1;h.focus({preventScroll:true})}}
function redraw(){const y=window.scrollY;go(here,arg);window.scrollTo(0,y)}
function back(){return '<button class="light noprint" onclick="go(\'home\')">Back to the start</button>'}
function val(id){const e=document.getElementById(id);return e?String(e.value).trim():''}
function helpedBy(room){const n=D.helpers.filter(h=>h.rooms&&h.rooms[room]).map(h=>esc(h.name));return n.length?`<p class="note">${listAnd(n)} can help with this. Your choice.</p>`:''}

function home(){const lines=[];const now=Date.now();
 const due=pillsDueNow();if(due.length)lines.push(`<button class="pills" onclick="ringPills()">Your pills are waiting. Tap here.</button>`);
 const nx=pillsNext();if(nx)lines.push(`<p class="next">Next pills at ${clock(nx)}</p>`);
 const miss=missedText();if(miss)lines.push(`<div class="card warn"><p>${miss}</p><button class="light" onclick="seeMissed()">I saw this</button></div>`);
 D.pills.groups.forEach(g=>{if(g.count!=null&&g.count<=g.low)lines.push(`<p class="note">Your ${esc(g.name)} are running low. Time to call the pharmacy.</p>`)});
 const bs=D.bills.map(b=>[b,billWord(b)]).filter(x=>x[1].soon);if(bs.length)lines.push(`<p class="note">${bs.map(x=>esc(x[0].name)+': '+x[1].text).join('<br>')}</p>`);
 const c=todayCheck();if(!c.ate||!c.water)lines.push(`<p class="note">Did you eat today? Did you drink water? <a href="#" onclick="go('remember');return false">Tell me</a></p>`);
 const bd=birthdaysSoon(3);if(bd.length)lines.push(`<p class="note">${bd.map(b=>esc(b.name)+"'s birthday is "+b.when).join('<br>')}</p>`);
 const d=new Date();
 return `<h1>Hello${D.name?', '+esc(D.name):''}.</h1><p style="text-align:center;font-size:30px">Today is ${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}. ${clock(now)}</p>`+lines.join('')+
 rooms.filter(r=>r.home==='big').map(r=>`<button class="big ${r.cls||r.id}" onclick="go('${r.id}')">${r.title}</button>`).join('')+
 `<div class="grid">${rooms.filter(r=>r.home==='small').map(r=>`<button class="${r.cls||''}" onclick="go('${r.id}')">${r.title}</button>`).join('')}</div>`}

/* ---------- Bells ---------- */
let ac=null,ringLoop=null;
function chime(){try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume();
 [523,659,784].forEach((f,i)=>{const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=f;o.connect(g);g.connect(ac.destination);const t=ac.currentTime+i*.5;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.35,t+.05);g.gain.exponentialRampToValueAtTime(.0001,t+1.4);o.start(t);o.stop(t+1.5)})}catch(e){}}
function tell(title,body){try{if('Notification'in window&&Notification.permission==='granted'&&navigator.serviceWorker)navigator.serviceWorker.ready.then(r=>r.showNotification(title,{body,icon:'icons/icon-192.png',tag:title})).catch(()=>{})}catch(e){}}
function askBell(){try{if('Notification'in window&&Notification.permission==='default')Notification.requestPermission()}catch(e){}chime();alert('Good. That is the bell you will hear.')}
let overKind=null;
function overlay(kind,html,ring){const o=$('#over');overKind=kind;o.innerHTML=html;o.style.display='block';const b=o.querySelector('button');if(b)b.focus();
 clearInterval(ringLoop);if(ring){chime();ringLoop=setInterval(chime,6000);setTimeout(()=>clearInterval(ringLoop),3*MIN)}}
function closeOver(){$('#over').style.display='none';overKind=null;clearInterval(ringLoop);redraw()}

/* ---------- Pills ---------- */
function inQuiet(t){const q=D.pills.quiet;if(!q.on)return false;const d=new Date(t),m=d.getHours()*60+d.getMinutes(),f=hmToMin(q.from),e=hmToMin(q.to);return f>e?(m>=f||m<e):(m>=f&&m<e)}
function slots(g,from,to){const out=[];
 if(g.mode==='times'){if(!g.times.length)return out;for(let d=from-DAY;d<=to+DAY;d+=DAY)g.times.forEach(hm=>{const t=atDay(d,hm);if(t>from&&t<=to)out.push(t)})}
 else{const step=g.every*MIN;let k=Math.ceil((from-g.anchor)/step);if(g.anchor+k*step===from)k++;for(let i=0;i<3000;i++,k++){const t=g.anchor+k*step;if(t>to)break;if(t>=g.anchor)out.push(t)}}
 return [...new Set(out)].sort((a,b)=>a-b).filter(t=>g.night||!inQuiet(t))}
const rec=(g,t)=>D.pills.history.find(h=>h.g===g&&h.t===t);
const notYet=new Set();
function pillsDueNow(){const now=Date.now(),out=[];D.pills.groups.forEach(g=>{if(!g.list.length)return;const s=slots(g,now-3*HOUR,now);const t=s[s.length-1];
 if(t&&!rec(g.id,t)&&!(D.pills.snooze[g.id+'@'+t]>now))out.push({g,t})});return out}
function pillsNext(){const now=Date.now();let best=null;D.pills.groups.forEach(g=>{if(!g.list.length)return;const s=slots(g,now,now+2*DAY);if(s[0]&&(!best||s[0]<best))best=s[0]});return best}
function nextFor(g){const s=slots(g,Date.now(),Date.now()+2*DAY);return s[0]||null}
function pillCheck(){const now=Date.now();let changed=false;
 D.pills.groups.forEach(g=>{if(!g.list.length)return;const s=slots(g,now-DAY,now);
  s.forEach((t,i)=>{const later=i<s.length-1||now-t>3*HOUR;if(later&&!rec(g.id,t)){D.pills.history.push({g:g.id,t,s:'missed',seen:false});changed=true}})});
 const cut=now-8*DAY;const n=D.pills.history.length;D.pills.history=D.pills.history.filter(h=>h.t>cut);if(n!==D.pills.history.length)changed=true;
 for(const k in D.pills.snooze)if(D.pills.snooze[k]<now-DAY){delete D.pills.snooze[k];changed=true}
 if(changed)save();
 const due=pillsDueNow().filter(x=>!notYet.has(x.g.id+'@'+x.t));
 if(due.length&&!overKind){ringPills(due);tell('Time for your pills',due.map(x=>x.g.name).join(', '))}}
function ringPills(due){due=due||pillsDueNow();if(!due.length)return go('pills');
 overlay('pills',`<h1>Time for your pills</h1>${due.map(x=>`<h3>${esc(x.g.name)} (${clock(x.t)})</h3><ul>${x.g.list.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`).join('')}
 <button onclick="tookPills()">I took them</button><button onclick="snoozePills()">Remind me in 10 minutes</button><button onclick="notYetPills()">Not yet</button>`,true)}
let pending=[];
function tookPills(){const now=Date.now();pillsDueNow().forEach(x=>{D.pills.history.push({g:x.g.id,t:x.t,s:'took',at:now});if(x.g.count!=null)x.g.count=Math.max(0,x.g.count-1)});save();
 closeOver();const low=D.pills.groups.filter(g=>g.count!=null&&g.count<=g.low);if(low.length)overlay('low',`<h1>Running low</h1>${low.map(g=>`<p style="font-size:34px">${esc(g.name)}: about ${g.count} more time${g.count==1?'':'s'} left.</p>`).join('')}<p style="font-size:32px">Time to call the pharmacy.</p>${D.pharmacy.phone?`<a class="btn" style="background:var(--card);color:var(--plum)" href="tel:${esc(D.pharmacy.phone)}">Call the pharmacy</a>`:''}<button onclick="closeOver()">All right</button>`,false)}
function snoozePills(){const t=Date.now()+10*MIN;pillsDueNow().forEach(x=>D.pills.snooze[x.g.id+'@'+x.t]=t);save();closeOver()}
function notYetPills(){pillsDueNow().forEach(x=>notYet.add(x.g.id+'@'+x.t));closeOver()}
function missedText(){const m=D.pills.history.filter(h=>h.s==='missed'&&!h.seen);if(!m.length)return'';const by={};
 m.forEach(h=>{const g=D.pills.groups.find(x=>x.id===h.g);const n=g?g.name:'pills';(by[n]=by[n]||[]).push(clock(h.t))});
 return 'You did not mark '+Object.keys(by).map(n=>`your ${esc(n.replace(/^my /i,""))} at ${listAnd(by[n])}`).join(', and ')+'. That is all right. Take the next ones when it is time. If you are not sure, call your doctor.'}
function seeMissed(){D.pills.history.forEach(h=>{if(h.s==='missed')h.seen=true});save();redraw()}
function lateTook(i){const h=D.pills.history[i];if(h){h.s='took';h.late=true;h.seen=true;save();redraw()}}
addRoom({id:'pills',title:'Pills',home:'big',draw(){const G=D.pills.groups;const nx=pillsNext();const q=D.pills.quiet;
 return `<h2>Your pills</h2>${helpedBy('pills')}`+(nx?`<p class="next">Next pills at ${clock(nx)}</p><p style="text-align:center" id="left"></p>`:'<p>No pills written down yet.</p>')+
 (pillsDueNow().length?`<button class="pills" onclick="ringPills()">Pills are waiting now</button>`:'')+
 (missedText()?`<div class="card warn"><p>${missedText()}</p><button class="light" onclick="seeMissed()">I saw this</button></div>`:'')+
 G.map(g=>{const n=nextFor(g);return `<div class="card"><h3>${esc(g.name)}</h3><p>${g.mode==='every'?'Every '+g.every+' minutes':'At '+listAnd(g.times.map(nice))}${g.night?', at night too':''}.</p>
  <p>${g.list.length} pill${g.list.length==1?'':'s'} each time${n?'. Next at '+clock(n):''}.</p>${g.count!=null?`<p>${g.count<=g.low?'<b>Running low.</b> ':''}About ${g.count} more time${g.count==1?'':'s'} left.</p>`:''}
  <div class="row"><button class="light" onclick="go('pilledit','${g.id}')">Change this</button>${g.count!=null?`<button class="light" onclick="refill('${g.id}')">I got more</button>`:''}</div></div>`}).join('')+
 `<button class="pills" onclick="go('pilledit','new')">Add pills</button>
 <details class="card"><summary>Quiet at night</summary><label class="check"><input type="checkbox" id="qon" ${q.on?'checked':''}> No bells at night</label>
 <div class="row"><label>From<input type="time" id="qf" value="${esc(q.from)}"></label><label>Until<input type="time" id="qt" value="${esc(q.to)}"></label></div>
 <p class="note">Pills marked "at night too" will still ring.</p><button onclick="saveQuiet()">Keep this</button></details>
 <details class="card"><summary>The pharmacy</summary><label>Name<input id="phn" value="${esc(D.pharmacy.name)}"></label><label>Phone number<input id="php" type="tel" value="${esc(D.pharmacy.phone)}"></label><button onclick="D.pharmacy={name:val('phn'),phone:val('php')};save();redraw()">Keep this</button>${D.pharmacy.phone?`<a class="btn sage" href="tel:${esc(D.pharmacy.phone)}">Call ${esc(D.pharmacy.name||'the pharmacy')}</a>`:''}</details>
 <details class="card"><summary>The last 7 days</summary>${weekHistory()}</details>
 <button class="light" onclick="askBell()">Ring a bell when it is time</button><p class="note">The bell rings while Companion is open on the screen. Keep it open, or check it often.</p>`+back()},
 after(){tickLeft()}});
function weekHistory(){const out=[];for(let i=0;i<7;i++){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const s=d.getTime(),e=s+DAY;
 const H=D.pills.history.map((h,j)=>[h,j]).filter(([h])=>h.t>=s&&h.t<e&&h.s!=='skip').sort((a,b)=>a[0].t-b[0].t);
 const took=H.filter(([h])=>h.s==='took').length,miss=H.filter(([h])=>h.s==='missed').length;
 out.push(`<h3>${i===0?'Today':i===1?'Yesterday':DAYS[d.getDay()]}</h3><p>${H.length?`Took ${took} time${took==1?'':'s'}${miss?`. Not marked ${miss} time${miss==1?'':'s'}`:''}.`:'Nothing yet.'}</p>`+
 H.filter(([h])=>h.s==='missed').map(([h,j])=>{const g=D.pills.groups.find(x=>x.id===h.g);return `<div class="row"><p>${esc(g?g.name:'Pills')} at ${clock(h.t)}</p><button class="light" onclick="lateTook(${j})">I did take them</button></div>`}).join(''))}
 return out.join('')}
function saveQuiet(){D.pills.quiet={on:$('#qon').checked,from:val('qf')||'23:00',to:val('qt')||'06:00'};save();redraw()}
function refill(id){const g=D.pills.groups.find(x=>x.id===id);if(!g)return;const n=prompt('How many more times can you take them now?',String(g.count||30));if(n==null)return;g.count=num(n,g.count,0,100000);save();redraw()}
function tickLeft(){const el=$('#left'),n=pillsNext();if(el&&n){const m=Math.round((n-Date.now())/MIN);el.textContent=m<=0?'Now':m<120?`In ${m} minute${m==1?'':'s'}`:`In about ${Math.round(m/60)} hours`}}
addRoom({id:'pilledit',title:'Pills',draw(id){const g=D.pills.groups.find(x=>x.id===id)||cleanGroup({name:'',every:70,anchor:Date.now()});const isNew=!D.pills.groups.includes(g);
 return `<h2>${isNew?'Add pills':'Change '+esc(g.name)}</h2><div class="card">
 <label>A name for these pills<input id="gn" value="${esc(g.name)}" placeholder="Morning pills"></label>
 <label>Which pills? One on each line<textarea id="gl" rows="8" placeholder="Heart pill, 1&#10;Water pill, 2">${esc(g.list.join('\n'))}</textarea></label>
 <h3>When?</h3><label class="check"><input type="radio" name="gm" value="every" ${g.mode==='every'?'checked':''}> Every so many minutes</label>
 <div class="row"><label>Every how many minutes?<input id="ge" type="number" inputmode="numeric" min="5" max="1440" value="${g.every}"></label><label>Starting at<input id="gs" type="time" value="${new Date(g.anchor).toTimeString().slice(0,5)}"></label></div>
 <label class="check"><input type="radio" name="gm" value="times" ${g.mode==='times'?'checked':''}> At set times each day</label>
 <label>Times, one on each line (like 8:00 am)<textarea id="gt" rows="4">${esc(g.times.map(nice).join('\n'))}</textarea></label>
 <label class="check"><input type="checkbox" id="gnight" ${g.night?'checked':''}> Ring at night too</label>
 <h3>Running low</h3><div class="row"><label>How many more times before you run out? (you can leave this empty)<input id="gc" type="number" inputmode="numeric" min="0" value="${g.count==null?'':g.count}"></label><label>Tell me when this many are left<input id="glow" type="number" inputmode="numeric" min="0" value="${g.low}"></label></div>
 <button class="pills" onclick="saveGroup('${isNew?'new':g.id}')">Keep this</button>${isNew?'':`<button class="light" onclick="dropGroup('${g.id}')">Take these pills off</button>`}</div><button class="light" onclick="go('pills')">Back to pills</button>`}});
function saveGroup(id){const list=val('gl').split('\n').map(x=>x.trim()).filter(Boolean);if(!list.length)return alert('Please write at least one pill.');
 const mode=(document.querySelector('input[name=gm]:checked')||{}).value==='times'?'times':'every';
 const bad=[],times=val('gt').split(/\n|,/).map(x=>x.trim()).filter(Boolean).map(x=>{const t=parseT(x);if(!t)bad.push(x);return t}).filter(Boolean);
 if(mode==='times'&&(bad.length||!times.length))return alert(bad.length?'I could not read this time: '+bad[0]+'. Try 8:00 am.':'Please write at least one time.');
 const st=val('gs')||'08:00';let anchor=atDay(Date.now(),st);
 const old=D.pills.groups.find(x=>x.id===id);
 const g=cleanGroup({id:old?old.id:uid(),name:val('gn')||'My pills',list,mode,every:val('ge'),anchor,times,night:$('#gnight').checked,count:val('gc'),low:val('glow')});
 if(old&&old.mode==='every'&&mode==='every'&&old.every===g.every&&new Date(old.anchor).toTimeString().slice(0,5)===st)g.anchor=old.anchor;
 // a new schedule starts fresh: do not count earlier times as missed
 g.since=Date.now();
 if(old)D.pills.groups[D.pills.groups.indexOf(old)]=g;else D.pills.groups.push(g);
 const s=slots(g,Date.now()-DAY,Date.now()-1);s.forEach(t=>{if(!rec(g.id,t))D.pills.history.push({g:g.id,t,s:'skip'})});
 save();go('pills')}
function dropGroup(id){if(!confirm('Take these pills off your list?'))return;D.pills.groups=D.pills.groups.filter(g=>g.id!==id);save();go('pills')}

/* ---------- Bills ---------- */
function dueDay(b,y,m){return Math.min(b.day,new Date(y,m+1,0).getDate())}
function billWord(b){const t=new Date(),y=t.getFullYear(),m=t.getMonth(),key=y+'-'+m;if(b.paid===key)return{text:'Paid this month. Well done.'};
 const dd=dueDay(b,y,m),d=dd-t.getDate();const th=n=>n+(n%10==1&&n!=11?'st':n%10==2&&n!=12?'nd':n%10==3&&n!=13?'rd':'th');
 if(d<0)return{text:'This was due on the '+th(dd)+'. Not paid yet.',soon:true};if(d===0)return{text:'Due today.',soon:true};if(d===1)return{text:'Due tomorrow.',soon:true};
 if(d<=7)return{text:'Due in '+d+' days.',soon:true};return{text:'Due on the '+th(dd)+'.'}}
addRoom({id:'bills',title:'Bills',home:'big',draw(){const L=D.bills;
 return `<h2>Your bills</h2>${helpedBy('bills')}`+(L.length?'':'<p>No bills written down yet.</p>')+L.map((b,i)=>{const w=billWord(b);return `<div class="card ${w.soon?'warn':''}"><h3>${esc(b.name)}</h3>${b.amt?`<p>About $${esc(b.amt)}</p>`:''}<p class="next" style="font-size:34px">${w.text}</p>
 ${b.how?`<p>How you pay: ${esc(b.how)}</p>`:''}${b.phone?`<a class="btn sage" href="tel:${esc(b.phone)}">Call about ${esc(b.name)}</a>`:''}
 <div class="row"><button class="bills" onclick="paid(${i})">Paid</button><button class="light" onclick="go('billedit',${i})">Change</button></div></div>`}).join('')+
 `<button class="bills" onclick="go('billedit',-1)">Add a bill</button>`+back()}});
addRoom({id:'billedit',title:'Bills',draw(i){const b=D.bills[i]||{name:'',day:'',amt:'',how:'',phone:''};
 return `<h2>${D.bills[i]?'Change '+esc(b.name):'Add a bill'}</h2><div class="card"><label>What is it?<input id="bn" value="${esc(b.name)}" placeholder="Electric"></label>
 <label>What day of the month is it due?<input id="bd" type="number" inputmode="numeric" min="1" max="31" value="${esc(b.day)}"></label>
 <label>How much? (you can leave this empty)<input id="ba" value="${esc(b.amt)}"></label>
 <label>How do you pay it? (like "check in the mail")<input id="bh" value="${esc(b.how)}"></label>
 <label>Phone number to call about it<input id="bp" type="tel" value="${esc(b.phone)}"></label>
 <button class="bills" onclick="saveBill(${D.bills[i]?i:-1})">Keep this</button>${D.bills[i]?`<button class="light" onclick="dropBill(${i})">Take off list</button>`:''}</div><button class="light" onclick="go('bills')">Back to bills</button>`}});
function saveBill(i){const n=val('bn'),d=num(val('bd'),0);if(!n||d<1||d>31)return alert('Please write the name and a day from 1 to 31.');
 const b={id:(D.bills[i]&&D.bills[i].id)||uid(),name:n,day:Math.round(d),amt:val('ba').replace(/^\$/,''),how:val('bh'),phone:val('bp'),paid:D.bills[i]?D.bills[i].paid:''};
 if(i>=0)D.bills[i]=b;else D.bills.push(b);D.bills.sort((a,c)=>a.day-c.day);save();go('bills')}
function paid(i){const t=new Date();if(D.bills[i]){D.bills[i].paid=t.getFullYear()+'-'+t.getMonth();save();redraw()}}
function dropBill(i){if(!confirm('Take this bill off the list?'))return;D.bills.splice(i,1);save();go('bills')}

/* ---------- Talk ---------- */
const asks=['Tell me about your day.','What did you like to cook?','Who was your best friend as a girl?','What song makes you smile?','Where did you live when you were young?','What was your first job?','What is something you are proud of?','Tell me about someone you love.','What did you do on Sundays?','What smell reminds you of home?','What was your wedding day like?','What was your favorite dance?','Tell me about a pet you loved.','What did your mother cook best?','What made you laugh this week?','Where is the prettiest place you have been?','What games did you play as a child?','What would you tell a young person today?','Who taught you to drive?','What was your favorite holiday?','What did your house smell like at Christmas?'];
function todaysQ(){const d=new Date();const n=Math.floor((d-new Date(d.getFullYear(),0,0))/DAY);return asks[n%asks.length]}
let qShown=null;
function personBtn(p){return `<a class="btn talk person" href="tel:${esc(p.phone)}" aria-label="Call ${esc(p.name)}">${p.photo?`<img class="photo" alt="" src="${esc(p.photo)}">`:''}<span style="font-size:36px">Call ${esc(p.name)}</span></a>`}
addRoom({id:'talk',title:'Talk',home:'big',draw(){const P=D.people.slice().sort((a,b)=>b.fav-a.fav);const q=qShown||todaysQ();
 return `<h2>Call someone</h2>${helpedBy('talk')}`+(P.length?P.filter(p=>p.phone).map(personBtn).join(''):'<p>No one written down yet.</p>')+
 `<button class="light" onclick="go('people')">Add or change people</button>
 <div class="card"><h2>${qShown?'A little talk':"Today's question"}</h2><p class="next" style="font-size:36px" id="q">${esc(q)}</p><button class="light" onclick="qShown=asks[Math.floor(Math.random()*asks.length)];redraw()">Ask me something else</button>
 <label>Write your answer here${(window.SpeechRecognition||window.webkitSpeechRecognition)?', or press Speak and talk':''}:<textarea id="nt" rows="4"></textarea></label><div class="row">${(window.SpeechRecognition||window.webkitSpeechRecognition)?'<button class="talk" id="spk" onclick="listen(\'nt\')">Speak</button>':''}<button onclick="keepNote()">Keep it</button></div></div>`+
 (D.notes.length?`<details class="card"><summary>Things you said</summary>${D.notes.slice(-20).reverse().map(n=>`<p><b>${esc(n.q)}</b><br>${esc(n.a)}</p>`).join('')}</details>`:'')+back()}});
addRoom({id:'people',title:'People',draw(){return `<h2>Your people</h2>`+D.people.map((p,i)=>`<div class="card"><div class="person">${p.photo?`<img class="photo" alt="${esc(p.name)}" src="${esc(p.photo)}">`:''}<h3>${esc(p.name)}</h3></div><p>${esc(p.phone)}</p>
 <label class="check"><input type="checkbox" ${p.fav?'checked':''} onchange="setP(${i},'fav',this.checked)"> Put at the top</label>
 <label class="check"><input type="checkbox" ${p.urgent?'checked':''} onchange="setP(${i},'urgent',this.checked)"> Call in a hurry (shows in Help now)</label>
 <label>Add a picture<input type="file" accept="image/*" onchange="photo(${i},this)"></label><button class="light" onclick="dropP(${i})">Take ${esc(p.name)} off</button></div>`).join('')+
 `<div class="card"><h3>Add someone</h3><label>Name<input id="pn"></label><label>Phone number<input id="pp" type="tel"></label><button class="talk" onclick="addPerson()">Add</button></div><button class="light" onclick="go('talk')">Back to Talk</button>`}});
function addPerson(){const n=val('pn'),p=val('pp');if(!n||!p)return alert('Please write a name and a phone number.');D.people.push({id:uid(),name:n,phone:p,photo:'',fav:false,urgent:false});save();redraw()}
function setP(i,k,v){if(D.people[i]){D.people[i][k]=v;save()}}
function dropP(i){if(confirm('Take this person off?')){D.people.splice(i,1);save();redraw()}}
function photo(i,inp){const f=inp.files&&inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas'),s=240,m=Math.min(im.width,im.height);c.width=c.height=s;
 c.getContext('2d').drawImage(im,(im.width-m)/2,(im.height-m)/2,m,m,0,0,s,s);const old=D.people[i].photo;D.people[i].photo=c.toDataURL('image/jpeg',.8);if(!save())D.people[i].photo=old;redraw()};im.onerror=()=>alert('I could not open that picture.');im.src=r.result};r.readAsDataURL(f)}
function keepNote(){const a=val('nt');if(!a)return;D.notes.push({q:$('#q').textContent,a,t:Date.now()});save();qShown=null;redraw()}
function listen(id){const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R)return;try{const r=new R();r.lang=navigator.language||'en-US';const b=$('#spk');if(b)b.textContent='Listening...';
 r.onresult=e=>{const el=document.getElementById(id);if(el)el.value+=(el.value?' ':'')+e.results[0][0].transcript};r.onend=()=>{if(b)b.textContent='Speak'};r.onerror=()=>{if(b)b.textContent='Speak'};r.start()}catch(e){}}

/* ---------- Clock ---------- */
addRoom({id:'clock',title:'Clock',home:'small',draw(){return `<div id="clk"></div>`+back()},after(){tickClock()}});
function tickClock(){const el=$('#clk');if(!el)return;const d=new Date(),h=d.getHours();
 el.innerHTML=`<p class="huge" style="margin-top:30px">${clock(d)}</p><h1 style="text-align:center">Today is ${DAYS[d.getDay()]}</h1><p style="text-align:center;font-size:40px">${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}</p><p style="text-align:center;font-size:36px">It is ${h<5?'night':h<12?'morning':h<17?'afternoon':h<21?'evening':'night'}.</p>`}

/* ---------- Weather ---------- */
function wWord(c){c=+c;if(c===0)return'Clear sky';if(c<=2)return'A few clouds';if(c===3)return'Cloudy';if(c<=48)return'Foggy';if(c<=57)return'Light rain';if(c<=67)return'Rain';if(c<=77)return'Snow';if(c<=82)return'Rain showers';if(c<=86)return'Snow showers';return'Storms'}
function wAdvice(t,c,p,w){const a=[];if(t<40)a.push('Cold. Wear a warm coat.');else if(t<55)a.push('Cool. Wear a coat.');else if(t<68)a.push('Mild. A sweater is plenty.');else if(t<85)a.push('Warm and nice.');else a.push('Hot. Drink extra water. Stay out of the sun.');
 if(p>=50||(c>=51&&c<=67)||(c>=80&&c<=82))a.push('Take an umbrella.');if((c>=71&&c<=77)||(c>=85&&c<=86)||t<33)a.push('Watch for ice when you walk.');if(c>=95)a.push('Best to stay inside.');if(w>20)a.push('Windy, too.');return a.join(' ')}
addRoom({id:'weather',title:'Weather',home:'small',draw(){const W=D.weather;
 return `<h2>Weather</h2><div id="wx">${W&&W.last?wxHtml(W.last):W?'<p>Looking...</p>':''}</div>
 <details class="card" ${W?'':'open'}><summary>${W?'Change your town':'What town do you live in?'}</summary><label>Your town<input id="town" value="${esc(W?W.town:'')}" placeholder="Spokane"></label><button onclick="setTown()">Keep this</button></details>`+back()},
 after(){if(D.weather)getWx()}});
function wxHtml(L){return `<p class="huge">${Math.round(L.t)}°</p><p class="next" style="font-size:40px">${wWord(L.c)}</p><div class="card good"><p style="font-size:34px">${esc(wAdvice(L.t,L.c,L.p,L.w))}</p></div>
 <p>Today: high ${Math.round(L.hi)}°, low ${Math.round(L.lo)}°. Chance of rain: ${Math.round(L.p)} in 100.</p>${L.tmrw?`<p>Tomorrow: ${wWord(L.tmrw.c)}, high ${Math.round(L.tmrw.hi)}°.</p>`:''}<p class="note">In ${esc(D.weather.name)}. Checked at ${clock(L.at)}${dayKey(L.at)!==dayKey(Date.now())?' on '+DAYS[new Date(L.at).getDay()]:''}.</p>`}
async function setTown(){const t=val('town');if(!t)return;$('#wx').innerHTML='<p>Looking for your town...</p>';
 try{const r=await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name='+encodeURIComponent(t.split(',')[0]));const j=await r.json();const g=j&&j.results&&j.results[0];
  if(!g){$('#wx').innerHTML='<p>I could not find that town. Try just the town name.</p>';return}
  D.weather={town:t,name:[g.name,g.admin1].filter(Boolean).join(', '),lat:g.latitude,lon:g.longitude,last:null};save();go('weather')}
 catch(e){$('#wx').innerHTML='<p>I cannot reach the weather right now. Is the phone online? Try again later.</p>'}}
async function getWx(){const W=D.weather;if(!W||!isFinite(W.lat))return;
 try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${W.lat}&longitude=${W.lon}&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=2`);
  const j=await r.json();const c=j.current,d=j.daily;W.last={t:c.temperature_2m,c:c.weather_code,w:c.wind_speed_10m,hi:d.temperature_2m_max[0],lo:d.temperature_2m_min[0],p:d.precipitation_probability_max[0]||0,tmrw:{c:d.weather_code[1],hi:d.temperature_2m_max[1]},at:Date.now()};save();
  const el=$('#wx');if(el&&here==='weather')el.innerHTML=wxHtml(W.last)}
 catch(e){const el=$('#wx');if(el)el.innerHTML=(W.last?wxHtml(W.last):'')+'<p class="note">I cannot reach the weather right now. This is from earlier.</p>'}}

/* ---------- Timer ---------- */
addRoom({id:'timer',title:'Timer',home:'small',draw(){const T=D.timer;
 return `<h2>Timer</h2>`+(T?`<p class="huge" id="tleft" role="timer"></p><p style="text-align:center">${esc(T.label)} rings at ${clock(T.end)}</p><button class="light" onclick="D.timer=null;save();redraw()">Stop the timer</button>`:
 `<div class="grid">${[1,3,5,10,15,20,30,45,60].map(m=>`<button class="sage" onclick="startTimer(${m})">${m<60?m+' minute'+(m>1?'s':''):'1 hour'}</button>`).join('')}</div>
 <div class="card"><label>Or how many minutes?<input id="tm" type="number" inputmode="numeric" min="1" max="1440"></label><button onclick="startTimer(val('tm'))">Start</button></div>`)+back()},after(){tickTimer()}});
function startTimer(m){m=num(m,0,0,1440);if(!m)return alert('Please write how many minutes.');D.timer={end:Date.now()+m*MIN,label:m<60?m+' minute timer':Math.round(m/6)/10+' hour timer'};chime();save();redraw()}
function tickTimer(){const T=D.timer;if(!T)return;const left=T.end-Date.now();const el=$('#tleft');
 if(left<=0){D.timer=null;save();if(!overKind||overKind!=='pills'){overlay('timer',`<h1>Time is up</h1><p style="font-size:36px">${esc(T.label)}</p><button onclick="closeOver()">Stop the bell</button>`,true);tell('Time is up',T.label)}return}
 if(el){const s=Math.ceil(left/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;el.textContent=(h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')}}

/* ---------- Alarm clock ---------- */
addRoom({id:'alarms',title:'Alarm clock',home:'small',draw(){return `<h2>Alarm clock</h2>`+(D.alarms.length?'':'<p>No alarms yet.</p>')+
 D.alarms.map((a,i)=>`<div class="card"><h3>${nice(a.time)}${a.label?' — '+esc(a.label):''}</h3><label class="check"><input type="checkbox" ${a.on?'checked':''} onchange="D.alarms[${i}].on=this.checked;save()"> Ring each day</label><button class="light" onclick="D.alarms.splice(${i},1);save();redraw()">Take this alarm off</button></div>`).join('')+
 `<div class="card"><h3>Add an alarm</h3><label>What time?<input id="at" type="time" value="07:00"></label><label>What for? (you can leave this empty)<input id="al" placeholder="Get up"></label><button onclick="addAlarm()">Add</button></div>
 <p class="note">The alarm rings while Companion is open on the screen.</p><button class="light" onclick="askBell()">Hear the bell</button>`+back()}});
function addAlarm(){const t=parseT(val('at'));if(!t)return alert('Please pick a time.');D.alarms.push({id:uid(),time:t,label:val('al'),on:true,last:''});D.alarms.sort((a,b)=>a.time<b.time?-1:1);save();redraw()}
function alarmCheck(){const d=new Date(),hm=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'),k=dayKey(d);
 D.alarms.forEach(a=>{if(a.on&&a.time===hm&&a.last!==k){a.last=k;save();if(!overKind){overlay('alarm',`<h1>${a.label?esc(a.label):'Your alarm'}</h1><p style="font-size:40px">It is ${clock(d)}. Today is ${DAYS[d.getDay()]}.</p><button onclick="closeOver()">Stop the bell</button>`,true);tell('Your alarm',a.label||clock(d))}}})}

/* ---------- Light ---------- */
let torch=null,wake=null;
addRoom({id:'light',title:'Light',home:'small',draw(){return `<h2>Light</h2><button class="talk big" onclick="lampOn()">Light up the screen</button><button class="sage" onclick="torchOn()">Try the phone's own light</button><p class="note">The phone's own light works on some phones only.</p>`+back()}});
function lampOn(){$('#lamp').style.display='block';$('#lamp button').focus();try{navigator.wakeLock&&navigator.wakeLock.request('screen').then(w=>wake=w).catch(()=>{})}catch(e){}}
async function torchOn(){try{const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});const t=s.getVideoTracks()[0];const c=t.getCapabilities?t.getCapabilities():{};
 if(!c.torch){s.getTracks().forEach(x=>x.stop());alert('This phone will not let me turn on its light. I will light up the screen instead.');return lampOn()}
 await t.applyConstraints({advanced:[{torch:true}]});torch=s;lampOn()}catch(e){alert('This phone will not let me turn on its light. I will light up the screen instead.');lampOn()}}
function lampOff(){$('#lamp').style.display='none';if(torch){torch.getTracks().forEach(x=>x.stop());torch=null}if(wake){wake.release().catch(()=>{});wake=null}}

/* ---------- Remember ---------- */
function todayCheck(){const k=dayKey(Date.now());if(D.remember.check.day!==k)D.remember.check={day:k,ate:0,water:0};return D.remember.check}
function birthdaysSoon(within){const now=new Date();now.setHours(0,0,0,0);return D.remember.birthdays.map(b=>{let d=new Date(now.getFullYear(),b.month-1,b.day);if(d<now)d=new Date(now.getFullYear()+1,b.month-1,b.day);const n=Math.round((d-now)/DAY);
 return{name:b.name,n,when:n===0?'today!':n===1?'tomorrow.':'in '+n+' days, on '+MONTHS[b.month-1]+' '+b.day+'.'}}).filter(b=>b.n<=within).sort((a,b)=>a.n-b.n)}
addRoom({id:'remember',title:'Remember',home:'small',draw(){const c=todayCheck(),R=D.remember;const bd=birthdaysSoon(45);
 return `<h2>Remember</h2>${helpedBy('remember')}<div class="card ${c.ate&&c.water?'good':'warn'}"><h3>Today</h3><p>Did you eat? ${c.ate?'Yes, '+c.ate+' time'+(c.ate>1?'s':'')+'. Good.':'Not yet.'}</p><button class="talk" onclick="todayCheck().ate++;save();redraw()">I ate something</button>
 <p>Water: ${c.water} glass${c.water==1?'':'es'} today.${c.water>=6?' Well done.':''}</p><button class="sage" onclick="todayCheck().water++;save();redraw()">I drank a glass of water</button></div>
 <div class="card"><h3>Where things are</h3>${R.places.map((p,i)=>`<div class="row"><p><b>${esc(p.what)}</b>: ${esc(p.where)}</p><button class="light" onclick="D.remember.places.splice(${i},1);save();redraw()">Take off</button></div>`).join('')||'<p>Nothing yet.</p>'}
 <label>What is it?<input id="rw" placeholder="glasses"></label><label>Where is it?<input id="rp" placeholder="on the kitchen table"></label><button onclick="addPlace()">Keep this</button></div>
 <div class="card"><h3>Birthdays coming up</h3>${bd.map(b=>`<p>${esc(b.name)}'s birthday is ${b.when}</p>`).join('')||'<p>None in the next six weeks.</p>'}
 <details><summary>Add or take off a birthday</summary>${R.birthdays.map((b,i)=>`<div class="row"><p>${esc(b.name)}: ${MONTHS[b.month-1]} ${b.day}</p><button class="light" onclick="D.remember.birthdays.splice(${i},1);save();redraw()">Take off</button></div>`).join('')}
 <label>Whose birthday?<input id="bn2"></label><div class="row"><label>Month<select id="bm">${MONTHS.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}</select></label><label>Day<input id="bdd" type="number" inputmode="numeric" min="1" max="31"></label></div><button onclick="addBday()">Add</button></details></div>
 <div class="card"><h3>Notes to myself</h3>${R.notes.slice().reverse().map((n,j)=>`<div class="row"><p>${esc(n.a)}</p><button class="light" onclick="D.remember.notes.splice(${R.notes.length-1-j},1);save();redraw()">Take off</button></div>`).join('')||''}
 <label>Write a note${(window.SpeechRecognition||window.webkitSpeechRecognition)?', or press Speak':''}<textarea id="rn" rows="3"></textarea></label><div class="row">${(window.SpeechRecognition||window.webkitSpeechRecognition)?'<button class="talk" id="spk" onclick="listen(\'rn\')">Speak</button>':''}<button onclick="addRNote()">Keep it</button></div></div>`+back()}});
function addPlace(){const w=val('rw'),p=val('rp');if(!w||!p)return alert('Please write what it is and where it is.');D.remember.places=D.remember.places.filter(x=>x.what.toLowerCase()!==w.toLowerCase());D.remember.places.push({what:w,where:p});save();redraw()}
function addBday(){const n=val('bn2'),m=num(val('bm'),0,1,12),d=num(val('bdd'),0);if(!n||d<1||d>new Date(2024,m,0).getDate())return alert('Please write a name and a real day.');D.remember.birthdays.push({name:n,month:m,day:Math.round(d)});save();redraw()}
function addRNote(){const a=val('rn');if(!a)return;D.remember.notes.push({a,t:Date.now()});save();redraw()}

/* ---------- Groceries ---------- */
addRoom({id:'groceries',title:'Groceries',home:'small',draw(){const G=D.groceries;
 return `<h2>Groceries</h2>`+(G.list.length?G.list.map((x,i)=>`<label class="check card" style="margin:8px 0"><input type="checkbox" ${x.done?'checked':''} onchange="D.groceries.list[${i}].done=this.checked;save();redraw()"> <span class="${x.done?'done':''}">${esc(x.t)}</span></label>`).join(''):'<p>The list is empty.</p>')+
 `<div class="card"><label>Add to the list<input id="gi" placeholder="Milk" onkeydown="if(event.key==='Enter')addG()"></label><button onclick="addG()">Add</button></div>
 <div class="row">${G.usuals.length?'<button class="sage" onclick="addUsuals()">Add my usuals</button>':''}${G.list.some(x=>x.done)?'<button class="light" onclick="D.groceries.list=D.groceries.list.filter(x=>!x.done);save();redraw()">Clear what I got</button>':''}</div>
 <details class="card"><summary>My usuals</summary>${G.usuals.map((u,i)=>`<div class="row"><p>${esc(u)}</p><button class="light" onclick="D.groceries.usuals.splice(${i},1);save();redraw()">Take off</button></div>`).join('')||'<p>None yet.</p>'}
 <label>Something you always buy<input id="gu"></label><button onclick="const v=val('gu');if(v&&!D.groceries.usuals.includes(v)){D.groceries.usuals.push(v);save();redraw()}">Add</button></details>`+back()}});
function addG(){const v=val('gi');if(!v)return;D.groceries.list.push({t:v,done:false});save();redraw();const e=$('#gi');if(e)e.focus()}
function addUsuals(){const have=D.groceries.list.filter(x=>!x.done).map(x=>x.t.toLowerCase());D.groceries.usuals.forEach(u=>{if(!have.includes(u.toLowerCase()))D.groceries.list.push({t:u,done:false})});save();redraw()}

/* ---------- Help now ---------- */
addRoom({id:'help',title:'Help now',home:'small',cls:'helpnow',draw(){const U=D.people.filter(p=>p.urgent&&p.phone);const meds=D.pills.groups.flatMap(g=>g.list);
 return `<h2>Help now</h2><a class="btn helpnow big" href="tel:911">Call 911</a>${U.map(personBtn).join('')}
 <div class="row"><a class="btn" href="tel:988">Call 988</a><a class="btn" href="sms:988">Text 988</a></div><p class="note">988 is for when you feel very low or alone. Someone kind will answer.</p>
 <div class="card warn"><h2>Read this to the helper</h2><p style="font-size:34px"><b>My name:</b> ${esc(D.name||'(not written yet)')}</p><p style="font-size:34px"><b>I live at:</b> ${esc(D.address||'(not written yet)')}</p>
 ${D.helperNote?`<p style="font-size:30px"><b>Please know:</b> ${esc(D.helperNote)}</p>`:''}<p style="font-size:30px"><b>My medicines:</b></p>${meds.length?'<ul>'+meds.map(m=>`<li style="font-size:30px">${esc(m)}</li>`).join('')+'</ul>':'<p>(none written yet)</p>'}</div>
 <details class="card"><summary>Change what it says</summary><label>Your name<input id="hn1" value="${esc(D.name)}"></label><label>Your address<textarea id="ha" rows="2">${esc(D.address)}</textarea></label>
 <label>What a helper should know (like "I take blood thinners" or "allergic to penicillin")<textarea id="hk" rows="3">${esc(D.helperNote)}</textarea></label><button onclick="D.name=val('hn1');D.address=val('ha');D.helperNote=val('hk');save();redraw()">Keep this</button>
 <p class="note">To add people to call in a hurry, go to Talk, then "Add or change people".</p></details>`+back()}});

/* ---------- Who helps you ---------- */
const helpParts=[['pills','Pills'],['bills','Bills'],['talk','Talk'],['remember','Remember'],['groceries','Groceries'],['help','Help now'],['weather','Weather'],['alarms','Alarm clock']];
addRoom({id:'helpers',title:'Who helps you',home:'small',draw(){const H=D.helpers;
 return `<h2>Who helps you</h2><p>This is your choice. You do not have to pick anyone. You can change this any time.</p><p class="note">Nothing is taken away from you. This only writes down who you trust with what.</p>`+
 H.map((h,i)=>`<div class="card"><h3>${esc(h.name)}</h3>${helpParts.map(([k,w])=>`<label class="check"><input type="checkbox" ${h.rooms[k]?'checked':''} onchange="D.helpers[${i}].rooms['${k}']=this.checked;save()"> ${esc(h.name)} can help with ${w}</label>`).join('')}<button class="light" onclick="if(confirm('Take ${esc(h.name).replace(/'/g,'')} off?')){D.helpers.splice(${i},1);save();redraw()}">Take ${esc(h.name)} off</button></div>`).join('')+
 `<div class="card"><label>Add a helper's name<input id="hn" placeholder="Weston"></label><button onclick="helpAdd()">Add</button></div>
 <div class="card"><label>What should I call you?<input id="nm" value="${esc(D.name)}"></label><button onclick="D.name=val('nm');save();go('home')">Keep</button></div>
 <button class="sage" onclick="go('myinfo')">My information, to print for family</button>`+back()}});
function helpAdd(){const n=val('hn');if(!n)return;D.helpers.push({name:n,rooms:{}});save();redraw()}
addRoom({id:'myinfo',title:'My information',draw(){const d=new Date();
 return `<h1>My information</h1><p>${esc(D.name)}${D.address?' — '+esc(D.address):''}</p><p class="note">Written ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}.</p><button class="noprint" onclick="window.print()">Print this page</button>
 ${D.helperNote?`<div class="card"><h3>Please know</h3><p>${esc(D.helperNote)}</p></div>`:''}
 <div class="card"><h3>My pills</h3>${D.pills.groups.map(g=>`<p><b>${esc(g.name)}</b>, ${g.mode==='every'?'every '+g.every+' minutes':'at '+listAnd(g.times.map(nice))}:<br>${g.list.map(esc).join('<br>')}</p>`).join('')||'<p>None written.</p>'}${D.pharmacy.name||D.pharmacy.phone?`<p>Pharmacy: ${esc(D.pharmacy.name)} ${esc(D.pharmacy.phone)}</p>`:''}</div>
 <div class="card"><h3>My bills</h3>${D.bills.map(b=>`<p><b>${esc(b.name)}</b>, due the ${b.day}${b.amt?', about $'+esc(b.amt):''}${b.how?'. Paid by '+esc(b.how):''}${b.phone?'. Phone '+esc(b.phone):''}.</p>`).join('')||'<p>None written.</p>'}</div>
 <div class="card"><h3>My people</h3>${D.people.map(p=>`<p>${esc(p.name)}: ${esc(p.phone)}${p.urgent?' (call in a hurry)':''}</p>`).join('')||'<p>None written.</p>'}</div>
 <div class="card"><h3>Who helps me</h3>${D.helpers.map(h=>{const w=helpParts.filter(([k])=>h.rooms[k]).map(x=>x[1]);return `<p>${esc(h.name)}: ${w.length?listAnd(w):'nothing picked yet'}</p>`}).join('')||'<p>No one picked. That is my choice.</p>'}</div>
 <div class="card"><h3>Where things are</h3>${D.remember.places.map(p=>`<p>${esc(p.what)}: ${esc(p.where)}</p>`).join('')||'<p>None written.</p>'}</div>`+
 '<button class="light noprint" onclick="go(\'helpers\')">Back</button>'}});

/* ---------- Save a copy ---------- */
addRoom({id:'copy',title:'Save a copy',home:'small',draw(){return `<h2>Save a copy</h2><p>This keeps a copy of everything you wrote down, in a file. Keep it somewhere, or give it to family. If this phone breaks, you can bring it all back.</p>
 <button class="sage" onclick="saveCopy()">Save a copy</button><div class="card"><h3>Bring back a copy</h3><p>Pick the file you saved before.</p><label>Choose the file<input type="file" accept=".json,application/json" onchange="bringBack(this)"></label></div>`+back()}});
function saveCopy(){try{const b=new Blob([JSON.stringify(D,null,1)],{type:'application/json'});const a=document.createElement('a');const d=new Date();a.href=URL.createObjectURL(b);a.download=`companion-copy-${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000);alert('Done. The copy is in your downloads.')}catch(e){alert('I could not save a copy on this phone.')}}
function bringBack(inp){const f=inp.files&&inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{let j;try{j=JSON.parse(r.result)}catch(e){return alert('That file is not a Companion copy.')}
 if(!j||typeof j!=='object'||!('pills'in j||'bills'in j))return alert('That file is not a Companion copy.');
 if(!confirm('This will put back the copy, in place of what is here now. Go ahead?'))return;D=clean(j);save();alert('All brought back.');go('home')};r.readAsText(f)}

/* ---------- Start ---------- */
window.addEventListener('error',()=>{try{if(here!=='home')go('home')}catch(e){}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#lamp').style.display==='block')lampOff();else if(overKind&&overKind!=='pills')closeOver()}});
function tick(){try{pillCheck()}catch(e){}try{alarmCheck()}catch(e){}try{tickTimer();tickLeft();tickClock()}catch(e){}}
const start=(location.hash||'').slice(1);go(rooms.some(r=>r.id===start&&!/edit/.test(start))?start:'home');
tick();setInterval(tick,1000*5);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();if(here==='home')redraw()}});
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
