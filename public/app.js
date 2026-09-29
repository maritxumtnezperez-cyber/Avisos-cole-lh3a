// Redirección inmediata a login si no hay contraseña almacenada
const globalPassword = sessionStorage.getItem('appPassword');
if (!globalPassword && window.location.pathname !== '/login.html') {
  window.location.href = '/login.html';
}

let notices = [];
let month = new Date().getMonth(), year = new Date().getFullYear();
let editingNoticeId = null;

const $ = s => document.querySelector(s); const $$ = s => [...document.querySelectorAll(s)];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function fmtDate(d) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) {
    const eventDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
    return eventDate.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
  }
  return d;
}

function isAdminLoggedIn() {
  return !!sessionStorage.getItem("adminPassword");
}

function renderAdminControls(n) {
  if (!isAdminLoggedIn()) return "";
  return `
    <div class="admin-actions" style="margin-top: 12px; display: flex; gap: 8px; border-top: 1px solid #f0f0f0; padding-top: 10px;">
      <button type="button" onclick="editNotice('${n.id}')" style="background:#f0ad4e; color:white; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:12px;">✏️ Editar</button>
      <button type="button" onclick="deleteNotice('${n.id}')" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:12px;">🗑️ Borrar</button>
    </div>
  `;
}

function renderImage(imageUrl) {
  if (!imageUrl) return "";
  return `<div class="notice-image" style="margin-top:10px;"><img src="${imageUrl}" alt="Imagen adjunta" style="max-width:100%; border-radius:12px; display:block; height:auto;"></div>`;
}

function isPastEvent(n) {
  if (!n.date) return false;
  const timeStr = n.time || "23:59";
  const parts = n.date.split("-");
  if (parts.length !== 3) return false;

  let yearNum = Number(parts[0]);
  let monthNum = Number(parts[1]);
  let dayNum = Number(parts[2]);

  if (parts[0].length === 2 && parts[2].length === 4) {
    yearNum = Number(parts[2]);
    dayNum = Number(parts[0]);
  }

  const [hours, minutes] = timeStr.split(":").map(Number);
  const eventDate = new Date(yearNum, monthNum - 1, dayNum, hours || 23, minutes || 59, 0);
  return eventDate < new Date();
}

