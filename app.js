'use strict';
const TEACHER={name:'مستر رضا الشوربجي',subject:'العلوم والأحياء',phone:'01097218458'};
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const AR='٠١٢٣٤٥٦٧٨٩';
const normNum=s=>String(s==null?'':s).replace(/[٠-٩]/g,d=>AR.indexOf(d)).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٫,،]/g,'.').trim();
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const curMonth=()=>today().slice(0,7);
const fmt=n=>{n=Math.round(n*100)/100;return String(n)};
const MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const monthName=m=>{const [y,mm]=m.split('-');return MONTHS[+mm-1]+' '+y};
const emptyDB=()=>({settings:{maxQuiz:10},groups:[],students:[],quizScores:[],exams:[],examScores:[],attendance:[],payments:[],ui:{theme:'auto',lastGroup:''}});
let DB=emptyDB();
const UI={tab:'home',group:'',month:curMonth(),gtab:'quiz',quiz:1,exam:'',page:0,attDate:today(),attGroup:'all',feeGroup:'',rankOrig:false,confirm:'',modal:null,maxShown:10};

/* ---------- storage ---------- */
let idb;
function openIDB(){return new Promise((res,rej)=>{const r=indexedDB.open('tma',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('kv');d.createObjectStore('snaps')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
const tx=(st,mode,fn)=>new Promise((res,rej)=>{const t=idb.transaction(st,mode);const s=t.objectStore(st);const rq=fn(s);t.oncomplete=()=>res(rq&&rq.result);t.onerror=()=>rej(t.error)});
let saveT;
function save(){clearTimeout(saveT);saveT=setTimeout(flush,40)}
function flush(){clearTimeout(saveT);if(idb)return tx('kv','readwrite',s=>s.put(JSON.stringify(DB),'db'))}
addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
function mergeDB(o){const d=emptyDB();for(const k of Object.keys(d)){if(o&&o[k]!=null)d[k]=o[k]}d.settings=Object.assign({maxQuiz:10},d.settings);d.ui=Object.assign({theme:'auto',lastGroup:''},d.ui);return d}
async function loadDB(){idb=await openIDB();const raw=await tx('kv','readonly',s=>s.get('db'));if(raw){try{DB=mergeDB(JSON.parse(raw))}catch(e){}}
  const t=today();const snap=await tx('snaps','readonly',s=>s.get(t));
  if(!snap&&(DB.students.length||DB.groups.length)){await tx('snaps','readwrite',s=>s.put(JSON.stringify(DB),t))}
  const keys=await tx('snaps','readonly',s=>s.getAllKeys());const cut=new Date(Date.now()-30*864e5);const cs=cut.getFullYear()+'-'+pad(cut.getMonth()+1)+'-'+pad(cut.getDate());
  for(const k of keys){if(k<cs)await tx('snaps','readwrite',s=>s.delete(k))}}
const snapKeys=()=>tx('snaps','readonly',s=>s.getAllKeys());
const snapGet=k=>tx('snaps','readonly',s=>s.get(k));
function snapNow(){const t=today();if(idb&&(DB.students.length||DB.groups.length))tx('snaps','readwrite',s=>s.put(JSON.stringify(DB),t))}
setInterval(()=>{flush();snapNow()},60000);

/* ---------- helpers ---------- */
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2200)}
const grp=id=>DB.groups.find(g=>g.id===id);
const stu=id=>DB.students.find(s=>s.id===id);
const gStudents=gid=>DB.students.filter(s=>s.groupId===gid);
function ensureGroup(){if(!grp(UI.group))UI.group=DB.groups[0]?DB.groups[0].id:'';}
const maxQ=()=>+DB.settings.maxQuiz||10;
function getQ(sid,m,n){return DB.quizScores.find(q=>q.studentId===sid&&q.month===m&&q.quizNo===n)}
function setQ(sid,m,n,v){let q=getQ(sid,m,n);if(!v){if(q)DB.quizScores.splice(DB.quizScores.indexOf(q),1);return}if(q)q.value=v;else DB.quizScores.push({studentId:sid,month:m,quizNo:n,value:v})}
const examsOf=(gid,m)=>DB.exams.filter(e=>e.groupId===gid&&e.month===m);
function getE(eid,sid){return DB.examScores.find(x=>x.examId===eid&&x.studentId===sid)}
function setE(eid,sid,v){let x=getE(eid,sid);if(v===''||v==null){if(x)DB.examScores.splice(DB.examScores.indexOf(x),1);return}if(x)x.value=v;else DB.examScores.push({examId:eid,studentId:sid,value:v})}
function parseScore(raw,max){let s=normNum(raw);if(s==='')return '';if(/^غ/.test(s))return 'غ';const n=parseFloat(s);if(isNaN(n))return '';return String(Math.min(Math.max(n,0),max))}
function quizNos(gid,m){const ids=new Set(gStudents(gid).map(s=>s.id));const set=new Set();DB.quizScores.forEach(q=>{if(q.month===m&&ids.has(q.studentId)&&q.value!=='')set.add(q.quizNo)});return [...set].sort((a,b)=>a-b)}
function calc(gid,m){
  const sts=gStudents(gid),qn=quizNos(gid,m),exs=examsOf(gid,m);
  const doneEx=exs.filter(e=>DB.examScores.some(x=>x.examId===e.id&&sts.some(s=>s.id===x.studentId)));
  const rows=sts.map((s,i)=>{let t=0;qn.forEach(n=>{const q=getQ(s.id,m,n);if(q&&q.value!=='غ')t+=Math.min(parseFloat(q.value)||0,maxQ())});
    doneEx.forEach(e=>{const x=getE(e.id,s.id);if(x)t+=Math.min(parseFloat(x.value)||0,e.maxScore)});return{s,i,total:t}});
  rows.forEach(r=>{r.rank=rows.filter(o=>o.total>r.total).length+1});
  const max=maxQ()*qn.length+doneEx.reduce((a,e)=>a+(+e.maxScore||0),0);
  return{rows,qn,exs:doneEx,max}}
const medal=r=>r===1?'🥇':r===2?'🥈':r===3?'🥉':'';
function monthOpts(sel){const base=new Date();const arr=new Set([sel,curMonth()]);for(let i=1;i<12;i++){const d=new Date(base.getFullYear(),base.getMonth()-i,1);arr.add(d.getFullYear()+'-'+pad(d.getMonth()+1))}
  for(let i=1;i<=2;i++){const d=new Date(base.getFullYear(),base.getMonth()+i,1);arr.add(d.getFullYear()+'-'+pad(d.getMonth()+1))}
  return [...arr].sort().reverse().map(m=>`<option value="${m}" ${m===sel?'selected':''}>${monthName(m)}</option>`).join('')}
const grpOpts=(sel,all)=>(all?`<option value="all" ${sel==='all'?'selected':''}>👥 كل المجموعات</option>`:'')+DB.groups.map(g=>`<option value="${g.id}" ${g.id===sel?'selected':''}>${esc(g.name)}</option>`).join('');
function waPhone(p){let d=normNum(p).replace(/\D/g,'');if(!d)return '';if(d.startsWith('0020'))d=d.slice(2);if(d.startsWith('20')&&d.length>=12)return d;if(d.startsWith('0'))return '20'+d.slice(1);if(d.length===10&&d[0]==='1')return '20'+d;return d}
function dl(name,text,type){const f=new File(['\ufeff'+text],name,{type});
  if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:name}).catch(()=>{});return}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}
