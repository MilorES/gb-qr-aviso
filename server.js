import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import mqtt from "mqtt";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");
const PORT = Number(process.env.PORT || 3000);
const MQTT_URL = process.env.MQTT_URL;
const LOCAL_CODE_SECRET = process.env.LOCAL_CODE_SECRET || "";
if (LOCAL_CODE_SECRET && Buffer.byteLength(LOCAL_CODE_SECRET, "utf8") < 32) {
  throw new Error("LOCAL_CODE_SECRET must contain at least 32 bytes");
}
const CODE_PERIOD_SECONDS = Number(process.env.LOCAL_CODE_PERIOD_SECONDS || 30);
const CODE_LENGTH = 6;
if (!Number.isInteger(CODE_PERIOD_SECONDS) || CODE_PERIOD_SECONDS < 10 || CODE_PERIOD_SECONDS > 3600) {
  throw new Error("LOCAL_CODE_PERIOD_SECONDS must be between 10 and 3600");
}
const VALID_LOCALS = [...new Set((process.env.VALID_LOCALS || "")
  .split(",").map((value) => value.trim()).filter(Boolean))];
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const INVALID_CODE_LIMIT = 10;
const requestsByIp = new Map();
const invalidCodesByClient = new Map();

let mqttConnected = false;
let mqttClient;
let codePublishTimer;

function normalizeWords(value) {
  return value.replaceAll("_", " ").trim().replace(/\s+/g, " ");
}

function parseAlertTypes(value) {
  const defaults = "Predeterminado,Pedir_Cuenta,Cobrar_en_VISA";
  return [...new Set((value || defaults).split(",").map(normalizeWords).filter(validType))];
}

const ALERT_TYPES = parseAlertTypes(process.env.ALERT_TYPES);
if (ALERT_TYPES.length === 0) throw new Error("ALERT_TYPES must contain at least one valid alert type");

function validLocalName(value) {
  return /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/i.test(value);
}

function isKnownLocal(value) {
  return typeof value === "string" && VALID_LOCALS.includes(value);
}

