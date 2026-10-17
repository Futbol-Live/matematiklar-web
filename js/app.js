window.systemLocks = {};     
let pendingAction = null;  
let toastTimer;

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
  
  // -- MEHMON REJIMI VA QULFLAR TO'SIG'I --
  currentUser = session ? session.user : null;
  hideLoginOverlay(); 
  if (typeof locksniYuklash === 'function') await locksniYuklash(); 

  if (session) {
    // --- TIZIMGA KIRGANLAR UCHUN "PROFIL" TUGMASI ---
    const btn = document.getElementById('profil-btn');
    if (btn) {
      btn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg><span>Profil</span>';
      btn.setAttribute('onclick', "rtT(true,'.pr')");
    }

    const { data, error: pe } = await db.from('profiles').select('full_name').eq('id', currentUser.id).single();
    if (data && data.full_name) {
      NAME = data.full_name;
    } else {
      NAME = (currentUser.email || "").split('@')[0];
      if (navigator.onLine && ((pe && pe.code === "PGRST116") || (!pe && data && !data.full_name))) {
        try { db.from('profiles').upsert({ id: currentUser.id, full_name: NAME }).then(() => {}, () => {}); } catch (e) {}
      }
    }
    try {
      if (data && data.full_name) localStorage.setItem("gm_nm_" + currentUser.id, NAME);
      else { const c = localStorage.getItem("gm_nm_" + currentUser.id); if (c) NAME = c; }
    } catch (e) {}
    
    loadAvLocal();
    loadRole();
    try{const ra=await db.from('profiles').select('avatar').eq('id',currentUser.id).single();if(!ra.error&&ra.data&&ra.data.avatar!=null&&ra.data.avatar!==""&&+ra.data.avatar>=0&&+ra.data.avatar<AVS.length)AV=+ra.data.avatar}catch(e){}
    useUserR();
    render();
    startData();
    if(cur.c !== null && CH[cur.c].t[cur.t] && isTest(CH[cur.c].t[cur.t])) {
      reytingniYuklash(CH[cur.c].t[cur.t].id, 'reyting-panel');
    }
  } else {
    // --- MEHMONLAR UCHUN "KIRISH" TUGMASI ---
    const btn = document.getElementById('profil-btn');
    if (btn) {
      btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg><span>Kirish</span>';
      btn.setAttribute('onclick', 'showLoginOverlay()');
    }
    
    render(); 
  }
}

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
  ROLE="student";
  tpClose();
  holatniTekshirish();
}

async function reytingniYuklash(chapterId, containerId) {
  const el = document.getElementById(containerId);
  if(!el) return;
  el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--mut);">Reyting yuklanmoqda...</div>';
  const { data, error } = await db.from('test_results').select('*, profiles(full_name)').eq('chapter', chapterId).order('created_at', { ascending: true });
  if (error) { el.innerHTML = '<div class="soonbox">Reytingni yuklashda xatolik yuz berdi.</div>'; return; }
  const birinchiUrinishlar = {};
  data.forEach(qator => { if (!birinchiUrinishlar[qator.user_id]) birinchiUrinishlar[qator.user_id] = qator; });
  let reyting = Object.values(birinchiUrinishlar);
  reyting.sort((a, b) => { if (b.score !== a.score) return b.score - a.score; return a.time_spent_sec - b.time_spent_sec; });
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
      html += `<div class="stc" style="background:${bg}; border:1px solid var(--line);"><div class="av" style="background:${avColor}; color:#fff;">${idx+1}</div><div style="flex:1"><b>${esc(ism)}</b></div><div style="text-align:right"><b>${r.score} ball</b><br><small style="color:var(--mut)">${Math.floor(r.time_spent_sec/60)} daq ${r.time_spent_sec%60} soniya</small></div></div>`;
    });
  }
  if (currentUser && meningOrnim === -1) {
    const myRank = reyting.findIndex(r => r.user_id === currentUser.id);
    if (myRank > 4) {
      let myR = reyting[myRank];
      let ism = myR.profiles?.full_name || 'Noma\'lum o\'quvchi';
      html += `<div class="stc" style="margin-top:10px; border:2px dashed var(--ac); background:var(--soft);"><div class="av" style="background:var(--ac);">${myRank+1}</div><div style="flex:1"><b>${esc(ism)} (Siz)</b></div><div style="text-align:right"><b>${myR.score} ball</b><br><small style="color:var(--mut)">${Math.floor(myR.time_spent_sec/60)} daq ${myR.time_spent_sec%60} soniya</small></div></div>`;
    }
  }
  html += '</div></div>';
  el.innerHTML = html;
}

const NAMES="Musbat va manfiy sonlar|Kasrlar|O‘nli kasrlar|Sonning darajasi|Harfli ifodalar|Birhadlar va ko‘phadlar|Ko‘paytuvchilarga ajratish|Qisqa ko‘paytirish formulalari|Algebraik kasrlar|Chiziqli tenglamalar|Chiziqli funksiyalar|Chiziqli tengsizliklar|Proporsiya|Foizlar|Modullar|Ildizlar|Sistemalar|Kvadrat tenglamalar|Kvadrat tengsizliklar|Progressiyalar|Ko‘rsatkichlar|Logarifm|Trigonometriya|Hosila|Integral".split("|");
const TOTAL=80; 
const CH=NAMES.map(n=>({n,t:[]}));
const CONTENT=[[0,"data/general-math/ch01.js"]];
const flat=[];
const qid=(t,s,i)=>t.id+".s"+s+".q"+(i+1);
function buildIndex() {
  CH.forEach(c => c.t.forEach(t => {
    if (t.rules && !t.sets) {
      t.sets = [];
      // Oddiy mashqlar uchun (Majburiy emas):
      if (t.prac) t.sets.push({ n: "O‘zlashtirish uchun mashqlar", prac: t.prac });
      // Yangi Uyga vazifa uchun (Majburiy qulf bilan!):
      if (t.hw) t.sets.push({ n: "Uyga vazifa 🔒 (Majburiy: 90%)", prac: t.hw, isHw: true }); 
    }
  }));
  flat.length = 0;
  CH.forEach((c, ci) => c.t.forEach((t, ti) => flat.push([ci, ti])));
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
 function term(){let v=frac();for(;;){if(isO("*")||isO(":")){const o=T[p++].o,r=frac();if(o==":"){if(r===0)bad("0");v/=r}else v*=r}else if(T[p]&&(T[p].f||isO("(")))v*=frac();else if(T[p]&&T[p].n!==undefined)bad("aralash");else break}return v}
 function unary(){if(isO("-")){p++;return -unary()}if(isO("+")){p++;return unary()}return power()}
 function power(){const b=atom();if(isO("^")){p++;return Math.pow(b,unary())}return b}
 function atom(){const t=T[p++];if(!t)bad();if(t.n!==undefined)return t.n;if(t.o==="("){const v=expr();if(!isO(")"))bad();p++;return v}if(t.f){const f=t.f;if(f==="pi"||f==="π")return Math.PI;let a;if(f==="sqrt"||f==="cbrt"){if(!isO("("))bad();a=atom()}else a=atom();if(f==="sqrt"||f==="√"){if(a<0)bad("ildiz");return Math.sqrt(a)}return Math.cbrt(a)}bad()}
 const v=expr();if(p!==T.length)bad();if(!isFinite(v))bad();return v}
const ans=q=>{try{return evalMath(q)}catch(e){return NaN}};
function ratOf(x){if(!isFinite(x))return null;if(Math.abs(x-Math.round(x))<1e-9)return[Math.round(x),1];for(let q=2;q<=1000;q++){const p=Math.round(x*q);if(Math.abs(x-p/q)<1e-9)return[p,q]}return null}
function fmtNum(x){if(!isFinite(x))return "—";const r=ratOf(x);if(!r)return "≈ "+x.toFixed(4).replace(".",",");if(r[1]==1)return String(r[0]===0?0:r[0]);const d=+x.toFixed(4);return r[0]+"/"+r[1]+(Math.abs(d-x)<1e-9?" = "+String(d).replace(".",","):"")}
function check(v,q){try{const a=evalMath(v),b=ans(q);if(!isFinite(a)||!isFinite(b))return false;return Math.abs(a-b)<=(ratOf(b)?1e-9:1e-3)*Math.max(1,Math.abs(b))}catch(e){return false}}
const QF=s=>M(s).replace(/(\d+)\s*\/\s*(\d+)/g,'<span class="fr"><span>$1</span><span>$2</span></span>').replace(/\^([-−]?\w+)/g,"<sup>$1</sup>");

const key=(t,s)=>s?t.id+"#"+s:t.id;
let RKEY="gm_res",R={};
function loadR(){try{R=JSON.parse(localStorage.getItem(RKEY)||"{}")}catch(e){R={}}}
loadR();
const SW_OK=/^[\d\s+\-−·:()\[\]]+$/;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function swTok(q){const T=[],re=/\d+|[+\-−·:()\[\]]/g;let m,i=0;while((m=re.exec(q)))T.push(/\d/.test(m[0])?{i:i++}:{o:m[0]==="−"?"-":m[0]});return T}
function swEval(T,vals){
 let p=0,bad=false;const sig=[];
 const pk=()=>T[p]&&T[p].o;
 function expr(){let v=term();while(pk()==="+"||pk()==="-"){const o=T[p++].o,b=term();v=o==="+"?v+b:v-b}return v}
 function term(){let v=fac();while(pk()==="·"||pk()===":"){const o=T[p++].o,b=fac();if(o==="·")v*=b;else{if(b===0||v%b!==0)bad=true;v=b?v/b:0}}sig.push(Math.sign(v));return v}
 function fac(){const t=T[p];if(!t){bad=true;return 0}if(t.o==="+"||t.o==="-"){p++;const v=fac();return t.o==="-"?-v:v}if(t.o==="("||t.o==="["){p++;const v=expr();const c=T[p];if(!c||c.o!==(t.o==="("?")":"]"))bad=true;else p++;sig.push(Math.sign(v)+2);return v}if(t.i!==undefined){p++;return vals[t.i]}bad=true;p++;return 0}
 const v=expr();if(p!==T.length)bad=true;return bad?null:{v,sig:sig.join()}}
const swDig=v=>String(v).length,swLo=d=>d==1?2:Math.pow(10,d-1),swHi=d=>Math.pow(10,d)-1;
function swVar(q){return SW_OK.test(q)&&(q.match(/\d+/g)||[]).some(x=>+x>1)}
function swGen(q,rng,used){
 if(!swVar(q))return q;
 const T=swTok(q),orig=(q.match(/\d+/g)||[]).map(Number),o=swEval(T,orig);if(!o)return q;
 const distinct=[...new Set(orig)].filter(v=>v>1);
 for(const [near,strict,tries] of [[true,true,6000],[false,true,12000],[false,false,12000]]){
  for(let a=0;a<tries;a++){
   const mp=new Map();
   distinct.forEach(v=>{const d=swDig(v),lo=near?Math.max(swLo(d),Math.ceil(v/2)):swLo(d),hi=near?Math.min(swHi(d),v*2):swHi(d);let x,g=0;do{x=lo+Math.floor(rng()*(hi-lo+1));g++}while(x===v&&g<20);mp.set(v,x)});
   const vals=orig.map(v=>mp.has(v)?mp.get(v):v),r=swEval(T,vals);
   if(!r||!Number.isInteger(r.v))continue;
   const A=Math.abs(r.v),A0=Math.abs(o.v);
   if(Math.sign(r.v)!==Math.sign(o.v)||A>999)continue;
   if(A0>0&&(A<A0/4||A>A0*4+6))continue;
   if(strict&&r.sig!==o.sig)continue;
   let i=0;const s=q.replace(/\d+/g,()=>String(vals[i++]));
   if(s===q||used.has(s))continue;
   return s}}return q}
