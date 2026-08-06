import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import { requestHandler, setData, APP_VERSION } from "../../server/app.mjs";

let server;
let base;

beforeAll(async () => {
  server = http.createServer(requestHandler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((r) => server.close(r));
});

const sampleDoc = () => ({
  version: 1,
  settings: { title: "test hub" },
  categories: [{ id: "c", label: "C" }],
  links: [
    { id: "l1", name: "Link 1", url: "http://example.test", category: "c", icon: { type: "monogram" }, checkEnabled: false },
  ],
});

beforeEach(() => {
  setData(sampleDoc());
  delete process.env.READ_ONLY;
});

describe("GET /api/health", () => {
  it("reports ok/version/uptime and the current readOnly flag", async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, version: APP_VERSION, readOnly: false });
    expect(typeof body.uptime).toBe("number");
  });

  it("reflects READ_ONLY=true", async () => {
    process.env.READ_ONLY = "true";
    const res = await fetch(`${base}/api/health`);
    const body = await res.json();
    expect(body.readOnly).toBe(true);
  });
});

describe("GET /api/data", () => {
  it("returns the current in-memory document", async () => {
    const res = await fetch(`${base}/api/data`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings.title).toBe("test hub");
  });
});

describe("PUT /api/data - the READ_ONLY demo gate", () => {
  it("rejects writes with 403 and does not mutate the served document", async () => {
    process.env.READ_ONLY = "true";
    const before = await (await fetch(`${base}/api/data`)).json();

    const res = await fetch(`${base}/api/data`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...sampleDoc(), settings: { title: "changed" } }),
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/read-only/i);

    const after = await (await fetch(`${base}/api/data`)).json();
    expect(after).toEqual(before);
  });

  it("allows writes again once READ_ONLY is unset (validation still applies)", async () => {
    delete process.env.READ_ONLY;
    const res = await fetch(`${base}/api/data`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{not valid json",
    });
    // proves the request reached validation/parsing instead of being blocked by the gate
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/data - request validation", () => {
  it("rejects a non-JSON content-type with 415", async () => {
    const res = await fetch(`${base}/api/data`, { method: "PUT", headers: { "content-type": "text/plain" }, body: "x" });
    expect(res.status).toBe(415);
  });

  it("rejects invalid JSON with 400", async () => {
    const res = await fetch(`${base}/api/data`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a schema-invalid document with 400 and an error message", async () => {
    const res = await fetch(`${base}/api/data`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: 1 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});

describe("routing", () => {
  it("404s unknown /api/ routes", async () => {
    const res = await fetch(`${base}/api/does-not-exist`);
    expect(res.status).toBe(404);
  });

  it("405s unsupported methods on /api/data", async () => {
    const res = await fetch(`${base}/api/data`, { method: "DELETE" });
    expect(res.status).toBe(405);
  });

  it("405s unsupported methods on static routes (only GET/HEAD are allowed)", async () => {
    const res = await fetch(`${base}/some/spa/route`, { method: "POST" });
    expect(res.status).toBe(405);
  });
});
