import { showToast } from "./components/toast";
import {
  auth,
  db,
  onAuthStateChanged,
  persistAuthSession,
  signInWithEmailAndPassword,
  signOut,
  type User
} from "./services/firebase";
import { localStore as ls } from "./utils/storage";
import type { AppSession, CaseRecord, UserProfile } from "./types";

const CLN={surgery:"جراحة",perio:"بريو",braces:"بروس (Pros)",fill:"حشوات",ortho:"تقويم عملي"};
const LBL={...CLN,oralmed:"أمراض فم عملي",peds:"طب أطفال عملي"};
const DAYS={6:"السبت",0:"الأحد",1:"الاثنين",2:"الثلاثاء",3:"الأربعاء"},DORD=[6,0,1,2,3];
const SLT=["8:30–10:30","10:30–12:30","12:30–2:30"],SLR=[[510,630],[630,750],[750,870]];
const SCHED=`6,0,perio,A1 A2,أسماء
6,0,braces,A3 A4,أنور+صفا
6,0,fill,A5 A6,ريام+سامر
6,1,perio,B1 B2,سامر+أسماء
6,1,braces,B3 B4,صفا+أنور
6,1,fill,B5 B6,أسامة عبدالكاظم+ريام
6,2,perio,C1 C2,سامر+أسماء
6,2,braces,C3 C4,صفا+أنور
6,2,fill,C5 C6,أسامة عبدالكاظم+ريام
0,0,perio,C3 C4,أسماء+سندس
0,0,ortho,B3 B4 B5 B6,أحمد جابر
0,0,fill,C1 C2,أسامة+ريام
0,0,braces,C5 C6,صفا
0,1,perio,A3 A4,أسماء+سندس
0,1,ortho,C3 C4 C5 C6,أحمد جابر
0,1,fill,A1 A2,أسامة+ريام
0,1,braces,C1 C2,صفا+أنور
0,2,perio,B3 B4,أسماء+سندس
0,2,ortho,A3 A4 A5 A6,أحمد جابر
0,2,fill,B1 B2,أسامة+ريام
0,2,braces,B5 B6,صفا+أنور
1,0,perio,B5 B6,أبرار
1,0,surgery,C3 C4,سامر
1,1,perio,A5 A6,أحمد جابر
1,1,surgery,A1 A2,سامر
1,2,perio,C5 C6,أسماء+سندس
1,2,surgery,A6 B1 B2,سامر
2,0,braces,A5 A6,مريم+كرار
1,0,fill,B3 B4,أسامة+ريام
1,0,ortho,B1 B2 C1 C2,أحمد جابر
2,1,braces,B1 B2,مريم+كرار
1,1,fill,A3 A4,أسامة+ريام
2,1,surgery,B5 B6,د.حيدر
2,2,braces,A1 A2,مريم+كرار
1,2,fill,C3 C4,أسامة+ريام
1,2,ortho,A1 A2,أحمد جابر
2,2,surgery,A3 A4 A5,د.حيدر
3,0,surgery,C1 C2,د.حيدر+سامر
3,1,surgery,C5 C6,د.حيدر جهاد+سامر
3,2,surgery,B3 B4,د.حيدر جهاد+سامر`;
const DEF={schedV:5,students:"A2|محمد بهاء عبدالمحسن",sched:SCHED,test:0,clinics:{surgery:{on:1},perio:{on:0},braces:{on:1},fill:{on:1},ortho:{on:0}}};
const MEDS=[["htn","High blood pressure"],["heart","Heart disease"],["cva","C.V.A"],["epi","Epilepsy"],["dm","Diabetes"],["thy","Thyroid disease"],["asth","Asthma"],["tb","T.B"],["liver","Liver disease"],["bleed","Bleeding disorders"],["anem","Anemia"],["leuk","Leukaemia"],["kid","Kidney disease"],["git","GIT disease"],["preg","Pregnancy"],["arth","Arthritis / joint problems"],["allergy","Allergy"],["radio","Radiotherapy / chemotherapy"],["hosp","Previous hospitalisation"]];
const ST={draft:["مسودة","b-draft"],sent:["بانتظار الـ Start","b-sent"],started:["قيد العمل","b-started"],fin:["طلب Finish","b-sent"],finished:["منتهية","b-fin"],closed:["مغلقة","b-draft"]};
const $=(s:string):any=>document.querySelector(s),app:any=$("#app");
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let PR=false,cfg:Record<string,any>=DEF,cases:Record<string,CaseRecord>={},swaps:Record<string,any>={},me:AppSession|null=null,view:Record<string,any>={n:"home"},saveT=null,prev:Record<string,any>={};
const tok=c=>c.status+JSON.stringify(c.stages||{}),pend=c=>Object.values(c.stages||{}).filter((x:any)=>x.req&&!x.sig).length;
const PST=[["pi_u","Primary impression – Upper"],["pi_l","Primary impression – Lower"],["dc","Diagnostic cast-surveying"],["si_u","Secondary impression – Upper"],["si_l","Secondary impression – Lower"],["jr","Registration of jaw relation"],["td","Trial denture"],["rf","Ready for flasking"],["rpd","R.P.D in mouth"],["adj","Adjustment"]];
const fmt=t=>t?new Date(t).toLocaleString("ar-IQ",{dateStyle:"short",timeStyle:"short"}):"";
const hs=s=>{let h=5381;for(const ch of s)h=((h<<5)+h+ch.codePointAt(0))>>>0;return h.toString(36)};
const roster=():any[]=>cfg.students.split("\n").map(l=>l.split("|")).filter(a=>a[1]&&a[1].trim()).map(a=>({g:a[0].trim().toUpperCase(),n:a[1].trim(),id:a[0].trim().toUpperCase()+"_"+hs(a[1].trim().replace(/\s+/g,""))}));
const sched=()=>cfg.sched.split("\n").map(l=>l.split(",")).filter(a=>a.length>=4).map(a=>({d:+a[0],s:+a[1],c:a[2].trim(),g:a[3].trim().toUpperCase().split(/\s+/),n:(a[4]||"").trim()}));
const stuById=id=>roster().find(r=>r.id===id);
function bn(){const t=new Date(Date.now()+10800000),m=t.getUTCHours()*60+t.getUTCMinutes();return{d:t.getUTCDay(),m,date:t.toISOString().slice(0,10),s:SLR.findIndex(r=>m>=r[0]&&m<r[1])}}
const swList=():any[]=>Object.entries(swaps).map(([id,w])=>({id,...w}));
function elig(stu:any,clinic:string):any{
  const n=bn(),res={ent:null,n};
  if(n.s<0)return{...res,ok:cfg.test?1:0,why:"لا توجد فترة عيادة جارية الآن (8:30 – 2:30، السبت–الأربعاء)"};
  const ent=sched().find(e=>e.d===n.d&&e.s===n.s&&e.c===clinic);res.ent=ent;
  const sw=swList().filter(w=>w.date===n.date&&w.slot===n.s&&w.clinic===clinic&&w.status==="accepted");
  const t=sw.find(w=>w.taker===stu.id);if(t)return{...res,ok:1,sub:t.giver};
  if(ent&&ent.g.includes(stu.g)){if(sw.find(w=>w.giver===stu.id))return{...res,ok:cfg.test?1:0,why:"أعطيت وقتك لطالب بديل في هذه العيادة"};return{...res,ok:1}}
  return{...res,ok:cfg.test?1:0,why:ent?"هذا ليس وقت كروبك ("+stu.g+")":"لا توجد حصة لهذه العيادة الآن"};
}
const clone=o=>JSON.parse(JSON.stringify(o));
let dirtyId=null,dirtySeq=0,wq={};
function toast(m){showToast(String(m))}
window.addEventListener("error",e=>toast("⚠ خطأ: "+e.message));
window.addEventListener("unhandledrejection",e=>toast("⚠ خطأ: "+(e.reason&&e.reason.message||e.reason)));
function wr(k,fn){const p=(wq[k]||Promise.resolve()).then(fn).catch(e=>{toast("تعذّر الحفظ: "+(e&&e.message||e))});wq[k]=p;return p}
const dbSet=(c,id,d)=>wr(c+"/"+id,()=>db.collection(c).doc(id).set(clone(d)));
const dbUpd=(c,id,p)=>wr(c+"/"+id,()=>db.collection(c).doc(id).update(clone(p)));
let svcs:Record<string,any>={},staff:Record<string,any>={loc:"away"},prevSvc:Record<string,any>|null=null;
const pdKey=()=>"pd_"+me.id,pendList=()=>{try{return JSON.parse(ls.get(pdKey())||"[]")}catch(e){return[]}},pendHas=id=>me?.role==="student"&&pendList().includes(id);
const pendRm=id=>ls.set(pdKey(),JSON.stringify(pendList().filter(x=>x!==id)));
let flushing=false,ft;
function saveLocal(){if(me?.role!=="student")return;const o={};for(const[id,c]of mine())o[id]=c;ls.set("lc_"+me.id,JSON.stringify(o))}
function loadLocal(){if(me?.role!=="student")return;try{const o=JSON.parse(ls.get("lc_"+me.id)||"{}");for(const id in o)if(!cases[id])cases[id]=o[id]}catch(e){}}
function mark(id){const l=pendList();if(!l.includes(id))l.push(id);ls.set(pdKey(),JSON.stringify(l));saveLocal();clearTimeout(ft);ft=setTimeout(flush,400)}
async function flush(){
  if(flushing||!db||me?.role!=="student")return;flushing=true;
  try{for(const id of pendList()){const c=cases[id];if(!c){pendRm(id);continue}
    try{const ref=db.collection("cases").doc(id),snap=await ref.get();
      if(!snap.exists)await ref.set(clone(c));
      else{const r=snap.data(),p:Record<string,any>={f:c.f,med:c.med,teeth:c.teeth,help:!!c.help};
        if(c.stages){const st=clone(c.stages);for(const k in(r.stages||{}))if(r.stages[k].sig)st[k]=r.stages[k];p.stages=st}
        if(c.status==="sent"&&r.status==="draft"){p.status="sent";p.sent_at=c.sent_at}
        if(c.status==="fin"&&r.status==="started"){p.status="fin";p.fin_at=c.fin_at;p.help=false}
        if(c.status==="closed"&&["draft","sent","started","fin"].includes(r.status)){p.status="closed";p.help=false}
        await ref.update(clone(p))}
      pendRm(id);const f=await ref.get();if(f.exists){const n=clone(f.data());n.f=n.f||{};n.med=n.med||{};n.teeth=n.teeth||[];n.ev=n.ev||{};cases[id]=n;saveLocal();onData()}
    }catch(e){toast("⚠ حُفظ على هاتفك وسيُرسل تلقائياً عند توفر الاتصال");break}}
  }finally{flushing=false}}
