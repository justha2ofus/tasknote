// TaskNote 本体のプログラム（index.html から読み込まれる）
(function(){
'use strict';
const $=id=>document.getElementById(id);
const LS_KEY='tasknote.tasks.v1', LS_THEME='tasknote.theme';
const WD=['日','月','火','水','木','金','土'];
const ICON={
  clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 12l2 2 4-4"/></svg>',
  grip:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="7" r="1.6"/><circle cx="15" cy="7" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="17" r="1.6"/><circle cx="15" cy="17" r="1.6"/></svg>',
  repeat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 3l3 3-3 3"/><path d="M4 12V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 12v3a3 3 0 0 1-3 3H4"/></svg>'
};

/* ---------- date helpers ---------- */
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};
const today=()=>ymd(new Date());
const addDays=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return ymd(d);};
const dim=(y,m)=>new Date(y,m+1,0).getDate();
const fmtMD=s=>{const d=parse(s);return (d.getMonth()+1)+'/'+d.getDate()+'('+WD[d.getDay()]+')';};
const endTime=(t,min)=>{const [h,m]=t.split(':').map(Number);const x=h*60+m+min;return pad(Math.floor(x/60)%24)+':'+pad(x%60)+(x>=1440?'(翌)':'');};
const durLabel=m=>{if(m<60)return m+'分';const h=Math.floor(m/60),r=m%60;return r===30?h+'.5時間':r?h+'時間'+r+'分':h+'時間';};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const newId=()=>'t'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);

/* ---------- 日本の祝日・休日 ----------
   公式一覧（内閣府「国民の祝日について」・国立天文台「暦要項」）に載っている年はその一覧をそのまま使う。
   まだ公表されていない年だけ、祝日法のルールで計算した暫定値を使う（春分・秋分は毎年2月の官報で正式決定）。 */
const HOL_OFFICIAL={
  2026:{'01-01':'元日','01-12':'成人の日','02-11':'建国記念の日','02-23':'天皇誕生日','03-20':'春分の日','04-29':'昭和の日','05-03':'憲法記念日','05-04':'みどりの日','05-05':'こどもの日','05-06':'休日','07-20':'海の日','08-11':'山の日','09-21':'敬老の日','09-22':'休日','09-23':'秋分の日','10-12':'スポーツの日','11-03':'文化の日','11-23':'勤労感謝の日'},
  2027:{'01-01':'元日','01-11':'成人の日','02-11':'建国記念の日','02-23':'天皇誕生日','03-21':'春分の日','03-22':'休日','04-29':'昭和の日','05-03':'憲法記念日','05-04':'みどりの日','05-05':'こどもの日','07-19':'海の日','08-11':'山の日','09-20':'敬老の日','09-23':'秋分の日','10-11':'スポーツの日','11-03':'文化の日','11-23':'勤労感謝の日'}
};
const HOL_CACHE={};
function nthMon(y,m,n){const d=new Date(y,m,1);const off=(8-d.getDay())%7;return 1+off+(n-1)*7;}
function holidaysOf(y){
  if(HOL_CACHE[y]) return HOL_CACHE[y];
  if(HOL_OFFICIAL[y]){const o={};Object.entries(HOL_OFFICIAL[y]).forEach(([md,n])=>{o[y+'-'+md]=n;});return HOL_CACHE[y]=o;}
  const h={}, put=(m,d,n)=>{h[ymd(new Date(y,m-1,d))]=n;};
  put(1,1,'元日'); put(1,nthMon(y,0,2),'成人の日'); put(2,11,'建国記念の日'); put(2,23,'天皇誕生日');
  const k=y-1980, q=Math.floor(k/4);
  put(3,Math.floor(20.8431+0.242194*k-q),'春分の日（暫定）');
  put(4,29,'昭和の日'); put(5,3,'憲法記念日'); put(5,4,'みどりの日'); put(5,5,'こどもの日');
  put(7,nthMon(y,6,3),'海の日'); put(8,11,'山の日'); put(9,nthMon(y,8,3),'敬老の日');
  put(9,Math.floor(23.2488+0.242194*k-q),'秋分の日（暫定）');
  put(10,nthMon(y,9,2),'スポーツの日'); put(11,3,'文化の日'); put(11,23,'勤労感謝の日');
  const base=Object.keys(h).sort();
  // 国民の休日：祝日に挟まれた平日
  base.forEach(a=>{const mid=addDays(a,1),b=addDays(a,2);if(h[b]&&!h[mid]&&parse(mid).getDay()!==0)h[mid]='休日';});
  // 振替休日：祝日が日曜なら、その後の最も近い祝日でない日
  base.forEach(a=>{if(parse(a).getDay()===0){let d=addDays(a,1);while(h[d])d=addDays(d,1);h[d]='休日';}});
  // 春分・秋分に関係して決まる休日（3月・9月）も暫定扱い
  Object.keys(h).forEach(d=>{const m=d.slice(5,7);if(h[d]==='休日'&&(m==='03'||m==='09'))h[d]='休日（暫定）';});
  return HOL_CACHE[y]=h;
}
function holidayName(s){return holidaysOf(Number(s.slice(0,4)))[s]||null;}

/* ---------- repeat ---------- */
function occursOn(t,s){
  const r=t.repeat; if(!r||!r.type) return false;
  if(r.type==='daily') return true;
  const d=parse(s);
  if(r.type==='weekly') return (r.days||[]).includes(d.getDay());
  if(r.type==='monthly'){const dom=r.dom||parse(t.date).getDate();return d.getDate()===Math.min(dom,dim(d.getFullYear(),d.getMonth()));}
  return false;
}
function nextOcc(t,after){ // first occurrence strictly after `after`
  let s=after; for(let i=0;i<800;i++){s=addDays(s,1);if(occursOn(t,s))return s;} return addDays(after,1);
}

/* ---------- 読み込み・復元するデータの検査 ----------
   JSONの読み込みや控えからの復元で入ってくるタスクを、決まった形にそろえる。
   形が違う項目は空にする（タスク自体は消さない）。画面に出す前の安全確認も兼ねる。 */
const okDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(parse(v));
const okTime=v=>typeof v==='string'&&/^\d{1,2}:\d{2}$/.test(v);
function cleanTask(t){
  const has=k=>t[k]!==undefined;
  if(has('memo')&&t.memo!==null&&typeof t.memo!=='string') t.memo=(typeof t.memo==='number')?String(t.memo):null;
  if(!['open','done','deleted'].includes(t.status)) t.status='open';
  if(has('date')&&!okDate(t.date)) t.date=null;
  if(has('time')) t.time=okTime(t.time)?t.time.padStart(5,'0'):null;
  if(has('dur')){const n=Number(t.dur);t.dur=(t.dur!==null&&isFinite(n)&&n>0)?n:null;}
  t.tags=Array.isArray(t.tags)?t.tags.filter(g=>typeof g==='string'&&g):[];
  if(has('repeat')){
    const r=t.repeat;
    if(r&&typeof r==='object'&&['daily','weekly','monthly'].includes(r.type)){
      const o={type:r.type};
      if(Array.isArray(r.days)) o.days=r.days.filter(d=>Number.isInteger(d)&&d>=0&&d<=6);
      if(Number.isInteger(r.dom)&&r.dom>=1&&r.dom<=31) o.dom=r.dom;
      t.repeat=(o.type==='monthly'&&!o.dom&&!t.date)?null:o;
    }else t.repeat=null;
  }
  ['order','dayOrder'].forEach(k=>{if(has(k)&&!(typeof t[k]==='number'&&isFinite(t[k])))delete t[k];});
  if(has('rolledFrom')){
    const r=t.rolledFrom;
    if(r&&typeof r==='object'&&okDate(r.date)) t.rolledFrom={date:r.date,time:okTime(r.time)?r.time.padStart(5,'0'):null};
    else delete t.rolledFrom;
  }
  ['createdAt','updatedAt','doneAt','repeatOf'].forEach(k=>{if(has(k)&&typeof t[k]!=='string')delete t[k];});
  return t;
}

