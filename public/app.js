// FESTIVOS Y VACACIONES CURSO 2026/2027
const HOLIDAYS_2026_2027 = [
  '2026-10-12', '2026-11-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07', '2026-12-08',
  '2026-12-24', '2026-12-25', '2026-12-26', '2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
  '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04', '2027-01-05', '2027-01-06',
  '2027-02-08', '2027-02-09', '2027-02-10', '2027-02-11', '2027-02-12', '2027-03-19',
  '2027-03-22', '2027-03-23', '2027-03-24', '2027-03-25', '2027-03-26', '2027-03-27', '2027-03-28', '2027-03-29', '2027-03-30', '2027-03-31',
  '2027-04-01', '2027-04-02', '2027-05-01'
];

let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let notices = [];

const appPassword = sessionStorage.getItem("appPassword");
if (!appPassword) {
  window.location.href = "/login.html";
}

// Navegación de pestañas inferiores
document.querySelectorAll('nav.bottom button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav.bottom button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    btn.classList.add('active');
    const screenId = btn.getAttribute('data-screen');
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');
  });
});

document.getElementById('adminBtn')?.addEventListener('click', () => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('admin').classList.add('active');
});

document.getElementById('backBtn')?.addEventListener('click', () => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('home').classList.add('active');
});

// Generar URL directa para Google Calendar
function generateGoogleCalendarUrl(notice) {
  if (!notice.date) return '#';

  const title = encodeURIComponent(notice.title || 'Evento');
  const details = encodeURIComponent(notice.description || '');
  
  const timeStr = notice.time && notice.time.trim() !== '' ? notice.time : '09:00';
  const [year, month, day] = notice.date.split('-');
  const [hours, minutes] = timeStr.split(':');

  // Formato UTC/Local para Google: YYYYMMDDTHHMMSS
  const startDateStr = `${year}${month}${day}T${hours.padStart(2, '0')}${minutes.padStart(2, '0')}00`;
  
  // Calcular hora final (+1 hora por defecto)
  const endHours = String((parseInt(hours, 10) + 1) % 24).padStart(2, '0');
  const endDateStr = `${year}${month}${day}T${endHours}${minutes.padStart(2, '0')}00`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateStr}/${endDateStr}&details=${details}`;
}

// Comprobar si un evento ya ha pasado (fecha y hora exactas)
function isEventPast(notice) {
  if (!notice.date) return false;
  
  const now = new Date();
  const timeStr = notice.time && notice.time.trim() !== '' ? notice.time : '23:59';
  const [year, month, day] = notice.date.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  const eventDate = new Date(year, month - 1, day, hours, minutes, 59);
  return eventDate < now;
}

// Cargar eventos desde el servidor
async function loadNotices() {
  try {
    const res = await fetch('/api/notices', {
      headers: { 'x-app-password': appPassword }
    });
    if (res.ok) {
      notices = await res.json();
      renderAll();
    }
  } catch (err) {
    console.error("Error al cargar eventos:", err);
  }
}

function renderAll() {
  renderHomeNotices();
  renderPastNotices();
  renderCalendar();
}

// Renderizar Eventos Futuros / Próximos
function renderHomeNotices() {
  const noticeList = document.getElementById('noticeList');
  const nextCard = document.getElementById('next');
  if (!noticeList) return;

  noticeList.innerHTML = '';
  if (nextCard) nextCard.innerHTML = '';

  const upcoming = notices
    .filter(n => !isEventPast(n))
    .sort((a, b) => {
      const dateA = new Date(`${a.date || '9999-12-31'}T${a.time || '00:00'}`);
      const dateB = new Date(`${b.date || '9999-12-31'}T${b.time || '00:00'}`);
      return dateA - dateB;
    });

  if (upcoming.length === 0) {
    noticeList.innerHTML = '<p class="empty-msg">No hay próximos eventos programados.</p>';
    return;
  }

  // Tarjeta Destacada "Próximo Evento"
  const nextEvent = upcoming[0];
  if (nextCard) {
    const googleCalUrl = generateGoogleCalendarUrl(nextEvent);
    nextCard.innerHTML = `
      <div class="next-tag">📌 Próximo Evento</div>
      <h3 class="event-title-red">${nextEvent.title}</h3>
      <p class="event-datetime-info">
        <span>📅 ${nextEvent.date || ''}</span>
        ${nextEvent.time ? `<span>🕑 ${nextEvent.time}</span>` : ''}
      </p>
      ${nextEvent.imageUrl ? `<div class="img-container-full"><img src="${nextEvent.imageUrl}" alt="Imagen del evento"></div>` : ''}
      
      <a href="${googleCalUrl}" target="_blank" rel="noopener noreferrer" class="btn-action btn-add-cal" style="display: block; text-align: center; text-decoration: none; box-sizing: border-box; margin-top: 10px;">
        📅 Añadir a Google Calendar
      </a>
      
      <div class="card-actions-row" style="margin-top: 10px;">
        <button class="btn-action btn-delete" onclick="deleteNotice('${nextEvent.id}')">🗑️ Borrar</button>
      </div>
    `;
  }

  // Lista general de siguientes eventos futuros
  const listEvents = nextCard ? upcoming.slice(1) : upcoming;

  listEvents.forEach(notice => {
    const card = document.createElement('div');
    card.className = 'notice-card';
    const googleCalUrl = generateGoogleCalendarUrl(notice);
    
    card.innerHTML = `
      <h3 class="event-title-red">${notice.title}</h3>
      <p class="event-datetime-info">
        <span>📅 ${notice.date || ''}</span>
        ${notice.time ? `<span>🕑 ${notice.time}</span>` : ''}
      </p>
      
      ${notice.description ? `<p class="event-desc">${notice.description}</p>` : ''}
      ${notice.imageUrl ? `<div class="img-container-full"><img src="${notice.imageUrl}" alt="Imagen del evento"></div>` : ''}
      
      <a href="${googleCalUrl}" target="_blank" rel="noopener noreferrer" class="btn-action btn-add-cal" style="display: block; text-align: center; text-decoration: none; box-sizing: border-box;">
        📅 Añadir a Google Calendar
      </a>
      
      <div class="card-actions-row">
        <button class="btn-action btn-edit" onclick="editNotice('${notice.id}')">✏️ Editar</button>
        <button class="btn-action btn-delete" onclick="deleteNotice('${notice.id}')">🗑️ Borrar</button>
      </div>
    `;
    noticeList.appendChild(card);
  });
}

// Renderizar Eventos Pasados
function renderPastNotices() {
  const pastList = document.getElementById('pastNoticeList') || document.getElementById('pastNotices');
  if (!pastList) return;

  pastList.innerHTML = '';

  const pastEvents = notices
    .filter(n => isEventPast(n))
    .sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || '23:59'}`);
      const dateB = new Date(`${b.date}T${b.time || '23:59'}`);
      return dateB - dateA;
    });

  if (pastEvents.length === 0) {
    pastList.innerHTML = '<p class="empty-msg">No hay eventos pasados.</p>';
    return;
  }

  pastEvents.forEach(notice => {
    const card = document.createElement('div');
    card.className = 'notice-card past-card';
    
    card.innerHTML = `
      <h3 class="event-title-red" style="color: #6b7280 !important;">${notice.title}</h3>
      <p class="event-datetime-info">
        <span>📅 ${notice.date || ''}</span>
        ${notice.time ? `<span>🕑 ${notice.time}</span>` : ''}
      </p>
      
      ${notice.description ? `<p class="event-desc">${notice.description}</p>` : ''}
      ${notice.imageUrl ? `<div class="img-container-full"><img src="${notice.imageUrl}" alt="Imagen del evento"></div>` : ''}
      
      <div class="card-actions-row">
        <button class="btn-action btn-delete" onclick="deleteNotice('${notice.id}')">🗑️ Borrar</button>
      </div>
    `;
    pastList.appendChild(card);
  });
}

