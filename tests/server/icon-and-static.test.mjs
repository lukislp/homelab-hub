import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { requestHandler, setData, serveStatic, DIST } from "../../server/app.mjs";

function listen(handler) {
  return new Promise((resolve) => {
    const s = http.createServer(handler);
    s.listen(0, "127.0.0.1", () => resolve(s));
  });
}

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

// Each icon test below uses a distinct link id - handleIcon caches proxied results in an
// in-memory Map keyed by id (24h TTL on success), so reusing an id across tests would leak
// a cached result from an earlier test instead of exercising the intended code path.
describe("GET /api/icon/:id", () => {
  it("404s for a link id that doesn't exist", async () => {
    setData({ version: 1, settings: { title: "t" }, categories: [], links: [] });
    const res = await fetch(`${base}/api/icon/does-not-exist`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/unknown link/);
  });

  it("proxies and caches the target's favicon.ico on success", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    let hits = 0;
    const upstream = await listen((req, res) => {
      hits += 1;
      if (req.url === "/favicon.ico") {
        res.writeHead(200, { "content-type": "image/png" });
        res.end(png);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    const { port } = upstream.address();
    setData({
      version: 1,
      settings: { title: "t" },
      categories: [{ id: "c", label: "C" }],
      links: [{ id: "icon-ok", name: "L", url: `http://127.0.0.1:${port}/`, category: "c", icon: { type: "favicon" }, checkEnabled: false }],
    });

    const res1 = await fetch(`${base}/api/icon/icon-ok`);
    expect(res1.status).toBe(200);
    expect(res1.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await res1.arrayBuffer())).toEqual(png);

    // Second request should be served from the in-memory cache - upstream not hit again.
    const hitsAfterFirst = hits;
    const res2 = await fetch(`${base}/api/icon/icon-ok`);
    expect(res2.status).toBe(200);
    expect(hits).toBe(hitsAfterFirst);

    await new Promise((r) => upstream.close(r));
  });

  it("404s and caches the failure when the target has no favicon", async () => {
    let hits = 0;
    const upstream = await listen((_req, res) => {
      hits += 1;
      res.writeHead(404);
      res.end();
    });
    const { port } = upstream.address();
    setData({
      version: 1,
      settings: { title: "t" },
      categories: [{ id: "c", label: "C" }],
      links: [{ id: "icon-fail", name: "L", url: `http://127.0.0.1:${port}/`, category: "c", icon: { type: "favicon" }, checkEnabled: false }],
    });

    const res = await fetch(`${base}/api/icon/icon-fail`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/no icon/);

    // Second request should be served from the cached failure - upstream not hit again.
    const hitsAfterFirst = hits;
    const res2 = await fetch(`${base}/api/icon/icon-fail`);
    expect(res2.status).toBe(404);
    expect(hits).toBe(hitsAfterFirst);

    await new Promise((r) => upstream.close(r));
  });

  it("404s with 'bad link url' when the stored url can't be parsed", async () => {
    setData({
      version: 1,
      settings: { title: "t" },
      categories: [{ id: "c", label: "C" }],
      // validateData would normally reject this, but handleIcon is exercised directly here
      // to cover its own defensive parse-failure branch.
      links: [{ id: "icon-badurl", name: "L", url: "not a url", category: "c", icon: { type: "favicon" }, checkEnabled: false }],
    });
    const res = await fetch(`${base}/api/icon/icon-badurl`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/bad link url/);
  });
});

describe("static file serving / SPA fallback", () => {
  beforeEach(() => {
    setData({ version: 1, settings: { title: "t" }, categories: [], links: [] });
  });

  it("blocks path traversal attempts that resolve outside dist/", async () => {
    // Calling serveStatic() directly with an already-decoded ".." pathname exercises its
    // resolved.startsWith(DIST) guard deterministically - going through a real HTTP request
    // wouldn't reliably reach this branch, since the WHATWG URL parser (used to derive
    // `pathname` in requestHandler) already normalizes both literal ".." and its
    // percent-encoded form ("%2e%2e") out of the path before serveStatic ever sees it.
    let statusCode;
    let body;
    const res = {
      writeHead(code) {
        statusCode = code;
      },
      end(b) {
        body = b;
      },
    };
    serveStatic({ method: "GET" }, res, "/../../../../../../etc/passwd");
    await new Promise((r) => setTimeout(r, 20)); // fs.stat callback is async
    expect(statusCode).toBe(404);
    expect(JSON.parse(body).error).toBe("not found");
  });

  it("serves the SPA fallback (index.html) for extension-less routes when dist/ is built, 404s cleanly otherwise", async () => {
    const res = await fetch(`${base}/some/client/route`);
    if (fs.existsSync(path.join(DIST, "index.html"))) {
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/text\/html/);
    } else {
      expect(res.status).toBe(404);
    }
  });

  it("404s a request for a file with an extension that doesn't exist, regardless of dist/ state", async () => {
    const res = await fetch(`${base}/definitely-missing-asset.js`);
    expect(res.status).toBe(404);
  });
});
