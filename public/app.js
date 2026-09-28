const context = document.querySelector("#context");
const status = document.querySelector("#status");
const statusText = document.querySelector("#status-text");
const help = document.querySelector("#help");

function showStatus(state, message, helpMessage = "") {
  status.dataset.state = state;
  statusText.textContent = message;
  help.textContent = helpMessage;
}

function parseQrPath(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 3 || parts[1].toLowerCase() !== "mesa") return null;

  let bar;
  try {
    bar = decodeURIComponent(parts[0]).toLowerCase();
  } catch {
    return null;
  }
  const mesa = parts[2];

  if (!/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(bar)) return null;
  if (!/^\d{1,4}$/.test(mesa) || Number(mesa) < 1) return null;

  return { bar, mesa };
}

async function sendAlert(bar, mesa) {
  showStatus("sending", "Enviando aviso…", "Un momento, por favor.");
  try {
    const response = await fetch("/api/alert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bar, mesa }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      if (response.status === 503) {
        showStatus("error", "Aviso no disponible", "El servicio está desconectado. Prueba de nuevo más tarde.");
        return;
      }
      showStatus("error", "No se pudo enviar el aviso", "Puedes avisar al personal directamente.");
      return;
    }

    showStatus("success", "Aviso enviado", "El equipo del establecimiento ha recibido el aviso.");
  } catch {
    showStatus("error", "No se pudo enviar el aviso", "Comprueba tu conexión o avisa al personal directamente.");
  }
}

const qr = parseQrPath(window.location.pathname);
if (!qr) {
  context.textContent = "El enlace del código QR no es válido.";
  showStatus("error", "No se pudo identificar la mesa", "El enlace debe tener el formato /nombrebar/mesa/numero.");
} else {
  const barName = qr.bar.replaceAll("-", " ");
  context.textContent = `${barName} · Mesa ${qr.mesa}`;
  document.title = `${barName} · Mesa ${qr.mesa} | Aviso`;
  void sendAlert(qr.bar, qr.mesa);
}