async function copyText(t){try{await navigator.clipboard.writeText(t);toast('تم النسخ ✅')}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('تم النسخ ✅')}catch(_){toast('تعذر النسخ')}ta.remove()}}

/* ---------- views ---------- */
const TABS=[['home','🏠','الرئيسية'],['grades','✏️','الدرجات'],['att','📅','الغياب'],['sheet','📊','الكشف'],['fees','💰','المصاريف']];
function render(keepScroll){
  ensureGroup();const y=scrollY;
  const th=DB.ui.theme;document.documentElement.dataset.theme=th==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):th;
  const banner=UI.noStore?'<div class="card confirm">⚠️ التخزين مش شغال في المتصفح ده، البيانات مش هتتحفظ. افتح التطبيق من سفاري العادي (مش تصفح خاص ولا متصفح واتساب).</div>':'';
  const v=banner+{home:vHome,grades:vGrades,att:vAtt,sheet:vSheet,fees:vFees}[UI.tab]();
  $('#app').innerHTML=v+`<nav>${TABS.map(t=>`<button data-a="tab" data-v="${t[0]}" class="${UI.tab===t[0]?'on':''}"><span>${t[1]}</span>${t[2]}</button>`).join('')}</nav>`+(UI.modal?modalHTML():'');
  if(keepScroll)scrollTo(0,y);}
