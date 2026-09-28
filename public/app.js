let notices = [];
let currentType = "aviso";
let month = new Date().getMonth(), year = new Date().getFullYear();
let editingNoticeId = null;

const $ = s => document.querySelector(s); const $$ = s => [...document.querySelectorAll(s)];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

function icon(n) {
  return n.type === "evento" ? "🚌" : n.type === "recordatorio" ? "🔔" : "📢";
}

function isAdminLoggedIn() {
  return !!sessionStorage.getItem("adminPassword");
}

function renderAdminControls(n) {
  if (!isAdminLoggedIn()) return "";
  return `
    <div class="admin-actions" style="margin-top: 10px; display: flex; gap: 8px;">
      <button type="button" onclick="editNotice('${n.id}')" style="background:#f0ad4e; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">✏️ Editar</button>
      <button type="button" onclick="archiveNotice('${n.id}', ${!n.archived})" style="background:#5bc0de; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">
        ${n.archived ? "📂 Desarchivar" : "📦 Archivar"}
      </button>
      <button type="button" onclick="deleteNotice('${n.id}')" style="background:#d9534f; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">🗑️ Borrar</button>
    </div>
  `;
}

function renderImage(imageUrl) {
  if (!imageUrl) return "";
  return `<div class="notice-image" style="margin-top:8px;"><img src="${imageUrl}" alt="Adjunto" style="max-width:100%; height:auto; border-radius:8px;"></div>`;
}

function render() {
  const activeNotices = notices.filter(n => !n.archived);
  const archivedNotices = notices.filter(n => n.archived);

  const sorted = [...activeNotices].sort((a, b) => String(b.created_at || b.id).localeCompare(String(a.created_at || a.id)));
  
  $("#noticeList").innerHTML = sorted.map(n => `
    <article class="card ${n.important ? "important" : ""}">
      <div class="badge">${icon(n)}</div>
      <div style="flex:1;">
        <h3>${esc(n.title)}</h3>
        <p>${n.date ? fmtDate(n.date) : "Sin fecha"}${n.time ? " · " + n.time : ""}</p>
        <p>${esc(n.description)}</p>
        ${renderImage(n.imageUrl)}
        ${renderAdminControls(n)}
      </div>
    </article>
  `).join("") || "<p>No hay avisos activos todavía.</p>";

  const future = activeNotices.filter(n => n.date).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  $("#next").innerHTML = future ? `
    <strong>🔔 Próximo</strong>
    <h3>${esc(future.title)}</h3>
    <p>${fmtDate(future.date)}${future.time ? " · " + future.time : ""}</p>
  ` : "<strong>📌 Todo al día</strong><p>No hay próximos eventos.</p>";

  $("#reminderList").innerHTML = activeNotices.filter(n => n.type === "recordatorio" || n.important).map(n => `
    <article class="card">
      <div class="badge">🔔</div>
      <div style="flex:1;">
        <h3>${esc(n.title)}</h3>
        <p>${n.date ? fmtDate(n.date) : ""}${n.time ? " · " + n.time : ""}</p>
        <p>${esc(n.description)}</p>
        ${renderImage(n.imageUrl)}
        ${renderAdminControls(n)}
      </div>
    </article>
  `).join("") || "<p>No hay recordatorios.</p>";

  const archivedContainer = $("#archivedList");
  if (archivedContainer) {
    archivedContainer.innerHTML = archivedNotices.map(n => `
      <article class="card archived" style="opacity:0.8;">
        <div class="badge">📦</div>
        <div style="flex:1;">
          <h3>${esc(n.title)} (Archivado)</h3>
          <p>${n.date ? fmtDate(n.date) : ""}${n.time ? " · " + n.time : ""}</p>
          <p>${esc(n.description)}</p>
          ${renderImage(n.imageUrl)}
          ${renderAdminControls(n)}
        </div>
      </article>
    `).join("") || "<p>No hay avisos archivados.</p>";
  }

  renderCalendar();
}

