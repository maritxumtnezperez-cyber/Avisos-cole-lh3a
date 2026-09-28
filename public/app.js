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

// Genera el archivo .ics con un aviso 24 horas antes
window.downloadICS = function(id) {
  const n = notices.find(x => x.id === id);
  if (!n || !n.date) {
    alert("Este evento no tiene fecha asignada.");
    return;
  }

  const escICS = s => String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

  const [yearNum, monthNum, dayNum] = n.date.split("-").map(Number);
  const [hoursNum, minutesNum] = (n.time || "09:00").split(":").map(Number);

  const startDt = new Date(yearNum, monthNum - 1, dayNum, hoursNum, minutesNum, 0);
  const endDt = new Date(startDt.getTime() + 60 * 60 * 1000); // 1 hora por defecto

  const toICSDate = (date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const dtStart = toICSDate(startDt);
  const dtEnd = toICSDate(endDt);
  const dtStamp = toICSDate(new Date());

  const uid = `event-${n.id}-${Date.now()}@avisoscole`;

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Avisos Cole LH3A//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Avisos Cole",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escICS(n.title)}`,
    `DESCRIPTION:${escICS(n.description)}`,
    "STATUS:CONFIRMED",
    "X-APPLE-DEFAULT-ALARM:FALSE",
    "X-GOOGLE-NO-DEFAULT-REMINDERS:TRUE",
    "BEGIN:VALARM",
    `X-WR-ALARMUID:alarm-${uid}`,
    "ACTION:DISPLAY",
    "TRIGGER:-P1D",
    `DESCRIPTION:${escICS("Recordatorio 24h antes: " + n.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  const icsData = icsLines.join("\r\n");

  const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${n.title.toLowerCase().replace(/[^a-z0-9áéíóúñü]+/gi, "_")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function render() {
  const sorted = [...notices].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  
  const noticeList = $("#noticeList");
  if (noticeList) {
    noticeList.innerHTML = sorted.map(n => `
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
  }

  const future = notices.filter(n => n.date).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")))[0];
  const nextCard = $("#next");
  if (nextCard) {
    nextCard.innerHTML = future ? `
      <strong>📌 Próximo Evento</strong>
      <h3>${esc(future.title)}</h3>
      <p>${fmtDate(future.date)}${future.time ? " · " + future.time : ""}</p>
    ` : "<strong>📌 Todo al día</strong><p>No hay eventos próximos.</p>";
  }

  renderCalendar();
}

function renderCalendar() {
  const first = new Date(year, month, 1), days = new Date(year, month + 1, 0).getDate(), offset = (first.getDay() + 6) % 7;
  const monthLabel = $("#monthLabel");
  if (monthLabel) monthLabel.textContent = new Date(year, month, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  
  let html = ["L", "M", "X", "J", "V", "S", "D"].map(x => `<b class="day">${x}</b>`).join("");
  for (let i = 0; i < offset; i++) html += "<span></span>";
  for (let d = 1; d <= days; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const has = notices.some(n => n.date === iso);
    html += `<span class="day ${has ? "event" : ""}">${d}</span>`;
  }
  const calendarGrid = $("#calendarGrid");
  if (calendarGrid) calendarGrid.innerHTML = html;

  const eventList = $("#eventList");
  if (eventList) {
    eventList.innerHTML = notices.filter(n => n.date && new Date(n.date + "T12:00:00").getFullYear() === year && new Date(n.date + "T12:00:00").getMonth() === month).sort((a, b) => a.date.localeCompare(b.date)).map(n => `
      <article class="card">
        <div class="badge">📅</div>
        <div style="flex:1;">
          <h3>${esc(n.title)}</h3>
          <p>${fmtDate(n.date)}${n.time ? " · " + n.time : ""}</p