let subscriptions=[],activeUid="";
function clearSubscriptions(){subscriptions.forEach(unsubscribe=>unsubscribe());subscriptions=[]}
function showSyncError(error){console.error("Firebase synchronization failed.",error);toast("تعذّرت المزامنة: "+error.message)}
function subscribeData(){
  clearSubscriptions();
  const report=showSyncError;
  subscriptions.push(db.collection("config").doc("main").onSnapshot(s=>{
    if(s.exists){
      const d=s.data()||{},rawClinics=d.clinics||{},clinics={};
      for(const key of Object.keys(CLN))clinics[key]={on:rawClinics[key]?.on?1:0};
      cfg={...DEF,students:d.students||DEF.students,sched:(d.schedV||0)<DEF.schedV?DEF.sched:d.sched||DEF.sched,schedV:d.schedV||DEF.schedV,test:d.test?1:0,clinics};
    }
    onData();
  },report));
  subscriptions.push(db.collection("swaps").onSnapshot(s=>{
    swaps={};s.docs.forEach(d=>swaps[d.id]=clone(d.data()));onData();
  },report));
  const serviceCollection=db.collection("svc");
  const servicesQuery=me.role==="student"
    ? serviceCollection.where("sid","==",me.id)
    : me.role==="doctor"
      ? serviceCollection.where("clinic","==",me.clinic)
      : serviceCollection;
  subscriptions.push(servicesQuery.onSnapshot(s=>{
    const m:Record<string,any>={};s.docs.forEach(d=>m[d.id]=clone(d.data()));
    if(me?.role==="staff"&&prevSvc&&Object.entries(m).some(([i,r])=>r.status==="pending"&&!prevSvc[i]))beep();
    prevSvc=m;svcs=m;onData();
  },report));
  subscriptions.push(db.collection("meta").doc("staff").onSnapshot(s=>{
    if(s.exists)staff=clone(s.data());onData();
  },report));
  if(me.role!=="staff"){
    const casesCollection=db.collection("cases");
    const casesQuery=me.role==="student"
      ? casesCollection.where("sid","==",me.id)
      : me.role==="doctor"
        ? casesCollection.where("clinic","==",me.clinic)
        : casesCollection;
    subscriptions.push(casesQuery.onSnapshot(s=>{
      const prevC=cases;cases={};
      s.docs.forEach(d=>{
        const c=clone(d.data()),old=prevC[d.id];
        if(old&&(dirtyId===d.id||pendHas(d.id))){c.f=old.f;c.med=old.med;c.teeth=old.teeth;c.help=old.help}
        c.f=c.f||{};c.med=c.med||{};c.teeth=c.teeth||[];c.ev=c.ev||{};cases[d.id]=c;
      });
      loadLocal();saveLocal();notify();backup();flush();onData();
    },report));
  }else cases={};
}
async function activateUser(user:User,expectedRole?:string){
  if(activeUid===user.uid)return;
  activeUid=user.uid;
  clearSubscriptions();
  try{
    const snapshot=await db.collection("users").doc(user.uid).get();
    if(!snapshot.exists)throw new Error("الحساب غير مفعّل؛ اطلب من الأدمن إعداده في Firebase.");
    const profile=snapshot.data() as UserProfile;
    if(!["student","doctor","staff","admin"].includes(profile.role))throw new Error("صلاحية الحساب غير صالحة.");
    if(expectedRole&&profile.role!==expectedRole)throw new Error("هذا الحساب غير مخوّل للدور المحدد.");
    if(profile.role==="student"){
      const student=stuById(profile.studentId);
      if(!student)throw new Error("حساب الطالب غير مرتبط بقائمة الطلاب.");
      me={...profile,uid:user.uid,id:profile.studentId,name:profile.name||student.n,group:profile.group||student.g};
    }else{
      if(profile.role==="doctor"&&(!profile.clinic||!CLN[profile.clinic]))
        throw new Error("لم تُسند عيادة فعّالة لهذا الحساب.");
      me={...profile,uid:user.uid,id:user.uid,name:profile.name||user.email||"مستخدم"};
    }
    view={n:"home"};subscribeData();loadLocal();flush();render();
  }catch(error){
    activeUid="";
    me=null;
    console.error("Could not activate Firebase account.",error);
    toast(error instanceof Error?error.message:"تعذّر تحميل صلاحيات الحساب.");
    await signOut(auth).catch(showSyncError);
    render();
  }
}
async function init(){
  try{await persistAuthSession()}catch(error){showSyncError(error)}
  onAuthStateChanged(auth,user=>{
    if(user)void activateUser(user);
    else if(me||activeUid){clearSubscriptions();activeUid="";me=null;cases={};view={n:"home"};render()}
  });
  window.setInterval(flush,20000);window.addEventListener("online",flush);render();
}
function backup(){if(me?.role==="student")ls.set("bk",JSON.stringify(mine().filter(([i,c])=>c.status==="finished")))}
function notify(){if(me?.role!=="doctor")return;let ping=0;
  for(const[id,c]of docCases()){const pn=pend(c),k=c.status+(c.help?"H":"")+"P"+pn;if(prev[id]!==undefined&&prev[id]!==k&&(c.help||pn||["sent","fin"].includes(c.status)))ping=1;prev[id]=k}
  if(ping){try{navigator.vibrate&&navigator.vibrate(300);const a=new AudioContext(),o=a.createOscillator();o.connect(a.destination);o.frequency.value=880;o.start();o.stop(a.currentTime+.25)}catch(e){}}}
function onData(){if(me?.role==="admin")syncArcSoon();if(view.n==="form"||view.n==="doc"){updateBar();return}if(["adm","arc","arcadd","arcdoc"].includes(view.n))return;render()}
const mine=():[string,CaseRecord][]=>Object.entries(cases).filter(([i,c])=>c.sid===me?.id).sort((a,b)=>b[1].created-a[1].created);
const docCases=(sts:string[]=["sent","started","fin"]):[string,any][]=>Object.entries(cases).filter(([i,c])=>(c.clinic||"surgery")===me.clinic&&sts.includes(c.status));
function upd(id,p){Object.assign(cases[id],p);if(me?.role==="student")mark(id);else if(db)dbUpd("cases",id,p)}
function swUpd(id,p){Object.assign(swaps[id],p);if(db)dbUpd("swaps",id,p)}
async function logout(){try{await signOut(auth)}catch(error){showSyncError(error)}}
const head=t=>`<div class="top"><h1>${t}</h1>${me?`<button onclick="logout()">خروج</button>`:""}</div>`;
const back=(n="home")=>`<button onclick="view={n:'${n}'};render()">→ رجوع</button>`;

