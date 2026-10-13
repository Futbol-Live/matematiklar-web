// Supabase integratsiyasi
const SUPABASE_URL = 'https://pvtzqqhnrbfqirplblgc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KRghPA6HgJ0grW5NW7lj5w_Jvf-ksoX';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;
let isEditingName = false;
let isEditingPassword = false;

// Telegram xabarlari server tomonda (Supabase trigger) yuboriladi. Kodda token saqlanmaydi.

async function holatniTekshirish() {
  let session = null, netErr = false;
  if (navigator.onLine) {
    try {
      const r = await db.auth.getSession();
      session = r.data && r.data.session;
      if (!session && r.error && /fetch|network|timeout/i.test(r.error.message || "")) netErr = true;
    } catch (e) { netErr = true; }
  }
  if (!session && (!navigator.onLine || netErr)) {
    const ou = offlineUser();
    if (ou) session = { user: ou };
  }
  if (session) {
    currentUser = session.user;
    document.getElementById('login-overlay').style.display = 'none';
    
    const { data, error: pe } = await db.from('profiles').select('full_name').eq('id', currentUser.id).single();
    if (data && data.full_name) {
      NAME = data.full_name;
    } else {
      NAME = (currentUser.email || "").split('@')[0];
      /* Ismi hali saqlanmagan o'quvchi reytingda "O'quvchi" bo'lib qolmasin: login nomi bazaga yoziladi */
      if (navigator.onLine && ((pe && pe.code === "PGRST116") || (!pe && data && !data.full_name))) {
        try { db.from('profiles').upsert({ id: currentUser.id, full_name: NAME }).then(() => {}, () => {}); } catch (e) {}
      }
    }
    try {
      if (data && data.full_name) localStorage.setItem("gm_nm_" + currentUser.id, NAME);
      else { const c = localStorage.getItem("gm_nm_" + currentUser.id); if (c) NAME = c; }
    } catch (e) {}
    
    loadAvLocal();
    try{const ra=await db.from('profiles').select('avatar').eq('id',currentUser.id).single();if(!ra.error&&ra.data&&ra.data.avatar!=null&&ra.data.avatar!==""&&+ra.data.avatar>=0&&+ra.data.avatar<AVS.length)AV=+ra.data.avatar}catch(e){}
    useUserR();
    render();
    startData();
    if(cur.c !== null && CH[cur.c].t[cur.t] && isTest(CH[cur.c].t[cur.t])) {
      reytingniYuklash(CH[cur.c].t[cur.t].id, 'reyting-panel');
    }
  } else {
    document.getElementById('login-overlay').style.display = 'flex';
  }
}

/* Login: o'quvchi faqat login yozadi (masalan: ali01). Ichkarida login@LOGIN_DOMEN ga aylantiriladi.
   Eski akkauntlar (pochta bilan, '@' bor) avvalgidek ishlaydi. */
const LOGIN_DOMEN = 'users.matematiklar.uz';
function loginToEmail(v) {
  v = String(v || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!v) return { err: 'Loginni kiriting.' };
  if (v.includes('@')) return { email: v };
  if (!/^[a-z0-9._-]{3,30}$/.test(v)) return { err: 'Login faqat lotin harf va raqamdan iborat bo‘lsin (3–30 belgi).' };
  return { email: v + '@' + LOGIN_DOMEN };
}
async function tizimgaKirish() {
  const errEl = document.getElementById('login-err'), btn = document.querySelector('#login-overlay .btn');
  const showErr = m => { errEl.textContent = m; errEl.style.display = 'block'; };
  const r = loginToEmail(document.getElementById('email-input').value);
  const password = document.getElementById('password-input').value;
  if (r.err) { showErr(r.err); return; }
  if (!password) { showErr('Parolni kiriting.'); return; }
  if (!navigator.onLine) { showErr('Internet yo‘q. Kirish uchun internetga ulaning.'); return; }
  if (btn) btn.disabled = true;
  let error = null;
  try { const res = await db.auth.signInWithPassword({ email: r.email, password }); error = res.error; }
  catch (e) { error = e; }
  if (btn) btn.disabled = false;
  if (error) {
    showErr(/fetch|network|timeout/i.test(error.message || '') ? 'Aloqa xatosi. Birozdan so‘ng qayta urinib ko‘ring.' : 'Login yoki parol xato.');
  } else {
    errEl.style.display = 'none';
    holatniTekshirish();
  }
}

async function tizimdanChiqish() {
  await db.auth.signOut();
  currentUser = null;
  NAME = "";
  AV = null;
  RK.rows = []; RK.me = null; RK.loaded = false;
  RKEY = "gm_res_none"; R = {};
  rtT(false); rkT(false);
  flagsOff();
  holatniTekshirish();
}

async function reytingniYuklash(chapterId, containerId) {
  const el = document.getElementById(containerId);
  if(!el) return;
  el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--mut);">Reyting yuklanmoqda...</div>';

  const { data, error } = await db.from('test_results')
    .select('*, profiles(full_name)')
    .eq('chapter', chapterId)
    .order('created_at', { ascending: true });

  if (error) {
    el.innerHTML = '<div class="soonbox">Reytingni yuklashda xatolik yuz berdi.</div>';
    return;
  }

  const birinchiUrinishlar = {};
  data.forEach(qator => {
    if (!birinchiUrinishlar[qator.user_id]) {
      birinchiUrinishlar[qator.user_id] = qator;
    }
  });

  let reyting = Object.values(birinchiUrinishlar);
  reyting.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.time_spent_sec - b.time_spent_sec;
  });

  let html = '<div class="pc" style="margin-top:24px; border:2px solid var(--line);"><h3>Top-5 Natijalar (Birinchi urinish)</h3><div style="display:grid;gap:8px;margin-top:14px;">';
  let meningOrnim = -1;
  let top5 = reyting.slice(0, 5);

  if (reyting.length === 0) {
    html += '<p style="color:var(--mut); font-size:13px;">Hali hech kim natija yubormagan.</p>';
  } else {
    top5.forEach((r, idx) => {
      if (currentUser && r.user_id === currentUser.id) meningOrnim = idx;
      let ism = r.profiles?.full_name || 'Noma\'lum o\'quvchi';
      let bg = '#fff'; let avColor = 'var(--ink)';
      if(idx === 0) { bg = '#fef3c7'; avColor = '#d97706'; } 
      if(idx === 1) { bg = '#f1f5f9'; avColor = '#475569'; } 
      if(idx === 2) { bg = '#ffedd5'; avColor = '#c2410c'; } 

      html += `<div class="stc" style="background:${bg}; border:1px solid var(--line);">
        <div class="av" style="background:${avColor}; color:#fff;">${idx+1}</div>
        <div style="flex:1"><b>${esc(ism)}</b></div>
        <div style="text-align:right"><b>${r.score} ball</b><br><small style="color:var(--mut)">${Math.floor(r.time_spent_sec/60)} daq ${r.time_spent_sec%60} soniya</small></div>
      </div>`;
    });
  }

  if (currentUser && meningOrnim === -1) {
    const myRank = reyting.findIndex(r => r.user_id === currentUser.id);
    if (myRank > 4) {
      let myR = reyting[myRank];
      let ism = myR.profiles?.full_name || 'Noma\'lum o\'quvchi';
      html += `<div class="stc" style="margin-top:10px; border:2px dashed var(--ac); background:var(--soft);">
        <div class="av" style="background:var(--ac);">${myRank+1}</div>
        <div style="flex:1"><b>${esc(ism)} (Siz)</b></div>
        <div style="text-align:right"><b>${myR.score} ball</b><br><small style="color:var(--mut)">${Math.floor(myR.time_spent_sec/60)} daq ${myR.time_spent_sec%60} soniya</small></div>
      </div>`;
    }
  }

  html += '</div></div>';
  el.innerHTML = html;
}

