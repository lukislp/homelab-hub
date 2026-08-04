// End-to-end UI test: register a service via the modal, filter it, delete it.
// Runs headless against a temp DATA_DIR. Requires a built dist/ and chromium.
// Usage: node scripts/e2e.mjs
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.E2E_PORT || 8150);
const BASE = `http://127.0.0.1:${PORT}`;

function findChromium() {
  const candidates = [process.env.PW_CHROMIUM, "/opt/pw-browsers/chromium"].filter(Boolean);
  try {
    for (const entry of fs.readdirSync("/opt/pw-browsers")) {
      candidates.push(path.join("/opt/pw-browsers", entry, "chrome-linux", "chrome"));
      candidates.push(path.join("/opt/pw-browsers", entry, "chrome-linux", "headless_shell"));
    }
  } catch {
    /* not present */
  }
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {
      /* next */
    }
  }
  throw new Error("no chromium executable found — set PW_CHROMIUM=/path/to/chrome");
}

let fails = 0;
const ok = (m) => console.log("  ok:", m);
const fail = (m) => {
  console.error("  FAIL:", m);
  fails++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hub-e2e-"));
const server = spawn("node", [path.join(ROOT, "server", "server.mjs")], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir },
  stdio: "ignore",
});

try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) break;
    } catch {
      /* retry */
    }
    if (i > 40) throw new Error("server did not come up");
    await wait(250);
  }

  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForSelector('[data-testid="link-card"]');

  const seeded = (await page.locator('[data-testid="link-card"]').count()) > 0;
  seeded ? ok("seeded cards render") : fail("no cards rendered");

  // --- register a new service in a NEW category via the modal
  await page.click('[data-testid="add-button"]');
  await page.waitForSelector('[data-testid="modal"]');
  await page.fill('input[placeholder="Grafana"]', "Gitea");
  await page.fill('input[placeholder="http://grafana.home.lab:3000"]', `${BASE}/api/health`);
  await page.selectOption("select", "__new__");
  await page.fill('input[placeholder="e.g. Backups"]', "Dev Tools");
  await page.click('button:has-text("REGISTER")');
  await page.waitForSelector('[data-testid="modal"]', { state: "detached" });
  await page.waitForSelector('h3:has-text("Gitea")');
  ok("modal registers new service");

  (await page.locator('h2:has-text("Dev Tools")').count()) > 0
    ? ok("new category section appears")
    : fail("new category section missing");

  await wait(1200); // debounced PUT
  const data1 = await (await fetch(`${BASE}/api/data`)).json();
  const gitea = data1.links.find((l) => l.name === "Gitea");
  gitea && gitea.category === "dev-tools"
    ? ok("persisted to backend (category slug dev-tools)")
    : fail("backend does not contain the new link");

  // --- text filter narrows the grid
  await page.fill('input[placeholder="filter_"]', "gitea");
  await wait(300);
  (await page.locator('[data-testid="link-card"]').count()) === 1
    ? ok("text filter narrows to 1 card")
    : fail("text filter result wrong");
  await page.fill('input[placeholder="filter_"]', "");
  await wait(300);

  // --- edit mode: click card opens MODIFY modal; two-step delete
  await page.click('button:has-text("EDIT")');
  await page.click('h3:has-text("Gitea")');
  await page.waitForSelector('[data-testid="modal"]');
  (await page.locator('text=MODIFY SERVICE').count()) > 0
    ? ok("edit mode opens modify modal")
    : fail("modify modal missing");
  await page.click('button:has-text("DELETE")');
  await page.click('button:has-text("YES")');
  await page.waitForSelector('[data-testid="modal"]', { state: "detached" });
  await page.waitForSelector('h3:has-text("Gitea")', { state: "detached" });
  ok("two-step delete removes card");

  await wait(1200);
  const data2 = await (await fetch(`${BASE}/api/data`)).json();
  !data2.links.some((l) => l.name === "Gitea") && !data2.categories.some((c) => c.id === "dev-tools")
    ? ok("deletion persisted + empty category pruned")
    : fail("deletion not persisted correctly");

  await browser.close();
} catch (e) {
  fail(`unexpected: ${e.message}`);
} finally {
  server.kill("SIGTERM");
  fs.rmSync(dataDir, { recursive: true, force: true });
}

console.log(fails ? `\n[e2e] ${fails} FAILURE(S)` : "\n[e2e] all checks passed");
process.exit(fails ? 1 : 0);
