let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let notices = [];

// Comprobar autenticación de entrada
const appPassword = sessionStorage.getItem("appPassword");
if (!appPassword) {
  window.location.href = "/login.html";
}

// Navegación entre pantallas mediante pestañas inferiores
document.querySelectorAll('nav.bottom button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('nav.bottom button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    btn.classList.add('active');
    const screenId = btn.getAttribute('data-screen');
    document.getElementById(screenId).classList.add('active');
  });
});

// Botón para acceder al panel de administración/nuevo evento
document.getElementById('adminBtn')?.addEventListener('click', () => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('admin').classList.add('active');
});

document.getElementById('backBtn')?.addEventListener('click', () => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('home').classList.add('active');
});

// Cargar Avisos desde la API
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

// Renderizar todo
function renderAll() {
  renderHomeNotices();
  renderPastNotices();
  renderCalendar();
}

// Pintar avisos en Inicio y Pasados
function renderHomeNotices() {
  const noticeList = document.getElementById('noticeList');
  const nextCard = document.getElementById('next');
  if (!noticeList) return;

  noticeList.innerHTML = '';
  if (nextCard) nextCard.innerHTML = '';

  const todayStr = new Date().toISOString().split('T')[0];
  const upcoming = notices.filter(n => !n.date || n.date >= todayStr);

  if (upcoming.length === 0) {
    noticeList.innerHTML = '<p class="empty-msg">No hay próximos eventos programados.</p>';
    return;
  }

  // Evento más próximo
  if (nextCard && upcoming[0]) {
    const nextEvent = upcoming[0];
    nextCard.innerHTML = `
      <div class="tag">PRÓXIMO EVENTO</div>
      <h3>${nextEvent.title}</h3>
      <p>${nextEvent.description || ''}</p>
      <small>📅 ${nextEvent.date || 'Sin fecha'} ${nextEvent.time ? '⏰ ' + nextEvent.time : ''}</small>
    `;
  }

  // Lista restante
  upcoming.forEach(notice => {
    const card = document.createElement('div');
    card.className = 'notice-card';
    card.innerHTML = `
      <h3>${notice.title}</h3>
      <p>${notice.description || ''}</p>
      <small>📅 ${notice.date || 'Sin fecha'} ${notice.time ? '⏰ ' + notice.time : ''}</small>
      ${notice.imageUrl ? `<img src="${notice.imageUrl}" alt="Adjunto">` : ''}
    `;
    noticeList.appendChild(card);
  });
}

function renderPastNotices() {
  const pastList = document.getElementById('pastNoticeList');
  if (!pastList) return;

  pastList.innerHTML = '';
  const todayStr = new Date().toISOString().split('T')[0];
  const past = notices.filter(n => n.date && n.date < todayStr);

  if (past.length === 0) {
    pastList.innerHTML = '<p class="empty-msg">No hay eventos pasados.</p>';
    return;
  }

  past.forEach(notice => {
    const card = document.createElement('div');
    card.className = 'notice-card past';
    card.innerHTML = `
      <h3>${notice.title}</h3>
      <p>${notice.description || ''}</p>
      <small>📅 ${notice.date} ${notice.time ? '⏰ ' + notice.time : ''}</small>
    `;
    pastList.appendChild(card);
  });
}

// Renderizar Calendario Mensual
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const monthLabel = document.getElementById('monthLabel');
  if (!grid || !monthLabel) return;

  grid.innerHTML = '';

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

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

    if (dateStr === todayStr) {
      dayEl.classList.add('today');
    }

    const dayEvents = notices.filter(n => n.date === dateStr);
    if (dayEvents.length > 0) {
      dayEl.classList.add('has-event');
    }

    // Mostrar avisos del día al hacer clic en la fecha
    dayEl.addEventListener('click', () => {
      const eventList = document.getElementById('eventList');
      if (!eventList) return;
      if (dayEvents.length === 0) {
        eventList.innerHTML = `<p class="empty-msg" style="margin-top:12px;">Sin eventos para el ${day}/${currentMonth + 1}/${currentYear}</p>`;
      } else {
        eventList.innerHTML = `<h4 style="margin:12px 0 6px 0;">Eventos del ${day}/${currentMonth + 1}:</h4>` +
          dayEvents.map(e => `
            <div class="notice-card">
              <strong>${e.title}</strong>
              <p>${e.description || ''}</p>
              <small>${e.time ? '⏰ ' + e.time : ''}</small>
            </div>
          `).join('');
      }
    });

    grid.appendChild(dayEl);
  }
}

// Botones de mes anterior / siguiente
document.getElementById('prevMonth')?.addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar();
});

document.getElementById('nextMonth')?.addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar();
});

// Publicar nuevo evento
document.getElementById('publish')?.addEventListener('click', async () => {
  const adminPass = prompt("Introduce la contraseña de administrador para publicar:");
  if (!adminPass) return;

  const title = document.getElementById('title').value;
  const description = document.getElementById('description').value;
  const date = document.getElementById('date').value;
  const time = document.getElementById('time').value;
  const imageInput = document.getElementById('imageFile');
  const msgEl = document.getElementById('adminMsg');

  if (!title) {
    msgEl.textContent = "El título es obligatorio.";
    return;
  }

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
      msgEl.style.color = "#39aa6a";
      msgEl.textContent = "¡Evento publicado con éxito!";
      document.getElementById('title').value = '';
      document.getElementById('description').value = '';
      loadNotices();
    } else {
      msgEl.style.color = "#dc2626";
      msgEl.textContent = "Contraseña de administrador incorrecta.";
    }
  } catch (err) {
    msgEl.style.color = "#dc2626";
    msgEl.textContent = "Error al conectar con el servidor.";
  }
});

// Inicializar la app
loadNotices();