function noGroups(){return `<div class="card mut">ابدأ بإضافة مجموعة من الشاشة الرئيسية 🏠</div>`}
function vHome(){
  const n=DB.students.length;
  return `<div class="top"><h1>طلاب المستر رضا 🧬</h1><button class="btn sec sm" data-a="theme">${DB.ui.theme==='dark'?'☀️':DB.ui.theme==='light'?'🌙':'🌓'}</button></div>
  <div class="card hello"><div style="font-size:18px;font-weight:700">أهلاً يا مستر رضا 👋</div><div>${TEACHER.name}</div><div class="mut">مدرس ${TEACHER.subject} · ${TEACHER.phone}</div></div>
  <div class="card stat"><div class="mut">👨‍🎓 عدد الطلاب</div><b>${n}</b></div>
  <h2>👥 المجموعات</h2>
  <div class="card">${DB.groups.length?DB.groups.map(g=>`<div class="li"><div class="nm" data-a="opengrp" data-v="${g.id}">${esc(g.name)}<div class="mut">${gStudents(g.id).length} طالب</div></div>
   <button class="btn sec sm" data-a="opengrp" data-v="${g.id}">📊 كشف</button>
   <button class="btn sm ${UI.confirm==='g'+g.id?'red':'sec'}" data-a="delgrp" data-v="${g.id}">${UI.confirm==='g'+g.id?'تأكيد حذف المجموعة؟':'🗑️'}</button></div>`).join(''):'<div class="mut">لا توجد مجموعات بعد</div>'}
   <div class="row" style="margin-top:10px"><input id="newg" class="grow" placeholder="اسم المجموعة" enterkeyhint="done"><button class="btn" data-a="addgrp">➕ إضافة</button></div></div>
  <h2>🧑‍🏫 إضافة طالب</h2>
  <div class="card">${DB.groups.length?`<input id="nname" placeholder="اسم الطالب" enterkeyhint="done">
   <div style="height:8px"></div><input id="nphone" placeholder="رقم ولي الأمر (اختياري)" inputmode="tel" dir="ltr" style="text-align:right" enterkeyhint="done">
   <div style="height:8px"></div><select id="ngrp">${grpOpts(DB.ui.lastGroup||UI.group)}</select>
   <div style="height:8px"></div><button class="btn" style="width:100%" data-a="addstu">➕ إضافة الطالب</button>`:'<div class="mut">أضف مجموعة أولاً</div>'}</div>
  <h2>🧾 الطلاب</h2>
  <div class="card">${DB.students.length?DB.groups.map(g=>gStudents(g.id).length?`<div class="mut" style="margin-top:6px">${esc(g.name)}</div>`+gStudents(g.id).map(s=>`<div class="li"><div class="nm">${esc(s.name)}<div class="mut" dir="ltr" style="text-align:right">${esc(s.parentPhone||'')}</div></div>
   <button class="btn sec sm" data-a="editstu" data-v="${s.id}">✏️</button>
   <button class="btn sm ${UI.confirm==='s'+s.id?'red':'sec'}" data-a="delstu" data-v="${s.id}">${UI.confirm==='s'+s.id?'تأكيد الحذف؟':'🗑️'}</button></div>`).join(''):'').join(''):'<div class="mut">لا يوجد طلاب بعد</div>'}</div>
  <h2>💾 النسخ الاحتياطي</h2>
  <div class="card"><div class="mut">بياناتك محفوظة على هذا الجهاز فقط، ويتاخد نسخة تلقائية كل يوم لمدة 30 يوم. احفظ نسخة JSON بين فترة وفترة.</div>
   <div class="row" style="margin-top:10px"><button class="btn" data-a="expjson">📤 نسخ بياناتي (JSON)</button><button class="btn sec" data-a="copyjson">📋 نسخ النص</button></div>
   <div style="height:8px"></div><div class="row"><button class="btn sec" data-a="expcsv">📄 تصدير كل الدرجات CSV</button></div>
   <div style="height:10px"></div><textarea id="rtext" placeholder="الصق نص النسخة هنا للاسترجاع" dir="ltr"></textarea>
   <div style="height:8px"></div><div class="row"><button class="btn sec" data-a="restoretext">♻️ استرجاع من النص</button><button class="btn sec" data-a="restorefile">📂 استرجاع من ملف</button></div><input type="file" id="rfile" accept=".json,application/json" hidden>
   <div style="height:8px"></div><button class="btn sec" data-a="snaps">🗓️ استرجاع نسخة يوم معيّن</button><div id="snaplist"></div></div>`}