const NAMES="Musbat va manfiy sonlar|Kasrlar|O‘nli kasrlar|Sonning darajasi|Harfli ifodalar|Birhadlar va ko‘phadlar|Ko‘paytuvchilarga ajratish|Qisqa ko‘paytirish formulalari|Algebraik kasrlar|Chiziqli tenglamalar|Chiziqli funksiyalar|Chiziqli tengsizliklar|Proporsiya|Foizlar|Modullar|Ildizlar|Sistemalar|Kvadrat tenglamalar|Kvadrat tengsizliklar|Progressiyalar|Ko‘rsatkichlar|Logarifm|Trigonometriya|Hosila|Integral".split("|");
const TOTAL=80; 
const CH=NAMES.map(n=>({n,t:[]}));
/* Kontent: boblar bo'yicha alohida JSON fayllar (data/...). Yangi bob qo'shish: shu ro'yxatga bitta qator. */
const CONTENT=[[0,"data/general-math/ch01.js"]];
const flat=[];
const qid=(t,s,i)=>t.id+".s"+s+".q"+(i+1);
function buildIndex(){
 CH.forEach(c=>c.t.forEach(t=>{if(t.rules&&!t.sets)t.sets=[{n:"O‘zlashtirish uchun mashqlar",prac:t.prac}]}));
 flat.length=0;CH.forEach((c,ci)=>c.t.forEach((t,ti)=>flat.push([ci,ti])));
}
function loadScript(u){return new Promise((ok,no)=>{const s=document.createElement("script");s.src=u;s.onload=ok;s.onerror=()=>no(new Error("Yuklanmadi: "+u));document.head.appendChild(s)})}
async function loadContent(){
 await Promise.all(CONTENT.map(([k,u])=>loadScript(u)));
 CONTENT.forEach(([k])=>{const j=(window.GM_DATA||{})[k];if(!j)throw new Error("Bo‘sh kontent: "+k);CH[k].t=j.topics||[]});
 buildIndex();
}
function contentFail(){
 document.body.insertAdjacentHTML("beforeend",'<div style="position:fixed;inset:0;z-index:300;background:#f6f7fd;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;font:600 15px Bricolage Grotesque,system-ui,sans-serif;color:#1b2340"><div>Mavzularni yuklab bo‘lmadi.<br><small style="font-weight:500;color:#6b7491">Internetga ulanib, sahifani qayta oching.</small></div><button class="btn" onclick="location.reload()">Qayta urinish</button></div>');
}
const M=s=>s.replace(/-/g,"−");
/* ===== Xavfsiz matematik ifoda tahlilchisi (eval ishlatilmaydi) ===== */
const bad=m=>{throw new Error(m||"x")};
function tokenize(s){
 s=String(s).toLowerCase().replace(/[−–—]/g,"-").replace(/[×·*]/g,"*").replace(/÷/g,":").replace(/\[/g,"(").replace(/\]/g,")").replace(/(\d),(\d)/g,"$1.$2");
 s=s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g,m=>"^"+[...m].map(c=>"⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)).join("")).trim();
 const T=[],re=/\s*(?:(\d+(?:\.\d+)?|\.\d+)|(sqrt|cbrt|pi|√|∛|π)|([()+\-*\/^:]))/y;let i=0;
 while(i<s.length){re.lastIndex=i;const m=re.exec(s);if(!m)bad();i=re.lastIndex;
  if(m[1]!==undefined)T.push({n:parseFloat(m[1])});else if(m[2])T.push({f:m[2]});else T.push({o:m[3]})}
 return T}
function evalMath(src){
 const T=tokenize(src);if(!T.length)bad();let p=0;
 const isO=o=>T[p]&&T[p].o===o;
 function expr(){let v=term();while(isO("+")||isO("-")){const o=T[p++].o,r=term();v=o=="+"?v+r:v-r}return v}
 function frac(){let v=unary();while(isO("/")){p++;const r=unary();if(r===0)bad("0");v/=r}return v}
 function term(){let v=frac();
  for(;;){
   if(isO("*")||isO(":")){const o=T[p++].o,r=frac();if(o==":"){if(r===0)bad("0");v/=r}else v*=r}
   else if(T[p]&&(T[p].f||isO("(")))v*=frac();
   else if(T[p]&&T[p].n!==undefined)bad("aralash");
   else break}
  return v}
 function unary(){if(isO("-")){p++;return -unary()}if(isO("+")){p++;return unary()}return power()}
 function power(){const b=atom();if(isO("^")){p++;return Math.pow(b,unary())}return b}
 function atom(){
  const t=T[p++];if(!t)bad();
  if(t.n!==undefined)return t.n;
  if(t.o==="("){const v=expr();if(!isO(")"))bad();p++;return v}
  if(t.f){const f=t.f;
   if(f==="pi"||f==="π")return Math.PI;
   let a;if(f==="sqrt"||f==="cbrt"){if(!isO("("))bad();a=atom()}else a=atom();
   if(f==="sqrt"||f==="√"){if(a<0)bad("ildiz");return Math.sqrt(a)}
   return Math.cbrt(a)}
  bad()}
 const v=expr();if(p!==T.length)bad();if(!isFinite(v))bad();return v}
const ans=q=>{try{return evalMath(q)}catch(e){return NaN}};
function ratOf(x){if(!isFinite(x))return null;if(Math.abs(x-Math.round(x))<1e-9)return[Math.round(x),1];for(let q=2;q<=1000;q++){const p=Math.round(x*q);if(Math.abs(x-p/q)<1e-9)return[p,q]}return null}
function fmtNum(x){
 if(!isFinite(x))return "—";const r=ratOf(x);
 if(!r)return "≈ "+x.toFixed(4).replace(".",",");
 if(r[1]==1)return String(r[0]===0?0:r[0]);
 const d=+x.toFixed(4);return r[0]+"/"+r[1]+(Math.abs(d-x)<1e-9?" = "+String(d).replace(".",","):"")}
function check(v,q){try{const a=evalMath(v),b=ans(q);if(!isFinite(a)||!isFinite(b))return false;return Math.abs(a-b)<=(ratOf(b)?1e-9:1e-3)*Math.max(1,Math.abs(b))}catch(e){return false}}
const QF=s=>M(s).replace(/(\d+)\s*\/\s*(\d+)/g,'<span class="fr"><span>$1</span><span>$2</span></span>').replace(/\^([-−]?\w+)/g,"<sup>$1</sup>");

const key=(t,s)=>s?t.id+"#"+s:t.id;
let RKEY="gm_res",R={};
function loadR(){try{R=JSON.parse(localStorage.getItem(RKEY)||"{}")}catch(e){R={}}}
loadR();
const save=()=>{try{localStorage.setItem(RKEY,JSON.stringify(R))}catch(e){}};
const ready=t=>!!(t.rules||t.sets);
const cols=st=>st.prac.length>8&&Math.max(...st.prac.map(q=>q.length))<=20?3:2;
const cnt=(t,s)=>(R[key(t,s)]||[]).filter(v=>v==1).length;
const done=t=>ready(t)&&t.sets.every((st,s)=>cnt(t,s)==st.prac.length);

/* ===== Reyting: darsdagi mashqlar va bob testi ko‘rsatkichlari ===== */
const isTest=t=>t.type==='test'||t.t.includes('O‘zlashtirish mashqi');
let RK={rows:[],me:null,loaded:false,noPractice:false,sort:"test"};
/* Natijalar har bir foydalanuvchi uchun alohida saqlanadi (bir qurilmada bir nechta o‘quvchi aralashmasligi uchun) */
function useUserR(){
 const k="gm_res_"+currentUser.id;
 try{if(localStorage.getItem(k)===null){const old=localStorage.getItem("gm_res");if(old){localStorage.setItem(k,old);localStorage.removeItem("gm_res")}}}catch(e){}
 RKEY=k;loadR();
}
function lessonStats(){
 let ok=0,wr=0,fin=0;
 CH.forEach(c=>c.t.forEach(t=>{if(!t.sets||isTest(t))return;t.sets.forEach((st,s)=>{const a=R[key(t,s)];if(!Array.isArray(a))return;a.forEach(v=>{if(v==1)ok++;else if(v==2)wr++});if(a.length&&a.every(v=>v))fin++})}));
 return{ok,wr,fin};
}
/* ===== Oflayn rejim ===== */
function offlineUser(){
 try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^sb-.*-auth-token$/.test(k)){const v=JSON.parse(localStorage.getItem(k));const u=v&&(v.user||(v.currentSession&&v.currentSession.user));if(u&&u.id)return u}}}catch(e){}
 return null;
}
const qKey=()=>"gm_q_"+(currentUser?currentUser.id:"x");
function qGet(){try{return JSON.parse(localStorage.getItem(qKey())||"[]")}catch(e){return[]}}
function qSet(a){try{localStorage.setItem(qKey(),JSON.stringify(a))}catch(e){}}
const isNetErr=e=>!navigator.onLine||/fetch|network|load failed|timeout/i.test((e&&e.message)||"");
/* Test natijasi: internet bo'lmasa navbatga olinadi va qaytganda yuboriladi */
const subKey=r=>"gm_sub_"+r.user_id+"_"+r.chapter;
const isDup=e=>!!e&&(e.code==="23505"||/duplicate key|unique constraint/i.test(e.message||""));
/* Test natijasi: bob testi faqat bir marta (birinchi urinish) yoziladi. Internet bo'lmasa navbatga olinadi. */
async function submitTest(row,nm,title,fromQueue){
 try{if(localStorage.getItem(subKey(row)))return"dup"}catch(e){}
 try{
  const r=await db.from('test_results').insert([row]);
  if(r.error)throw r.error;
  try{localStorage.setItem(subKey(row),"1")}catch(e){}
  return"ok";
 }catch(e){
  if(isDup(e)){try{localStorage.setItem(subKey(row),"1")}catch(x){}return"dup"}
  if(isNetErr(e)){if(!fromQueue)qSet(qGet().concat([{row:Object.assign({created_at:new Date().toISOString()},row),nm,title}]));return"net"}
  return"fail";
 }
}
const SUBMSG={wait:"Natija yuborilmoqda…",ok:"✓ Natijangiz reytingga yozildi. Bob testida faqat birinchi urinish hisoblanadi.",dup:"Bu bob testi avval topshirilgan. Reytingda birinchi urinish qoladi, bu urinish faqat mashq uchun.",net:"Internet yo‘q. Natija saqlab qo‘yildi va ulanganda avtomatik yuboriladi.",fail:"Natijani saqlab bo‘lmadi. O‘qituvchiga xabar bering."};
const subMsg=k=>SUBMSG[k]||SUBMSG.wait;
async function flushQ(){
 if(!currentUser||!navigator.onLine)return;
 const q=qGet();if(!q.length)return;
 const rest=[];
 for(const it of q){const r=await submitTest(it.row,it.nm,it.title,true);if(r==="net"||(r==="fail"&&(it.tries=(it.tries||0)+1)<5))rest.push(it)}
 qSet(rest);
 if(rest.length<q.length)reytingYukla();
}
function netUi(){const b=document.getElementById("offb");if(b)b.hidden=navigator.onLine}
window.addEventListener("online",()=>{netUi();if(currentUser)startData()});
window.addEventListener("offline",netUi);
function lessonTotal(){let n=0;CH.forEach(c=>c.t.forEach(t=>{if(!t.sets||isTest(t))return;t.sets.forEach(st=>{n+=st.prac.length})}));return n}
async function pullPractice(){
 try{
  const r=await db.from('practice_stats').select('results').eq('user_id',currentUser.id).maybeSingle();
  if(r.error||!r.data||!r.data.results)return;
  const sc=x=>Array.isArray(x)?x.filter(v=>v==1).length:-1;let ch=false;
  Object.keys(r.data.results).forEach(k=>{const a=r.data.results[k];if(Array.isArray(a)&&sc(a)>sc(R[k])){R[k]=a;ch=true}});
  if(ch){save();renderSide();if(!P)render()}
 }catch(e){}
}
async function syncPractice(){
 if(!currentUser)return;
 const s=lessonStats();
 try{await db.from('practice_stats').upsert({user_id:currentUser.id,results:R,correct:s.ok,wrong:s.wr,sets_done:s.fin,updated_at:new Date().toISOString()})}catch(e){}
}
async function reytingYukla(){
 if(!currentUser)return;
 try{
  const [tr,ps,pr]=await Promise.all([
   db.from('test_results').select('user_id,chapter,score,total,created_at').order('created_at',{ascending:true}),
   db.from('practice_stats').select('user_id,correct,wrong'),
   db.from('profiles').select('id,full_name,avatar')
  ]);
  if(tr.error&&ps.error&&pr.error){RK.off=true;RK.loaded=true;if(!isEditingName&&!isEditingPassword&&!isEditingAvatar)renderRight();renderRk();return}
  RK.off=false;
  const U={},g=id=>U[id]||(U[id]={id,name:"",av:null,mc:0,mw:0,tc:0,tt:0,hasP:false,hasT:false});
  RK.noPractice=!!ps.error;
  (ps.data||[]).forEach(p=>{const u=g(p.user_id);u.mc=p.correct||0;u.mw=p.wrong||0;u.hasP=u.mc+u.mw>0});
  const seen={};
  (tr.data||[]).forEach(r=>{const k=r.user_id+"|"+r.chapter;if(seen[k])return;seen[k]=1;const u=g(r.user_id);u.tc+=r.score;u.tt+=r.total;if(r.total>0)u.hasT=true});
  (pr.data||[]).forEach(p=>{const u=g(p.id);u.name=p.full_name||"";const a=p.avatar;u.av=a!=null&&a!==""&&+a>=0&&+a<AVS.length?+a:null});
  g(currentUser.id);
  const LT=lessonTotal();
  Object.values(U).forEach(u=>{u.mp=RK.noPractice?null:(LT?Math.min(100,Math.round(u.mc/LT*100)):0);u.tp=u.hasT?Math.round(u.tc/u.tt*100):null});
  RK.rows=Object.values(U);
  RK.me=U[currentUser.id]||null;
 }catch(e){}
 RK.loaded=true;
 if(!isEditingName&&!isEditingPassword&&!isEditingAvatar)renderRight();
 renderRk();
}
async function startData(){await flushQ();await pullPractice();await syncPractice();await reytingYukla()}
const PASS=0.7;
function setPassed(t,s){const a=R[key(t,s)],n=t.sets[s].prac.length;return Array.isArray(a)&&a.length==n&&a.every(v=>v)&&a.filter(v=>v==1).length>=Math.ceil(n*PASS)}
function courseDone(){let n=0;CH.forEach(c=>c.t.forEach(t=>{if(ready(t)&&t.sets&&t.sets.every((st,s)=>setPassed(t,s)))n++}));return n}
function progTiles(){
 const m=RK.me,has=!!(m&&m.hasT),L=lessonStats(),LT=lessonTotal(),n=courseDone();
 const srv=(RK.loaded&&!RK.noPractice&&m)?m.mc:0,okv=Math.min(Math.max(L.ok,srv),LT);
 const pm=LT?Math.round(okv/LT*100):0,pk=Math.round(n/TOTAL*1000)/10,fm=x=>String(x).replace(".",",");
 const tile=(lab,val,sub,p,tip)=>`<div${tip?` title="${tip}"`:""}><b>${val}</b><small>${lab}</small><span class="pr-bar"><i style="width:${Math.min(100,p||0)}%"></i></span><em>${sub}</em></div>`;
 return `<div class="pr-m">${tile("Bob testi",has?m.tp+"%":"—",has?`${m.tc} / ${m.tt}`:"hali yo‘q",has?m.tp:0)}${tile("Mashqlar",pm+"%",`${okv} / ${LT}`,pm)}${tile("O‘zlashtirilgan",fm(pk)+"%",`${n} / ${TOTAL} mavzu`,pk,"Kamida 70% natija bilan bajarilgan mavzular")}</div>`;
}
function rkInner(){
 if(!currentUser)return `<p class="rk-note">Reytingni ko‘rish uchun tizimga kiring.</p>`;
 if(!RK.loaded)return `<p class="rk-note">Yuklanmoqda...</p>`;
 if(RK.off&&!RK.rows.length)return `<p class="rk-note">Reytingni ko‘rish uchun internetga ulaning.</p>`;
 const tab=RK.sort,LT=lessonTotal(),val=(u,k)=>u[k]==null?-1:u[k],o=tab=="test"?["tp","mp"]:["mp","tp"];
 const rows=RK.rows.slice().sort((a,b)=>val(b,o[0])-val(a,o[0])||val(b,o[1])-val(a,o[1])||(a.name||"").localeCompare(b.name||""));
 const pos=rows.findIndex(u=>u.id==currentUser.id);
 const warn=(RK.noPractice?"Mashqlar statistikasi serverda hali yoqilmagan. ":"")+(RK.off?"Oflayn: oxirgi yuklangan reyting ko‘rsatilmoqda.":"");
 const top=`<div class="rk-top"><div class="rk-t"><button class="${tab=="test"?"on":""}" onclick="rkSort('test')">Bob testi bo‘yicha</button><button class="${tab=="mash"?"on":""}" onclick="rkSort('mash')">Mashqlar bo‘yicha</button></div>${pos>=0?`<div class="rk-pos">Sizning o‘rningiz: <b>${pos+1}</b> / ${rows.length}</div>`:""}${warn?`<p class="rk-warn">${warn.trim()}</p>`:""}</div>`;
 const list=rows.map((u,i)=>{
  const me=u.id==currentUser.id,nm=u.name||(me?NAME:"")||"O‘quvchi",ini=nm.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("")||"?";
  const v=tab=="test"?u.tp:u.mp,has=v!=null,pc=has?Math.max(0,Math.min(100,v)):0;
  return `<div class="rk-row${me?" me":""}"><span class="rk-n ${i<3?"t"+(i+1):""}">${i+1}</span><span class="rk-av ${u.av==null?"":"g"}" style="${u.av==null?"":avStyle(u.av)}">${u.av==null?esc(ini):AVS[u.av][0]}</span><div class="rk-nm"><div class="rk-l1"><b title="${esc(nm)}">${esc(nm)}</b>${me?"<small>Siz</small>":""}</div><div class="rk-b"><i style="width:${pc}%"></i></div></div><span class="rk-pc">${has?v+"%":"—"}</span></div>`}).join("");
 return top+`<div class="rk-list">${list}</div>`;
}
function renderRk(){
 const inner=rkInner(),e=document.getElementById("rkp"),d=document.getElementById("rkd");
 if(e)e.innerHTML=`<div class="rth"><b>Reyting</b><button onclick="rkT(false)" aria-label="Yopish">✕</button></div>`+inner;
 if(d)d.innerHTML=inner;
}
function rkSort(s){RK.sort=s;renderRk()}
function rkT(on){
 const b=document.body,v=on===undefined?!b.classList.contains("rk-open"):on;
 b.classList.toggle("rk-open",v);
 if(!v)return;
 b.classList.remove("rt-open");navT(false);
 renderRk();const r=document.getElementById("rkp");if(r)r.scrollTop=0;
 reytingYukla();
}
let cur={c:null,t:null},open=0,first=true,P=null,vals=[];
const clearP=()=>document.querySelectorAll('[id^="pr"]').forEach(e=>e.innerHTML="");

