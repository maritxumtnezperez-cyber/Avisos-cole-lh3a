let notices=[];let currentType="aviso";let month=new Date().getMonth(),year=new Date().getFullYear();

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function fmtDate(d){if(!d)return "";return new Date(d+"T12:00:00").toLocaleDateString("es-ES",{day:"numeric",month:"long"})}
function icon(n){return n.type==="evento"?"🚌":n.type==="recordatorio"?"🔔":"📢"}
function render(){
  const sorted=[...notices].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  $("#noticeList").innerHTML=sorted.map(n=>`<article class="card ${n.important?"important":""}"><div class="badge">${icon(n)}</div><div><h3>${esc(n.title)}</h3><p>${n.date?fmtDate(n.date):"Sin fecha"}${n.time?" · "+n.time:""}</p><p>${esc(n.description)}</p></div></article>`).join("")||"<p>No hay avisos todavía.</p>";
  const future=notices.filter(n=>n.date).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
  $("#next").innerHTML=future?`<strong>🔔 Próximo</strong><h3>${esc(future.title)}</h3><p>${fmtDate(future.date)}${future.time?" · "+future.time:""}</p>`:"<strong>📌 Todo al día</strong><p>No hay próximos eventos.</p>";
  $("#reminderList").innerHTML=notices.filter(n=>n.type==="recordatorio"||n.important).map(n=>`<article class="card"><div class="badge">🔔</div><div><h3>${esc(n.title)}</h3><p>${n.date?fmtDate(n.date):""}${n.time?" · "+n.time:""}</p><p>${esc(n.description)}</p></div></article>`).join("")||"<p>No hay recordatorios.</p>";
  renderCalendar();
}
function renderCalendar(){
  const first=new Date(year,month,1),days=new Date(year,month+1,0).getDate(),offset=(first.getDay()+6)%7;
  $("#monthLabel").textContent=new Date(year,month,1).toLocaleDateString("es-ES",{month:"long",year:"numeric"});
  let html=["L","M","X","J","V","S","D"].map(x=>`<b class="day">${x}</b>`).join("");
  for(let i=0;i<offset;i++)html+="<span></span>";
  for(let d=1;d<=days;d++){const iso=`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;const has=notices.some(n=>n.date===iso);html+=`<span class="day ${has?"event":""}">${d}</span>`}
  $("#calendarGrid").innerHTML=html;
  $("#eventList").innerHTML=notices.filter(n=>n.date&&new Date(n.date+"T12:00:00").getFullYear()===year&&new Date(n.date+"T12:00:00").getMonth()===month).sort((a,b)=>a.date.localeCompare(b.date)).map(n=>`<article class="card"><div class="badge">${icon(n)}</div><div><h3>${esc(n.title)}</h3><p>${fmtDate(n.date)}${n.time?" · "+n.time:""}</p><p>${esc(n.description)}</p></div></article>`).join("");
}
async function load(){notices=await fetch("/api/notices").then(r=>r.json());render()}
function show(screen){$$(".screen").forEach(x=>x.classList.toggle("active",x.id===screen));$$(".bottom button").forEach(x=>x.classList.toggle("active",x.dataset.screen===screen))}
$$(".bottom button").forEach(b=>b.onclick=()=>show(b.dataset.screen));
$("#adminBtn").onclick=()=>{const p=prompt("Contraseña de administración");if(p)sessionStorage.setItem("adminPassword",p);show("admin")};
$("#backBtn").onclick=()=>show("home");
$$(".types button").forEach(b=>b.onclick=()=>{$$(".types button").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");currentType=b.dataset.type});
$("#publish").onclick=async()=>{
  const payload={type:currentType,title:$("#title").value,description:$("#description").value,date:$("#date").value||null,time:$("#time").value||null,important:$("#important").checked};
  const r=await fetch("/api/notices",{method:"POST",headers:{"Content-Type":"application/json","x-admin-password":sessionStorage.getItem("adminPassword")||""},body:JSON.stringify(payload)});
  if(!r.ok){$("#adminMsg").textContent="No se ha podido publicar. Comprueba la contraseña.";return}
  $("#adminMsg").textContent="Publicado ✓";["title","description","date","time"].forEach(id=>$("#"+id).value="");$("#important").checked=false;await load();show("home");
};
$("#prevMonth").onclick=()=>{month--;if(month<0){month=11;year--}renderCalendar()};
$("#nextMonth").onclick=()=>{month++;if(month>11){month=0;year++}renderCalendar()};
$("#notifyBtn").onclick=async()=>{
  if(!("Notification"in window)||!("serviceWorker"in navigator)){alert("Este navegador no admite notificaciones web.");return}
  const cfg=await fetch("/api/config").then(r=>r.json());if(!cfg.vapidPublicKey){alert("Las notificaciones push se activarán al configurar VAPID en el servidor.");return}
  const reg=await navigator.serviceWorker.register("/sw.js");const perm=await Notification.requestPermission();if(perm!=="granted")return;
  const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(cfg.vapidPublicKey)});
  await fetch("/api/push/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(sub)});alert("Notificaciones activadas ✓");
};
function urlBase64ToUint8Array(base64String){const padding="=".repeat((4-base64String.length%4)%4);const raw=atob((base64String+padding).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js");
load();