// CONTROL DE NAVEGACIÓN ENTRE PANTALLAS
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }

  // Actualizar estados de botones de navegación inferior
  document.querySelectorAll('nav.bottom button').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-screen') === screenId);
  });
}

// ASIGNACIÓN DE EVENTOS DE NAVEGACIÓN
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

// OBTENER NOTICIAS / EVENTOS DE LOCALSTORAGE
function getNotices() {
  return JSON.parse(localStorage.getItem('notices') || '[]');
}

function saveNotices(notices) {
  localStorage.setItem('notices', JSON.stringify(notices));
}

// RENDERIZAR LISTA DE EVENTOS
function renderNotices() {
  const notices = getNotices();
  const noticeList = document.getElementById('noticeList');
  const pastNoticeList = document.getElementById('pastNoticeList');
  const nextContainer = document.getElementById('next');

  if (!noticeList) return;

  noticeList.innerHTML = '';
  if (pastNoticeList) pastNoticeList.innerHTML = '';
  if (nextContainer) nextContainer.innerHTML = '';

  const now = new Date();

  // Filtrar y ordenar eventos futuros
  const futureNotices = notices.filter(n => new Date(n.date) >= now || !n.date)
                               .sort((a, b) => new Date(a.date) - new Date(b.date));

  const pastNotices = notices.filter(n => new Date(n.date) < now && n.date)
                             .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Tarjeta de próximo evento
  if (futureNotices.length > 0 && nextContainer) {
    const next = futureNotices[0];
    nextContainer.innerHTML = `
      <div class="next-tag">Próximo evento destacado</div>
      <span class="category-tag">${next.category || 'General'}</span>
      <h3 class="event-title-red">${next.title}</h3>
      <div class="event-datetime-info">
        <span>📅 ${next.date || 'Sin fecha'}</span>
        <span>🕒 ${next.time || 'Sin hora'}</span>
      </div>
      <p class="event-desc">${next.description || ''}</p>
    `;
  }

  // Renderizar lista completa de próximos
  if (futureNotices.length === 0) {
    noticeList.innerHTML = '<p class="empty-msg">No hay próximos eventos programados.</p>';
  } else {
    futureNotices.forEach((notice, index) => {
      const card = document.createElement('div');
      card.className = 'notice-card';
      card.innerHTML = `
        <span class="category-tag">${notice.category || 'General'}</span>
        <h3 class="event-title-red">${notice.title}</h3>
        <div class="event-datetime-info">
          <span>📅 ${notice.date || 'Sin fecha'}</span>
          <span>🕒 ${notice.time || 'Sin hora'}</span>
        </div>
        <p class="event-desc">${notice.description || ''}</p>
        <div class="card-actions-row">
          <button class="btn-action btn-delete" onclick="deleteNotice(${index})">Eliminar</button>
        </div>
      `;
      noticeList.appendChild(card);
    });
  }

  // Renderizar eventos pasados
  if (pastNoticeList) {
    if (pastNotices.length === 0) {
      pastNoticeList.innerHTML = '<p class="empty-msg">No hay eventos pasados.</p>';
    } else {
      pastNotices.forEach(notice => {
        const card = document.createElement('div');
        card.className = 'notice-card';
        card.innerHTML = `
          <span class="category-tag">${notice.category || 'General'}</span>
          <h3>${notice.title}</h3>
          <div class="event-datetime-info">
            <span>📅 ${notice.date}</span>
            <span>🕒 ${notice.time || ''}</span>
          </div>
          <p class="event-desc">${notice.description || ''}</p>
        `;
        pastNoticeList.appendChild(card);
      });
    }
  }
}

// PUBLICAR NUEVO EVENTO
document.getElementById('publish').addEventListener('click', () => {
  const titleInput = document.getElementById('title');
  const categoryInput = document.getElementById('category');
  const dateInput = document.getElementById('date');
  const timeInput = document.getElementById('time');
  const descriptionInput = document.getElementById('description');

  const title = titleInput.value.trim();
  const category = categoryInput.value;
  const date = dateInput.value;
  const time = timeInput.value;
  const description = descriptionInput.value.trim();

  if (!title) {
    alert('Por favor, introduce un título para el evento.');
    return;
  }

  const newNotice = {
    title: title,
    category: category,
    date: date,
    time: time,
    description: description,
    id: Date.now()
  };

  const notices = getNotices();
  notices.push(newNotice);
  saveNotices(notices);

  // Limpiar campos del formulario
  titleInput.value = '';
  dateInput.value = '';
  timeInput.value = '';
  descriptionInput.value = '';

  alert('Evento publicado con éxito');
  renderNotices();
  showScreen('home');
});

// ELIMINAR EVENTO
function deleteNotice(index) {
  if (confirm('¿Estás seguro de que deseas eliminar este evento?')) {
    const notices = getNotices();
    notices.splice(index, 1);
    saveNotices(notices);
    renderNotices();
  }
}

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
  renderNotices();
});