/* ---------- state ---------- */
const S={tasks:{},sel:today(),tag:null,inboxOpen:true,histMode:'done',calMonth:null,editing:null,today:today()};
function cacheLocal(){try{localStorage.setItem(LS_KEY,JSON.stringify(Object.values(S.tasks)));}catch(e){showNote('この端末に保存できませんでした。空き容量を確認してください。');}}
function loadLocal(){try{const a=JSON.parse(localStorage.getItem(LS_KEY)||'[]');a.forEach(t=>{if(t&&t.id)S.tasks[t.id]=t;});}catch(e){}}
function plain(t){return JSON.parse(JSON.stringify(t));}
// 正本はこの端末の中だけ。変更があるたびに保存し、控え置き場（GAS）への送信を予約する
function persist(t){
  t.updatedAt=new Date().toISOString();
  S.tasks[t.id]=t; cacheLocal(); backupDirty();
}
function hardDelete(id){ delete S.tasks[id]; cacheLocal(); backupDirty(); }
function showNote(msg,btn){
  const n=$('note'); if(!msg){n.style.display='none';return;}
  n.textContent=msg; if(btn){const b=document.createElement('button');b.textContent=btn.label;b.className='mini';b.style.marginLeft='8px';b.onclick=btn.onClick;n.appendChild(b);}
  n.style.display='block';
}
function setStoreMode(){
  $('storeInfo').textContent='保存先：この端末の中（電波がなくても使えます）。設定した控え置き場（GAS）には、電波があるときに自動で控えを送ります。';
}

/* ---------- rollover: 未完了の予定を「あとでやる」へ ---------- */
function minOrder(){let m=0;Object.values(S.tasks).forEach(t=>{if(t.status==='open'&&!t.date&&typeof t.order==='number')m=Math.min(m,t.order);});return m;}
function rollover(){
  const td=today(); S.today=td;
  Object.values(S.tasks).forEach(t=>{
    if(t.status!=='open'||!t.date||t.date>=td) return;
    const u=plain(t);
    if(u.repeat&&u.repeat.type){u.date=occursOn(u,td)?td:nextOcc(u,td);}
    else{u.rolledFrom={date:u.date,time:u.time||null};u.date=null;u.order=minOrder()-1;}
    persist(u);
  });
}

/* ---------- render ---------- */
function linkify(txt){return esc(txt).replace(/https?:\/\/[^\s<]+/g,u=>'<a href="'+u+'" target="_blank" rel="noopener noreferrer">'+u+'</a>');}
function tagsHtml(t){return (t.tags||[]).map(g=>'<span class="tag">#'+esc(g)+'</span>').join('');}
function cardHtml(t,opt){
  opt=opt||{};
  const timed=!!t.time;
  let meta='';
  if(opt.inbox&&t.rolledFrom){meta+='<s>'+esc(fmtMD(t.rolledFrom.date))+(t.rolledFrom.time?' '+esc(t.rolledFrom.time):'')+'</s>';}
  if(!opt.inbox&&timed) meta+='<span class="tm">'+esc(t.time)+(t.dur?'〜'+esc(endTime(t.time,t.dur)):'')+'</span>';
  if(t.dur&&(opt.inbox||!timed)) meta+='<span>'+durLabel(t.dur)+'</span>';
  if(t.repeat&&t.repeat.type) meta+='<span title="繰り返し" style="display:inline-flex;width:13px">'+ICON.repeat+'</span>';
  meta+=tagsHtml(t);
  const open=t.memo&&S.expanded===t.id;
  if(t.memo&&!open){const ml=String(t.memo).split(/\r?\n/).find(x=>x.trim())||'';if(ml)meta+='<span class="mm">'+esc(ml)+'</span>';}
  const ic=timed?ICON.clock:ICON.check;
  return '<div class="card'+(opt.virtual?' virtual':'')+(open?' open':'')+'" data-id="'+esc(t.id)+'">'+
    '<div class="ic">'+ic+'</div>'+
    '<div class="bd"><div class="tt">'+esc(t.title)+'</div>'+(meta?'<div class="mt">'+meta+'</div>':'')+
    (open?'<div class="mfull">'+linkify(t.memo)+'</div><div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="mini" data-act="edit">編集する</button></div>':'')+'</div>'+
    '<button class="chk" aria-label="完了"></button></div>';
}
function hasOn(s){return Object.values(S.tasks).some(t=>t.status==='open'&&t.date&&(t.date===s||(t.date<s&&occursOn(t,s))));}
function render(){
  if(S.dragBusy){S.renderPending=true;return;}
  S.renderPending=false;
  const sel=S.sel,d=parse(sel),td=today();
  $('hDay').textContent=d.getDate();
  const dw=d.getDay();
  const hn=holidayName(sel);
  $('hMonth').innerHTML=(d.getMonth()+1)+'月<span class="wdl'+(dw===0||hn?' sun':dw===6?' sat':'')+'">'+WD[dw]+'</span>';
  $('hYear').textContent=d.getFullYear();
  $('todayBtn').classList.toggle('on',sel!==td);
  // week (Mon start)
  const off=(d.getDay()+6)%7, mon=addDays(sel,-off);
  let w='<div class="r7">';['月','火','水','木','金','土','日'].forEach((x,i)=>{const hol=holidayName(addDays(mon,i));w+='<div class="w'+(i===6||hol?' sun':i===5?' sat':'')+'"'+(hol?' title="'+esc(hol)+'"':'')+'>'+x+'</div>';});
  w+='</div><div class="r7" id="weekDays">';
  for(let i=0;i<7;i++){const s=addDays(mon,i);w+='<button data-d="'+s+'" class="'+(i===6||holidayName(s)?'hsun ':i===5?'hsat ':'')+(s===sel?'sel ':'')+(s===td?'is-today':'')+'"><span>'+parse(s).getDate()+'</span><i class="'+(hasOn(s)?'on':'')+'"></i></button>';}
  $('week').innerHTML=w+'</div>';
  // scheduled
  const all=Object.values(S.tasks);
  const real=all.filter(t=>t.status==='open'&&t.date===sel);
  const virt=sel>td?all.filter(t=>t.status==='open'&&t.date&&t.date<sel&&occursOn(t,sel)):[];
  const items=real.map(t=>({t,v:false})).concat(virt.map(t=>({t,v:true})));
  const dOrd=t=>typeof t.dayOrder==='number'?t.dayOrder:1e9;
  const untimed=items.filter(x=>!x.t.time).sort((a,b)=>(a.v-b.v)||(dOrd(a.t)-dOrd(b.t))||String(a.t.createdAt).localeCompare(String(b.t.createdAt))), timed=items.filter(x=>x.t.time).sort((a,b)=>a.t.time.localeCompare(b.t.time));
  let h='';
  if(!items.length) h='<div class="empty">この日の予定はありません</div>';
  if(hn) h='<div class="holname">'+esc(hn)+'</div>'+h;
  if(timed.length){if(untimed.length)h+='<div class="lbl">時間順</div>';h+=timed.map(x=>cardHtml(x.t,{virtual:x.v})).join('');}
  if(untimed.length){h+='<div class="lbl">時間指定なし</div><div class="sortable" id="untimedList">'+untimed.map(x=>cardHtml(x.t,{virtual:x.v,sortable:!x.v})).join('')+'</div>';}
  $('sched').innerHTML=h;
  // inbox
  let inbox=all.filter(t=>t.status==='open'&&!t.date).sort((a,b)=>(a.order||0)-(b.order||0)||String(a.createdAt).localeCompare(String(b.createdAt)));
  $('inboxCnt').textContent=inbox.length;
  const tags=[...new Set(inbox.flatMap(t=>t.tags||[]))].sort();
  if(S.tag&&!tags.includes(S.tag)) S.tag=null;
  $('tagBar').innerHTML=tags.length?('<button data-tag="" class="'+(S.tag?'':'on')+'">すべて</button>'+tags.map(g=>'<button data-tag="'+esc(g)+'" class="'+(S.tag===g?'on':'')+'">#'+esc(g)+'</button>').join('')):'';
  $('tagBar').style.display=tags.length?'':'none';
  if(S.tag) inbox=inbox.filter(t=>(t.tags||[]).includes(S.tag));
  $('ilist').innerHTML=inbox.length?inbox.map(t=>cardHtml(t,{inbox:true})).join(''):'<div class="empty">何もありません</div>';
  $('inbox').classList.toggle('closed',!S.inboxOpen);
  document.querySelector('.app').classList.toggle('ibclosed',!S.inboxOpen);
  document.querySelector('.app').classList.toggle('full',S.inboxFull&&S.inboxOpen);
  $('expPath').setAttribute('d',S.inboxFull&&S.inboxOpen?'M8 6l4 4 4-4M8 14l4 4 4-4':'M8 10l4-4 4 4M8 18l4-4 4 4');
  $('expBtn').setAttribute('aria-label',S.inboxFull?'元の高さに戻す':'上まで広げる');
}

