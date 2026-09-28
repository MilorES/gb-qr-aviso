import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import mqtt from "mqtt";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");
const PORT = Number(process.env.PORT || 3000);
const MQTT_URL = process.env.MQTT_URL;
const MQTT_TOPIC = process.env.MQTT_TOPIC || "gb/avisos/qr";

let mqttConnected = false;
let mqttClient;

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

function readJson(request, maxBytes = 2048) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolveBody(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function publishAlert(event) {
  return new Promise((resolvePublish, reject) => {
    mqttClient.publish(
      MQTT_TOPIC,
      JSON.stringify(event),
      { qos: 1, retain: false },
      (error) => (error ? reject(error) : resolvePublish()),
    );
  });
}

async function serveStatic(request, response, pathname) {
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

  let filePath = candidate;
  try {
    const data = await readFile(filePath);
    const type = extname(filePath) === ".css"
      ? "text/css; charset=utf-8"
      : extname(filePath) === ".js"
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

  if (request.method === "POST" && url.pathname === "/api/alert") {
    let payload;
    try {
      payload = await readJson(request);
    } catch (error) {
      if (!response.headersSent) {
        return json(response, error.message === "Request body too large" ? 413 : 400, {
          ok: false,
          error: error.message,
        });
      }
      return;
    }

    const bar = typeof payload.bar === "string" ? payload.bar.toLowerCase() : "";
    const mesa = typeof payload.mesa === "string" ? payload.mesa : "";
    if (!/^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/.test(bar) || !/^\d{1,4}$/.test(mesa) || Number(mesa) < 1) {
      return json(response, 400, { ok: false, error: "Invalid bar or table" });
    }
    if (!mqttClient || !mqttConnected) {
      return json(response, 503, { ok: false, error: "MQTT broker is not connected" });
    }

    const event = {
      event: "qr_opened",
      bar,
      mesa: Number(mesa),
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID(),
    };

    try {
      await publishAlert(event);
      return json(response, 200, { ok: true });
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
  return serveStatic(request, response, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT}`);
});