function renderSide(){
 const rd=flat.map(([c,t])=>CH[c].t[t]).filter(ready),pct=Math.min(100,Math.round(rd.length/TOTAL*100));
 document.getElementById("ovt").textContent=`Kurs tayyorligi ${pct}% · ${rd.length} / ${TOTAL} mavzu`;
 document.getElementById("ovb").style.width=pct+"%";
 let h=`<div class="dh"><b>Mundarija</b><button onclick="navT(false)" aria-label="Yopish">✕</button></div>`;
 CH.forEach((c,k)=>{
  h+=`<div class="sec ${k==open?"open":""}" style="animation-delay:${first?k*.025:0}s"><button class="sh" onclick="tg(${k})"><span class="k">${k+1}</span><span style="flex:1"><b>${c.n}</b><small>${c.t.length?c.t.length+" ta mavzu":"to‘ldirilmoqda"}</small></span><span class="cv">▶</span></button><div class="tw"><div class="tl">`;
  if(!c.t.length)h+=`<div class="soon">Mavzular to‘ldirilmoqda…</div>`;
  c.t.forEach((t,i)=>h+=`<button class="tp ${done(t)?"done":""} ${cur.c==k&&cur.t==i?"sel":""}" onclick="pick(${k},${i})"><span class="dot">${done(t)?"✓":t.id}</span><span>${t.t}</span></button>`);
  h+="</div></div></div>"});
 const tc=document.getElementById("toc"),y=tc.scrollTop;tc.innerHTML=h;tc.scrollTop=y;first=false;
}