/* ---------- actions ---------- */
let toastTimer=null,undoFn=null;
function toast(msg,undo){
  $('toastMsg').textContent=msg; undoFn=undo||null;
  $('toastUndo').style.display=undo?'':'none';
  $('toast').classList.add('show'); clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{$('toast').classList.remove('show');undoFn=null;},5000);
}
$('toastUndo').onclick=()=>{if(undoFn)undoFn();undoFn=null;$('toast').classList.remove('show');render();};

function complete(id){
  const t=S.tasks[id]; if(!t) return;
  const before=plain(t), now=new Date().toISOString();
  if(t.repeat&&t.repeat.type&&t.date){
    const copy=plain(t); copy.id=newId(); copy.repeat=null; copy.status='done'; copy.doneAt=now; copy.repeatOf=t.id; copy.createdAt=now;
    persist(copy);
    const u=plain(t); u.date=nextOcc(u,u.date); persist(u);
    toast('完了（次回 '+fmtMD(u.date)+'）',()=>{hardDelete(copy.id);persist(before);});
  }else{
    const u=plain(t); u.status='done'; u.doneAt=now; persist(u);
    toast('完了しました',()=>persist(before));
  }
  render();
}
function softDelete(id){
  const t=S.tasks[id]; if(!t) return; const before=plain(t);
  const u=plain(t); u.status='deleted'; u.doneAt=new Date().toISOString(); persist(u);
  toast('削除しました',()=>persist(before)); render();
}

/* clicks on cards */
function cardClick(e){
  const card=e.target.closest('.card'); if(!card) return;
  const id=card.dataset.id;
  if(e.target.closest('.chk')){
    e.target.closest('.chk').classList.add('done');
    setTimeout(()=>complete(id),180); return;
  }
  if(e.target.closest('a')) return;
  if(e.target.closest('[data-act="edit"]')){openEdit(id);return;}
  if(e.target.closest('.bd')){
    const t=S.tasks[id];
    if(t&&t.memo){if(window.getSelection&&String(window.getSelection()).length)return;S.expanded=S.expanded===id?null:id;render();}
    else openEdit(id);
  }
}
$('sched').addEventListener('click',cardClick);
$('ilist').addEventListener('click',cardClick);

$('week').addEventListener('click',e=>{if(weekSwiped){weekSwiped=false;return;}const b=e.target.closest('button[data-d]');if(b){S.sel=b.dataset.d;S.inboxFull=false;render();}});
/* swipe the week strip: left = next week, right = previous week */
let weekSwiped=false;
(function(){
  const wk=$('week'); let sw=null;
  const row=()=>$('weekDays');
  wk.addEventListener('pointerdown',e=>{if(e.button>0||!e.target.closest('#weekDays'))return;sw={id:e.pointerId,x:e.clientX,y:e.clientY,t:Date.now(),on:false,dx:0};});
  wk.addEventListener('pointermove',e=>{
    if(!sw||e.pointerId!==sw.id)return;
    const dx=e.clientX-sw.x, dy=e.clientY-sw.y;
    if(!sw.on){ if(Math.abs(dx)<10)return; if(Math.abs(dy)>Math.abs(dx)){sw=null;return;} sw.on=true; try{wk.setPointerCapture(sw.id);}catch(_){} }
    sw.dx=dx; const r=row(); r.style.transition='none'; r.style.transform='translateX('+dx+'px)'; r.style.opacity=String(1-Math.min(Math.abs(dx)/400,.4));
  });
  function end(e){
    if(!sw||(e&&e.pointerId!==sw.id))return;
    const s0=sw; sw=null; if(!s0.on)return;
    weekSwiped=true; setTimeout(()=>{weekSwiped=false;},300);
    const r=row(), w=wk.clientWidth, fast=Math.abs(s0.dx)/(Date.now()-s0.t)>0.4;
    if(Math.abs(s0.dx)>w*0.22||(fast&&Math.abs(s0.dx)>30)){
      const dir=s0.dx<0?1:-1;
      r.style.transition='transform .16s ease, opacity .16s ease'; r.style.transform='translateX('+(-dir*w)+'px)'; r.style.opacity='0';
      setTimeout(()=>{
        S.sel=addDays(S.sel,7*dir); S.inboxFull=false; render();
        const n=row(); n.style.transition='none'; n.style.transform='translateX('+(dir*w*0.6)+'px)'; n.style.opacity='0';
        requestAnimationFrame(()=>requestAnimationFrame(()=>{n.style.transition='transform .2s ease, opacity .2s ease';n.style.transform='';n.style.opacity='';}));
      },160);
    }else{ r.style.transition='transform .18s ease, opacity .18s ease'; r.style.transform=''; r.style.opacity=''; }
  }
  wk.addEventListener('pointerup',end); wk.addEventListener('pointercancel',end);
})();
$('prevBtn').onclick=()=>{S.sel=addDays(S.sel,-1);render();};
$('nextBtn').onclick=()=>{S.sel=addDays(S.sel,1);render();};
$('todayBtn').onclick=()=>{S.sel=today();render();};
$('togBtn').onclick=e=>{e.stopPropagation();S.inboxOpen=!S.inboxOpen;render();};
$('inboxHd').onclick=e=>{
  if(e.target.closest('#expBtn')||e.target.closest('#togBtn'))return;
  if(!S.inboxOpen){S.inboxOpen=true;render();}
  const sc=$('inbox'); sc.scrollTo({top:S.inboxFull?0:$('sched').offsetHeight,behavior:'smooth'});
};
$('expBtn').onclick=e=>{e.stopPropagation();if(!S.inboxOpen){S.inboxOpen=true;S.inboxFull=true;}else S.inboxFull=!S.inboxFull;saveH();render();$('inbox').scrollTop=0;};
try{S.inboxFull=!!localStorage.getItem('tasknote.full');}catch(_){}
$('tagBar').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.tag=b.dataset.tag||null;render();});