window.downloadICS = function(id) {
  const n = notices.find(x => x.id === id);
  if (!n || !n.date) {
    alert("Este evento no tiene fecha asignada.");
    return;
  }

  const parts = n.date.split("-");
  const yearNum = Number(parts[0]);
  const monthNum = Number(parts[1]);
  const dayNum = Number(parts[2]);
  const [hoursNum, minutesNum] = (n.time || "09:00").split(":").map(Number);

  const startDate = new Date(yearNum, monthNum - 1, dayNum, hoursNum, minutesNum, 0);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const formatGoogleDate = (date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const title = encodeURIComponent(n.title || "Evento");
  const details = encodeURIComponent((n.description || "") + "\n\n📌 Recordatorio: Mañana es el evento.");
  const dates = `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`;

  if (/Android/i.test(navigator.userAgent)) {
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&add=1`, "_blank");
    return;
  }

  const dtStart = formatGoogleDate(startDate);
  const dtEnd = formatGoogleDate(endDate);
  const dtStamp = formatGoogleDate(new Date());
  const uid = `event-${n.id}-${Date.now()}@avisoscole`;

  const icsData = [
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
    `SUMMARY:${n.title}`,
    `DESCRIPTION:${n.description || ""}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:Recordatorio 24h: ${n.title}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${n.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function renderCard(n, isPast = false) {
  return `
    <article class="card">
      <div class="badge">${isPast ? "⌛" : "📅"}</div>
      <div style="flex:1;">
        <h3 style="color: #ef4444; font-weight: bold; margin: 0 0 4px 0;">${esc(n.title)}</h3>
        <p><strong>${n.date ? fmtDate(n.date) : "Sin fecha"}</strong>${n.time ? " · " + n.time : ""}</p>
        <p>${esc(n.description)}</p>
        ${renderImage(n.imageUrl)}
        ${!isPast ? `
          <div style="margin-top:12px;">
            <button type="button" onclick="downloadICS('${n.id}')" style="background:#209b59; color:white; border:none; padding:8px 12px; border-radius:10px; cursor:pointer; font-weight:bold;">📅 Añadir al calendario</button>
          </div>
        ` : ""}
        ${renderAdminControls(n)}
      </div>
    </article>
  `;
}

function render() {
  const futureNotices = notices
    .filter(n => !isPastEvent(n))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const pastNotices = notices
    .filter(n => isPastEvent(n))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const noticeList = $("#noticeList");
  if (noticeList) {
    noticeList.innerHTML = futureNotices.map(n => renderCard(n, false)).join("") || "<p style='padding:10px; color:#59645e;'>No hay eventos próximos.</p>";
  }

  const pastNoticeList = $("#pastNoticeList");
  if (pastNoticeList) {
    pastNoticeList.innerHTML = pastNotices.map(n => renderCard(n, true)).join("") || "<p style='padding:10px; color:#59645e;'>No hay eventos pasados registrados.</p>";
  }

  const future = futureNotices.find(n => n.date);
  const nextCard = $("#next");
  if (nextCard) {
    nextCard.innerHTML = future ? `
      <strong>📌 Próximo Evento</strong>
      <h3 style="color: #ef4444; font-weight: bold; margin: 4px 0;">${esc(future.title)}</h3>
      <p style="color:#59645e; margin:2px 0;">${fmtDate(future.date)}${future.time ? " · " + future.time : ""}</p>
    ` : "<strong>📌 Todo al día</strong><p style='color:#59645e; margin:2px 0;'>No hay eventos próximos.</p>";
  }

  renderCalendar();
}

function renderCalendar() {
  const first = new Date(year, month, 1), days = new Date(year, month + 1, 0).getDate(), offset = (first.getDay() + 6) % 7;
  const monthLabel = $("#monthLabel");
  if (monthLabel) monthLabel.textContent = new Date(year, month, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  
  let html = ["L", "M", "X", "J", "V", "S", "D"].map(x => `<b class="day">${x}</b>`).join("");
  for (let i = 0; i < offset; i++) html += "<span></span>";
  
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  for (let d = 1; d <= days; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const has = notices.some(n => n.date === iso);
    const isToday = isCurrentMonth && today.getDate() === d;
    html += `<span class="day ${has ? "event" : ""} ${isToday ? "today" : ""}">${d}</span>`;
  }
  const calendarGrid = $("#calendarGrid");
  if (calendarGrid) calendarGrid.innerHTML = html;

  const eventList = $("#eventList");
  if (eventList) {
    eventList.innerHTML = notices
      .filter(n => n.date && new Date(n.date + "T12:00:00").getFullYear() === year && new Date(n.date + "T12:00:00").getMonth() === month)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(n => renderCard(n, isPastEvent(n)))
      .join("");
  }
}

async function load() {
  try {
    const r = await fetch("/api/notices", {
      headers: { "x-app-password": sessionStorage.getItem("appPassword") || "" }
    });
    if (r.status === 401) {
      sessionStorage.removeItem("appPassword");
      window.location.href = "/login.html";
      return;
    }
    notices = r.ok ? await r.json() : [];
  } catch (err) {
    console.error("Error al cargar eventos:", err);
    notices = [];
  }
  render();
}

function show(screen) {
  $$(".screen").forEach(x => x.classList.toggle("active", x.id === screen));   $$
(".bottom button").forEach(x => x.classList.toggle("active", x.dataset.screen === screen));
}

function getBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

function resetAdminForm() {
  editingNoticeId = null;
  ["title", "description", "date", "time"].forEach(id => { if ($("#" + id)) $("#" + id).value = ""; });
  if ($("#imageFile")) $("#imageFile").value = "";
  if ($("#publish")) $("#publish").textContent = "Publicar evento";
  if ($("#adminMsg")) $("#adminMsg").textContent = "";
}

window.editNotice = function (id) {
  if (!isAdminLoggedIn()) return;
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
  if (!isAdminLoggedIn()) return;
  if (!confirm("¿Seguro que quieres borrar este evento?")) return;
  
  const r = await fetch(`/api/notices/${id}`, {
    method: "DELETE",
    headers: { 
      "x-admin-password": sessionStorage.getItem("adminPassword") || "",
      "x-app-password": sessionStorage.getItem("appPassword") || ""
    }
  });

  if (r.ok) { 
    await load(); 
  } else { 
    alert("No se pudo borrar. Revisa la contraseña."); 
    sessionStorage.removeItem("adminPassword");
    render();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  $$(".bottom button").forEach(b => b.onclick = () => show(b.dataset.screen));

  const adminBtn = $("#adminBtn");
  if (adminBtn) {
    adminBtn.onclick = () => {
      const p = prompt("Introduce la contraseña de administración:");
      if (p !== null && p.trim() !== "") {
        sessionStorage.setItem("adminPassword", p);
        show("admin");
        render();
      }
    };
  }

  const backBtn = $("#backBtn");
  if (backBtn) {
    backBtn.onclick = () => {
      resetAdminForm();
      show("home");
    };
  }

  const publishBtn = $("#publish");
  if (publishBtn) {
    publishBtn.onclick = async (e) => {
      e.preventDefault();
      
      const titleInput = $("#title");
      const msg = $("#adminMsg");

      if (!titleInput || !titleInput.value.trim()) {
        if (msg) msg.textContent = "⚠️ Debes escribir un título para el evento.";
        return;
      }

      let pass = sessionStorage.getItem("adminPassword");
      if (!pass) {
        pass = prompt("Introduce la contraseña de administración:");
        if (pass) sessionStorage.setItem("adminPassword", pass);
      }

      if (!pass) {
        if (msg) msg.textContent = "⚠️ Se requiere la contraseña para publicar.";
        return;
      }

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
        title: titleInput.value.trim(),
        description: $("#description") ? $("#description").value : "",
        date: $("#date") ? $("#date").value || null : null,
        time: $("#time") ? $("#time").value || null : null,
        imageUrl: imageUrl
      };

      const method = editingNoticeId ? "PUT" : "POST";
      const url = editingNoticeId ? `/api/notices/${editingNoticeId}` : "/api/notices";

      try {
        if (msg) msg.textContent = "Guardando evento...";
        
        const r = await fetch(url, {
          method: method,
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": pass,
            "x-app-password": sessionStorage.getItem("appPassword") || ""
          },
          body: JSON.stringify(payload)
        });

        if (r.status === 401) {
          sessionStorage.removeItem("adminPassword");
          if (msg) msg.textContent = "❌ Contraseña incorrecta. Vuelve a intentarlo.";
          render();
          return;
        }

        if (!r.ok) {
          if (msg) msg.textContent = "❌ Error al guardar en el servidor.";
          return;
        }

        if (msg) msg.textContent = editingNoticeId ? "Evento actualizado ✓" : "Publicado ✓";
        resetAdminForm();
        await load();
        show("home");
      } catch (err) {
        console.error("Error en la petición:", err);
        if (msg) msg.textContent = "❌ Error de conexión.";
      }
    };
  }

  const prevMonth = $("#prevMonth");
  if (prevMonth) prevMonth.onclick = () => { month--; if (month < 0) { month = 11; year--; } renderCalendar(); };
  
  const nextMonth = $("#nextMonth");
  if (nextMonth) nextMonth.onclick = () => { month++; if (month > 11) { month = 0; year++; } renderCalendar(); };

  load();
});
