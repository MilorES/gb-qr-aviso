const context = document.querySelector("#context");
const status = document.querySelector("#status");
const statusText = document.querySelector("#status-text");
const help = document.querySelector("#help");
const form = document.querySelector("#alert-form");
const localCode = document.querySelector("#local-code");
const languageSelect = document.querySelector("#language-select");
const actionButtons = [...document.querySelectorAll("[data-action]")];

const translations = {
  ca: {
    languageLabel: "Idioma", brand: "GRUP BRESTON", title: "Avís QR", checkingLink: "Comprovant l’enllaç…",
    callWaiter: "Crida el cambrer", requestBill: "Demana el compte",
    localCode: "Codi", codeHelp: "Introdueix el codi que es mostra al local.",
    checkingCode: "Comprovant el codi…", wait: "Un moment, si us plau.", sent: "Avís enviat",
    enterCode: "Introdueix el codi del local per enviar l’avís.",
    invalidCode: "Codi incorrecte o caducat", invalidCodeHelp: "Comprova el codi que es mostra al local i torna-ho a provar.",
    tooMany: "Espera un moment", tooManyHelp: "S’han fet massa intents. Torna-ho a provar d’aquí a un minut.",
    unavailable: "Avís no disponible", unavailableHelp: "El servei o la verificació del local no estan configurats.",
    sendFailed: "No s’ha pogut enviar l’avís", sendFailedHelp: "Comprova les dades o avisa el personal directament.",
    connectionFailed: "No s’ha pogut enviar l’avís", connectionFailedHelp: "Comprova la connexió o avisa el personal directament.",
    unknownLocal: "Aquest local no està configurat", checkQr: "Comprova l’enllaç del codi QR.",
    qrError: "No s’ha pogut identificar l’avís", qrFormat: "Format: /local/nom/identificador/tipus_avís (l’última dada és opcional).",
    formFailed: "No s’ha pogut carregar el formulari", retry: "Comprova la connexió i torna-ho a provar.",
    titleSuffix: "Avís QR",
  },
  es: {
    languageLabel: "Idioma", brand: "GRUPO BRESTON", title: "Aviso QR", checkingLink: "Comprobando el enlace…",
    callWaiter: "Llamar al camarero", requestBill: "Pedir la cuenta",
    localCode: "Código", codeHelp: "Introduce el código que aparece en el local.",
    checkingCode: "Comprobando el código…", wait: "Un momento, por favor.", sent: "Aviso enviado",
    enterCode: "Introduce el código del local para enviar el aviso.",
    invalidCode: "Código no válido o caducado", invalidCodeHelp: "Comprueba el código que aparece en el local y vuelve a intentarlo.",
    tooMany: "Espera un momento", tooManyHelp: "Se han realizado demasiados intentos. Prueba de nuevo dentro de un minuto.",
    unavailable: "Aviso no disponible", unavailableHelp: "El servicio o la verificación del local no están configurados.",
    sendFailed: "No se pudo enviar el aviso", sendFailedHelp: "Comprueba los datos o avisa al personal directamente.",
    connectionFailed: "No se pudo enviar el aviso", connectionFailedHelp: "Comprueba tu conexión o avisa al personal directamente.",
    unknownLocal: "Este local no está configurado", checkQr: "Comprueba el enlace del código QR.",
    qrError: "No se pudo identificar el aviso", qrFormat: "Formato: /local/nombre/identificador/tipo_de_aviso (el último dato es opcional).",
    formFailed: "No se pudo cargar el formulario", retry: "Comprueba tu conexión e inténtalo de nuevo.",
    titleSuffix: "Aviso QR",
  },
  fr: {
    languageLabel: "Langue", brand: "GROUPE BRESTON", title: "Alerte QR", checkingLink: "Vérification du lien…",
    callWaiter: "Appeler le serveur", requestBill: "Demander l’addition",
    localCode: "Code", codeHelp: "Saisissez le code affiché dans l’établissement.",
    checkingCode: "Vérification du code…", wait: "Un instant, s’il vous plaît.", sent: "Alerte envoyée",
    enterCode: "Saisissez le code de l’établissement pour envoyer l’alerte.",
    invalidCode: "Code invalide ou expiré", invalidCodeHelp: "Vérifiez le code affiché dans l’établissement et réessayez.",
    tooMany: "Veuillez patienter", tooManyHelp: "Trop de tentatives. Réessayez dans une minute.",
    unavailable: "Alerte indisponible", unavailableHelp: "Le service ou la vérification de l’établissement n’est pas configuré.",
    sendFailed: "Impossible d’envoyer l’alerte", sendFailedHelp: "Vérifiez les informations ou prévenez directement le personnel.",
    connectionFailed: "Impossible d’envoyer l’alerte", connectionFailedHelp: "Vérifiez votre connexion ou prévenez directement le personnel.",
    unknownLocal: "Cet établissement n’est pas configuré", checkQr: "Vérifiez le lien du QR code.",
    qrError: "Impossible d’identifier la demande", qrFormat: "Format : /lieu/nom/identifiant/type (le dernier élément est facultatif).",
    formFailed: "Impossible de charger le formulaire", retry: "Vérifiez votre connexion et réessayez.",
    titleSuffix: "Alerte QR",
  },
  en: {
    languageLabel: "Language", brand: "BRESTON GROUP", title: "QR alert", checkingLink: "Checking the link…",
    callWaiter: "Call the waiter", requestBill: "Ask for the bill",
    localCode: "Code", codeHelp: "Enter the code displayed at the venue.",
    checkingCode: "Checking the code…", wait: "One moment, please.", sent: "Alert sent",
    enterCode: "Enter the venue code to send the alert.",
    invalidCode: "Invalid or expired code", invalidCodeHelp: "Check the code displayed at the venue and try again.",
    tooMany: "Please wait", tooManyHelp: "Too many attempts. Try again in one minute.",
    unavailable: "Alert unavailable", unavailableHelp: "The service or venue verification is not configured.",
    sendFailed: "Could not send the alert", sendFailedHelp: "Check the details or contact a staff member directly.",
    connectionFailed: "Could not send the alert", connectionFailedHelp: "Check your connection or contact a staff member directly.",
    unknownLocal: "This venue is not configured", checkQr: "Check the QR code link.",
    qrError: "Could not identify the alert", qrFormat: "Format: /venue/name/identifier/alert_type (the last part is optional).",
    formFailed: "Could not load the form", retry: "Check your connection and try again.",
    titleSuffix: "QR alert",
  },
};