/* ---------- inbox height (drag the grabber) ---------- */
try{localStorage.removeItem('tasknote.h');}catch(_){}
function availH(){const app=document.querySelector('.app');const top=$('week').getBoundingClientRect().bottom-app.getBoundingClientRect().top;return Math.max(120,app.clientHeight-top);}
function applyInboxH(){}
function saveH(){try{localStorage.setItem('tasknote.h',S.inboxH?String(S.inboxH):'');localStorage.setItem('tasknote.full',S.inboxFull?'1':'');}catch(_){}}
/* overlays */
function openOv(id){$(id).classList.add('show');}
function closeOv(id){$(id).classList.remove('show');}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeOv(b.dataset.close)));
document.querySelectorAll('.ov').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)closeOv(o.id);}));

/* ---------- edit sheet ---------- */
const DURS=[null,15,30,60,90,120,180,240];
let fDur=null;
function toMin(t){const [h,m]=t.split(':').map(Number);return h*60+m;}
function updEmpty(){['fDate','fTime','fEnd'].forEach(id=>{const el=$(id);el.parentNode.classList.toggle('unset',!el.value);});}
['fDate','fTime','fEnd'].forEach(id=>{$(id).addEventListener('input',updEmpty);$(id).addEventListener('change',updEmpty);$(id).addEventListener('blur',updEmpty);});
function renderDur(){
  const st=$('fTime').value;
  const list=DURS;
  $('fDurs').innerHTML=list.map(d=>'<button data-m="'+(d||'')+'" class="'+((d||null)===(fDur||null)?'on':'')+'">'+(d?durLabel(d):'なし')+'<small>'+(st&&d?'〜'+endTime(st,d):'')+'</small></button>').join('');
  $('fEnd').value=st&&fDur&&fDur<1440?endTime(st,fDur).slice(0,5):'';
  $('fEnd').disabled=!st;
  updEmpty();
  $('fDurNote').textContent=st?(fDur?durLabel(fDur):''):'開始時刻を入れると使えます';
}
$('fDurs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;fDur=b.dataset.m?Number(b.dataset.m):null;renderDur();});
$('fTime').addEventListener('input',renderDur);
$('fEnd').addEventListener('change',()=>{const st=$('fTime').value,en=$('fEnd').value;if(!st||!en){fDur=null;renderDur();return;}let d=toMin(en)-toMin(st);if(d<=0)d+=1440;fDur=d;renderDur();});
let fRepType='', fWdays=[], fTagSel=new Set();
function allTags(){return [...new Set(Object.values(S.tasks).filter(t=>t.status!=='deleted').flatMap(t=>t.tags||[]))].sort();}
function parseTags(s){return [...new Set(String(s).split(/[\s,、，]+/).map(x=>x.replace(/^#/,'').trim()).filter(Boolean))];}
function syncQuick(){
  if(typeof updEmpty==='function')updEmpty();
  const v=$('fDate').value,td=today();
  const q=!v?'later':v===td?'today':v===addDays(td,1)?'tomorrow':v===S.sel?'sel':'';
  $('fQuick').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.q===q));
  $('fQuick').querySelector('[data-q="sel"]').style.display=(S.sel===td||S.sel===addDays(td,1))?'none':'';
}
function renderRep(){
  $('fRep').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.r===fRepType));
  const wd=$('fWd'); wd.style.display=fRepType==='weekly'?'flex':'none';
  wd.innerHTML=[1,2,3,4,5,6,0].map(i=>'<button data-w="'+i+'" class="'+(fWdays.includes(i)?'on':'')+'">'+WD[i]+'</button>').join('');
}
function renderTagChips(){
  const cur=new Set(parseTags($('fTags').value));
  $('fTagChips').innerHTML=allTags().map(g=>'<button data-g="'+esc(g)+'" class="'+(cur.has(g)?'on':'')+'">#'+esc(g)+'</button>').join('');
}
function openEdit(id){
  const t=id?S.tasks[id]:null; S.editing=id||null;
  $('editTitle').textContent=t?'タスクを編集':'タスクを追加';
  $('fTitle').value=t?t.title:'';
  $('fDate').value=t&&t.date?t.date:'';
  $('fTime').value=t&&t.time?t.time:'';
  fDur=t&&t.dur?Number(t.dur):null; renderDur();
  $('fMemo').value=t&&t.memo?t.memo:'';
  $('fTags').value=t&&t.tags?t.tags.join(' '):(S.tag&&!t?S.tag:'');
  fRepType=t&&t.repeat?t.repeat.type:''; fWdays=t&&t.repeat&&t.repeat.days?t.repeat.days.slice():[];
  $('fDel').style.display=t?'':'none';
  syncQuick(); renderRep(); renderTagChips(); openOv('editOv'); growTitle();
  // focus synchronously inside the tap so iOS shows the keyboard right away
  if(!t){try{$('fTitle').focus({preventScroll:true});}catch(_){$('fTitle').focus();}}
}
$('fab').onclick=()=>openEdit(null);
$('fQuick').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return; const td=today();
  const q=b.dataset.q; $('fDate').value=q==='later'?'':q==='today'?td:q==='tomorrow'?addDays(td,1):S.sel;
  if(q==='later'){$('fTime').value='';renderDur();if(fRepType){fRepType='';renderRep();}}
  syncQuick();
});
$('fDate').addEventListener('change',syncQuick);
$('fRep').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return; fRepType=b.dataset.r;
  if(fRepType&&!$('fDate').value){$('fDate').value=today();syncQuick();}
  if(fRepType==='weekly'&&!fWdays.length) fWdays=[parse($('fDate').value).getDay()];
  renderRep();
});
$('fWd').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return; const i=Number(b.dataset.w);
  fWdays=fWdays.includes(i)?fWdays.filter(x=>x!==i):fWdays.concat(i); renderRep();
});
$('fTags').addEventListener('input',renderTagChips);
$('fTagChips').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return; const g=b.dataset.g; const cur=parseTags($('fTags').value);
  $('fTags').value=(cur.includes(g)?cur.filter(x=>x!==g):cur.concat(g)).join(' '); renderTagChips();
});
$('fSave').onclick=()=>{
  const title=$('fTitle').value.trim(); if(!title){$('fTitle').focus();return;}
  const now=new Date().toISOString(), old=S.editing?S.tasks[S.editing]:null;
  const t=old?plain(old):{id:newId(),status:'open',createdAt:now};
  t.title=title; t.memo=$('fMemo').value.trim()||null;
  let date=$('fDate').value||null; t.time=$('fTime').value||null;
  if(t.time&&!date) date=S.sel;
  t.dur=fDur||null;
  t.tags=parseTags($('fTags').value);
  if(fRepType){
    if(!date) date=today();
    const r={type:fRepType};
    if(fRepType==='weekly') r.days=(fWdays.length?fWdays:[parse(date).getDay()]).slice().sort();
    if(fRepType==='monthly') r.dom=parse(date).getDate();
    t.repeat=r;
    if(fRepType==='weekly'&&!occursOn(t,date)) date=nextOcc(t,date);
  }else t.repeat=null;
  if(date&&t.date!==date) delete t.rolledFrom;
  if(t.date!==date&&!(t.repeat&&t.repeat.type)) delete t.dayOrder;
  if(!date&&(!old||old.date)) t.order=minOrder()-1;
  t.date=date;
  persist(t); closeOv('editOv');
  if(date&&date<today()) rollover();
  render();
};
function growTitle(){const el=$('fTitle');el.style.height='auto';el.style.height=el.scrollHeight+2+'px';}
$('fTitle').addEventListener('input',()=>{const el=$('fTitle');if(/\n/.test(el.value))el.value=el.value.replace(/\n+/g,' ');growTitle();});
$('fSaveQuick').onclick=()=>$('fSave').click();
$('fTitle').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();$('fSave').click();}});
$('fDel').onclick=()=>{if(S.editing){softDelete(S.editing);closeOv('editOv');}};