function vGrades(){
  if(!DB.groups.length)return `<h1>✏️ الدرجات</h1>`+noGroups();
  const g=UI.group,m=UI.month,sts=gStudents(g),PS=10,pages=Math.max(1,Math.ceil(sts.length/PS));if(UI.page>=pages)UI.page=pages-1;
  const seg=`<div class="seg"><button data-a="gtab" data-v="quiz" class="${UI.gtab==='quiz'?'on':''}">📝 كويزات</button><button data-a="gtab" data-v="exam" class="${UI.gtab==='exam'?'on':''}">🧪 الاختبار</button></div>`;
  let h=`<h1>✏️ الدرجات</h1><div class="row"><select class="grow" data-a="selgrp">${grpOpts(g)}</select><select class="grow" data-a="selmonth">${monthOpts(m)}</select></div>${seg}`;
  const pg=sts.slice(UI.page*PS,UI.page*PS+PS);
  const pager=`<div class="pager"><button class="btn sec" data-a="pg" data-v="1" ${UI.page>=pages-1?'disabled':''}>⬅️</button><span class="mut">صفحة ${UI.page+1} من ${pages} · ${sts.length} طالب</span><button class="btn sec" data-a="pg" data-v="-1" ${UI.page<=0?'disabled':''}>➡️</button></div>`;
  if(UI.gtab==='quiz'){
    const qs=quizNos(g,m);const nq=Math.max(10,UI.maxShown,UI.quiz,...qs);UI.maxShown=nq;
    h+=`<div class="card"><div class="row"><span class="grow">🎯 الدرجة النهاية للكويز</span><input id="maxq" type="text" inputmode="decimal" value="${maxQ()}" style="width:80px;text-align:center"></div>
    <div class="circ">${Array.from({length:nq},(_,i)=>i+1).map(n=>`<button data-a="quiz" data-v="${n}" class="${UI.quiz===n?'on':''} ${qs.includes(n)?'has':''}">${n}</button>`).join('')}<button data-a="addquiz">➕</button></div></div>`;
    h+=`<div class="card" id="swipe">${pager}${pg.length?pg.map((s,i)=>{const q=getQ(s.id,m,UI.quiz);const v=q?q.value:'';return `<div class="li"><div class="nm">${esc(s.name)}</div><input class="sc" data-k="q" data-s="${s.id}" data-i="${i}" type="text" inputmode="decimal" enterkeyhint="next" value="${esc(v)}" placeholder="—" style="width:84px"><button class="btn sec gbtn ${v==='غ'?'on':''}" data-a="abs" data-s="${s.id}" data-i="${i}">غ</button></div>`}).join(''):'<div class="mut">لا يوجد طلاب في هذه المجموعة</div>'}</div>`;
  }else{
    const exs=examsOf(g,m);if(!exs.find(e=>e.id===UI.exam))UI.exam=exs[0]?exs[0].id:'';const ex=exs.find(e=>e.id===UI.exam);
    h+=`<div class="card"><div class="circ">${exs.map(e=>`<button style="flex:0 0 auto;width:auto;border-radius:22px;padding:0 14px" data-a="exam" data-v="${e.id}" class="${UI.exam===e.id?'on':''}">${esc(e.name)}</button>`).join('')}</div>
     <div class="row"><input id="exname" placeholder="اسم اختبار جديد" class="grow"><input id="exmax" inputmode="decimal" placeholder="النهاية" style="width:90px;text-align:center" value="20"><button class="btn" data-a="addexam">➕</button></div></div>`;
    if(ex){h+=`<div class="card"><div class="row"><b class="grow">${esc(ex.name)}</b><span class="mut">النهاية</span><input id="exmaxedit" inputmode="decimal" value="${ex.maxScore}" style="width:80px;text-align:center"><button class="btn sm ${UI.confirm==='e'+ex.id?'red':'sec'}" data-a="delexam" data-v="${ex.id}">${UI.confirm==='e'+ex.id?'تأكيد الحذف؟':'🗑️ حذف'}</button></div></div>
     <div class="card" id="swipe">${pager}${pg.map((s,i)=>{const x=getE(ex.id,s.id);return `<div class="li"><div class="nm">${esc(s.name)}</div><input class="sc" data-k="e" data-s="${s.id}" data-i="${i}" type="text" inputmode="decimal" enterkeyhint="next" value="${x?esc(x.value):''}" placeholder="—" style="width:84px"><span class="mut">/${ex.maxScore}</span></div>`}).join('')}</div>`}
    else h+=`<div class="card mut">لا يوجد اختبارات لهذا الشهر. أضف اختبار بالاسم والدرجة النهاية.</div>`;
  }
  return h}
function vAtt(){
  if(!DB.groups.length)return `<h1>📅 الغياب</h1>`+noGroups();
  const ag=UI.attGroup==='all'||!grp(UI.attGroup)?'all':UI.attGroup;
  const sts=ag==='all'?DB.students:gStudents(ag);
  const st=s=>{const a=DB.attendance.find(x=>x.date===UI.attDate&&x.studentId===s.id);return a?a.status:''};
  const p=sts.filter(s=>st(s)==='p').length,a=sts.filter(s=>st(s)==='a').length;
  return `<h1>📅 الغياب</h1><div class="row"><select class="grow" data-a="attgrp">${grpOpts(ag,true)}</select><input class="grow" type="date" id="attdate" value="${UI.attDate}" dir="ltr"></div>
  <div class="sumcards"><div class="card"><span class="mut">✅ حضر</span><b>${p}</b></div><div class="card"><span class="mut">❌ غاب</span><b>${a}</b></div></div>
  <button class="btn" style="width:100%" data-a="allp">✅ الكل حضر</button>
  <div class="card">${sts.length?sts.map(s=>`<div class="li"><div class="nm">${esc(s.name)}${ag==='all'?`<div class="mut">${esc((grp(s.groupId)||{}).name||'')}</div>`:''}</div><div class="att"><button class="btn p ${st(s)==='p'?'on':''}" data-a="att" data-v="p" data-s="${s.id}">✅ حضر</button><button class="btn a ${st(s)==='a'?'on':''}" data-a="att" data-v="a" data-s="${s.id}">❌ غاب</button></div></div>`).join(''):'<div class="mut">لا يوجد طلاب</div>'}</div>`}
