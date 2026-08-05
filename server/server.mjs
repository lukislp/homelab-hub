#!/usr/bin/env node
/**
 * homelab-hub — zero-dependency backend (Node >= 20, node: builtins only).
 *
 * Serves the built SPA from ../dist AND the JSON API:
 *   GET  /api/health     -> { ok, version, uptime }            (k8s probes)
 *   GET  /api/data       -> DashboardData                       (full document)
 *   PUT  /api/data       -> validate + atomic write links.json  (1 MB cap)
 *   GET  /api/status     -> cached probe results of the sweep loop
 *   GET  /api/icon/<id>  -> favicon proxy for a stored link (in-memory cache)
 *
 * Data file: $DATA_DIR/links.json
 *   { version: 1,
 *     settings: { title, subtitle? },
 *     categories: [ { id, label } ],
 *     links: [ { id, name, url, description?, category,
 *                icon: {type:"favicon"|"lucide"|"monogram", name?},
 *                checkEnabled, statusUrl? } ] }
 * Order of links[] IS the display order (no explicit order field).
 */

import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "links.json");
const SWEEP_INTERVAL_MS = Number(process.env.SWEEP_INTERVAL_MS || 15000);
const PROBE_TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS || 5000);
const MAX_BODY_BYTES = 1024 * 1024;
const APP_VERSION = "0.1.0";
// Public demo instances: reject writes server-side regardless of what the frontend does -
// the frontend also skips the network round-trip entirely in this mode (see dashboard.ts),
// but this is the actual enforcement in case /api/data is called directly.
const READ_ONLY = process.env.READ_ONLY === "true";

const log = (...args) => console.log("[hub]", ...args);
const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ data - */