let NAME="";try{NAME=localStorage.getItem("gm_name")||""}catch(e){}
const esc=s=>s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const AVS=[["🦊","#fb923c","#ef4444"],["🐼","#94a3b8","#475569"],["🦁","#fbbf24","#f97316"],["🐯","#f59e0b","#dc2626"],["🐸","#4ade80","#16a34a"],["🦉","#a78bfa","#6d28d9"],["🐧","#38bdf8","#2563eb"],["🐙","#f472b6","#be185d"],["🤖","#22d3ee","#0e7490"],["🚀","#818cf8","#4338ca"],["🦄","#e879f9","#7c3aed"],["🐬","#2dd4bf","#0f766e"],["π","#4f46e5","#7c3aed"],["∑","#f43f5e","#9333ea"],["√","#10b981","#0d9488"],["∞","#f59e0b","#db2777"]];
let AV=null,isEditingAvatar=false,PRC=null;
function prMin(){if(PRC==null){try{const v=localStorage.getItem("gm_prmin");PRC=v===null?innerHeight<820:v==="1"}catch(e){PRC=false}}return PRC}
function prT(){PRC=!prMin();try{localStorage.setItem("gm_prmin",PRC?"1":"0")}catch(e){}const e=document.querySelector("#rt .pr");if(e)e.classList.toggle("min",PRC)}
const avStyle=i=>`background:linear-gradient(135deg,${AVS[i][1]},${AVS[i][2]})`;
function loadAvLocal(){try{const v=localStorage.getItem("gm_av_"+currentUser.id);AV=v!==null&&v!==""&&+v>=0&&+v<AVS.length?+v:null}catch(e){AV=null}}
function saveAv(){
  try{if(AV==null)localStorage.removeItem("gm_av_"+currentUser.id);else localStorage.setItem("gm_av_"+currentUser.id,AV)}catch(e){}
  try{db.from('profiles').update({avatar:AV==null?null:String(AV)}).eq('id',currentUser.id).then(()=>{},()=>{})}catch(e){}
}
function stats(){let ok=0,wr=0,fin=0;Object.values(R).forEach(a=>{if(!Array.isArray(a))return;a.forEach(v=>{if(v==1)ok++;else if(v==2)wr++});if(a.length&&a.every(v=>v))fin++});return{ok,fin,acc:ok+wr?Math.round(ok/(ok+wr)*100):0}}
function flagsOff(){isEditingName=false;isEditingPassword=false;isEditingAvatar=false}
function profileHtml(){
 const nm=NAME||"O‘quvchi",ini=NAME.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("")||"?";
 return `<div class="pr${prMin()?" min":""}"><div class="pr-h"><button class="pr-av ${AV==null?"":"g"}" style="${AV==null?"":avStyle(AV)}" onclick="openPE()" aria-label="Profilni tahrirlash">${AV==null?esc(ini):AVS[AV][0]}</button><div class="pr-id"><b class="pr-nm">${esc(nm)}</b><span class="pr-sub">O‘quvchi</span></div><button class="pr-tg" onclick="prT()" aria-label="Profilni yig‘ish yoki ochish"><span>▾</span></button></div>${progTiles()}<div class="pr-f"><button class="pr-edit" onclick="openPE()">✎ Profilni tahrirlash</button><button class="pr-out" onclick="tizimdanChiqish()">Chiqish</button></div></div>`;
}
function renderRight(){
 let h=`<div class="rth"><b>Profil</b><button onclick="rtT(false)" aria-label="Yopish">✕</button></div>`;
 h+=currentUser?profileHtml():`<div class="stc2"><b>Avtorizatsiya</b><div class="nr"><small>Tizimga kiring...</small></div></div>`;
 h+=`<div class="fc rkc"><h3>Reyting</h3><div id="rkd"></div></div>`;
 document.getElementById("rt").innerHTML=h;
 renderRk();
}