/* ---------- long-press & drag to reorder (inbox / 時間指定なし) ---------- */
(function(){
  const root=$('inbox'); let drag=null, suppressClick=false;
  const HOLD_TOUCH=280, SLOP=8, MOUSE_START=4;
  function activate(){
    if(!drag||drag.active) return;
    const c=drag.card;
    if(Math.abs(root.scrollTop-drag.st)>2||Math.abs(c.getBoundingClientRect().top-drag.top0)>2){cancel();return;}
    drag.active=true; drag.ay=drag.lastY; c.classList.remove('pressing'); c.classList.add('dragging');
    const r=c.getBoundingClientRect(); drag.grabOff=drag.y-r.top; drag.ty=0;
    try{c.setPointerCapture(drag.pid);}catch(_){}
    try{navigator.vibrate&&navigator.vibrate(10);}catch(_){}
    follow();
  }
  function follow(){ // dragged card tracks the pointer
    const c=drag.card, natural=c.getBoundingClientRect().top-drag.ty;
    drag.ty=drag.lastY-drag.grabOff-natural;
    c.style.transform='translateY('+drag.ty+'px) scale(1.02)';
  }
  function animY(el){try{const t=getComputedStyle(el).transform;return t&&t!=='none'?new DOMMatrixReadOnly(t).m42:0;}catch(_){return 0;}}
  function flipMove(fn){ // animate the other cards into their new places
    const others=[...drag.list.querySelectorAll('.card:not(.dragging)')];
    const first=new Map(others.map(el=>[el,el.getBoundingClientRect().top]));
    fn();
    others.forEach(el=>{
      const dy=first.get(el)-el.getBoundingClientRect().top; if(!dy) return;
      el.style.transition='none'; el.style.transform='translateY('+dy+'px)';
      requestAnimationFrame(()=>{el.style.transition='transform .18s ease';el.style.transform='';});
    });
  }
  root.addEventListener('pointerdown',e=>{
    if(e.button>0||drag) return;
    const card=e.target.closest('.sortable .card:not(.virtual)'); if(!card) return;
    if(e.target.closest('.chk,a,button,.mfull')) return;
    const mouse=e.pointerType==='mouse';
    if(mouse) e.preventDefault();
    S.dragBusy=true;
    drag={card,list:card.closest('.sortable'),pid:e.pointerId,x:e.clientX,y:e.clientY,lastY:e.clientY,active:false,moved:false,mouse,st:root.scrollTop,top0:card.getBoundingClientRect().top};
    if(!mouse){card.classList.add('pressing');drag.timer=setTimeout(activate,HOLD_TOUCH);}
  });
  root.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pid) return;
    drag.lastY=e.clientY;
    const dist=Math.hypot(e.clientX-drag.x,e.clientY-drag.y);
    if(!drag.active){
      if(drag.mouse){ if(dist>MOUSE_START) activate(); else return; }
      else { if(dist>SLOP) cancel(); return; }
    }
    e.preventDefault();
    if(!drag.moved&&Math.abs(e.clientY-drag.ay)<10){follow();return;}
    drag.moved=true;
    const r=root.getBoundingClientRect(), dy=e.clientY-drag.ay;
    if(e.clientY<r.top+30&&dy<0) root.scrollTop-=6; else if(e.clientY>r.bottom-40&&dy>0) root.scrollTop+=6;
    const list=drag.list, cards=[...list.querySelectorAll('.card:not(.dragging):not(.virtual)')];
    // compare against where cards really sit (ignore their in-flight slide animation)
    let before=null;
    const dh=drag.card.offsetHeight, cy=e.clientY-drag.grabOff+dh/2;   // center of the card being dragged
    for(const c of cards){const b=c.getBoundingClientRect(), top=b.top-animY(c);if(cy<top+b.height/2){before=c;break;}}
    if(before){if(drag.card.nextSibling!==before) flipMove(()=>list.insertBefore(drag.card,before));}
    else{const last=cards[cards.length-1];if(last&&last.nextSibling!==drag.card) flipMove(()=>last.after(drag.card));}
    follow();
  });
  document.addEventListener('touchmove',e=>{if(drag&&drag.active)e.preventDefault();},{passive:false});
  root.addEventListener('scroll',()=>{if(drag&&!drag.active&&Math.abs(root.scrollTop-drag.st)>2)cancel();},{passive:true});
  document.addEventListener('contextmenu',e=>{if(e.target.closest&&e.target.closest('.sortable .card'))e.preventDefault();});
  function release(){S.dragBusy=false;if(S.renderPending)render();}
  function cancel(){ if(!drag) return; clearTimeout(drag.timer); drag.card.classList.remove('pressing','dragging'); drag.card.style.transform=''; drag=null; release(); }
  function end(e){
    if(!drag||(e&&e.pointerId!==drag.pid)) return;
    clearTimeout(drag.timer);
    const d=drag; drag=null;
    d.card.classList.remove('pressing');
    if(!d.active){release();return;}
    suppressClick=true; setTimeout(()=>suppressClick=false,300);
    // settle into place, then save & redraw
    d.card.style.transition='transform .15s ease'; d.card.style.transform='';
    setTimeout(()=>{
      d.card.classList.remove('dragging'); d.card.style.transition='';
      if(d.moved){
        const ids=[...d.list.querySelectorAll('.card:not(.virtual)')].map(c=>c.dataset.id);
        if(d.list.id==='ilist'){
          const full=Object.values(S.tasks).filter(t=>t.status==='open'&&!t.date).sort((a,b)=>(a.order||0)-(b.order||0));
          const slots=full.map(t=>ids.includes(t.id)?null:t.id); let k=0;
          const merged=slots.map(x=>x===null?ids[k++]:x);
          merged.forEach((id,i)=>{const t=S.tasks[id];if(t&&t.order!==i){const u=plain(t);u.order=i;persist(u);}});
        }else{
          ids.forEach((id,i)=>{const t=S.tasks[id];if(t&&t.dayOrder!==i){const u=plain(t);u.dayOrder=i;persist(u);}});
        }
      }
      S.dragBusy=false; render();
    },160);
  }
  root.addEventListener('pointerup',end);
  root.addEventListener('pointercancel',e=>{if(drag&&drag.active)end(e);else cancel();});
  root.addEventListener('click',e=>{if(suppressClick){suppressClick=false;e.stopPropagation();e.preventDefault();}},true);
})();

