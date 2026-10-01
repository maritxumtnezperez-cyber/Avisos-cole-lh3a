// VERIFICACIÓN DE ACCESO
const savedPassword = localStorage.getItem("appPassword");

if (!savedPassword && window.location.pathname !== "/login.html") {
  window.location.replace("/login.html");
}

let currentCalendarDate = new Date();
let currentUrineDate = new Date();

// Estado de selección exclusivo para Proteínas
let proteinSelection = {
  val: 'Neg',
  color: '#fef9c3',
  textcolor: '#713f12'
};

// Formato de fecha DD/MM/AAAA
function formatDate(dateStr) {
  if (!dateStr) return 'Sin fecha';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }

  document.querySelectorAll('nav.bottom button').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-screen') === screenId);
  });

  if (screenId === 'calendar') {
    renderCalendar();
  } else if (screenId === 'stripes') {
    renderUrineModule();
  }
}

document.querySelectorAll('nav.bottom button').forEach(button => {
  button.addEventListener('click', () => {
    const screen = button.getAttribute('data-screen');
    showScreen(screen);
  });
});

const adminBtn = document.getElementById('adminBtn');
if (adminBtn) {
  adminBtn.addEventListener('click', () => {
    showScreen('admin');
  });
}

const backBtn = document.getElementById('backBtn');
if (backBtn) {
  backBtn.addEventListener('click', () => {
    showScreen('home');
  });
}

const filterCategory = document.getElementById('filterCategory');
if (filterCategory) {
  filterCategory.addEventListener('change', () => {
    renderNotices();
  });
}

// OBTENER Y MANEJAR EVENTOS GENERALES
async function getNotices() {
  try {
    const res = await fetch('/api/notices', {
      headers: { 'x-app-password': savedPassword || '' }
    });
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem("appPassword");
        window.location.replace("/login.html");
      }
      return [];
    }
    return await res.json();
  } catch (err) {
    return [];
  }
}