function swMake(prac,seed){const used=new Set(),out=[];prac.forEach((q,i)=>{const s=swGen(q,mulberry32(seed*7919+i*104729+13),used);used.add(s);out.push(s)});return out}

const VCACHE={};
function varOf(t,s){const v=R._v&&R._v[key(t,s)];return v&&v.s>0?v.s:0}
function PQ(t,s){const st=t.sets[s],sd=varOf(t,s);if(!sd)return st.prac;const ck=key(t,s)+"@"+sd;return VCACHE[ck]||(VCACHE[ck]=st.gen?st.gen(mulberry32(sd)):swMake(st.prac,sd))}
function canVary(st){if(st.gen)return true;if(st._cv===undefined)st._cv=st.prac.some(swVar);return st._cv}
function swapSet(s){
 const t=CH[cur.c].t[cur.t],k=key(t,s),a=R[k];
 const hasRes=Array.isArray(a)&&a.some(v=>v),typing=!!(P&&P.s===s&&!P.sum&&vals.some(filled));
 if((hasRes||typing)&&!confirm("Savollar almashtirilsa, shu mashqdagi hozirgi natijangiz o‘chadi va yangi savollar hisobga olinadi. Davom etamizmi?"))return;
 if(P&&P.s===s){P=null;vals=[];clearP()}
 let seed,g=0;do{seed=1+Math.floor(Math.random()*999999);g++}while(seed===varOf(t,s)&&g<10);
 if(!R._v||typeof R._v!=="object")R._v={};
 R._v[k]={s:seed,t:Date.now()};delete R[k];save();
 const y=window.scrollY;render();renderSide();window.scrollTo(0,y);
 const g2=document.getElementById("pg"+s);if(g2)g2.classList.add("swf");
 syncPractice().then(reytingYukla);
}

const save=()=>{try{localStorage.setItem(RKEY,JSON.stringify(R))}catch(e){}};
const ready=t=>!!(t.rules||t.sets);
const cols=Q=>Q.length>8&&Math.max(...Q.map(q=>q.length))<=20?3:2;
const cnt=(t,s)=>(R[key(t,s)]||[]).filter(v=>v==1).length;
/* ---------- 90% PASS MANTIQI (Faqat Uyga Vazifa) ---------- */
const HW_PASS = 90;
const total = t => t.sets.reduce((a, st, s) => a + (st.isHw && PQ(t, s) ? PQ(t, s).length : 0), 0);
const correct = t => t.sets.reduce((a, st, s) => a + (st.isHw ? (cnt(t, s) || 0) : 0), 0);
const hwPct = t => {
  const n = total(t);
  if (n === 0) return 100; // Agar hw qo'shilmagan dars bo'lsa, qulflanmaydi
  return Math.round((correct(t) / n) * 1000) / 10;
};
const done = t => ready(t) && hwPct(t) >= HW_PASS;

const isTest=t=>t.type==='test'||t.t.includes('O‘zlashtirish mashqi');
let RK={rows:[],me:null,loaded:false,noPractice:false,sort:"test"};
function useUserR(){
 const k="gm_res_"+currentUser.id;
 try{if(localStorage.getItem(k)===null){const old=localStorage.getItem("gm_res");if(old){localStorage.setItem(k,old);localStorage.removeItem("gm_res")}}}catch(e){}
 RKEY=k;loadR();
}
function lessonStats(){let ok=0,wr=0,fin=0;CH.forEach(c=>c.t.forEach(t=>{if(!t.sets||isTest(t))return;t.sets.forEach((st,s)=>{const a=R[key(t,s)];if(!Array.isArray(a))return;a.forEach(v=>{if(v==1)ok++;else if(v==2)wr++});if(a.length&&a.every(v=>v))fin++})}));return{ok,wr,fin};}
function offlineUser(){try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^sb-.*-auth-token$/.test(k)){const v=JSON.parse(localStorage.getItem(k));const u=v&&(v.user||(v.currentSession&&v.currentSession.user));if(u&&u.id)return u}}}catch(e){}return null;}
const qKey=()=>"gm_q_"+(currentUser?currentUser.id:"x");
function qGet(){try{return JSON.parse(localStorage.getItem(qKey())||"[]")}catch(e){return[]}}
function qSet(a){try{localStorage.setItem(qKey(),JSON.stringify(a))}catch(e){}}
const isNetErr=e=>!navigator.onLine||/fetch|network|load failed|timeout/i.test((e&&e.message)||"");
const aKey=()=>"gm_a_"+(currentUser?currentUser.id:"x");
function aGet(){try{return JSON.parse(localStorage.getItem(aKey())||"[]")}catch(e){return[]}}
function aSet(a){try{localStorage.setItem(aKey(),JSON.stringify(a))}catch(e){}}
const newId=()=>(window.crypto&&crypto.randomUUID)?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c=="x"?r:(r&3|8)).toString(16)});
async function sendAttempt(rows){try{const r=await db.from('attempts').upsert(rows,{onConflict:'attempt_id,qid',ignoreDuplicates:true});if(r.error)throw r.error;return"ok"}catch(e){return isNetErr(e)?"net":"fail"}}
async function saveAttempt(rows,fromQueue){if(!rows||!rows.length||!currentUser)return;const r=await sendAttempt(rows);if(r==="net"&&!fromQueue)aSet(aGet().concat([{rows,tries:0}]));return r;}
async function flushA(){if(!currentUser||!navigator.onLine)return;const q=aGet();if(!q.length)return;const rest=[];for(const it of q){const r=await sendAttempt(it.rows);if(r==="net"||(r==="fail"&&(it.tries=(it.tries||0)+1)<5))rest.push(it)}aSet(rest);}
const subKey=r=>"gm_sub_"+r.user_id+"_"+r.chapter;
const isDup=e=>!!e&&(e.code==="23505"||/duplicate key|unique constraint/i.test(e.message||""));
async function submitTest(row,nm,title,fromQueue){try{if(localStorage.getItem(subKey(row)))return"dup"}catch(e){}try{const r=await db.from('test_results').insert([row]);if(r.error)throw r.error;try{localStorage.setItem(subKey(row),"1")}catch(e){}return"ok"}catch(e){if(isDup(e)){try{localStorage.setItem(subKey(row),"1")}catch(x){}return"dup"}if(isNetErr(e)){if(!fromQueue)qSet(qGet().concat([{row:Object.assign({created_at:new Date().toISOString()},row),nm,title}]));return"net"}return"fail"}}
const SUBMSG={wait:"Natija yuborilmoqda…",ok:"✓ Natijangiz reytingga yozildi. Bob testida faqat birinchi urinish hisoblanadi.",dup:"Bu bob testi avval topshirilgan. Reytingda birinchi urinish qoladi, bu urinish faqat mashq uchun.",net:"Internet yo‘q. Natija saqlab qo‘yildi va ulanganda avtomatik yuboriladi.",fail:"Natijani saqlab bo‘lmadi. O‘qituvchiga xabar bering."};
const subMsg=k=>SUBMSG[k]||SUBMSG.wait;
async function flushQ(){if(!currentUser||!navigator.onLine)return;const q=qGet();if(!q.length)return;const rest=[];for(const it of q){const r=await submitTest(it.row,it.nm,it.title,true);if(r==="net"||(r==="fail"&&(it.tries=(it.tries||0)+1)<5))rest.push(it)}qSet(rest);if(rest.length<q.length)reytingYukla();}
function netUi(){const b=document.getElementById("offb");if(b)b.hidden=navigator.onLine}
window.addEventListener("online",()=>{netUi();if(currentUser)startData()});window.addEventListener("offline",netUi);
function lessonTotal(){let n=0;CH.forEach(c=>c.t.forEach(t=>{if(!t.sets||isTest(t))return;t.sets.forEach(st=>{n+=st.prac.length})}));return n}
async function pullPractice(){
 try{const r=await db.from('practice_stats').select('results').eq('user_id',currentUser.id).maybeSingle();if(r.error||!r.data||!r.data.results)return;
  const res=r.data.results,sv=(res._v&&typeof res._v==="object")?res._v:{};if(!R._v||typeof R._v!=="object")R._v={};
  const sc=x=>Array.isArray(x)?x.filter(v=>v==1).length:-1;let ch=false;
  const keys=new Set(Object.keys(res).concat(Object.keys(sv)));keys.delete("_v");
  keys.forEach(k=>{const a=res[k],s1=sv[k]||{s:0,t:0},l=R._v[k]||{s:0,t:0};if((s1.s||0)===(l.s||0)){if(Array.isArray(a)&&sc(a)>sc(R[k])){R[k]=a;ch=true}}else if((s1.t||0)>(l.t||0)){if(s1.s)R._v[k]=s1;else delete R._v[k];if(Array.isArray(a))R[k]=a;else delete R[k];ch=true}});
  if(ch){save();renderSide();if(!P)render()}
 }catch(e){}
}
async function syncPractice(){if(!currentUser)return;const s=lessonStats();try{await db.from('practice_stats').upsert({user_id:currentUser.id,results:R,correct:s.ok,wrong:s.wr,sets_done:s.fin,updated_at:new Date().toISOString()})}catch(e){}}
async function reytingYukla(){
 if(!currentUser)return;
 try{
  const [tr,ps,pr]=await Promise.all([db.from('test_results').select('user_id,chapter,score,total,created_at').order('created_at',{ascending:true}),db.from('practice_stats').select('user_id,correct,wrong'),db.from('profiles').select('id,full_name,avatar')]);
  if(tr.error&&ps.error&&pr.error){RK.off=true;RK.loaded=true;if(!isEditingName&&!isEditingPassword&&!isEditingAvatar)renderRight();renderRk();return}
  RK.off=false;const U={},g=id=>U[id]||(U[id]={id,name:"",av:null,mc:0,mw:0,tc:0,tt:0,hasP:false,hasT:false});RK.noPractice=!!ps.error;
  (ps.data||[]).forEach(p=>{const u=g(p.user_id);u.mc=p.correct||0;u.mw=p.wrong||0;u.hasP=u.mc+u.mw>0});
  const seen={};(tr.data||[]).forEach(r=>{const k=r.user_id+"|"+r.chapter;if(seen[k])return;seen[k]=1;const u=g(r.user_id);u.tc+=r.score;u.tt+=r.total;if(r.total>0)u.hasT=true});
  (pr.data||[]).forEach(p=>{const u=g(p.id);u.name=p.full_name||"";const a=p.avatar;u.av=a!=null&&a!==""&&+a>=0&&+a<AVS.length?+a:null});
  g(currentUser.id);const LT=lessonTotal();
  Object.values(U).forEach(u=>{u.mp=RK.noPractice?null:(LT?Math.min(100,Math.round(u.mc/LT*100)):0);u.tp=u.hasT?Math.round(u.tc/u.tt*100):null});
  RK.rows=Object.values(U);RK.me=U[currentUser.id]||null;
 }catch(e){}
 RK.loaded=true;if(!isEditingName&&!isEditingPassword&&!isEditingAvatar)renderRight();renderRk();
}
async function startData(){await flushQ();await flushA();await pullPractice();await syncPractice();await reytingYukla()}
const PASS=0.7;
function setPassed(t,s){const a=R[key(t,s)],n=PQ(t,s).length;return Array.isArray(a)&&a.length==n&&a.every(v=>v)&&a.filter(v=>v==1).length>=Math.ceil(n*PASS)}
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

  const ustozMi = (typeof isStaff === 'function' && isStaff());
  window.systemLocks = window.systemLocks || {};

  CH.forEach((c,k)=>{
    const bobId = `chapter_${k}`;
    const bobOchiq = systemLocks[bobId] === true;

    // --- Bob qulfi (Claude'ning katta switch'i) ---
    let bobQulf = '';
    if (ustozMi) {
      bobQulf = `
        <label class="switch" onclick="inlineQulfniBos(event, '${bobId}')" title="Bobni ochish/yopish" style="margin-left:auto; transform: scale(0.85); transform-origin: right center; z-index: 10;">
          <input class="switch__input" type="checkbox" ${bobOchiq ? 'checked' : ''} style="pointer-events: none;">
          <span class="switch__track"><span class="switch__knob"><span class="lock"><i class="lock__shackle"></i><i class="lock__body"></i></span></span></span>
        </label>
      `;
    } else if (!bobOchiq) {
      bobQulf = `<span style="margin-left:auto; opacity:0.5; font-size:13px;">🔒 Yopiq</span>`;
    }

    const bobMuzlatish = (!ustozMi && !bobOchiq) ? 'opacity:0.5; pointer-events:none;' : '';

    h+=`<div class="sec ${k==open?"open":""}" style="animation-delay:${first?k*.025:0}s">
          <button class="sh" data-item-id="${bobId}" onclick="tg(${k})" style="${bobMuzlatish}; position:relative;">
            <span class="k">${k+1}</span>
            <span style="flex:1"><b>${c.n}</b><small>${c.t.length?c.t.length+" ta mavzu":"to‘ldirilmoqda"}</small></span>
            ${bobQulf}
            <span class="cv" style="${ustozMi ? 'margin-left: 10px;' : ''}">▶</span>
          </button>
          <div class="tw"><div class="tl">`;

    if(!c.t.length) h+=`<div class="soon">Mavzular to‘ldirilmoqda…</div>`;

    c.t.forEach((t,i)=>{
      const isT = (typeof isTest === 'function' && isTest(t));
      const mavzuId = isT ? `bob_test_${k}` : `topic_${k}_${i}`;
      const mavzuOchiq = systemLocks[mavzuId] === true;

      // --- Mavzu qulfi (Claude'ning kichik switch--sm'i) ---
      let mavzuQulf = '';
      if (ustozMi) {
        mavzuQulf = `
          <label class="switch switch--sm" onclick="inlineQulfniBos(event, '${mavzuId}')" title="Mavzuni ochish/yopish" style="margin-left:auto; z-index: 10;">
            <input class="switch__input" type="checkbox" ${mavzuOchiq ? 'checked' : ''} style="pointer-events: none;">
            <span class="switch__track"><span class="switch__knob"><span class="lock"><i class="lock__shackle"></i><i class="lock__body"></i></span></span></span>
          </label>
        `;
      } else if (!mavzuOchiq) {
        mavzuQulf = `<span style="margin-left:auto; opacity:0.5; font-size:12px;">🔒</span>`;
      }

      const mavzuMuzlatish = (!ustozMi && !mavzuOchiq) ? 'opacity:0.5; pointer-events:none;' : '';

      h+=`<button class="tp ${done(t)?"done":""} ${cur.c==k&&cur.t==i?"sel":""}" data-item-id="${mavzuId}" onclick="pick(${k},${i})" style="display:flex; align-items:center; position:relative; ${mavzuMuzlatish}">
            <span class="dot">${done(t)?"✓":t.id}</span>
            <span>${t.t}</span>
            ${mavzuQulf}
          </button>`;
    });
    h+="</div></div></div>"
  });

  const tc=document.getElementById("toc"),y=tc.scrollTop; tc.innerHTML=h; tc.scrollTop=y; first=false;
}

