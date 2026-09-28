let notices = [];

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function formatDate(value) {
  if (!value) return "";

  return new Date(value + "T12:00:00").toLocaleDateString(
    "es-ES",
    {
      day: "numeric",
      month: "long"
    }
  );
}

function render() {

  const sorted = [...notices].sort(
    (a, b) =>
      String(b.created_at).localeCompare(
        String(a.created_at)
      )
  );

  $("#list").innerHTML =
    sorted.map((notice) => {

      const icon =
        notice.type === "evento"
          ? "🚌"
          : notice.type === "recordatorio"
          ? "🔔"
          : "📢";

      return `
        <article class="${
          notice.important ? "important" : ""
        }">

          <b>
            ${icon}
            ${escapeHtml(notice.title)}
          </b>

          <p>
            ${formatDate(notice.date)}
            ${notice.time || ""}
          </p>

          <div>
            ${escapeHtml(notice.description)}
          </div>

        </article>
      `;

    }).join("") || "<p>No hay avisos todavía.</p>";


  const future = notices
    .filter((notice) => notice.date)
    .sort((a, b) =>
      (a.date + (a.time || ""))
      .localeCompare(
        b.date + (b.time || "")
      )
    )[0];


  $("#next").innerHTML = future
    ? `
      <b>🔔 Próximo aviso</b>
      <p>
        ${escapeHtml(future.title)}
      </p>
      <small>
        ${formatDate(future.date)}
        ${future.time || ""}
      </small>
    `
    : "<p>No hay próximos eventos.</p>";


  const reminders = notices.filter(
    (notice) =>
      notice.type === "recordatorio" ||
      notice.important
  );


  $("#reminders").innerHTML =
    reminders.map((notice) => `
      <article>

        <b>
          🔔
          ${escapeHtml(notice.title)}
        </b>

        <p>
          ${formatDate(notice.date)}
          ${notice.time || ""}
        </p>

      </article>
    `).join("") ||
    "<p>No hay recordatorios.</p>";
}


async function loadNotices() {

  try {

    const response =
      await fetch("/api/notices");

    notices = await response.json();

    render();

  } catch (error) {

    console.error(error);

    $("#list").innerHTML =
      "<p>No se han podido cargar los avisos.</p>";
  }
}


$("#admin").onclick = () => {

  const password =
    prompt("Contraseña de administración");

  if (!password) return;

  sessionStorage.setItem(
    "adminPassword",
    password
  );

  $("#panel").hidden = false;
};


$("#publish").onclick = async () => {

  const title =
    $("#title").value.trim();

  if (!title) {

    alert("Escribe un título para el aviso.");

    return;
  }


  const data = {

    title: title,

    description:
      $("#desc").value.trim(),

    date:
      $("#date").value || null,

    time:
      $("#time").value || null,

    important:
      $("#important").checked

  };


  try {

    const response =
      await fetch(
        "/api/notices",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-admin-password":
              sessionStorage.getItem(
                "adminPassword"
              ) || ""
          },

          body: JSON.stringify(data)
        }
      );


    if (!response.ok) {

      alert(
        "No se ha podido publicar. Comprueba la contraseña."
      );

      return;
    }


    $("#title").value = "";
    $("#desc").value = "";
    $("#date").value = "";
    $("#time").value = "";
    $("#important").checked = false;

    $("#panel").hidden = true;

    await loadNotices();


  } catch (error) {

    console.error(error);

    alert(
      "No se ha podido conectar con el servidor."
    );
  }
};


$("#notify").onclick = async () => {

  if (!("Notification" in window)) {

    alert(
      "Este navegador no admite notificaciones."
    );

    return;
  }


  const config =
    await fetch("/api/config")
      .then((response) =>
        response.json()
      );


  if (!config.vapidPublicKey) {

    alert(
      "Las notificaciones se configurarán cuando terminemos el servidor."
    );

    return;
  }


  const permission =
    await Notification.requestPermission();


  if (permission !== "granted") {

    return;
  }


  const registration =
    await navigator.serviceWorker.register(
      "/sw.js"
    );


  const subscription =
    await registration.pushManager.subscribe({

      userVisibleOnly: true,

      applicationServerKey:
        urlBase64ToUint8Array(
          config.vapidPublicKey
        )
    });


  await fetch(
    "/api/push/subscribe",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body:
        JSON.stringify(subscription)
    }
  );


  alert(
    "🔔 Notificaciones activadas correctamente."
  );
};


function urlBase64ToUint8Array(
  base64String
) {

  const padding =
    "=".repeat(
      (4 - base64String.length % 4) % 4
    );

  const base64 =
    (
      base64String +
      padding
    )
      .replace(/-/g, "+")
      .replace(/_/g, "/");


  const rawData =
    atob(base64);


  return Uint8Array.from(
    [...rawData].map(
      (char) => char.charCodeAt(0)
    )
  );
}


if ("serviceWorker" in navigator) {

  navigator.serviceWorker.register(
    "/sw.js"
  );

}


loadNotices();