function getGoogleCalendarUrl(title, date, time, description) {
  if (!date) return '#';
  
  const cleanDate = date.replace(/-/g, '');
  let startTime = '090000';
  let endTime = '100000';

  if (time) {
    const cleanTime = time.replace(':', '');
    startTime = cleanTime.padEnd(4, '0') + '00';
    const hour = parseInt(cleanTime.substring(0, 2), 10);
    const endHour = (hour + 1).toString().padStart(2, '0');
    endTime = endHour + cleanTime.substring(2).padEnd(2, '0') + '00';
  }

  const dates = `${cleanDate}T${startTime}/${cleanDate}T${endTime}`;
  const details = encodeURIComponent(description || '');
  const text = encodeURIComponent(title || 'Evento');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}`;
}

function scrollToEvent(eventId) {
  const targetElement = document.getElementById(`event-card-${eventId}`);
  if (targetElement) {
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    targetElement.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
    targetElement.style.boxShadow = '0 0 15px rgba(217, 48, 37, 0.6)';
    targetElement.style.borderColor = '#d93025';
    setTimeout(() => {
      targetElement.style.boxShadow = '0 4px 10px rgba(57, 170, 106, 0.15)';
      targetElement.style.borderColor = '#39aa6a';
    }, 2000);
  }
}

async function renderNotices() {
  const notices = await getNotices();
  const noticeList = document.getElementById('noticeList');
  const pastNoticeList = document.getElementById('pastNoticeList');
  const nextContainer = document.getElementById('next');
  const filterElem = document.getElementById('filterCategory');
  const selectedFilter = filterElem ? filterElem.value : 'TODAS';

  if (!noticeList) return;

  noticeList.innerHTML = '';
  if (pastNoticeList) pastNoticeList.innerHTML = '';
  if (nextContainer) nextContainer.innerHTML = '';

  const now = new Date();

  const getEventDateTime = (dateStr, timeStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    let hour = 23, minute = 59;
    
    if (timeStr) {
      const timeParts = timeStr.split(':');
      hour = parseInt(timeParts[0], 10) || 0;
      minute = parseInt(timeParts[1], 10) || 0;
    }

    return new Date(parts[0], parts[1] - 1, parts[2], hour, minute, 0);
  };

  let futureNotices = notices.filter(n => {
    if (!n.date) return true;
    const eventDateTime = getEventDateTime(n.date, n.time);
    return eventDateTime >= now;
  }).sort((a, b) => getEventDateTime(a.date, a.time) - getEventDateTime(b.date, b.time));

  if (selectedFilter !== 'TODAS') {
    futureNotices = futureNotices.filter(n => n.category === selectedFilter);
  }

  let pastNotices = notices.filter(n => {
    if (!n.date) return false;
    const eventDateTime = getEventDateTime(n.date, n.time);
    return eventDateTime < now;
  }).sort((a, b) => getEventDateTime(b.date, b.time) - getEventDateTime(a.date, a.time));

  if (selectedFilter !== 'TODAS') {
    pastNotices = pastNotices.filter(n => n.category === selectedFilter);
  }

  if (futureNotices.length > 0 && nextContainer) {
    const next = futureNotices[0];
    
    nextContainer.innerHTML = `
      <div onclick="scrollToEvent('${next.id}')" style="background: #e6f4ea; border: 2px solid #d93025; border-radius: 12px; padding: 14px; margin-bottom: 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.08); cursor: pointer;">
        <div style="background:#137333; color:white; padding:4px 10px; border-radius:6px; font-weight:bold; display:inline-block; font-size:12px; margin-bottom:8px;">
          Próximo evento destacado
        </div>
        <br>
        <span class="category-tag">${next.category || 'General'}</span>
        <h3 style="color:#d93025; margin:8px 0; font-size: 18px;">${next.title}</h3>
        <div class="event-datetime-info" style="font-weight: bold; color: #1f2937;">
          <span>📅 ${formatDate(next.date)}</span>
          <span style="margin-left: 10px;">🕒 ${next.time || 'Sin hora'}</span>
        </div>
      </div>
    `;
  }

  if (futureNotices.length === 0) {
    noticeList.innerHTML = '<p class="empty-msg">No hay eventos programados en esta categoría.</p>';
  } else {
    futureNotices.forEach((notice) => {
      const card = document.createElement('div');
      card.className = 'notice-card';
      card.id = `event-card-${notice.id}`;
      card.style.cssText = "background:white; padding:16px; border-radius:12px; margin-bottom:12px; border: 2px solid #39aa6a; box-shadow: 0 4px 10px rgba(57, 170, 106, 0.15);";
      const imageHtml = (notice.image || notice.imageUrl) ? `<div class="img-container-full"><img src="${notice.image || notice.imageUrl}" alt="Imagen de evento" style="max-width:100%; border-radius:8px;"></div>` : '';
      const calUrl = getGoogleCalendarUrl(notice.title, notice.date, notice.time, notice.description);

      card.innerHTML = `
        <span class="category-tag">${notice.category || 'General'}</span>
        <h3 style="color:#d93025; margin:8px 0;">${notice.title}</h3>
        <div class="event-datetime-info">
          <span>📅 ${formatDate(notice.date)}</span>
          <span>🕒 ${notice.time || 'Sin hora'}</span>
        </div>
        <p class="event-desc">${notice.description || ''}</p>
        ${imageHtml}
        <div class="card-actions-column">
          ${notice.date ? `<a href="${calUrl}" target="_blank" class="btn-action btn-add-calendar">📅 Añadir a Google Calendar</a>` : ''}
          <button class="btn-action btn-delete" onclick="deleteNotice('${notice.id}')">Eliminar</button>
        </div>
      `;
      noticeList.appendChild(card);
    });
  }

  if (pastNoticeList) {
    if (pastNotices.length === 0) {
      pastNoticeList.innerHTML = '<p class="empty-msg">No hay eventos pasados.</p>';
    } else {
      pastNotices.forEach(notice => {
        const card = document.createElement('div');
        card.className = 'notice-card';
        card.style.cssText = "background:white; padding:16px; border-radius:12px; margin-bottom:12px; border: 2px solid #39aa6a; box-shadow: 0 4px 10px rgba(57, 170, 106, 0.15);";
        const imageHtml = (notice.image || notice.imageUrl) ? `<div class="img-container-full"><img src="${notice.image || notice.imageUrl}" alt="Imagen de evento" style="max-width:100%; border-radius:8px;"></div>` : '';
        card.innerHTML = `
          <span class="category-tag">${notice.category || 'General'}</span>
          <h3>${notice.title}</h3>
          <div class="event-datetime-info">
            <span>📅 ${formatDate(notice.date)}</span>
            <span>🕒 ${notice.time || ''}</span>
          </div>
          <p class="event-desc">${notice.description || ''}</p>
          ${imageHtml}
          <div class="card-actions-column">
            <button class="btn-action btn-delete" onclick="deleteNotice('${notice.id}')">Eliminar</button>
          </div>
        `;
        pastNoticeList.appendChild(card);
      });
    }
  }
}

async function renderCalendar() {
  const monthLabel = document.getElementById('monthLabel');
  const calendarGrid = document.getElementById('calendarGrid');
  const monthEventsList = document.getElementById('monthEventsList');

  if (!calendarGrid) return;

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  if (monthLabel) monthLabel.textContent = `${monthNames[month]} ${year}`;
  calendarGrid.innerHTML = '';

  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  weekDays.forEach(day => {
    const headerCell = document.createElement('div');
    headerCell.className = 'calendar-day-header';
    headerCell.textContent = day;
    calendarGrid.appendChild(headerCell);
  });

  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const notices = await getNotices();
  const today = new Date();

  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty';
    calendarGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    dayCell.textContent = day;

    const formattedDay = day < 10 ? `0${day}` : day;
    const formattedMonth = (month + 1) < 10 ? `0${month + 1}` : (month + 1);
    const dateString = `${year}-${formattedMonth}-${formattedDay}`;

    if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
      dayCell.classList.add('today');
    }

    if (notices.some(n => n.date === dateString)) {
      dayCell.classList.add('has-event');
    }

    calendarGrid.appendChild(dayCell);
  }

  if (monthEventsList) {
    monthEventsList.innerHTML = '';
    const monthNotices = notices.filter(n => {
      if (!n.date) return false;
      const parts = n.date.split('-');
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    if (monthNotices.length === 0) {
      monthEventsList.innerHTML = '<p class="empty-msg">No hay eventos en este mes.</p>';
    } else {
      monthNotices.forEach(notice => {
        const card = document.createElement('div');
        card.className = 'notice-card';
        card.style.cssText = "background:white; padding:16px; border-radius:12px; margin-bottom:12px; border: 2px solid #39aa6a; box-shadow: 0 4px 10px rgba(57, 170, 106, 0.15);";
        const imageHtml = (notice.image || notice.imageUrl) ? `<div class="img-container-full"><img src="${notice.image || notice.imageUrl}" alt="Imagen de evento" style="max-width:100%; border-radius:8px;"></div>` : '';
        const calUrl = getGoogleCalendarUrl(notice.title, notice.date, notice.time, notice.description);

        card.innerHTML = `
          <span class="category-tag">${notice.category || 'General'}</span>
          <h3 style="color:#d93025; margin:8px 0;">${notice.title}</h3>
          <div class="event-datetime-info">
            <span>📅 ${formatDate(notice.date)}</span>
            <span>🕒 ${notice.time || 'Sin hora'}</span>
          </div>
          <p class="event-desc">${notice.description || ''}</p>
          ${imageHtml}
          <div class="card-actions-column">
            <a href="${calUrl}" target="_blank" class="btn-action btn-add-calendar">📅 Añadir a Google Calendar</a>
          </div>
        `;
        monthEventsList.appendChild(card);
      });
    }
  }
}

/* ========================================================
   LÓGICA ACTUALIZADA DE PROTEÍNAS (DESDE POSTGRESQL)
======================================================== */

async function getUrineLogs() {
  try {
    const res = await fetch('/api/urine-logs', {
      headers: { 'x-app-password': savedPassword || '' }
    });
    if (!res.ok) return {};
    return await res.json();
  } catch (err) {
    return {};
  }
}

async function saveUrineLogServer(dateKey, protein, notes) {
  try {
    const res = await fetch('/api/urine-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-app-password': savedPassword || ''
      },
      body: JSON.stringify({ dateKey, protein, notes })
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

function initPillsSelector() {
  const grid = document.querySelector('.color-options-grid[data-param="proteinas"]');
  if (!grid) return;

  const pills = grid.querySelectorAll('.color-pill');
  pills.forEach(pill => {
    if (pill.getAttribute('data-val') === proteinSelection.val) {
      pill.classList.add('selected');
    }

    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');

      proteinSelection = {
        val: pill.getAttribute('data-val'),
        color: pill.getAttribute('data-color'),
        textcolor: pill.getAttribute('data-textcolor')
      };
    });
  });
}

async function renderUrineModule() {
  const year = currentUrineDate.getFullYear();
  const month = currentUrineDate.getMonth();
  const urineMonthLabel = document.getElementById('urineMonthLabel');
  const urineCalendarGrid = document.getElementById('urineCalendarGrid');
  const urineDateInput = document.getElementById('urineDate');

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  if (urineMonthLabel) urineMonthLabel.textContent = `${monthNames[month]} ${year}`;
  if (urineCalendarGrid) urineCalendarGrid.innerHTML = '';

  const todayStr = new Date().toISOString().split('T')[0];
  if (urineDateInput && !urineDateInput.value) {
    urineDateInput.value = todayStr;
  }

  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  weekDays.forEach(day => {
    const headerCell = document.createElement('div');
    headerCell.className = 'calendar-day-header';
    headerCell.textContent = day;
    urineCalendarGrid.appendChild(headerCell);
  });

  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();
  const urineLogs = await getUrineLogs();

  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty';
    urineCalendarGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    dayCell.textContent = day;

    const formattedDay = day < 10 ? `0${day}` : day;
    const formattedMonth = (month + 1) < 10 ? `0${month + 1}` : (month + 1);
    const dateString = `${year}-${formattedMonth}-${formattedDay}`;

    if (dateString === urineDateInput.value) {
      dayCell.classList.add('selected-day');
    }

    if (urineLogs[dateString]) {
      dayCell.classList.add('has-urine');
    }

    dayCell.addEventListener('click', () => {
      urineDateInput.value = dateString;
      loadUrineLogForDate(dateString);
      renderUrineModule();
    });

    urineCalendarGrid.appendChild(dayCell);
  }

  renderUrineLogsList();
}

async function loadUrineLogForDate(dateStr) {
  const urineLogs = await getUrineLogs();
  const titleElem = document.getElementById('selectedUrineDateTitle');
  if (titleElem) titleElem.textContent = `Anotar Proteínas: ${formatDate(dateStr)}`;

  if (urineLogs[dateStr]) {
    const log = urineLogs[dateStr];
    document.getElementById('urineNotes').value = log.notes || '';
    
    const proData = log.protein || { val: 'Neg', color: '#fef9c3', textcolor: '#713f12' };
    proteinSelection = proData;

    const grid = document.querySelector('.color-options-grid[data-param="proteinas"]');
    if (grid) {
      grid.querySelectorAll('.color-pill').forEach(pill => {
        if (pill.getAttribute('data-val') === proData.val) {
          pill.classList.add('selected');
        } else {
          pill.classList.remove('selected');
        }
      });
    }
  } else {
    document.getElementById('urineNotes').value = '';
  }
}

async function renderUrineLogsList() {
  const urineLogsList = document.getElementById('urineLogsList');
  if (!urineLogsList) return;

  const urineLogs = await getUrineLogs();
  const year = currentUrineDate.getFullYear();
  const month = currentUrineDate.getMonth();

  urineLogsList.innerHTML = '';

  const entries = Object.keys(urineLogs)
    .filter(dateKey => {
      const parts = dateKey.split('-');
      return parseInt(parts[0]) === year && (parseInt(parts[1]) - 1) === month;
    })
    .sort((a, b) => new Date(b) - new Date(a));

  if (entries.length === 0) {
    urineLogsList.innerHTML = '<p class="empty-msg">No hay lecturas registradas este mes.</p>';
    return;
  }

  entries.forEach(dateKey => {
    const log = urineLogs[dateKey];
    const card = document.createElement('div');
    card.style.cssText = "background:white; padding:12px; border-radius:10px; margin-bottom:10px; box-shadow:0 1px 3px rgba(0,0,0,0.08); display:flex; justify-content:space-between; flex-direction:column;";

    const proData = log.protein || { val: 'Neg', color: '#fef9c3', textcolor: '#713f12' };

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong style="color:#1e293b;">📅 ${formatDate(dateKey)}</strong>
        <button onclick="deleteUrineLog('${dateKey}')" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:16px;">🗑️</button>
      </div>
      <div>
        <span class="strip-summary-item" style="background:${proData.color}; color:${proData.textcolor}; border:1px solid rgba(0,0,0,0.1);">
          Proteínas: ${proData.val}
        </span>
      </div>
      ${log.notes ? `<p style="font-size:12px; color:#475569; margin-top:8px;">📝 ${log.notes}</p>` : ''}
    `;

    urineLogsList.appendChild(card);
  });
}