function seedData() {
  const uid = () => randomUUID();
  return {
    version: 1,
    settings: { title: "homelab-hub", subtitle: "self-hosted service registry" },
    categories: [
      { id: "infra", label: "Infra" },
      { id: "network", label: "Network" },
      { id: "smart-home", label: "Smart Home" },
      { id: "media", label: "Media" },
      { id: "monitoring", label: "Monitoring" },
    ],
    links: [
      { id: uid(), name: "Proxmox VE", url: "https://proxmox.home.lab:8006", description: "Virtualization host", category: "infra", icon: { type: "lucide", name: "server" }, checkEnabled: true },
      { id: uid(), name: "TrueNAS Scale", url: "https://truenas.home.lab", description: "Storage & shares", category: "infra", icon: { type: "lucide", name: "database" }, checkEnabled: true },
      { id: uid(), name: "Portainer", url: "https://portainer.home.lab:9443", description: "Container management", category: "infra", icon: { type: "lucide", name: "boxes" }, checkEnabled: true },
      { id: uid(), name: "AdGuard Home", url: "http://adguard.home.lab", description: "DNS & ad blocking", category: "network", icon: { type: "lucide", name: "shield" }, checkEnabled: true },
      { id: uid(), name: "OPNsense", url: "https://opnsense.home.lab", description: "Firewall & routing", category: "network", icon: { type: "lucide", name: "router" }, checkEnabled: true },
      { id: uid(), name: "Home Assistant", url: "http://homeassistant.home.lab:8123", description: "Home automation", category: "smart-home", icon: { type: "lucide", name: "home" }, checkEnabled: true },
      { id: uid(), name: "Jellyfin", url: "http://jellyfin.home.lab:8096", description: "Media streaming", category: "media", icon: { type: "lucide", name: "film" }, checkEnabled: true },
      { id: uid(), name: "Immich", url: "http://immich.home.lab:2283", description: "Photo backup", category: "media", icon: { type: "lucide", name: "image" }, checkEnabled: true },
      { id: uid(), name: "Grafana", url: "http://grafana.home.lab:3000", description: "Dashboards & metrics", category: "monitoring", icon: { type: "lucide", name: "activity" }, checkEnabled: true },
      { id: uid(), name: "Uptime Kuma", url: "http://uptime.home.lab:3001", description: "Service monitoring", category: "monitoring", icon: { type: "lucide", name: "gauge" }, checkEnabled: true },
    ],
  };
}

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Returns an error string or null when valid. */
function validateData(d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return "document must be an object";
  if (d.version !== 1) return "version must be 1";
  if (!d.settings || typeof d.settings !== "object") return "settings missing";
  if (typeof d.settings.title !== "string" || !d.settings.title.trim() || d.settings.title.length > 80) return "settings.title invalid";
  if (d.settings.subtitle != null && (typeof d.settings.subtitle !== "string" || d.settings.subtitle.length > 120)) return "settings.subtitle invalid";
  if (!Array.isArray(d.categories) || d.categories.length > 50) return "categories invalid";
  const catIds = new Set();
  for (const c of d.categories) {
    if (!c || typeof c !== "object") return "category invalid";
    if (typeof c.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(c.id)) return `category id invalid: ${String(c && c.id)}`;
    if (typeof c.label !== "string" || !c.label.trim() || c.label.length > 40) return `category label invalid: ${c.id}`;
    if (catIds.has(c.id)) return `duplicate category id: ${c.id}`;
    catIds.add(c.id);
  }
  if (!Array.isArray(d.links) || d.links.length > 500) return "links invalid";
  const ids = new Set();
  for (const l of d.links) {
    if (!l || typeof l !== "object") return "link invalid";
    if (typeof l.id !== "string" || !l.id || l.id.length > 64) return "link id invalid";
    if (ids.has(l.id)) return `duplicate link id: ${l.id}`;
    ids.add(l.id);
    if (typeof l.name !== "string" || !l.name.trim() || l.name.length > 80) return `link name invalid: ${l.id}`;
    if (typeof l.url !== "string" || !isHttpUrl(l.url)) return `link url invalid: ${l.name}`;
    if (l.description != null && (typeof l.description !== "string" || l.description.length > 240)) return `link description invalid: ${l.name}`;
    if (typeof l.category !== "string" || !catIds.has(l.category)) return `link category unknown: ${l.name}`;
    if (!l.icon || typeof l.icon !== "object") return `link icon invalid: ${l.name}`;
    if (!["favicon", "lucide", "monogram"].includes(l.icon.type)) return `link icon.type invalid: ${l.name}`;
    if (l.icon.type === "lucide" && (typeof l.icon.name !== "string" || !/^[a-z0-9-]{1,40}$/.test(l.icon.name))) return `link icon.name invalid: ${l.name}`;
    if (typeof l.checkEnabled !== "boolean") return `link checkEnabled invalid: ${l.name}`;
    if (l.statusUrl != null && (typeof l.statusUrl !== "string" || !isHttpUrl(l.statusUrl))) return `link statusUrl invalid: ${l.name}`;
  }
  return null;
}

let data = null;
let writeChain = Promise.resolve();

/** Atomic write: tmp file in the same dir + rename; chained so writes never interleave. */
function persist(doc) {
  const json = JSON.stringify(doc, null, 2) + "\n";
  const run = writeChain.then(async () => {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(tmp, json, "utf8");
    await fsp.rename(tmp, DATA_FILE);
  });
  // keep the chain alive even if a write fails; callers observe `run`
  writeChain = run.catch(() => {});
  return run;
}

async function loadData() {
  try {
    const raw = await fsp.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const err = validateData(parsed);
    if (err) throw new Error(`schema: ${err}`);
    data = parsed;
    log(`loaded ${data.links.length} links from ${DATA_FILE}`);
    return;
  } catch (e) {
    if (e && e.code === "ENOENT") {
      data = seedData();
      await persist(data);
      log(`seeded ${DATA_FILE} with ${data.links.length} example links`);
      return;
    }
    // Corrupt/invalid file: keep the bytes, start from seed.
    const backup = `${DATA_FILE}.invalid-${Date.now()}`;
    try {
      await fsp.rename(DATA_FILE, backup);
      log(`WARNING: ${DATA_FILE} was invalid (${e.message}); moved to ${backup}`);
    } catch { /* nothing to back up */ }
    data = seedData();
    await persist(data);
  }
}