function sheetData(){const g=UI.group,m=UI.month;const c=calc(g,m);let rows=c.rows.slice();if(!UI.rankOrig)rows.sort((a,b)=>a.rank-b.rank||a.i-b.i);return{c,rows}}
function vSheet(){
  if(!DB.groups.length)return `<h1>📊 الكشف</h1>`+noGroups();
  const g=UI.group,m=UI.month;const{c,rows}=sheetData();
  const absN=sid=>DB.attendance.filter(a=>a.studentId===sid&&a.status==='a'&&a.date.startsWith(m)).length;
  const top=c.rows.filter(r=>r.rank<=3&&c.max>0).sort((a,b)=>a.rank-b.rank).slice(0,6);
  return `<h1>📊 الكشف</h1><div class="row"><select class="grow" data-a="selgrp">${grpOpts(g)}</select><select class="grow" data-a="selmonth">${monthOpts(m)}</select></div>
  ${top.length?`<div class="top3">${top.map(r=>`<div class="card"><div style="font-size:26px">${medal(r.rank)}</div><b>${esc(r.s.name)}</b><div class="mut">${fmt(r.total)} / ${fmt(c.max)}</div></div>`).join('')}</div>`:''}
  <div class="row" style="margin:8px 0"><button class="btn sec" data-a="rank">${UI.rankOrig?'🏅 رتّب بالأعلى':'↩️ رجّع الترتيب الأصلي'}</button><button class="btn sec" data-a="csv">📋 نسخ الكشف CSV</button><button class="btn sec sm" data-a="scr" data-v="1">⬅️</button><button class="btn sec sm" data-a="scr" data-v="-1">➡️</button></div>
  <div class="tw" id="tw"><table><thead><tr><th>الترتيب</th><th class="stu">الطالب</th>${c.qn.map(n=>`<th>ك${n}</th>`).join('')}${c.exs.map(e=>`<th>${esc(e.name)}<br><small>/${e.maxScore}</small></th>`).join('')}<th>المجموع<br><small>/${fmt(c.max)}</small></th><th>📅 غياب</th><th>📤</th></tr></thead><tbody>
  ${rows.map(r=>`<tr><td>${medal(r.rank)} ${r.rank}</td><td class="stu">${esc(r.s.name)}</td>${c.qn.map(n=>{const q=getQ(r.s.id,m,n);return `<td>${q?esc(q.value):'-'}</td>`}).join('')}${c.exs.map(e=>{const x=getE(e.id,r.s.id);return `<td>${x?esc(x.value):'-'}</td>`}).join('')}<td><b>${fmt(r.total)}</b></td><td>${absN(r.s.id)}</td><td><button class="btn sm" data-a="wa" data-s="${r.s.id}">📤 واتساب</button></td></tr>`).join('')}
  </tbody></table></div>${rows.length?'':'<div class="card mut">لا يوجد طلاب</div>'}`}
const paid=(sid,m)=>{const p=DB.payments.find(x=>x.studentId===sid&&x.month===m);return p?+p.paid:0};
const groupPaid=(gid,m)=>gStudents(gid).reduce((a,s)=>a+paid(s.id,m),0);
const feeTotals=m=>({due:DB.groups.reduce((a,g)=>a+(+g.monthlyFee||0)*gStudents(g.id).length,0),paid:DB.groups.reduce((a,g)=>a+groupPaid(g.id,m),0)});
const statusPill=(p,fee)=>p<=0?'<span class="pill er">❌ لم يدفع</span>':p<fee?'<span class="pill wr">⏳ دفع جزئي</span>':'<span class="pill ok">✅ دفع</span>';
function vFees(){
  if(!DB.groups.length)return `<h1>💰 المصاريف</h1>`+noGroups();
  if(!grp(UI.feeGroup))UI.feeGroup=UI.group;
  const m=UI.month,g=grp(UI.feeGroup);const t=feeTotals(m);
  return `<h1>💰 المصاريف</h1><div class="row"><select class="grow" data-a="selmonth">${monthOpts(m)}</select></div>
  <div class="sumcards"><div class="card"><span class="mut">مستحق للتحصيل</span><b id="totdue">${fmt(t.due)}</b></div><div class="card"><span class="mut">تم تحصيله</span><b id="totpaid">${fmt(t.paid)}</b></div></div>
  <select data-a="feegrp">${grpOpts(UI.feeGroup)}</select>
  <div class="card"><div class="row"><span class="grow">💵 مصروفات الطالب في الشهر</span><input id="fee" inputmode="decimal" value="${g.monthlyFee||0}" style="width:100px;text-align:center"></div>
  <div class="row" style="margin-top:8px"><div class="card grow" style="margin:0;text-align:center"><span class="mut">المستحق</span><br><b id="gdue">${fmt(g.monthlyFee*gStudents(g.id).length)}</b></div><div class="card grow" style="margin:0;text-align:center"><span class="mut">اتدفع</span><br><b id="gpaid">${fmt(groupPaid(g.id,m))}</b></div></div></div>
  <div class="card">${gStudents(g.id).map((s,i)=>{const p=paid(s.id,m);return `<div class="li"><div class="nm">${esc(s.name)}</div><span id="st-${s.id}">${statusPill(p,g.monthlyFee)}</span><input class="sc" data-k="p" data-s="${s.id}" data-i="${i}" inputmode="decimal" enterkeyhint="next" value="${p||''}" placeholder="0" style="width:84px"></div>`}).join('')||'<div class="mut">لا يوجد طلاب</div>'}</div>`}
function modalHTML(){const s=stu(UI.modal);if(!s)return '';return `<div class="modal"><div class="card"><h2 style="margin-top:0">✏️ تعديل الطالب</h2><input id="enm" value="${esc(s.name)}"><div style="height:8px"></div><input id="eph" value="${esc(s.parentPhone||'')}" inputmode="tel" dir="ltr" style="text-align:right" placeholder="رقم ولي الأمر"><div style="height:8px"></div><select id="egr">${grpOpts(s.groupId)}</select><div class="row" style="margin-top:12px"><button class="btn grow" data-a="savestu">حفظ</button><button class="btn sec grow" data-a="closemodal">إلغاء</button></div></div></div>`}