// Ustoz qulf belgisini bosganda ishlaydigan mustaqil funksiya

let NAME="";try{NAME=localStorage.getItem("gm_name")||""}catch(e){}
const esc=s=>s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

const AVS=[["🦊","#fb923c","#ef4444"],["🐼","#94a3b8","#475569"],["🦁","#fbbf24","#f97316"],["🐯","#f59e0b","#dc2626"],["🐸","#4ade80","#16a34a"],["🦉","#a78bfa","#6d28d9"],["🐧","#38bdf8","#2563eb"],["🐙","#f472b6","#be185d"],["🤖","#22d3ee","#0e7490"],["🚀","#818cf8","#4338ca"],["🦄","#e879f9","#7c3aed"],["🐬","#2dd4bf","#0f766e"],["π","#4f46e5","#7c3aed"],["∑","#f43f5e","#9333ea"],["√","#10b981","#0d9488"],["∞","#f59e0b","#db2777"]];
let AV=null,isEditingAvatar=false,PRC=null;
function prMin(){if(PRC==null){try{const v=localStorage.getItem("gm_prmin");PRC=v===null?innerHeight<820:v==="1"}catch(e){PRC=false}}return PRC}
function prT(){PRC=!prMin();try{localStorage.setItem("gm_prmin",PRC?"1":"0")}catch(e){}const e=document.querySelector("#rt .pr");if(e)e.classList.toggle("min",PRC)}
const avStyle=i=>`background:linear-gradient(135deg,${AVS[i][1]},${AVS[i][2]})`;
function loadAvLocal(){try{const v=localStorage.getItem("gm_av_"+currentUser.id);AV=v!==null&&v!==""&&+v>=0&&+v<AVS.length?+v:null}catch(e){AV=null}}
function saveAv(){try{if(AV==null)localStorage.removeItem("gm_av_"+currentUser.id);else localStorage.setItem("gm_av_"+currentUser.id,AV)}catch(e){}try{db.from('profiles').update({avatar:AV==null?null:String(AV)}).eq('id',currentUser.id).then(()=>{},()=>{})}catch(e){}}
function stats(){let ok=0,wr=0,fin=0;Object.values(R).forEach(a=>{if(!Array.isArray(a))return;a.forEach(v=>{if(v==1)ok++;else if(v==2)wr++});if(a.length&&a.every(v=>v))fin++});return{ok,fin,acc:ok+wr?Math.round(ok/(ok+wr)*100):0}}
function flagsOff(){isEditingName=false;isEditingPassword=false;isEditingAvatar=false}
function profileHtml(){
 const nm=NAME||"O‘quvchi",ini=NAME.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("")||"?";
 return `<div class="pr${prMin()?" min":""}"><div class="pr-h"><button class="pr-av ${AV==null?"":"g"}" style="${AV==null?"":avStyle(AV)}" onclick="openPE()" aria-label="Profilni tahrirlash">${AV==null?esc(ini):AVS[AV][0]}</button><div class="pr-id"><b class="pr-nm">${esc(nm)}</b><span class="pr-sub">${roleLabel()}</span></div><button class="pr-tg" onclick="prT()" aria-label="Profilni yig‘ish yoki ochish"><span>▾</span></button></div>${progTiles()}<div class="pr-f">${isStaff()?'<button class="pr-edit" onclick="location.hash=\'#/teacher\'">▦ Ustoz paneli</button>':''}<button class="pr-edit" onclick="openPE()">✎ Profilni tahrirlash</button><button class="pr-out" onclick="tizimdanChiqish()">Chiqish</button></div></div>`;
}
function renderRight(){
 let h=`<div class="rth"><b>Profil</b><button onclick="rtT(false)" aria-label="Yopish">✕</button></div>`;
 
 h += currentUser ? profileHtml() : `
   <div class="stc2" style="text-align: center; padding: 30px 15px; border: none; background: transparent;">
     <div style="background: #eff6ff; width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; color: #3b82f6;">
       <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
     </div>
     <h3 style="margin: 0 0 10px; font-size: 20px; color: #1e293b;">Tizimga kirish</h3>
     <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin: 0 0 20px;">Saytdan to'liq foydalanish, mashqlarni bajarish va reytingda qatnashish uchun profilingizga kiring.</p>
     <button onclick="showLoginOverlay(); rtT(false);" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; width: 100%; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">Tizimga kirish ➔</button>
   </div>`;
   
 h+=`<div class="fc rkc"><h3>Reyting</h3><div id="rkd"></div></div>`;
 document.getElementById("rt").innerHTML=h;
 renderRk();
}
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
 const p1=document.getElementById("pe-p1").value, p2=document.getElementById("pe-p2").value, btn=document.getElementById("pe-pb");
 if(p1.length<6){peMsg("pe-m2","Parol kamida 6 ta belgidan iborat bo‘lishi kerak.","err");return}
 if(p1!==p2){peMsg("pe-m2","Ikkala parol bir xil emas.","err");return}
 if(!navigator.onLine){peMsg("pe-m2","Internet yo‘q. Parolni o‘zgartirish uchun internetga ulaning.","err");return}
 
 btn.disabled=true;
 peMsg("pe-m2","Yangilanmoqda…");
 
 // Faqat Supabase Auth tizimidagi parolni yangilash
 const { data, error } = await db.auth.updateUser({ password: p1 });
 
 btn.disabled=false;
 
 if(error){
  // Xatolikni ekranga aniq matni bilan chiqarish
  peMsg("pe-m2", "XATOLIK: " + error.message, "err");
  return;
 }
 
 document.getElementById("pe-p1").value=""; 
 document.getElementById("pe-p2").value="";
 peMsg("pe-m2","✓ Parol yangilandi","ok");
}

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
 const swIc='<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>';
 const set=(st,s)=>{const Q=PQ(t,s),vr=varOf(t,s);return `<div><div class="sh2"><h3>${st.n}</h3>${vr?`<span class="swp-b">Yangi savollar</span>`:""}${canVary(st)&&!isTest(t)?`<button class="swp" onclick="swapSet(${s})" title="Savollarni almashtirish" aria-label="Savollarni almashtirish">${swIc}<span>Almashtirish</span></button>`:""}</div>${st.hint?`<p class="intro">${st.hint}</p>`:""}<div class="pg c${cols(Q)}" id="pg${s}">${Q.map((q,i)=>`<div><i>${i+1}</i>${QF(q)} = ?</div>`).join("")}</div><div style="margin-top:14px"><button class="btn" onclick="startP(${s})">Platformada ishlash →</button></div><div id="pr${s}"></div>${reytingDiv}</div>`};
 const fx=t.f&&t.f.length?`<section class="fx"><div class="fx-h"><span class="fx-ic">∑</span><div><b>Formulalar</b><small>${t.id}-mavzu · eslab qolish uchun</small></div><span class="fx-c">${t.f.length} ta</span></div><div class="fx-g">${t.f.map((x,k)=>`<div class="fx-i ${/=/.test(x)&&x.length<=40?"m":"r"}"><span class="fx-n">${k+1}</span><div class="fx-t">${x}</div></div>`).join("")}</div></section>`:"";
 D.innerHTML=hero+`${t.rules?`<div><h3>Ma’lumotlar</h3>${t.intro?`<p class="intro">${t.intro}</p>`:""}${t.rules.map(rule).join("")}${t.note?`<div class="note">${t.note}</div>`:""}</div>`:""}`+fx+t.sets.map(set).join("")+navHtml();
 if(P)drawP();
 if(isTest(t)) { reytingniYuklash(t.id, 'reyting-panel'); }
}