let render=function(){
  if(!me)return login();
  if(me.role==="admin")return view.n==="arc"?arcView():view.n==="arcadd"?arcAddView():view.n==="arcdoc"?arcDocView():adminView();
  if(me.role==="staff")return staffHome();
  if(me.role==="doctor"){return view.n==="doc"?docView():view.n==="arch"?archView():doctorHome()}
  ({svc:svcView,svcrec:svcRecView,req:reqView,form:formView,chair:chairView,files:filesView,tt:ttView,sw:swView}[view.n]||studentHome)();
};
function login(){
  if(!view.pick)return roleView();
  const role=view.role||"student",R=roster(),gs=[...new Set(R.map(r=>r.g))].sort(),g=view.g||gs[0];
  app.innerHTML=`<div class="logo">🦷</div>${head("كيس شيت طب الأسنان – رابعة")}<div class="card"><div class="top"><span class="badge b-fin">${({student:"طالب",doctor:"دكتور",staff:"موظف الوصل والأشعة",admin:"أدمن"})[role]}</span><button onclick="view.pick=0;login()">تغيير الدور</button></div>
  ${role==="student"?`<label>الكروب</label><select id="gr" onchange="view.g=this.value;login()">${gs.map(x=>`<option ${x===g?"selected":""}>${x}</option>`).join("")}</select>
  <label>اسمك</label><select id="nm">${R.filter(r=>r.g===g).map(r=>`<option value="${r.id}">${esc(r.n)}</option>`).join("")}</select>
  <label>البريد الإلكتروني</label><input id="email" type="email" autocomplete="username">`
  :`<label>البريد الإلكتروني</label><input id="email" type="email" autocomplete="username">`}
  <label>كلمة المرور</label><input id="password" type="password" autocomplete="current-password">
  <p class="mut">يجب تفعيل الحساب والصلاحية مسبقاً من Firebase.</p>
  <p id="err" style="color:var(--er)"></p><button class="p big" style="text-align:center" onclick="doLogin('${role}')">دخول</button></div>`;
}
async function doLogin(role){
  const err=m=>$("#err").textContent=m;
  const credentials={email:$("#email").value.trim(),credential:$("#password").value};
  if(!credentials.email||!credentials.credential)return err("أدخل البريد الإلكتروني وكلمة المرور.");
  if(role==="student"&&!stuById($("#nm").value))return err("اختر اسم الطالب المرتبط بالحساب.");
  try{
    const signedIn=await signInWithEmailAndPassword(auth,credentials.email,credentials.credential);
    const profile=(await db.collection("users").doc(signedIn.user.uid).get()).data() as UserProfile|undefined;
    if(profile?.role!==role){await signOut(auth);return err("هذا الحساب غير مخوّل للدور المحدد.")}
    if(role==="student"){
      if(profile?.studentId!==$("#nm").value){await signOut(auth);return err("الطالب المختار لا يطابق الحساب المفعّل.")}
    }
    await activateUser(signedIn.user,role);
  }catch(error){
    const code=typeof error==="object"&&error&&"code" in error?String(error.code):"";
    const message=code.includes("api-key-not-valid")
      ?"مفتاح Firebase API المرفق غير صالح. تحقق من إعدادات تطبيق الويب في Firebase Console."
      :error instanceof Error?error.message:"تعذّر تسجيل الدخول.";
    console.error("Firebase sign-in failed.",error);err(message);
  }
}
/* ---- Student ---- */
function studentHome(){
  const n=bn(),mySw=swList().filter(w=>w.date===n.date&&["pending","accepted"].includes(w.status)&&(w.giver===me.id||w.taker===me.id));
  app.innerHTML=`${head("أهلاً "+esc(me.name.split(" ")[0]))}<div class="mut">الكروب: ${me.group} ${cfg.test?'• <b style="color:var(--wa)">وضع تجريبي: الجدول معطّل</b>':""}</div>
  ${n.s>=0?`<div class="banner bn-b">الفترة الحالية ${SLT[n.s]} — المتبقي ${SLR[n.s][1]-n.m} دقيقة</div>`:""}
  ${locBanner()}<h2>فتح كيس شيت جديد</h2>
  ${Object.entries(CLN).map(([k,t])=>`<button class="big" ${cfg.clinics[k].on?`onclick="pick('${k}')"`:"disabled"}>${t} ${cfg.clinics[k].on?"":'<span class="mut">(قريباً)</span>'}</button>`).join("")}
  <button class="big" onclick="view={n:'svc'};render()">🧾 أخذ وصل / أشعة</button>
  <button class="big" onclick="view={n:'tt'};render()">📅 جدول كروبي</button>
  ${cfg.clinics.fill.on?`<button class="big" onclick="view={n:'req'};render()">📋 نموذج متطلبات الحشوات</button>`:""}
  ${mySw.length?`<h2>طلبات البديل اليوم</h2>${mySw.map(w=>swCard(w)).join("")}`:""}
  <h2>حالاتي الجارية</h2>
  ${mine().filter(([i,c])=>!["finished","closed"].includes(c.status)).map(caseCard).join("")||'<p class="mut">لا توجد حالات جارية</p>'}
  <button class="big" onclick="view={n:'files'};render()">📁 ملفاتي (المنتهية)</button>`;
}
function swCard(w){const g=stuById(w.giver),t=stuById(w.taker),amG=w.giver===me.id;
  return `<div class="card"><b>${CLN[w.clinic]} • ${SLT[w.slot]}</b><div class="mut">${esc(t?.n)} ← بديل عن ← ${esc(g?.n)}</div><div>${w.status==="pending"?"بانتظار الموافقة":"تمت الموافقة ✅"}</div><div class="seg">${w.status==="pending"&&amG?`<button class="ok" onclick="swUpd('${w.id}',{status:'accepted'});render()">قبول</button>`:""}${!w.used&&bn().s<=w.slot&&(bn().s<w.slot||true)?`<button onclick="swUpd('${w.id}',{status:'cancelled'});render()">إلغاء</button>`:""}</div></div>`}
function pick(clinic){
  const e=elig(stuById(me.id),clinic);
  if(e.ok){view={n:"chair",clinic,sub:e.sub};return render()}
  app.innerHTML=`<div class="top">${back()}</div><div class="card"><h2>${CLN[clinic]}</h2><p>${e.why}</p>${e.ent?`<button class="p big" style="text-align:center" onclick="view={n:'sw',clinic:'${clinic}'};render()">اختر البديل</button>`:""}</div>`;
}
function swView(){
  const clinic=view.clinic,e=elig(stuById(me.id),clinic),R=roster().filter(r=>e.ent?.g.includes(r.g)&&r.id!==me.id);
  app.innerHTML=`<div class="top">${back()}<h1>اختر البديل</h1></div><p class="mut">اختر طالباً من كروب الحصة الحالية (${e.ent?.g.join(" + ")}) ليتبادل معك. بعد موافقته تستطيع فتح كيس شيت، ولن يستطيع هو فتح كيس شيت في هذه العيادة خلال هذه الحصة.</p>
  ${R.map(r=>`<button class="big" onclick="reqSwap('${clinic}','${r.id}')">${esc(r.n)} <span class="mut">${r.g}</span></button>`).join("")||'<p class="mut">لا توجد أسماء مسجلة لهذه الكروبات بعد</p>'}`;
}
function reqSwap(clinic,gid){const n=bn(),id="sw_"+Date.now();
  if(swList().some(w=>w.taker===me.id&&w.date===n.date&&w.slot===n.s&&["pending","accepted"].includes(w.status))){toast("لديك طلب بديل لهذه الحصة بالفعل");return}
  const w={date:n.date,slot:n.s,clinic,giver:gid,taker:me.id,status:"pending",used:false,ts:Date.now()};swaps[id]=w;if(db)dbSet("swaps",id,w);view={n:"home"};render()}
function ttView(){
  const n=bn();
  app.innerHTML=`<div class="top">${back()}<h1>جدول ${me.group}</h1></div>${DORD.map(d=>{const r=sched().filter(e=>e.d===d&&e.g.includes(me.group)).sort((a,b)=>a.s-b.s);return `<div class="card"><b>${DAYS[d]}</b>${r.map(e=>`<div class="${n.d===d&&n.s===e.s?"hl":""}" style="padding:4px">${SLT[e.s]} — ${LBL[e.c]||e.c}${e.n?` <span class="mut">(${esc(e.n)})</span>`:""}</div>`).join("")||'<div class="mut">لا توجد حصة</div>'}</div>`}).join("")}`;
}
function caseCard([id,c]){const s=ST[c.status];return `<div class="card" onclick="${me.role==="doctor"?`view={n:'doc',id:'${id}'}`:`view={n:'form',id:'${id}'}`};render()" style="cursor:pointer"><div class="top"><b>${esc(me.role==="doctor"?c.sname:(c.f?.pname||"مريض جديد"))}</b><span class="badge ${s[1]}">${s[0]}</span></div><div class="mut">${CLN[c.clinic||"surgery"]} • ${c.group} • كرسي ${esc(c.chair)} ${me.role==="doctor"?"• "+esc(c.f?.pname||""):""} ${c.sub?"• بديل":""}</div>${c.help?'<span class="help">🆘 يحتاج مساعدة</span>':""} ${pend(c)?`<span class="help">🖊 ${pend(c)} طلب توقيع</span>`:""}</div>`}
function chairView(){app.innerHTML=`<div class="top">${back()}<h1>رقم الكرسي</h1></div><div class="card"><label>ما هو رقم الكرسي الخاص بك؟</label><input id="ch" inputmode="numeric"><button class="p big" style="text-align:center;margin-top:12px" onclick="createCase()">متابعة</button></div>`}
function createCase(){
  const ch=$("#ch").value.trim();if(!ch)return;
  const e=elig(stuById(me.id),view.clinic);if(!e.ok){toast(e.why);return}
  const id=me.id+"_"+Date.now(),c:any={sid:me.id,sname:me.name,group:me.group,clinic:view.clinic,chair:ch,status:"draft",help:false,created:Date.now(),f:{},med:{},teeth:[],ev:{}};
  if(e.sub){const g=stuById(e.sub);c.sub=g?g.n:"";const w=swList().find(w=>w.taker===me.id&&w.status==="accepted"&&w.date===e.n.date&&w.slot===e.n.s);if(w)swUpd(w.id,{used:true})}
  cases[id]=c;mark(id);view={n:"form",id};render();
}
const editable=c=>["draft","started"].includes(c.status);
function fld(c,k,label,ml:any=false){const v=c.f[k]||"",ed=editable(c)&&view.n==="form"&&!PR;
  return `<label>${label}</label>`+(ed?(ml?`<textarea data-k="${k}">${esc(v)}</textarea>`:`<input data-k="${k}" value="${esc(v)}">`):`<div class="v">${esc(v)||"&nbsp;"}</div>`)}
