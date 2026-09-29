let currentCalendarDate = new Date();

// CONTROL DE NAVEGACIÓN ENTRE PANTALLAS
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
  }
}

// EVENTOS DE NAVEGACIÓN
document.querySelectorAll('nav.bottom button').forEach(button => {
  button.addEventListener('click', () => {
    const screen = button.getAttribute('data-screen');
    showScreen(screen);
  });
});

document.getElementById('adminBtn').addEventListener('click', () => {
  showScreen('admin');
});

document.getElementById('backBtn').addEventListener('click', () => {
  showScreen('home');
});

// EVENTO PARA FILTRAR EVENTOS PRÓXIMOS POR CATEGORÍA
const filterCategory = document.getElementById('filterCategory');
if (filterCategory) {
  filterCategory.addEventListener('change', () => {
    renderNotices();
  });
}

// OBTENER Y GUARDAR DE LOCALSTORAGE
function getNotices() {
  return JSON.parse(localStorage.getItem('notices') || '[]');
}

function saveNotices(notices) {
  localStorage.setItem('notices', JSON.stringify(notices));
}

// RENDERIZAR LISTAS DE EVENTOS (PRÓXIMOS Y PASADOS)
function renderNotices() {
  const notices = getNotices();
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
  now.setHours(0, 0, 0, 0);

  // Filtrar eventos futuros y por categoría seleccionada
  let futureNotices = notices.filter(n => {
    if (!n.date) return true;
    const noticeDate = new Date(n.date + 'T00:00:00');
    return noticeDate >= now;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  if (selectedFilter !== 'TODAS') {
    futureNotices = futureNotices.filter(n => n.category === selectedFilter);
  }

  const pastNotices = notices.filter(n => {
    if (!n.date) return false;
    const noticeDate = new Date(n.date + 'T00:00:00');
    return noticeDate < now;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  // Tarjeta de Próximo Evento Destacado
  if (futureNotices.length > 0 && nextContainer) {
    const next = futureNotices[0];
    const imageHtml = next.image ? `<div class="img-container-full"><img src="${next.image}" alt="Imagen del evento"></div>` : '';
    nextContainer.innerHTML = `
      <div class="next-tag">Próximo evento destacado</div>
      <span class="category-tag">${next.category || 'General'}</span>
      <h3 class="event-title-red">${next.title}</h3>
      <div class="event-datetime-info">
        <span>📅 ${next.date || 'Sin fecha'}</span>
        <span>🕒 ${next.time || 'Sin hora'}</span>
      </div>
      <p class="event-desc">${next.description || ''}</p>
      ${imageHtml}
    `;
  }

  // Lista de Próximos Eventos
  if (futureNotices.length === 0) {
    noticeList.innerHTML = '<p class="empty-msg">No hay eventos programados en esta categoría.</p>';
  } else {
    futureNotices.forEach((notice) => {
      const card = document.createElement('div');
      card.className = 'notice-card';
      const imageHtml = notice.image ? `<div class="img-container-full"><img src="${notice.image}" alt="Imagen de evento"></div>` : '';
      card.innerHTML = `
        <span class="category-tag">${notice.category || 'General'}</span>
        <h3 class="event-title-red">${notice.title}</h3>
        <div class="event-datetime-info">
          <span>📅 ${notice.date || 'Sin fecha'}</span>
          <span>🕒 ${notice.time || 'Sin hora'}</span>
        </div>
        <p class="event-desc">${notice.description || ''}</p>
        ${imageHtml}
        <div class="card-actions-row">
          <button class="btn-action btn-delete" onclick="deleteNotice(${notice.id})">Eliminar</button>
        </div>
      `;
      noticeList.appendChild(card);
    });
  }

  // Lista de Eventos Pasados
  if (pastNoticeList) {
    if (pastNotices.length === 0) {
      pastNoticeList.innerHTML = '<p class="empty-msg">No hay eventos pasados.</p>';
    } else {
      pastNotices.forEach(notice => {
        const card = document.createElement('div');
        card.className = 'notice-card';
        const imageHtml = notice.image ? `<div class="img-container-full"><img src="${notice.image}" alt="Imagen de evento"></div>` : '';
        card.innerHTML = `
          <span class="category-tag">${notice.category || 'General'}</span>
          <h3>${notice.title}</h3>
          <div class="event-datetime-info">
            <span>📅 ${notice.date}</span>
            <span>🕒 ${notice.time || ''}</span>
          </div>
          <p class="event-desc">${notice.description || ''}</p>
          ${imageHtml}
        `;
        pastNoticeList.appendChild(card);
      });
    }
  }
}

// LÓGICA Y DIBUJO DEL CALENDARIO MENSUAL
function renderCalendar() {
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

  if (monthLabel) {
    monthLabel.textContent = `${monthNames[month]} ${year}`;
  }

  calendarGrid.innerHTML = '';

  // Días de la semana en la cabecera del calendario
  const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  weekDays.forEach(day => {
    const headerCell = document.createElement('div');
    headerCell.className = 'calendar-day-header';
    headerCell.textContent = day;
    calendarGrid.appendChild(headerCell);
  });

  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Lunes = 0
  const totalDays = new Date(year, month + 1, 0).getDate();

  const notices = getNotices();
  const today = new Date();

  // Celdas vacías al principio del mes
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty';
    calendarGrid.appendChild(emptyCell);
  }

  // Días del mes
  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    dayCell.textContent = day;

    const formattedDay = day < 10 ? `0${day}` : day;
    const formattedMonth = (month + 1) < 10 ? `0${month + 1}` : (month + 1);
    const dateString = `${year}-${formattedMonth}-${formattedDay}`;

    // Resaltar si es hoy
    if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
      dayCell.classList.add('today');
    }

    // Comprobar si hay eventos en esta fecha
    const hasEvent = notices.some(n => n.date === dateString);
    if (hasEvent) {
      dayCell.classList.add('has-event');
    }

    calendarGrid.appendChild(dayCell);
  }

  // Cargar lista de eventos correspondientes al mes visible
  if (monthEventsList) {
    monthEventsList.innerHTML = '';
    const monthNotices = notices.filter(n => {
      if (!n.date) return false;
      const d = new Date(n.date + 'T00:00:00');
      return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    if (monthNotices.length === 0) {
      monthEventsList.innerHTML = '<p class="empty-msg">No hay eventos en este mes.</p>';
    } else {
      monthNotices.forEach(notice => {
        const card = document.createElement('div');
        card.className = 'notice-card';
        const imageHtml = notice.image ? `<div class="img-container-full"><img src="${notice.image}" alt="Imagen de evento"></div>` : '';
        card.innerHTML = `
          <span class="category-tag">${notice.category || 'General'}</span>
          <h3 class="event-title-red">${notice.title}</h3>
          <div class="event-datetime-info">
            <span>📅 ${notice.date}</span>
            <span>🕒 ${notice.time || 'Sin hora'}</span>
          </div>
          <p class="event-desc">${notice.description || ''}</p>
          ${imageHtml}
        `;
        monthEventsList.appendChild(card);
      });
    }
  }
}

// Botones para avanzar/retroceder mes en el calendario
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

// PUBLICAR EVENTO CON LECTURA DE IMAGEN (BASE64)
document.getElementById('publish').addEventListener('click', () => {
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

  const saveAndFinish = (imageBase64 = null) => {
    const newNotice = {
      id: Date.now(),
      title: title,
      category: category,
      date: date,
      time: time,
      description: description,
      image: imageBase64
    };

    const notices = getNotices();
    notices.push(newNotice);
    saveNotices(notices);

    // Limpieza de inputs
    titleInput.value = '';
    dateInput.value = '';
    timeInput.value = '';
    descriptionInput.value = '';
    imageFileInput.value = '';

    alert('Evento publicado con éxito');
    renderNotices();
    renderCalendar();
    showScreen('home');
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

// ELIMINAR EVENTO POR ID
function deleteNotice(id) {
  if (confirm('¿Estás seguro de que deseas eliminar este evento?')) {
    let notices = getNotices();
    notices = notices.filter(n => n.id !== id);
    saveNotices(notices);
    renderNotices();
    renderCalendar();
  }
}

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
  renderNotices();
  renderCalendar();
});