async function deleteUrineLog(dateKey) {
  if (confirm(`¿Eliminar la anotación del día ${formatDate(dateKey)}?`)) {
    try {
      const res = await fetch(`/api/urine-logs/${dateKey}`, {
        method: 'DELETE',
        headers: { 'x-app-password': savedPassword }
      });
      if (res.ok) {
        renderUrineModule();
      } else {
        alert('Error al eliminar registro');
      }
    } catch (err) {
      alert('Error de conexión al eliminar');
    }
  }
}

// EVENTOS DE LA PESTAÑA TIRAS
document.getElementById('prevUrineMonth')?.addEventListener('click', () => {
  currentUrineDate.setMonth(currentUrineDate.getMonth() - 1);
  renderUrineModule();
});

document.getElementById('nextUrineMonth')?.addEventListener('click', () => {
  currentUrineDate.setMonth(currentUrineDate.getMonth() + 1);
  renderUrineModule();
});

document.getElementById('saveUrineStrip')?.addEventListener('click', async () => {
  const dateVal = document.getElementById('urineDate').value;
  const notesVal = document.getElementById('urineNotes').value;

  if (!dateVal) {
    alert('Selecciona una fecha');
    return;
  }

  const success = await saveUrineLogServer(dateVal, proteinSelection, notesVal);
  if (success) {
    alert('Valor de proteína registrado correctamente en la nube');
    renderUrineModule();
  } else {
    alert('Error al guardar el valor en el servidor');
  }
});