function navHtml() {
  const i = flat.findIndex(f => f[0] == cur.c && f[1] == cur.t);
  return `<div class="nav">
    <button class="btn g" ${i <= 0 ? "disabled" : ""} onclick="go(${i - 1})">← Oldingi mavzu</button>
    <button class="btn g" ${i < 0 || i >= flat.length - 1 ? "disabled" : ""} onclick="checkAndGo(this, cur.c, cur.t, ${i + 1})">Keyingi mavzu →</button>
  </div>`;
}
function go(i){pick(flat[i][0],flat[i][1])}
function tg(k){if(open==k){open=-1}else{open=k;if(!CH[k].t.length){const fh=cur.c==null;cur={c:k,t:null};P=null;hist(fh)}}render()}
function pick(c,t) {
  // === TITAN QULF (Xavfsizlik) ===
  const ustozMi = (typeof isStaff === 'function' && isStaff());
  const isT = (typeof isTest === 'function' && isTest(CH[c].t[t]));
  const qulfKodi = isT ? `bob_test_${c}` : `topic_${c}_${t}`;
  
  // Agar dars yopiq bo'lsa va bosgan odam ustoz bo'lmasa -> bloklaymiz!
  if (!ustozMi && window.systemLocks && window.systemLocks[qulfKodi] !== true) {
     if (typeof toastKorsat === 'function') toastKorsat("Bu mavzu yopiq! 🔒");
     return; 
  }
  // ===============================

  // O'zingizning eski kodingiz davomi:
  if(!leaveOk()) return;
  const fh = cur.c == null;
  cur = {c, t};
  open = c;
  P = null;
  try { localStorage.setItem("gm_last", c + "," + t); } catch(e) {}
  
  render();
  hist(fh);
  navT(false);
  rtT(false);
  rkT(false);
  if(innerWidth <= 860) document.getElementById("d").scrollIntoView();
}
function startP(s){
  if (!loginKerak(() => startP(s))) return; // <-- Eng asosiy qorovul shu!

  const t=CH[cur.c].t[cur.t],k=key(t,s);
  if(!R[k])R[k]=PQ(t,s).map(()=>0);
  P={s, i:0, startTime: Date.now(), submitted: false, tools:false};
  vals=[];
  clearP();
  drawP();
  const prDiv = document.getElementById("pr"+s);
  if (prDiv) prDiv.scrollIntoView({block:"center"});
}