/* ---------- calendar ---------- */
function renderCal(){
  const [y,m]=S.calMonth; $('calTitle').textContent=y+'年'+(m+1)+'月';
  const first=new Date(y,m,1), off=(first.getDay()+6)%7, td=today();
  let h=['月','火','水','木','金','土','日'].map(x=>'<div class="w">'+x+'</div>').join('');
  for(let i=0;i<42;i++){const d=new Date(y,m,1-off+i), s=ymd(d);
    const hc=holidayName(s)||d.getDay()===0?'hsun ':d.getDay()===6?'hsat ':'';
    h+='<button data-d="'+s+'"'+(holidayName(s)?' title="'+esc(holidayName(s))+'"':'')+' class="'+hc+(d.getMonth()!==m?'out ':'')+(s===S.sel?'sel ':'')+(s===td?'td':'')+'">'+d.getDate()+'<i class="'+(hasOn(s)?'on':'')+'"></i></button>';}
  $('calGrid').innerHTML=h;
}
$('calBtn').onclick=()=>{const d=parse(S.sel);S.calMonth=[d.getFullYear(),d.getMonth()];renderCal();openOv('calOv');};
$('calPrev').onclick=()=>{let [y,m]=S.calMonth;m--;if(m<0){m=11;y--;}S.calMonth=[y,m];renderCal();};
$('calNext').onclick=()=>{let [y,m]=S.calMonth;m++;if(m>11){m=0;y++;}S.calMonth=[y,m];renderCal();};
$('calGrid').addEventListener('click',e=>{const b=e.target.closest('button[data-d]');if(!b)return;S.sel=b.dataset.d;closeOv('calOv');render();});

/* ---------- menu / theme ---------- */
function applyTheme(){
  let t='auto'; try{t=localStorage.getItem(LS_THEME)||'auto';}catch(e){}
  const dark=t==='dark'||(t==='auto'&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme=dark?'dark':'light';
  $('themeSeg').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
}
$('themeSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;try{localStorage.setItem(LS_THEME,b.dataset.t);}catch(_){}applyTheme();});
if(window.matchMedia) try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);}catch(e){}
$('menuBtn').onclick=()=>{renderBk();openOv('menuOv');};

/* ---------- history ---------- */
function renderHist(){
  $('histSeg').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.h===S.histMode));
  const items=Object.values(S.tasks).filter(t=>t.status===S.histMode).sort((a,b)=>String(b.doneAt).localeCompare(String(a.doneAt)));
  if(!items.length){$('histList').innerHTML='<div class="empty">まだありません</div>';return;}
  let h='',last='';
  items.slice(0,300).forEach(t=>{
    const day=t.doneAt?ymd(new Date(t.doneAt)):'';
    if(day!==last){h+='<div class="hist-day">'+(day?fmtMD(day)+(S.histMode==='done'?' に完了':' に削除'):'日付不明')+'</div>';last=day;}
    let meta=(t.date?'<span>'+esc(fmtMD(t.date))+(t.time?' '+esc(t.time):'')+'</span>':'<span>あとでやる</span>')+tagsHtml(t);
    h+='<div class="card" data-id="'+esc(t.id)+'"><div class="bd"><div class="tt dn">'+esc(t.title)+'</div><div class="mt">'+meta+'</div></div>'+
      '<button class="mini" data-act="restore">戻す</button>'+(S.histMode==='deleted'?'<button class="mini dng" data-act="purge">完全に削除</button>':'')+'</div>';
  });
  $('histList').innerHTML=h;
}
$('mHist').onclick=()=>{closeOv('menuOv');renderHist();openOv('histOv');};
$('histSeg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.histMode=b.dataset.h;renderHist();});
$('histList').addEventListener('click',e=>{
  const b=e.target.closest('button[data-act]'); if(!b) return;
  const id=b.closest('.card').dataset.id, t=S.tasks[id]; if(!t) return;
  if(b.dataset.act==='restore'){
    const u=plain(t); u.status='open'; delete u.doneAt;
    if(!u.date) u.order=minOrder()-1;
    persist(u); rollover(); toast('元に戻しました'); renderHist(); render();
  }else if(b.dataset.act==='purge'){
    if(b.dataset.armed){hardDelete(id);renderHist();}
    else{b.dataset.armed='1';b.textContent='もう一度押すと削除';setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent='完全に削除';}},3000);}
  }
});

/* ---------- upcoming ---------- */
function renderUpcoming(){
  const td=today();
  const items=Object.values(S.tasks).filter(t=>t.status==='open'&&t.date&&t.date>td)
    .sort((a,b)=>a.date.localeCompare(b.date)||((a.time?0:1)-(b.time?0:1))||String(a.time||'').localeCompare(String(b.time||''))||((a.dayOrder??1e9)-(b.dayOrder??1e9)));
  if(!items.length){$('upList').innerHTML='<div class="empty">明日以降の予定はありません</div>';return;}
  let h='',last='';
  items.forEach(t=>{
    if(t.date!==last){
      const d=parse(t.date),w=d.getDay(),hn=holidayName(t.date);
      const cls=(w===0||hn)?' sun':w===6?' sat':'';
      h+='<div class="up-day'+cls+'" data-d="'+esc(t.date)+'">'+(d.getMonth()+1)+'/'+d.getDate()+'（'+WD[w]+'）'+(hn?'<span>'+esc(hn)+'</span>':'')+'</div>';
      last=t.date;
    }
    let meta='';
    if(t.time) meta+='<span class="tm">'+esc(t.time)+(t.dur?'〜'+esc(endTime(t.time,t.dur)):'')+'</span>';
    else if(t.dur) meta+='<span>'+durLabel(t.dur)+'</span>';
    if(t.repeat&&t.repeat.type) meta+='<span style="display:inline-flex;width:13px">'+ICON.repeat+'</span>';
    meta+=tagsHtml(t);
    h+='<div class="card up-item" data-d="'+esc(t.date)+'"><div class="bd"><div class="tt">'+esc(t.title)+'</div>'+(meta?'<div class="mt">'+meta+'</div>':'')+'</div></div>';
  });
  $('upList').innerHTML=h;
}
$('mUp').onclick=()=>{closeOv('menuOv');renderUpcoming();openOv('upOv');};
$('upList').addEventListener('click',e=>{const el=e.target.closest('[data-d]');if(!el)return;S.sel=el.dataset.d;S.inboxFull=false;closeOv('upOv');render();try{$('inbox').scrollTop=0;}catch(_){}});