function sheetHTML(c,pr=false){
  PR=pr;const ed=editable(c)&&view.n==="form"&&!pr,T=c.teeth||[],fl=(c.clinic||"surgery")==="fill",pr2=c.clinic==="braces";
  const ch=pf=>{const q=(p,sd)=>(sd==="R"?[8,7,6,5,4,3,2,1]:[1,2,3,4,5,6,7,8]).map(n=>{const k=pf+p+sd+n;return `<button class="t ${T.includes(k)?"on":""}" ${ed?`data-t="${k}"`:"disabled"}>${n}</button>`}).join("");
    return `<div class="teeth"><div class="tq u"><div class="half">${q("U","R")}</div><div class="half">${q("U","L")}</div></div><div class="tq"><div class="half">${q("L","R")}</div><div class="half">${q("L","L")}</div></div></div>`};
  const top=`<b>University College of Al-Zahrawi – ${fl?"Operative Dentistry":pr2?"Prosthodontics (RPD)":"Oral Surgery"} Case Sheet</b>
  <div class="row"><div><label>الطالب</label><div class="v">${esc(c.sname)}</div></div><div><label>الكروب / الكرسي</label><div class="v">${c.group} / ${esc(c.chair)}</div></div></div>
  <div class="mut">${fmt(c.created)} ${c.sub?`• <b>بديل عن ${esc(c.sub)}</b>`:""}</div>
  <div class="row"><div>${fld(c,"pname","Patient's name")}</div><div>${fld(c,"age","Age")}</div></div>
  <div class="row"><div>${fld(c,"sex","Sex")}</div><div>${fld(c,fl||pr2?"phone":"occ",fl||pr2?"Phone No.":"Occupation")}</div></div>
  ${fl||pr2?`<div class="row"><div>${fld(c,"addr","Address")}</div><div>${fld(c,"occ","Occupation")}</div></div>`:fld(c,"addr","Address")}`;
  const body=pr2?prosBody(c,ch):fl?`${fld(c,"cc","Chief complaint")}${fld(c,"hpi","History of complaint",1)}${fld(c,"pdh","Past dental history",1)}${fld(c,"mh","Medical history",1)}
  <h2>Examination</h2>${fld(c,"hyg","Oral hygiene")}${fld(c,"perio","Periodontal condition")}
  <h2>Non-vital tooth</h2>${ch("nv:")}<h2>Missing teeth</h2>${ch("ms:")}<h2>Crown &amp; bridge</h2>${ch("cb:")}
  ${fld(c,"tooth","Tooth No. (للمتطلبات)")}${fld(c,"plan","Treatment plan",1)}`
  :`${fld(c,"cc","Chief complaint (C/C)")}${fld(c,"hpi","History of present illness (HPI)",1)}${fld(c,"pdh","Past dental history (PDH)",1)}${fld(c,"mh","Medical history (MH)",1)}
  <h2>هل لديك أي من الأمراض التالية؟</h2>
  ${MEDS.map(([k,l])=>{const v=c.med[k];return `<div class="med"><span>${l}</span>${ed?`<div class="seg"><button class="n ${v==="no"?"on":""}" data-m="${k}|no">No</button><button class="y ${v==="yes"?"on":""}" data-m="${k}|yes">Yes</button></div>`:`<b style="color:${v==="yes"?"var(--er)":"inherit"}">${v==="yes"?"Yes":v==="no"?"No":"—"}</b>`}</div>`}).join("")}
  ${fld(c,"why","Why (hospitalisation)")}
  <h2>Clinical examination</h2>${fld(c,"eo","E/O",1)}${fld(c,"io","I/O",1)}${fld(c,"inv","Investigation",1)}${fld(c,"dx","Diagnosis")}
  <h2>Treatment plan / Extraction of</h2>${ch("")}`;
  const e:Record<string,any>=c.ev||{};
  const fin=c.status!=="finished"?"":pr2?`<h2>التقييم النهائي</h2><div>Final evaluation grade: <b>${esc(e.grade||"—")}</b></div><div class="v">${esc(e.notes||"")}</div><div class="mut">Finish: ${fmt(c.finished_at)} — ${esc(c.doctor||"")}</div>`:fl?`<h2>التقييم</h2><div>Cavity <b>${e.cav??"—"}</b>/60 • Lining <b>${e.lin??"—"}</b>/15 • Filling <b>${e.fil??"—"}</b>/25 • Total <b>${e.total??"—"}</b>/100</div><div class="v">${esc(e.notes||"")}</div><div class="mut">Finish: ${fmt(c.finished_at)} — ${esc(c.doctor||"")}</div>`
    :`<h2>التقييم</h2><div>Case sheet: <b>${esc(e.sheet||"—")}</b> • Extraction: <b>${esc(e.ext||"—")}</b></div><div class="v">${esc(e.notes||"")}</div><div class="mut">Finish: ${fmt(c.finished_at)} — ${esc(c.doctor||"")}</div>`;
  return `<div class="card sheet">${top}${body}${c.started_at?`<div class="v">✔ ${fl?"Mentor signature":"Start"}: ${fmt(c.started_at)} — ${esc(c.doctor||"")}</div>`:""}${fin}</div>`;
}
function prosBody(c,ch){
  const stg=c.stages||{},isDoc=me.role==="doctor"&&view.n==="doc"&&["started","fin"].includes(c.status),canReq=me.role==="student"&&view.n==="form"&&c.status==="started"&&!PR;
  const rows=PST.map(([k,l])=>{const x=stg[k]||{};
    const sig=x.sig?`✔ ${esc(x.sig)}`:x.req?(isDoc?`<input id="g_${k}" placeholder="Grade" style="width:80px"> <button class="ok" onclick="signStage('${k}')">توقيع</button>`:"⏳ بانتظار التوقيع"):canReq?`<button onclick="reqStage('${k}')">طلب توقيع</button>`:"—";
    return `<div class="med" style="flex-wrap:wrap"><span><b>${l}</b></span><span>${sig}${x.sig?` • ${new Date(x.date).toLocaleDateString("ar-IQ")} • Grade <b>${esc(x.grade||"—")}</b>`:""}</span></div>`}).join("");
  return `${fld(c,"first","Is this the first time you attended this hospital")}${fld(c,"mh","Medical history",1)}<h2>Dental history</h2>${fld(c,"d1","Reason for tooth extraction")}${fld(c,"d2","Do you visit a dentist regularly?")}${fld(c,"d3","Reason for construction a partial denture")}${fld(c,"d4","Any previous partial denture?")}${fld(c,"d5","a. What is the type")}${fld(c,"d6","b. Reasons for not using it?")}${fld(c,"d7","Any experience from an old treatment")}<h2>Examination</h2>${fld(c,"x1","An extraoral")}${fld(c,"x2","TMJ disorder (clicking)")}${fld(c,"x3","Muscles of mastication (tone)")}${fld(c,"x4","Facial tissue and structure")}${fld(c,"x5","An intraoral")}<h2>Missing teeth</h2>${ch("ms:")}<h2>Carious teeth</h2>${ch("ca:")}${fld(c,"soft","Condition of soft tissue")}${fld(c,"les","Presence of any abnormal lesion")}${fld(c,"plan","RPD design notes",1)}${fld(c,"tech","اسم الفني الذي ساهم بالعمل")}<h2>Stages</h2>${rows}<div class="med"><span><b>Final evaluation</b></span><span>${c.status==="finished"?`✔ ${esc(c.doctor||"")} • Grade <b>${esc(c.ev?.grade||"—")}</b>`:"عند الـ Finish"}</span></div>`;
}
function reqStage(k){const c=cases[view.id],st={...(c.stages||{})};st[k]={req:1,at:Date.now()};upd(view.id,{stages:st});updateBar()}
function signStage(k){const g=($("#g_"+k)||{}).value?.trim();if(!g){toast("أدخل الدرجة أولاً");return}const c=cases[view.id],st={...(c.stages||{})};st[k]={sig:"عيادة "+CLN[me.clinic],date:Date.now(),grade:g};upd(view.id,{stages:st});updateBar()}
function evForm(c){
  if(c.clinic==="braces")return `<h2>Final evaluation</h2><label>Grade</label><input id="ev1"><label>Notes (اختياري)</label><textarea id="ev3"></textarea>`;
  if((c.clinic||"surgery")==="fill")return `<h2>التقييم</h2><div class="row"><div><label>Cavity (من 60)</label><input id="ev1" type="number" min="0" max="60" inputmode="numeric" oninput="sumEv()"></div><div><label>Lining (من 15)</label><input id="ev2" type="number" min="0" max="15" inputmode="numeric" oninput="sumEv()"></div></div><div class="row"><div><label>Filling (من 25)</label><input id="ev3" type="number" min="0" max="25" inputmode="numeric" oninput="sumEv()"></div><div><label>المجموع (من 100)</label><input id="evt" disabled></div></div><label>Notes (اختياري)</label><textarea id="ev4"></textarea>`;
  return `<h2>التقييم</h2><div class="row"><div><label>Case sheet evaluation</label><input id="ev1"></div><div><label>Extraction evaluation</label><input id="ev2"></div></div><label>Notes (اختياري)</label><textarea id="ev3"></textarea>`;
}
const cl=(v,m)=>Math.max(0,Math.min(m,+v||0));
function sumEv(){$("#evt").value=cl($("#ev1").value,60)+cl($("#ev2").value,15)+cl($("#ev3").value,25)}
function reqView(){
  const l=mine().filter(([i,c])=>c.clinic==="fill"&&c.status==="finished").sort((a,b)=>a[1].finished_at-b[1].finished_at);
  app.innerHTML=`<div class="top noprint">${back()}<h1>متطلبات الحشوات</h1></div><div class="card sheet"><b>Clinical requirement form (4th year)</b><div class="mut">${esc(me.name)} • ${me.group}</div>
  <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;text-align:center;font-size:14px"><tr>${["Date","Tooth No<br>Cavity 60%","Lining 15%","Filling 25%","Total 100%","Senior signature"].map(h=>`<th style="border:1px solid var(--bd);padding:6px">${h}</th>`).join("")}</tr>
  ${l.map(([i,c])=>{const e=c.ev||{};return `<tr>${[new Date(c.finished_at).toLocaleDateString("ar-IQ"),(esc(c.f.tooth||"")+"<br>"+(e.cav??"")),e.lin??"",e.fil??"",`<b>${e.total??""}</b>`,esc(c.doctor||"")].map(x=>`<td style="border:1px solid var(--bd);padding:6px">${x}</td>`).join("")}</tr>`}).join("")||'<tr><td colspan="6" class="mut" style="padding:14px">لا توجد حالات منتهية بعد</td></tr>'}</table></div>
  <p><b>عدد الحالات: ${l.length}</b></p></div><div class="bar noprint"><button onclick="window.print()">🖨 طباعة</button></div>`;
}
function formView(){
  const c=cases[view.id];if(!c){view={n:"home"};return render()}
  app.innerHTML=`<div class="top noprint">${back()}<span id="stb"></span></div><div id="ban"></div><div id="sh">${sheetHTML(c)}</div><div class="bar noprint" id="acts"></div>`;updateBar();
}
function updateBar(){
  const c=cases[view.id];if(!c||!$("#acts"))return;const s=ST[c.status];
  if($("#stb"))$("#stb").innerHTML=`<span class="badge ${s[1]}">${s[0]}</span> ${c.help?'<span class="help">مساعدة</span>':""}`;
  if(view.n==="doc"){const sh=$("#sh");if(sh&&sh.dataset.st!==tok(c)){sh.innerHTML=sheetHTML(c);sh.dataset.st=tok(c)}return docBar(c)}
  if($("#sh").dataset.st!==tok(c)){$("#sh").innerHTML=sheetHTML(c);$("#sh").dataset.st=tok(c)}
  $("#ban").innerHTML={sent:'<div class="banner bn-w">⏳ أُرسل للدكتور — بانتظار الـ Start</div>',started:'<div class="banner bn-g">✅ تم الـ Start من الدكتور — باشر العمل</div>',fin:'<div class="banner bn-b">📨 أُرسل طلب Finish — بانتظار الدكتور</div>',finished:'<div class="banner bn-b">🎉 تم الـ Finish — الملف محفوظ في «ملفاتي»</div>'}[c.status]||"";
  const hb=`<button class="${c.help?"er":""}" onclick="toggleHelp()">${c.help?"🆘 إيقاف طلب المساعدة":"🆘 طلب مساعدة"}</button>`;
  $("#acts").innerHTML=c.status==="draft"?`<button class="p" onclick="sendStart()">إرسال للدكتور للحصول على Start</button><button onclick="closeCase()">حذف</button>`:
    c.status==="sent"?`<button onclick="closeCase()">إغلاق الكيس شيت</button>`:
    c.status==="started"?hb+`<button class="ok" onclick="upd(view.id,{status:'fin',help:false,fin_at:Date.now()});updateBar()">Finish</button>`:
    c.status==="fin"?hb:c.status==="finished"?fileBtns(view.id):"";
}
const fileBtns=id=>`<button class="p" onclick="saveFile('${id}')">💾 حفظ على الهاتف</button><button onclick="window.print()">🖨 طباعة</button>`;
async function saveFile(id){const c=cases[id],nm=`${c.sname} – ${CLN[c.clinic||"surgery"]} – ${new Date(c.finished_at||c.created).toISOString().slice(0,10)}.html`;
  const html=`<!DOCTYPE html><html dir="rtl"><meta charset="utf-8"><body style="font-family:sans-serif;max-width:700px;margin:auto">${sheetHTML(c,true).replace(/<button[^>]*>(\d)<\/button>/g,"$1")}</body></html>`;
  try{
    const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download=nm;link.click();URL.revokeObjectURL(url);
  }catch(e){toast("تعذّر تنزيل الملف. استخدم زر الطباعة ثم «حفظ كـ PDF».")}}
