let notices = [];
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

function isAdminLoggedIn() {
  return !!sessionStorage.getItem("adminPassword");
}

function renderAdminControls(n) {
  if (!isAdminLoggedIn()) return "";
  return `
    <div class="admin-actions" style="margin-top: 10px; display: flex; gap: 8px;">
      <button type="button" onclick="editNotice('${n.id}')" style="background:#f0ad4e; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">✏️ Editar</button>
      <button type="button" onclick="deleteNotice('${n.id}')" style="background:#d9534f; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;">🗑️ Borrar</button>
    </div>
  `;
}

function renderImage(imageUrl) {
  if (!imageUrl) return "";
  return `<div class="notice-image" style="margin-top:10px;"><img src="${imageUrl}" alt="Imagen adjunta" style="max-width:100%; border-radius:8px; display:block; height:auto;"></div>`;
}

// Genera y descarga el archivo .ics con recordatorios a las 24h y a las 2h antes
window.downloadICS = function(id) {
  const n = notices.find(x => x.id === id);
  if (!n || !n.date) {
    alert("Este evento no tiene fecha asignada.");
    return;
  }

  const dateStr = n.date.replace(/-/g, ""); // YYYYMMDD
  const timeStr = n.time ? n.time.replace(":", "") + "00" : "090000"; // HHMMSS
  
  // Calcular hora de fin (1 hora de duración por defecto)
  const startDt = new Date(`${n.date}T${n.time || "09:00"}:00`);
  const endDt = new Date(startDt.getTime() + 60 * 60 * 1000);
  const endYear = endDt.getFullYear();
  const endMonth = String(endDt.getMonth() + 1).padStart(2, '0');
  const endDay = String(endDt.getDate()).padStart(2, '0');
  const endHours = String(endDt.getHours()).padStart(2, '0');
  const endMinutes = String(endDt.getMinutes()).padStart(2, '0');
  const endTimeStr = `${endHours}${endMinutes}00`;
  const endDateStr = `${endYear}${endMonth}${endDay}`;

  const icsData = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Avisos Cole LH3A//ES",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:event-${n.id}@avisoscole`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART:${dateStr}T${timeStr}`,
    `DTEND:${endDateStr}T${endTimeStr}`,
    `SUMMARY:${n.title}`,
    `DESCRIPTION:${(n.description || "").replace(/\n/g, "\\n")}`,
    
    // Alarma 1: 24 horas antes
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:Recordatorio 24h antes: ${n.title}`,
    "END:VALARM",

    // Alarma 2: 2 horas antes
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:Recordatorio 2h antes: ${n.title}`,
    "END:VALARM",
    
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${n.title.toLowerCase().replace(/\s+/g, "_")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function render() {
  const sorted = [...notices].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  
  $("#noticeList").innerHTML = sorted.map(n => `
    <article class="card">
      <div class="badge">📅</div>
      <div style="flex:1;">
        <h3>${esc(n.title)}</h3>
        <p><strong>${n.date ? fmtDate(n.date) : "Sin fecha"}</strong>${n.time ? " · " + n.time : ""}</p>
        <p>${esc(n.description)}</p>
        ${renderImage(n.imageUrl)}
        <div style="margin-top:12px;">
          <button type="button" onclick="downloadICS('${n.id}')" style="background:#2fa866; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:bold;">📅 Añadir al calendario</button>
        </div>
        ${renderAdminControls(n)}
      </div>
    </article>
  `).join("") || "<p>No hay eventos creados todavía.</p>";

  const future = notices.filter(n => n.date).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  $("#next").innerHTML = future ? `
    <strong>📌 Próximo Evento</strong>
    <h3>${esc(future.title)}</h3>
    <p>${fmtDate(future.date)}${future.time ? " · " + future.time : ""}</p>
  ` : "<strong>📌 Todo al día</strong><p>No hay eventos próximos.</p>";

  renderCalendar();
}

function renderCalendar() {
  const first = new Date(year, month, 1), days = new Date(year, month + 1, 0).getDate(), offset = (first.getDay() + 6) % 7;
  $("#monthLabel").textContent = new Date(year, month, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  let html = ["L", "M", "X", "J", "V", "S", "D"].map(x => `<b class="day">${x}</b>`).join("");
  for (let i = 0; i < offset; i++) html += "<span></span>";
  for (let d = 1; d <= days; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const has = notices.some(n => n.date === iso);
    html += `<span class="day ${has ? "event" : ""}">${d}</span>`;
  }
  $("#calendarGrid").innerHTML = html;
  $("#eventList").innerHTML = notices.filter(n => n.date && new Date(n.date + "T12:00:00").getFullYear() === year && new Date(n.date + "T12:00:00").getMonth() === month).sort((a, b) => a.date.localeCompare(b.date)).map(n => `
    <article class="card">
      <div class="badge">📅</div>
      <div style="flex:1;">
        <h3>${esc(n.title)}</h3>
        <p>${fmtDate(n.date)}${n.time ? " · " + n.time : ""}</p>
        <p>${esc(n.description)}</p>
        ${renderImage(n.imageUrl)}
        <div style="margin-top:12px;">
          <button type="button" onclick="downloadICS('${n.id}')" style="background:#2fa866; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:bold;">📅 Añadir al calendario</button>
        </div>
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
    title: $("#title").value,
    description: $("#description").value,
    date: $("#date").value || null,
    time: $("#time").value || null,
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

  $("#adminMsg").textContent = editingNoticeId ? "Evento actualizado ✓" : "Publicado ✓";
  resetAdminForm();
  await load();
  show("home");
};

function resetAdminForm() {
  editingNoticeId = null;
  ["title", "description", "date", "time"].forEach(id => { if ($("#" + id)) $("#" + id).value = ""; });
  if ($("#imageFile")) $("#imageFile").value = "";
  if ($("#publish")) $("#publish").textContent = "Publicar evento";
  if ($("#adminMsg")) $("#adminMsg").textContent = "";
}

window.editNotice = function (id) {
  const n = notices.find(x => x.id === id);
  if (!n) return;

  editingNoticeId = id;

  show("admin");

  setTimeout(() => {
    if ($("#title")) $("#title").value = n.title || "";
    if ($("#description")) $("#description").value = n.description || "";
    if ($("#date")) $("#date").value = n.date || "";
    if ($("#time")) $("#time").value = n.time || "";

    if ($("#publish")) $("#publish").textContent = "Guardar Cambios";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, 50);
};

window.deleteNotice = async function (id) {
  if (!confirm("¿Seguro que quieres borrar este evento?")) return;
  const r = await fetch(`/api/notices/${id}`, {
    method: "DELETE",
    headers: { "x-admin-password": sessionStorage.getItem("adminPassword") || "" }
  });
  if (r.ok) { await load(); } else { alert("No se pudo borrar. Revisa la contraseña."); }
};

$("#prevMonth").onclick = () => { month--; if (month < 0) { month = 11; year--; } renderCalendar(); };
$("#nextMonth").onclick = () => { month++; if (month > 11) { month = 0; year++; } renderCalendar(); };

load();