/* ----------------------------------------------------------------- probes - */

const statuses = new Map(); // link id -> LinkStatus
let lastSweepAt = null;
let sweeping = false;
let resweepRequested = false;
let sweepTimer = null;

function probeOnce(rawUrl) {
  return new Promise((resolve) => {
    let u;
    try {
      u = new URL(rawUrl);
    } catch {
      return resolve({ state: "unknown", latencyMs: null, httpStatus: null, error: "BAD_URL", checkedAt: nowIso() });
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return resolve({ state: "unknown", latencyMs: null, httpStatus: null, error: "BAD_PROTOCOL", checkedAt: nowIso() });
    }
    const mod = u.protocol === "https:" ? https : http;
    const started = performance.now();
    let settled = false;
    const done = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    const req = mod.get(
      u,
      {
        rejectUnauthorized: false, // homelab self-signed certs are fine for a reachability probe
        headers: { "user-agent": `homelab-hub/${APP_VERSION}` },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      },
      (res) => {
        const latencyMs = Math.max(0, Math.round(performance.now() - started));
        // ANY http response means the service is alive (401/403/302 included).
        done({ state: "online", latencyMs, httpStatus: res.statusCode ?? null, checkedAt: nowIso() });
        res.resume();
        req.destroy();
      }
    );
    req.on("error", (err) => {
      const isTimeout = err && (err.code === "ABORT_ERR" || err.name === "AbortError" || err.name === "TimeoutError");
      const code = isTimeout ? "TIMEOUT" : (err && (err.code || err.name)) || "ERROR";
      done({ state: "offline", latencyMs: null, httpStatus: null, error: String(code), checkedAt: nowIso() });
    });
  });
}

async function sweep() {
  if (sweeping) {
    resweepRequested = true;
    return;
  }
  sweeping = true;
  if (sweepTimer) clearTimeout(sweepTimer);
  try {
    const links = data ? data.links : [];
    const validIds = new Set(links.map((l) => l.id));
    for (const key of [...statuses.keys()]) if (!validIds.has(key)) statuses.delete(key);
    const targets = links.filter((l) => l.checkEnabled);
    await Promise.allSettled(
      targets.map(async (l) => {
        const st = await probeOnce(l.statusUrl || l.url);
        statuses.set(l.id, st);
      })
    );
    lastSweepAt = nowIso();
  } finally {
    sweeping = false;
    const delay = resweepRequested ? 250 : SWEEP_INTERVAL_MS;
    resweepRequested = false;
    sweepTimer = setTimeout(sweep, delay);
    if (sweepTimer.unref) sweepTimer.unref();
  }
}

function sweepSoon() {
  if (sweeping) {
    resweepRequested = true;
    return;
  }
  if (sweepTimer) clearTimeout(sweepTimer);
  sweepTimer = setTimeout(sweep, 150);
  if (sweepTimer.unref) sweepTimer.unref();
}

/* ------------------------------------------------------------- icon proxy - */

const iconCache = new Map(); // link id -> { ok, buf, type, expires }
const ICON_TTL_OK = 24 * 3600 * 1000;
const ICON_TTL_FAIL = 10 * 60 * 1000;
const ICON_MAX_BYTES = 512 * 1024;