function sendStart(){const c=cases[view.id];if(!c.f.pname){toast("أدخل اسم المريض أولاً");return}clearTimeout(saveT);upd(view.id,{f:c.f,med:c.med,teeth:c.teeth,status:"sent",sent_at:Date.now()});dirtyId=null;toast(db?"✔ تم الإرسال للدكتور":"✔ حُفظ على هاتفك وسيُرسل تلقائياً عند الاتصال");updateBar()}
function toggleHelp(){upd(view.id,{help:!cases[view.id].help});updateBar()}
function closeCase(){upd(view.id,{status:"closed",help:false});view={n:"home"};render()}
function saveNow(){clearTimeout(saveT);const id=view.id,c=cases[id];if(c&&view.n==="form"){mark(id);dirtyId=null}}
document.addEventListener("input",e=>{const target=e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement?e.target:null;if(!target)return;const k=target.dataset.k;if(!k||view.n!=="form")return;cases[view.id].f[k]=target.value;dirtyId=view.id;dirtySeq++;clearTimeout(saveT);saveT=setTimeout(saveNow,700)});
document.addEventListener("click",e=>{
  const target=e.target instanceof Element?e.target:null;if(!target)return;
  const m=target.closest("[data-m]") as HTMLElement|null,t=target.closest("[data-t]") as HTMLElement|null;
  if(m&&view.n==="form"){const[k,v]=m.dataset.m.split("|"),c=cases[view.id];if(c.med[k]===v)delete c.med[k];else c.med[k]=v;rerender();saveNow()}
  if(t&&view.n==="form"){const c=cases[view.id],k=t.dataset.t,i=c.teeth.indexOf(k);i<0?c.teeth.push(k):c.teeth.splice(i,1);rerender();saveNow()}
});
function rerender(){dirtyId=view.id;dirtySeq++;const y=scrollY;$("#sh").innerHTML=sheetHTML(cases[view.id]);scrollTo(0,y)}
function filesView(){
  let l=mine().filter(([i,c])=>c.status==="finished");
  if(!l.length&&!db){try{l=JSON.parse(ls.get("bk")||"[]")}catch(e){}}
  app.innerHTML=`<div class="top">${back()}<h1>ملفاتي</h1></div><p class="mut">نسخة احتياطية تُحفظ تلقائياً في المتصفح، ويمكنك حفظ كل ملف على هاتفك.</p>${l.map(([id,c])=>caseCard([id,c]).replace(/onclick="[^"]*"/,`onclick="view={n:'form',id:'${id}'};render()"`)).join("")||'<p class="mut">لا توجد ملفات منتهية بعد</p>'}`;
}
/* ---- Doctor ---- */
function doctorHome(){
  const l=docCases().sort((a,b)=>(b[1].help?1:0)-(a[1].help?1:0)||(a[1].sent_at||0)-(b[1].sent_at||0));
  app.innerHTML=`${head("عيادة "+CLN[me.clinic])}<div class="tabs"><button class="on">الطلاب الآن (${l.length})</button><button onclick="view={n:'arch'};render()">الأرشيف</button></div>
  ${l.map(([id,c])=>caseCard([id,c])).join("")||'<p class="mut">لا يوجد طلاب حالياً</p>'}`;
}
function archView(){
  const q=(view.q||"").trim(),l=docCases(["finished"]).filter(([i,c])=>!q||(c.sname+c.group).includes(q.toUpperCase())||c.sname.includes(q)).sort((a,b)=>b[1].finished_at-a[1].finished_at);
  app.innerHTML=`${head("الأرشيف")}<div class="tabs"><button onclick="view={n:'home'};render()">الطلاب الآن</button><button class="on">الأرشيف</button></div><input placeholder="بحث بالاسم أو الكروب" value="${esc(q)}" onchange="view.q=this.value;render()">${l.map(caseCard).join("")||'<p class="mut">لا توجد ملفات</p>'}`;
}
function docView(){
  const c=cases[view.id];if(!c){view={n:"home"};return doctorHome()}
  app.innerHTML=`<div class="top noprint">${back(c.status==="finished"?"arch":"home")}<span id="stb"></span></div><div id="sh" data-st="${tok(c)}">${sheetHTML(c)}</div><div class="card noprint hide" id="evc">${evForm(c)}</div><div class="bar noprint" id="acts"></div>`;docBar(c);
}
function docBar(c){
  if(["draft","closed"].includes(c.status)){view={n:"home"};return render()}
  const st=$("#stb");if(st)st.innerHTML=`<span class="badge ${ST[c.status][1]}">${ST[c.status][0]}</span> ${c.help?'<span class="help">🆘 مساعدة</span>':""}`;
  $("#evc").classList.toggle("hide",c.status!=="fin");
  $("#acts").innerHTML=c.status==="sent"?`<button class="ok" onclick="docStart()">✍ إعطاء Start</button>`:c.status==="fin"?`<button class="ok" onclick="docFinish()">✍ إعطاء Finish</button>`:c.status==="finished"?fileBtns(view.id):`<span class="mut">الطالب يعمل حالياً…</span>`;
}
function docStart(){const c=cases[view.id];if(c.status!=="sent"){view={n:"home"};return render()}upd(view.id,{status:"started",started_at:Date.now(),doctor:"عيادة "+CLN[me.clinic]});view={n:"home"};render()}
function docFinish(){const fl=me.clinic==="fill";
  const ev:Record<string,any>=me.clinic==="braces"?{grade:$("#ev1").value,notes:$("#ev3").value}:fl?{cav:cl($("#ev1").value,60),lin:cl($("#ev2").value,15),fil:cl($("#ev3").value,25),notes:$("#ev4").value}:{sheet:$("#ev1").value,ext:$("#ev2").value,notes:$("#ev3").value};
  if(fl)ev.total=ev.cav+ev.lin+ev.fil;
  upd(view.id,{status:"finished",finished_at:Date.now(),doctor:"عيادة "+CLN[me.clinic],help:false,ev});view={n:"home"};render()}