/* ===== Profilni tahrirlash: avatar, ism va familiya, parol ===== */
let PE={av:null};
const peMsg=(id,txt,kind)=>{const e=document.getElementById(id);if(e){e.textContent=txt||"";e.className="pe-msg"+(kind?" "+kind:"")}};
function peRefresh(){
 const a=document.getElementById("pe-av");if(!a)return;
 const f=(document.getElementById("pe-fn")||{}).value||"",l=(document.getElementById("pe-ln")||{}).value||"";
 const ini=((f.trim()[0]||"")+(l.trim()[0]||"")).toUpperCase()||"?";
 a.className="pr-av big"+(PE.av==null?"":" g");
 a.setAttribute("style",PE.av==null?"":avStyle(PE.av));
 a.textContent=PE.av==null?ini:AVS[PE.av][0];
 document.querySelectorAll("#pem .avo").forEach(b=>b.classList.toggle("on",+b.dataset.i===PE.av));
}
function peAv(i){PE.av=i;peRefresh()}
function peEye(){const a=document.getElementById("pe-p1"),b=document.getElementById("pe-p2");if(!a)return;const t=a.type==="password"?"text":"password";a.type=t;if(b)b.type=t}
function openPE(){
 if(!currentUser)return;
 const parts=NAME.trim().split(/\s+/).filter(Boolean),first=parts[0]||"",last=parts.slice(1).join(" ");
 PE={av:AV};
 const m=document.getElementById("pem");
 m.innerHTML=`<div class="pe" role="dialog" aria-modal="true" aria-label="Profilni tahrirlash">
  <div class="pe-h"><b>Profilni tahrirlash</b><button onclick="closePE()" aria-label="Yopish">✕</button></div>
  <div class="pe-b">
   <div class="pe-s">
    <div class="pe-prev"><span id="pe-av" class="pr-av big"></span><small>Avatar</small></div>
    <div class="avg pe-avg">${AVS.map((a,i)=>`<button type="button" class="avo" data-i="${i}" style="${avStyle(i)}" onclick="peAv(${i})" aria-label="Avatar ${i+1}">${a[0]}</button>`).join("")}</div>
    <button type="button" class="pe-link" onclick="peAv(null)">Bosh harflarni ishlatish</button>
   </div>
   <div class="pe-s">
    <div class="pe-names">
     <div class="pe-fl"><label for="pe-fn">Ism</label><input id="pe-fn" maxlength="30" autocomplete="given-name" placeholder="Masalan: Ali" value="${esc(first)}" oninput="peRefresh()"></div>
     <div class="pe-fl"><label for="pe-ln">Familiya</label><input id="pe-ln" maxlength="30" autocomplete="family-name" placeholder="Masalan: Valiyev" value="${esc(last)}" oninput="peRefresh()" onkeydown="if(event.key==='Enter')peSave()"></div>
    </div>
    <div id="pe-m1" class="pe-msg"></div>
    <button id="pe-sv" class="btn pe-wide" onclick="peSave()">Saqlash</button>
   </div>
   <div class="pe-s">
    <h4>Parolni o‘zgartirish</h4>
    <div class="pe-fl"><label for="pe-p1">Yangi parol</label><div class="pe-pi"><input id="pe-p1" type="password" autocomplete="new-password" placeholder="Kamida 6 ta belgi"><button type="button" class="pe-eye" onclick="peEye()" aria-label="Ko‘rsatish yoki yashirish">👁</button></div></div>
    <div class="pe-fl"><label for="pe-p2">Parolni takrorlang</label><input id="pe-p2" type="password" autocomplete="new-password" placeholder="Parolni qayta kiriting" onkeydown="if(event.key==='Enter')pePwd()"></div>
    <div id="pe-m2" class="pe-msg"></div>
    <button id="pe-pb" class="btn g pe-wide" onclick="pePwd()">Parolni yangilash</button>
   </div>
  </div></div>`;
 m.classList.add("on");document.body.classList.add("pe-open");
 peRefresh();
}
function closePE(){const m=document.getElementById("pem");if(m)m.classList.remove("on");document.body.classList.remove("pe-open")}
async function peSave(){
 const f=(document.getElementById("pe-fn").value||"").trim().replace(/\s+/g," "),l=(document.getElementById("pe-ln").value||"").trim().replace(/\s+/g," ");
 if(!f){peMsg("pe-m1","Ismingizni kiriting.","err");document.getElementById("pe-fn").focus();return}
 if(!navigator.onLine){peMsg("pe-m1","Internet yo‘q. Saqlash uchun internetga ulaning.","err");return}
 const full=(f+" "+l).trim().slice(0,60),btn=document.getElementById("pe-sv");
 btn.disabled=true;peMsg("pe-m1","Saqlanmoqda…");
 try{const r=await db.from('profiles').upsert({id:currentUser.id,full_name:full});if(r&&r.error)throw r.error}
 catch(e){btn.disabled=false;peMsg("pe-m1","Saqlab bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.","err");return}
 NAME=full;
 try{localStorage.setItem("gm_nm_"+currentUser.id,NAME)}catch(e){}
 AV=PE.av;saveAv();
 renderRight();
 btn.disabled=false;peMsg("pe-m1","✓ Saqlandi","ok");
 setTimeout(closePE,700);
 reytingYukla();
 if(cur.c!=null&&cur.t!=null&&CH[cur.c].t[cur.t]&&isTest(CH[cur.c].t[cur.t]))reytingniYuklash(CH[cur.c].t[cur.t].id,'reyting-panel');
}
async function pePwd(){
 const p1=document.getElementById("pe-p1").value,p2=document.getElementById("pe-p2").value,btn=document.getElementById("pe-pb");
 if(p1.length<6){peMsg("pe-m2","Parol kamida 6 ta belgidan iborat bo‘lishi kerak.","err");return}
 if(p1!==p2){peMsg("pe-m2","Ikkala parol bir xil emas.","err");return}
 if(!navigator.onLine){peMsg("pe-m2","Internet yo‘q. Parolni o‘zgartirish uchun internetga ulaning.","err");return}
 btn.disabled=true;peMsg("pe-m2","Yangilanmoqda…");
 let err=null;
 try{const r=await db.auth.updateUser({password:p1});err=r&&r.error}catch(e){err=e}
 btn.disabled=false;
 if(err){peMsg("pe-m2",/different|same/i.test(err.message||"")?"Yangi parol eskisidan farq qilishi kerak.":"Parolni yangilab bo‘lmadi. Qayta urinib ko‘ring.","err");return}
 document.getElementById("pe-p1").value="";document.getElementById("pe-p2").value="";
 peMsg("pe-m2","✓ Parol yangilandi","ok");
}