// Borrar Evento
window.deleteNotice = async function(id) {
  const adminPass = prompt("Introduce la contraseña de administrador para borrar:");
  if (!adminPass) return;

  try {
    const res = await fetch(`/api/notices/${id}`, {
      method: 'DELETE',
      headers: {
        'x-app-password': appPassword,
        'x-admin-password': adminPass
      }
    });
    if (res.ok) {
      loadNotices();
    } else {
      alert("Contraseña de administrador incorrecta");
    }
  } catch (err) {
    alert("Error al eliminar el evento");
  }
};

window.editNotice = function(id) {
  alert("Para editar, modifica los datos y vuelve a publicar o elimina y vuelve a crearlo.");
};

// Renderizar Calendario
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const monthLabel = document.getElementById('monthLabel');
  if (!grid || !monthLabel) return;

  grid.innerHTML = '';
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  monthLabel.textContent = `${monthNames[currentMonth]} ${currentYear}`;

  const dayHeaders = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  dayHeaders.forEach(dh => {
    const headerEl = document.createElement('div');
    headerEl.className = 'calendar-day-header';
    headerEl.textContent = dh;
    grid.appendChild(headerEl);
  });

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);

  let startingDay = firstDay.getDay() - 1;
  if (startingDay === -1) startingDay = 6;

  for (let i = 0; i < startingDay; i++) {
    const emptyEl = document.createElement('div');
    emptyEl.className = 'calendar-day empty';
    grid.appendChild(emptyEl);
  }

  const todayStr = new Date().toISOString().split('T')[0];

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = day;

    const formattedMonth = String(currentMonth + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;

    if (HOLIDAYS_2026_2027.includes(dateStr)) {
      dayEl.classList.add('holiday');
    }
    if (dateStr === todayStr) {
      dayEl.classList.add('today');
    }
    if (notices.some(n => n.date === dateStr)) {
      dayEl.classList.add('has-event');
    }

    grid.appendChild(dayEl);
  }
}

document.getElementById('prevMonth')?.addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
});

document.getElementById('nextMonth')?.addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
});

// Publicar Evento
const publishBtn = document.getElementById('publish');
if (publishBtn) {
  publishBtn.onclick = async () => {
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const imageInput = document.getElementById('imageFile');
    const msgEl = document.getElementById('adminMsg');

    if (!title) {
      if (msgEl) msgEl.textContent = "El título es obligatorio.";
      return;
    }

    const adminPass = prompt("Introduce la contraseña de administrador:");
    if (!adminPass) return;

    publishBtn.disabled = true;

    let imageUrl = null;
    if (imageInput && imageInput.files[0]) {
      const reader = new FileReader();
      imageUrl = await new Promise((resolve) => {
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(imageInput.files[0]);
      });
    }

    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-password': appPassword,
          'x-admin-password': adminPass
        },
        body: JSON.stringify({ title, description, date, time, imageUrl })
      });

      if (res.ok) {
        document.getElementById('title').value = '';
        document.getElementById('description').value = '';
        if (imageInput) imageInput.value = '';
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('home').classList.add('active');
        await loadNotices();
      } else {
        alert("Contraseña de administrador incorrecta");
      }
    } catch (err) {
      alert("Error de conexión");
    } finally {
      publishBtn.disabled = false;
    }
  };
}

loadNotices();