/* ---- Admin ---- */
function adminView(){
  view.n="adm";const R=roster();
  app.innerHTML=`${head("لوحة الأدمن")}<button class="p big" style="text-align:center" onclick="arcView()">🗄 الأرشيف وملفات الطلاب (على هذا الجهاز)</button>
  <div class="card"><h2>الطلاب</h2><p class="mut">سطر لكل طالب: الكروب|الاسم الثلاثي</p><textarea class="ta" id="a_st" style="direction:rtl;text-align:right">${esc(cfg.students)}</textarea></div>
  <div class="card"><h2>العيادات</h2>${Object.entries(CLN).map(([k,t])=>`<div class="med"><span>${t}</span><label style="margin:0"><input type="checkbox" id="o_${k}" style="width:auto" ${cfg.clinics[k].on?"checked":""}> مفعّلة</label></div>`).join("")}</div>
  <div class="card"><h2>الجدول</h2><p class="mut">كل سطر: اليوم,الفترة,العيادة,الكروبات,ملاحظة(اختياري)<br>اليوم: 6 سبت، 0 أحد، 1 اثنين، 2 ثلاثاء، 3 أربعاء • الفترة: 0 أو 1 أو 2 • العيادة: surgery perio braces(بروس) fill ortho oralmed peds</p><textarea class="ta" id="a_sc">${esc(cfg.sched)}</textarea></div>
  <div class="card"><h2>إعدادات</h2><p class="mut">تُدار كلمات المرور وصلاحيات الحسابات من Firebase Authentication، ولا تُحفظ داخل إعدادات التطبيق.</p><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="a_test" style="width:auto" ${cfg.test?"checked":""}> وضع تجريبي (تجاهل الجدول لتجربة التطبيق)</label></div>
  <button class="p big" style="text-align:center" onclick="saveCfg()">💾 حفظ كل التغييرات</button>
  <div class="card"><h2>الحسابات</h2><p class="mut">أنشئ حسابات المستخدمين واربطها بالأدوار من Firebase Authentication وقائمة users في Firestore. لا تُخزَّن كلمات المرور هنا.</p>${R.map(r=>`<div class="med"><span>${esc(r.n)} <span class="mut">${r.g}</span></span></div>`).join("")||'<p class="mut">لا يوجد طلاب</p>'}</div>
  <div class="card"><h2>طلبات البديل</h2>${swList().filter(w=>["pending","accepted"].includes(w.status)).map(w=>`<div class="med"><span>${esc(stuById(w.taker)?.n)} ← ${esc(stuById(w.giver)?.n)} • ${CLN[w.clinic]} ${SLT[w.slot]} (${w.date})</span><button onclick="swUpd('${w.id}',{status:'cancelled'});adminView()">إلغاء</button></div>`).join("")||'<p class="mut">لا توجد طلبات</p>'}</div>`;
}
function saveCfg(){
  const n:Record<string,any>={students:$("#a_st").value.trim(),sched:$("#a_sc").value.trim(),schedV:DEF.schedV,test:$("#a_test").checked?1:0,clinics:{}};
  for(const k in CLN)n.clinics[k]={on:$("#o_"+k).checked?1:0};
  cfg=n;if(db)db.collection("config").doc("main").set(n).then(()=>toast("تم الحفظ")).catch(()=>toast("تعذّر الحفظ"));adminView();
}

/* ---- Admin archive (stored on this device, IndexedDB) ---- */
const amem={};
const IDB={d:null,fail:false,
  open(){return new Promise((res,rej)=>{if(this.d)return res(this.d);try{const r=indexedDB.open("arc",1);r.onupgradeneeded=()=>r.result.createObjectStore("items",{keyPath:"id"});r.onsuccess=()=>{this.d=r.result;res(r.result)};r.onerror=()=>rej(r.error)}catch(e){rej(e)}})},
  async run(mode,fn){if(this.fail)return null;try{const d=await this.open();return await new Promise((res,rej)=>{const t=d.transaction("items",mode),rq=fn(t.objectStore("items"));t.oncomplete=()=>res(rq&&rq.result);t.onerror=()=>rej(t.error)})}catch(e){this.fail=true;toast("⚠ التخزين المحلي غير متاح في هذا المتصفح — الأرشيف مؤقت");return null}},
  async all(){const r=await this.run("readonly",s=>s.getAll());return this.fail?Object.values(amem):(r||[])},
  async put(o){if(this.fail||await this.run("readwrite",s=>s.put(o))===null&&this.fail)amem[o.id]=o},
  async del(id){delete amem[id];if(!this.fail)await this.run("readwrite",s=>s.delete(id))}};