/* ---------- reports / csv ---------- */
function report(sid){
  const s=stu(sid),g=grp(s.groupId),m=UI.month,c=calc(g.id,m),r=c.rows.find(x=>x.s.id===sid);
  const q=c.qn.map(n=>{const x=getQ(sid,m,n);return `ك${n}: ${x?(x.value==='غ'?'غائب':x.value+'/'+maxQ()):'-'}`});
  const ex=c.exs.map(e=>{const x=getE(e.id,sid);return `${e.name}: ${x?x.value:'-'}/${e.maxScore}`});
  const at=DB.attendance.filter(a=>a.studentId===sid&&a.date.startsWith(m)).sort((a,b)=>a.date<b.date?-1:1);
  const pr=at.filter(a=>a.status==='p'),ab=at.filter(a=>a.status==='a');
  const d=x=>x.date.slice(8)+'/'+x.date.slice(5,7);
  const n=c.rows.length;
  return ['السلام عليكم، تقرير الطالب: '+s.name,'المجموعة: '+g.name+' - شهر '+monthName(m),'',
   '📝 الكويزات: '+(q.length?q.join(' | '):'لا يوجد'),'🧪 الاختبارات: '+(ex.length?ex.join(' | '):'لا يوجد'),
   '📊 المجموع: '+fmt(r.total)+' من '+fmt(c.max),'🏅 الترتيب: '+(medal(r.rank)?medal(r.rank)+' ':'')+r.rank+' من '+n,
   '✅ الحضور: '+pr.length+' حصة'+(pr.length?' ('+pr.map(d).join('، ')+')':''),'❌ الغياب: '+ab.length+' حصة'+(ab.length?' ('+ab.map(d).join('، ')+')':''),'',TEACHER.name,TEACHER.phone].join('\n')}