/* ===== Bosh oyna ===== */
function lastTopic(){try{const v=(localStorage.getItem("gm_last")||"").split(",").map(Number);if(v.length==2&&CH[v[0]]&&CH[v[0]].t[v[1]])return v}catch(e){}return null}
function homeHtml(){
 const s=stats(),L=lastTopic(),p=L||[0,0],T=CH[p[0]].t[p[1]];
 return `<div class="hero"><span class="tag">Xush kelibsiz</span><h2>Matematiklar<span class="lg-uz">.uz</span></h2><p class="hm-sub">Matematikani qoidadan mashqqacha bosqichma-bosqich o‘rganing: qoidani o‘qing, misollarni ko‘ring, so‘ng platformada mashq qiling.</p></div>
 <div class="hm-go"><div><small>${L?"Davom etish":"Boshlash"}</small><b>${T.id} · ${T.t}</b></div><button class="btn" onclick="pick(${p[0]},${p[1]})">${L?"Davom etish":"Boshlash"} →</button></div>
 <div class="pf-stats" style="margin-top:14px"><div><b>${s.ok}</b><small>to‘g‘ri javob</small></div><div><b>${s.fin}</b><small>mashq tugatildi</small></div><div><b>${s.acc}%</b><small>aniqlik</small></div></div>
 <h3>Boblar</h3><div class="hm-grid">${CH.map((c,k)=>`<button class="hm-ch ${c.t.length?"":"empty"}" onclick="openCh(${k})"><span class="k">${k+1}</span><span><b>${c.n}</b><small>${c.t.length?c.t.length+" ta mavzu":"to‘ldirilmoqda"}</small></span></button>`).join("")}</div>`;
}
function hist(fromHome){try{const s={c:cur.c,t:cur.t};if(fromHome)history.pushState(s,"");else history.replaceState(s,"")}catch(e){}}
function goHome(){
 if(!leaveOk())return;P=null;
 navT(false);rtT(false);rkT(false);
 if(cur.c==null){window.scrollTo(0,0);return}
 if(history.state&&history.state.c!=null)history.back();
 else{cur={c:null,t:null};P=null;render();window.scrollTo(0,0)}
}
function openCh(k){
 if(CH[k].t.length){pick(k,0);return}
 if(!leaveOk())return;
 const fh=cur.c==null;cur={c:k,t:null};open=k;P=null;render();hist(fh);window.scrollTo(0,0);
}
function leaveOk(){return !(P&&!P.sum&&vals.some(filled))||confirm("Mashq tugallanmagan. Chiqsangiz kiritilgan javoblar yo‘qoladi. Chiqamizmi?")}
window.addEventListener("beforeunload",e=>{if(P&&!P.sum&&vals.some(filled)){e.preventDefault();e.returnValue=""}});
window.addEventListener("popstate",e=>{
 if(!leaveOk()){try{history.pushState({c:cur.c,t:cur.t},"")}catch(x){}return}
 const s=e.state;
 if(s&&typeof s.c!=="undefined"&&(s.c==null||CH[s.c])){cur={c:s.c,t:s.t};if(s.c!=null)open=s.c}else cur={c:null,t:null};
 P=null;render();rtT(false);rkT(false);navT(false);window.scrollTo(0,0);
});
function rtT(on,sel){
 const b=document.body,v=on===undefined?!b.classList.contains("rt-open"):on;
 b.classList.toggle("rt-open",v);
 if(!v)return;
 b.classList.remove("rk-open");navT(false);
 const r=document.getElementById("rt");if(!r)return;
 r.scrollTop=0;
 if(sel){const e=r.querySelector(sel);if(e)setTimeout(()=>r.scrollTo({top:Math.max(0,e.offsetTop-60),behavior:"smooth"}),60)}
}

