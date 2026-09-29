const context = document.querySelector("#context");
const status = document.querySelector("#status");
const statusText = document.querySelector("#status-text");
const help = document.querySelector("#help");
const form = document.querySelector("#alert-form");
const alertType = document.querySelector("#alert-type");
const localCode = document.querySelector("#local-code");
const sendButton = document.querySelector("#send-button");

function showStatus(state, message, helpMessage = "") {
  status.dataset.state = state;
  statusText.textContent = message;
  help.textContent = helpMessage;
}

function normalizeWords(value) {
  return value.replaceAll("_", " ").trim().replace(/\s+/g, " ");
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

  return {
    local,
    nombre,
    identificador,
    tipo_de_aviso: rawType ? normalizeWords(rawType) : "",
  };
}

function showRequestError(response) {
  if (response.status === 403) {
    showStatus("error", "Código no válido o caducado", "Comprueba el código que aparece en el local y vuelve a intentarlo.");
  } else if (response.status === 429) {
    showStatus("error", "Espera un momento", "Se han realizado demasiados intentos. Prueba de nuevo dentro de un minuto.");
  } else if (response.status === 503) {
    showStatus("error", "Aviso no disponible", "El servicio o la verificación del local no están configurados.");
  } else {
    showStatus("error", "No se pudo enviar el aviso", "Comprueba los datos o avisa al personal directamente.");
  }
}

async function sendAlert(qr) {
  sendButton.disabled = true;
  showStatus("sending", "Comprobando el código…", "Un momento, por favor.");
  try {
    const response = await fetch("/api/alert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...qr,
        tipo_de_aviso: alertType.value,
        codigo: localCode.value.trim(),
      }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      showRequestError(response);
      sendButton.disabled = false;
      return;
    }

    showStatus("success", "Aviso enviado", "El equipo ha recibido el aviso.");
    localCode.value = "";
    sendButton.textContent = "Aviso enviado";
  } catch {
    showStatus("error", "No se pudo enviar el aviso", "Comprueba tu conexión o avisa al personal directamente.");
    sendButton.disabled = false;
  }
}

async function preparePage(qr) {
  const place = `${qr.nombre} ${qr.identificador}`;
  context.textContent = `${qr.local} · ${place}`;
  document.title = `${place} | Aviso QR`;
  showStatus("sending", "Preparando el aviso…", "");

  try {
    const response = await fetch(`/api/config?local=${encodeURIComponent(qr.local)}`, { cache: "no-store" });
    const config = await response.json().catch(() => ({}));
    if (!response.ok || !config.ok) {
      showStatus("error", "Este local no está configurado", "Comprueba el enlace del código QR.");
      return;
    }

    alertType.replaceChildren();
    for (const value of config.alertTypes) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      alertType.append(option);
    }

    if (qr.tipo_de_aviso) {
      const preset = config.alertTypes.find((value) => value === qr.tipo_de_aviso);
      if (!preset) {
        showStatus("error", "Este aviso no está disponible", "El tipo incluido en el QR no está habilitado para este local.");
        return;
      }
      alertType.value = preset;
    }

    localCode.pattern = `[0-9]{${config.codeLength}}`;
    localCode.maxLength = config.codeLength;
    localCode.placeholder = "0".repeat(config.codeLength);
    form.hidden = false;
    showStatus("success", "Elige el aviso e introduce el código", `El código cambia cada ${config.codePeriodSeconds} segundos.`);
  } catch {
    showStatus("error", "No se pudo cargar el formulario", "Comprueba tu conexión e inténtalo de nuevo.");
  }
}

const qr = parseQrPath(window.location.pathname);
if (!qr) {
  context.textContent = "El enlace del código QR no es válido.";
  showStatus("error", "No se pudo identificar el aviso", "Formato: /local/nombre/identificador/tipo_de_aviso (el último dato es opcional).");
} else {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (form.reportValidity()) void sendAlert(qr);
  });
  void preparePage(qr);
}