function fetchFavicon(targetUrl, allowedHost, redirectsLeft) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(targetUrl);
    } catch {
      return reject(new Error("bad url"));
    }
    if ((u.protocol !== "http:" && u.protocol !== "https:") || u.hostname !== allowedHost) {
      return reject(new Error("blocked"));
    }
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.get(
      u,
      {
        rejectUnauthorized: false,
        headers: { "user-agent": `homelab-hub/${APP_VERSION}`, accept: "image/*,*/*;q=0.5" },
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      },
      (res) => {
        const code = res.statusCode ?? 0;
        if (code >= 300 && code < 400 && res.headers.location && redirectsLeft > 0) {
          res.resume();
          try {
            const next = new URL(res.headers.location, u).toString();
            resolve(fetchFavicon(next, allowedHost, redirectsLeft - 1));
          } catch {
            reject(new Error("bad redirect"));
          }
          return;
        }
        if (code < 200 || code >= 300) {
          res.resume();
          return reject(new Error(`status ${code}`));
        }
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > ICON_MAX_BYTES) {
            req.destroy();
            reject(new Error("too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          if (buf.length === 0) return reject(new Error("empty"));
          const declared = String(res.headers["content-type"] || "");
          const looksIco = buf.length > 4 && buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0;
          const looksPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50;
          const looksSvg = /^\s*<(\?xml|svg)/i.test(buf.subarray(0, 200).toString("utf8"));
          if (!declared.startsWith("image/") && !looksIco && !looksPng && !looksSvg) {
            return reject(new Error("not an image"));
          }
          const type = declared.startsWith("image/")
            ? declared
            : looksPng ? "image/png" : looksSvg ? "image/svg+xml" : "image/x-icon";
          resolve({ buf, type });
        });
        res.on("error", (e) => reject(e));
      }
    );
    req.on("error", (e) => reject(e));
  });
}

async function handleIcon(res, id) {
  const link = data && data.links.find((l) => l.id === id);
  if (!link) return sendJson(res, 404, { error: "unknown link" });
  const cached = iconCache.get(id);
  if (cached && cached.expires > Date.now()) {
    if (!cached.ok) return sendJson(res, 404, { error: "no icon" });
    res.writeHead(200, { "content-type": cached.type, "cache-control": "public, max-age=3600" });
    return res.end(cached.buf);
  }
  let origin;
  let host;
  try {
    const u = new URL(link.url);
    origin = u.origin;
    host = u.hostname;
  } catch {
    return sendJson(res, 404, { error: "bad link url" });
  }
  try {
    const { buf, type } = await fetchFavicon(`${origin}/favicon.ico`, host, 2);
    iconCache.set(id, { ok: true, buf, type, expires: Date.now() + ICON_TTL_OK });
    res.writeHead(200, { "content-type": type, "cache-control": "public, max-age=3600" });
    res.end(buf);
  } catch {
    iconCache.set(id, { ok: false, buf: null, type: null, expires: Date.now() + ICON_TTL_FAIL });
    sendJson(res, 404, { error: "no icon" });
  }
}

/* -------------------------------------------------------------------- api - */

function sendJson(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const tooLarge = () => Object.assign(new Error("payload too large"), { statusCode: 413 });
    const declared = Number(req.headers["content-length"] || 0);
    if (declared > MAX_BODY_BYTES) {
      req.resume(); // drain instead of destroy — keeps the socket usable for the 413 response
      return reject(tooLarge());
    }
    const chunks = [];
    let size = 0;
    let done = false;
    req.on("data", (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        done = true;
        chunks.length = 0;
        req.resume();
        reject(tooLarge());
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!done) resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", (e) => {
      if (!done) {
        done = true;
        reject(e);
      }
    });
  });
}

async function handlePut(req, res) {
  if (READ_ONLY) return sendJson(res, 403, { error: "read-only demo instance - changes aren't saved" });
  const ct = String(req.headers["content-type"] || "");
  if (!ct.includes("application/json")) {
    return sendJson(res, 415, { error: "content-type must be application/json" });
  }
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return sendJson(res, e.statusCode === 413 ? 413 : 400, { error: e.message });
  }
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return sendJson(res, 400, { error: "invalid json" });
  }
  const err = validateData(parsed);
  if (err) return sendJson(res, 400, { error: err });
  const prev = data;
  data = parsed;
  try {
    await persist(parsed);
  } catch (e) {
    data = prev;
    log("write failed:", e.message);
    return sendJson(res, 500, { error: "write failed" });
  }
  sweepSoon();
  sendJson(res, 200, { ok: true });
}