function render(){
 renderSide();renderRight();
 const D=document.getElementById("d");
 if(cur.c==null){D.innerHTML=homeHtml();return}
 const c=CH[cur.c],t=cur.t==null?null:c.t[cur.t];
 if(!t){D.innerHTML=`<div class="hero"><span class="tag">${cur.c+1}-bob</span><h2>${c.n}</h2></div><div class="soonbox"><b>Mavzular to‘ldirilmoqda</b>Bu bobning mavzulari tez orada shu yerda paydo bo‘ladi.</div>`;return}
 const hero=`<div class="hero"><span class="tag">${cur.c+1}-bob · ${c.n}</span><span class="tag">${t.id}-mavzu</span><h2>${t.t}</h2></div>`;
 if(!ready(t)){D.innerHTML=hero+`<div class="soonbox"><b>Bu mavzu to‘ldirilmoqda</b>Ma’lumotlar va misollar tez orada qo‘shiladi.</div>`+navHtml();return}
 const rule=(r,i)=>`<div class="rule"><h4><b>${i+1}-qoida</b>${r.h}</h4><p>${r.p}</p>${r.ex.map(e=>`<div class="ex"><span class="lab" style="margin:0">Misol</span><code>${QF(e[0])}</code>${e[1]?`<span>${e[1]}</span>`:""}</div>`).join("")}${(r.steps||[]).map((s,j)=>`<div class="stp"><b>${j+1}</b><div><strong>${j+1}-qadam.${s.h}</strong><span>${s.p}</span><code>${QF(s.e)}</code></div></div>`).join("")}</div>`;
 
 const reytingDiv = isTest(t) ? `<div id="reyting-panel"></div>` : '';
 
 const set=(st,s)=>`<div><h3>${st.n}</h3>${st.hint?`<p class="intro">${st.hint}</p>`:""}<div class="pg c${cols(st)}">${st.prac.map((q,i)=>`<div><i>${i+1}</i>${QF(q)} = ?</div>`).join("")}</div><div style="margin-top:14px"><button class="btn" onclick="startP(${s})">Platformada ishlash →</button></div><div id="pr${s}"></div>${reytingDiv}</div>`;
 
 const fx=t.f&&t.f.length?`<section class="fx"><div class="fx-h"><span class="fx-ic">∑</span><div><b>Formulalar</b><small>${t.id}-mavzu · eslab qolish uchun</small></div><span class="fx-c">${t.f.length} ta</span></div><div class="fx-g">${t.f.map((x,k)=>`<div class="fx-i ${/=/.test(x)&&x.length<=40?"m":"r"}"><span class="fx-n">${k+1}</span><div class="fx-t">${x}</div></div>`).join("")}</div></section>`:"";

 D.innerHTML=hero+`${t.rules?`<div><h3>Ma’lumotlar</h3>${t.intro?`<p class="intro">${t.intro}</p>`:""}${t.rules.map(rule).join("")}${t.note?`<div class="note">${t.note}</div>`:""}</div>`:""}`+fx+t.sets.map(set).join("")+navHtml();
 
 if(P)drawP();
 
 if(isTest(t)) {
   reytingniYuklash(t.id, 'reyting-panel');
 }
}

function navHtml(){const i=flat.findIndex(f=>f[0]==cur.c&&f[1]==cur.t);return `<div class="nav"><button class="btn g" ${i<=0?"disabled":""} onclick="go(${i-1})">← Oldingi mavzu</button><button class="btn g" ${i<0||i>=flat.length-1?"disabled":""} onclick="go(${i+1})">Keyingi mavzu →</button></div>`}
function go(i){pick(flat[i][0],flat[i][1])}
function tg(k){if(open==k){open=-1}else{open=k;if(!CH[k].t.length){const fh=cur.c==null;cur={c:k,t:null};P=null;hist(fh)}}render()}
function pick(c,t){if(!leaveOk())return;const fh=cur.c==null;cur={c,t};open=c;P=null;try{localStorage.setItem("gm_last",c+","+t)}catch(e){}render();hist(fh);navT(false);rtT(false);rkT(false);if(innerWidth<=860)document.getElementById("d").scrollIntoView()}

