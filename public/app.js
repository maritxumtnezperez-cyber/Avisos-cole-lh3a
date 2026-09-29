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
document.getElementById('filterCategory').addEventListener('change', () => {
  renderNotices();
});

// OBTENER Y GUARDAR DE LOCALSTORAGE
function getNotices() {
  return JSON.parse(localStorage.getItem('notices') || '[]');
}

function saveNotices(notices) {
  localStorage.setItem('notices', JSON.stringify(notices));
}

// RENDERIZAR LISTAS DE EVENTOS
function renderNotices() {
  const notices = getNotices();
  const noticeList = document.getElementById('noticeList');
  const pastNoticeList = document.getElementById('pastNoticeList');
  const nextContainer = document.getElementById('next');
  const selectedFilter = document.getElementById('filterCategory').value;

  if (!noticeList) return;

  noticeList.innerHTML = '';
  if (pastNoticeList) pastNoticeList.innerHTML = '';
  if (nextContainer) nextContainer.innerHTML = '';

  const now = new Date();

  // Filtrar eventos futuros y por categoría seleccionada
  let futureNotices = notices.filter(n => new Date(n.date) >= now || !n.date)
                             .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (selectedFilter !== 'TODAS') {
    futureNotices = futureNotices.filter(n => n.category === selectedFilter);
  }

  const pastNotices = notices.filter(n => new Date(n.date) < now && n.date)
                             .sort((a, b) => new Date(b.date) - new Date(a.date));

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
  }
}

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
  renderNotices();
});