/* ----------------------------------------------------------------- static - */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function sendFile(res, filePath, pathname, method) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const cache = pathname.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "no-cache";
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      return sendJson(res, 404, { error: "not found" });
    }
    res.writeHead(200, { "content-type": type, "content-length": st.size, "cache-control": cache });
    if (method === "HEAD") return res.end();
    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      if (!res.headersSent) sendJson(res, 500, { error: "read failed" });
      else res.destroy();
    });
    stream.pipe(res);
  });
}

function serveStatic(req, res, pathname) {
  let p;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    return sendJson(res, 404, { error: "not found" });
  }
  if (p.includes("\0")) return sendJson(res, 404, { error: "not found" });
  if (p === "/") p = "/index.html";
  const resolved = path.normalize(path.join(DIST, p));
  if (resolved !== DIST && !resolved.startsWith(DIST + path.sep)) {
    return sendJson(res, 404, { error: "not found" });
  }
  fs.stat(resolved, (err, st) => {
    if (!err && st.isFile()) return sendFile(res, resolved, p, req.method);
    // SPA fallback for extension-less routes
    if (path.extname(p) === "") return sendFile(res, path.join(DIST, "index.html"), "/index.html", req.method);
    return sendJson(res, 404, { error: "not found" });
  });
}

/* ----------------------------------------------------------------- server - */

function requestHandler(req, res) {
  let pathname;
  try {
    pathname = new URL(req.url, "http://internal").pathname;
  } catch {
    return sendJson(res, 400, { error: "bad request" });
  }

  if (pathname === "/api/health") return sendJson(res, 200, { ok: true, version: APP_VERSION, uptime: Math.round(process.uptime()), readOnly: READ_ONLY });
  if (pathname === "/api/data") {
    if (req.method === "GET") return sendJson(res, 200, data);
    if (req.method === "PUT") return void handlePut(req, res);
    return sendJson(res, 405, { error: "method not allowed" });
  }
  if (pathname === "/api/status") {
    return sendJson(res, 200, { sweepAt: lastSweepAt, statuses: Object.fromEntries(statuses) });
  }
  if (pathname.startsWith("/api/icon/")) {
    return void handleIcon(res, pathname.slice("/api/icon/".length));
  }
  if (pathname.startsWith("/api/")) return sendJson(res, 404, { error: "not found" });
  if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, 405, { error: "method not allowed" });
  return serveStatic(req, res, pathname);
}

// Native TLS termination for the Gateway->pod hop (k8s/deployment.yaml's
// BackendTLSPolicy verifies against this) - falls back to plain HTTP when unset
// (local dev via `npm run server`, no cert available there).
const TLS_KEY_PATH = process.env.HOMELAB_HUB_TLS_KEY;
const TLS_CERT_PATH = process.env.HOMELAB_HUB_TLS_CERT;
const useTls = Boolean(TLS_KEY_PATH && TLS_CERT_PATH);
const server = useTls
  ? https.createServer({ key: fs.readFileSync(TLS_KEY_PATH), cert: fs.readFileSync(TLS_CERT_PATH) }, requestHandler)
  : http.createServer(requestHandler);

function shutdown(signal) {
  log(`${signal} received, shutting down`);
  if (sweepTimer) clearTimeout(sweepTimer);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

await loadData();
server.listen(PORT, HOST, () => {
  log(`listening on ${useTls ? "https" : "http"}://${HOST}:${PORT} (data: ${DATA_FILE}, dist: ${fs.existsSync(DIST) ? "ok" : "MISSING"})`);
  sweep();
});