function startP(s){
  const t=CH[cur.c].t[cur.t],k=key(t,s);
  if(!R[k])R[k]=t.sets[s].prac.map(()=>0);
  P={s, i:0, startTime: Date.now(), submitted: false, tools:false};
  vals=[];
  clearP();
  drawP();
  document.getElementById("pr"+s).scrollIntoView({block:"center"});
}
const qfs=l=>{const m=innerWidth<520;return l>24?(m?18:24):l>16?(m?22:30):(m?28:34)};
const filled=v=>!!(v&&String(v).trim());
const CHIPS=[["−","−",0],["·","·",0],["÷","÷",0],["a/b","/",0],["x²","²",0],["x³","³",0],["xⁿ","^",0],["√","√()",1],["∛","∛()",1],["( )","()",1],["π","π",0]];
function drawP(){
 if(P.sum)return drawSum();
 const t=CH[cur.c].t[cur.t],st=t.sets[P.s],n=st.prac.length,i=P.i,pr=document.getElementById("pr"+P.s),qt=M(st.prac[i])+" = ?";
 const answered=st.prac.filter((x,j)=>filled(vals[j])).length;
 pr.innerHTML=`<div class="pc"><div class="ph"><span>${t.sets.length>1?st.n+" · ":""}Misol ${i+1} / ${n}</span><span>Javob berilgan: ${answered} / ${n}</span><button class="lnk" onclick="closeP()">Yopish ✕</button></div>
 <div class="dots">${st.prac.map((x,j)=>`<button class="${filled(vals[j])?"a":""} ${j==i?"c":""}" onclick="gp(${j})">${j+1}</button>`).join("")}</div>
 <div class="q" style="font-size:${qfs(qt.length)}px">${QF(st.prac[i])} = ?</div>
 <div class="ar"><input id="in" autocomplete="off" autocapitalize="off" autocorrect="off" enterkeyhint="next" spellcheck="false" placeholder="Javobingiz: -5, 3/4, 0,75, 2³ ..." value="${esc(vals[i]||"")}"><button class="btn g" onclick="toolsT()">fx Amallar ▾</button><button class="btn" id="ck" onclick="nextP()">${i==n-1?"Yakunlash":"Keyingi"} <span class="en">(Enter)</span></button></div>
 <div class="tools" id="tools" ${P.tools?"":"hidden"}>${CHIPS.map(c=>`<button type="button" onclick="ins('${c[1]}',${c[2]})">${c[0]}</button>`).join("")}</div>
 <div class="pv" id="pv"></div>
 <div class="pn"><button class="btn g" ${i==0?"disabled":""} onclick="gp(${i-1})">← Oldingi</button><button class="btn g fin" onclick="finishP()">Tugatish va natijani ko‘rish</button><button class="btn g" ${i==n-1?"disabled":""} onclick="gp(${i+1})">Keyingi →</button></div></div>`;
 const inp=document.getElementById("in");
 inp.oninput=()=>{vals[P.i]=inp.value;pvw()};
 inp.onkeydown=e=>{if(e.key=="Enter"){e.preventDefault();nextP()}};
 inp.focus();pvw();
}
function pvw(){
 const inp=document.getElementById("in"),pv=document.getElementById("pv");if(!inp||!pv)return;
 const s=inp.value.trim();if(!s){pv.className="pv";pv.textContent="";return}
 try{const v=evalMath(s),plain=/^[+\-−–—]?\d+(?:[.,]\d+)?$/.test(s);pv.className="pv";pv.textContent=plain?"":"Qiymati: "+M(fmtNum(v))}
 catch(e){pv.className="pv w";pv.textContent=e.message=="aralash"?"Aralash sonni 3/2 yoki 1,5 ko‘rinishida yozing":e.message=="0"?"Nolga bo‘lib bo‘lmaydi":"Yozuv tugallanmagan yoki tushunarsiz"}
}
function toolsT(){P.tools=!P.tools;const t=document.getElementById("tools");if(t)t.hidden=!P.tools;const el=document.getElementById("in");if(el)el.focus()}
function ins(s,b){const el=document.getElementById("in");if(!el)return;const a=el.selectionStart==null?el.value.length:el.selectionStart,e=el.selectionEnd==null?a:el.selectionEnd;el.value=el.value.slice(0,a)+s+el.value.slice(e);const pos=a+s.length-(b||0);el.focus();el.setSelectionRange(pos,pos);vals[P.i]=el.value;pvw()}
function saveCur(){const el=document.getElementById("in");if(el&&P&&!P.sum)vals[P.i]=el.value}
function gp(j){saveCur();P.i=j;drawP()}
function nextP(){saveCur();const n=CH[cur.c].t[cur.t].sets[P.s].prac.length;if(P.i<n-1)gp(P.i+1);else finishP()}
function finishP(){
 saveCur();
 const t=CH[cur.c].t[cur.t],st=t.sets[P.s],k=key(t,P.s);
 const left=st.prac.filter((q,i)=>!filled(vals[i])).length;
 if(left&&!confirm("Hali "+left+" ta misolga javob berilmagan. Baribir tugatib, natijani ko‘ramizmi?"))return;
 R[k]=st.prac.map((q,i)=>filled(vals[i])?(check(vals[i],q)?1:2):0);
 save();
 syncPractice().then(reytingYukla);
 P.elapsed=Math.floor((Date.now()-P.startTime)/1000);
 P.sum=true;renderSide();drawP();
 document.getElementById("pr"+P.s).scrollIntoView({block:"start"});
}
function drawSum(){
 const t=CH[cur.c].t[cur.t],st=t.sets[P.s],k=key(t,P.s),n=st.prac.length,r=R[k]||[],ok=cnt(t,P.s);
 const wrong=r.filter(v=>v==2).length,skip=r.filter(v=>!v).length,el=P.elapsed||0;

 if (isTest(t) && !P.submitted && currentUser) {
   P.submitted = true; P.subst = "wait";
   submitTest({ user_id: currentUser.id, chapter: t.id, score: ok, total: n, time_spent_sec: el }, NAME, t.t)
     .then(r => {
       if (P) P.subst = r;
       const e = document.getElementById("subst"); if (e) e.textContent = subMsg(r);
       if (r === "ok") reytingniYuklash(t.id, 'reyting-panel');
       reytingYukla();
     });
 }

 const pct=Math.round(ok/n*100);
 const msg=pct==100?"Mukammal! Hammasi to‘g‘ri 🎉":pct>=80?"Ajoyib natija!":pct>=60?"Yaxshi, yana biroz mashq qiling":pct>=40?"Qoniqarli. Qoidalarni takrorlang":"Qoidalarni qayta ko‘rib chiqib, yana urinib ko‘ring";
 const cards=st.prac.map((q,i)=>{
  const g=r[i]==1,sk=!r[i],a=M(fmtNum(ans(q))),u=filled(vals[i])?M(esc(String(vals[i]).trim())):"—";
  return `<div class="rs ${g?"y":sk?"s":"n"}" style="animation-delay:${i*45}ms"><i>${i+1}</i>${QF(q)} = <b>${u}</b> ${g?"✓":sk?"•":"✗"}${g?"":`<small>${sk?"Javob berilmagan. ":""}To‘g‘ri javob: ${a}</small>`}</div>`}).join("");
 document.getElementById("pr"+P.s).innerHTML=`<div class="pc res"><div class="ph"><span>${t.sets.length>1?st.n+" natijalari":"Mashq natijalari"}</span></div>
 <div class="rh"><div class="ring" style="--p:${pct}"><span><b>${pct}%</b><small>${ok} / ${n}</small></span></div>
 <div class="rm"><h4>${msg}</h4><div class="chips"><span class="c y">✓ To‘g‘ri: ${ok}</span><span class="c n">✗ Xato: ${wrong}</span>${skip?`<span class="c s">• Yechilmagan: ${skip}</span>`:""}<span class="c">⏱ ${Math.floor(el/60)} daq ${el%60} soniya</span></div></div></div>
 ${isTest(t)?`<div class="subst" id="subst">${subMsg(P.subst||"wait")}</div>`:""}
 <div class="pg c${cols(st)}" style="margin:14px 0">${cards}</div>
 <div class="pn"><button class="btn g" onclick="retry()">Qayta ishlash</button><button class="btn g" onclick="closeP()">Yopish</button></div></div>`}

function retry(){
  const t=CH[cur.c].t[cur.t];
  R[key(t,P.s)]=t.sets[P.s].prac.map(()=>0);
  vals=[];
  P.i=0;
  P.sum=false;
  P.startTime=Date.now();
  P.submitted=false;
  P.elapsed=0;
  save();
  renderSide();
  drawP();
}

function closeP(){P=null;clearP();renderSide()}

function navT(on){document.body.classList.toggle("nav-open",on===undefined?!document.body.classList.contains("nav-open"):on)}
function goTo(sel){const e=document.querySelector(sel);if(e)e.scrollIntoView({behavior:"smooth",block:"start"})}
document.addEventListener("focusin",e=>{if(e.target&&/^(INPUT|TEXTAREA)$/.test(e.target.tagName))document.body.classList.add("typing")});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closePE()});
document.addEventListener("focusout",()=>document.body.classList.remove("typing"));
["email-input","password-input"].forEach(id=>{const e=document.getElementById(id);if(e)e.addEventListener("keydown",ev=>{if(ev.key=="Enter")tizimgaKirish()})});
netUi();
if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol)){window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").catch(()=>{})})}
try{history.replaceState({c:null,t:null},"")}catch(e){}
loadContent().then(()=>{render();holatniTekshirish()}).catch(e=>{console.error(e);contentFail()});
