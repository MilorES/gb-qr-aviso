const context = document.querySelector("#context");
const status = document.querySelector("#status");
const statusText = document.querySelector("#status-text");
const help = document.querySelector("#help");

function showStatus(state, message, helpMessage = "") {
  status.dataset.state = state;
  statusText.textContent = message;
  help.textContent = helpMessage;
}

function normalizeWords(value) {
  return value.replaceAll("_", " ").trim().replace(/\s+/g, " ");
}

function validType(value) {
  return value.length > 0
    && value.length <= 80
    && /^[\p{L}\p{N}_ -]+$/u.test(value)
    && normalizeWords(value).length > 0;
}

function parseQrPath(pathname) {
  const encodedParts = pathname.split("/").filter(Boolean);
  if (encodedParts.length !== 3 && encodedParts.length !== 4) return null;

  let parts;
  try {
    parts = encodedParts.map(decodeURIComponent);
  } catch {
    return null;
  }

  const [local, nombre, identificador, rawType] = parts;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/i.test(local)) return null;
  if (!/^[\p{L}\p{N}_-]{1,40}$/u.test(nombre)) return null;
  if (!/^[\p{L}\p{N}_-]{1,32}$/u.test(identificador)) return null;

  const tipo_de_aviso = rawType ? normalizeWords(rawType) : "Predeterminado";
  if (!validType(tipo_de_aviso)) return null;

  return {
    local: local.toLowerCase(),
    nombre,
    identificador,
    tipo_de_aviso,
  };
}

async function sendAlert(qr) {
  showStatus("sending", "Enviando aviso…", "Un momento, por favor.");
  try {
    const response = await fetch("/api/alert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(qr),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      if (response.status === 503) {
        showStatus("error", "Aviso no disponible", "El servicio está desconectado. Prueba de nuevo más tarde.");
        return;
      }
      if (response.status === 429) {
        showStatus("error", "Espera un momento", "Ya se han enviado varios avisos desde esta conexión.");
        return;
      }
      showStatus("error", "No se pudo enviar el aviso", "Puedes avisar al personal directamente.");
      return;
    }

    showStatus("success", "Aviso enviado", "El equipo ha recibido el aviso.");
  } catch {
    showStatus("error", "No se pudo enviar el aviso", "Comprueba tu conexión o avisa al personal directamente.");
  }
}

const qr = parseQrPath(window.location.pathname);
if (!qr) {
  context.textContent = "El enlace del código QR no es válido.";
  showStatus("error", "No se pudo identificar el aviso", "Formato: /local/nombre/identificador/tipo_de_aviso (el último dato es opcional).");
} else {
  const message = `${normalizeWords(qr.nombre).toLocaleUpperCase("es-ES")} ${qr.identificador} ${qr.tipo_de_aviso}`;
  context.textContent = `${qr.local} · ${message}`;
  document.title = `${message} | Aviso QR`;
  void sendAlert(qr);
}
