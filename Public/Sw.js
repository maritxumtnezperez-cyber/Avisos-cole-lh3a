self.addEventListener("push", (event) => {
  const data = event.data
    ? event.data.json()
    : {
        title: "Avisos Cole",
        body: "Tienes un nuevo aviso"
      };

  event.waitUntil(
    self.registration.showNotification(
      data.title || "Avisos Cole",
      {
        body: data.body || "Nuevo aviso",
        icon: "/logo.png",
        badge: "/logo.png"
      }
    )
  );
});