let language = "ca";
let currentQr = null;
let currentStatus = { state: "", message: "", help: "" };
let pageLocation = "";

function t(key, values = {}) {
  let result = translations[language][key] || translations.ca[key] || key;
  for (const [name, value] of Object.entries(values)) result = result.replaceAll(`{${name}}`, String(value));
  return result;
}

function showStatus(state, message, helpMessage = "", values = {}) {
  status.hidden = false;
  currentStatus = { state, message, help: helpMessage, values };
  status.dataset.state = state;
  statusText.textContent = t(message, values);
  help.textContent = helpMessage ? t(helpMessage, values) : "";
  help.hidden = !helpMessage;
}

function renderContext() {
  if (!currentQr) return;
  pageLocation = `${normalizeWords(currentQr.nombre)} ${currentQr.identificador}`;
  context.textContent = `${normalizeWords(currentQr.local)} · ${pageLocation}`;
  document.title = `${pageLocation} | ${t("titleSuffix")}`;
}

function setLanguage(nextLanguage) {
  language = Object.hasOwn(translations, nextLanguage) ? nextLanguage : "ca";
  document.documentElement.lang = language;
  languageSelect.value = language;
  languageSelect.setAttribute("aria-label", t("languageLabel"));
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  statusText.textContent = currentStatus.message ? t(currentStatus.message, currentStatus.values) : "";
  help.textContent = currentStatus.help ? t(currentStatus.help, currentStatus.values) : "";
  renderContext();
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
  if (!/^[a-z0-9](?:[a-z0-9_-]{0,48}[a-z0-9])?$/i.test(local)) return null;
  if (!/^[\p{L}\p{N}_-]{1,40}$/u.test(nombre)) return null;
  if (!/^[\p{L}\p{N}_-]{1,32}$/u.test(identificador)) return null;

  return {
    local,
    nombre,
    identificador,
    tipo_de_aviso: rawType ? normalizeWords(rawType) : "",
  };
}