/* ---------- tag management ---------- */
function tagStats(){
  const m={};
  Object.values(S.tasks).forEach(t=>(t.tags||[]).forEach(g=>{m[g]=m[g]||{open:0,all:0};m[g].all++;if(t.status==='open')m[g].open++;}));
  return m;
}
function renderTagMgr(editing){
  const st=tagStats(), names=Object.keys(st).sort();
  if(!names.length){$('tagList').innerHTML='<div class="empty">タグはまだありません</div>';return;}
  $('tagList').innerHTML=names.map(g=>editing===g
    ?'<div class="trow" data-g="'+esc(g)+'"><input class="inp" value="'+esc(g)+'" data-role="nm"><button class="mini" data-act="ok">保存</button><button class="mini" data-act="cancel" style="color:var(--sub)">やめる</button></div>'
    :'<div class="trow" data-g="'+esc(g)+'"><div class="nm">#'+esc(g)+'<small>'+st[g].open+'件'+(st[g].all>st[g].open?'（履歴含め'+st[g].all+'件）':'')+'</small></div><button class="mini" data-act="edit">名前を変更</button><button class="mini dng" data-act="del">削除</button></div>'
  ).join('');
  const inp=$('tagList').querySelector('input[data-role="nm"]'); if(inp){inp.focus();inp.select();}
}
function changeTag(from,to){
  let n=0;
  Object.values(S.tasks).forEach(t=>{
    if(!(t.tags||[]).includes(from)) return;
    const u=plain(t); let tags=u.tags.filter(x=>x!==from);
    if(to&&!tags.includes(to)) tags.push(to);
    u.tags=tags; persist(u); n++;
  });
  if(S.tag===from) S.tag=to||null;
  return n;
}
$('mTags').onclick=()=>{closeOv('menuOv');renderTagMgr();openOv('tagOv');};
$('tagList').addEventListener('click',e=>{
  const b=e.target.closest('button[data-act]'); if(!b) return;
  const row=b.closest('.trow'), g=row.dataset.g, act=b.dataset.act;
  if(act==='edit') renderTagMgr(g);
  else if(act==='cancel') renderTagMgr();
  else if(act==='ok'){
    const v=parseTags(row.querySelector('input').value)[0];
    if(v&&v!==g){const n=changeTag(g,v);toast('#'+g+' → #'+v+'（'+n+'件）');render();}
    renderTagMgr();
  }else if(act==='del'){
    if(b.dataset.armed){const n=changeTag(g,null);toast('#'+g+' を削除しました（'+n+'件から外しました）');render();renderTagMgr();}
    else{b.dataset.armed='1';b.textContent='もう一度押すと削除';setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent='削除';}},3000);}
  }
});
$('tagList').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target.matches('input[data-role="nm"]')){e.preventDefault();e.target.closest('.trow').querySelector('[data-act="ok"]').click();}
  if(e.key==='Escape') renderTagMgr();
});

/* ---------- 控え置き場（GAS）への自動バックアップ ----------
   この端末が正本。変更があったら少し待ってから、全データを丸ごとGASへ送る。
   GAS側は「最新」と「日ごと」の控えを残す。送れなかったときは電波が戻ってから送り直す。 */
const LS_BK='tasknote.backup', LS_BEFORE='tasknote.beforeRestore';
function bkCfg(){try{return JSON.parse(localStorage.getItem(LS_BK)||'{}')||{};}catch(_){return{};}}
function bkPut(patch){const c=Object.assign(bkCfg(),patch);try{localStorage.setItem(LS_BK,JSON.stringify(c));}catch(_){}return c;}
let bkTimer=null,bkBusy=false;
function backupDirty(){const c=bkCfg();bkPut({dirty:true,seq:(c.seq||0)+1});scheduleBackup(15000);}
function scheduleBackup(ms){clearTimeout(bkTimer);bkTimer=setTimeout(()=>sendBackup(false),ms);}
async function gas(action,extra){
  const c=bkCfg(); if(!c.url||!c.key) throw new Error('控え置き場が設定されていません');
  const ctrl=new AbortController(), to=setTimeout(()=>ctrl.abort(),25000);
  try{
    const r=await fetch(c.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify(Object.assign({key:c.key,action},extra||{})),signal:ctrl.signal,redirect:'follow',cache:'no-store'});
    let j; try{j=await r.json();}catch(_){throw new Error('応答を読み取れません（URLを確認してください）');}
    if(!j||!j.ok) throw new Error(j&&j.error==='auth'?'合言葉が違います':(j&&j.error)||'エラー');
    return j;
  }catch(e){ if(e.name==='AbortError') throw new Error('時間切れ（電波を確認してください）'); throw e; }
  finally{clearTimeout(to);}
}
async function sendBackup(manual){
  const c=bkCfg();
  if(!c.url||!c.key){if(manual)toast('先に「設定」で控え置き場を登録してください');renderBk();return;}
  if(!manual&&!c.dirty) return;
  if(!navigator.onLine){if(manual)toast('オフラインです。電波が戻ったら自動で送ります');return;}
  if(bkBusy){scheduleBackup(5000);return;}
  bkBusy=true; const seq=c.seq||0; renderBk('送信中…');
  try{
    const j=await gas('backup',{data:exportObj()});
    const now=bkCfg(); bkPut({last:j.savedAt||new Date().toISOString(),lastCount:j.count,err:null,dirty:(now.seq||0)!==seq});
    if(manual) toast('控えを送りました（'+j.count+'件）');
  }catch(e){
    bkPut({err:e.message,errAt:new Date().toISOString()});
    if(manual) toast('送れませんでした：'+e.message); else scheduleBackup(120000);
  }finally{bkBusy=false;renderBk();if(bkCfg().dirty&&!bkCfg().err)scheduleBackup(15000);}
}
function fmtDT(iso){if(!iso)return '';const d=new Date(iso);return (d.getMonth()+1)+'/'+d.getDate()+' '+pad(d.getHours())+':'+pad(d.getMinutes());}
function renderBk(msg){
  const c=bkCfg(), el=$('bkStatus'); if(!el) return;
  if(msg){el.textContent=msg;return;}
  if(!c.url||!c.key){el.textContent='未設定です。「設定」からGASのURLと合言葉を登録してください。';return;}
  let t=c.last?'最後に送った控え：'+fmtDT(c.last)+(c.lastCount!=null?'（'+c.lastCount+'件）':''):'まだ控えを送っていません。';
  if(c.dirty) t+='　未送信の変更あり';
  if(c.err) t+='　前回の送信失敗：'+c.err;
  el.textContent=t;
}
$('bkSend').onclick=()=>sendBackup(true);
$('bkSetBtn').onclick=()=>{const c=bkCfg();$('bkUrl').value=c.url||'';$('bkKey').value=c.key||'';$('bkSet').style.display=$('bkSet').style.display==='none'?'block':'none';};
$('bkSave').onclick=async()=>{
  const url=$('bkUrl').value.trim(), key=$('bkKey').value.trim();
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)){toast('URLの形が違います（…/exec で終わるURL）');return;}
  if(key.length<20){toast('合言葉が短すぎます');return;}
  bkPut({url,key,err:null}); renderBk('接続テスト中…');
  try{await gas('ping');toast('接続できました');bkPut({dirty:true});$('bkSet').style.display='none';sendBackup(false);}
  catch(e){toast('接続できません：'+e.message);bkPut({err:e.message});}
  renderBk();
};
$('bkClear').onclick=()=>{const b=$('bkClear');if(!b.dataset.armed){b.dataset.armed='1';b.textContent='もう一度押すと消します';setTimeout(()=>{delete b.dataset.armed;b.textContent='設定を消す';},3000);return;}
  try{localStorage.removeItem(LS_BK);}catch(_){} $('bkUrl').value='';$('bkKey').value='';renderBk();toast('設定を消しました');};