const ARC=[["surgery","جراحة"],["braces","بروس"],["perio","بريو"],["fill","حشوات"]];
let arc={tab:"surgery",q:"",items:null},syncing=false,sc=null,delArm=null;
async function arcLoad(){arc.items=await IDB.all()||[]}
function syncArcSoon(){if(syncing)return;syncing=true;syncArc().finally(()=>syncing=false)}
async function syncArc(){
  if(arc.items===null)await arcLoad();
  const have=new Set(arc.items.map(x=>x.id));let n=0;
  for(const[id,c]of Object.entries(cases)){if(c.status==="finished"&&!have.has("c_"+id)){await IDB.put({id:"c_"+id,type:"case",clinic:c.clinic||"surgery",sname:c.sname,group:c.group,pname:(c.f&&c.f.pname)||"",date:c.finished_at||c.created,c:clone(c)});n++}}
  if(n){await arcLoad();if(view.n==="arc")arcView()}
}
async function arcView(){
  view.n="arc";if(arc.items===null)await arcLoad();
  const q=arc.q.trim().toUpperCase(),cnt=k=>arc.items.filter(x=>x.clinic===k).length;
  const l=arc.items.filter(x=>x.clinic===arc.tab&&(!q||(x.sname+" "+x.group+" "+x.pname).toUpperCase().includes(q))).sort((a,b)=>b.date-a.date);
  app.innerHTML=`<div class="top"><button onclick="view={n:'adm'};adminView()">→ الأدمن</button><h1>الأرشيف</h1></div>
  <p class="mut">محفوظ على هذا الجهاز. الملفات المنتهية والمصدّقة تُضاف تلقائياً، والورقية تضيفها أنت.</p>
  <div class="tabs" style="flex-wrap:wrap">${ARC.map(([k,t])=>`<button class="${arc.tab===k?"on":""}" onclick="arc.tab='${k}';arcView()">${t} (${cnt(k)})</button>`).join("")}</div>
  <input placeholder="بحث بالاسم أو الكروب أو اسم المريض" value="${esc(arc.q)}" onchange="arc.q=this.value;arcView()">
  <button class="p big" style="text-align:center" onclick="arcAddStart()">➕ إضافة كيس شيت ورقي (صورة)</button>
  ${l.map(x=>`<div class="card" onclick="arcOpen('${x.id}')" style="cursor:pointer"><div class="top"><b>${esc(x.sname)}</b><span class="badge ${x.type==="scan"?"b-sent":"b-fin"}">${x.type==="scan"?"📷 ورقي":"إلكتروني ✅"}</span></div><div class="mut">${esc(x.group)} • ${esc(x.pname||"—")} • ${new Date(x.date).toLocaleDateString("ar-IQ")}</div></div>`).join("")||'<p class="mut">لا توجد ملفات في هذا القسم</p>'}`;
}
function arcOpen(id){view={n:"arcdoc",id};delArm=null;arcDocView()}
function arcDocView(){
  const x=arc.items.find(i=>i.id===view.id);if(!x){return arcView()}
  let body;
  if(x.type==="case"){const cid=x.id.slice(2);if(!cases[cid])cases[cid]=x.c;body=sheetHTML(cases[cid])+`<div class="bar noprint">${fileBtns(cid)}</div>`}
  else body=`<div class="card sheet"><b>${CLN[x.clinic]} — كيس شيت ورقي</b><div class="row"><div><label>الطالب</label><div class="v">${esc(x.sname)}</div></div><div><label>الكروب</label><div class="v">${esc(x.group)}</div></div></div><label>اسم المريض</label><div class="v">${esc(x.pname||"—")}</div><label>التاريخ</label><div class="v">${esc(x.sdate||"")}</div>${x.notes?`<label>ملاحظات</label><div class="v">${esc(x.notes)}</div>`:""}
  ${x.imgs.map((im,i)=>`<label>${x.imgs.length>1?(i?"الظهر":"الوجه"):"الوجه"}</label><img class="arcimg" src="${im}">`).join("")}</div><div class="bar noprint"><button onclick="window.print()">🖨 طباعة</button></div>`;
  app.innerHTML=`<div class="top noprint"><button onclick="arcView()">→ الأرشيف</button><button class="${delArm===x.id?"er":""}" onclick="arcDel('${x.id}')">${delArm===x.id?"اضغط للتأكيد":"🗑 حذف من الأرشيف"}</button></div>${body}`;
}
async function arcDel(id){if(delArm!==id){delArm=id;return arcDocView()}await IDB.del(id);await arcLoad();delArm=null;arcView()}
const GRPS=["A","B","C"].flatMap(l=>[1,2,3,4,5,6].map(n=>l+n));
function arcAddStart(){sc={clinic:arc.tab,group:"A1",sname:"",pname:"",notes:"",date:bn().date,imgs:[]};arcAddView()}
function arcAddView(){
  view.n="arcadd";const two=["perio","fill"].includes(sc.clinic),names=roster().filter(r=>r.group===sc.group||r.g===sc.group);
  app.innerHTML=`<div class="top"><button onclick="arcView()">→ رجوع</button><h1>إضافة كيس شيت ورقي</h1></div><div class="card">
  <label>العيادة</label><select onchange="sc.clinic=this.value;sc.imgs=[];arcAddView()">${ARC.map(([k,t])=>`<option value="${k}" ${sc.clinic===k?"selected":""}>${t}</option>`).join("")}</select>
  <label>الكروب</label><select onchange="sc.group=this.value;arcAddView()">${GRPS.map(g=>`<option ${sc.group===g?"selected":""}>${g}</option>`).join("")}</select>
  <label>اسم الطالب</label><input list="nl" value="${esc(sc.sname)}" oninput="sc.sname=this.value"><datalist id="nl">${names.map(r=>`<option value="${esc(r.n)}">`).join("")}</datalist>
  <label>اسم المريض (اختياري)</label><input value="${esc(sc.pname)}" oninput="sc.pname=this.value">
  <label>التاريخ</label><input type="date" value="${sc.date}" oninput="sc.date=this.value">
  <label>ملاحظات (اختياري)</label><input value="${esc(sc.notes)}" oninput="sc.notes=this.value">
  <label>صورة الوجه ${two?"":"(الورقة كاملة)"}</label><input type="file" accept="image/*" onchange="pickImg(0,this)">
  ${two?`<label>صورة الظهر</label><input type="file" accept="image/*" onchange="pickImg(1,this)">`:""}
  <div id="prev">${sc.imgs.map(im=>`<img class="arcimg" src="${im}">`).join("")}</div>
  <button class="p big" style="text-align:center;margin-top:10px" onclick="saveScan()">💾 حفظ في الأرشيف</button></div>`;
}
async function pickImg(i,el){const f=el.files[0];if(!f)return;
  try{const b=await createImageBitmap(f),k=Math.min(1,1400/Math.max(b.width,b.height)),cv=document.createElement("canvas");cv.width=Math.round(b.width*k);cv.height=Math.round(b.height*k);cv.getContext("2d").drawImage(b,0,0,cv.width,cv.height);sc.imgs[i]=cv.toDataURL("image/jpeg",.72);$("#prev").innerHTML=sc.imgs.map(im=>im?`<img class="arcimg" src="${im}">`:"").join("")}catch(e){toast("⚠ تعذّرت قراءة الصورة")}}
async function saveScan(){
  const two=["perio","fill"].includes(sc.clinic),need=two?2:1;
  if(!sc.sname.trim())return toast("أدخل اسم الطالب");
  if(Array.from({length:need},(_,i)=>sc.imgs[i]).some(x=>!x))return toast(two?"أضف صورة الوجه والظهر":"أضف صورة الوجه");
  const id="s_"+Date.now();
  await IDB.put({id,type:"scan",clinic:sc.clinic,sname:sc.sname.trim(),group:sc.group,pname:sc.pname.trim(),notes:sc.notes.trim(),sdate:sc.date,date:new Date(sc.date).getTime()||Date.now(),imgs:sc.imgs.slice(0,need)});
  await arcLoad();arc.tab=sc.clinic;toast("✔ تمت الإضافة إلى الأرشيف");arcView();
}