function renderCalendar() {
  const activeNotices = notices.filter(n => !n.archived);
  const first = new Date(year, month, 1), days = new Date(year, month + 1, 0).getDate(), offset = (first.getDay() + 6) % 7;
  $("#monthLabel").textContent = new Date(year, month, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  let html = ["L", "M", "X", "J", "V", "S", "D"].map(x => `<b class="day">${x}</b>`).join("");
  for (let i = 0; i < offset; i++) html += "<span></span>";
  for (let d = 1; d <= days; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const has = activeNotices.some(n => n.date === iso);
    html += `<span class="day ${has ? "event" : ""}">${d}</span>`;
  }
  $("#calendarGrid").innerHTML = html;
  $("#eventList").innerHTML = activeNotices.filter(n => n.date && new Date(n.date + "T12:00:00").getFullYear() === year && new Date(n.date + "T12:00:00").getMonth() === month).sort((a, b) => a.date.localeCompare(b.date)).map(n => `
    <article class="card">
      <div class="badge">${icon(n)}</div>
      <div style="flex:1;">
        <h3>${esc(n.title)}</h3>
        <p>${fmtDate(n.date)}${n.time ? " · " + n.time : ""}</p>
        <p>${esc(n.description)}</p>
        ${renderImage(n.imageUrl)}
        ${renderAdminControls(n)}
      </div>
    </article>
  `).join("");
}

async function load() {
  notices = await fetch("/api/notices").then(r => r.json());
  render();
}

function show(screen) {
  $$(".screen").forEach(x => x.classList.toggle("active", x.id === screen));
  $$(".bottom button").forEach(x => x.classList.toggle("active", x.dataset.screen === screen)); }  $$
(".bottom button").forEach(b => b.onclick = () => show(b.dataset.screen));

$("#adminBtn").onclick = () => {
  const p = prompt("Contraseña de administración");
  if (p) sessionStorage.setItem("adminPassword", p);
  show("admin");
  render();
};

$("#backBtn").onclick = () => {
  resetAdminForm();
  show("home");
};

$$(".types button").forEach(b => b.onclick = () => {   $$
(".types button").forEach(x => x.classList.remove("selected"));
  b.classList.add("selected");
  currentType = b.dataset.type;
});

function getBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

$("#publish").onclick = async () => {
  const fileInput = $("#imageFile");
  const file = fileInput ? fileInput.files[0] : null;
  let imageUrl = null;

  if (file) {
    imageUrl = await getBase64(file);
  } else if (editingNoticeId) {
    const existing = notices.find(n => n.id === editingNoticeId);
    if (existing) imageUrl = existing.imageUrl;
  }

  const payload = {
    type: currentType,
    title: $("#title").value,
    description: $("#description").value,
    date: $("#date").value || null,
    time: $("#time").value || null,
    important: $("#important").checked,
    imageUrl: imageUrl
  };

  const method = editingNoticeId ? "PUT" : "POST";
  const url = editingNoticeId ? `/api/notices/${editingNoticeId}` : "/api/notices";

  const r = await fetch(url, {
    method: method,
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": sessionStorage.getItem("adminPassword") || ""
    },
    body: JSON.stringify(payload)
  });

  if (!r.ok) {
    $("#adminMsg").textContent = "Error al guardar. Comprueba la contraseña.";
    return;
  }

  $("#adminMsg").textContent = editingNoticeId ? "Aviso actualizado ✓" : "Publicado ✓";
  resetAdminForm();
  await load();
  show("home");
};

function resetAdminForm() {
  editingNoticeId = null;
  ["title", "description", "date", "time"].forEach(id => { if ($("#" + id)) $("#" + id).value = ""; });
  if ($("#important")) $("#important").checked = false;
  if ($("#imageFile")) $("#imageFile").value = "";
  if ($("#publish")) $("#publish").textContent = "Publicar aviso";
}

window.editNotice = function (id) {
  const n = notices.find(x => x.id === id);
  if (!n) return;

  editingNoticeId = id;
  currentType = n.type || "aviso";

  if ($("#title")) $("#title").value = n.title || "";
  if ($("#description")) $("#description").value = n.description || "";
  if ($("#date")) $("#date").value = n.date || "";
  if ($("#time")) $("#time").value = n.time || "";
  if ($("#important")) $("#important").checked = !!n.important;    $$(".types button").forEach(b => {
    b.classList.toggle("selected", b.dataset.type === currentType);
  });

  if ($("#publish")) $("#publish").textContent = "Guardar Cambios";
  show("admin");
};

window.deleteNotice = async function (id) {
  if (!confirm("¿Seguro que quieres borrar este aviso?")) return;
  const r = await fetch(`/api/notices/${id}`, {
    method: "DELETE",
    headers: { "x-admin-password": sessionStorage.getItem("adminPassword") || "" }
  });
  if (r.ok) { await load(); } else { alert("No se pudo borrar. Revisa la contraseña."); }
};

window.archiveNotice = async function (id, archivedState) {
  const r = await fetch(`/api/notices/${id}/archive`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": sessionStorage.getItem("adminPassword") || ""
    },
    body: JSON.stringify({ archived: archivedState })
  });
  if (r.ok) { await load(); } else { alert("Error al cambiar estado. Revisa la contraseña."); }
};

$("#prevMonth").onclick = () => { month--; if (month < 0) { month = 11; year--; } renderCalendar(); };
$("#nextMonth").onclick = () => { month++; if (month > 11) { month = 0; year++; } renderCalendar(); };

$("#notifyBtn").onclick = async () => {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) { alert("Este navegador no admite notificaciones web."); return; }
  const cfg = await fetch("/api/config").then(r => r.json());
  if (!cfg.vapidPublicKey) { alert("Las notificaciones push se activarán al configurar VAPID en el servidor."); return; }
  const reg = await navigator.serviceWorker.register("/sw.js");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(cfg.vapidPublicKey) });
  await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
  alert("Notificaciones activadas ✓");
};

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const raw = atob((base64String + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
load();
