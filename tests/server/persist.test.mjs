import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";

// DATA_DIR is read once at module load, so it has to be set before app.mjs is imported.
// Vitest gives each test file its own module registry, so this doesn't leak into other
// test files that rely on the default DATA_DIR.
let mod;
let tmpDir;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "homelab-hub-test-"));
  process.env.DATA_DIR = tmpDir;
  mod = await import("../../server/app.mjs");
});

afterAll(async () => {
  delete process.env.DATA_DIR;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("loadData / persist", () => {
  it("seeds a fresh links.json when none exists yet", async () => {
    await mod.loadData();
    const raw = await fs.readFile(mod.DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.links.length).toBeGreaterThan(0);
    expect(mod.getData()).toEqual(parsed);
  });

  it("round-trips a valid document through persist() then loadData()", async () => {
    const doc = {
      version: 1,
      settings: { title: "roundtrip" },
      categories: [{ id: "c", label: "C" }],
      links: [{ id: "l1", name: "L", url: "http://example.test", category: "c", icon: { type: "monogram" }, checkEnabled: false }],
    };
    await mod.persist(doc);
    await mod.loadData();
    expect(mod.getData()).toEqual(doc);
  });

  it("backs up and reseeds when links.json is corrupt", async () => {
    await fs.writeFile(mod.DATA_FILE, "{ not json", "utf8");
    await mod.loadData();
    expect(mod.getData().links.length).toBeGreaterThan(0);
    const files = await fs.readdir(tmpDir);
    expect(files.some((f) => f.startsWith("links.json.invalid-"))).toBe(true);
  });

  it("backs up and reseeds when links.json fails schema validation", async () => {
    await fs.writeFile(mod.DATA_FILE, JSON.stringify({ version: 1 }), "utf8");
    await mod.loadData();
    expect(mod.getData().links.length).toBeGreaterThan(0);
  });
});

describe("PUT /api/data end-to-end persists to disk", () => {
  it("writes the new document through the real HTTP handler and triggers a re-sweep", async () => {
    const server = http.createServer(mod.requestHandler);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const doc = {
      version: 1,
      settings: { title: "written-via-http" },
      categories: [{ id: "c", label: "C" }],
      links: [],
    };

    const res = await fetch(`${base}/api/data`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(doc),
    });
    expect(res.status).toBe(200);

    const raw = await fs.readFile(mod.DATA_FILE, "utf8");
    expect(JSON.parse(raw).settings.title).toBe("written-via-http");

    await new Promise((r) => server.close(r));
    mod.stopSweep(); // handlePut() calls sweepSoon() on success - cancel the timer it scheduled
  });
});