/* ---- Receipt & X-ray service ---- */
const LOC={up:["فوق ⬆️","bn-g"],down:["تحت ⬇️","bn-g"],away:["غير متواجد حالياً","bn-w"]};
const SV={xray:"☢️ أشعة",receipt:"🧾 وصل"},SS={pending:["بانتظار الموظف","b-sent"],done:["تم ✅","b-started"],cancelled:["ملغي","b-draft"]};
const locBanner=()=>{const l=LOC[staff.loc]||LOC.away;return `<div class="banner ${l[1]}">📍 موظف الوصل والأشعة: ${l[0]}</div>`};
function beep(){try{navigator.vibrate&&navigator.vibrate(300);const a=new AudioContext(),o=a.createOscillator();o.connect(a.destination);o.frequency.value=880;o.start();o.stop(a.currentTime+.25)}catch(e){}}
const ago=t=>{const m=Math.max(0,Math.round((Date.now()-t)/60000));return m<1?"الآن":m<60?"منذ "+m+" د":"منذ "+Math.floor(m/60)+" س"};
function svcView(){
  const my=Object.entries(svcs).filter(([i,r])=>r.sid===me.id&&(r.status==="pending"||Date.now()-r.created<864e5)).sort((a,b)=>b[1].created-a[1].created);
  app.innerHTML=`<div class="top">${back()}<h1>وصل / أشعة</h1></div>${locBanner()}
  <button class="big" onclick="sendSvc('xray')">☢️ أخذ أشعة</button>
  <button class="big" onclick="view={n:'svcrec'};render()">🧾 أخذ وصل</button>
  <h2>طلباتي</h2>${my.map(([id,r])=>`<div class="card"><div class="top"><b>${SV[r.kind]}${r.clinic?" — "+CLN[r.clinic]:""}</b><span class="badge ${SS[r.status][1]}">${SS[r.status][0]}</span></div><div class="mut">${ago(r.created)}</div>${r.status==="pending"?`<button style="margin-top:6px" onclick="svcCancel('${id}')">إلغاء الطلب</button>`:""}</div>`).join("")||'<p class="mut">لا توجد طلبات</p>'}`;
}
function svcRecView(){
  app.innerHTML=`<div class="top"><button onclick="view={n:'svc'};render()">→ رجوع</button><h1>أخذ وصل</h1></div>${locBanner()}<p class="mut">اختر العيادة المطلوبة:</p>${Object.entries(CLN).map(([k,t])=>`<button class="big" onclick="sendSvc('receipt','${k}')">${t}</button>`).join("")}`;
}
function sendSvc(kind,clinic){
  if(!db)return toast("⚠ لا يوجد اتصال — افتح الرابط وأنت مسجّل الدخول");
  if(Object.values(svcs).some(r=>r.sid===me.id&&r.status==="pending"&&r.kind===kind&&(r.clinic||"")===(clinic||"")))return toast("لديك طلب مماثل قيد الانتظار");
  const id="q_"+Date.now()+Math.random().toString(36).slice(2,6),r:any={sid:me.id,sname:me.name,group:me.group,kind,status:"pending",created:Date.now()};if(clinic)r.clinic=clinic;
  svcs[id]=r;dbSet("svc",id,r);toast(kind==="xray"?"✔ أُرسل طلب الأشعة":"✔ أُرسل طلب الوصل — "+CLN[clinic]);view={n:"svc"};render();
}
function svcCancel(id){svcs[id].status="cancelled";dbUpd("svc",id,{status:"cancelled"});render()}
function setLoc(l){staff={loc:l,at:Date.now()};if(db)dbSet("meta","staff",staff);render()}
function svcDone(id){const p={status:"done",done_at:Date.now()};Object.assign(svcs[id],p);dbUpd("svc",id,p);render()}
function staffHome(){
  const all=Object.entries(svcs),pd=k=>all.filter(([i,r])=>r.status==="pending"&&r.kind===k).sort((a,b)=>a[1].created-b[1].created),dn=all.filter(([i,r])=>r.status==="done").sort((a,b)=>(b[1].done_at||0)-(a[1].done_at||0)).slice(0,8);
  const card=([id,r],d=false)=>`<div class="card"><div class="top"><b>${esc(r.sname)}</b><span class="mut">${r.group} • ${ago(d?r.done_at:r.created)}</span></div><div>${SV[r.kind]}${r.clinic?" — <b>"+CLN[r.clinic]+"</b>":""}</div>${d?"":`<button class="ok" style="margin-top:6px;width:100%" onclick="svcDone('${id}')">✔ تم</button>`}</div>`;
  const x=pd("xray"),rc=pd("receipt");
  app.innerHTML=`${head("الوصل والأشعة")}<h2>مكان التواجد</h2><div class="seg">${Object.entries(LOC).map(([k,v])=>`<button class="${staff.loc===k?"on":""}" onclick="setLoc('${k}')">${v[0]}</button>`).join("")}</div><p class="mut">يظهر هذا الاختيار لجميع الطلاب.</p>
  <h2>☢️ طلبات الأشعة (${x.length})</h2>${x.map(r=>card(r)).join("")||'<p class="mut">لا توجد طلبات</p>'}
  <h2>🧾 طلبات الوصل (${rc.length})</h2>${rc.map(r=>card(r)).join("")||'<p class="mut">لا توجد طلبات</p>'}
  ${dn.length?`<h2>آخر المنجَز</h2>${dn.map(r=>card(r,true)).join("")}`:""}`;
}

/* ---- visuals: page transition + gentle 3D tilt ---- */
let lastK="",enT;
const _render=render;
render=function(){_render();const k=(me?me.role:"x")+view.n+(view.id||"")+(view.pick?"p":"");if(k!==lastK){lastK=k;app.classList.remove("enter");void app.offsetWidth;app.classList.add("enter");clearTimeout(enT);enT=setTimeout(()=>app.classList.remove("enter"),900)}};
if(matchMedia("(pointer:fine)").matches&&!matchMedia("(prefers-reduced-motion:reduce)").matches){
  let cur=null;const clr=()=>{if(cur){cur.style.transform="";cur=null}};
  document.addEventListener("pointermove",e=>{const target=e.target instanceof Element?e.target:null,t=target?.closest(".card[onclick]") as HTMLElement|null;if(t!==cur)clr();if(!t)return;cur=t;const r=t.getBoundingClientRect(),px=(e.clientX-r.left)/r.width-.5,py=(e.clientY-r.top)/r.height-.5;t.style.transform=`perspective(800px) rotateX(${(-py*4).toFixed(2)}deg) rotateY(${(px*6).toFixed(2)}deg) translateY(-3px)`});
  document.addEventListener("pointerdown",clr);document.addEventListener("pointerleave",clr);
}

/* ---- role wheel (first screen) ---- */
const ROLES=[["student","🎓","طالب","افتح كيس شيت وتابع حالاتك","linear-gradient(135deg,#0d9488,#0ea5e9)"],["doctor","🩺","دكتور","استقبل الطلاب وأعطِ Start وFinish","linear-gradient(135deg,#2563eb,#7c3aed)"],["staff","🧾","موظف الوصل والأشعة","استقبل طلبات الوصل والأشعة","linear-gradient(135deg,#f59e0b,#ef4444)"],["admin","⚙️","أدمن","الطلاب والجدول والأرشيف","linear-gradient(135deg,#475569,#0f172a)"]];
let selRole="student";
function roleView(){
  app.innerHTML=`<div class="logo">🦷</div><h1 style="text-align:center">كيس شيت طب الأسنان – رابعة</h1><p class="mut" style="text-align:center;margin:0">اسحب لاختيار دورك</p>
  <div class="wheel" id="wh">${ROLES.map(r=>`<div class="rc" data-r="${r[0]}" style="background:${r[4]}"><div class="em">${r[1]}</div><b>${r[2]}</b><span>${r[3]}</span></div>`).join("")}</div>
  <div class="dots">${ROLES.map(r=>`<i data-d="${r[0]}"></i>`).join("")}</div>
  <button class="p big" style="text-align:center" id="goBtn" onclick="pickRole()">متابعة</button>${db?"":'<p class="mut" style="text-align:center">المزامنة غير متاحة — افتح الرابط وأنت مسجّل الدخول.</p>'}`;
  const wh=$("#wh"),cs=[...wh.children];let raf;
  const mid=el=>{const r=el.getBoundingClientRect();return r.left+r.width/2};
  const sync=()=>{const c=wh.getBoundingClientRect().left+wh.clientWidth/2;let best=null,bd=1e9;
    cs.forEach(el=>{const r=el.getBoundingClientRect(),d=(mid(el)-c)/180,a=Math.abs(d);el.style.transform=`translateZ(${(-a*80).toFixed(0)}px) rotateY(${(-d*42).toFixed(1)}deg) scale(${(1-Math.min(a,1.5)*.16).toFixed(3)})`;el.style.opacity=(1-Math.min(a,1.6)*.28).toFixed(2);if(a<bd){bd=a;best=el}});
    cs.forEach(el=>el.classList.toggle("act",el===best));
    if(best&&best.dataset.r!==selRole){selRole=best.dataset.r;navigator.vibrate&&navigator.vibrate(6)}
    const r=ROLES.find(x=>x[0]===selRole);$("#goBtn").textContent="متابعة كـ "+r[2];document.querySelectorAll(".dots i").forEach(i=>i.classList.toggle("on",(i as HTMLElement).dataset.d===selRole))};
  wh.addEventListener("scroll",()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(sync)});
  cs.forEach(el=>el.addEventListener("click",()=>{if(el.dataset.r===selRole)pickRole();else wh.scrollBy({left:mid(el)-(wh.getBoundingClientRect().left+wh.clientWidth/2),behavior:"smooth"})}));
  requestAnimationFrame(()=>{const el=cs.find(e=>e.dataset.r===selRole)||cs[0];wh.scrollLeft+=mid(el)-(wh.getBoundingClientRect().left+wh.clientWidth/2);sync()});
}
function pickRole(){view.role=selRole;view.pick=1;login()}

Object.assign(window,{
  adminView,arcAddStart,arcAddView,arcDel,arcOpen,arcView,closeCase,createCase,doLogin,
  docFinish,docStart,login,logout,pick,pickImg,pickRole,render,reqStage,reqSwap,
  saveCfg,saveFile,saveScan,sendStart,sendSvc,setLoc,signStage,sumEv,svcCancel,
  svcDone,swUpd,toggleHelp,upd,updateBar
});
Object.defineProperty(window,"view",{
  configurable:true,
  get:()=>view,
  set:value=>{view=value}
});
init();