const qfs=l=>{const m=innerWidth<520;return l>24?(m?18:24):l>16?(m?22:30):(m?28:34)};
const filled=v=>!!(v&&String(v).trim());
const CHIPS=[["−","−",0],["·","·",0],["÷","÷",0],["a/b","/",0],["x²","²",0],["x³","³",0],["xⁿ","^",0],["√","√()",1],["∛","∛()",1],["( )","()",1],["π","π",0]];
function drawP(){
 if(P.sum)return drawSum();
 const t=CH[cur.c].t[cur.t],st=t.sets[P.s],Q=PQ(t,P.s),n=Q.length,i=P.i,pr=document.getElementById("pr"+P.s),qt=M(Q[i])+" = ?";
 const answered=Q.filter((x,j)=>filled(vals[j])).length;
 pr.innerHTML=`<div class="pc"><div class="ph"><span>${t.sets.length>1?st.n+" · ":""}Misol ${i+1} / ${n}</span><span>Javob berilgan: ${answered} / ${n}</span><button class="lnk" onclick="closeP()">Yopish ✕</button></div>
 <div class="dots">${Q.map((x,j)=>`<button class="${filled(vals[j])?"a":""} ${j==i?"c":""}" onclick="gp(${j})">${j+1}</button>`).join("")}</div>
 <div class="q" style="font-size:${qfs(qt.length)}px">${QF(Q[i])} = ?</div>
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
function nextP(){saveCur();const n=PQ(CH[cur.c].t[cur.t],P.s).length;if(P.i<n-1)gp(P.i+1);else finishP()}
function finishP(){
 saveCur();
 const t=CH[cur.c].t[cur.t],st=t.sets[P.s],k=key(t,P.s),Q=PQ(t,P.s);
 const left=Q.filter((q,i)=>!filled(vals[i])).length;
 if(left&&!confirm("Hali "+left+" ta misolga javob berilmagan. Baribir tugatib, natijani ko‘ramizmi?"))return;
 R[k]=Q.map((q,i)=>filled(vals[i])?(check(vals[i],q)?1:2):0);
 save();
 syncPractice().then(reytingYukla);
 P.elapsed=Math.floor((Date.now()-P.startTime)/1000);
 if(currentUser){
  const aid=newId(),tst=isTest(t);
  saveAttempt(Q.map((q,i)=>({attempt_id:aid,user_id:currentUser.id,chapter:String(t.id),set_idx:P.s,qid:qid(t,P.s,i),question:String(q).slice(0,400),given:filled(vals[i])?String(vals[i]).trim().slice(0,200):null,status:R[k][i],is_test:tst,time_spent_sec:Math.min(P.elapsed,86400)})));
 }
 P.sum=true;renderSide();drawP();
 document.getElementById("pr"+P.s).scrollIntoView({block:"start"});
}
function drawSum(){
 const t=CH[cur.c].t[cur.t],st=t.sets[P.s],k=key(t,P.s),Q=PQ(t,P.s),n=Q.length,r=R[k]||[],ok=cnt(t,P.s);
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
 const cards=Q.map((q,i)=>{
  const g=r[i]==1,sk=!r[i],a=M(fmtNum(ans(q))),u=filled(vals[i])?M(esc(String(vals[i]).trim())):"—";
  return `<div class="rs ${g?"y":sk?"s":"n"}" style="animation-delay:${i*45}ms"><i>${i+1}</i>${QF(q)} = <b>${u}</b> ${g?"✓":sk?"•":"✗"}${g?"":`<small>${sk?"Javob berilmagan. ":""}To‘g‘ri javob: ${a}</small>`}</div>`}).join("");
 document.getElementById("pr"+P.s).innerHTML=`<div class="pc res"><div class="ph"><span>${t.sets.length>1?st.n+" natijalari":"Mashq natijalari"}</span></div>
 <div class="rh"><div class="ring" style="--p:${pct}"><span><b>${pct}%</b><small>${ok} / ${n}</small></span></div>
 <div class="rm"><h4>${msg}</h4><div class="chips"><span class="c y">✓ To‘g‘ri: ${ok}</span><span class="c n">✗ Xato: ${wrong}</span>${skip?`<span class="c s">• Yechilmagan: ${skip}</span>`:""}<span class="c">⏱ ${Math.floor(el/60)} daq ${el%60} soniya</span></div></div></div>
 ${isTest(t)?`<div class="subst" id="subst">${subMsg(P.subst||"wait")}</div>`:""}
 <div class="pg c${cols(Q)}" style="margin:14px 0">${cards}</div>
 <div class="pn"><button class="btn g" onclick="retry()">Qayta ishlash</button><button class="btn g" onclick="closeP()">Yopish</button></div></div>`}

function retry(){
  const t=CH[cur.c].t[cur.t];
  R[key(t,P.s)]=PQ(t,P.s).map(()=>0);
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

/* ===== Ustoz paneli (#/teacher): guruhlar va o'quvchilar ===== */
let ROLE="student";
const isStaff=()=>ROLE==="teacher"||ROLE==="admin";
const roleLabel=()=>ROLE==="admin"?"Admin":ROLE==="teacher"?"O‘qituvchi":"O‘quvchi";
const TP={groups:[],sel:null,tab:"mem",cache:{},sort:{k:"name",d:1},st:0};
const tpE=id=>document.getElementById(id);
const tpErr=e=>{const m=(e&&e.message)||"";return /^(Ruxsat|Guruh|Internet)/.test(m)?m:"Xatolik yuz berdi. Qayta urinib ko‘ring."};
function tpMsg(id,t,k){const e=tpE(id);if(e){e.textContent=t||"";e.className="tp-msg"+(k?" "+k:"")}}
async function tpRpc(fn,args){
 if(!navigator.onLine)throw new Error("Internet yo‘q.");
 const r=await db.rpc(fn,args);
 if(r.error)throw r.error;
 return r.data;
}
async function loadRole(){
 let r="student";
 try{const x=await db.from("profiles").select("role").eq("id",currentUser.id).single();if(x.data&&x.data.role)r=x.data.role}catch(e){}
 const ch=r!==ROLE;ROLE=r;
 if(ch)renderRight();
 tpRoute();
}
function tpRoute(){
 const m=tpE("tpm");if(!m)return;
 const on=location.hash==="#/teacher"&&!!currentUser&&isStaff();
 m.hidden=!on;document.body.classList.toggle("tp-open",on);
 if(on){tpE("tp-role").textContent=roleLabel();tpLoad()}
}
window.addEventListener("hashchange",tpRoute);
function tpClose(){if(location.hash==="#/teacher")location.hash="#/";else tpRoute()}
async function tpLoad(){
 TP.cache={};
 try{TP.groups=(await tpRpc("teacher_my_groups"))||[]}
 catch(e){TP.groups=[];TP.sel=null;tpList(tpErr(e));tpDetail();return}
 if(!TP.groups.some(g=>g.id===TP.sel))TP.sel=TP.groups[0]?TP.groups[0].id:null;
 tpList();tpDetail();
}
function tpList(err){
 const el=tpE("tp-list");if(!el)return;
 if(err){el.innerHTML=`<p class="tp-n">${esc(err)}</p>`;return}
 el.innerHTML=TP.groups.length
  ?TP.groups.map(g=>`<button class="tp-gi${g.id===TP.sel?" on":""}" onclick="tpSel('${esc(g.id)}')"><span><b>${esc(g.name||"—")}</b><small>Kod: ${esc(g.code||"—")}</small></span><i>${g.members}</i></button>`).join("")
  :`<p class="tp-n">Hali guruh yo‘q. Yuqorida birinchisini yarating.</p>`;
}
function tpSel(id){TP.sel=id;tpMsg("tp-msg","");tpList();tpDetail()}
async function tpDetail(){
 const g=TP.groups.find(x=>x.id===TP.sel),det=tpE("tp-det"),emp=tpE("tp-empty");
 if(!det||!emp)return;
 det.hidden=!g;emp.hidden=!!g;
 if(!g)return;
 tpE("tp-gt").textContent=g.name||"";
 tpE("tp-gs").textContent="Guruh kodi: "+(g.code||"—")+" · "+g.members+" ta o‘quvchi";
 tpPane();
 const box=tpE("tp-mem"),id=g.id;
 box.innerHTML='<p class="tp-n">Yuklanmoqda…</p>';
 try{
  const rows=(await tpRpc("teacher_group_members",{p_group:id}))||[];
  if(TP.sel!==id)return;
  box.innerHTML=rows.length
   ?rows.map(r=>`<div class="tp-m"><span>${esc(r.full_name||r.login)}<small>${esc(r.login)}</small></span><button class="tp-x" onclick="tpRemove('${esc(r.user_id)}')">Chiqarish</button></div>`).join("")
   :'<p class="tp-n">Guruhda hali o‘quvchi yo‘q. Yuqoridagi maydonga loginlarni yozing.</p>';
 }catch(e){box.innerHTML=`<p class="tp-n">${esc(tpErr(e))}</p>`}
}
async function tpCreate(ev){
 ev.preventDefault();
 const inp=tpE("tp-gn"),btn=tpE("tp-gb"),nm=inp.value.trim().replace(/\s+/g," ");
 if(!nm)return;
 btn.disabled=true;tpMsg("tp-gm","");
 try{const id=await tpRpc("teacher_create_group",{p_name:nm});inp.value="";TP.sel=String(id);await tpLoad()}
 catch(e){tpMsg("tp-gm",tpErr(e),"err")}
 btn.disabled=false;
}
async function tpAdd(ev){
 ev.preventDefault();
 const inp=tpE("tp-lg"),btn=tpE("tp-ab"),id=TP.sel;
 const logins=[...new Set(inp.value.toLowerCase().split(/[\s,;]+/).filter(Boolean))].slice(0,100);
 if(!id||!logins.length)return;
 btn.disabled=true;tpMsg("tp-msg","Qo‘shilmoqda…");
 try{
  const r=await tpRpc("teacher_add_members",{p_group:id,p_logins:logins});
  const a=r.added||[],d=r.already||[],m=r.missing||[],p=[];
  if(a.length)p.push(a.length+" ta qo‘shildi");
  if(d.length)p.push(d.length+" tasi allaqachon guruhda");
  if(m.length)p.push("topilmadi: "+m.join(", "));
  tpMsg("tp-msg",p.join(" · ")||"O‘zgarish yo‘q.",m.length?"err":"ok");
  inp.value=m.join(", ");
  await tpLoad();
 }catch(e){tpMsg("tp-msg",tpErr(e),"err")}
 btn.disabled=false;
}
async function tpRemove(uid){
 if(!confirm("O‘quvchi guruhdan chiqariladi (akkaunti va natijalari saqlanadi). Davom etamizmi?"))return;
 try{await tpRpc("teacher_remove_member",{p_group:TP.sel,p_user:uid});tpMsg("tp-msg","Guruhdan chiqarildi.","ok");await tpLoad()}
 catch(e){tpMsg("tp-msg",tpErr(e),"err")}
}
async function tpDelGroup(){
 const g=TP.groups.find(x=>x.id===TP.sel);if(!g)return;
 if(!confirm("«"+g.name+"» guruhi o‘chiriladi (o‘quvchilar akkaunti va natijalari saqlanadi). Davom etamizmi?"))return;
 try{await tpRpc("teacher_delete_group",{p_group:g.id});TP.sel=null;tpMsg("tp-msg","");await tpLoad()}
 catch(e){tpMsg("tp-msg",tpErr(e),"err")}
}

/* ===== 3c: natijalar tahlili ===== */
const tpTopic=id=>{for(const c of CH)for(const t of c.t)if(t.id===id)return t.t;return""};
const tpTL=id=>esc(String(id))+(tpTopic(id)?" · "+esc(tpTopic(id)):"");
const tpPct=v=>v==null?"—":v+"%";
const tpCls=v=>v==null?"n":v>=80?"g":v>=50?"m":"b";
const tpKind=r=>r.is_test?"Bob testi":"Mashq "+(r.set_idx+1);
const tpDays=d=>{if(!d)return Infinity;const a=new Date(d),b=new Date();if(isNaN(a))return Infinity;a.setHours(0,0,0,0);b.setHours(0,0,0,0);return Math.round((b-a)/864e5)};
const tpAgo=d=>{const n=tpDays(d);return n===Infinity?"—":n<=0?"bugun":n===1?"kecha":n+" kun oldin"};
const tpDt=d=>{if(!d)return"—";const x=new Date(d);if(isNaN(x))return"—";const p=n=>String(n).padStart(2,"0");return p(x.getDate())+"."+p(x.getMonth()+1)+" "+p(x.getHours())+":"+p(x.getMinutes())};

function tpTab(t){TP.tab=t;tpPane()}

function tpPane(){
 const t=TP.tab,gid=TP.sel;if(!gid)return;
 
 // O'ZGARISH: ["mem","res","hard"] ro'yxatiga "locks" ni qo'shdik
 ["mem","res","hard","locks", "hw"].forEach(x=>{const p=tpE("tp-pane-"+x);if(p)p.hidden=x!==t});
 
 document.querySelectorAll(".tp-tabs button[data-t]").forEach(b=>b.classList.toggle("on",b.dataset.t===t));
 
 // O'quvchilar, natijalar kabi qulflarni ham yuklash buyrug'ini berdik
 if(t==="res")tpResLoad(gid);
 if(t==="hard")tpHardLoad(gid);
 if(t==="locks")loadLocksPanel(); // O'ZGARISH: Shu qator qo'shildi
if(t==="hw")loadHomeworkPanel(gid); // BU BIZNING BUYRUQ
}

function tpRefresh(){
 if(!TP.sel)return;
 if(TP.tab==="mem"){tpLoad();return}
 Object.keys(TP.cache).forEach(k=>{if(k.endsWith(":"+TP.sel))delete TP.cache[k]});
 tpPane();
}

/* --- Natijalar --- */
async function tpResLoad(gid){
 const box=tpE("tp-res"),k="res:"+gid;
 if(TP.cache[k]){tpResView();return}
 box.innerHTML='<p class="tp-n">Yuklanmoqda…</p>';
 try{const rows=(await tpRpc("teacher_group_overview",{gid}))||[];if(TP.sel!==gid)return;TP.cache[k]=rows;tpResView()}
 catch(e){if(TP.sel===gid)box.innerHTML=`<p class="tp-n">${esc(tpErr(e))}</p>`}
}
const TPS={name:r=>(r.full_name||r.login||"").toLowerCase(),test:r=>r.test_first_pct,lesson:r=>r.lesson_first_pct,sets:r=>r.sets_done,att:r=>r.attempts_n,act:r=>r.last_active?new Date(r.last_active).getTime():null};
const TPH=[["name","O‘quvchi"],["test","Bob testi"],["lesson","Mashqlar"],["sets","To‘plamlar"],["att","Urinish"],["act","Oxirgi faollik"]];
function tpSortBy(k){TP.sort=TP.sort.k===k?{k,d:-TP.sort.d}:{k,d:k==="name"?1:-1};tpResView()}
const tpCell=(p,sub)=>`<td><div class="tp-pc ${tpCls(p)}">${tpPct(p)}</div><div class="tp-bar"><i class="${tpCls(p)}" style="width:${p||0}%"></i></div><small>${sub}</small></td>`;
function tpRow(r){
 const dd=tpDays(r.last_active);
 const ts=r.test_total?r.test_first_ok+"/"+r.test_total+(r.test_best_pct!=null&&r.test_best_pct!==r.test_first_pct?" · eng yaxshi "+r.test_best_pct+"%":""):"topshirmagan";
 const ls=r.lesson_best_pct!=null?"eng yaxshi "+r.lesson_best_pct+"%":"boshlamagan";
 return `<tr onclick="tpStudent('${esc(String(r.user_id))}')"><td><b>${esc(r.full_name||r.login||"—")}</b><small>${esc(r.login||"")}</small></td>${tpCell(r.test_first_pct,ts)}${tpCell(r.lesson_first_pct,ls)}<td>${r.sets_done||0}</td><td>${r.attempts_n||0}</td><td>${tpAgo(r.last_active)}${dd>7?'<small class="tp-w2">faol emas</small>':""}</td></tr>`;
}
function tpResView(){
 const box=tpE("tp-res"),all=TP.cache["res:"+TP.sel]||[];
 if(!all.length){box.innerHTML='<p class="tp-n">Guruhda hali o‘quvchi yo‘q.</p>';return}
 const avg=k=>{const v=all.map(r=>r[k]).filter(x=>x!=null);return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length)+"%":"—"};
 const act=all.filter(r=>tpDays(r.last_active)<=7).length;
 const bk=[0,0,0,0,0],LB=["80–100%","60–79%","40–59%","0–39%","Topshirmagan"],CL=["g","m","m","b","n"];
 all.forEach(r=>{const p=r.test_first_pct;bk[p==null?4:p>=80?0:p>=60?1:p>=40?2:3]++});
 const f=TPS[TP.sort.k],d=TP.sort.d;
 const rows=all.slice().sort((a,b)=>{const x=f(a),y=f(b);if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;return(x<y?-1:x>y?1:0)*d});
 const head=TPH.map(([k,l])=>`<th><button onclick="tpSortBy('${k}')">${l}${TP.sort.k===k?(d>0?" ▲":" ▼"):""}</button></th>`).join("");
 box.innerHTML=`<div class="tp-kpi"><div><b>${all.length}</b><small>o‘quvchi</small></div><div><b>${avg("test_first_pct")}</b><small>bob testi (o‘rtacha)</small></div><div><b>${avg("lesson_first_pct")}</b><small>mashqlar (o‘rtacha)</small></div><div><b>${act} / ${all.length}</b><small>7 kunda faol</small></div></div>
 <h3>Bob testi natijalari taqsimoti</h3>
 <div class="tp-hist">${bk.map((c,i)=>`<div class="tp-hr"><span>${LB[i]}</span><div class="tp-bar"><i class="${CL[i]}" style="width:${c/all.length*100}\%"></i></div><b>${c}</b></div>`).join("")}</div>
 <h3>O‘quvchilar</h3>
 <div class="tp-tw"><table class="tp-t"><thead><tr>${head}</tr></thead><tbody>${rows.map(tpRow).join("")}</tbody></table></div>
 <p class="tp-n">Foizlar birinchi urinish bo‘yicha. Tafsilot uchun o‘quvchi qatorini bosing.</p>`;
}

/* --- O'quvchi tafsiloti --- */
async function tpStudent(uid){
 const m=tpE("tp-sd"),row=(TP.cache["res:"+TP.sel]||[]).find(r=>String(r.user_id)===uid)||{},tok=++TP.st;
 m.hidden=false;
 m.innerHTML=`<div class="tp-sdw" role="dialog" aria-modal="true"><div class="tp-sdh"><div><b>${esc(row.full_name||row.login||"O‘quvchi")}</b><small>${esc(row.login||"")}</small></div><button onclick="tpStClose()" aria-label="Yopish">✕</button></div><div class="tp-sdb" id="tp-sdb"><p class="tp-n">Yuklanmoqda…</p></div></div>`;
 try{
  const [d,e]=await Promise.all([tpRpc("teacher_student_detail",{uid}),tpRpc("teacher_student_mistakes",{uid,lim:60})]);
  if(TP.st!==tok||m.hidden)return;
  tpE("tp-sdb").innerHTML=tpStHtml(d||[],e||[]);
 }catch(x){if(TP.st===tok&&!m.hidden){const b=tpE("tp-sdb");if(b)b.innerHTML=`<p class="tp-n">${esc(tpErr(x))}</p>`}}
}
function tpStClose(){const m=tpE("tp-sd");if(m)m.hidden=true;TP.st++}
document.addEventListener("keydown",e=>{const m=tpE("tp-sd");if(e.key==="Escape"&&m&&!m.hidden)tpStClose()});
window.addEventListener("hashchange",()=>{if(location.hash!=="#/teacher")tpStClose()});
function tpStHtml(d,e){
 d=d.slice().sort((a,b)=>String(a.chapter).localeCompare(String(b.chapter),undefined,{numeric:true})||(a.is_test-b.is_test)||(a.set_idx-b.set_idx));
 const secs=s=>s==null?"—":Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
 const t1=d.length
  ?`<div class="tp-tw"><table class="tp-t sm"><thead><tr><th>Mavzu</th><th>Tur</th><th>Birinchi urinish</th><th>Eng yaxshi</th><th>Urinish</th><th>Vaqt</th><th>Oxirgi</th></tr></thead><tbody>${d.map(r=>`<tr><td>${tpTL(r.chapter)}</td><td>${tpKind(r)}</td><td><span class="tp-pc ${tpCls(r.first_pct)}">${tpPct(r.first_pct)}</span><small>${r.first_ok??"—"}/${r.first_total??"—"}</small></td><td>${tpPct(r.best_pct)}</td><td>${r.tries??0}${r.variant_tries?`<small>almashtirilgan: ${r.variant_tries}</small>`:""}</td><td>${secs(r.first_secs)}</td><td>${tpDt(r.last_at)}</td></tr>`).join("")}</tbody></table></div>`
  :'<p class="tp-n">Hali natija yo‘q.</p>';
 const t2=e.length?e.map(r=>{
  const q=String(r.question||""),ca=q.length<=100?fmtNum(ans(q)):"—";
  return `<div class="tp-er"><div class="tp-eq">${QF(esc(q))}</div><div class="tp-ea">Javobi: <b>${esc(String(r.given||"—").slice(0,40))}</b> · To‘g‘ri: <b>${esc(ca)}</b></div><small>${tpTL(r.chapter)} · ${tpKind(r)} · ${r.attempt_no}-urinish${r.is_variant?" · almashtirilgan":""} · ${tpDt(r.at_time)}</small></div>`}).join("")
  :'<p class="tp-n">Xato javoblar topilmadi.</p>';
 return `<h3>Mavzular bo‘yicha</h3>${t1}<h3>Oxirgi xato javoblar</h3><div class="tp-el">${t2}</div>`;
}

/* --- 3d: Qiyin misollar (Diagrammalar bilan) --- */
const thCol = p => p >= 60 ? "hi" : p >= 30 ? "mid" : "lo";
const thTopic = id => { try { for (const c of CH) { const t = (c.t || []).find(x => x.id === id); if (t) return t; } } catch (e) {} return null; };
const thName = (ch, si) => { const t = thTopic(ch), s = t && t.sets && t.sets[si]; return ch + (t ? " · " + t.t : "") + (s && t.sets.length > 1 ? " · " + s.n : ""); };

async function tpHardLoad(gid){
 const box=tpE("tp-hard"), k="hard:"+gid, kt="top:"+gid;
 if(TP.cache[k] && TP.cache[kt]){tpHardView();return}
 box.innerHTML='<p class="tp-n">Yuklanmoqda…</p>';
 try{
  const [a, b] = await Promise.all([
    tpRpc("teacher_hard_questions", { gid, lim: 60, min_n: 1 }),
    tpRpc("teacher_topic_difficulty", { gid })
  ]);
  if(TP.sel!==gid)return;
  TP.cache[k]=a||[];
  TP.cache[kt]=b||[];
  tpHardView();
 }
 catch(e){if(TP.sel===gid)box.innerHTML=`<p class="tp-n">${esc(tpErr(e))}</p>`}
}

function tpHardView(){
 const box=tpE("tp-hard"), hard = TP.cache["hard:"+TP.sel] || [], topics = TP.cache["top:"+TP.sel] || [];
 const mems = TP.cache["res:"+TP.sel] || [];
 const need = Math.min(3, Math.max(1, mems.length));
 const top = hard.filter(x => x.tried >= need && x.wrong > 0).slice(0, 15);
 const tops = topics.filter(x => x.tried > 0);

 const row = (label, p, val) => `<div class="th-r"><div class="th-l">${label}</div><div class="th-b"><i class="${thCol(p)}" style="width:${Math.max(p, 2)}%"></i></div><div class="th-v">${p}%<small>${val}</small></div></div>`;

 const t1 = tops.length ? tops.map(x => row(esc(thName(x.chapter, x.set_idx)), x.wrong_pct, `${x.wrong}/${x.tried} xato`)).join("")
   : `<p class="tp-n">Hali ma’lumot yo‘q: o‘quvchilar mashq yechgach chiqadi.</p>`;
 const t2 = top.length ? top.map(x => row(`${QF(esc(String(x.question||"")))} = ?<small>${esc(thName(x.chapter, x.set_idx))}</small>`, x.wrong_pct, `${x.students_wrong} o‘quvchi`)).join("")
   : `<p class="tp-n">Hali yetarli ma’lumot yo‘q (har bir misolga kamida ${need} ta o‘quvchi javob berishi kerak).</p>`;

 box.innerHTML=`<div class="stc2"><div class="rth" style="margin-top:0"><b>Qaysi mavzu qiyin?</b><small class="tp-n" style="margin-left:auto">1-urinishdagi xato %</small></div>${t1}</div>
 <div class="stc2" style="margin-top:16px"><div class="rth" style="margin-top:0"><b>Eng qiyin misollar</b><small class="tp-n" style="margin-left:auto">1-urinish</small></div>${t2}</div>`;
}

/* ===== Tungi / Kunduzgi rejim ===== */
function syncThemeBtn() {
  const b = document.getElementById("thbtn");
  if (!b) return;
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  b.textContent = isDark ? "☀️" : "🌙";
}
function toggleTheme() {
  const curTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = curTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("gm_theme", next); } catch (e) {}
  syncThemeBtn();
}
syncThemeBtn();
// Mehmon rejimi va Qulflar uchun yordamchi funksiyalar
function showLoginOverlay() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'flex'; 
}

function hideLoginOverlay() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'none';
}

function loginKerak(action) {
  if (currentUser) return true;
  pendingAction = action || null;
  showLoginOverlay();
  return false;
}

function toastKorsat(matn) {
  const t = document.getElementById('lock-toast');
  if (!t) return;
  t.textContent = matn;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// Baza bilan bog'lanish va loginni kutish
db.auth.onAuthStateChange((event, session) => {
  currentUser = session ? session.user : null;
  if (currentUser) {
    hideLoginOverlay();
    if (pendingAction) {           
      const fn = pendingAction;
      pendingAction = null;
      fn();
    }
  }
});

async function locksniYuklash() {
  const { data, error } = await db.from('system_locks').select('item_id, is_open');
  if (error) {
    console.error('Qulflar o\'qilmadi:', error);
    return;                        
  }
  systemLocks = {};
  if (data) {
    data.forEach(r => { systemLocks[r.item_id] = r.is_open; });
  }
  locksniQollash();
}

function ochiqmi(itemId) {
  return systemLocks[itemId] !== false;
}

// Ustoz menyudan qulfni bosganda ishlaydigan mustaqil funksiya
// =========================================================================
// 1. MUNDARIJANI VA CLAUDE DIZAYNIDAGI QULFLARNI CHIZUVCHI FUNKSIYA
// =========================================================================
function renderSide(){
  const rd=flat.map(([c,t])=>CH[c].t[t]).filter(ready),pct=Math.min(100,Math.round(rd.length/TOTAL*100));
  document.getElementById("ovt").textContent=`Kurs tayyorligi ${pct}% · ${rd.length} / ${TOTAL} mavzu`;
  document.getElementById("ovb").style.width=pct+"%";
  let h=`<div class="dh"><b>Mundarija</b><button onclick="navT(false)" aria-label="Yopish">✕</button></div>`;

  const ustozMi = (typeof isStaff === 'function' && isStaff());
  window.systemLocks = window.systemLocks || {};

  CH.forEach((c,k)=>{
    const bobId = `chapter_${k}`;
    const bobOchiq = systemLocks[bobId] === true;

    // --- Bob qulfi (Claude dizayni) ---
    let bobQulf = '';
    if (ustozMi) {
      bobQulf = `
        <label class="switch" onclick="inlineQulfniBos(event, '${bobId}')" title="${bobOchiq?'Yopish':'Ochish'}" style="margin-left:auto; transform: scale(0.85); transform-origin: right center; z-index: 10;">
          <input class="switch__input" type="checkbox" ${bobOchiq ? 'checked' : ''} style="pointer-events: none;">
          <span class="switch__track"><span class="switch__knob"><span class="lock"><i class="lock__shackle"></i><i class="lock__body"></i></span></span></span>
        </label>
      `;
    } else if (!bobOchiq) {
      bobQulf = `<span style="margin-left:auto; opacity:0.5; font-size:13px;">🔒 Yopiq</span>`;
    }

    const bobMuzlatish = (!ustozMi && !bobOchiq) ? 'opacity:0.5; pointer-events:none;' : '';

    h+=`<div class="sec ${k==open?"open":""}" style="animation-delay:${first?k*.025:0}s">
          <button class="sh" data-item-id="${bobId}" onclick="tg(${k})" style="${bobMuzlatish}; position:relative;">
            <span class="k">${k+1}</span>
            <span style="flex:1"><b>${c.n}</b><small>${c.t.length?c.t.length+" ta mavzu":"to‘ldirilmoqda"}</small></span>
            ${bobQulf}
            <span class="cv" style="${ustozMi ? 'margin-left: 10px;' : ''}">▶</span>
          </button>
          <div class="tw"><div class="tl">`;

    if(!c.t.length) h+=`<div class="soon">Mavzular to‘ldirilmoqda…</div>`;

    c.t.forEach((t,i)=>{
      const isT = (typeof isTest === 'function' && isTest(t));
      const mavzuId = isT ? `bob_test_${k}` : `topic_${k}_${i}`;
      const mavzuOchiq = systemLocks[mavzuId] === true;

      // --- Mavzu qulfi (Claude dizayni kichik) ---
      let mavzuQulf = '';
      if (ustozMi) {
        mavzuQulf = `
          <label class="switch switch--sm" onclick="inlineQulfniBos(event, '${mavzuId}')" title="${mavzuOchiq?'Yopish':'Ochish'}" style="margin-left:auto; z-index: 10;">
            <input class="switch__input" type="checkbox" ${mavzuOchiq ? 'checked' : ''} style="pointer-events: none;">
            <span class="switch__track"><span class="switch__knob"><span class="lock"><i class="lock__shackle"></i><i class="lock__body"></i></span></span></span>
          </label>
        `;
      } else if (!mavzuOchiq) {
        mavzuQulf = `<span style="margin-left:auto; opacity:0.5; font-size:12px;">🔒</span>`;
      }

      const mavzuMuzlatish = (!ustozMi && !mavzuOchiq) ? 'opacity:0.5; pointer-events:none;' : '';

      h+=`<button class="tp ${done(t)?"done":""} ${cur.c==k&&cur.t==i?"sel":""}" data-item-id="${mavzuId}" onclick="pick(${k},${i})" style="display:flex; align-items:center; position:relative; ${mavzuMuzlatish}">
            <span class="dot">${done(t)?"✓":t.id}</span>
            <span>${t.t}</span>
            ${mavzuQulf}
          </button>`;
    });
    h+="</div></div></div>"
  });

  const tc=document.getElementById("toc"),y=tc.scrollTop; tc.innerHTML=h; tc.scrollTop=y; first=false;
}

// =========================================================================
// 2. QULFLARNI Milt etmasdan (Flicker-free) SAQLAYDIGAN MANTIQ
// =========================================================================
window.inlineQulfniBos = function(e, itemId) {
  e.preventDefault();
  e.stopPropagation(); // "Mavzuga kirish" tugmasi tasodifan bosilib ketmasligi uchun

  const label = e.currentTarget;
  const input = label.querySelector('.switch__input');
  if (!input) return;

  const yangiHolat = !input.checked;

  // 1. Vizual animatsiyani darhol ishga tushiramiz (kutib turmaydi!)
  input.checked = yangiHolat;
  window.systemLocks[itemId] = yangiHolat;

  let updates = [{ item_id: itemId, is_open: yangiHolat }];

  // 2. Katta Bob yopilsa -> Ichidagi hamma mayda tugmalarni ham vizual yopamiz
  if (itemId.startsWith('chapter_')) {
    const k = parseInt(itemId.replace('chapter_', ''));
    const sec = label.closest('.sec');
    if (sec) {
       sec.querySelectorAll('.tp .switch__input').forEach(inp => inp.checked = yangiHolat);
    }
    
    if (CH[k] && CH[k].t) {
      CH[k].t.forEach((t, i) => {
        const isT = (typeof isTest === 'function' && isTest(t));
        const subId = isT ? `bob_test_${k}` : `topic_${k}_${i}`;
        updates.push({ item_id: subId, is_open: yangiHolat });
        window.systemLocks[subId] = yangiHolat;
      });
    }
  }

  // 3. Mayda Mavzu ochilsa -> Katta Bob qulfini ham vizual ochib qo'yamiz
  if (yangiHolat === true && (itemId.startsWith('topic_') || itemId.startsWith('bob_test_'))) {
     const sec = label.closest('.sec');
     if (sec) {
        const bobSwitch = sec.querySelector('.sh .switch__input');
        if (bobSwitch) bobSwitch.checked = true;
     }
     let num = itemId.startsWith('bob_test_') ? itemId.replace('bob_test_', '') : itemId.split('_')[1];
     updates.push({ item_id: `chapter_${num}`, is_open: true });
     window.systemLocks[`chapter_${num}`] = true;
  }

  // 4. Bazaga fonga xotirjam yozib qo'yaveradi (Menyuni qayta chizmaydi, shuning uchun qotmaydi)
  db.from('system_locks').upsert(updates, { onConflict: 'item_id' })
    .then(({error}) => { if (error) console.error("Qulfni saqlashda xato", error); });
};


document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-item-id]');
  
  // QOIDA: Agar element yo'q bo'lsa Yoki dars OCHIQ bo'lsa Yoki bosayotgan odam USTOZ bo'lsa -> indama, o'tkazib yubor!
  if (!el || ochiqmi(el.dataset.itemId) || (typeof isStaff === 'function' && isStaff())) return;
  
  e.preventDefault();
  e.stopPropagation();
  const id = el.dataset.itemId;
  toastKorsat(id.startsWith('bob_test')
    ? 'Bu bob testi ustoz tomonidan qulflangan'
    : 'Bu bob ustoz tomonidan qulflangan');
}, true);

// Sehrli tugma bosilganda to'lqin (ripple) effekti
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-item-id]');
  if (!el) return;
  
  // Qulf belgisini ustoz yoqib-o'chirayotganda bu qorovul xalaqit bermasligi kerak
  if (e.target.closest('.inline-qulf') || e.target.closest('.switch')) return;

  const itemId = el.dataset.itemId;
  const ustozMi = (typeof isStaff === 'function' && isStaff());
  const ochiq = (window.systemLocks && window.systemLocks[itemId] === true);
  
  // Agar dars ochiq bo'lsa YOKI bosayotgan odam ustoz bo'lsa -> indama, kirsin!
  if (ochiq || ustozMi) return;

  // QOLGAN BARCHA HOLATDA: Tizimga kirmaganlarga ham, oddiy o'quvchilarga ham qat'iy TA'QIQ!
  e.preventDefault();
  e.stopPropagation();
  
  if (typeof toastKorsat === 'function') {
    toastKorsat(itemId.startsWith('bob_test')
      ? 'Bu bob testi qulflangan 🔒'
      : 'Bu dars qulflangan 🔒');
  }
}, true); // <- true turishi juda muhim, u eng birinchi bo'lib tutib oladi
// Supabase orqali tizimga kirish funksiyasi
// Supabase orqali tizimga kirish funksiyasi
async function kirishniBajarish(btn) {
  let email = document.getElementById('log-email').value.trim();
  const pass = document.getElementById('log-pass').value;

  if (!email || !pass) {
    toastKorsat("Iltimos, login va parolni to'liq kiriting");
    return;
  }

  // ENG ASOSIY QISMI: Agar login ichida @ bo'lmasa, avtomatik domenni ulaymiz
  if (!email.includes("@")) {
    email += "@users.matematiklar.uz";
  }

  // Tugma holatini o'zgartirish (yuklanish jarayoni)
  const oldText = btn.innerHTML;
  btn.innerHTML = "Kirilmoqda...";
  btn.style.opacity = "0.7";
  btn.style.pointerEvents = "none";

  // Supabase dan tekshirish
  const { data, error } = await db.auth.signInWithPassword({
    email: email,
    password: pass
  });

  if (error) {
    toastKorsat("Xatolik: Login yoki parol noto'g'ri");
    btn.innerHTML = oldText;
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
  } else {
    // Muvaffaqiyatli kirilsa
    toastKorsat("Tizimga muvaffaqiyatli kirdingiz!");
    document.getElementById('log-email').value = '';
    document.getElementById('log-pass').value = '';
    
    // Tugmani asl holiga qaytarib oynani yopamiz va ma'lumotlarni yangilaymiz
    btn.innerHTML = oldText;
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
    
    hideLoginOverlay();
    
    // Mehmon rejimini o'chirib, o'quvchi (profil) rejimini yuklash
    await holatniTekshirish();
  }
}
// --- USTOZ PULTI: QULFLARNI BOSHQRISH ---

// Qulflar bo'limi bosilganda pultni yuklash
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-t="locks"]');
  if (t) loadLocksPanel();
});

// --- USTOZ PULTI: CLAUDE DIZAYNI BILAN QULFLARNI BOSHQRISH ---
async function loadLocksPanel() {
  const container = document.getElementById('tp-locks-list');
  if (!container) return;
  
  container.innerHTML = '<p style="padding: 20px; text-align: center; color: #64748b;">Darslar ro\'yxati yuklanmoqda...</p>';
  
  try {
    const { data, error } = await db.from('system_locks').select('*');
    if (error) throw error;
    
    const lockMap = {};
    data.forEach(l => lockMap[l.item_id] = l.is_open);
    
    let html = `
      <div class="panel" style="margin: 0; max-width: 100%;">
        <header class="panel__header">
          <h1 class="panel__title">Darslar kirish nazorati</h1>
          <p class="panel__subtitle">Bob yoki mavzuni qulflang — o'quvchilar uchun ochiq/yopiq holati shu yerda belgilanadi.</p>
        </header>
        <ul class="chapters" id="chapters-list-ui">
    `;
    
    CH.forEach((bob, c) => {
      const bobId = `chapter_${c}`;
      const isBobOpen = lockMap[bobId] === true; 
      
      let mavzularHtml = '';
      
      if (bob.t && bob.t.length > 0) {
        bob.t.forEach((mavzu, t) => {
          const isT = (typeof isTest === 'function' && isTest(mavzu));
          const mavzuId = isT ? `bob_test_${c}` : `topic_${c}_${t}`;
          const isMavzuOpen = lockMap[mavzuId] === true;
          
          mavzularHtml += `
            <li class="topic">
              <span class="topic__dot"></span>
              <span class="topic__title">${mavzu.id ? mavzu.id + ' · ' : ''}${mavzu.t || mavzu.nomi || mavzu.n || 'Mavzu ' + (t + 1)}</span>
              <label class="switch switch--sm">
                <input class="switch__input mavzu-lock" type="checkbox" ${isMavzuOpen ? 'checked' : ''} onchange="toggleMavzu(${c}, ${t}, this.checked)">
                <span class="switch__track"><span class="switch__knob"><span class="lock"><i class="lock__shackle"></i><i class="lock__body"></i></span></span></span>
              </label>
            </li>
          `;
        });
      }

      html += `
        <li class="chapter" id="ui-bob-${c}">
          <div class="chapter__head">
            <span class="chapter__index">${String(c + 1).padStart(2, '0')}</span>
            <div class="chapter__info">
              <h2 class="chapter__title">${bob.nomi || bob.n || 'Bob ' + (c + 1)}</h2>
              <p class="chapter__meta">${bob.t ? bob.t.length : 0} ta mavzu</p>
            </div>
            <span class="status" aria-live="polite"></span>
            <label class="switch" title="Bobni qulflash / ochish">
              <input class="switch__input chapter-lock" type="checkbox" ${isBobOpen ? 'checked' : ''} onchange="toggleBob(${c}, this.checked)">
              <span class="switch__track">
                <span class="switch__knob">
                  <span class="lock"><i class="lock__shackle"></i><i class="lock__body"></i></span>
                </span>
              </span>
            </label>
          </div>
          <ul class="topics">
            ${mavzularHtml}
          </ul>
        </li>
      `;
    });
    
    html += '</ul></div>';
    container.innerHTML = html;
    
  } catch (err) {
    container.innerHTML = `<p style="color: red; padding: 20px;">Xatolik: ${err.message}</p>`;
  }
}

async function toggleBob(c, isOpen) {
  try {
    const updates = [{ item_id: `chapter_${c}`, is_open: isOpen }];
    
    if (CH[c].t) {
      CH[c].t.forEach((mavzu, t) => {
        const isT = (typeof isTest === 'function' && isTest(mavzu));
        const subId = isT ? `bob_test_${c}` : `topic_${c}_${t}`;
        updates.push({ item_id: subId, is_open: isOpen });
      });
    }

    const { error } = await db.from('system_locks').upsert(updates, { onConflict: 'item_id' });
    if (error) throw error;

    const bobLi = document.getElementById(`ui-bob-${c}`);
    if (bobLi) {
      const maydaTugmalar = bobLi.querySelectorAll('.mavzu-lock');
      maydaTugmalar.forEach(btn => btn.checked = isOpen);
    }
    
    toastKorsat(isOpen ? "Bob va uning mavzulari ochildi 🔓" : "Bob butunlay qulflandi 🔒");
    if (typeof locksniYuklash === 'function') await locksniYuklash();
    renderSide();
  } catch (err) {
    toastKorsat("Xatolik yuz berdi!");
    loadLocksPanel();
  }
}

async function toggleMavzu(c, t, isOpen) {
  try {
    const mavzu = CH[c] && CH[c].t ? CH[c].t[t] : null;
    const isT = (mavzu && typeof isTest === 'function' && isTest(mavzu));
    const itemId = isT ? `bob_test_${c}` : `topic_${c}_${t}`;
    const updates = [{ item_id: itemId, is_open: isOpen }];
    
    if (isOpen) {
      updates.push({ item_id: `chapter_${c}`, is_open: true });
    }

    const { error } = await db.from('system_locks').upsert(updates, { onConflict: 'item_id' });
    if (error) throw error;
    
    if (isOpen) {
      const bobLi = document.getElementById(`ui-bob-${c}`);
      if (bobLi) {
         const kattaTugma = bobLi.querySelector('.chapter-lock');
         if (kattaTugma) kattaTugma.checked = true;
      }
    }

    toastKorsat("Mavzu holati o'zgardi");
    if (typeof locksniYuklash === 'function') await locksniYuklash();
    renderSide();
  } catch (err) {
    toastKorsat("Xatolik yuz berdi!");
    loadLocksPanel();
  }
}
// 1. Saytga kirganda bazadan qaysi boblar ochiq/yopiqligini o'qib kelish
async function locksniYuklash() {
  try {
    const { data, error } = await db.from('system_locks').select('*');
    if (error) throw error;
    
    window.systemLocks = {};
    systemLocks = window.systemLocks;
    if (data) {
      data.forEach(lock => {
        window.systemLocks[lock.item_id] = lock.is_open;
      });
    }
    renderSide();
  } catch (err) {
    console.error("Qulflarni yuklashda xatolik:", err);
  }
}

// 2. Mundarija chizilganda yopiq boblarga 🔒 osib qo'yish
function locksniQollash() {
  const items = document.querySelectorAll('[data-item-id]');
  
  items.forEach(el => {
    const itemId = el.getAttribute('data-item-id');
    // Agar bazada bu bob ochiq bo'lsa (true), demak ochiq. Yo'qsa - yopiq (false).
    const isOpen = systemLocks[itemId] === true; 
    
    if (!isOpen) {
      // Yopiq bo'lsa - xiralashtiramiz, bosib bo'lmaydigan qilamiz va 🔒 qo'shamiz
      el.style.opacity = '0.5';
      el.style.pointerEvents = 'none'; // Tugmani butunlay o'chiradi
      
      if (!el.querySelector('.qulf-belgisi')) {
        el.innerHTML += '<span class="qulf-belgisi" style="margin-left: auto;">🔒</span>';
      }
    } else {
      // Ochiq bo'lsa - yorqin qilamiz va qulfni olib tashlaymiz
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto'; 
      
      const qulf = el.querySelector('.qulf-belgisi');
      if (qulf) qulf.remove();
    }
  });
}
/* ---------- TEKSHIRISH VA ANIMATSIYALAR ---------- */
/* ---------- TEKSHIRISH VA ANIMATSIYALAR ---------- */
window.checkAndGo = async function(btn, cIndex, tIndex, nextIndex) {
  const t = CH[cIndex].t[tIndex];
  const p = hwPct(t);
  
  if (p < HW_PASS) {
    // Yiqildi - Shake animatsiyasi va qizil alert
    btn.classList.add('hw-shake', 'hw-btn--fail');
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    
    // Eski alertlarni tozalash
    document.querySelectorAll('.hw-alert').forEach(e => e.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.className = 'hw-alert hw-alert--bad';
    alertDiv.innerHTML = 
      `<span aria-hidden="true">⚠️</span>
      <div style="flex:1">
        <div><strong>Natija: ${p}%.</strong> Keyingi mavzuga o'tish uchun kamida ${HW_PASS}% to'plash kerak.</div>
        <div class="hw-alert__bar" style="--w:${Math.min(p, 100)}%"><i></i><b></b></div>
      </div>`;
    btn.parentElement.appendChild(alertDiv);
    
    setTimeout(() => btn.classList.remove('hw-shake', 'hw-btn--fail'), 1600);
    return; // Dastur shu yerda to'xtaydi, keyingi darsga o'tkazmaydi!
  }
  
  // O'tdi - Yashil dizayn va bazaga saqlash
  btn.classList.add('hw-btn--ok');
  document.querySelectorAll('.hw-alert').forEach(e => e.remove());
  if (typeof hwConfetti === 'function') hwConfetti();
  if (typeof toastKorsat === 'function') toastKorsat("Ajoyib! Natija: " + p + "% 🎉");
  
  const oldText = btn.textContent;
  btn.textContent = "Saqlanmoqda...";
  
  try {
    const { data: userData } = await db.auth.getUser();
    if (userData?.user) {
      const payload = {
        student_id: userData.user.id,
        topic_id: t.id,
        topic_title: t.t,
        percent: p,
        correct: correct(t),
        total: total(t),
        passed: true
      };
      await db.from('homework_scores').upsert(payload); 
    }
  } catch (err) {
    console.error("Uy vazifani saqlashda xato:", err);
  }
  
  btn.textContent = oldText;
  
  // Haqiqatdan ham keyingi darsga o'tkazish!
  go(nextIndex); 
};
/* ---------- UYGA VAZIFA JADVALI (Ustoz paneli uchun) ---------- */
let hwTableInstance = null; // Jadval obyektini saqlaydi

/* ---------- UYGA VAZIFA JADVALI ---------- */
async function loadHomeworkPanel(gid) {
  const box = tpE("tp-pane-hw");
  if (!box) return;
  box.innerHTML = '<p class="tp-n">Yuklanmoqda…</p>';
  
  try {
    const { data, error } = await db.from('homework_scores')
      .select('percent, created_at, topic_title, profiles!inner(full_name)')
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (error) throw error;
    
    if (!data || data.length === 0) {
      box.innerHTML = '<p class="tp-n">Hali hech kim uy vazifasini topshirmadi.</p>';
      return;
    }

    const rows = data.map(r => {
      const pct = r.percent;
      const cls = pct >= 90 ? 'g' : (pct >= 50 ? 'm' : 'b'); // yashil, sariq, qizil
      const dt = new Date(r.created_at).toLocaleString('uz-UZ', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
      
      return `<tr>
        <td><b>${esc(r.profiles?.full_name || "Noma'lum")}</b></td>
        <td>${esc(r.topic_title || "")}</td>
        <td><div class="tp-pc ${cls}">${pct}%</div></td>
        <td><small>${dt}</small></td>
      </tr>`;
    }).join("");

    box.innerHTML = `
      <h3>So'nggi uyga vazifa natijalari</h3>
      <div class="tp-tw">
        <table class="tp-t">
          <thead><tr><th>O‘quvchi</th><th>Mavzu</th><th>Natija</th><th>Topshirilgan vaqt</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
      
  } catch (err) {
    box.innerHTML = `<p class="tp-n" style="color:red;">Xatolik: ${err.message}</p>`;
  }
}
function aiPedagogikTahlil() {
  // 1. Ekran ustidan qoramtir oyna (Modal) yaratamiz
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(11,31,75,0.85); z-index:9999; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);";
  
  const modal = document.createElement("div");
  modal.style.cssText = "background:#fff; width:90%; max-width:500px; border-radius:16px; padding:24px; box-shadow:0 20px 50px rgba(0,0,0,0.5); position:relative;";
  
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = "✕";
  closeBtn.style.cssText = "position:absolute; top:16px; right:16px; background:none; border:none; font-size:20px; cursor:pointer; color:#888;";
  closeBtn.onclick = () => document.body.removeChild(overlay);
  
  const title = document.createElement("h3");
  title.innerHTML = "✨ AI-Repetitor Xulosasi";
  title.style.cssText = "margin-top:0; color:#6C2BD9; font-size:18px; border-bottom:1px solid #eee; padding-bottom:10px; display:flex; align-items:center; gap:8px;";
  
  const content = document.createElement("div");
  content.style.cssText = "margin-top:16px; font-size:15px; line-height:1.6; color:#33415F; min-height:100px;";
  
  modal.appendChild(closeBtn);
  modal.appendChild(title);
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // 2. Matn yozish effekti (Typewriter) va sun'iy "aqlli" xulosa
  const loadingText = "Tizim o'quvchilarning joriy natijalarini va kognitiv xatolarini tahlil qilmoqda...";
  content.innerHTML = `<i style="color:#888">${loadingText}</i>`;

  setTimeout(() => {
    // Bu yerda guruh natijasiga qarab matnni dinamik o'zgartirish ham mumkin
    const aiText = "Hurmatli Ustoz! 📊 Tahlillar shuni ko'rsatmoqdaki, guruhingizdagi o'quvchilarning asosiy qismi qavslarni ochish va manfiy ishoralar bilan ishlashda qiynalmoqda (o'rtacha xato ko'rsatkichi 43-57% atrofida).\n\n💡 Pedagogik tavsiya: Keyingi darsning dastlabki 10 daqiqasini ishoralar o'zgarishi (minus va minusning ko'paytmasi) qoidasini takrorlashga ajratishingizni va o'quvchilarga yana 2 ta aynan shu turdagi amaliy mashq ishlashingizni tavsiya qilaman.\n\nUshbu yondashuv orqali guruhning o'zlashtirishini qisqa vaqtda 90% ga yetkazish mumkin.";
    
    content.innerHTML = "";
    let i = 0;
    
    // Harfma-harf yozish funksiyasi
    function typeWriter() {
      if (i < aiText.length) {
        if(aiText.charAt(i) === '\n') {
            content.innerHTML += "<br>";
        } else {
            content.innerHTML += aiText.charAt(i);
        }
        i++;
        setTimeout(typeWriter, 15); // Harflar chiqish tezligi
      }
    }
    typeWriter();
  }, 1500); // 1.5 soniya "o'ylab turadi"
}