window.addEventListener('online',()=>scheduleBackup(2000));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&bkCfg().dirty)sendBackup(false);});
// 復元
async function openRestore(){
  closeOv('menuOv'); openOv('rsOv'); $('rsList').innerHTML='<div class="empty">読み込み中…</div>'; renderUndo();
  try{
    const j=await gas('list');
    if(!j.items.length){$('rsList').innerHTML='<div class="empty">控えはまだありません</div>';return;}
    $('rsList').innerHTML=j.items.map(it=>'<div class="trow" data-name="'+esc(it.name)+'"><div class="nm">'+esc(it.label)+'<small>'+esc(fmtDT(it.updated))+'・'+(Number(it.count)||0)+'件</small></div><button class="mini" data-act="rs">この状態に戻す</button></div>').join('');
  }catch(e){$('rsList').innerHTML='<div class="empty">読み込めませんでした：'+esc(e.message)+'</div>';}
}
function replaceAll(tasks){
  S.tasks={}; tasks.forEach(t=>{if(t&&typeof t.id==='string'&&typeof t.title==='string'){S.tasks[t.id]=cleanTask(t);}});
  S.tag=null;S.expanded=null;cacheLocal();backupDirty();rollover();render();
}
function renderUndo(){
  let has=false;try{has=!!localStorage.getItem(LS_BEFORE);}catch(_){}
  $('rsUndo').innerHTML=has?'<button class="btn" id="rsUndoBtn" style="width:100%">直前の復元を取り消す（復元する前の状態に戻す）</button>':'';
  const b=$('rsUndoBtn'); if(b) b.onclick=()=>{try{const a=JSON.parse(localStorage.getItem(LS_BEFORE));localStorage.removeItem(LS_BEFORE);replaceAll(a);toast('復元する前の状態に戻しました');closeOv('rsOv');}catch(_){toast('戻せませんでした');}};
}
$('bkRestore').onclick=openRestore;
$('rsList').addEventListener('click',async e=>{
  const b=e.target.closest('button[data-act="rs"]'); if(!b) return;
  if(!b.dataset.armed){b.dataset.armed='1';b.textContent='もう一度押すと置き換えます';setTimeout(()=>{if(b.isConnected){delete b.dataset.armed;b.textContent='この状態に戻す';}},3000);return;}
  const name=b.closest('.trow').dataset.name; b.textContent='読み込み中…';
  try{
    const j=await gas('get',{name}); const arr=j.data&&Array.isArray(j.data.tasks)?j.data.tasks:null;
    if(!arr) throw new Error('控えの中身が読めません');
    try{localStorage.setItem(LS_BEFORE,JSON.stringify(Object.values(S.tasks)));}catch(_){}
    replaceAll(arr); closeOv('rsOv'); toast('控えから戻しました（'+arr.length+'件）');
  }catch(err){toast('戻せませんでした：'+err.message);b.textContent='この状態に戻す';delete b.dataset.armed;}
});

/* ---------- wipe all ---------- */
$('wipeBtn').onclick=()=>{
  const b=$('wipeBtn');
  if(!b.dataset.armed){b.dataset.armed='1';b.textContent='本当に消す場合はもう一度押してください';b.style.background='#C06A6A';b.style.color='#fff';
    setTimeout(()=>{if(b.dataset.armed){delete b.dataset.armed;b.textContent='すべて削除する';b.style.background='';b.style.color='';}},4000);return;}
  delete b.dataset.armed; b.textContent='すべて削除する'; b.style.background=''; b.style.color='';
  const ids=Object.keys(S.tasks); ids.forEach(hardDelete);
  S.tag=null; S.expanded=null; closeOv('menuOv'); render(); toast(ids.length+'件のデータを削除しました');
};

/* ---------- export / import ---------- */
const FIELDS=['id','title','memo','status','date','time','dur','tags','repeat','order','dayOrder','rolledFrom','createdAt','updatedAt','doneAt','repeatOf'];
function exportObj(){return {app:'tasknote',version:1,exportedAt:new Date().toISOString(),tasks:Object.values(S.tasks).map(plain)};}
function toCsv(){
  const cell=v=>{if(v==null)return '';if(Array.isArray(v))v=v.join(' ');else if(typeof v==='object')v=JSON.stringify(v);v=String(v);return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
  return '﻿'+FIELDS.join(',')+'\r\n'+Object.values(S.tasks).map(t=>FIELDS.map(f=>cell(t[f])).join(',')).join('\r\n');
}
async function saveFile(name,data,mime){
  const file=new File([data],name,{type:mime});
  try{
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return;}
  }catch(e){if(e&&e.name==='AbortError')return;}
  try{
    const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),10000);
  }catch(e){toast('保存できませんでした。「JSONをコピー」を使ってください');}
}
const stamp=()=>today().replace(/-/g,'');
$('expJson').onclick=()=>saveFile('tasks-'+stamp()+'.json',JSON.stringify(exportObj(),null,2),'application/json');
$('expCsv').onclick=()=>saveFile('tasks-'+stamp()+'.csv',toCsv(),'text/csv');
$('cpJson').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(exportObj()));toast('コピーしました');}catch(e){$('impText').value=JSON.stringify(exportObj());$('impText').select();toast('コピーできなかったので下の欄に表示しました');}};
function importText(txt){
  let arr; try{const o=JSON.parse(txt);arr=Array.isArray(o)?o:o.tasks;}catch(e){toast('JSONを読み取れませんでした');return;}
  if(!Array.isArray(arr)){toast('タスクが見つかりませんでした');return;}
  let n=0; arr.forEach(t=>{if(t&&typeof t.id==='string'&&/^[A-Za-z0-9_\-.~:@+]{1,120}$/.test(t.id)&&typeof t.title==='string'){
    const u={}; FIELDS.forEach(f=>{if(t[f]!==undefined)u[f]=t[f];}); persist(cleanTask(u)); n++;}});
  rollover(); render(); toast(n+'件読み込みました');
}
$('impBtn').onclick=()=>{const v=$('impText').value.trim();if(v){importText(v);$('impText').value='';}};
$('impFile').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;f.text().then(importText);e.target.value='';});

/* ---------- day change ---------- */
setInterval(()=>{const td=today();if(td!==S.today){const wasToday=S.sel===S.today;rollover();if(wasToday)S.sel=td;render();}},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){const td=today();if(td!==S.today){const w=S.sel===S.today;rollover();if(w)S.sel=td;render();}}});

/* ---------- boot ---------- */
applyTheme();
// ホーム画面に追加したアプリとして開いたときだけ使える（ブラウザのタブでは別データになるため、うっかり入力を防ぐ）
const STANDALONE=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
if(!STANDALONE){
  const iOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  $('gateMsg').innerHTML=iOS
    ? 'ここ（Safariのタブ）では使えません。<br><b>ホーム画面のTaskNoteのアイコン</b>から開いてください。<br><br>まだ追加していない場合は、共有ボタン →「ホーム画面に追加」（「Webアプリとして開く」はオン）で追加できます。'
    : 'このブラウザでは使えません。TaskNoteはiPhoneのホーム画面から使うアプリです。<br><br>PCで中身を確認するときは、<b>GASの確認ページ</b>（控え置き場のURL）を開いてください。';
  $('gate').style.display='flex'; document.querySelector('.app').style.display='none'; $('fab').style.display='none';
}else{
loadLocal(); render(); setStoreMode(); rollover(); render(); renderBk();
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist();}catch(_){}
if(bkCfg().dirty) scheduleBackup(3000);
}
if('serviceWorker' in navigator){
  // 裏で新しい版を受け取ったら知らせる（index.html の差し替え・sw.js の更新のどちらでも）
  const updated=()=>showNote('新しい版を受け取りました。',{label:'今すぐ反映',onClick:()=>location.reload()});
  navigator.serviceWorker.addEventListener('message',e=>{if(e.data&&e.data.type==='tasknote-updated')updated();});
  const askUpdated=()=>{if(!navigator.serviceWorker.controller)return;fetch('__updated',{cache:'no-store'}).then(r=>r.text()).then(t=>{if(t==='1')updated();}).catch(()=>{});};
  setTimeout(askUpdated,2500);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(askUpdated,2500);});
  navigator.serviceWorker.register('sw.js').then(reg=>{
    reg.addEventListener('updatefound',()=>{const w=reg.installing;if(!w)return;
      w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)updated();});});
  }).catch(()=>{});
}
})();