// NAVEGACIÓN DE EVENTOS EN CALENDARIO GENERAL
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');

if (prevMonthBtn) {
  prevMonthBtn.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar();
  });
}

if (nextMonthBtn) {
  nextMonthBtn.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
  });
}

// PUBLICAR EVENTOS GENERALES
const publishBtn = document.getElementById('publish');
if (publishBtn) {
  publishBtn.addEventListener('click', async () => {
    const titleInput = document.getElementById('title');
    const categoryInput = document.getElementById('category');
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    const descriptionInput = document.getElementById('description');
    const imageFileInput = document.getElementById('imageFile');

    const title = titleInput.value.trim();
    const category = categoryInput.value;
    const date = dateInput.value;
    const time = timeInput.value;
    const description = descriptionInput.value.trim();
    const file = imageFileInput.files[0];

    if (!title) {
      alert('Por favor, introduce un título para el evento.');
      return;
    }

    const saveAndFinish = async (imageBase64 = null) => {
      const newNotice = {
        title: title,
        category: category,
        date: date,
        time: time,
        description: description,
        imageUrl: imageBase64
      };

      try {
        const res = await fetch('/api/notices', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-app-password': savedPassword
          },
          body: JSON.stringify(newNotice)
        });

        if (!res.ok) {
          const errData = await res.json();
          alert(errData.error || 'Error al publicar evento');
          return;
        }

        titleInput.value = '';
        dateInput.value = '';
        timeInput.value = '';
        descriptionInput.value = '';
        imageFileInput.value = '';

        alert('Evento publicado con éxito');
        renderNotices();
        renderCalendar();
        showScreen('home');
      } catch (err) {
        alert('Error al conectar con el servidor');
      }
    };

    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        saveAndFinish(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      saveAndFinish();
    }
  });
}

async function deleteNotice(id) {
  if (confirm('¿Estás seguro de que deseas eliminar este evento?')) {
    try {
      const res = await fetch(`/api/notices/${id}`, {
        method: 'DELETE',
        headers: {
          'x-app-password': savedPassword
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || 'Error al eliminar');
        return;
      }

      renderNotices();
      renderCalendar();
    } catch (err) {
      alert('Error de conexión al eliminar');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initPillsSelector();
  if (savedPassword) {
    renderNotices();
    renderCalendar();
  }
});