function codeFor(local, timeSlot) {
  const digest = createHmac("sha256", LOCAL_CODE_SECRET)
    .update(`${local}:${timeSlot}`)
    .digest();
  return String(digest.readUInt32BE(0) % (10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

function isValidLocalCode(local, submittedCode) {
  if (!LOCAL_CODE_SECRET || !/^\d{6}$/.test(submittedCode)) return false;
  const currentSlot = Math.floor(Date.now() / (CODE_PERIOD_SECONDS * 1000));
  const submitted = Buffer.from(submittedCode);
  return [currentSlot, currentSlot - 1].some((slot) => {
    const expected = Buffer.from(codeFor(local, slot));
    return timingSafeEqual(submitted, expected);
  });
}

function tooManyInvalidCodes(ip, local) {
  const key = `${ip}:${local}`;
  const now = Date.now();
  const recent = (invalidCodesByClient.get(key) || []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  invalidCodesByClient.set(key, recent);
  return recent.length >= INVALID_CODE_LIMIT;
}

function recordInvalidCode(ip, local) {
  const key = `${ip}:${local}`;
  const now = Date.now();
  const recent = (invalidCodesByClient.get(key) || []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  invalidCodesByClient.set(key, recent);
}

function publishLocalCode(local) {
  if (!mqttClient || !mqttConnected || !LOCAL_CODE_SECRET) return;
  const timeSlot = Math.floor(Date.now() / (CODE_PERIOD_SECONDS * 1000));
  const topic = `/${local}/codigo`;
  mqttClient.publish(topic, codeFor(local, timeSlot), { qos: 1, retain: true }, (error) => {
    if (error) console.error(`Could not publish local code for ${local}:`, error.message);
  });
}

function publishLocalCodes() {
  for (const local of VALID_LOCALS) publishLocalCode(local);
}

function scheduleCodePublishing() {
  clearTimeout(codePublishTimer);
  const periodMs = CODE_PERIOD_SECONDS * 1000;
  const untilNextSlot = periodMs - (Date.now() % periodMs) + 25;
  codePublishTimer = setTimeout(() => {
    if (mqttConnected) publishLocalCodes();
    scheduleCodePublishing();
  }, untilNextSlot);
  codePublishTimer.unref();
}

if (MQTT_URL) {
  mqttClient = mqtt.connect(MQTT_URL, {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clientId: `gbqr_${Math.random().toString(16).slice(2, 12)}`,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
  });
  mqttClient.on("connect", () => {
    mqttConnected = true;
    console.log("Connected to MQTT broker");
    if (LOCAL_CODE_SECRET) publishLocalCodes();
    scheduleCodePublishing();
  });
  mqttClient.on("close", () => {
    mqttConnected = false;
  });
  mqttClient.on("error", (error) => {
    mqttConnected = false;
    console.error("MQTT connection error:", error.message);
  });
}

function json(response, status, data) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (requestsByIp.get(ip) || []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    requestsByIp.set(ip, recent);
    return true;
  }
  recent.push(now);
  requestsByIp.set(ip, recent);

  if (requestsByIp.size > 1000) {
    for (const [key, times] of requestsByIp) {
      if (times.every((time) => now - time >= RATE_LIMIT_WINDOW_MS)) requestsByIp.delete(key);
    }
  }
  return false;
}

function readJson(request, maxBytes = 2048) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    let tooLarge = false;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        tooLarge = true;
        body = "";
      }
    });
    request.on("end", () => {
      if (tooLarge) {
        reject(new Error("Request body too large"));
        return;
      }
      try {
        resolveBody(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function validName(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 40
    && /^[\p{L}\p{N}_-]+$/u.test(value);
}

function validType(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 80
    && /^[\p{L}\p{N}_ -]+$/u.test(value)
    && normalizeWords(value).length > 0;
}

function publishAlert(topic, message) {
  return new Promise((resolvePublish, reject) => {
    mqttClient.publish(
      topic,
      message,
      { qos: 1, retain: false },
      (error) => (error ? reject(error) : resolvePublish()),
    );
  });
}

async function serveStatic(response, pathname) {
  let requestedPath;
  try {
    requestedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  const candidate = resolve(PUBLIC_DIR, `.${requestedPath}`);
  if (candidate !== PUBLIC_DIR && !candidate.startsWith(PUBLIC_DIR + sep)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const data = await readFile(candidate);
    const type = extname(candidate) === ".css"
      ? "text/css; charset=utf-8"
      : extname(candidate) === ".js"
        ? "text/javascript; charset=utf-8"
        : "text/html; charset=utf-8";
    response.writeHead(200, {
      "content-type": type,
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'",
      "referrer-policy": "no-referrer",
    });
    response.end(data);
    return;
  } catch {
    if (extname(requestedPath)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
  }

  try {
    const html = await readFile(join(PUBLIC_DIR, "index.html"));
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'",
      "referrer-policy": "no-referrer",
    });
    response.end(html);
  } catch {
    response.writeHead(500);
    response.end("Web files are not available");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    return json(response, 200, { ok: true, mqttConnected });
  }

  if (request.method === "GET" && url.pathname === "/api/config") {
    const local = url.searchParams.get("local") || "";
    if (!isKnownLocal(local)) return json(response, 404, { ok: false, error: "Unknown local" });
    return json(response, 200, {
      ok: true,
      local,
      alertTypes: ALERT_TYPES,
      codeLength: CODE_LENGTH,
      codePeriodSeconds: CODE_PERIOD_SECONDS,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/alert") {
    const ip = request.socket.remoteAddress || "unknown";
    if (isRateLimited(ip)) {
      return json(response, 429, { ok: false, error: "Too many requests" });
    }

    let payload;
    try {
      payload = await readJson(request);
    } catch (error) {
      return json(response, error.message === "Request body too large" ? 413 : 400, {
        ok: false,
        error: error.message,
      });
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return json(response, 400, { ok: false, error: "Invalid QR data" });
    }

    const local = typeof payload.local === "string" ? payload.local : "";
    const nombre = payload.nombre;
    const identificador = payload.identificador;
    const rawType = payload.tipo_de_aviso;
    const tipoDeAviso = typeof rawType !== "string" || rawType === ""
      ? "Predeterminado"
      : normalizeWords(rawType);
    const codigo = typeof payload.codigo === "string" ? payload.codigo.trim() : "";

    if (!validLocalName(local)
      || !isKnownLocal(local)
      || !validName(nombre)
      || typeof identificador !== "string"
      || !/^[\p{L}\p{N}_-]{1,32}$/u.test(identificador)
      || !ALERT_TYPES.includes(tipoDeAviso)
      || !/^\d{6}$/.test(codigo)) {
      return json(response, 400, { ok: false, error: "Invalid QR data" });
    }
    if (!LOCAL_CODE_SECRET) {
      return json(response, 503, { ok: false, error: "Local code verification is not configured" });
    }
    if (tooManyInvalidCodes(ip, local)) {
      return json(response, 429, { ok: false, error: "Too many invalid codes" });
    }
    if (!isValidLocalCode(local, codigo)) {
      recordInvalidCode(ip, local);
      return json(response, 403, { ok: false, error: "Invalid or expired local code" });
    }
    if (!mqttClient || !mqttConnected) {
      return json(response, 503, { ok: false, error: "MQTT broker is not connected" });
    }

    const messageType = normalizeWords(tipoDeAviso);
    const message = messageType;
    const topic = `/${local}/${nombre}/${identificador}`;

    try {
      await publishAlert(topic, message);
      return json(response, 200, { ok: true, topic, message, id: randomUUID() });
    } catch (error) {
      console.error("MQTT publish failed:", error.message);
      return json(response, 502, { ok: false, error: "Could not publish the alert" });
    }
  }

  if (url.pathname.startsWith("/api/")) {
    return json(response, 404, { ok: false, error: "Not found" });
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }
  return serveStatic(response, url.pathname);
});

server.listen(PORT, () => {
  if (VALID_LOCALS.length === 0) console.error("No valid locals configured; set VALID_LOCALS in .env");
  if (!LOCAL_CODE_SECRET) console.error("Local code verification is disabled; set LOCAL_CODE_SECRET in .env");
  console.log(`Web server listening on port ${PORT}`);
});