const csvCell=v=>{v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
function sheetCSV(){const m=UI.month,{c,rows}=sheetData();const head=['الترتيب','الطالب',...c.qn.map(n=>'ك'+n),...c.exs.map(e=>e.name+' /'+e.maxScore),'المجموع /'+fmt(c.max),'غياب'];
  const lines=[head,...rows.map(r=>[r.rank,r.s.name,...c.qn.map(n=>{const q=getQ(r.s.id,m,n);return q?q.value:''}),...c.exs.map(e=>{const x=getE(e.id,r.s.id);return x?x.value:''}),fmt(r.total),DB.attendance.filter(a=>a.studentId===r.s.id&&a.status==='a'&&a.date.startsWith(m)).length])];
  return lines.map(l=>l.map(csvCell).join(',')).join('\n')}
function allCSV(){const L=[['الكيان','المجموعة','الطالب','الشهر','البند','القيمة']];
  DB.quizScores.forEach(q=>{const s=stu(q.studentId);if(s)L.push(['كويز',(grp(s.groupId)||{}).name,s.name,q.month,'ك'+q.quizNo,q.value])});
  DB.examScores.forEach(x=>{const e=DB.exams.find(e=>e.id===x.examId),s=stu(x.studentId);if(e&&s)L.push(['اختبار',(grp(s.groupId)||{}).name,s.name,e.month,e.name+' /'+e.maxScore,x.value])});
  DB.attendance.forEach(a=>{const s=stu(a.studentId);if(s)L.push(['حضور',(grp(s.groupId)||{}).name,s.name,a.date.slice(0,7),a.date,a.status==='p'?'حاضر':'غائب'])});
  DB.payments.forEach(p=>{const s=stu(p.studentId);if(s)L.push(['مصروفات',(grp(s.groupId)||{}).name,s.name,p.month,'مدفوع',p.paid])});
  return L.map(l=>l.map(csvCell).join(',')).join('\n')}

/* ---------- actions ---------- */
function clearConfirmSoon(){clearTimeout(clearConfirmSoon.t);clearConfirmSoon.t=setTimeout(()=>{if(UI.confirm){UI.confirm='';render(true)}},4000)}
function importDB(txt){let o;try{o=JSON.parse(txt)}catch(e){toast('النص مش صحيح ❌');return false}
  if(!o||!Array.isArray(o.students)||!Array.isArray(o.groups)){toast('النسخة مش صحيحة ❌');return false}
  DB=mergeDB(o);UI.group='';UI.confirm='';save();render();toast('تم الاسترجاع ✅');return true}
function focusIdx(i){const el=document.querySelector(`input.sc[data-i="${i}"]`);if(el){el.focus();el.select&&el.select();return true}return false}
function delStudent(id){DB.students=DB.students.filter(s=>s.id!==id);DB.quizScores=DB.quizScores.filter(x=>x.studentId!==id);DB.examScores=DB.examScores.filter(x=>x.studentId!==id);DB.attendance=DB.attendance.filter(x=>x.studentId!==id);DB.payments=DB.payments.filter(x=>x.studentId!==id)}
const A={
  tab(el){UI.tab=el.dataset.v;UI.confirm='';scrollTo(0,0);render()},
  theme(){DB.ui.theme=DB.ui.theme==='auto'?'dark':DB.ui.theme==='dark'?'light':'auto';save();render(true)},
  addgrp(){const i=$('#newg');const n=i.value.trim();if(!n)return;const g={id:uid(),name:n,monthlyFee:0};DB.groups.push(g);if(!UI.group)UI.group=g.id;save();render(true);$('#newg').focus()},
  addstu(){const n=$('#nname').value.trim();if(!n)return toast('اكتب اسم الطالب');const gid=$('#ngrp').value;DB.students.push({id:uid(),name:n,groupId:gid,parentPhone:$('#nphone').value.trim()});DB.ui.lastGroup=gid;save();render(true);$('#nname').focus();toast('تمت الإضافة ✅')},
  opengrp(el){UI.group=el.dataset.v;UI.tab='sheet';scrollTo(0,0);render()},
  delgrp(el){const id=el.dataset.v;if(UI.confirm==='g'+id){gStudents(id).map(s=>s.id).forEach(delStudent);const ex=DB.exams.filter(e=>e.groupId===id).map(e=>e.id);DB.exams=DB.exams.filter(e=>e.groupId!==id);DB.examScores=DB.examScores.filter(x=>!ex.includes(x.examId));DB.groups=DB.groups.filter(g=>g.id!==id);UI.confirm='';save();render(true)}else{UI.confirm='g'+id;render(true);clearConfirmSoon()}},
  delstu(el){const id=el.dataset.v;if(UI.confirm==='s'+id){delStudent(id);UI.confirm='';save();render(true)}else{UI.confirm='s'+id;render(true);clearConfirmSoon()}},
  editstu(el){UI.modal=el.dataset.v;render(true)},
  closemodal(){UI.modal=null;render(true)},
  savestu(){const s=stu(UI.modal);const n=$('#enm').value.trim();if(!n)return;s.name=n;s.parentPhone=$('#eph').value.trim();s.groupId=$('#egr').value;UI.modal=null;save();render(true)},
  selgrp(el){UI.group=el.value;UI.page=0;UI.exam='';render(true)},
  selmonth(el){UI.month=el.value;UI.page=0;UI.exam='';render(true)},
  gtab(el){UI.gtab=el.dataset.v;UI.page=0;render(true)},
  quiz(el){UI.quiz=+el.dataset.v;render(true)},
  addquiz(){UI.maxShown=UI.maxShown+1;UI.quiz=UI.maxShown;render(true)},
  pg(el){const pages=Math.ceil(gStudents(UI.group).length/10);UI.page=Math.min(Math.max(0,UI.page+ +el.dataset.v),pages-1);render(true)},
  abs(el){const m=UI.month,sid=el.dataset.s;const q=getQ(sid,m,UI.quiz);setQ(sid,m,UI.quiz,q&&q.value==='غ'?'':'غ');save();render(true)},
  exam(el){UI.exam=el.dataset.v;UI.page=0;render(true)},
  addexam(){const n=$('#exname').value.trim();const mx=parseFloat(normNum($('#exmax').value));if(!n||!(mx>0))return toast('اكتب الاسم والدرجة النهاية');const e={id:uid(),groupId:UI.group,month:UI.month,name:n,maxScore:mx};DB.exams.push(e);UI.exam=e.id;save();render(true)},
  delexam(el){const id=el.dataset.v;if(UI.confirm==='e'+id){DB.exams=DB.exams.filter(e=>e.id!==id);DB.examScores=DB.examScores.filter(x=>x.examId!==id);UI.confirm='';UI.exam='';save();render(true)}else{UI.confirm='e'+id;render(true);clearConfirmSoon()}},
  attgrp(el){UI.attGroup=el.value;render(true)},
  att(el){const sid=el.dataset.s,v=el.dataset.v;const i=DB.attendance.findIndex(a=>a.date===UI.attDate&&a.studentId===sid);if(i>=0&&DB.attendance[i].status===v)DB.attendance.splice(i,1);else if(i>=0)DB.attendance[i].status=v;else DB.attendance.push({date:UI.attDate,studentId:sid,status:v});save();render(true)},
  allp(){const ag=UI.attGroup==='all'||!grp(UI.attGroup)?'all':UI.attGroup;(ag==='all'?DB.students:gStudents(ag)).forEach(s=>{const a=DB.attendance.find(x=>x.date===UI.attDate&&x.studentId===s.id);if(a)a.status='p';else DB.attendance.push({date:UI.attDate,studentId:s.id,status:'p'})});save();render(true)},
  rank(){UI.rankOrig=!UI.rankOrig;render(true)},
  scr(el){const w=$('#tw');if(w)w.scrollBy({left:-(+el.dataset.v)*180,behavior:'smooth'})},
  csv(){copyText(sheetCSV())},
  wa(el){const s=stu(el.dataset.s);const p=waPhone(s.parentPhone);const t=encodeURIComponent(report(s.id));location.href=(p?`https://wa.me/${p}?text=`:'https://wa.me/?text=')+t},
  feegrp(el){UI.feeGroup=el.value;render(true)},
  expjson(){dl('students-backup-'+today()+'.json',JSON.stringify(DB),'application/json')},
  copyjson(){copyText(JSON.stringify(DB))},
  expcsv(){dl('grades-'+today()+'.csv',allCSV(),'text/csv')},
  restoretext(){const t=$('#rtext').value.trim();if(!t)return toast('الصق النص الأول');if(confirm('هيتم استبدال كل البيانات الحالية. متأكد؟'))importDB(t)},
  restorefile(){$('#rfile').click()},
  async snaps(){const ks=(await snapKeys()).sort().reverse();$('#snaplist').innerHTML=ks.length?`<div style="height:8px"></div><select id="snapsel">${ks.map(k=>`<option>${k}</option>`).join('')}</select><div style="height:8px"></div><button class="btn" data-a="dosnap">♻️ استرجاع هذا اليوم</button>`:'<div class="mut">لا توجد نسخ يومية بعد</div>'},
  async dosnap(){const k=$('#snapsel').value;if(!confirm('استرجاع نسخة '+k+'؟ هيتم استبدال البيانات الحالية.'))return;const t=await snapGet(k);if(t)importDB(t)}
};
document.addEventListener('click',e=>{const el=e.target.closest('[data-a]');if(!el||el.tagName==='SELECT'||el.tagName==='INPUT')return;const f=A[el.dataset.a];if(f)f(el)});
document.addEventListener('change',e=>{const el=e.target;
  if(el.id==='rfile'){const f=el.files[0];if(f){const r=new FileReader();r.onload=()=>{if(confirm('هيتم استبدال كل البيانات الحالية. متأكد؟'))importDB(r.result)};r.readAsText(f)}return}
  if(el.tagName==='SELECT'&&el.dataset.a&&A[el.dataset.a]){A[el.dataset.a](el);return}
  if(el.id==='attdate'){UI.attDate=el.value||today();render(true)}
  if(el.id==='maxq'){const v=parseFloat(normNum(el.value));if(v>0){DB.settings.maxQuiz=v;save();toast('تم الحفظ')}else el.value=maxQ()}
  if(el.id==='exmaxedit'){const v=parseFloat(normNum(el.value));if(v>0){const ex=DB.exams.find(x=>x.id===UI.exam);ex.maxScore=v;DB.examScores.forEach(x=>{if(x.examId===ex.id&&+x.value>v)x.value=String(v)});save();render(true)}}
  if(el.id==='fee'){const v=parseFloat(normNum(el.value))||0;grp(UI.feeGroup).monthlyFee=v;save();render(true)}});
document.addEventListener('input',e=>{const el=e.target;const k=el.dataset&&el.dataset.k;if(!k)return;const sid=el.dataset.s,m=UI.month;
  if(k==='q'){const v=parseScore(el.value,maxQ());setQ(sid,m,UI.quiz,v);const b=el.parentNode.querySelector('.gbtn');if(b)b.classList.toggle('on',v==='غ');save()}
  else if(k==='e'){const ex=DB.exams.find(x=>x.id===UI.exam);const v=parseScore(el.value,ex.maxScore);setE(ex.id,sid,v==='غ'?'':v);save()}
  else if(k==='p'){const n=Math.max(0,parseFloat(normNum(el.value))||0);let p=DB.payments.find(x=>x.studentId===sid&&x.month===m);if(p)p.paid=n;else DB.payments.push({studentId:sid,month:m,paid:n});save();refreshFees(sid)}});
function refreshFees(sid){const g=grp(UI.feeGroup),m=UI.month;const s=$('#st-'+sid);if(s)s.innerHTML=statusPill(paid(sid,m),g.monthlyFee);$('#gpaid').textContent=fmt(groupPaid(g.id,m));const t=feeTotals(m);$('#totpaid').textContent=fmt(t.paid);$('#totdue').textContent=fmt(t.due)}
document.addEventListener('keydown',e=>{const el=e.target;if(e.key!=='Enter')return;
  if(el.dataset&&el.dataset.k){e.preventDefault();const i=+el.dataset.i;if(!focusIdx(i+1))el.blur();return}
  if(el.id==='newg'){e.preventDefault();A.addgrp()}
  else if(el.id==='nname'||el.id==='nphone'){e.preventDefault();A.addstu()}
  else if(el.id==='exname'||el.id==='exmax'){e.preventDefault();A.addexam()}
  else if(el.tagName==='INPUT'&&el.id){el.blur()}});
let tx0=null;document.addEventListener('touchstart',e=>{const sw=e.target.closest('#swipe');tx0=sw?e.touches[0].clientX:null},{passive:true});
document.addEventListener('touchend',e=>{if(tx0==null)return;const dx=e.changedTouches[0].clientX-tx0;tx0=null;if(Math.abs(dx)>80){const b=document.querySelector(`[data-a="pg"][data-v="${dx>0?-1:1}"]`);if(b&&!b.disabled)b.click()}});

/* ---------- boot ---------- */
(async()=>{try{await loadDB()}catch(e){console.error(e);UI.noStore=true;toast('تعذر فتح التخزين')}
  if(!UI.group&&DB.groups[0])UI.group=DB.groups[0].id;render();
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});})();
