// Renders the dashboard with a demo dataset and captures screenshots.
// Usage: node scripts/screenshot.mjs [outdir]   (default: screenshots/)
// Requires a built dist/ and a chromium binary (playwright-core does not download one).
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, "screenshots"));
const PORT = Number(process.env.SHOT_PORT || 8140);
const BASE = `http://127.0.0.1:${PORT}`;

function findChromium() {
  const candidates = [];
  if (process.env.PW_CHROMIUM) candidates.push(process.env.PW_CHROMIUM);
  candidates.push("/opt/pw-browsers/chromium");
  try {
    for (const entry of fs.readdirSync("/opt/pw-browsers")) {
      candidates.push(path.join("/opt/pw-browsers", entry, "chrome-linux", "chrome"));
      candidates.push(path.join("/opt/pw-browsers", entry, "chrome-linux", "headless_shell"));
    }
  } catch {
    /* directory not present on this machine */
  }
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {
      /* try next */
    }
  }
  throw new Error("no chromium executable found — set PW_CHROMIUM=/path/to/chrome");
}

function demoData(base) {
  const link = (id, name, url, description, category, icon, checkEnabled = true) => ({
    id, name, url, description, category, icon, checkEnabled,
  });
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
      link("l01", "Proxmox VE", `${base}/api/health`, "Virtualization host", "infra", { type: "lucide", name: "server" }),
      link("l02", "TrueNAS Scale", `${base}/api/health`, "Storage & shares", "infra", { type: "lucide", name: "database" }),
      link("l03", "Portainer", "http://127.0.0.1:1", "Container management", "infra", { type: "lucide", name: "boxes" }),
      link("l04", "AdGuard Home", `${base}/api/health`, "DNS & ad blocking", "network", { type: "lucide", name: "shield" }),
      link("l05", "OPNsense", "http://127.0.0.1:1", "Firewall & routing", "network", { type: "lucide", name: "router" }),
      link("l06", "Home Assistant", `${base}/api/health`, "Home automation", "smart-home", { type: "lucide", name: "home" }),
      link("l07", "ESPHome", `${base}/api/health`, "ESP node firmware", "smart-home", { type: "lucide", name: "cpu" }),
      link("l08", "Jellyfin", `${base}/api/health`, "Media streaming", "media", { type: "lucide", name: "film" }),
      link("l09", "Immich", "http://127.0.0.1:1", "Photo backup", "media", { type: "lucide", name: "image" }),
      link("l10", "Grafana", `${base}/api/health`, "Dashboards & metrics", "monitoring", { type: "lucide", name: "activity" }),
      link("l11", "Uptime Kuma", `${base}/api/health`, "Service monitoring", "monitoring", { type: "lucide", name: "gauge" }),
      link("l12", "Wiki", "http://wiki.home.lab", "Runbooks & notes", "monitoring", { type: "monogram" }, false),
    ],
  };
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hub-shots-"));
fs.writeFileSync(path.join(dataDir, "links.json"), JSON.stringify(demoData(BASE), null, 2));
fs.mkdirSync(OUT, { recursive: true });

const server = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, SWEEP_INTERVAL_MS: "5000" },
  stdio: "ignore",
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(fn, timeoutMs, label) {
  const start = Date.now();
  for (;;) {
    if (await fn().catch(() => false)) return;
    if (Date.now() - start > timeoutMs) throw new Error(`timeout: ${label}`);
    await wait(300);
  }
}

try {
  await until(async () => (await fetch(`${BASE}/api/health`)).ok, 10000, "server up");
  await until(async () => {
    const r = await (await fetch(`${BASE}/api/status`)).json();
    return r.sweepAt && Object.keys(r.statuses).length >= 11;
  }, 20000, "first probe sweep");

  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--force-color-profile=srgb"],
  });

  async function shot(name, { width, height, dsf = 1, fullPage = false, before } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForSelector('[data-testid="link-card"]');
    await page.evaluate(() => document.fonts.ready);
    await wait(1500); // entrance animations settle
    if (before) await before(page);
    await page.screenshot({ path: path.join(OUT, name), fullPage });
    await ctx.close();
    console.log("[shots] captured", name);
  }

  await shot("desktop.png", { width: 1440, height: 900 });
  await shot("desktop-full.png", { width: 1440, height: 900, fullPage: true });
  await shot("mobile.png", { width: 390, height: 844, dsf: 2 });
  await shot("desktop-modal.png", {
    width: 1440,
    height: 900,
    before: async (page) => {
      await page.click('[data-testid="add-button"]');
      await page.waitForSelector('[data-testid="modal"]');
      await wait(500);
    },
  });

  await browser.close();
  console.log("[shots] done ->", OUT);
} finally {
  server.kill("SIGTERM");
  fs.rmSync(dataDir, { recursive: true, force: true });
}