function suggestQrAction(qr, config) {
  if (!qr.tipo_de_aviso) return;
  const wanted = normalizeWords(qr.tipo_de_aviso).toLocaleLowerCase();
  const aliases = {
    callWaiter: ["pedir", "cridar el cambrer", "llamar al camarero", "call the waiter", "appeler le serveur"],
    requestBill: ["pedir cuenta", "pedir la cuenta", "demanar el compte", "tiquet", "ask for the bill", "demander l’addition"],
  };
  const action = Object.entries(config.actions || {}).find(([key, messageType]) => {
    return normalizeWords(messageType).toLocaleLowerCase() === wanted || aliases[key]?.includes(wanted);
  })?.[0];
  for (const button of actionButtons) {
    button.classList.toggle("is-suggested", button.dataset.action === action);
  }
}

function showRequestError(response) {
  if (response.status === 403) {
    showStatus("error", "invalidCode", "invalidCodeHelp");
  } else if (response.status === 429) {
    showStatus("error", "tooMany", "tooManyHelp");
  } else if (response.status === 503) {
    showStatus("error", "unavailable", "unavailableHelp");
  } else {
    showStatus("error", "sendFailed", "sendFailedHelp");
  }
}

async function sendAlert(qr, button) {
  if (!form.reportValidity()) {
    showStatus("error", "enterCode", "codeHelp");
    localCode.focus();
    return;
  }
  const code = localCode.value.trim();
  localCode.value = "";
  actionButtons.forEach((actionButton) => { actionButton.disabled = true; });
  showStatus("sending", "checkingCode", "wait");
  try {
    const response = await fetch("/api/alert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...qr,
        tipo_de_aviso: button.dataset.alertType,
        language,
        codigo: code,
      }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      showRequestError(response);
      actionButtons.forEach((actionButton) => { actionButton.disabled = false; });
      return;
    }

    showStatus("success", "sent");
    window.setTimeout(() => {
      actionButtons.forEach((actionButton) => { actionButton.disabled = false; });
    }, 2000);
  } catch {
    showStatus("error", "connectionFailed", "connectionFailedHelp");
    actionButtons.forEach((actionButton) => { actionButton.disabled = false; });
  }
}

async function preparePage(qr) {
  currentQr = qr;
  renderContext();
  try {
    const response = await fetch(`/api/config?local=${encodeURIComponent(qr.local)}`, { cache: "no-store" });
    const config = await response.json().catch(() => ({}));
    if (!response.ok || !config.ok) {
      showStatus("error", "unknownLocal", "checkQr");
      return;
    }

    localCode.pattern = `[0-9]{${config.codeLength}}`;
    localCode.maxLength = config.codeLength;
    localCode.placeholder = "0".repeat(config.codeLength);
    for (const button of actionButtons) {
      const messageType = config.actions?.[button.dataset.action];
      if (!messageType) {
        showStatus("error", "unavailable", "unavailableHelp");
        return;
      }
      button.dataset.alertType = messageType;
    }
    suggestQrAction(qr, config);
    form.hidden = false;
    status.hidden = true;
  } catch {
    showStatus("error", "formFailed", "retry");
  }
}

let savedLanguage = "ca";
try {
  savedLanguage = localStorage.getItem("gb-qr-aviso-language") || "ca";
} catch {
  // Keep Catalan as the default when browser storage is unavailable.
}
setLanguage(savedLanguage);
languageSelect.addEventListener("change", () => {
  setLanguage(languageSelect.value);
  try { localStorage.setItem("gb-qr-aviso-language", language); } catch { /* Language remains active for this page. */ }
});
form.addEventListener("submit", (event) => event.preventDefault());

const qr = parseQrPath(window.location.pathname);
if (!qr) {
  context.textContent = t("qrError");
  showStatus("error", "qrError", "qrFormat");
} else {
  for (const button of actionButtons) {
    button.addEventListener("click", () => { void sendAlert(qr, button); });
  }
  void preparePage(qr);
}
